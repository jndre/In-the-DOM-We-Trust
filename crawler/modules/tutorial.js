const common = rootRequire("core/common");
const browser = rootRequire("core/browser");
const crawler = rootRequire("core/crawler");
const importer = rootRequire("core/importer");
const db = rootRequire("core/db");

const event = common.event;
const options = {
    browser: {},
    context: {},
    crawler: {maxDepth: 1, maxLinks: 10, randomizeLinks: true, maxRetries: 2},
};

module.exports = {
    options,
    // initialize,
    seed,
    before,
    during,
    after,
};

let html = "";
let final_url = "";
let meta_tags = [];

async function seed() {
    await crawler.seed();
    await importer.csv({file: "eu.csv", limit: 100});
    await db.create(
        "htmldump(" +
        "root INT UNSIGNED NOT NULL, pid INT UNSIGNED NOT NULL, final_url TEXT NOT NULL, html LONGTEXT NOT NULL," +
        "INDEX(root), INDEX(pid)" +
        ")"
    );

    await db.create(
        "metatags(" +
        "root INT UNSIGNED NOT NULL, pid INT UNSIGNED NOT NULL, name TEXT NOT NULL, value LONGTEXT NOT NULL," +
        "INDEX(root), INDEX(pid), INDEX(name)" +
        ")"
    );

}

async function before(params) {
    html = "";
    final_url = "";
    meta_tags = [];
}

async function during(params) {
    await common.sleep(5000);
    let page = browser.page();
    html = await page.content();
    final_url = page.url();

    meta_tags = await page.evaluate(() => {
        let meta = [];
        for(const t of document.getElementsByTagName("meta")) {
            let prop = t.getAttribute("property");
            let name = t.getAttribute("name");
            if(prop !== null && (prop.startsWith("og:") || prop.startsWith("twitter:")))    {
                meta.push({k: prop, v: t.content});
            }
            if(name !== null && (name.startsWith("og:") || name.startsWith("twitter:")))    {
                meta.push({k: name, v: t.content});
            }
        }
        return meta;
    });
}

async function after(params) {
    await db.query("INSERT INTO htmldump VALUES (?,?,?,?)", [params.root, params.pid, final_url, html]);
    if(meta_tags.length == 0) { return; }
    let data = [];
    for (const mt of meta_tags) {
        data.push([params.root, params.pid, mt.k, mt.v]);
    }
    await db.query("INSERT INTO metatags VALUES ?", [data]);

}

