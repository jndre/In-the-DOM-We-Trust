
import subprocess
import hashlib
import urllib.parse
import os
import time
import re
import sys
import jsbeautifier
import json


import constants as constantsModule
import utils.utility as utilityModule
import hpg_neo4j.query_utility as QU
import hpg_neo4j.db_utility as DU
import analyses.general.data_flow as DF
import analyses.dom_selectors.semantic_types as SemTypeDefinitions

from utils.logging import logger as LOGGER
from neo4j import GraphDatabase
from datetime import datetime


# ----------------------------------------------------------------------- #
#                               Globals
# ----------------------------------------------------------------------- #


DEBUG = False

def _get_return_value_of_function(tx, function_name, cfg_node_id):
    query = """
    MATCH (n {Type: 'ExpressionStatement', Id: '%s'})-[:AST_parentOf*]->(function_name {Type: 'Identifier', Code:'%s'})
    MATCH (function_name)<-[:AST_parentOf {RelationType: 'callee'}]-(callExpr {Type: 'CallExpression'})
    MATCH (callExpr)-[:CG_parentOf {RelationType: 'CallFlow'}]->(function_dec {Type: 'FunctionDeclaration'})-[:AST_parentOf {RelationType: 'body'}]->(block_statement {Type: 'BlockStatement'})-[:AST_parentOf {RelationType: 'body'}]->(return_statement {Type: 'ReturnStatement'})-[:AST_parentOf {RelationType: 'argument'}]->(return_value {Type: 'Identifier'})
    RETURN return_value
    """%(cfg_node_id, function_name)

    results = tx.run(query)

    sink_cfg_node = {'Id': None}
    ce = [None, None, None]

    for element in results:
        tree = QU.getChildsOf(tx, element['return_value'])
        ce = QU.get_code_expression(tree)
        sink_cfg_node = QU.get_ast_topmost(tx, {"Id": "%s"%element['return_value']['Id']})

    return sink_cfg_node, ce[2]

def _return_selector_semantic_type(value):
    if value == 'getElementById':
        return [SemTypeDefinitions.GET_ELEMENT_BY_ID]
    elif value == 'getElementsByClassName':
        return [SemTypeDefinitions.GET_ELEMENTS_BY_CLASS_NAME]
    elif value == 'getElementsByTagName':
        return [SemTypeDefinitions.GET_ELEMENTS_BY_TAG_NAME]
    elif value == 'querySelector' or value == 'querySelectorAll':
        return [SemTypeDefinitions.QUERY_SELECTOR]
    elif value == 'jQuery' or value == '$':
        return [SemTypeDefinitions.JQUERY]
    else:
        return None

def _get_current_timestamp():

    """
    @return {string} current date and time string
    """
    now = datetime.now()
    dt_string = now.strftime("%d/%m/%Y %H:%M:%S")
    return dt_string

def _get_unique_list(lst):

    """
    @param {list} lst
    @return remove duplicates from list and return the resulting array
    """
    return list(set(lst))

def _get_line_of_location(esprima_location_str):

    """
    @param esprima_location_str
    @return start line numnber of esprima location object
    """
    start_index = esprima_location_str.index('line:') + len('line:')
    end_index = esprima_location_str.index(',')
    out = esprima_location_str[start_index:end_index]
    return out

