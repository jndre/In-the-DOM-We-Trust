

import os, sys, json
import utils.io as IOModule
import constants as constantsModule
import utils.utility as utilityModule
from utils.logging import logger as LOGGER



def start_model_construction(website_folder_name='', website_url='', memory=None, timeout=None, compress_hpg='true', overwrite_hpg='false', specific_webpage=None, top_hashes_list=None):

    # setup defaults
    if memory is None:
        static_analysis_memory = '32000'
    else:
        static_analysis_memory = memory

    if timeout is None:
        static_analysis_per_webpage_timeout = 600 # seconds
    else:
        static_analysis_per_webpage_timeout = timeout


    dom_selectors_analyses_command_cwd = os.path.join(constantsModule.BASE_DIR, "analyses/dom_selectors")
    dom_selectors_static_analysis_driver_program = os.path.join(dom_selectors_analyses_command_cwd, "static_analysis.js")

    dom_selectors_static_analysis_command = "node --max-old-space-size=%s DRIVER_ENTRY --singlefolder=SINGLE_FOLDER --resultfolder=RESULT_FOLDER --compresshpg=%s --overwritehpg=%s"%(static_analysis_memory, compress_hpg, overwrite_hpg)
    dom_selectors_static_analysis_command = dom_selectors_static_analysis_command.replace("DRIVER_ENTRY", dom_selectors_static_analysis_driver_program)

    if website_url:
        website_folder_name = utilityModule.getDirectoryNameFromURL(website_url)

    website_folder = os.path.join(constantsModule.DATA_DIR, website_folder_name)
    result_website_folder = os.path.join(constantsModule.RESULT_DIR, website_folder_name)

    webpages_json_file = os.path.join(website_folder, 'webpages.json')
    urls_file = os.path.join(website_folder, 'urls.out')

    if top_hashes_list is not None:
        for webpage in top_hashes_list:
            webpage_folder = os.path.join(website_folder, webpage)
            result_webpage_folder = os.path.join(result_website_folder, webpage)
            if os.path.exists(webpage_folder):
                node_command= dom_selectors_static_analysis_command.replace('SINGLE_FOLDER', webpage_folder)
                node_command= node_command.replace('RESULT_FOLDER', result_webpage_folder)
                IOModule.run_os_command(node_command, cwd=dom_selectors_analyses_command_cwd, timeout=static_analysis_per_webpage_timeout, print_stdout=True, log_command=True)

    elif specific_webpage is not None:
        webpage_folder = os.path.join(constantsModule.DATA_DIR, specific_webpage)
        result_webpage_folder = os.path.join(result_website_folder, webpage)
        if os.path.exists(webpage_folder):
            node_command= dom_selectors_static_analysis_command.replace('SINGLE_FOLDER', webpage_folder)
            node_command= node_command.replace('RESULT_FOLDER', result_webpage_folder)
            IOModule.run_os_command(node_command, cwd=dom_selectors_analyses_command_cwd, timeout=static_analysis_per_webpage_timeout, print_stdout=True, log_command=True)

    elif os.path.exists(webpages_json_file):

        fd = open(webpages_json_file, 'r')
        webpages = json.load(fd)
        fd.close()

        for webpage in webpages:
            webpage_folder = os.path.join(website_folder, webpage)
            result_webpage_folder = os.path.join(result_website_folder, webpage)
            if os.path.exists(webpage_folder):

                node_command= dom_selectors_static_analysis_command.replace('SINGLE_FOLDER', webpage_folder)
                node_command= node_command.replace('RESULT_FOLDER', result_webpage_folder)
                IOModule.run_os_command(node_command, cwd=dom_selectors_analyses_command_cwd, timeout=static_analysis_per_webpage_timeout, print_stdout=True, log_command=True)



    elif os.path.exists(urls_file):
        message = 'webpages.json file does not exist, falling back to urls.out'
        LOGGER.warning(message)

        # read the urls from the webpage data
        with open(urls_file, 'r', encoding='utf-8') as fd:
            urls = fd.readlines()

        # make sure that the list of urls is unique
        # this would eliminate the cases where the crawler is executed multiple times for the same site
        # without deleting the data of the old crawl and thus adds duplicate urls to urls.out file.
        urls = list(set(urls))

        for url in urls:
            url = url.strip().rstrip('\n').strip()
            webpage_folder_name = utilityModule.sha256(url)
            webpage_folder = os.path.join(website_folder, webpage_folder_name)
            if os.path.exists(webpage_folder):
                node_command= dom_selectors_static_analysis_command.replace('SINGLE_FOLDER', webpage_folder)
                IOModule.run_os_command(node_command, cwd=dom_selectors_analyses_command_cwd, timeout=static_analysis_per_webpage_timeout, print_stdout=True, log_command=True)

    else:
        message = 'no webpages.json or urls.out file exists in the webapp directory; skipping analysis...'
        LOGGER.warning(message)
