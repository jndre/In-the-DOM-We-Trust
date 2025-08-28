const common = require("./core/common");
const config = rootRequire("config");
const crawler = rootRequire("core/crawler");
const db = rootRequire("core/db");

async function main() {
    if (process.getuid && process.getuid() === 0) {
        console.error("The crawler refuses to run as root");
        process.exit();
    }

    log("ID: " + config.crawlerId + "/" + config.crawlerTotal);
    log("DB: " + config.db.host + ":" + config.db.port);
    log("Modules: " + config.modules);
    log("Task: " + config.task);
    log("====================");

    //Use first module as DB name
    await db.initialize("_" + config.modules[0]);

    //Load all modules and merge flags
    let modules = [];
    let browserOptions = {};
    let contextOptions = {};
    //"Sane" default options, which can be overriden by the modules
    let crawlerOptions = {maxDepth: 0, maxLinks: 0, maxRetries: 0, sameSite: true, depthFirst: false, manualQueue: false};
    for (let name of config.modules) {
        let mod = require("./modules/" + name);
        modules.push(mod);
        Object.assign(browserOptions, mod.options.browser);
        Object.assign(contextOptions, mod.options.context);
        Object.assign(crawlerOptions, mod.options.crawler);
    }

    if (config.task === "crawl") {
        await crawler.crawl({browserOptions: browserOptions, contextOptions: contextOptions,
            crawlerOptions: crawlerOptions, modules: modules});
    }
    else {
        for (let name of modules) {
            await name[config.task]();
        }
    }

    log("All done.");
    process.exit();
}

main().then(() => log("Finished."));

process.on("unhandledRejection", async function (error) {
    console.error("!!! Unhandled Rejection !!!");
    console.error(error);
    process.exit(1);
});