def _get_semantic_types_for_SELECTORS(program_slices, num_slices):

    """
    @param {list} program_slices: slices of JS program
    @param {int} num_slices: length of program_slices list
    @return {list} the semantic types associated with the given program slices.
    """


    semantic_type = SemTypeDefinitions.NON_REACHABLE
    semantic_types = []


    # sources
    WEB_STORAGE_STRINGS = [
        'localStorage',
        'sessionStorage'
    ]

    WIN_LOC_STRINGS = [
        'window.location',
        'win.location',
        'w.location',
        'location.href',
        'location.hash',
        'loc.href',
        'loc.hash',
        'History.getBookmarkedState',
    ]

    WIN_NAME_STRINGS = [
        'window.name',
        'win.name'
    ]

    GET_ELEMENT_BY_ID = [
        'document.getElementById',
        'doc.getElementById',
        '.getElementById',
    ]

    GET_ELEMENTS_BY_CLASS_NAME = [
        'document.getElementsByClassName',
        'doc.getElementsByClassName',
        '.getElementsByClassName',
    ]

    GET_ELEMENTS_BY_TAG_NAME = [
        'document.getElementsByTagName',
        'doc.getElementsByTagName',
        '.getElementsByTagName',
    ]

    QUERY_SELECTOR = [
        'document.querySelector',
        'doc.querySelector',
        '.querySelector',
    ]

    JQUERY = [
        '$(',
        'jQuery('
    ]

    DOM_READ_COOKIE_STRINGS = [
        'document.cookie',
        'doc.cookie',
    ]

    PM_STRINGS = [
        'event.data',
        'evt.data'
    ]

    DOC_REF_STRINGS = [
        'document.referrer',
        'doc.referrer',
        'd.referrer',
    ]


    for i in range(num_slices):
        program_slice = program_slices[i]
        code = program_slice[0]
        idents = program_slice[2]

        for item in WIN_LOC_STRINGS:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_RD_WIN_LOC
                semantic_types.append(semantic_type)


        for item in WIN_NAME_STRINGS:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_RD_WIN_NAME
                semantic_types.append(semantic_type)


        for item in GET_ELEMENT_BY_ID:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_GET_ELEMENT_BY_ID
                semantic_types.append(semantic_type)


        for item in GET_ELEMENTS_BY_CLASS_NAME:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_GET_ELEMENTS_BY_CLASS_NAME
                semantic_types.append(semantic_type)


        for item in GET_ELEMENTS_BY_TAG_NAME:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_GET_ELEMENTS_BY_TAG_NAME
                semantic_types.append(semantic_type)


        for item in QUERY_SELECTOR:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_QUERY_SELECTOR
                semantic_types.append(semantic_type)


        for item in JQUERY:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_JQUERY
                semantic_types.append(semantic_type)


        for item in DOC_REF_STRINGS:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_RD_DOC_REF
                semantic_types.append(semantic_type)


        for item in PM_STRINGS:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_RD_PM
                semantic_types.append(semantic_type)


        for item in WEB_STORAGE_STRINGS:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_RD_WEB_STORAGE
                semantic_types.append(semantic_type)


        for item in DOM_READ_COOKIE_STRINGS:
            if item in code:
                semantic_type = SemTypeDefinitions.SELECTOR_RD_COOKIE
                semantic_types.append(semantic_type)


        for identifier in idents:

            for item in WIN_LOC_STRINGS:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_RD_WIN_LOC
                    semantic_types.append(semantic_type)


            for item in WIN_NAME_STRINGS:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_RD_WIN_NAME
                    semantic_types.append(semantic_type)


            for item in GET_ELEMENT_BY_ID:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_GET_ELEMENT_BY_ID
                    semantic_types.append(semantic_type)


            for item in GET_ELEMENTS_BY_CLASS_NAME:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_GET_ELEMENTS_BY_CLASS_NAME
                    semantic_types.append(semantic_type)


            for item in GET_ELEMENTS_BY_TAG_NAME:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_GET_ELEMENTS_BY_TAG_NAME
                    semantic_types.append(semantic_type)


            for item in QUERY_SELECTOR:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_QUERY_SELECTOR
                    semantic_types.append(semantic_type)


            for item in JQUERY:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_JQUERY
                    semantic_types.append(semantic_type)


            for item in DOC_REF_STRINGS:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_RD_DOC_REF
                    semantic_types.append(semantic_type)


            for item in PM_STRINGS:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_RD_PM
                    semantic_types.append(semantic_type)


            for item in WEB_STORAGE_STRINGS:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_RD_WEB_STORAGE
                    semantic_types.append(semantic_type)


            for item in DOM_READ_COOKIE_STRINGS:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.SELECTOR_RD_COOKIE
                    semantic_types.append(semantic_type)


    if len(semantic_types):
        return list(set(semantic_types))

    return [SemTypeDefinitions.NON_REACHABLE]

