const common = rootRequire("core/common");
const browser = rootRequire("core/browser");
const crawler = rootRequire("core/crawler");
const importer = rootRequire("core/importer");

const event = common.event;
const options = {
    browser: {},
    context: {},
    crawler: {maxDepth: 1, maxLinks: 10, randomizeLinks: true, maxRetries: 2},
};

module.exports = {
    options,
    initialize,
    seed,
    before,
    during,
    after,
};

async function seed() {
    await crawler.seed();
    await importer.csv({file: "top-1m.csv", limit: 100});
}

//Register function that can be triggered from another module
event.on("cookieclick", function() {
    console.log("default.cookieclick");
});

//Called every time the browser context is restarted
async function initialize() {
    console.log("default.initialize");
}

//Before visiting a new page from the crawling queue
async function before(params) {
    console.log("default.before");
}

//During the visit, after the page has loaded
async function during(params) {
    await common.sleep(1000);
    console.log("default.during");
}

//After the page was closed, useful for postprocessing and DB operations
async function after(params) {
    console.log("default.after");
}
