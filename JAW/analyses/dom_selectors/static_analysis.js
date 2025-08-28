
/**
 * ------------------------------------------------
 *   			third-party imports
 * ------------------------------------------------
**/
const fs = require('fs');
const pathModule = require('path');
const crypto = require('crypto');
const argv = require("process.argv");
const elapsed = require("elapsed-time-logger");

/**
 * ------------------------------------------------
 *   				module imports
 * ------------------------------------------------
**/
const constantsModule = require('./../../engine/lib/jaw/constants');
const globalsModule = require('./globals.js');
const SourceSinkAnalyzerModule = require('./traversals.js');
const SourceSinkAnalyzer = SourceSinkAnalyzerModule.DOMSelectorsSourceSinkAnalyzer;


const GraphExporter = require('./../../engine/core/io/graphexporter');

/**
 * ------------------------------------------------
 *  			constants and globals
 * ------------------------------------------------
**/

// directory where the data of the crawling will be saved
const BASE_DIR = pathModule.resolve(__dirname, '../..');
const dataStorageDirectory = pathModule.join(BASE_DIR, 'data');


// when true, nodejs will log the current step for each webpage to the console 
const DEBUG = true; 		

const do_ast_preprocessing_passes = false;
var do_compress_graphs = true;
var overwrite_hpg = false;
/**
 * ------------------------------------------------
 *  			utility functions
 * ------------------------------------------------
**/


