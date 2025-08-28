const common = rootRequire("core/common");
const config = rootRequire("config");
const browser_impl = rootRequire("browsers/" + config.browser);

const sharedConfig = {headless: !config.gui};

module.exports = {
    initialize,
    start,
    closePage,
    goto,
    context,
    page,
    evaluateAllFrames,
};

let _browser;
let _context;
let _page;
let browserOptions;
let contextOptions;

function context() {
    return _context;
}

function page() {
    return _page;
}

async function initialize(params) {
    browserOptions = Object.assign(sharedConfig, params.browserOptions);
    contextOptions = params.contextOptions;
    contextOptions.userAgent = config.useragent;
    log("Browser options:", browserOptions);
    log("Context options:", contextOptions);
}

async function start() {
    if (_browser) {
        console.log("Restarting the browser...");
        await _browser.close();
    }
    _browser = await browser_impl.initialize(browserOptions);
    _context = await _browser.newContext(contextOptions);
    _context.exposeBinding("__nightcrawler_log", (params, msg) => console.log(msg));
    log(`Browser: ${config.browser} - ${_browser.version()}`);
}

async function closePage() {
    if (_page) {
        await _page.close();
        _page = undefined;
    }
}

async function goto(url, before) {
    await closePage();
    _page = await _context.newPage();

    //Needs to be executed before the navigation, but after the new tab already exists
    if (before) {
        await before();
    }

    let response = await _page.goto(url, {referer: config.referrer, timeout: config.loadTimeout, waitUntil: config.waitUntil});

    //Check if status code is in 200-299 range
    if (!response.ok()) {
        throw new Error("HTTP error " + response.status());
    }

    //Return host where we ended up (e.g. in case of redirects);
    return common.parseUrl(response.url());
}

async function evaluateAllFrames(func) {
    let promises = [];
    for (let frame of _page.frames()) {
        promises.push((async () => {
            return frame.evaluate(func).catch(ex => {
                let msg = ex.toString();
                //These happen quite frequently, only throw if other error
                if (!msg.includes("Frame was detached") && !msg.includes("Execution context was destroyed") && !msg.includes("Target closed")) {
                    throw ex;
                }
            });
        })());
    }
    return Promise.all(promises);
}
