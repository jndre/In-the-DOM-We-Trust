const common = rootRequire("core/common");
const browser = rootRequire("core/browser");
const db = rootRequire("core/db");
const config = rootRequire("config");

let modules;
let options = {};
let shutdown = false;

module.exports = {
    seed,
    crawl,
    addUrls,
};

process.on('SIGINT', function() {
    shutdown = true;
    process.exit(1);
});

async function seed() {
    await db.create(
        "pages(pid INT UNSIGNED NOT NULL AUTO_INCREMENT, root INT UNSIGNED NOT NULL, hash CHAR(11) NOT NULL, " +
        "protocol VARCHAR(16) NOT NULL, host VARCHAR(256) NOT NULL, port VARCHAR(6) DEFAULT '', " +
        "path VARCHAR(2048) DEFAULT '', query VARCHAR(2048) DEFAULT '', fragment VARCHAR(2048) DEFAULT '', " +
        "depth TINYINT NOT NULL DEFAULT 0, status TINYINT NOT NULL DEFAULT 0, retries TINYINT NOT NULL DEFAULT 0," +
        "finished DATETIME, message VARCHAR(100), " +
        "PRIMARY KEY(pid), UNIQUE(hash), INDEX(pid), INDEX(status), INDEX(root))"
    );
}

async function crawl(params) {
    modules = params.modules;
    options = params.crawlerOptions;
    log("Crawler options:", options);
    await browser.initialize(params);
    await restartBrowser(params);

    //Option to visit a single page for debugging
    if (config.url) {
        let row = {pid: 0, root: 0, status: -1, depth: 0};
        Object.assign(row, common.parseUrl(config.url));
        while (true) {
            await visit(row);
        }
    }

    //Do the crawling
    let count = 0;
    while (!shutdown) {
        //If we start by root instead of the using the default insert order, we effectively crawl depth first
        let orderBy = options.depthFirst ? "ORDER BY root ASC" : "";
        //Get the next URL for this shard (modulo calculation needed so that multiple crawlers do not cause race conditions)
        let [rows] = await db.query(`SELECT * FROM pages WHERE status = ? AND root % ? = ? ${orderBy} LIMIT 1`,
            [common.status.new, config.crawlerTotal, config.crawlerId]);
        if (rows.length === 0) {
            //If no more "fresh" URLs, check if there are URLs to re-crawl that previously failed
            [rows] = await db.query(`SELECT * FROM pages WHERE status < 0 AND retries < ? AND root % ? = ? ${orderBy} LIMIT 1`,
                [options.maxRetries, config.crawlerTotal, config.crawlerId]);
        }
        if (rows.length === 0) {
            //Means that this shard is done and thus this crawler process will permanently stop now
            break;
        }
        await visit(rows[0]);

        //Restart the browser every X pages
        if (++count % 100 === 0) {
            await restartBrowser();
        }
    }
}

async function restartBrowser() {
    //Can also be used to start if not yet running
    await browser.start();
    await callAll("initialize");
}

