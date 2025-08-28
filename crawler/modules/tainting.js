const fs = require("fs");
const common = rootRequire("core/common");
const browser = rootRequire("core/browser");
const http = require('http');
const downloadPath = process.env.CRAWLER_DOWNLOAD_PATH || "/tmp";

const event = common.event;
const options = {
    browser: {
        firefoxUserPrefs: {
            "browser.sessionstore.resume_from_crash": false,
            "browser.tabs.crashReporting.sendReport": false,
            "media.autoplay.default": 5,
            "media.autoplay.allow-extension-background-pages": false,
            "media.autoplay.block-event.enabled": true,
            "media.autoplay.enabled.user-gestures-needed": false,
            "dom.always_stop_slow_scripts": true,
            "dom.use_watchdog": true,
            "dom.max_script_run_time": 30,
            "dom.max_chrome_script_run_time": 60,
            "dom.max_ext_content_script_run_time": 15,
            "browser.cache.disk.enable": false,
            "browser.cache.memory.enable": false,
            "privacy.trackingprotection.enabled": false,
            "privacy.trackingprotection.fingerprinting.enabled": false,
            "privacy.trackingprotection.origin_telemetry.enabled": false,
            "privacy.trackingprotection.socialtracking.enabled": false,
            "privacy.trackingprotection.pbmode.enabled": false,
            "privacy.socialtracking.block_cookies.enabled": false,
            "network.cookie.cookieBehavior": 0,
            "security.fileuri.strict_origin_policy": false,
            "browser.download.folderList": 2,
            "pdfjs.disabled": true ,
            "browser.download.manager.showWhenStarting": false,
            "browser.download.dir": downloadPath,
            "browser.helperApps.neverAsk.saveToDisk": "text/csv,application/x-msexcel,application/excel,application/x-excel,application/vnd.ms-excel,image/png,image/jpeg,text/html,text/plain,application/msword,application/xml,application/pdf,application/zip",
            "browser.helperApps.alwaysAsk.force": false,
            "browser.download.manager.alertOnEXEOpen": false,
            "browser.download.manager.focusWhenStarting": false,
            "browser.download.manager.useWindow": false,
            "browser.download.manager.showAlertOnComplete": false,
            "browser.download.manager.closeWhenDone": false
            // .setPreference("browser.privatebrowsing.autostart", true)
        }
    }, context: {
        ignoreHTTPSErrors: true
    }, crawler: {
    },
};

module.exports = {
    options,
    seed,
    initialize,
    before,
    during,
    after,
};

const flowHandler = common.readFile("snippets/flowHandler.js");
let findings = [];
let accepted = false;
let post_reload = false;
let subpage = false;

event.on("cookieclick", function () {
    accepted = true;
});

async function initialize() {
    await browser.context().addInitScript(flowHandler);
    browser.context().exposeBinding("__nightcrawler_taint_report", async function (source, value) {
        // console.log(value);
        // console.log(`${JSON.stringify(source, null, 2)} - ${JSON.stringify(value, null, 2)} `);
        let cookies = await browser.context().cookies();
        findings.push(Object.assign({subpage: subpage, cookie_banner_accepted: accepted, post_reload: post_reload, cookies: cookies}, value));
    });
}

async function seed(params) {

}

async function before(params) {
    findings = [];
    accepted = false;
    post_reload = false;
    subpage = false;
}

async function during(params) {
    if (params.depth > 0) {
        accepted = true;
        subpage = true;
    }
    if (params.revisit > 0) {
        accepted = true;
        post_reload = true;
    }
    // await common.sleep(5000);
}

async function after(params) {
    for (let f of findings) {
        let finding = await enhance_finding(f);
        await send_finding(params, Object.assign({errored: params.error !== undefined }, finding));
    }
    console.log(`Exported ${findings.length} findings for ${params.protocol + params.host}`);
}

async function enhance_finding(finding) {
    let taints = [];
    for(let taint of finding.taint) {
        let ops = [];
        for(let op of taint.flow) {
            ops.push({operation: op.operation, source: op.source, builtin: op.builtin, function: op.location.function});
        }
        taint.hash = common.hash(ops);
        taints.push(taint);
    }
    finding.taint = taints;
    return finding;
}

async function send_finding(params, finding) {
    const url = `${params.protocol}${params.host}${params.path}${params.query}${params.fragment}`;
    const data = JSON.stringify({finding: Object.assign({pid: params.pid, base_url: url}, finding)});
    const options = {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/finding',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        },
    };

    const req = http.request(options, res => {
        // console.log(`statusCode: ${res.statusCode}`);

        // res.on('data', d => {
        // process.stdout.write(d);
        // });
    });

    req.on('error', error => {
        console.error(`Error sending finding to export service: ${error} -- TERMINATING`);
        process.exit(5);
    });

    req.write(data);
    req.end();

}
