const common = rootRequire("core/common");
const crawler = rootRequire("core/crawler");

module.exports = {
    csv,
};

async function csv(params) {
    let file = "lists/" + params.file;
    let lines = common.readFileByLine(file);

    //Check if list contains rank/root at the beginning or just an URL
    let numbered = /^\d+,/.test(lines[0]);

    //Check if URLs include protocol or not
    let prefix = "https://";
    if (/https?:\/\//.test(lines[0])) {
        prefix = "";
    }

    //Enable partial import
    if (params.limit && params.limit < lines.length) {
        lines = lines.slice(0, params.limit);
    }

    let urls = [];
    for (let line of lines) {
        let root, url;
        if (numbered) {
            //Only split at first comma, as URL itself might also contain those
            let pos = line.indexOf(",");
            root = line.substring(0, pos);
            let domain = line.substring(pos + 1);
            if (domain == "localhost") {
                url = "http://" + domain;
            } else {
                url = prefix + domain;
            }
        } else {
            //Rootid will be set by importUrls instead
            if (line == "localhost") {
                url = "http://" + line;
            } else {
                url = prefix + line;
            }
        }
        // url = url.replace("http://", "https://");
        urls.push({ url: url, root: root, depth: params.depth });
    }
    await crawler.addUrls(urls);
}
