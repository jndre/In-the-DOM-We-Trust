const events = require("events");
const moment = require("moment");
const crypto = require("crypto");
const fs = require("fs");
const u = require("fast-url-parser");
const {getDomain} = require("tldjs");


//Easier access and can be disabled for tests
global.log = console.log;

//See https://gist.github.com/branneman/8048520
global.rootRequire = function (name) {
    return require(__dirname + "/../" + name);
};

//Cache for parsed stuff to reduce CPU load
const urlCache = new Map();
const pslCache = new Map();

//For messages across modules
exports.event = new events.EventEmitter();

exports.shutdown = false;

exports.status = {
    failed: -2,
    started: -1,
    new: 0,
    done: 1,
    oos: 2, //out of scope
};

exports.hash = function hash(obj) {
    //Convert the object to a string
    let str = typeof obj == "string" ? obj : JSON.stringify(obj);
    //Generates a 64-bit hash represented by 11 characters (88 bit)
    //This string representation is not the most efficient, but better to work with than large integers or binary buffers
    let result = crypto.createHash("md5").update(str).digest().toString("base64", 0, 8).substring(0, 11);
    //Sanitize for filenames (as recommended in RFC 3548)
    result = result.replace(/\//g, "_");
    result = result.replace(/\+/g, "-");
    return result;
};

exports.timestamp = function (m = moment()) {
    return m.format("YYYY-MM-DD HH:mm:ss");
};

exports.readFile = function (file) {
    return fs.readFileSync(__dirname + "/../" + file, "utf-8");
};

exports.readFileByLine = function (file) {
    let lines = exports.readFile(file).toString().split(/\r?\n/);
    lines.pop(); //Remove last empty entry caused by split
    return lines;
};

exports.sleep = function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

exports.timeout = function (promise, ms) {
    return Promise.race([promise, exports.sleep(ms).then(() => {
        throw new Error("Timeout after " + ms + " ms");
    })]);
};

exports.shuffle = function (array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

/*
 * URL stuff
 */

exports.stackToUrl = function stackToUrl(stack) {
    let re = /(https?:\/\/.+?):(\d+):(\d+)/;
    for (let line of stack.split("\n")) {
        let match = line.match(re);
        if (match && !line.includes("<anonymous>:")) {
            return match[1];
        }
    }
};

exports.parseUrl = function parseUrl(url) {
    if (url == null || url === "") {
        return;
    }
    if (urlCache.has(url)) {
        return urlCache.get(url);
    }

    //Does currently not support other protocols
    if (!url.startsWith("http")) {
        return;
    }

    let urlObj;
    let parsed = u.parse(url);
    urlObj = {
        protocol: parsed.protocol + "//",
        host: parsed.hostname,
        port: parsed.port == null ? "" : ":" + parsed.port,
        path: parsed.pathname == null ? "" : parsed.pathname,
        query: parsed.query == null ? "" : parsed.search,
        fragment: "" //Ignored
    };

    if (urlObj.port === ":80" || urlObj.port === ":443") {
        urlObj.port = "";
    }

    urlObj.origin = urlObj.protocol + urlObj.host + urlObj.port;
    urlObj.href = urlObj.protocol + urlObj.host + urlObj.port + urlObj.path + urlObj.query + urlObj.fragment;
    urlObj.hash = exports.hash(urlObj.href);
    urlCache.set(url, urlObj);
    return urlObj;
};

exports.sameSite = function sameSite(url1, url2) {
    //Allow passing either full urls or already parsed objects
    if (typeof url1 == "string") {
        url1 = exports.parseUrl(url1);
    }
    if (typeof url2 == "string") {
        url2 = exports.parseUrl(url2);
    }

    let host = url1.host;
    let other = url2.host;

    //Always remove www. so that api.example.com is obvious subdomain of www.example.com and does not require psl check
    if (host.startsWith("www.")) {
        host = host.slice(4);
    }
    if (other.startsWith("www.")) {
        other = other.slice(4);
    }

    //Common cases: same domain, subdomain or parent domain
    if (host === other || host.endsWith("." + other) || other.endsWith("." + host)) {
        return true;
    }

    //If none of the quick checks worked, do a full parse
    let newPsl = exports.pslHost(host);
    let basePsl = exports.pslHost(other);
    return newPsl === basePsl;
};

exports.pslHost = function (host) {
    //Trivial if only one dot
    if (host.split(".").length <= 2) {
        return host;
    }
    if (pslCache.has(host)) {
        return pslCache.get(host);
    }
    //Only parse if not in cache
    let parsed = getDomain(host);
    pslCache.set(host, parsed);
    return parsed;
};

