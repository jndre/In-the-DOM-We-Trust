const common = rootRequire("core/common");
const fs = require("fs");
const browser = rootRequire("core/browser");
const crawler = rootRequire("core/crawler");
const db = rootRequire("core/db");
const importer = rootRequire("core/importer");

const event = common.event;
const acceptify = common.readFile("snippets/cookieAcceptify.js");
const cookieWrapper = common.readFile("snippets/cookieWrapper.js");

let candidates = [];
let seenCookies = new Set();
let frameToCookies = new Map();
let frameToResponseTraffic = new Map();
let frameToRequestTraffic = new Map();

const options = {
    browser: {},
    //Viewport is important for screenshots and checking if elements are visible in the viewport
    context: {viewport: {width: 1920, height: 1080}},
    //Manual queue since we only want to crawl deeper on pages with a cookie banner
    //Disable sameSite since we want to stay on the same domain and ignore other subdomains
    crawler: {maxDepth: 2, maxLinks: 20, maxRetries: 1, sameSite: false, depthFirst: true, manualQueue: true},
    seed: {list: "eu.csv", pageLimit: 10000},
    debug: false,
};

if (!options.debug) {
    console.debug = () => null;
}

module.exports = {
    options,
    seed,
    initialize,
    before,
    during,
    abort,
};

async function seed() {
    await crawler.seed();
    await importer.csv({file: options.seed.list, limit: options.seed.pageLimit});
    await db.create(
        "cookies(" +
        "root INT UNSIGNED NOT NULL, pid INT UNSIGNED NOT NULL, stage VARCHAR(10), fpcookies SMALLINT, " +
        "tpcookies SMALLINT, iframes SMALLINT, fpscripts SMALLINT, tpscripts SMALLINT, candidates SMALLINT, " +
        "tcf SMALLINT, consents SMALLINT, acceptType TEXT, acceptName TEXT, acceptPresent TINYINT, " +
        "INDEX(root), INDEX(pid), INDEX(stage)" +
        ")"
    );
    await db.create(
        "cookies_frames(" +
        "pid INT UNSIGNED NOT NULL, stage VARCHAR(10), fid INT UNSIGNED NOT NULL, main TINYINT, " +
        "origin MEDIUMTEXT, sameparty TINYINT, banner TINYINT, " +
        "httpFirst SMALLINT comment 'First-party cookies set via Set-Cookie Header', " +
        "httpFirstRedirect SMALLINT comment 'Same as httpFirst but set in a Redirect; disjunctive from httpFirst', " +
        "httpThird SMALLINT comment 'Third-party cookies set via Set-Cookie Header', " +
        "httpThirdRedirect SMALLINT comment 'Same as httpThird but set in a Redirect; disjunctive from httpThird', " +
        "jsFirst SMALLINT comment 'First-party (client-side) cookies set with JavaScript', " +
        "jsThird SMALLINT comment 'Third-party (client-side) cookies set with JavaScript' , " +
        "requests SMALLINT, requestBytes INT , " +
        "responses SMALLINT, responseBytes INT, " +
        "INDEX(pid), INDEX(stage)" +
        ")"
    );

    await db.create(
        "cookies_links(" +
        "pid INT UNSIGNED NOT NULL, stage VARCHAR(10), fid INT UNSIGNED NOT NULL, links LONGTEXT, " +
        "INDEX(pid), INDEX(stage)" +
        ")"
    );

    await db.create(
        "cookies_raw(" +
        "root INT UNSIGNED NOT NULL, stage VARCHAR(10), mainUrl MEDIUMTEXT, json LONGTEXT, " +
        "INDEX(root), INDEX(stage)" +
        ")"
    );
}

