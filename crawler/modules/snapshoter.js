/*

	Description:
	------------
	Module to collect snapshots of visited webpages 


	Usage:
	------------
	--module=snapshoter
	$ node main.js --module=snapshoter --task=seed --storage=$(pwd)
	$ node main.js --module=snapshoter --task=crawl --storage=$(pwd)

	options:
	- COLLECT_WEBPAGE 
	- COLLECT_REQUESTS 
	- COLLECT_RESPONSE_HEADERS  
	- COLLECT_WEB_STORAGE 
	- COLLECT_COOKIES 
	- COLLECT_DOM_SNAPSHOT 
	- COLLECT_SCRIPTS 
	- COLLECT_TAINT_FLOWS
	- EXPORT_TAINT_FLOWS
	- SITE_LIST
	- MAX_SITES 
	- MAX_PAGES
		
*/


const fs = require("fs");
const http = require('http');
const pathModule = require('path');
const crypto = require('crypto');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const common = rootRequire("core/common");
const crawler = rootRequire("core/crawler");
const browser = rootRequire("core/browser");
const db = rootRequire("core/db");
const importer = rootRequire("core/importer");
const config = rootRequire('config');
const js_beautify = require('js-beautify-sourcemap'); // js_beautify + sourcemap


/* flags for data that the crawler should store */
const COLLECT_WEBPAGE = true;
const COLLECT_REQUESTS = false;
const COLLECT_RESPONSE_HEADERS = false; 
const COLLECT_WEB_STORAGE = true;
const COLLECT_COOKIES = false;
const COLLECT_DOM_SNAPSHOT = true;
const COLLECT_SCRIPTS = true;

/* enable tainting here or use the tainting module */
const COLLECT_TAINT_FLOWS = false;
const EXPORT_TAINT_FLOWS = true;

const EXPORT_RESPONSE_HEADERS = true;
const EXPORT_COOKIES = true;
const EXPORT_SCRIPT_METADATA = true;
const EXPORT_TITLE_AND_META = true;

/* crawler config */
const MAX_PAGES = 100;
const MAX_SITES = 12000;
// const MAX_PAGES = 5; 
// const MAX_SITES = 10;

// const SITE_LIST = "tranco_W88P9.csv";
const SITE_LIST = config.sitelist;

/* debugging messages */
const DEBUG = false; 

/* ramfs storage for file downloads */
const baseStorage = config.storage;
const dataStorageDirectory = pathModule.join(baseStorage, 'data');
if(!fs.existsSync(dataStorageDirectory)){
	fs.mkdirSync(dataStorageDirectory);
}

/* flow handler script for foxhound */
const flowHandlerScript = common.readFile("snippets/flowHandler.js");

/* mili-seconds to wait after page load */
const PAGE_LOAD_WAIT_TIMEOUT = 1000; 

const TYPE_SCRIPT_EXTERNAL = 'external';
const TYPE_SCRIPT_INTERNAL = 'inline';

/* valid script types for javascript */
const SCRIPT_MIME_TYPES_FOR_JS = [      
	"text/javascript",
	"application/javascript",
	"application/ecmascript",
	"application/x-ecmascript",
	"application/x-javascript",
	"text/ecmascript",
	"text/javascript1.0",
	"text/javascript1.1",
	"text/javascript1.2",
	"text/javascript1.3",
	"text/javascript1.4",
	"text/javascript1.5",
	"text/jscript",
	"text/livescript",
	"text/x-ecmascript",
	"text/x-javascript"]


// -------------------------------------------------------- //
// JSDOM
// -------------------------------------------------------- // 
// 
const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", () => {
  // No-op to skip console errors.
});

// -------------------------------------------------------- //
// Crawler options
// -------------------------------------------------------- // 

const downloadPath = process.env.CRAWLER_DOWNLOAD_PATH || "/tmp";

