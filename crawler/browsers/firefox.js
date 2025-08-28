const {firefox} = require('playwright');

async function initialize(sharedConfig) {
    const ff_config = {};
    return await firefox.launch(Object.assign(ff_config, sharedConfig));
}

module.exports = {
    initialize,
};