async function visit(params) {
    let duringResult = {};
    let url = params.protocol + params.host + params.port + params.path + params.query + params.fragment;
    log("\n", params.pid, url);

    if (params.status < 0 && !params.revisit) {
        //If this is a retry, increase the number of retries
        params.retries += 1;
    }

    //Mark as started
    await db.query("UPDATE pages SET status = ?, retries = ? WHERE pid = ?", [common.status.started, params.retries, params.pid]);
    try {
        //Actually visit the page by navigating the browser
        const promise = browser.goto(url, async function() {
            await callAll("before", params);
        });
        //XXX While Playwright also has a timeout for navigations, it does not seem to be very reliable
        params.destination = await common.timeout(promise, config.loadTimeout + 1000);

        //Just for logging/debugging, actual scope checks below
        if (params.host != params.destination.host) {
            console.log("Redirected to", params.destination.host);
        }

        //If a subpage gets redirected to a different domain, check if it is still in scope:
        //Either on the same site or the same domain if we disabled sameSite crawling
        //Do not check this first depth == 0 since we want to follow all redirects initially
        if (params.depth > 0 && (!common.sameSite(url, params.destination)
            || (!options.sameSite && params.destination.host != params.host))) {
            throw new Error("Out of scope");
        }

        //Execute the modules
        duringResult = await callAll("during", params);
        //We need to extract links before closing the page, but do not insert them yet
        const links = await extractLinks(params);

        //If needed, stop on the page for manual debugging before the tab is closed
        if (config.freeze) {
            await common.sleep(999999999);
        }

        //Close the page to prevent further changes, then execute after
        await browser.closePage();
        await callAll("after", params);

        //Allow repeated visits to the same page
        if (duringResult.reload) {
            //Counter for repeated visits, not saved to DB
            params.revisit = params.revisit ? params.revisit + 1 : 1;
            await visit(params);
        }
        //Only insert links at the end, when there were no errors and we do not want to reload the page any further
        //If manualQueue is enabled, also only if the module actually wants to queue them
        else if (!options.manualQueue || duringResult.queueLinks) {
            await addUrls(links);
        }

        //Mark as crawled
        await db.query(
            "UPDATE pages SET status = ?, finished = ?, message = NULL WHERE pid = ?",
            [common.status.done, common.timestamp(), params.pid]
        );
    }
    catch (error) {
        console.log(error);
        let status = common.status.failed;
        let message = error.message.split("\n")[0].substring(0, 100);
        if (message == "Out of scope") {
            status = common.status.oos;
            message = null;
        }
        await db.query(
            "UPDATE pages SET status = ?, finished = ?, message = ? WHERE pid = ?",
            [status, common.timestamp(), message, params.pid]
        );
        if (error.message.includes("Target page, context or browser has been closed")) {
            await restartBrowser();
        }
        //Notify all modules about the error for possible clean-up steps
        params.error = error;
        await callAll("abort", params);
    }
}

async function callAll(functionName, params) {
    let promises = [];
    for (let name of modules) {
        if (name[functionName]) {
            promises.push(name[functionName](params));
        }
    }
    let result = await Promise.all(promises);
    //Merge result in case of multiple modules
    return Object.assign({}, ...result);
}

async function isResourceUrl(url) {
    return /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|bmp|tiff|svg|psd|ai|eps|ps|tar\.gz|zip|rar|7z|gz|bz2|mp3|mp4|avi|mov|mkv|flac|wav|webm|webp)$/i.test(url);
}

async function extractLinks(params) {
    //Stop if we reached max depth
    if (params.depth + 1 > options.maxDepth) {
        return [];
    }

    //Extract all links from the page
    let links = await browser.page().evaluate(`Array.from(document.querySelectorAll("a"))
        .map(a => a.href).filter(a => typeof a === 'string' && a.startsWith("http"))`);
    if (options.randomizeLinks) {
        common.shuffle(links);
    }

    let entries = [];
    for (let link of links) {
        let parsedLink = common.parseUrl(link);
        //Check if in scope. Either exactly same domain as after the redirect,
        //or on the same site (sub-, parent- oder sibling domain)
        if (parsedLink.host == params.destination.host || (options.sameSite && common.sameSite(parsedLink, params.destination))) {
            if(! (await isResourceUrl(link))){
                entries.push({url: link, root: params.root, depth: params.depth + 1});
            }
        }
    }
    return entries;
}

async function addUrls(entries) {
    if (entries.length == 0) {
        return;
    }

    //Get already inserted hashes, if we want a total maximum
    let seen = new Set();
    if (options.maxLinks > 0) {
        //XXX Assumes that we never add URLs for multiple different roots at the same time
        let [rows] = await db.query("SELECT hash FROM pages WHERE root = ?", [entries[0].root]);
        if (rows.length > options.maxLinks + 1) {
            return;
        }
        for (let row of rows) {
            seen.add(row.hash);
        }
    }

    let data = [];
    for (let entry of entries) {
        let url = common.parseUrl(entry.url);
        //Skip if we added this url before
        if (seen.has(url.hash)) {
            continue;
        }
        //Queue for insertion
        data.push([
            null, entry.root, url.hash, url.protocol, url.host, url.port, url.path, url.query, url.fragment,
            entry.depth, common.status.new
        ]);
        seen.add(url.hash);
        //Stop if we reached the maximum amount of URLs for this site
        if (options.maxLinks > 0 && options.maxLinks + 1 - seen.size <= 0) {
            break;
        }
    }
    if (data.length == 0) {
        return;
    }
    await db.query(
        "INSERT IGNORE INTO pages (pid, root, hash, protocol, host, port, path, query, fragment, depth, status) VALUES ?",
        [data]
    );
}