// firefoxUserPrefs for Foxhound
const ffopts = {
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
	"browser.download.manager.closeWhenDone": false,
	// Tainting
	"tainting.active": true,
	// Sources
	"tainting.source.location.hash": true,
	"tainting.source.location.host": true,
	"tainting.source.location.hostname": true,
	"tainting.source.location.href": true,
	"tainting.source.location.origin": true,
	"tainting.source.location.pathname": true,
	"tainting.source.location.port": true,
	"tainting.source.location.protocol": true,
	"tainting.source.location.search": true,
	"tainting.source.window.name": true,
	"tainting.source.document.referrer": true,
	"tainting.source.document.baseURI": true,
	"tainting.source.document.documentURI": true,
	// Storage
	"tainting.source.document.cookie": true,
	"tainting.source.localStorage.getItem": true,
	"tainting.source.sessionStorage.getItem": true,
	// Message Based Sources
	"tainting.source.MessageEvent": true,
	"tainting.source.PushMessageData": true,
	"tainting.source.PushSubscription.endpoint": true,
	"tainting.source.WebSocket.MessageEvent.data": true,
	"tainting.source.XMLHttpRequest.response": true,
	// Specific Element Inputs
	"tainting.source.input.value": true,
	"tainting.source.textarea.value": true,
	"tainting.source.script.innerHTML": true,
	// DOM elements and attributes
	"tainting.source.document.getElementById": true,
	"tainting.source.document.getElementsByTagName": true,
	"tainting.source.document.getElementsByTagNameNS": true,
	"tainting.source.document.getElementsByClassName": true,
	"tainting.source.document.querySelector": true,
	"tainting.source.document.querySelectorAll": true,
	"tainting.source.document.elementFromPoint": true,
	"tainting.source.document.elementsFromPoint": true,
	"tainting.source.element.attribute": true,
	"tainting.source.element.closest": true,
	// Sinks
	"tainting.sink.element.after": true,
	"tainting.sink.element.before": true,
	"tainting.sink.EventSource": true,
	"tainting.sink.Function.ctor": true,
	"tainting.sink.Range.createContextualFragment(fragment)": true,
	"tainting.sink.WebSocket": true,
	"tainting.sink.WebSocket.send": true,
	"tainting.sink.XMLHttpRequest.open(password)": true,
	"tainting.sink.XMLHttpRequest.open(url)": true,
	"tainting.sink.XMLHttpRequest.open(username)": true,
	"tainting.sink.XMLHttpRequest.send": true,
	"tainting.sink.XMLHttpRequest.setRequestHeader(name)": true,
	"tainting.sink.XMLHttpRequest.setRequestHeader(value)": true,
	"tainting.sink.a.href": true,
	"tainting.sink.area.href": true,
	"tainting.sink.document.cookie": true,
	"tainting.sink.document.writeln": true,
	"tainting.sink.document.write": true,
	"tainting.sink.element.style": true,
	"tainting.sink.embed.src": true,
	"tainting.sink.eval": true,
	"tainting.sink.eventHandler": true,
	"tainting.sink.fetch.body": true,
	"tainting.sink.fetch.url": true,
	"tainting.sink.form.action": true,
	"tainting.sink.iframe.src": true,
	"tainting.sink.iframe.srcdoc": true,
	"tainting.sink.img.src": true,
	"tainting.sink.img.srcset": true,
	"tainting.sink.innerHTML": true,
	"tainting.sink.insertAdjacentHTML": true,
	"tainting.sink.insertAdjacentText": true,
	"tainting.sink.localStorage.setItem": true,
	"tainting.sink.localStorage.setItem(key)": true,
	"tainting.sink.location.assign": true,
	"tainting.sink.location.hash": true,
	"tainting.sink.location.host": true,
	"tainting.sink.location.href": true,
	"tainting.sink.location.pathname": true,
	"tainting.sink.location.port": true,
	"tainting.sink.location.protocol": true,
	"tainting.sink.location.replace": true,
	"tainting.sink.location.search": true,
	"tainting.sink.media.src": true,
	"tainting.sink.navigator.sendBeacon(body)": true,
	"tainting.sink.navigator.sendBeacon(url)": true,
	"tainting.sink.object.data": true,
	"tainting.sink.outerHTML": true,
	"tainting.sink.script.innerHTML": true,
	"tainting.sink.script.src": true,
	"tainting.sink.script.text": true,
	"tainting.sink.script.textContent": true,
	"tainting.sink.sessionStorage.setItem": true,
	"tainting.sink.sessionStorage.setItem(key)": true,
	"tainting.sink.setInterval": true,
	"tainting.sink.setTimeout": true,
	"tainting.sink.source": true,
	"tainting.sink.srcset": true,
	"tainting.sink.track.src": true,
	"tainting.sink.window.open": true,
	"tainting.sink.window.postMessage": true,
};


const options = {
	browser: {
		firefoxUserPrefs: ffopts
	}, 
	context: {
		ignoreHTTPSErrors: true,
		bypassCSP: true,  /* do not interfere with injected scripts at runtime */
		viewport: {
			width: 1920,
			height: 1080
		}
	},
	crawler: {maxDepth: 100, maxLinks: MAX_PAGES, randomizeLinks: true, maxRetries: 2, depthFirst: true},

	seed: {
		list: SITE_LIST,
		pageLimit: MAX_PAGES
	},
	debug: false,

};


// -------------------------------------------------------- //
// utility
// -------------------------------------------------------- // 

/** 
 * @function hashURL 
 * @param url: string
 * @return returns the SHA256 hash of the given input in hexa-decimal format
**/
function hashURL(url){
	const hash = crypto.createHash('sha256').update(url, 'utf8').digest('hex');
	return hash;
}

function getMD5Hash(string){
	return crypto.createHash('md5').update(string).digest("hex");
}

