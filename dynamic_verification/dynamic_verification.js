const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto')
const argv = require("process.argv");
const js_beautify = require('js-beautify').js;
const { URL } = require('url');
const { JSDOM } = require('jsdom');

var instrumentor = require('./instrumentation.js');

const baseDir = process.argv[2];
if (!baseDir) {
    console.error(
        "Please provide an input directory as command line argument.",
    );
    process.exit(1);
}

var LOG_INSTRUMENTED_APIS = false;
var BROWSER_LOG = false;
var DEBUG = false;


let overall_confirmed_counter = 0;
let df_counter = 0;

// the taint string 
const TEST_PAYLOAD = "testpayload";

const DOM_SELECTOR_API = [
    "document.querySelector",
    "document.querySelectorAll",
    "document.getElementById",
    "document.getElementsByClassName",
    "document.getElementsByTagName",
]

const HEADER_TAGS = [
    "head",
    "meta",
    "title",
    "link",
    "style",
    "noscript",
    "base",
    "template",
    "object",
]

function generate_single_markup(current_API, query_parameter, target_attr){
    const dom = new JSDOM(`
          <!DOCTYPE html>
          <html>
          <head>
          <title>Document</title>
          </head>
          <body>
        <h1>Hello world</h1>
        </body>
        </html>
        `);

    const document = dom.window.document;

    let tagname = 'div';

    if (current_API == "document.getElementsByTagName"){
        tagname = query_parameter;
    }

    var element = document.createElement(tagname);

    if (current_API == "document.getElementById"){
        element.setAttribute("id", query_parameter);
    }

    if (current_API == "document.getElementsByClassName"){
        element.setAttribute("class", query_parameter);
    }

    if (current_API == "document.querySelector" || current_API == "document.querySelectorAll"){
        let id = '';
        let classes = [];
        let attributes = {};
    
        // Regex patterns for different selectors
        const tagPattern = /^[a-zA-Z][a-zA-Z0-9-]*/; // Matches tag name
        const idPattern = /#([a-zA-Z][\w-]*)/; // Matches #id
        const classPattern = /\.([a-zA-Z][\w-]*)/g; // Matches .class (global for multiple classes)
        const attrPattern = /\[([a-zA-Z-]+)(?:=['"]?([^'"]*)['"]?)?\]/g; // Matches [attr="value"]

        // Extract tag
        const tagMatch = query_parameter.match(tagPattern);
        if (tagMatch) {

            tagname = tagMatch[0];
        }
    
        // Extract ID
        const idMatch = query_parameter.match(idPattern);
        if (idMatch) {

            id = idMatch[1];
        }
    
        // Extract classes
        let classMatch;
        while ((classMatch = classPattern.exec(query_parameter)) !== null) {
            classes.push(classMatch[1]);
        }
    
        // Extract attributes
        let attrMatch;
        while ((attrMatch = attrPattern.exec(query_parameter)) !== null) {
            const attrName = attrMatch[1];
            const attrValue = attrMatch[2] || '';
            attributes[attrName] = attrValue;
        }
    
        // Create the HTML element using createElement
        if (tagname === "script") {
            return "";
        }

        element = document.createElement(tagname);

        // Set the ID
        if (id) {
            element.id = id;
        }

        // Set the classes
        if (classes.length > 0) {

            element.classList.add(...classes);
        }

        // Set the attributes
        for (const [attrName, attrValue] of Object.entries(attributes)) {
            element.setAttribute(attrName, attrValue);
        }
    }

    for (let jj = 0; jj < target_attr.length; jj++){
        if (target_attr[jj] !== ""){
            element.setAttribute(target_attr[jj], TEST_PAYLOAD + "_" + query_parameter); //##
        }
    }

    return element.outerHTML;
}