async function initialize() {
    //Monitor all network requests for cookie headers
    browser.context().on("response",
        /**
         * Response handler.
         * @param response {import('playwright').Response}
         * @returns {Promise<void>}
         */
        async function (response) {
            //Extract domain (might fail e.g. for blob URLs)
            let origin;
            let parsed = common.parseUrl(response.url());
            if (parsed && parsed.host) {
                origin = parsed;
            }

            //Process if relevant header
            let cookies = await response.headerValue("set-cookie");
            if (cookies) {
                const is_redirect = response.status().toString().startsWith("3");
                await processCookies("HTTP", cookies, origin, response.url(), response.frame(), is_redirect);
            }

            //Collect response size
            let bytes;
            try {
                bytes = (await response.body()).length;
            } catch (Exception) {
                //Throws exception for redirects
                bytes = 0;
            }
            let frame = response.frame();
            if (frameToResponseTraffic.has(frame)) {
                frameToResponseTraffic.get(frame).push(bytes);
            } else {
                frameToResponseTraffic.set(frame, [bytes]);
            }
        }
    );

    browser.context().on("request",
        /**
         * Request handler.
         * @param request {import('playwright').Request}
         * @returns {Promise<void>}
         */
        async function (request) {
            //Collect request size
            let bytes;
            try {
                const sizes = await request.sizes();
                bytes = sizes.requestBodySize + sizes.requestHeadersSize;
            } catch (Exception) {
                bytes = 0;
            }
            let frame = request.frame();
            if (frameToRequestTraffic.has(frame)) {
                frameToRequestTraffic.get(frame).push(bytes);
            } else {
                frameToRequestTraffic.set(frame, [bytes]);
            }
        }
    );

    //JS monkey-patching to observe cookie writes
    await browser.context().addInitScript(cookieWrapper);

    //Callback to know which JS cookies were set
    browser.context().exposeBinding("__nightcrawler_cookie", async function (params, stack, value) {
        let origin = common.parseUrl(params.frame.url());
        let source = common.stackToUrl(stack);
        await processCookies("JS", value, origin, source, params.frame);
    });

    //Callback for best candidates we found
    browser.context().exposeBinding("__nightcrawler_acceptify", function (params, type, name) {
        candidates.push({type: type, name: name});
    });
}

async function before(params) {
    candidates = [];
    frameToCookies = new Map();
    frameToResponseTraffic = new Map();
    frameToRequestTraffic = new Map();

    if (!params.revisit) {
        //Clear cookies if we are not reloading a page
        await browser.context().clearCookies();
        seenCookies = new Set();
    }

    if (params.depth > 0) {
        //Restore cookies from previous visit, if we are now visiting a subpage
        let [rows] = await db.query("SELECT json FROM cookies_raw WHERE root = ? AND stage = ?", [
            params.root, "reload"
        ]);
        let cookies = JSON.parse(rows[0]["json"]);
        await browser.context().addCookies(cookies);
    }
}

async function during(params) {
    //Always wait this long in all cases
    await common.sleep(5000);

    //Always search all frames for a cookie banner, even for reload and subpages
    //This way, we can check if we found the same candidate again that we previously accepted
    await browser.evaluateAllFrames(acceptify);

    if (params.depth > 0) {
        //We are visiting subpages just to search for vulnerabilities like XSS
        //Save stats nevertheless to identify mistakes (e.g. banner still present)
        await saveStats(params, "subpage");
        //Queue further subpages if not already at the limit of max links
        return {queueLinks: true};
    }

    if (params.revisit > 0) {
        //We have already accepted the banner, just save stats and exit
        await saveStats(params, "reload");
        //Serialize cookies after clicking to later restore them on subpages
        await saveCookies(params.root, "reload");
        //Queue further subpages if not already at the limit of max links
        return {queueLinks: true};
    }

    //Save stats and cookies before we click anything
    await saveStats(params, "load");
    await saveCookies(params.root, "load");

    //Make a screenshot (limit to only the most popular pages)
    if (params.pid <= 10000) {
        let screenshot = await browser.page().screenshot();
        fs.writeFileSync(`out/${params.pid}-${params.host}.png`, Buffer.from(screenshot, "base64"));
    }

    //If no cookie banner found or multiple, and we are not sure which one,
    //then stop here, do not load that page again and do not queue subpages
    if (candidates.length !== 1) {
        return;
    }

    //Notify other modules that we will click now
    event.emit("cookieclick");
    await browser.evaluateAllFrames(`if (window.__nightcrawler_cookie_ele) {
        window.__nightcrawler_cookie_ele.click();
        delete window.__nightcrawler_cookie_ele;
    }`);
    //XXX Without knowing if the click will trigger a navigation or the inclusion of a lot of iframes,
    //we need to wait a long time to be somewhat certain all changes have loaded
    await common.sleep(10000);

    //Save stats and cookies again after clicking
    await saveStats(params, "accept");
    await saveCookies(params.root, "accept");

    //Indicate that we want to load this page again
    return {reload: true};
}