/** 
 * @function readFile 
 * @param file_path_name: absolute path of a file.
 * @return the text content of the given file if it exists, otherwise -1.
**/
function readFile(file_path_name){
	try {
		const data = fs.readFileSync(file_path_name, 'utf8')
		return data;
	} catch (err) {
		return -1;
	}
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
 * @function hashURL 
 * @param url: string
 * @return returns the SHA256 hash of the given input in hexa-decimal format
**/
function hashURL(url){
	const hash = crypto.createHash('sha256').update(url, 'utf8').digest('hex');
	return hash;
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



/** 
 * @function isLibraryScript 
 * @param {string} script: script src (when `mode: src`) or script content (when `mode: content`)
 * @param {string} options: determines the type of the `script` param (format `{mode: type}` with types being `src` or `content`)
 * @return {boolean} whether or not the input is a library script
**/
function isLibraryScript(script, options){

	let return_flag = false;

	if(options.mode === 'src'){

		let script_src = script.toLowerCase();
		for(let h of globalsModule.lib_src_heuristics){
			if(script_src.includes(h)){ // check script src
				return_flag = true;
				break;
			}
		}

	}else{ // [options.mode === 'content']

		let script_content = script.toLowerCase();
		for(let h of globalsModule.lib_content_heuristics){
			if(script_content.includes(h)){ // check script content
				return_flag = true;
				break;
			}
		}
	}

	return return_flag;
}

/**
 * ------------------------------------------------
 *  		Main Static Analysis Thread
 * ------------------------------------------------
**/


async function staticallyAnalyzeWebpage(url, webpageFolder, result_folder){

	if (!fs.existsSync(result_folder)) {
		fs.mkdirSync(result_folder, { recursive: true });
	}

	let results_timing_file = pathModule.join(result_folder, "time.static_analysis.out");
	if(!overwrite_hpg && fs.existsSync(results_timing_file)){
		DEBUG && console.log('[skipping] results already exists for: '+ result_folder)

		return 1;
	}

	// read the crawled scripts from disk
	let scripts = [];
	var sourcemaps = {};
	let dirContent = fs.readdirSync( webpageFolder );


	let scripts_mapping = {};
	let scripts_mapping_content = await readFile(pathModule.join(webpageFolder, 'scripts_mapping.json'));
	if(scripts_mapping_content != -1){
		try{
			scripts_mapping = JSON.parse(scripts_mapping_content);
		}
		catch{
		}
	}
	

	var library_scripts = [];
	let scriptFiles = dirContent.filter(function( elm ) {return elm.match(/.*\.(js$)/ig);});
	for(let i=0; i<scriptFiles.length; i++){
		
		let script_short_name = '' + i + '.js';
		let script_full_name = pathModule.join(webpageFolder, script_short_name);
		let source_map_name = pathModule.join(webpageFolder, script_short_name + '.map');
		
		if(script_short_name in scripts_mapping){

			let script_object = scripts_mapping[script_short_name];
			if(script_object['type'] === 'external'){
				let is_library = isLibraryScript(script_object['src'], {mode: 'src'});
				
				if(is_library){
					library_scripts.push(script_short_name);
					continue;
				}
			}
		}


		let script_content = await readFile(script_full_name);
		if(script_content != -1){

			let is_library = isLibraryScript(script_content, {mode: 'content'});
			if(is_library){
				
				library_scripts.push(script_short_name);
				continue;
			}
			scripts.push({
				scriptId: i,
				source: script_content,
				name: script_full_name,
			})
		}

		let sourcemap_content = await readFile(source_map_name);
		if(sourcemap_content != -1){
			sourcemaps[script_short_name] = JSON.parse(sourcemap_content);
		}
	}

	let library_scripts_path_name = pathModule.join(result_folder, 'library_scripts.json');
	fs.writeFileSync(library_scripts_path_name, JSON.stringify(library_scripts));
	
	/*
	*  ----------------------------------------------
	*  [START] 
	*  ----------------------------------------------
	*  0: building the static model
	*  1: querying the model to find the sources 
	*/

	/** 
	* 0: Building the static model
	*/
	const totalTimer = elapsed.start('total_static_timer');
	const hpgConstructionTimer = elapsed.start('hpg_construction_timer');
	DEBUG && console.log('[StaticAnalysis] started static model construction.');
	let SourceSinkAnalyzerInstance = new SourceSinkAnalyzer();

	DEBUG && console.log('[StaticAnalysis] AST parsing.');
	


	let scriptsCode = '';
	let parsingErrors = [];
	for(let [idx, script] of scripts.entries()){
		let scriptName = script.name; // '' + idx + '.js';
		let parsingError = await SourceSinkAnalyzerInstance.api.initializeModelsFromSource(scriptName, script.source, constantsModule.LANG.js, do_ast_preprocessing_passes)
		if(parsingError && parsingError === scriptName){
			parsingErrors.push(parsingError);
		}
		scriptsCode = scriptsCode + script.source + '\n\n';
	}

	DEBUG && console.log('[StaticAnalysis] HPG construction.');
	let timeoutPDG = await SourceSinkAnalyzerInstance.api.buildInitializedModels();
	DEBUG && console.log('[StaticAnalysis] AST/CFG/PDG done.')

	const basicHpgConstructionTime = hpgConstructionTimer.get(); // AST, CFG, PDG
	hpgConstructionTimer.end();



	const CsvHpgConstructionTimer = elapsed.start('csv_hpg_construction_timer');
	DEBUG && console.log('[StaticAnalysis] constructing IPCG/ERDDG/SemTypes.')
	const graph = await SourceSinkAnalyzerInstance.api.buildHPG({ 'ipcg': true, 'erddg': true }); // IPCG, ERDDG + SemanticTypes + node/edge format
	const graphid = hashURL(url);
	DEBUG && console.log('[StaticAnalysis] finished constructing IPCG/ERDDG/SemTypes.');

	DEBUG && console.log('[StaticAnalysis] started mapping foxhound edges and semantic types.');
	// read taintflows, script_mapping and sourcemap files
	var taintflows = readFile(pathModule.join(webpageFolder, 'taintflows.json'));

	if(taintflows === -1){
		taintflows = false;
	}else{
		try{
			taintflows = JSON.parse(taintflows);
		}
		catch{
			taintflows = false;
		}
	}
	const foxhound_data = await SourceSinkAnalyzerInstance.api.getDynamicFoxhoundEdgesAndSemTypes(taintflows, scripts_mapping, sourcemaps);
	DEBUG && console.log('[StaticAnalysis] finished mapping foxhound edges and semantic types.')


	DEBUG && console.log('[StaticAnalysis] started HPG export to CSV.');
	GraphExporter.exportToCSVDynamic(graph, foxhound_data, graphid, result_folder);
	DEBUG && console.log('[StaticAnalysis] finished HPG export to CSV.');
	

	const pdgMarker =  pathModule.join(result_folder, "pdg.tmp");
	await fs.writeFileSync(pdgMarker, JSON.stringify({"pdg": timeoutPDG? 1: 0}));


	const CsvHpgConstructionTime = CsvHpgConstructionTimer.get();
	CsvHpgConstructionTimer.end();


	if(do_compress_graphs){
		DEBUG && console.log('[StaticAnalysis] started compressing HPG.')
		GraphExporter.compressGraph(result_folder);
		DEBUG && console.log('[StaticAnalysis] finished compressing HPG.')
	}

	const totalTime = totalTimer.get();
	totalTimer.end();



	// store elapsed time to disk
	fs.writeFileSync(pathModule.join(result_folder, "time.static_analysis.out"), JSON.stringify({
		"total_static_timer": totalTime,
		"csv_hpg_construction_timer": CsvHpgConstructionTime,
		"in_memory_hpg_construction_timer": basicHpgConstructionTime,
	}));



}


/*
* entry point of exec
*/
(async function(){

    var processArgv = argv(process.argv.slice(2));
    var config = processArgv({}) || {};
    const seedurl = config.seedurl;
    const single_folder = config.singlefolder;
    const result_folder = config.resultfolder;
    
    overwrite_hpg = (config.overwritehpg && config.overwritehpg.toLowerCase() === 'true')? true: false; 
    do_compress_graphs = (config.compresshpg && config.compresshpg.toLowerCase() === 'false')? false: true; 
  
	if(single_folder && single_folder.length > 10){

		if(fs.existsSync(single_folder)){
				var urlContent = readFile(pathModule.join(single_folder, "url.out"));
				if(urlContent != -1){
					var webpageUrl = urlContent.trim();
					await staticallyAnalyzeWebpage(webpageUrl, single_folder, result_folder);				
				}
		}else{
			console.log('[Warning] the following directory does not exists, but was marked for static analysis: '+ webpageFolder +'\n url is: '+ webpageUrl);
		}	

	}else{

	    const dataDirectory = getOrCreateDataDirectoryForWebsite(seedurl);
		const urlsFile = pathModule.join(dataDirectory, "urls.out");
		const urlsFileContent = readFile(urlsFile);

		if(urlsFileContent != -1){
			
			const globalTimer = elapsed.start('global_static_timer');
			
			const urls = new Set(urlsFileContent.split("\n")); 

			for(let webpageUrl of urls.values()){
				
				if(webpageUrl.trim().length > 1 ){ 
					let _hash = hashURL(webpageUrl);
					let webpageFolder = pathModule.join(dataDirectory, _hash);
					if(fs.existsSync(webpageFolder)){
							await staticallyAnalyzeWebpage(webpageUrl, webpageFolder, result_folder);		

					}else{
						console.log('[Warning] the following directory does not exists, but was marked for static analysis: '+ webpageFolder +'\n url is: '+ webpageUrl);
					}			
				}	
			}

			const globalTime = globalTimer.get();
			globalTimer.end();
			fs.writeFileSync(pathModule.join(dataDirectory, "time.static_analysis.out"), JSON.stringify({
				"total_static_timer": globalTime,
			}));

		}
		else{
			console.log('[Warning] urls.out is empty for website: '+ seedurl +', thus exiting static-analysis pass.')
		}
	}

})();






