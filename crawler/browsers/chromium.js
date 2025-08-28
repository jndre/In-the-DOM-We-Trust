const {chromium} = require('playwright');

async function initialize(sharedConfig) {
    const chrome_config = {};
    return await chromium.launch(Object.assign(chrome_config, sharedConfig));
}

module.exports = {
    initialize,
};
