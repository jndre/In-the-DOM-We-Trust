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

let final_url = "";

async function seed() {
    await crawler.seed();
    await db.create(
        "final_urls(" +
        "root INT UNSIGNED NOT NULL, pid INT UNSIGNED NOT NULL, final_url TEXT NOT NULL," +
        "INDEX(root), INDEX(pid)" +
        ")"
    );

}

async function before(params) {
    final_url = "";
}

async function during(params) {
    await common.sleep(5000);
    let page = browser.page();
    final_url = page.url();
}

async function after(params) {
    await db.query("INSERT INTO final_urls VALUES (?,?,?)", [params.root, params.pid, final_url]);
}