async function abort(params) {
    //In case of any error, delete all previously saved data to avoid confusion
    //XXX This way, we also handle errors during reload with a kind of rollback
    console.log("Abort! Delete data for pid", params.pid);
    await db.query("DELETE FROM cookies WHERE pid = ?", [params.pid]);
    await db.query("DELETE FROM cookies_frames WHERE pid = ?", [params.pid]);
    await db.query("DELETE FROM cookies_links WHERE pid = ?", [params.pid]);

    //Only delete these if we are currently visiting the root
    if (params.depth === 0) {
        await db.query("DELETE FROM cookies_raw WHERE root = ?", [params.root]);
    }
}

/**
 * Processes cookie lines from a Set-Cookie Header.
 * @param type
 * @param lines
 * @param origin
 * @param source
 * @param frame
 * @param redirect set true if the cookie was set within a redirect, defaults to false
 * @returns {Promise<void>}
 */
async function processCookies(type, lines, origin, source, frame, redirect = false) {
    for (let line of lines.split("\n")) {
        let parsedCookie = {name: "", value: "", domain: "", path: ""};

        //Parsing cookies with RegEx, what could go wrong!
        let nameMatches = line.match(/^(.*?)=(.*?)(?:;|$)/);
        if (nameMatches && nameMatches[1] && nameMatches[2]) {
            //Name=Value
            parsedCookie.name = nameMatches[1];
            parsedCookie.value = nameMatches[2];

            //Domain
            const domainMatches = line.match(/domain=(.*?)(?:;|$)/i);
            parsedCookie.domain = _normalizeDomain(
                domainMatches && domainMatches[1] ? domainMatches[1] : (origin ? "." + origin.host : "")
            );

            //Path
            const pathMatches = line.match(/path=(.*?)(?:;|$)/i);
            parsedCookie.path = pathMatches && pathMatches[1] ? pathMatches[1] : "/";

            const key = _cookieToKey(parsedCookie.name, parsedCookie.domain, parsedCookie.path);

            let browserCookieKeys = (await browser.context().cookies()).map(
                cookie => _cookieToKey(cookie.name, cookie.domain, cookie.path)
            );

            if (!parsedCookie.value || ["", "\"\"", "''"].includes(parsedCookie.value)) {
                //Empty value means delete
                console.debug(type, "\t DELETE \t", key, "\t\t\t", source, redirect ? "REDIRECT" : "");
            } else if (seenCookies.has(key)) {
                console.debug(type, "\t SET \t\t", key, "\t\t\t", source, redirect ? "REDIRECT" : "");
            } else if (browserCookieKeys.includes(key)) {
                console.debug(type, "\t NEW \t\t", key, "\t\t\t", source, redirect ? "REDIRECT" : "");
                seenCookies.add(key);
                const cookie = {
                    key: key,
                    name: parsedCookie.name,
                    //value: parsedCookie.value, // Debug
                    domain: parsedCookie.domain,
                    path: parsedCookie.path,
                    origin: origin,
                    source: source,
                    type: type,
                    redirect: redirect
                };
                if (frameToCookies.has(frame)) {
                    frameToCookies.get(frame).push(cookie);
                } else {
                    frameToCookies.set(frame, [cookie]);
                }
            } else {
                console.debug(type, "\t INVALID \t", line);
            }
        }
    }
}

