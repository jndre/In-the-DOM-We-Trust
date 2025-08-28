const constantsModule = require('./../../engine/lib/jaw/constants');
const esprimaParser = require('./../../engine/lib/jaw/parser/jsparser');
const globalsModule = require('./globals.js');
const walkes = require('walkes');
const escodgen = require('escodegen');
var Set = require('./../../engine/lib/analyses/set');
const DEBUG = false;


/**
 * DOMSelectorsSourceSinkAnalyzer
 * @constructor
 */
function DOMSelectorsSourceSinkAnalyzer() {
	"use strict";
	// re-instantiate every time
	this.api = require('./../../engine/model_builder');
	this.scopeCtrl = require('./../../engine/lib/jaw/scope/scopectrl');
	this.modelCtrl = require('./../../engine/lib/jaw/model/modelctrl');
	this.modelBuilder = require('./../../engine/lib/jaw/model/modelbuilder');
	this.scopeCtrl.clear();
	this.modelCtrl.clear();
}

function getIdentifierChildren(node){

	if(!node) return [];

	if(node.type === "Identifier"){
		return [node.name];
	}else{

		let identifier_names = new Set();
		walkes(node, {

			FunctionExpression: function(node,recurse){
				// we do not want function expression arguments
				// thus, do not recurse here
			},
			CallExpression: function(node, recurse){
				// we want the call expression arguments, e.g., JSON.stringify(x)
				// here, recurse only on the arguments
				for(let arg of node.arguments){
					recurse(arg);
				}
			},
			MemberExpression: function(node, recurse){
				// we only care about the member expression base objects
				// except when we have a `this.property` expression
				// where we are interested in the property part of the member expression
				let member_expression = escodgen.generate(node);
				if(member_expression.startsWith("this.")){ // handle ThisExpression
					member_expression = member_expression.replace('this.', '')
					let identifier_name = member_expression.substr(0, member_expression.indexOf('.'));
					if(!globalsModule.js_builtin.includes(identifier_name)){
						identifier_names.add(identifier_name);
					}
				}else{
					recurse(node.object); 
				}
			},
			ObjectExpression: function(node, recurse){
				// recurse on object expression values only
				// as keys cannot be tainted
				node.properties.forEach(prop=>{
					recurse(prop.value);
				})
			},
			Identifier: function(node, recurse){
				if(node.type === "Identifier"){
					if(!globalsModule.js_builtin.includes(node.name)){
						identifier_names.add(node.name);
					}
				}
			}
			
		});

		return [].concat(identifier_names.values()); // convert Set() to list with the spread operator
	}
}

DOMSelectorsSourceSinkAnalyzer.prototype.build_static_model = async function(code){

	let theSourceSinkAnalyzer = this;
	let language = constantsModule.LANG.js;
	await theSourceSinkAnalyzer.api.initializeModelsFromSource(code, language);
	await theSourceSinkAnalyzer.api.buildInitializedModels();
}