def _get_semantic_types(program_slices, num_slices):

    """
    @param {list} program_slices: slices of JS program
    @param {int} num_slices: length of program_slices list
    @return {list} the semantic types associated with the given program slices.
    """


    semantic_type = SemTypeDefinitions.NON_REACHABLE
    semantic_types = []


    # sources
    GET_ELEMENT_BY_ID = [
        'document.getElementById',
        'doc.getElementById',
        '.getElementById',
    ]

    GET_ELEMENTS_BY_CLASS_NAME = [
        'document.getElementsByClassName',
        'doc.getElementsByClassName',
        '.getElementsByClassName',
    ]

    GET_ELEMENTS_BY_TAG_NAME = [
        'document.getElementsByTagName',
        'doc.getElementsByTagName',
        '.getElementsByTagName',
    ]

    QUERY_SELECTOR = [
        'document.querySelector',
        'doc.querySelector',
        '.querySelector',
    ]

    JQUERY = [
        '$(',
        'jQuery('
    ]


    for i in range(num_slices):
        program_slice = program_slices[i]
        code = program_slice[0]
        idents = program_slice[2]

        for item in GET_ELEMENT_BY_ID:
            if item in code:
                semantic_type = SemTypeDefinitions.GET_ELEMENT_BY_ID
                semantic_types.append(semantic_type)


        for item in GET_ELEMENTS_BY_CLASS_NAME:
            if item in code:
                semantic_type = SemTypeDefinitions.GET_ELEMENTS_BY_CLASS_NAME
                semantic_types.append(semantic_type)

        for item in GET_ELEMENTS_BY_TAG_NAME:
            if item in code:
                semantic_type = SemTypeDefinitions.GET_ELEMENTS_BY_TAG_NAME
                semantic_types.append(semantic_type)

        for item in QUERY_SELECTOR:
            if item in code:
                semantic_type = SemTypeDefinitions.QUERY_SELECTOR
                semantic_types.append(semantic_type)

        for item in JQUERY:
            if item in code:
                semantic_type = SemTypeDefinitions.JQUERY
                semantic_types.append(semantic_type)


        for identifier in idents:

            for item in GET_ELEMENT_BY_ID:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.GET_ELEMENT_BY_ID
                    semantic_types.append(semantic_type)


            for item in GET_ELEMENTS_BY_CLASS_NAME:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.GET_ELEMENTS_BY_CLASS_NAME
                    semantic_types.append(semantic_type)


            for item in GET_ELEMENTS_BY_TAG_NAME:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.GET_ELEMENTS_BY_TAG_NAME
                    semantic_types.append(semantic_type)



            for item in QUERY_SELECTOR:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.QUERY_SELECTOR
                    semantic_types.append(semantic_type)



            for item in JQUERY:
                if item in identifier:
                    semantic_type = SemTypeDefinitions.JQUERY
                    semantic_types.append(semantic_type)


    if len(semantic_types):
        return list(set(semantic_types))

    return [SemTypeDefinitions.NON_REACHABLE]