/**
 * Creates a short representation of the cookie.
 * @param name
 * @param domain
 * @param path
 * @returns {string}
 * @private
 */
function _cookieToKey(name, domain, path) {
    return (name + "   " + domain + "   " + path).trimEnd();
}

function _normalizeDomain(domain) {
    // https://stackoverflow.com/a/1063760/7018399
    // Cookie with Domain=example.com will be converted to .example.com
    if (domain && typeof domain === 'string' && !domain.startsWith(".")) {
        return "." + domain;
    }
    return domain;
}

function _getObservedCookie(name, domain, path) {
    for (let cookies of frameToCookies.values()) {
        for (let cookie of cookies) {
            if (
                cookie.name === name
                && _normalizeDomain(cookie.domain) === _normalizeDomain(domain)
                && cookie.path === path
            ) {
                return cookie;
            }
        }
    }
    return null;
}

async function saveCookies(rootId, stage) {
    const mainUrl = browser.page().url();
    const annotatedCookies = [];
    const browserCookies = await browser.context().cookies();
    browserCookies.forEach((cookie) => {
        const {name, domain, path} = cookie;
        const storedCookie = _getObservedCookie(name, domain, path);
        let annotation = {
            "_annot_origin": null,
            "_annot_source": null,
            "_annot_redirect": null,
            "_annot_type": null,
        };
        if (storedCookie) {
            annotation._annot_origin = storedCookie.origin.host;
            annotation._annot_source = storedCookie.source;
            annotation._annot_redirect = storedCookie.redirect;
            annotation._annot_type = storedCookie.type;
        }
        annotatedCookies.push(Object.assign({}, cookie, annotation));
    });

    await db.query("INSERT INTO cookies_raw VALUES ?", [[[
        rootId, stage, mainUrl, JSON.stringify(annotatedCookies)
    ]]]);
}

async function saveStats(params, stage) {
    let cookies = await browser.context().cookies(browser.page().url());
    let allCookies = await browser.context().cookies();
    let iframes = browser.page().frames().length - 1;

    const scripts = await browser.page().evaluate(
        () => Array.from(document.querySelectorAll("script")).map(s => s.src)
    );
    let firstParty = 0;
    let thirdParty = 0;
    let url = browser.page().url();
    for (let script of scripts) {
        if (!script || !script.startsWith("http")) {
            //Skip inline scripts
            continue;
        }
        common.sameSite(url, script) ? firstParty++ : thirdParty++;
    }

    let consents;
    let tcf = await browser.page().evaluate(`typeof __tcfapi == 'function'`);
    if (tcf) {
        //Sanity check for pages with the API
        consents = await browser.page().evaluate(
            `(function() {
                let result;
                __tcfapi('getTCData', 2, function(tcdata) {
                    if (!tcdata.purpose || !tcdata.purpose.consents) { result = -1; return; }
                    result = Object.entries(tcdata.purpose.consents).reduce((prev, curr) => curr[1] ? prev + 1 : prev, 0);
                });
                return result;
            })()`
        );
    }

    let acceptType, acceptName, acceptPresent;
    if (stage === "accept" && candidates.length === 1) {
        acceptType = candidates[0].type;
        acceptName = candidates[0].name;
    } else if (stage === "reload" || stage === "subpage") {
        acceptPresent = 0;
        let [rows] = await db.query("SELECT acceptName, acceptType FROM cookies WHERE root = ? AND stage = 'accept'", [params.root]);
        for (let candidate of candidates) {
            if (candidate.type === rows[0]["acceptType"] && candidate.name === rows[0]["acceptName"]) {
                acceptPresent = true;
                console.log("Found previously accepted element again!");
                break;
            }
        }
    }

    console.log(
        "Cookies:", cookies.length, "/", allCookies.length - cookies.length,
        "iFrames:", iframes,
        "Scripts:", firstParty, "/", thirdParty,
        "Candidates:", candidates.length, "TCF:", tcf,
        "Consents:", consents,
    );

    let data = [];
    data.push([
        params.root, params.pid, stage, cookies.length, allCookies.length - cookies.length, iframes,
        firstParty, thirdParty, candidates.length, tcf ? 1 : 0, consents,
        acceptType, acceptName, acceptPresent
    ]);
    await db.query("INSERT INTO cookies VALUES ?", [data]);

    await saveFrames(params.pid, stage);
}