DOMSelectorsSourceSinkAnalyzer.prototype.get_sinks = async function(){
    /*
        1- Open Redirect:
			window/document.location = TAINT;
			location = TAINT;
		
			window/document.location.assign(TAINT);
			location.assign(TAINT);

			window/document.location.href.assign(TAINT);
			location.href.assign(TAINT);

			window/document.location.href = TAINT;
			location.href = TAINT;

			window/document.location.replace(TAINT);
			location.replace(TAINT);

			window/document.location.search = TAINT;
			location.search = TAINT;

			window/document.location.hash = TAINT;
			location.hash = TAINT;

			window/document.location.port = TAINT;
			location.port = TAINT;

			window/document.location.pathname = TAINT;
			location.pathname = TAINT;

			window/document.location.protocol = TAINT;
			location.protocol = TAINT;
			
			$(window/document.location).prop('href', TAINT);
			$(location).prop('href', TAINT);

			$(window/document.location).attr('href', TAINT);
			$(location).attr('href', TAINT);



		2- WebSocket URL poisoning (Hijacking WebSocket Connections)
			new WebSocket(TAINT, protocols);
			socket.send(TAINT);

		3- Link Manipulation
			someElement.src/href = TAINT;
			someElement.setAttribute('src/href', TAINT)
			someElement.src/href.assign(TAINT);

		4- Cookie Manipulation (STATE manipulation)
			document.cookie = TAINT;

			// CookieStore API
			CookieStore.delete(TAINT)
			CookieStore.get(TAINT)
			CookieStore.getAll(TAINT)
			CookieStore.set(TAINT)


		5- WebStorage Manipulation (STATE manipulation)
			localStorage.setItem(X, TAINT);	.getItem(TAINT); removeItem(Taint);	
			sessionStorage.setItem(X, TAINT); .getItem(TAINT); removeItem(Taint);

		6- Document Domain Manipulation
			document.domain = TAINT;
			document.domain.assign(TAINT);

		7!- Client-side JSON injection (see: https://portswigger.net/web-security/dom-based/client-side-json-injection)
			JSON.parse(TAINT);
			jQuery.parseJSON(TAINT);
			$.parseJSON(TAINT);

		8!- ReDos = Regex Denial of Service (see: https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
			new RegExp(TAINT);

		9- Web-message Manipulation
			window.postMessage(TAINT, TAINT, [transfer])
			postMessage(TAINT, TAINT, [transfer])
	
		10- Client-side CSRF

			URL poisoning
			---------------
			XMLHttpRequest.open(method, url=TAINT);
			jQuery.ajax({url: TAINT, ... });
			$.ajax({url: TAINT, ... });
			fetch(url=TAINT, {});
			AsyncRequest(url=TAINT)
			asyncRequest(url=TAINT)
			window.open(url)
		
			Header posioning
			---------------
			XMLHttpRequest.setRequestHeader(header, value=TAINT)

			Body posioning
			--------------
			jQuery.ajax({data: TAINT, ... });
			$.ajax({data: TAINT, ... });
			XMLHttpRequest.send(Taintable_data);

		11- Client-side XSS (list of sinks from: https://portswigger.net/web-security/cross-site-scripting/dom-based)
			someElement.innerHTML = TAINT
			someElement.outerHTML = TAINT

			someElement.insertAdjacentHTML(position, TAINT);
			eval(TAINT)
			document.write(TAINT)
			document.writeln(TAINT)
			jQuery.parseHTML(TAINT)
			$.parseHTML(TAINT)
			$(selector).html(TAINT);

			$(selector).append(TAINT);
			$(selector).appendTo(TAINT);
			$(selector).prepend(TAINT);
			$(selector).prependTo(TAINT);
			$(selector).add(TAINT);
			$(selector).insertAfter(TAINT);
			$(selector).insertBefore(TAINT);
			
			$(selector).after(TAINT);
			$(selector).before(TAINT);

			$(selector).wrap(TAINT);
			$(selector).wrapInner(TAINT);
			$(selector).wrapAll(TAINT);

			$(selector).replaceAll(TAINT);
			$(selector).replaceWith(TAINT);

			setTimeout(TAINT, ms);
			setInterval(TAINT, ms);

			
		12- Local File Read Path Manipulation
			new FileReader().readAsText/readAsArrayBuffer/readAsBinaryString/readAsDataURL(TAINT);
			SomeFileReaderInstance.readAsText/readAsArrayBuffer/readAsBinaryString/readAsDataURL(TAINT);

		13. SSE URL/connection hijack
			new EventSource(TAINT, config)
			new WebTransport(TAINT);

		14. CacheStorage
			[caches/cache].match(TAINT)
			[caches/cache].has(TAINT)
			[caches/cache].open(TAINT)
			[caches/cache].delete(TAINT)

		15. Selectors as sink
			document.getElementById(TAINT)
			document.getElementsByClassName(TAINT)
			document.getElementsByTagName(TAINT)
			document.querySelector(TAINT)
			document.querySelectorAll(TAINT)
			jQuery(Taint)
			$(Taint)


		
		16. ****** Assignment of sinks to variables *******
			e.g., a = window.location.assign();		a(Taint);

			

		17. SW backgroundFetch
			backgroundFetch.fetch(TAINT_ID, TAINT_LIST, TAINT_OBJ);
			
		18. Analytical data
			sendBeacon(url, data);

		19. Credential Management API
			new FederatedCredential(TAINT OBJ);
			navigator.credentials.store(TAINT OBJ);
			await navigator.credentials.get(TAINT OBJ);
			new PasswordCredential(TAINT OBJ);

		20. Event Listener hijacking
			TAINTABLE_ELEMENT.addEventListener(event, functionCall)
			TAINTABLE_ELEMENT.dispatchEvent(event)


    */

	// -------------------------------------------------------------------------------- //
	// 		SemanticTypes
	// -------------------------------------------------------------------------------- //

	// possible vulnerability types 
	const OPEN_REDIRECT_VULN = "open_redirect";
	const WEBSOCKET_URL_POISONING = "websocket_url_poisoning";
	const LINK_MANIPULATION = "link_manipulation";
	const COOKIE_MANIPULATION = "cookie_manipulation";
	const WEBSTORAGE_MANIPULATION = "web_storage_manipulation";
	const CACHESTORAGE_MANIPULATION = "cache_storage_manipulation";
	const DOCUMENT_DOMAIN_MANIPULATION = "document_domain_manipulation";
	const CLIENT_SIDE_JSON_INJECTION = "client_side_json_injection";
	const REDOS_ATTACK = "regex_denial_of_service";
	const POST_MESSAGE_MANIPULATION = "post_message_manipulation";
	const FILE_READ_PATH_MANIPULATION = "file_read_path_manipulation";
	const CROSS_SITE_SCRIPTING = "cross_site_scripting";

	// write 
	const WR_EVENTSOURCE_URL = "WR_EVENTSOURCE_URL";
	const WR_REQ_URL = "WR_REQ_URL";
	const WR_REQ_BODY = "WR_REQ_BODY";
	const WR_REQ_HEADER = "WR_REQ_HEADER";
	const WR_REQ_PARAMS = "WR_REQ_PARAMS"; // any parameter, including URL, body and header 
	const WR_WIN_OPEN_URL = "WR_WIN_OPEN_URL";
	const WR_SELECTOR_QUERY = "WR_SELECTOR_QUERY";

	const XSS_JQ_SINK_FUNCTIONS = [
		"html", 		//	$(selector).html(TAINT);
		"append",		//	$(selector).append(TAINT);
		"prepend",		//	$(selector).prepend(TAINT);
		"add",			//	$(selector).add(TAINT);
		"insertAfter",	//	$(selector).insertAfter(TAINT);
		"insertBefore", //	$(selector).insertBefore(TAINT);
		"after",		//	$(selector).after(TAINT);
		"before",		//	$(selector).before(TAINT);
		"wrap",			//	$(selector).wrap(TAINT);
		"wrapInner",	//	$(selector).wrapInner(TAINT);
		"wrapAll",		//	$(selector).wrapAll(TAINT);
		"has",			//	$(selector).has(TAINT);
		"index",		//	$(selector).index(TAINT);
		"replaceAll",	//	$(selector).replaceAll(TAINT);
		"replaceWith"	//	$(selector).replaceWith(TAINT);
	];


	var outputs = [];

	function appendSinkOutput(node, location, id, script_id, vuln, sink_code, sink_type, taint_possibility, sink_identifier_names){	
		if(node.semanticType){
			node.semanticType.concat(['sink', sink_type, vuln]);
		}else{
			node.semanticType = ['sink', sink_type, vuln];
		}
		
		outputs.push({
			"location": location,
			"id": id,
			"script": script_id,
			"vuln": vuln,
			"sink_code": sink_code,
			"sink_type": sink_type,
			"taint_possibility": taint_possibility, // true if the sink has at least one Identifier (i.e., not just literals)
			"sink_identifiers": sink_identifier_names,
		});
	}

	let pageScopeTrees = theSourceSinkAnalyzer.scopeCtrl.pageScopeTrees; 
	if(!pageScopeTrees){
		return [];
	}

	await pageScopeTrees.forEach(async function (scopeTree, pageIndex) {
		let pageModels = theSourceSinkAnalyzer.modelCtrl.getPageModels(scopeTree);
		let intraProceduralModels = pageModels.intraProceduralModels;
		let ast = scopeTree.scopes[0].ast;
		const script_id = ast.value;

		walkes(ast, {

			AssignmentExpression: function(node, recurse){
				// CASE: [Open Redirect] [window.]location.[property] = TAINT
				if( 
					(node.left.type === "MemberExpression" && escodgen.generate(node.left).startsWith("window.location")) || 
					(node.left.type === "Identifier" && node.left.name === "location")
				){
					var taint_possibility = false;
					var identifier_names = getIdentifierChildren(node.right);
					if(identifier_names.length > 0){
						taint_possibility = true;
					}

					var identifiers_object = {
						OPEN_REDIRECT_VULN: identifier_names
					}
					var taint_possibility_object = {
						OPEN_REDIRECT_VULN: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [OPEN_REDIRECT_VULN], escodgen.generate(node), "window.location", taint_possibility_object, identifiers_object);
				} 

				// CASE: [XSS] someScript.textContent = TAINT;
				else if (node.left.type === "MemberExpression" && node.left.property.type === "Identifier" && node.left.property.name === "textContent"){
					
					var taint_possibility = false;
					var identifier_names = getIdentifierChildren(node.right);
					if(identifier_names.length > 0){
						taint_possibility = true;
					}

					var identifiers_object = {
						CROSS_SITE_SCRIPTING: identifier_names
					}
					var taint_possibility_object = {
						CROSS_SITE_SCRIPTING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), "script.textContent", taint_possibility_object, identifiers_object);
				}


				// CASE: [Link Manipulation] someElement.src = TAINT;
				else if(node.left.type === "MemberExpression" && escodgen.generate(node.left).endsWith(".src")){
					var taint_possibility = false;
					var identifier_names = getIdentifierChildren(node.right);
					if(identifier_names.length > 0){
						taint_possibility = true;
					}

					var identifiers_object = {
						LINK_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						LINK_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [LINK_MANIPULATION], escodgen.generate(node), "element.src", taint_possibility_object, identifiers_object);
				}  

				// CASE: [Cookie Manipulation] document.cookie = TAINT;
				else if(node.left.type === "MemberExpression" && escodgen.generate(node.left).startsWith("document.cookie")){
					var taint_possibility = false;
					var identifier_names = getIdentifierChildren(node.right);
					if(identifier_names.length > 0){
						taint_possibility = true;
					}

					var identifiers_object = {
						COOKIE_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						COOKIE_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [COOKIE_MANIPULATION], escodgen.generate(node), "document.cookie", taint_possibility_object, identifiers_object);			
				} 

				// CASE: [Document Domain Manipulation] document.domain = TAINT;
				else if(node.left.type === "MemberExpression" && escodgen.generate(node.left).startsWith("document.domain")){
					var taint_possibility = false;
					var identifier_names = getIdentifierChildren(node.right);
					if(identifier_names.length > 0){
						taint_possibility = true;
					}

					var identifiers_object = {
						DOCUMENT_DOMAIN_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						DOCUMENT_DOMAIN_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [DOCUMENT_DOMAIN_MANIPULATION], escodgen.generate(node), "document.domain", taint_possibility_object, identifiers_object);			
				}

				// CASE: [XSS]: someElement.innerHTML/outerHTML = TAINT;
				else if(node.left.type === "MemberExpression" && (node.left.property.name === "innerHTML" || node.left.property.name === "outerHTML")){
					

					var taint_possibility = false;
					var identifier_names = getIdentifierChildren(node.right);
					if(identifier_names.length > 0){
						taint_possibility = true;
				   	}
					
					var identifiers_object = {
						CROSS_SITE_SCRIPTING: identifier_names
					}
					var taint_possibility_object = {
						CROSS_SITE_SCRIPTING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), "element." + node.left.property.name, taint_possibility_object, identifiers_object);
				}else{
					// walk all child properties (also takes care of arrays)
					walkes.checkProps(node, recurse);
				}
			},


			CallExpression: function(node, recurse){
				// CASE: [XSS] [window.]eval(TAINT)
				if( (node.callee.type === "Identifier" && node.callee.name === "eval") || 
					(node.callee.type === "MemberExpression" && node.callee.object.name === "window" && node.callee.property.name === "eval")
				){
					var taint_possibility = false;
					let taint_argument = (node.arguments && node.arguments.length >0)? node.arguments[0]: null;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						CROSS_SITE_SCRIPTING: identifier_names
					}
					var taint_possibility_object = {
						CROSS_SITE_SCRIPTING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), "eval", taint_possibility_object, identifiers_object);
				}

				// CASE: socket.send(TAINT);
				else if (node.callee.type === "MemberExpression" && node.callee.property.name === "send" && node.callee.object.name && node.callee.object.name.toLowerCase() === "socket" ){
					var taint_argument = (node.arguments && node.arguments.length > 1)? node.arguments[1]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						WEBSOCKET_URL_POISONING: identifier_names
					}
					var taint_possibility_object = {
						WEBSOCKET_URL_POISONING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WEBSOCKET_URL_POISONING], escodgen.generate(node), "socket.send()", taint_possibility_object, identifiers_object);
					
				}

				// CASE: [XSS] [window.]setTimeout/setInterval(TAINT)
				else if( (node.callee.type === "Identifier" && (node.callee.name === "setTimeout" || node.callee.name === "setInterval")) || 
						 (node.callee.type === "MemberExpression" && node.callee.object.name === "window" && (node.callee.property.name === "setTimeout" || node.callee.property.name === "setInterval"))
				){
					let taint_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					if(taint_argument.type !== "FunctionExpression" && taint_argument.type !== "ArrowFunctionExpression"){
						

						var taint_possibility = false;
						var identifier_names = [];
						if(taint_argument){
							identifier_names = getIdentifierChildren(taint_argument);
							if(identifier_names.length > 0){
								taint_possibility = true;
							}
						}

						var sink_element = "";
						if(node.callee.type === "Identifier"){
							sink_element = node.callee.name;
						}else{
							sink_element = node.callee.property.name;
						}

						var identifiers_object = {
							CROSS_SITE_SCRIPTING: identifier_names
						}
						var taint_possibility_object = {
							CROSS_SITE_SCRIPTING: taint_possibility
						}

						appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), sink_element, taint_possibility_object, identifiers_object);
					}
				}


				// CASE: [Request Forgery] fetch/asyncRequest(url=TAINT);
				if(node.callee.type === "Identifier" && node.callee.name && (node.callee.name === "fetch" || node.callee.name.toLowerCase() === "asyncrequest")){
					
					// check if the request URL is taintable
					var taint_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						WR_REQ_URL: identifier_names
					}
					var taint_possibility_object = {
						WR_REQ_URL: taint_possibility
					}

					// check if the request body/headers are taintable as well
					if(node.arguments && node.arguments.length > 1){

						var req_options_node = node.arguments[1];
						// can be a pointer (i.e., Identifier) or an Object Expression with `headers` and `body` keys
						if(req_options_node){
							if(req_options_node.type === "Identifier"){
								identifiers_object[WR_REQ_PARAMS] = req_options_node.name;
								taint_possibility_object[WR_REQ_PARAMS] = true;
							} // end Identifier check
							else if(req_options_node.type === "ObjectExpression"){
								for(let prop of req_options_node.properties){
									if(prop.key && prop.key.type === "Identifier" && prop.key.name === "body"){
										var taint_possibility = false;
										var identifier_names = getIdentifierChildren(prop.value);
										if(identifier_names.length > 0){
											taint_possibility = true;
										}
										identifiers_object[WR_REQ_BODY] = identifier_names;
										taint_possibility_object[WR_REQ_BODY] = taint_possibility;
									}
									else if(prop.key && prop.key.type === "Identifier" && prop.key.name === "headers"){
										var taint_possibility = false;
										var identifier_names = getIdentifierChildren(prop.value); // check if there are any identifiers in the headers Object or not
										if(identifier_names.length > 0){
											taint_possibility = true;
										}
										identifiers_object[WR_REQ_HEADER] = identifier_names;
										taint_possibility_object[WR_REQ_HEADER] = taint_possibility;
									}
								}
							} // end ObjectExpression check
						} 
					} // end check for request body and headers
					appendSinkOutput(node, node.loc.start.line, node._id, script_id, Object.keys(taint_possibility_object), escodgen.generate(node), node.callee.name.toLowerCase(), taint_possibility_object, identifiers_object);
				}

				// CASE: [Request Forgery] $/jQuery.ajax(param={url: TAINT, ... });
				else if(node.callee.type === "MemberExpression" && node.callee.property.name === "ajax"){
					let call_argument = (node.arguments && node.arguments.length>0)? node.arguments[0]: null;
					
					var identifiers_object = {};
					var taint_possibility_object = {};


					if(call_argument && call_argument.type === "Identifier"){
						identifiers_object[WR_REQ_PARAMS] = getIdentifierChildren(call_argument);
						taint_possibility_object[WR_REQ_PARAMS] = true;

					}
					else if(call_argument && call_argument.type === "ObjectExpression"){
						for(let property of call_argument.properties){

							let property_key_node = property.key;

							if(property_key_node.type === 'Identifier'){

								if(property_key_node.name === "url"){

									var taint_possibility = false;
									var identifier_names = [];
									if(property.value){
										identifier_names = getIdentifierChildren(property.value);
										if(identifier_names.length > 0){
											taint_possibility = true;
										}
										
									}
									identifiers_object[WR_REQ_URL] = identifier_names;
									taint_possibility_object[WR_REQ_URL] = taint_possibility;
								}
								else if(property_key_node.name === "data"){

									var taint_possibility = false;
									var identifier_names = [];
									if(property.value){
										identifier_names = getIdentifierChildren(property.value);
										if(identifier_names.length > 0){
											taint_possibility = true;
										}
										
									}
									identifiers_object[WR_REQ_BODY] = identifier_names;
									taint_possibility_object[WR_REQ_BODY] = taint_possibility;
								}
								else if(property_key_node.name === "headers"){

									var taint_possibility = false;
									var identifier_names = [];
									if(property.value){
										identifier_names = getIdentifierChildren(property.value);
										if(identifier_names.length > 0){
											taint_possibility = true;
										}
										
									}
									identifiers_object[WR_REQ_HEADER] = identifier_names;
									taint_possibility_object[WR_REQ_HEADER] = taint_possibility;
								}
							}
						}
					}
					appendSinkOutput(node, node.loc.start.line, node._id, script_id, Object.keys(taint_possibility_object), escodgen.generate(node), "$.ajax", taint_possibility_object, identifiers_object);
				}

				// CASE: [Request Forgery] XMLHttpRequest/XDomainRequest.open(method, TAINT)
				else if(node.callee.type === "MemberExpression" && node.callee.property.name === "open" && node.callee.object.name && 
				 	(node.callee.object.name === "XMLHttpRequest" || node.callee.object.name === "XDomainRequest" || node.callee.object.name.toLowerCase() === "xmlhttp" || 
				 	node.callee.object.name.toLowerCase() === "xhttp" || node.callee.object.name.toLowerCase() === "xhr" || node.callee.object.name.toLowerCase() === "xdr" || node.callee.object.name.toLowerCase() === "req")
				){
					var taint_argument = (node.arguments && node.arguments.length > 1)? node.arguments[1]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						WR_REQ_URL: identifier_names
					}
					var taint_possibility_object = {
						WR_REQ_URL: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WR_REQ_URL], escodgen.generate(node), "XMLHttpRequest.open()", taint_possibility_object, identifiers_object);
				} 
				// CASE: [Request Forgery] XMLHttpRequest.setRequestHeader(header, value=TAINT)
				else if(node.callee.type === "MemberExpression" && node.callee.property.name === "setRequestHeader" && node.callee.object.name &&
				 	(node.callee.object.name === "XMLHttpRequest" || node.callee.object.name === "XDomainRequest" || node.callee.object.name.toLowerCase() === "xmlhttp" || 
				 	node.callee.object.name.toLowerCase() === "xhttp" || node.callee.object.name.toLowerCase() === "xhr" || node.callee.object.name.toLowerCase() === "xdr")
				){
					var taint_argument = (node.arguments && node.arguments.length > 1)? node.arguments[1]: null;
					
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}


					var identifiers_object = {
						WR_REQ_HEADER: identifier_names
					}
					var taint_possibility_object = {
						WR_REQ_HEADER: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WR_REQ_HEADER], escodgen.generate(node), "XMLHttpRequest.setRequestHeader()", taint_possibility_object, identifiers_object);
				}
				// CASE: [Request Forgery] XMLHttpRequest.send(data)
				else if(node.callee.type === "MemberExpression" && node.callee.property.name === "send" && node.callee.object.name &&
				 	(node.callee.object.name === "XMLHttpRequest" || node.callee.object.name === "XDomainRequest" || node.callee.object.name.toLowerCase() === "xmlhttp" || 
				 	node.callee.object.name.toLowerCase() === "xhttp" || node.callee.object.name.toLowerCase() === "xhr" || node.callee.object.name.toLowerCase() === "xdr")
				){
					var taint_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						WR_REQ_BODY: identifier_names
					}
					var taint_possibility_object = {
						WR_REQ_BODY: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WR_REQ_BODY], escodgen.generate(node), "XMLHttpRequest.send()", taint_possibility_object, identifiers_object);
				}

				// CASE: [File Read Path Manipulation] new FileReader().readAsText(TAINT);
				else if(node.callee.type === "MemberExpression" && node.callee.property.name === "readAsText" && node.arguments.length > 0){
					var taint_argument = (node.callee.arguments && node.callee.arguments.length > 0)? node.callee.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						FILE_READ_PATH_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						FILE_READ_PATH_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [FILE_READ_PATH_MANIPULATION], escodgen.generate(node), "new FileReader().readAsText()", taint_possibility_object, identifiers_object);
				} 

				// CASE: [Request Forgery] window.open(URL)
				else if(node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier" &&
				(node.callee.object.name === "window" || node.callee.object.name === "win" || node.callee.object.name === "w") &&
					node.callee.property.type === "Identifier" && node.callee.property.name === "open"){


					var taint_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						WR_WIN_OPEN_URL: identifier_names
					}
					var taint_possibility_object = {
						WR_WIN_OPEN_URL: taint_possibility
					}		
					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WR_WIN_OPEN_URL], escodgen.generate(node), "window.open()", taint_possibility_object, identifiers_object);			

				}

				// CASE: [Web-message Manipulation] [window.]postMessage(TAINT, ...)
				else if((node.callee.type === "MemberExpression" && node.callee.object.name === "window" && node.callee.property.name === "postMessage") ||
				   (node.callee.type === "Identifier" && node.callee.name === "postMessage")){
					var taint_argument = (node.callee.arguments && node.callee.arguments.length > 0)? node.callee.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						POST_MESSAGE_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						POST_MESSAGE_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [POST_MESSAGE_MANIPULATION], escodgen.generate(node), "window.postMessage()", taint_possibility_object, identifiers_object);
				} 

				// CASE: [Open Redirect] [window.]location[.property].assign(TAINT)
				else if(node.callee.type === "MemberExpression" && node.callee.property && node.callee.property.name === "assign"){
					let member_expression = escodgen.generate(node.callee);
					if(member_expression.startsWith("window.location") || member_expression.startsWith("location")){
					 	let call_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
						var taint_possibility = false;
						var identifier_names = [];
						if(call_argument){
							identifier_names = getIdentifierChildren(call_argument);
							if(identifier_names.length > 0){
								taint_possibility = true;
							}
						}

						var identifiers_object = {
							OPEN_REDIRECT_VULN: identifier_names
						}
						var taint_possibility_object = {
							OPEN_REDIRECT_VULN: taint_possibility
						}

					 	appendSinkOutput(node, node.loc.start.line, node._id, script_id, [OPEN_REDIRECT_VULN], escodgen.generate(node), "window.location", taint_possibility_object, identifiers_object);
					}
				} 

				// CASE: [Open Redirect] [window.]location.replace(TAINT)
				else if(node.callee.type === "MemberExpression" && node.callee.property && node.callee.property.name === "replace"){
					let member_expression = escodgen.generate(node.callee);
					if(member_expression === "window.location.replace" || member_expression === "location.replace"){
					 	let call_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
						var taint_possibility = false;
						var identifier_names = [];
						if(call_argument){
							identifier_names = getIdentifierChildren(call_argument);
							if(identifier_names.length > 0){
								taint_possibility = true;
							}
						}

						var identifiers_object = {
							OPEN_REDIRECT_VULN: identifier_names
						}
						var taint_possibility_object = {
							OPEN_REDIRECT_VULN: taint_possibility
						}

					 	appendSinkOutput(node, node.loc.start.line, node._id, script_id, [OPEN_REDIRECT_VULN], escodgen.generate(node), "window.location", taint_possibility_object, identifiers_object);		
					}
				} 

				// CASE: [Open Redirect] $([window.]location).prop/attr('href', TAINT);
				else if(node.callee.type === "MemberExpression" && node.callee.object.type === "CallExpression" && 
					   (node.callee.object.callee.name === "$" || node.callee.object.callee.name === "jQuery") &&
					   (node.callee.property.name === "prop" || node.callee.property.name === "attr") && node.arguments[0] && node.arguments[0].value === "href"
				){
					let selector = node.callee.object.arguments[0];
					let selector_code = escodgen.generate(selector);
					if(selector_code === "location" || selector_code === "window.location"){
						var taint_possibility = false;
						var identifier_names = [];
						var taint_argument = (node.callee && node.callee.object && node.callee.object.arguments)? node.callee.object.arguments[1]: null;
						if(taint_argument){
							identifier_names = getIdentifierChildren(taint_argument);
							if(identifier_names.length > 0){
								taint_possibility = true;
							}
						}

						var identifiers_object = {
							OPEN_REDIRECT_VULN: identifier_names
						}
						var taint_possibility_object = {
							OPEN_REDIRECT_VULN: taint_possibility
						}

						appendSinkOutput(node, node.loc.start.line, node._id, script_id, [OPEN_REDIRECT_VULN], escodgen.generate(node), "window.location", taint_possibility_object, identifiers_object);
					}	
				} 

				// CASE: [Link Manipulation] someElement.src.assign(TAINT)
				else if(node.callee.type === "MemberExpression" && escodgen.generate(node.callee).endsWith(".src.assign")){
					var taint_possibility = false;
					
					let call_argument = (node.callee.arguments)? node.callee.arguments[0]: null;
					var identifier_names = [];
					if(call_argument){
						identifier_names = getIdentifierChildren(call_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						LINK_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						LINK_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [LINK_MANIPULATION], escodgen.generate(node), "element.src", taint_possibility_object, identifiers_object);
				} 

				// CASE: [Link Manipulation] someElement.setAttribute('src', TAINT)
				else if(node.callee.type === "MemberExpression" && node.callee.property.name === "setAttribute" && node.arguments[0] && node.arguments[0].value === "src"){
					let taint_argument = (node.callee.arguments)? node.callee.arguments[1]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						LINK_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						LINK_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [LINK_MANIPULATION], escodgen.generate(node), "element.src", taint_possibility_object, identifiers_object);
				} 

				// CASE: [WebStorage Manipulation] localStorage/sessionStorage.setItem(X, TAINT) localStorage/sessionStorage.getItem(TAINT); localStorage/sessionStorage.removeItem(Taint);
				else if(node.callee.type === "MemberExpression" && (node.callee.object.name === "localStorage" || node.callee.object.name === "sessionStorage") &&
					(node.callee.property.name === "setItem" || node.callee.property.name === "getItem" || node.callee.property.name === "removeItem"))
				{
					let taint_argument = (node.arguments && node.arguments.length>0)? node.arguments[1]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						WEBSTORAGE_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						WEBSTORAGE_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WEBSTORAGE_MANIPULATION], escodgen.generate(node), node.callee.object.name + '.' + node.callee.property.name + '()', taint_possibility_object, identifiers_object);
				} 

				// CASE: [Client-side JSON Injection] JSON.parse(TAINT); $/jQuery.parseJSON(TAINT);
				else if(node.callee.type === "MemberExpression" && 
					(node.callee.object.name === "JSON" || node.callee.object.name === "$" || node.callee.object.name === "jQuery") &&
					(node.callee.property.name === "parse" || node.callee.property.name === "parseJSON")
				){
					let taint_argument = (node.arguments && node.arguments.length>0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						CLIENT_SIDE_JSON_INJECTION: identifier_names
					}
					var taint_possibility_object = {
						CLIENT_SIDE_JSON_INJECTION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CLIENT_SIDE_JSON_INJECTION], escodgen.generate(node), "JSON.parse()", taint_possibility_object, identifiers_object);
				}

				// CASE: [XSS] someElement.insertAdjacentHTML(position, TAINT);
				else if(node.callee.type === "MemberExpression" && node.callee.property.name === "insertAdjacentHTML"){
					let taint_argument = (node.arguments && node.arguments.length > 1)? node.arguments[1]: null;
					
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						CROSS_SITE_SCRIPTING: identifier_names
					}
					var taint_possibility_object = {
						CROSS_SITE_SCRIPTING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), "element.insertAdjacentHTML()", taint_possibility_object, identifiers_object);
				}

				// CASE: [XSS] document.write/writeln(TAINT);
				else if(node.callee.type === "MemberExpression" && node.callee.object.name === "document"  &&
					(node.callee.property.name === "write" || node.callee.property.name === "writeln"))
				{
					let taint_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						CROSS_SITE_SCRIPTING: identifier_names
					}
					var taint_possibility_object = {
						CROSS_SITE_SCRIPTING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), "document."+ node.callee.property.name, taint_possibility_object, identifiers_object);		
				}

				// CASE: [XSS] $/jQuery.parseHTML(TAINT);
				else if(node.callee.type === "MemberExpression" && node.callee.property.name ==="parseHTML" && 
					(node.callee.object.name === "jQuery" || node.callee.object.name === "$"))
				{
					let taint_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						CROSS_SITE_SCRIPTING: identifier_names
					}
					var taint_possibility_object = {
						CROSS_SITE_SCRIPTING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), "$.parseHTML()", taint_possibility_object, identifiers_object);	
				}

				// CASE: [XSS] $(selector).xss_sink_func(TAINT) where xss_sink_func is in XSS_JQ_SINK_FUNCTIONS
				else if(node.callee.type === "MemberExpression" && node.callee.object.type === "CallExpression" && 
					(node.callee.object.callee.name === "jQuery" || node.callee.object.callee.name === "$") &&
					XSS_JQ_SINK_FUNCTIONS.includes(node.callee.property.name)
				){
					let taint_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						CROSS_SITE_SCRIPTING: identifier_names
					}
					var taint_possibility_object = {
						CROSS_SITE_SCRIPTING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), "$(element)." + node.callee.property.name, taint_possibility_object, identifiers_object);	
				}

				// CASE: CacheStorage manipulation  [caches/cache].match(TAINT) [caches/cache].has(TAINT) [caches/cache].open(TAINT) [caches/cache].delete(TAINT)
				else if(node.callee.type === "MemberExpression" && (node.callee.object.name === "caches" || node.callee.object.name === "cache") && (node.callee.property.name ==="match" || 
					node.callee.property.name ==="has" || node.callee.property.name ==="open" || node.callee.property.name ==="delete")
				){
					let taint_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(taint_argument){
						identifier_names = getIdentifierChildren(taint_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						CACHESTORAGE_MANIPULATION: identifier_names
					}
					var taint_possibility_object = {
						CACHESTORAGE_MANIPULATION: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CACHESTORAGE_MANIPULATION], escodgen.generate(node), "caches." + node.callee.property.name, taint_possibility_object, identifiers_object);	
				}

				// CASE: [WR_SELECTOR_QUERY] getElementById(TAINT) getElementsByClassName(TAINT) getElementsByTagName(TAINT) querySelector(TAINT) querySelectorAll(TAINT) jQuery(Taint) $(Taint)
				else if(node.callee.type === "Identifier" && (node.callee.name === "getElementById" || node.callee.name === "getElementsByClassName" || node.callee.name === "getElementsByTagName"
					|| node.callee.name === "querySelector" || node.callee.name === "querySelectorAll" || node.callee.name === "jQuery" || node.callee.name === "$")
				){
					let call_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(call_argument){
						identifier_names = getIdentifierChildren(call_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						WR_SELECTOR_QUERY: identifier_names
					}
					var taint_possibility_object = {
						WR_SELECTOR_QUERY: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WR_SELECTOR_QUERY], escodgen.generate(node), "DOMSelector()", taint_possibility_object, identifiers_object);
				}
				else{
					// walk all child properties (also takes care of arrays)
					walkes.checkProps(node, recurse);
				}
			},

			NewExpression: function(node, recurse){
				if(node.callee.type === "Identifier" && node.callee.name === "WebSocket"){
					let call_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(call_argument){
						identifier_names = getIdentifierChildren(call_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}

					var identifiers_object = {
						WEBSOCKET_URL_POISONING: identifier_names
					}
					var taint_possibility_object = {
						WEBSOCKET_URL_POISONING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WEBSOCKET_URL_POISONING], escodgen.generate(node), "new WebSocket()", taint_possibility_object, identifiers_object);
				} 

				// CASE: [ReDOS] new RegExp(TAINT);
				else if(node.callee.type === "Identifier" && node.callee.name === "RegExp"){
					let call_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;

					var taint_possibility = false;
					var identifier_names = [];
					if(call_argument){
						identifier_names = getIdentifierChildren(call_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}
					var identifiers_object = {
						REDOS_ATTACK: identifier_names
					}
					var taint_possibility_object = {
						REDOS_ATTACK: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [REDOS_ATTACK], escodgen.generate(node), "new RegExp()", taint_possibility_object, identifiers_object);	
				}

				// CASE: [XSS] new Function(TAINT, ..., TAINT)
				else if(node.callee.type === "Identifier" && node.callee.name === "Function"){
					var taint_possibility = false;
					var identifier_names = []
					for(argument of node.arguments){
						identifier_names = identifier_names.concat(getIdentifierChildren(argument));
					}
					if(identifier_names.length> 0){
						taint_possibility = true;
					}

					var identifiers_object = {
						CROSS_SITE_SCRIPTING: identifier_names
					}
					var taint_possibility_object = {
						CROSS_SITE_SCRIPTING: taint_possibility
					}

					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [CROSS_SITE_SCRIPTING], escodgen.generate(node), "new Function()", taint_possibility_object, identifiers_object);
				}
				
				// CASE: EventSource
				else if(node.callee.type === "Identifier" && node.callee.name === "EventSource"){
					let call_argument = (node.arguments && node.arguments.length > 0)? node.arguments[0]: null;
					var taint_possibility = false;
					var identifier_names = [];
					if(call_argument){
						identifier_names = getIdentifierChildren(call_argument);
						if(identifier_names.length > 0){
							taint_possibility = true;
						}
					}
					var identifiers_object = {
						WR_EVENTSOURCE_URL: identifier_names
					}
					var taint_possibility_object = {
						WR_EVENTSOURCE_URL: taint_possibility
					}
					appendSinkOutput(node, node.loc.start.line, node._id, script_id, [WR_EVENTSOURCE_URL], escodgen.generate(node), "new EventSource()", taint_possibility_object, identifiers_object);
				} 

				else{
					// walk all child properties (also takes care of arrays)
					walkes.checkProps(node, recurse);
				}
			},


		}); // END Walkes

	}); // END scope

	return outputs;

}

module.exports = {
	DOMSelectorsSourceSinkAnalyzer: DOMSelectorsSourceSinkAnalyzer,
};