def run_traversals(tx, webpage_url, webpage_directory, webpage_directory_hash='xxx', named_properties=[]):
    """
    @param {string} webpage_url
    @param {string} webpage_directory
    @param {list} named_properties: `id` and `name` attributes in HTML that can be accessed through the `document` API
    @return {list} a list of candidate requests for hjacking
    """


    sinks_file = os.path.join(webpage_directory, "sinks.out.json")
    if not os.path.exists(sinks_file):
        LOGGER.error('[TR] sinks.out file does not exist in %s'%webpage_directory)
        return -1


    fd = open(sinks_file, 'r')
    sinks_json = json.load(fd)
    fd.close()
    sinks_list = sinks_json['sinks']


    storage = {}


    for sink_node in sinks_list:

        JS_file = sink_node['JS_file']

        taintable_sink_identifiers = []

        sink_identifiers_dict = sink_node["possible_taints"]
        sink_taintable_semantic_types = sink_node["semantic_types"]

        for semantic_type in sink_taintable_semantic_types:
            if semantic_type in sink_identifiers_dict:
                for taint in sink_identifiers_dict[semantic_type]:
                    taintable_sink_identifiers.extend(taint['identifiers'].keys())


        sink_id = str(sink_node["id"])
        sink_location = str(sink_node["location"])
        sink_type = sink_node["sink_type"]
        sink_cfg_node = QU.get_ast_topmost(tx, {"Id": "%s"%sink_id})


        nid = sink_type + '__nid=' + sink_id + '__Loc=' + sink_location

        sink_node["taintable_semantic_types"] = sink_taintable_semantic_types
        sink_node["cfg_node_id"] = sink_cfg_node["Id"]
        sink_node["JS_file"] = JS_file

        storage[nid] = {
                "sink": sink_node,
                "variables": {}
        }

        LOGGER.info("exploring dataflows for id: %s"%(sink_id))

        for varname in taintable_sink_identifiers:
            subprocess_output_file = os.path.join(webpage_directory, "subprocess_output.json")

            # Delete the output file if it exists
            if os.path.exists(subprocess_output_file):
                os.remove(subprocess_output_file)

            try:
                result = subprocess.run(["python3", "-m", "analyses.dom_selectors.static_analysis_for_single_sink", str(1), varname, sink_cfg_node["Id"], constantsModule.NEO4J_CONN_STRING, subprocess_output_file], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=2*60, check=True)

            except subprocess.TimeoutExpired as e:
                LOGGER.info("TimeoutError: %s"%(e))
            except subprocess.CalledProcessError as e:
                LOGGER.info("CalledProcessError: %s"%(e))


            try:
                result = subprocess.run(["python3", "-m", "analyses.dom_selectors.static_analysis_for_single_sink", str(2), varname, sink_cfg_node["Id"], constantsModule.NEO4J_CONN_STRING, subprocess_output_file], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=2*60, check=True)

            except subprocess.TimeoutExpired as e:
                LOGGER.info("TimeoutError: %s"%(e))
            except subprocess.CalledProcessError as e:
                LOGGER.info("CalledProcessError: %s"%(e))


            try:
                if os.path.exists(subprocess_output_file):
                    with open(subprocess_output_file, "r", encoding="utf-8") as json_file:
                        slice_values = json.load(json_file)
                else:
                    continue

            except Exception as e:
                LOGGER.info("Error while loading subprocess_output.json")
                continue

            if DEBUG: print(varname, slice_values)

            if "SELECTORS" in sink_node["semantic_types"]:
                semantic_types = _get_semantic_types_for_SELECTORS(slice_values, len(slice_values))
            else:
                semantic_types = _get_semantic_types(slice_values, len(slice_values))

            storage[nid]["variables"][varname]= {
                    "slices": slice_values,
                    "semantic_types": semantic_types
            }

            lst = storage[nid]["sink"]["taintable_semantic_types"]
            lst.extend(semantic_types)
            storage[nid]["sink"]["taintable_semantic_types"] = lst

        for varname in taintable_sink_identifiers:
            selector_semantic_type = _return_selector_semantic_type(varname)
            if selector_semantic_type:
                lst = storage[nid]["sink"]["taintable_semantic_types"]
                lst.extend(selector_semantic_type)
                storage[nid]["sink"]["taintable_semantic_types"] = lst



    print_buffer = []
    json_buffer =  {}

    timestamp = _get_current_timestamp()
    sep = utilityModule.get_output_header_sep()
    sep_sub = utilityModule.get_output_subheader_sep()
    print_buffer.append(sep)
    print_buffer.append('[timestamp] generated on %s\n'%timestamp)
    print_buffer.append(sep+'\n')
    print_buffer.append('[*] webpage URL: %s\n\n'%webpage_url)
    print_buffer.append(sep_sub+'\n')

    json_buffer["url"] = webpage_url
    json_buffer["flows"] = []
    for sink_nid in storage:

        sink_node = storage[sink_nid]["sink"]

        print_buffer.append('[*] webpage: %s\n'%webpage_directory_hash)
        print_buffer.append('[*] JS_file: %s\n'%sink_node["JS_file"])

        semantic_types_for_sink = _get_unique_list(sink_node["taintable_semantic_types"])
        print_buffer.append('[*] semantic_types: {0}\n'.format(semantic_types_for_sink))
        print_buffer.append('[*] node_id: %s\n'%str(sink_node["id"]))
        print_buffer.append('[*] cfg_node_id: %s\n'%str(sink_node["cfg_node_id"]))
        print_buffer.append('[*] loc: %s\n'%sink_node["location"])
        print_buffer.append('[*] sink_type: %s\n'%(sink_node["sink_type"]))
        print_buffer.append('[*] sink_code: %s\n'%sink_node["sink_code"])

        json_flow_object = {
                "webpage": webpage_directory_hash,
                "JS_file": str(sink_node["JS_file"]),
                "semantic_types": semantic_types_for_sink,
                "node_id": str(sink_node["id"]),
                "cfg_node_id": str(sink_node["cfg_node_id"]),
                "loc": sink_node["location"],
                "sink_type": sink_node["sink_type"],
                "sink_code": sink_node["sink_code"],
                "program_slices": {},
        }

        program_slices_dict = storage[sink_nid]["variables"]
        varnames = program_slices_dict.keys()
        counter = 1


        for varname in varnames:

            program_slices =  program_slices_dict[varname]["slices"]
            num_slices = len(program_slices)
            varname_semantic_types = program_slices_dict[varname]["semantic_types"]

            idx = 0
            for i in range(num_slices):
                idx +=1
                program_slice = program_slices[i]
                loc = _get_line_of_location(program_slice[3])
                code = program_slice[0]

                if program_slice[4]:
                    curr_slice_id = program_slice[4]
                else:
                    curr_slice_id = None

                if 'function(' in code:
                    code = jsbeautifier.beautify(code) # pretty print function calls


                current_slice = {
                        "index": str(idx),
                        "id": curr_slice_id,
                        "loc": loc,
                        "code": code,
                }

                if i == 0 and varname in code:

                    a = '\n%d:%s variable=%s\n'%(counter, str(varname_semantic_types), varname)
                    counter += 1
                    b = """\t%s (loc:%s)- %s\n"""%(str(idx), loc,code)
                    print_buffer+= [a, b]

                    if varname not in json_flow_object["program_slices"]:
                        json_flow_object["program_slices"][varname] = {
                                "semantic_types": varname_semantic_types,
                                "slices": [current_slice],
                        }
                    else:
                        json_flow_object["program_slices"][varname]["slices"].append(current_slice)

                else:
                    a = """\t%s (loc:%s)- %s\n"""%(str(idx), loc,code)
                    print_buffer += [a]

                    if varname not in json_flow_object["program_slices"]:
                        json_flow_object["program_slices"][varname] = {
                                "semantic_types": varname_semantic_types,
                                "slices": [current_slice],
                        }
                    else:
                        json_flow_object["program_slices"][varname]["slices"].append(current_slice)

        json_buffer["flows"].append(json_flow_object)
        print_buffer.append('\n\n')
        print_buffer.append(sep_sub)

    try:
        output_file = os.path.join(webpage_directory, "sinks.flows.out")
        with open(output_file, "w+", encoding="utf-8") as fd:
            for line in print_buffer:
                fd.write(line)
    except Exception as e:
        LOGGER.error("error while writing to sinks.flows.out: %s"%(e))


    try:
        output_file_json = os.path.join(webpage_directory, "sinks.flows.out.json")
        with open(output_file_json, "w+", encoding='utf8') as fd:
            json.dump(json_buffer, fd, ensure_ascii=False, indent=4)
    except Exception as e:
        LOGGER.error("error while writing to sinks.flows.out.json: %s"%(e))

    LOGGER.info('[TR] finished running the queries.')