function generate_markup_payload(current_API, query_selector_parameters, DOM_elements_attributes_of_interest){
    const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head>
            <title>Document</title>
            </head>
            <body>
        <h1>Hello world</h1>
        </body>
        </html>
        `);

    const document = dom.window.document;
    const parentDiv_body = document.createElement('div');
    const parentDiv_head = document.createElement('div');

    try {
        for (let i = 0; i < DOM_elements_attributes_of_interest.length; i++){
            element = generate_single_markup(current_API[i], query_selector_parameters[i], DOM_elements_attributes_of_interest[i]);
    
            if (HEADER_TAGS.some(tag => query_selector_parameters[i].includes(tag))){
                if (parentDiv_head.innerHTML.indexOf(element) === -1) {
                    parentDiv_head.innerHTML += element;
                }
            } else {
                if (parentDiv_body.innerHTML.indexOf(element) === -1) {
                    parentDiv_body.innerHTML += element;
                }
            }
        }
    } catch (e) {
        console.log("error while generating markup: ", e);
    }

    return {
        body: parentDiv_body.outerHTML,
        head: parentDiv_head.innerHTML
    };
}

async function readJsonFile(file_path_name){

    if(fs.existsSync(file_path_name)){
        try {   
                const data = fs.readFileSync(file_path_name, 'utf8');
                return JSON.parse(data);
        } catch (err) {
                console.error(err)
                return -1;
        }               
    }
    return -1;

}

async function is_api_data_tainted_for_sink(taintflow_sink, array) {
    let hash_value = "";
    var target_queries = [];

    for (let i = 0; i < taintflow_sink["taint"].length; i++) {
        curr_tf = taintflow_sink["taint"][i];
        hash_value += curr_tf["hash"];
        for (let j = 0; j < curr_tf["flow"].length; j++){           // curr_tf[hash]
            let curr_part = curr_tf["flow"][j];
            if (DOM_SELECTOR_API.includes(curr_part["operation"]) && curr_part["arguments"][0] && curr_part["arguments"][0] !== "script") {
                target_queries.push(curr_part["arguments"][0]);
            }
        }
    }

    for (let e of array) {
        let sinks = Object.keys(e);
        for (let sink of sinks) {
            let maybeTaintedString = e[sink];
            for (let unique_part of target_queries) {
                if (maybeTaintedString.indexOf(TEST_PAYLOAD + "_" + unique_part) !== -1 && taintflow_sink["sink"] === sink) {
                    return hash_value;
                }
            }
        }
    }
    return "false";
}



if(typeof String.prototype.replaceAll === "undefined") {
    String.prototype.replaceAll = function(value, replacement) {
       return this.replace(new RegExp(value, 'g'), replacement);
    }
}

async function extractAttributesFromPage(page, selectorAPI, selectorArg){
    // Use Puppeteer to evaluate the DOM and find the element
    try {
        if (!page) {
            throw new Error("Page object is undefined");
        }

        const attributes = await page.evaluate((selectorAPI, selectorArg) => {
            // Define the element based on the selectorAPI and selectorArg
            let element;
            switch (selectorAPI) {
                case 'document.getElementById':
                    element = document.getElementById(selectorArg);
                    break;
                case 'document.querySelector':
                    element = document.querySelector(selectorArg);
                    break;
                case 'document.querySelectorAll':
                    element = document.querySelectorAll(selectorArg)[0];
                    break;
                case 'document.getElementsByClassName':
                    element = document.getElementsByClassName(selectorArg)[0];
                    break;
                case 'document.getElementsByTagName':
                    element = document.getElementsByTagName(selectorArg)[0];
                    break;
            }
    
            // If no element is found, return null
            if (!element) return [];
    
            // Get all attributes of the element
            const attrs = element.attributes;
            const result = [];
            for (let i = 0; i < attrs.length; i++) {
                result.push(attrs[i].name);
            }
            return result;
        }, selectorAPI, selectorArg);
    
    
        return attributes;
    } catch (err) {
        console.error("Error while extracting attr from a page", err);
    }

}

async function load_page_for_attr_extraction(url) { 
    let browser, page;
    try {
        console.log("Attr_Extraction_URL: %s \n", url);
        browser = await launch_chrome(true);

        // Check if the browser was created successfully 
        if (!browser) {
            console.error("Browser launch failed.");
            return null;
        }

        const context = await browser.defaultBrowserContext();
        let pages = await browser.pages();
        page = pages.length > 0 ? pages[0] : await context.newPage();

        // Check if the page was created successfully
        if (!page) {
            console.error("Failed to create a new page.");
            await browser.close();
            return null;
        }

        await page.setBypassCSP(true);
        await page.setViewport({ width: 1366, height: 768 });
        await page.setRequestInterception(true);

        // Attach an event listener for request interception
        page.on('request', (request) => {
            request.continue();
        });

        // Page load with error handling and timeout
        // await page.goto(url, { waitUntil: ["load", "networkidle0"], timeout: 30000 });
        await page.goto(url, { waitUntil: "load", timeout: 30000 });
        return { browser, page };

    } catch (err) {
        console.error("Error during page loading:", err);
        if (browser) await browser.close();
        return null;
    }
}

/**
 * ------------------------------------------------
 *      Main Thread: Dynamic Flows
 * ------------------------------------------------
**/

async function verify_dynamic_taintflows(entryPath, targetFiles, webpage){

    console.log(targetFiles)

    var confirmed_taintflows = [];
    var hash_value_history = [];

    var injectedContent_head = "";  // NEW
    var injectedContent_body = "";  // NEW
    var sink = [];
    var sources = [];
    var all_taintflows = [];
    var taintparts = [];
    // var should_markup_be_injected_before_body_tag = false;
    // var should_markup_be_injected_after_body_tag = false;  // NEW

    var pageURL = "";

    for (const file of targetFiles) {
        const filePath = path.join(entryPath, file);

        // Check if the file is a .json file
        if (file.endsWith('.json')) {
            try {
                var taintflow = await readJsonFile(filePath);
                if(taintflow === -1){
                    DEBUG && console.log(`[warning] no taintflows file found at: ${entryPath}`);
                    continue;
                }

                let df_selector_source_exists = false;

                // Iterate through keys in DOM_SELECTOR_API
                for (const srcs of DOM_SELECTOR_API) {
                    for (const source of taintflow["sources"]) {
                        if (source.includes(srcs)) {
                            df_selector_source_exists = true;
                            break; // Exit early if a match is found
                        }
                    }
                }

                if (!df_selector_source_exists) {
                    continue;
                }


                sink.push(taintflow["sink"]);
                sources.push(taintflow["sources"]);
                all_taintflows.push(taintflow);
                taintparts.push(...taintflow["taint"]);
                pageURL = new URL(taintflow["base_url"]).toString();


            } catch (err) {
                console.error(`An error occured while verifying the following path: ${filePath}`, err);
            }
        }
    }
    
    try {

        var query_selector_parameters = [];
        var DOM_elements_attributes_of_interest = [];
        var current_API = [];
        var cache_qs_parameters = [];

        var attr_extractor = await load_page_for_attr_extraction(pageURL);
        
        df_counter += 1;

        for (let i = 0; i < taintparts.length; i++) {
            curr_tf = taintparts[i];
            for (let j = 0; j < curr_tf["flow"].length; j++){           // curr_tf[hash]
                let curr_part = curr_tf["flow"][j];
                if (DOM_SELECTOR_API.includes(curr_part["operation"]) && curr_part["arguments"][0] && curr_part["arguments"][0] !== "script") {
                    query_selector_parameters.push(curr_part["arguments"][0]);
                    current_API.push(curr_part["operation"]);

                    var attributes_of_interest = [];

                    // if (HEADER_TAGS.some(tag => curr_part["arguments"][0].includes(tag))){
                    //     should_markup_be_injected_before_body_tag = true;
                    // }
                    
                    if (j > 0) {
                        let prev_part = curr_tf["flow"][j - 1];
                        let prev_arg = prev_part["arguments"][1];

                        if (prev_arg.includes('=')) {
                            attributes_of_interest.push(prev_arg.split('=')[0].trim());
                        } else {
                            attributes_of_interest.push("");
                        }
                    } else {
                        attributes_of_interest.push("");
                    }

                    if (!cache_qs_parameters.includes(curr_part["arguments"][0]) && attr_extractor !== null){
                        let extracted_attributes = await extractAttributesFromPage(attr_extractor.page, curr_part["operation"], curr_part["arguments"][0])

                        if (extracted_attributes.length > 0) {
                            attributes_of_interest.push(...extracted_attributes);
                        }

                        cache_qs_parameters.push(curr_part["arguments"][0]);
                    }

                    DOM_elements_attributes_of_interest.push(attributes_of_interest);
                }
            }
        }
        const { body: new_generated_payload_body, head: new_generated_payload_header } = generate_markup_payload(current_API, query_selector_parameters, DOM_elements_attributes_of_interest);
        if (injectedContent_body.indexOf(new_generated_payload_body) === -1) {
            injectedContent_body += new_generated_payload_body;
        }

        if (injectedContent_head.indexOf(new_generated_payload_header) === -1) {
            injectedContent_head += new_generated_payload_header;
        }
            
        confirmed_taintflows.push({"Injected_markup_header": injectedContent_head, "Injected_markup_body": injectedContent_body});

        if (attr_extractor !== null){
            await attr_extractor.page.close();
            await attr_extractor.browser.close();
        }

        var browser = await launch_chrome(true);

        const context = await browser.defaultBrowserContext();
        var pages = await browser.pages();
        if(pages.length > 0){
            var page = pages[0];
        }else{
            var page = await context.newPage();
        }
    
        /**
        * Disable Content-Security Policy (CSP) to avoid breaking when adding cross-domain scripts 
        * https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagesetbypasscspenabled
        */
        await page.setBypassCSP(true); 
        await page.setViewport({ width: 1366, height: 768});
        
        // redirect puppeteer console log in the browser to node js log
        if(BROWSER_LOG || LOG_INSTRUMENTED_APIS){
            if(BROWSER_LOG){
                page.on('console', consoleObj => console.log('[BrowserConsole] ' + consoleObj.text()));
            }
            else if(!BROWSER_LOG && LOG_INSTRUMENTED_APIS){
    
                page.on('console', consoleObj => {
                    let txt = consoleObj.text();
                    if(txt.startsWith("[[ Hooks ]]")){
                        console.log(consoleObj.text());
                    }
                });
            }
        }       
    
        await new Promise(resolve => setTimeout(resolve, 500));
    
        // disallows page navigation for hooks on location object that triggers a prompt 
        await page.on('dialog', async dialog => {
            DEBUG && console.log('dialog accepted');
            await dialog.accept();
            // await dialog.dismiss(); // throws Error: net::ERR_ABORTED
        })
    
        // puppeteer: set the request interception to true and collect the HTTP requests
        await page.setRequestInterception(true);
    
        // requests
        var capturedHttpRequests = {}
        page.on('request', async (request) => {
            let requestUrl = request.url();
            request.continue();
        });
            
        let functionHooksString = await instrumentor.getInstrumentedFunctionHooks(LOG_INSTRUMENTED_APIS);
        // executed upon every page load
        // hook results are available on `window.requestApiCalls` array
        await page.evaluateOnNewDocument(functionHooksString); 
    
        try{
            // Listen for responses to modify the HTML
            page.on('response', async (response) => {
                if (response.request().resourceType() === 'document' && response.request().method() !== 'OPTIONS') {
                    try {
                        // Check if the response is a redirect
                        const status = response.status();
                        if (status >= 300 && status < 400) {
                            console.log('Redirect response detected. Skipping modification.');
                            return;
                        }

                        const headers = response.headers();
                        // Only manipulate HTML responses
                        if (headers['content-type'] && headers['content-type'].includes('text/html')) {
                            let html = await response.text();
        ///////////////////////////////////////////////////////////////////
                            if (injectedContent_head.length !== 0){
                                const htmlTagPattern = /(<html[^>]*>)/i;

                                if (await htmlTagPattern.test(html)) {
                                    html = html.replace(htmlTagPattern, `$1${injectedContent_head}`);
                                    // await page.setContent(html);
                                }
                            } 
                            
                            if (injectedContent_body.length !== 0) {
                                // Find the <body> tag and insert markup immediately after it
                                const bodyTagPattern = /(<body[^>]*>)/i;
                                if (await bodyTagPattern.test(html)) {
                                        // Insert markup right after the <body> tag
                                        html = html.replace(bodyTagPattern, `$1${injectedContent_body}`);
                                        // Set the modified HTML as the page content
                                        // await page.setContent(html);
                                }
                            }

                            await page.setContent(html);
        ///////////////////////////////////////////////////////////////////            
                        }
                    } catch (err) {
                            console.log('Error while Modifying HTML response for injection:', err);
                    }
                }
            });

            //// Navigate to target webpage
            DEBUG && await console.log('[[ win.loc ]] started testing URL: ' + pageURL);
            await page.goto(pageURL, { waitUntil: ["load", "networkidle0"], timeout: 30000 });

            DEBUG && await console.log('[[ win.loc ]] page loaded successfully');
            DEBUG && await console.log('[[ win.loc ]] waiting 15 seconds');
            await new Promise(resolve => setTimeout(resolve, 15000));

            // instrumented api calls 
            let instrumentedRequestApiCalls = await page.evaluate( () => {
                return window.requestApiCalls || [];
            });

            for (let tt = 0; tt < all_taintflows.length; tt++){
                let hash_value = await is_api_data_tainted_for_sink(all_taintflows[tt], instrumentedRequestApiCalls);
                if (hash_value !== "false" && !hash_value_history.includes(hash_value)) {
                    confirmed_taintflows.push(all_taintflows[tt]);
                    hash_value_history.push(hash_value);
                    overall_confirmed_counter += 1;
                }
                
                DEBUG && await console.log(`[[ win.loc ]] taint result: ${hash_value}`);
                DEBUG && await console.log('[[ win.loc ]] finished testing URL: ' + pageURL);
            }
            await new Promise(resolve => setTimeout(resolve, 500));


        } catch (error){
            await console.log(`[[ win.loc ]] ${error}`);
        }

        console.log("Current length of the confirmed_taintflows: ", overall_confirmed_counter);
        console.log("Overall number of processed dataflows: ", df_counter);

        ///// clean up open pages
        try{ 
            await page.close(); 
            await browser.close();
        }catch{ }
    
        if (confirmed_taintflows.length > 1)
        {   
            try {
                // Define the directory path dynamically using the website name
                const dirPath = `results/${webpage}`;
                if (!fs.existsSync(dirPath)) {
                    await fs.promises.mkdir(dirPath, { recursive: true });
                    const filePath = path.join(dirPath, 'confirmed_taintflows.json');
                    const jsonData = JSON.stringify(confirmed_taintflows, null, 2); // Convert to JSON (pretty format)

    
                    fs.writeFile(filePath, jsonData, 'utf8', (err) => {
                        if (err) {
                            console.error('Error saving JSON file:', err);
                        } else {
                            console.log(`confirmed_taintflows saved to: ${filePath}`);
                        }
                    });

                }

            } catch (error) {
                console.error('Error saving file:', error);
            }
        }

        return 1;

    } catch (err) {
        console.error(`**File not found or inaccessible at: ${entryPath}`, err);
    }
}

async function launch_chrome(headless_mode){
    try {
        var defaultArgs = puppeteer.defaultArgs();
        if(headless_mode){
            defaultArgs = puppeteer.defaultArgs().filter(arg => arg !== '--disable-dev-shm-usage');
        }else{
            defaultArgs = puppeteer.defaultArgs().filter(arg => arg !== '--disable-dev-shm-usage' && arg !== '--headless');
        }
        
        defaultArgs.push(
                "--disable-setuid-sandbox",
                "--no-sandbox",
                "--disable-gpu",
                "--shm-size=8gb",
                "--disk-cache-size=0",
                "--media-cache-size=0"
        )
        var browser = await puppeteer.launch({
            ignoreDefaultArgs: true,
            args: defaultArgs,
            ignoreHTTPSErrors: true,
            headless: headless_mode,
            dumpio: false,
        });
        return browser;

    } catch (error) {
        console.error('Error launching browser:', error);
        throw error;
    }
}

/*
* entry point of crawler
*/
(async function(){
    try{

        var page_counter = 0;

        const start = parseInt(process.argv[3], 10);
        const end = parseInt(process.argv[4], 10);

        if (isNaN(start) || isNaN(end)) {
            console.error("Please provide valid 'start' and 'end' arguments.");
            return;
        }

        fs.readdir(baseDir, { withFileTypes: true }, async (err, entries) => {
            if (err) {
              console.error(`Error reading base directory ${baseDir}:`, err);
              return;
            }
        
            // Filter only directories and sort them
            const directories = entries
              .filter((entry) => entry.isDirectory())
              .sort((a, b) => a.name.localeCompare(b.name));
        
            // Select directories within the range [start, end]
            const rangeDirs = directories.slice(start, Math.min(end, directories.length));
        
            rangeDirs.forEach((entry, index) => {
              const entryPath = path.join(baseDir, entry.name);


              fs.readdir(entryPath, async (err, files) => {
                if (err) {
                  console.error(`Error reading directory ${entryPath}:`, err);
                }

                await verify_dynamic_taintflows(entryPath, files, entry.name);

                page_counter += 1;
                console.log("Overall number of processed pages: ", page_counter);
              });
              
            });
        });

    }catch(err){
        DEBUG && console.log(err);
    }

})();
