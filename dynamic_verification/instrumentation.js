const fs = require('fs');
const pathModule = require('path');

/**
 * Instrumentor
 * @constructor
 */
function Instrumentor() {
    "use strict";
    /* start-test-block */
    this._testonly_ = {
    };
    /* end-test-block */
}


Instrumentor.prototype.getInstrumentedFunctionHooks = async function(logCallsToBrowserConsole){
    
    let functionHooks= '';
    let instrumentation_hooks_file = pathModule.join(__dirname, 'hooks.js');
    if(fs.existsSync(instrumentation_hooks_file)){
        try {
            functionHooks = fs.readFileSync(instrumentation_hooks_file, 'utf8');
            return functionHooks; 
        } catch (err) {
            // pass
            return functionHooks; 
        }          
    }
    return functionHooks;

}

var instrumentorInstance = new Instrumentor();
module.exports = instrumentorInstance;