/** 
 * @function getNameFromURL 
 * @param url: eTLD+1 domain name
 * @return converts the url to a string name suitable for a directory by removing the colon and slash symbols
**/
function getNameFromURL(url){
	return url.replace(/\:/g, '-').replace(/\//g, '');
}

/** 
 * @function getOrCreateDataDirectoryForWebsite 
 * @param url: string
 * @return creates a directory to store the data of the input url and returns the directory name.
**/
function getOrCreateDataDirectoryForWebsite(url){
	const folderName = getNameFromURL(url);
	const folderPath = pathModule.join(dataStorageDirectory, folderName);
	if(!fs.existsSync(folderPath)){
		fs.mkdirSync(folderPath);
	}
	return folderPath;
}


function directoryExists(url){

	const folderName = getNameFromURL(url);
	const folderPath = pathModule.join(dataStorageDirectory, folderName);
	if(fs.existsSync(folderPath)){
		return true;
	}
	return false;
}


function getValueFromDictOrNull(dictionary, key){
	if(key in dictionary){
		return dictionary[key]
	}
	return null;
}


/** 
 * @function savePageData 
 * @param url: string
 * @param html: string
 * @param scripts: list
 * @param siteDataDirectory: string of the base directory to store the data for the current website.
 * @return stores the input webpage data and returns the absolute folder name where the data is saved.
**/
function savePageData(pid, url, html, scripts, cookies, webStorageData, httpRequests, httpResponses, taintFlows, siteDataDirectory){

	console.log("[IO] started saving webpage.");
	// const webpageFolderName = hashURL(url);
	const webpageFolderName = pid;
	const webpageFolder = pathModule.join(siteDataDirectory, webpageFolderName);

	if(COLLECT_WEBPAGE){

		if(!fs.existsSync(webpageFolder)){
			fs.mkdirSync(webpageFolder);
		}

		// store url in url.out in the webpage-specific directory
		fs.writeFileSync(pathModule.join(webpageFolder, "url.out"), url);


		try{
			COLLECT_DOM_SNAPSHOT && fs.writeFileSync(pathModule.join(webpageFolder, "index.html"), html, 'utf8');
		}catch(e){
		}

		if(COLLECT_SCRIPTS){

			let scriptMapping = {};
			var sid = 0;
			for(let i=0; i< scripts.length; i++){
				let s = scripts[i];

				let script_path_name = pathModule.join(webpageFolder, `${sid}.js`);
				let script_path_name_org = pathModule.join(webpageFolder, `${sid}.min.js`); // non-beautified code
				let script_path_name_source_map =  pathModule.join(webpageFolder, `${sid}.js.map`); // sourcemap

				let scriptKind = s[0];
				let scriptSourceMappingObject = s[1];
				let sourcemap = undefined;

				// include the real filenames in the sourcemap 
				// instead of having the __fakename included by the `js-beautify-sourcemap` library
				if (scriptSourceMappingObject.sourcemap) {
							sourcemap = JSON.parse(scriptSourceMappingObject.sourcemap);
							sourcemap.file = script_path_name_source_map; // sourcemap file name
							sourcemap.sources = [ `${sid}.js` ]; // original filename
				}

				if(scriptSourceMappingObject.original_code && scriptSourceMappingObject.original_code.length > 0){

					// calculate the script MD5 hash
					let scriptHash = getMD5Hash(scriptSourceMappingObject.original_code);

					// save the script 
					if(scriptKind === TYPE_SCRIPT_INTERNAL){

						scriptMapping[`${sid}.js`] = {
							'type': scriptKind,
							'src': '',
							'hash': scriptHash
						};

						 fs.writeFileSync(script_path_name, scriptSourceMappingObject.code, 'utf8');
						 fs.writeFileSync(script_path_name_org, scriptSourceMappingObject.original_code);
						 fs.writeFileSync(script_path_name_source_map, JSON.stringify(sourcemap));

						 sid = sid + 1;
					}else{
						if(s.length === 4){ // checks if `SCRIPT_SRC_REPLACED_WITH_CONTENT` is in `s` 

							let scriptSrc = s[2];
							scriptMapping[`${sid}.js`] = {
								'type': scriptKind,
								'src': scriptSrc,
								'hash': scriptHash
							};

							fs.writeFileSync(script_path_name, scriptSourceMappingObject.code ? scriptSourceMappingObject.code : "", 'utf8');
							fs.writeFileSync(script_path_name_org, scriptSourceMappingObject.original_code ? scriptSourceMappingObject.original_code : "");
							fs.writeFileSync(script_path_name_source_map, sourcemap ? JSON.stringify(sourcemap) : ""); 
							sid = sid + 1;

						}
					}
				}else{

					// Sanity check only; this case should not happen. 
					// If it does, it indicates a problem either in a third-party library we are using, i.e., 
					// script collection via playwright/puppeteer, or the virtual dom processing
					if(s[1].trim().length> 0){
						DEBUG && console.log('[Warning] script content not found for:', s[0], s[1]);
					}
					
						
				}


			}; // end forloop

			try{
				// store the mapping between scripts
				fs.writeFileSync(pathModule.join(webpageFolder, "scripts_mapping.json"),  JSON.stringify(scriptMapping, null, '\t'), 'utf8');
			}catch(e){
				console.log('[ScriptMappingFileSaveError]', e);
			}
		}


		try{
			COLLECT_COOKIES     && fs.writeFileSync(pathModule.join(webpageFolder, "cookies.json"), JSON.stringify(cookies, null, '\t'), 'utf8');
		}catch(e){
			console.log('[CookieSaveError]', e);
		}

		try{
			COLLECT_WEB_STORAGE && fs.writeFileSync(pathModule.join(webpageFolder, "webstorage.json"), JSON.stringify(webStorageData, null, '\t'), 'utf8');
		}catch(e){
			console.log('[StorageSaveError]', e);
		}

		try{
			COLLECT_REQUESTS && fs.writeFileSync(pathModule.join(webpageFolder, "requests.json"), JSON.stringify(httpRequests, null, '\t'), 'utf8');
		}catch(e){
			console.log('[RequestsSaveError]', e);
		}
		
		
		try{
			COLLECT_RESPONSE_HEADERS  && fs.writeFileSync(pathModule.join(webpageFolder, "responses.json"), JSON.stringify(httpResponses, null, '\t'), 'utf8');
		}
		catch(e){
			console.log('[ResponsesSaveError]', e);
		}

		try{
			COLLECT_TAINT_FLOWS && fs.writeFileSync(pathModule.join(webpageFolder, "taintflows.json"),  JSON.stringify(taintFlows, null, '\t'), 'utf8');
		}catch (e){
			console.log('[TaintFlowSaveError]', e);
			COLLECT_TAINT_FLOWS && fs.writeFileSync(pathModule.join(webpageFolder, "taintflows.json"),  JSON.stringify(taintFlows));
		}
	
	}
	
	console.log(`[IO] finished saving webpage for pid ${pid}`);

	return webpageFolder;
}


/** 
 * @function getScriptSourceMappingObject 
 * @param script_content: javascript code
 * @return returns the script sourcemapping object output by `js-beautify-sourcemap` library
**/
async function getScriptSourceMappingObject(script_content) {

	try{
		if(script_content && script_content.length){

			// define an offset for the sourcemap
			let mapping_offset =  {line: 1, column: 0};
			
			// get the transformed code + sourcemap
			let beautified_script_obj = await js_beautify(script_content, { indent_size: 2, space_in_empty_paren: true }, mapping_offset);

			// keep the original code
			beautified_script_obj.original_code = script_content;

			return beautified_script_obj;

		}
		return "";
	}catch{
		// Protocol error (Debugger.getScriptSource): No script for id: <ID>
		return ""
	}
}

// -------------------------------------------------------- //
// Main
// -------------------------------------------------------- // 

/* these variables must be reset per page load */
var taintflows = [];
var externalScripts = {};
var httpResponses = {};
var httpRequests = {};
var allScripts = [];
var webStorageData = {};
var cookies = {};
var html = "";
var siteDataDirectory = "";
var webpageUrl ="";
var etldPlusOne = "";
var globalCookieString = "";
var title = "";
var meta_tags = [];
var unlocked = false;


async function initialize() {
	let context = await browser.context();
	context.addInitScript(flowHandlerScript);

	context.exposeBinding("__nightcrawler_taint_report", async function (source, value) {
			taintflows.push(value);
	});

	// grant permissions for the HTTP Push API
	context.grantPermissions(['notifications']);
	
	context.on('response', async response => {
		if(unlocked){
			// only save data within the `during` event
			try{
				const url = response.url();

				httpResponses[''+url] = await response.allHeaders();

				if (response.request().resourceType() === 'script') {
					response.text().then(async (script_content) => {
						let scriptSourceMappingObject = await getScriptSourceMappingObject(script_content);
						externalScripts[url] = scriptSourceMappingObject;
					}).catch( e => {
						// PASS: response body is unavailable for redirect responses  
					});
				}

				// Extract domain (might fail e.g. for blob URLs)
				let origin;
				let parsed = await common.parseUrl(url);
				if (parsed && parsed.host) {
					origin = parsed;
				}

				let cookieString = await response.headerValue("set-cookie");
				if(cookieString){
					globalCookieString = cookieString;
				}               
			}catch{
				DEBUG && console.log("context error", e);
			}

		}

	});

	// set the request interception to true and collect the HTTP requests
	context.on('request', async (request) => {

		let requestUrl = request.url();
		// filter out data:image urls
		
		try{
			if (!requestUrl.startsWith('data:image')){
				let requestHeaders = await request.allHeaders();
				let requestBody = await request.postData();
				httpRequests[requestUrl] = {
					'headers': requestHeaders,
					'postData': requestBody,
				}           
			}
		}catch(e){
			DEBUG && console.log("context error", e);
		}
	});
}


function isNonEmptyString(str) {
  return typeof str === "string" && !!str.trim();
}

function parseCookieNameValuePair(nameValuePairStr) {
  // Parses name-value-pair according to rfc6265bis draft
  var name = "";
  var value = "";
  var nameValueArr = nameValuePairStr.split("=");
  if (nameValueArr.length > 1) {
	name = nameValueArr.shift();
	value = nameValueArr.join("="); // everything after the first =, joined by a "=" if there was more than one part
  } else {
	value = nameValuePairStr;
  }

  return { name: name, value: value };
}

/* parses a set-cookie HTTP header */
function parseCookie(str, options) {

  var opt = options || {};
  var dec = opt.decode || false;
  var parts = str.split(";").filter(isNonEmptyString);

  var nameValuePairStr = parts.shift();
  var parsed = parseCookieNameValuePair(nameValuePairStr);
  var name = parsed.name;
  var value = parsed.value;

  // try decoding
  try {
	value = dec ? decodeURIComponent(value) : value; // decode cookie value
  } catch (e) { }

  var cookie = {
	name: name,
	value: value,
  };

  for(let part of parts){
	var sides = part.split("=");
	var key = sides.shift().trimLeft().toLowerCase();
	var value = sides.join("=");

	if (key === "secure") {
	  cookie.secure = true;
	} else if (key === "httponly") {
	  cookie.httponly = true;
	} else if (key === "samesite") {
	  cookie.samesite = value.slice(0, 7); // only the first 7 characters
	} else if(key === "partitioned"){
	  cookie.partitioned = true
	}
	else {
	  cookie[key] = value;
	}
  }
  if("domain" in cookie){

  }

  return cookie;
}

async function saveCookies(params, cookieString){

	var cookies = [];
	var parsedCookies = [];
	try{
		let setCookieHeaders = cookieString.split('\n');
		for(let hdr of setCookieHeaders){
			let parsedCookie = await parseCookie(hdr, { decode: true });
			parsedCookies.push(parsedCookie);
		}
	}catch(e){}

	for(let cookieObj of parsedCookies){

		let thirdParty = false;
		try{
			let u1 = webpageUrl;
			let u2 = (cookieObj.domain)? cookieObj.domain : webpageUrl;
			
			// remove leading . 
			if(u2.startsWith('.')){
				u2 = u2.slice(1, u2.length + 1)
			}
			if(!u2.startsWith("http:")){ // needed for the parseUrl() function
				u2 = "http://" + u2;
			}
			if(u1 && u2 && u1.length && u2.length){
				thirdParty = !(await common.sameSite(u1, u2))
			}
		}catch(e){
			DEBUG && console.log("cookie domain comparison", e);
		}
		let obj = [
			params.root,
			params.pid,
			etldPlusOne,
			cookieObj.name?cookieObj.name:null,
			cookieObj.value?cookieObj.value:null,
			cookieObj.domain?cookieObj.domain:null,
			cookieObj.path?cookieObj.path:null,
			cookieObj.secure?cookieObj.secure:null,
			cookieObj.httponly?cookieObj.httponly:null,
			cookieObj.samesite?cookieObj.samesite:null,
			thirdParty
		]
		cookies.push(obj);
	}
	
	if(cookies.length){
		await db.query("INSERT INTO cookies VALUES ?", [cookies]);
	}
	console.log(`DB-SAVE: ${cookies.length} cookie objects for pid ${params.pid}`);
}

async function saveHttpResponses(params){

	const pageUrl = `${params.protocol}${params.host}${params.path}${params.query}`;
	let locations = [];

	// find all top-level resources
	// we store the HTTP headers in the DB only for them
	if(pageUrl in httpResponses){ // sanity check: must always hold
		locations.push(pageUrl);

		let resp = httpResponses[pageUrl];
		let done = false;
		while(!done){
			if(resp && ("location" in resp)){
				let target = resp["location"];
				locations.push(target);
				resp = httpResponses[target];
			}else{
				done = true;
				break
			}
		}
	}

	let responseHeaderObjects = [];
	for(let resource_url of locations){
		let resp = httpResponses[resource_url];
		if(resp){
			let obj = [
				params.root, 
				params.pid,
				resource_url,
				('accept-ch' in resp)? resp['accept-ch']: null,
				('accept-patch' in resp)? resp['accept-patch']: null,
				('accept-post' in resp)? resp['accept-post']: null,
				('accept-ranges' in resp)? resp['accept-ranges']: null,
				('access-control-allow-credentials' in resp)? resp['access-control-allow-credentials']: null,
				('access-control-allow-headers' in resp)? resp['access-control-allow-headers']: null,
				('access-control-allow-methods' in resp)? resp['access-control-allow-methods']: null,
				('access-control-allow-origin' in resp)? resp['access-control-allow-origin']: null,
				('access-control-allow-expose-headers' in resp)? resp['access-control-allow-expose-headers']: null, 
				('access-control-max-age' in resp)? resp['access-control-max-age']: null,
				('age' in resp)? resp['age']: null,
				('allow' in resp)? resp['allow']: null,
				('alt-svc' in resp)? resp['alt-svc']: null,
				('cache-control' in resp)? resp['cache-control']: null,
				('clear-site-data' in resp)? resp['clear-site-data']: null,
				('connection' in resp)? resp['connection']: null,
				('content-encoding' in resp)? resp['content-encoding']: null,
				('content-disposition' in resp)? resp['content-disposition']: null,
				('content-language' in resp)? resp['content-language']: null,
				('content-length' in resp)? resp['content-length']: null,
				('content-location' in resp)? resp['content-location']: null,
				('content-range' in resp)? resp['content-range']: null,
				('content-security-policy' in resp)? resp['content-security-policy']: null,
				('content-security-policy-report-only' in resp)? resp['content-security-policy-report-only']: null,
				('content-type' in resp)? resp['content-type']: null,
				('cross-origin-embedder-policy' in resp)? resp['cross-origin-embedder-policy']: null,
				('cross-origin-opener-policy' in resp)? resp['cross-origin-opener-policy']: null,
				('cross-origin-resource-policy' in resp)? resp['cross-origin-resource-policy']: null,
				('date' in resp)? resp['date']: null,
				('digest' in resp)? resp['digest']: null,
				('etag' in resp)? resp['etag']: null,
				('expires' in resp)? resp['expires']: null,
				('keep-alive' in resp)? resp['keep-alive']: null,
				('last-modified' in resp)? resp['last-modified']: null,
				('ink' in resp)? resp['ink']: null,
				('location' in resp)? resp['location']: null,
				('permissions-policy' in resp)? resp['permissions-policy']: null,
				('proxy-authenticate' in resp)? resp['proxy-authenticate']: null,
				('referrer-policy' in resp)? resp['referrer-policy']: null,
				('retry-after' in resp)? resp['retry-after']: null,
				('sec-websocket-accept' in resp)? resp['sec-websocket-accept']: null,
				('server' in resp)? resp['server']: null,
				('server-timing' in resp)? resp['server-timing']: null,
				('sourcemap' in resp)? resp['sourcemap']: null,
				('strict-transport-security' in resp)? resp['strict-transport-security']: null,
				('timing-allow-origin' in resp)? resp['timing-allow-origin']: null,
				('trailer' in resp)? resp['trailer']: null,
				('transfer-encoding' in resp)? resp['transfer-encoding']: null,
				('upgrade' in resp)? resp['upgrade']: null,
				('vary' in resp)? resp['vary']: null,
				('via' in resp)? resp['via']: null,
				('www-authenticate' in resp)? resp['www-authenticate']: null,
				('x-content-type-options' in resp)? resp['x-content-type-options']: null
			];
			responseHeaderObjects.push(obj);
		}
	}
	if(responseHeaderObjects.length){
		await db.query("INSERT INTO response_headers VALUES ?", [responseHeaderObjects]);
	}
	console.log(`DB-SAVE: ${responseHeaderObjects.length} set of response header objects for pid ${params.pid}`);

}

function getLinesOf(str){
	return str.split("\n").length;
}

async function saveScriptMetaData(params, scripts){

	let scriptCount = (scripts && scripts.length)? scripts.length:0;
	let lines = 0;
	if(scriptCount){
		for(let i=0; i<scriptCount; i++){
			let scriptContentObj = scripts[i][1];
			if(scriptContentObj && scriptContentObj.code){
				lines = lines + (await getLinesOf(scriptContentObj.code))
			}
		}
	}
	let data = [[params.root, params.pid, scriptCount, lines]];
	await db.query("INSERT INTO scripts VALUES ?", [data]);
	console.log(`DB-SAVE: ${scriptCount} scripts, ${lines} LoC.`);
}


async function seed(params) {

	await crawler.seed();
	await importer.csv({
		file: SITE_LIST,
		limit: MAX_SITES
	});

	await db.create(
		"scripts(" +
		"root INT UNSIGNED NOT NULL," +
		"pid INT UNSIGNED NOT NULL," +
		"count INT UNSIGNED," +
		"loc BIGINT," +
		"INDEX(root), INDEX(pid)" +
		")"
	);

	await db.create(
		"cookies(" +
		"root INT UNSIGNED NOT NULL," +
		"pid INT UNSIGNED NOT NULL," +
		"domain VARCHAR(256) NOT NULL," +
		"cookie_name VARCHAR(256)," +
		"cookie_value TEXT," +
		"cookie_domain VARCHAR(256)," +
		"cookie_path TEXT," +
		"secure BOOLEAN," + 
		"http_only BOOLEAN," + 
		"same_site VARCHAR(7)," +
		"third_party BOOLEAN," + 
		"INDEX(root), INDEX(pid)" +
		")"
	);

	await db.create(
		"response_headers(" +
		"root INT UNSIGNED NOT NULL," +
		"pid INT UNSIGNED NOT NULL," +
		"resource_url TEXT," +
		"accept_ch TEXT," +
		"accept_patch TEXT," +
		"accept_post TEXT," +
		"accept_ranges TEXT," +
		"access_control_allow_credentials TEXT," +
		"access_control_allow_headers TEXT," +
		"access_control_allow_methods TEXT," +
		"access_control_allow_origin TEXT," +
		"access_control_allow_expose_headers TEXT," +
		"access_control_max_age TEXT," +
		"age TEXT," +
		"allow TEXT," +
		"alt_svc TEXT," +
		"cache_control TEXT," +
		"clear_site_data TEXT," +
		"connection TEXT," +
		"content_encoding TEXT," +
		"content_disposition TEXT," +
		"content_language TEXT," +
		"content_length TEXT," +
		"content_location TEXT," +
		"content_range TEXT," +
		"content_security_policy TEXT," +
		"content_security_policy_report_only TEXT," +
		"content_type TEXT," +
		"cross_origin_embedder_policy TEXT," +
		"cross_origin_opener_policy TEXT," +
		"cross_origin_resource_policy TEXT," +
		"date TEXT," +
		"digest TEXT," +
		"etag TEXT," +
		"expires TEXT," +
		"keep_alive TEXT," +
		"last_modified TEXT," +
		"ink TEXT," +
		"location TEXT," +
		"permissions_policy TEXT," +
		"proxy_authenticate TEXT," +
		"referrer_policy TEXT," +
		"retry_after TEXT," +
		"sec_websocket_accept TEXT," +
		"server TEXT," +
		"server_timing TEXT," +
		"sourcemap TEXT," +
		"strict_transport_security TEXT," +
		"timing_allow_origin TEXT," +
		"trailer TEXT," +
		"transfer_encoding TEXT," +
		"upgrade TEXT," +
		"vary TEXT," +
		"via TEXT," +
		"www_authenticate TEXT," +
		"x_content_type_options TEXT," +
		"INDEX(root), INDEX(pid)" +
		")"
	);

	await db.create(
		"titles(" +
		"root INT UNSIGNED NOT NULL, pid INT UNSIGNED NOT NULL, title LONGTEXT NOT NULL," +
		"INDEX(root), INDEX(pid)" +
		")"
	);

	await db.create(
		"metatags(" +
		"root INT UNSIGNED NOT NULL, pid INT UNSIGNED NOT NULL, name VARCHAR(512) NOT NULL, value LONGTEXT NOT NULL," +
		"INDEX(root), INDEX(pid), INDEX(name)" +
		")"
	);

 }

async function before(params) {
	unlocked = false;
	title = "";
	meta_tags = [];
	globalCookieString = "";
	taintflows = [];
	externalScripts = {};
	httpResponses = {};
	httpRequests = {};
	allScripts = [];
	webStorageData = {};
	cookies = {};
	html = "";
	webpageUrl = `${params.protocol}${params.host}${params.path}${params.query}${params.fragment}`;
	etldPlusOne = common.pslHost(params.host);
	siteDataDirectory = await getOrCreateDataDirectoryForWebsite(etldPlusOne);
}

async function during(params) {

	unlocked = true;

	console.log(`[pageload] waiting for ${PAGE_LOAD_WAIT_TIMEOUT} seconds.`);
	let page = await browser.page();
	await page.waitForTimeout(PAGE_LOAD_WAIT_TIMEOUT);
	// await common.sleep(20000);
	console.log('[pageload] load complete');

	html = await page.content();

	const virtualDOM = new JSDOM(html, { virtualConsole });

	let scriptTags = virtualDOM.window.document.getElementsByTagName('script');
	scriptTags = Array.prototype.slice.call(scriptTags); // cast HTMLCollection to Array

	var idx = 0;
	for(const [index, scriptTag] of scriptTags.entries()){

		// check if we have an internal script
		let scriptSrc = scriptTag.getAttribute('src');
		if(!scriptSrc){

			// check if the script contains JS code or json data?
			let scriptType = scriptTag.getAttribute('type');
			let scriptKind = TYPE_SCRIPT_INTERNAL;
			if(!scriptType){
				// CASE 1: `type` attribute does not exist
				allScripts[idx] = [scriptKind, scriptTag.textContent];
				idx = idx + 1;
			}
			else if(scriptType && SCRIPT_MIME_TYPES_FOR_JS.includes(scriptType)){
				// CASE 2: `type` attribute exists and is a valid JS mime type
				allScripts[idx] = [scriptKind, scriptTag.textContent];
				idx = idx + 1;
			}

		}
		else if(scriptSrc && scriptSrc.trim().length > 0){
			// the script is external
			let scriptKind = TYPE_SCRIPT_EXTERNAL;
			let scriptType = scriptTag.getAttribute('type');
			
			if(!scriptType){
				allScripts[idx] = [scriptKind, scriptSrc.trim()];
				idx = idx + 1;

			}else if(scriptType && SCRIPT_MIME_TYPES_FOR_JS.includes(scriptType)){
				allScripts[idx] = [scriptKind, scriptSrc.trim()];
				idx = idx + 1;
			}

		}
		// console.log('hs', getMD5Hash(scriptTag.textContent))
	}

   // console.log('allScripts', allScripts);
   var iii = 0
   for(const [index, scriptItem] of allScripts.entries()){

		let scriptKind = scriptItem[0];

		if(scriptKind === TYPE_SCRIPT_INTERNAL){
			let scriptContent = scriptItem[1];
			allScripts[index][1] = await getScriptSourceMappingObject(scriptContent);
		}else{

			let scriptSrc = scriptItem[1];

			// the script `src` obtained here must be present in the `externalScript` list intercepted via playwright / puppeteer
			// but there is no guarantee that the URL is present in a verbatim form there, 
			// i.e., this URL could be a substring of the URL present in the `externalScript`
			// thus we search for this URL, and replace the external script url with its content 
			let externalScriptUrls = Object.keys(externalScripts);
			for(const url of externalScriptUrls){
				if(url.includes(scriptSrc)){
					allScripts[index][1] = await externalScripts[url];
					allScripts[index].push(url);
					// note: if a script is external and does not have the `SCRIPT_SRC_REPLACED_WITH_CONTENT`
					// item, then the script url has not been replaced with its content.
					allScripts[index].push('SCRIPT_SRC_REPLACED_WITH_CONTENT');
					break;
				}
			}
			
		}
   }

	// web storage data
	let webStorageData = await page.evaluate( () => {
		
		function getWebStorageData() {
			let storage = {};
			let keys = Object.keys(window.localStorage);
			let i = keys.length;
			while ( i-- ) {
				storage[keys[i]] = window.localStorage.getItem(keys[i]);
			}
			return storage;
		}

		let webStorageData = getWebStorageData();
		return webStorageData;
	});

	// cookies and local storage
	// https://playwright.dev/docs/api/class-browsercontext#browser-context-storage-state
	let cookies = await browser.context().storageState();

	// page categorization: store title and meta tags
	title = await page.title();

	meta_tags = await page.evaluate(() => {
		let meta = [];
		for(const t of document.getElementsByTagName("meta")) {
			let prop = t.getAttribute("property");
			let name = t.getAttribute("name");
			if(prop !== null && (prop.startsWith("og:") || prop.startsWith("twitter:")))    {
				meta.push({k: prop, v: t.content});
			}
			if(name !== null && (name.startsWith("og:") || name.startsWith("twitter:")))    {
				meta.push({k: name, v: t.content});
			}
		}
		return meta;
	});


	/** 
	* prevent auto navigation / auto page refresh 
	* everytime the `beforeunload` event fires.
	*/
	await page.evaluate( () => {
		window.addEventListener('beforeunload', (event) => {
			// cancel the event as stated by the standard.
			event.preventDefault();
			// chrome requires returnValue to be set.
			event.returnValue = 'locking-auto-page-refresh.';
			return "";
		});
	})

	unlocked = false;
}


async function after(params) {
	
	unlocked = false;

	try{
		// save the collected data 
		let pid = ''+params.pid;
		await savePageData(pid, webpageUrl, html, allScripts, cookies, webStorageData, httpRequests, httpResponses, taintflows, siteDataDirectory);
	}catch(e){
		DEBUG && console.log('[PageSaveError] error while saving the webpage data');
		DEBUG && console.log('[PageSaveError]', e);
	}
	if(EXPORT_SCRIPT_METADATA){
		await saveScriptMetaData(params, allScripts);
	}
	if(EXPORT_COOKIES){
		await saveCookies(params, globalCookieString);
	}

	if(EXPORT_RESPONSE_HEADERS){
		await saveHttpResponses(params);
	}

	if(EXPORT_TAINT_FLOWS){
		for (let f of taintflows) {
			let finding = await enhance_finding(f);
			await send_finding(params, Object.assign({errored: params.error !== undefined }, finding));
		}
		console.log(`Exported ${taintflows.length} taint findings for ${params.protocol + params.host}`);
	}

	if(EXPORT_TITLE_AND_META){
		await db.query("INSERT INTO titles VALUES (?,?,?)", [params.root, params.pid, title]);
		if(meta_tags.length > 0){
			let tags = [];
			for (const mt of meta_tags) {
				tags.push([params.root, params.pid, mt.k, mt.v]);
			}
			await db.query("INSERT INTO metatags VALUES ?", [tags]);
		}
		console.log(`DB-SAVE: ${meta_tags.length} meta tags for pid ${params.pid}`);
	}
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

module.exports = {
	options,
	seed,
	initialize,
	before,
	during,
	after,
};