async function saveFrames(pid, stage) {
    let fid = 0;
    let frameData = [];
    let linkData = [];
    let mainUrl = browser.page().url();
    let mainParsed = common.parseUrl(mainUrl);

    let frames = browser.page().frames();
    for (let frame of frames) {
        let main = frame === browser.page().mainFrame();
        let frameBanner, frameOrigin, frameLinks;
        try {
            frameBanner = await frame.evaluate(`window.__nightcrawler_cookie_ele != undefined`);
            frameOrigin = await frame.evaluate(`location.origin`);
            frameLinks = await frame.evaluate(
                `Array.from(document.querySelectorAll("a")).map(a => a.href).filter(a => a.startsWith("http")).join("\\n")`
            );
        } catch (Exception) {
            //If the frame was detached in the meantime, nothing we can do
        }
        linkData.push([pid, stage, fid, frameLinks]);

        let httpFirst = 0;
        let httpFirstRedirect = 0;
        let httpThird = 0;
        let httpThirdRedirect = 0;
        let jsFirst = 0;
        let jsThird = 0;

        let frameCookies = frameToCookies.get(frame);
        if (frameCookies) {
            for (let cookie of frameCookies) {
                if (!cookie.origin) {
                    continue;
                }
                //XXX This compares to the origin of the main frame, not whatever frame we are in
                let samepartyCookie = common.sameSite(cookie.origin, mainParsed);
                if (cookie.type === "HTTP") {  //HTTP Cookies
                    if (samepartyCookie) {
                        cookie.redirect ? httpFirstRedirect++ : httpFirst++;
                    } else {
                        cookie.redirect ? httpThirdRedirect++ : httpThird++;
                    }
                } else if (cookie.type === "JS") {  //JavaScript Cookies
                    samepartyCookie ? jsFirst++ : jsThird++;
                }
            }
        }

        let samepartyFrame;
        if (!frameOrigin) {
            samepartyFrame = null;
        } else if (frameOrigin === "about:blank") {
            samepartyFrame = true;
        } else if (frameOrigin.startsWith("http")) {
            samepartyFrame = common.sameSite(frameOrigin, mainUrl);
            frameOrigin = common.parseUrl(frameOrigin).host;
        } else {
            samepartyFrame = false;
        }

        // Response Traffic
        let responseTraffic = frameToResponseTraffic.get(frame);
        let responses = responseTraffic ? responseTraffic.length : 0;
        let responseBytes = responseTraffic ? responseTraffic.reduce((pv, cv) => pv + cv) : 0;

        // Request Traffic
        let requestTraffic = frameToRequestTraffic.get(frame);
        let requests = requestTraffic ? requestTraffic.length : 0;
        let requestBytes = requestTraffic ? requestTraffic.reduce((pv, cv) => pv + cv) : 0;

        frameData.push([
            pid, stage, fid++, main, frameOrigin, samepartyFrame, frameBanner, httpFirst, httpFirstRedirect, httpThird,
            httpThirdRedirect, jsFirst, jsThird, requests, requestBytes, responses, responseBytes
        ]);
    }
    await db.query("INSERT INTO cookies_frames VALUES ?", [frameData]);
    await db.query("INSERT INTO cookies_links VALUES ?", [linkData]);
}
