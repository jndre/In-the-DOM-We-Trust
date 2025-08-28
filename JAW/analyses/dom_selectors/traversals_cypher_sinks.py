import os
import hpg_neo4j.query_utility as QU
import json
from utils.logging import logger as LOGGER
import constants as constantsModule


final_output = {"url": "", "sinks": []}
program_node_IDs = []
program_node_Values = []


def getAllProgramIDs(tx):
    query = """
    MATCH (programNode {Type: 'Program'})
    RETURN programNode
    """
    results = tx.run(query)

    for element in results:
        program_node_IDs.append(element['programNode']['Id'])
        program_node_Values.append(element['programNode']['Value'])



def return_js_file_path(node_id):
    for index, program_id in enumerate(program_node_IDs):
        if program_id > node_id:
            return program_node_Values[index - 1]
    return None


def getWindowOpenCallExpressions(tx):
    # window.open(url)
    query="""
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]-> (n1 {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'property'}]->(req {Type: 'Identifier', Code: 'open'}),
    (n1)-[:AST_parentOf {RelationType: 'object'}]->(callee),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a)
    WHERE callee.Code= 'window'
    RETURN n, a
    """

    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "window.open"
        semantic_types = ["OPEN_REDIRECT", "CSRF"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"OPEN_REDIRECT": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getWindowOrDocumentLocationCallExpressions(tx):

    # window/document.location = TAINT;
    query = """
    MATCH (n {Type: 'AssignmentExpression'})-[:AST_parentOf {RelationType: 'left'}]-> (n1 {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'property'}]->(loc {Type: 'Identifier', Code: 'location'}),
    (n1)-[:AST_parentOf {RelationType: 'object'}]->(callee),
    (n)-[:AST_parentOf {RelationType: 'right'}]->(a)
    WHERE callee.Code= 'window' OR callee.Code= 'document'
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "window/document.location"
        semantic_types = ["OPEN_REDIRECT"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"OPEN_REDIRECT": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


    # window/document.location.(assign/replace)(TAINT);
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]-> (n1 {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'object'}]-> (n2 {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'property'}]->(loc {Type: 'Identifier', Code: 'location'}),
    (n2)-[:AST_parentOf {RelationType: 'object'}]->(callee),
    (n1)-[:AST_parentOf {RelationType: 'property'}]->(callee2),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a)
    WHERE (callee.Code= 'window' OR callee.Code= 'document') AND (callee2.Code= 'assign' OR callee2.Code= 'replace')
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "window/document.location.(assign/replace)"
        semantic_types = ["OPEN_REDIRECT"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"OPEN_REDIRECT": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


    # window/document.location.(href/search/hash/port/pathname/protocol) = TAINT;
    query = """
    MATCH (n {Type: 'AssignmentExpression'})-[:AST_parentOf {RelationType: 'left'}]-> (n1 {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'object'}]->(n2 {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'property'}]-> (loc {Type: 'Identifier', Code: 'location'}),
    (n1)-[:AST_parentOf {RelationType: 'property'}]->(prop),
    (n2)-[:AST_parentOf {RelationType: 'object'}]->(obj),
    (n)-[:AST_parentOf {RelationType: 'right'}]->(a)
    WHERE (obj.Code= 'window' OR obj.Code= 'document') AND (prop.Code= 'href' OR prop.Code= 'search' OR prop.Code= 'hash' OR prop.Code= 'port' OR prop.Code= 'pathname' OR prop.Code= 'protocol')
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "window/document.location.(href/search/hash/port/pathname/protocol)"
        semantic_types = ["OPEN_REDIRECT"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"OPEN_REDIRECT": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)

    # location.(href/search/hash/port/pathname/protocol) = TAINT;
    query = """
    MATCH (n {Type: 'AssignmentExpression'})-[:AST_parentOf {RelationType: 'left'}]->(left {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'object'}]->(obj {Type: 'Identifier'}),
    (n)-[:AST_parentOf {RelationType: 'right'}]->(a),
    (left)-[:AST_parentOf {RelationType: 'property'}]->(property)
    WHERE obj.Code IN ['location'] AND property.Code IN ['href', 'search', 'hash', 'port', 'pathname', 'protocol']
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "location.(href/search/hash/port/pathname/protocol)"
        semantic_types = ["OPEN_REDIRECT"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"OPEN_REDIRECT": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getWebSocketCallExpressions(tx):

    # new WebSocket(TAINT, protocols);
    query = """
    MATCH (n {Type: 'NewExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(wbsckt {Type: 'Identifier', Code: 'WebSocket'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a)
    RETURN n, a
    """
    results = tx.run(query)
    output = []

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "new WebSocket"
        semantic_types = ["WEBSOCKET_URL_POISONING"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"WEBSOCKET_URL_POISONING": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getLinkManipulationExpressions(tx):

    # someElement.src/href = TAINT;
    query = """
    MATCH (n {Type: 'AssignmentExpression'})-[:AST_parentOf {RelationType: 'left'}]->(left {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'object'}]->(object {Type: 'Identifier'}),
    (left)-[:AST_parentOf {RelationType: 'property'}]->(prop {Type: 'Identifier'}),
    (n)-[:AST_parentOf {RelationType: 'right'}]->(a)
    WHERE prop.Code IN ['src', 'href']
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "someElement.src/href"
        semantic_types = ["LINK_MANIPULATION"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"LINK_MANIPULATION": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)

    # someElement.setAttribute('src', TAINT)
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'MemberExpression'}),
    (callee)-[:AST_parentOf {RelationType: 'property'}]->(property {Type: 'Identifier', Code: 'setAttribute'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(arg1),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":1}'}]->(a)
    WHERE arg1.Value= 'href' OR arg1.Value= 'src'
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "someElement.setAttribute"
        semantic_types = ["LINK_MANIPULATION"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"LINK_MANIPULATION": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getCookieManipulationExpressions(tx):
    # document.cookie = TAINT;
    query = """
    MATCH (n {Type: 'AssignmentExpression'})-[:AST_parentOf {RelationType: 'left'}]-> (n1 {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'property'}]->(loc {Type: 'Identifier', Code: 'cookie'}),
    (n1)-[:AST_parentOf {RelationType: 'object'}]->(callee {Type: 'Identifier', Code: 'document'}),
    (n)-[:AST_parentOf {RelationType: 'right'}]->(a)
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "document.cookie"
        semantic_types = ["COOKIE_MANIPULATION"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"COOKIE_MANIPULATION": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getWebStorageManipulationExpressions(tx):
    # localStorage.setItem(X, TAINT);	.getItem(TAINT); .removeItem(Taint);
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'object'}]->(object {Type: 'Identifier'}),
    (callee)-[:AST_parentOf {RelationType: 'property'}]->(property),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a)
    WHERE (property.Code= 'setItem' OR property.Code= 'getItem' OR property.Code= 'removeItem') AND (object.Code= 'localStorage' OR object.Code= 'sessionStorage')
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "localStorage.setItem/getItem/removeItem"
        semantic_types = ["WEBSTORAGE_MANIPULATION"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"WEBSTORAGE_MANIPULATION": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getJsonInjectionExpressions(tx):
    # JSON.parse(TAINT);
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(n1 {Type: 'MemberExpression'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a),
    (n1)-[:AST_parentOf {RelationType: 'object'}]->(object),
    (n1)-[:AST_parentOf {RelationType: 'property'}]->(property)
    WHERE object.Code= 'JSON' AND property.Code= 'parse'
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "JSON.parse"
        semantic_types = ["JSON_INJECTION"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"JSON_INJECTION": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)



def getXMLHttpRequestExpressions(tx):
    # XMLHttpRequest.open/setRequestHeader(method, url=TAINT);    .send(Taintable_data);
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(n1 {Type: 'MemberExpression'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(arg0),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":1}'}]->(arg1),
    (n1)-[:AST_parentOf {RelationType: 'object'}]->(object),
    (n1)-[:AST_parentOf {RelationType: 'property'}]->(property)
    WHERE (property.Code= 'open' OR property.Code= 'setRequestHeader' OR property.Code= 'send')
    RETURN n, object, CASE
        WHEN property.Code IN ['open', 'setRequestHeader'] THEN arg1
        ELSE arg0
        END AS a;
    """
    results = tx.run(query)

    for element in results:
        should_continue = True
        if element['object']['Code'] not in ['XMLHttpRequest', 'xhr', 'XHR']:
            sink_id = str(element['object']['Id'])
            sink_cfg_node = QU.get_ast_topmost(tx, {"Id": "%s"%sink_id})

            query = """
            MATCH (n_s {Id: '%s'})<-[:PDG_parentOf { Arguments: '%s' }]-(n_t),
            (n_t)-[:AST_parentOf*1..5]->(definition {Type: 'Identifier', Code: 'XMLHttpRequest'})
            RETURN definition
            """%(sink_cfg_node['Id'], element['object']['Code'])

            inner_result = tx.run(query)
            for item in inner_result:
                if item['definition']:
                    should_continue = False
                    continue

        else:
            should_continue = False

        if should_continue:
            continue

        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "XMLHttpRequest.open/setRequestHeader"
        semantic_types = ["CSRF"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"CSRF": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)



def getFetchExpressions(tx):
    # fetch(url=TAINT, {});
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'Identifier', Code: 'fetch'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(arg1 {Type: 'AssignmentExpression'})-[:AST_parentOf {RelationType: 'right'}]->(a),
    (arg1)-[:AST_parentOf {RelationType: 'left'}]->(left)
    WHERE left.Code= 'url'
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "fetch"
        semantic_types = ["CSRF"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"CSRF": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)

    # fetch(TAINT, {});
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'Identifier', Code: 'fetch'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a)
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "fetch"
        semantic_types = ["CSRF"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"CSRF": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getInnerOuterHTMLExpressions(tx):
    # someElement.innerHTML = TAINT
    # someElement.outerHTML = TAINT
    query = """
    MATCH (n {Type: 'AssignmentExpression'})-[:AST_parentOf {RelationType: 'left'}]->(left {Type: 'MemberExpression'}),
    (left)-[:AST_parentOf {RelationType: 'property'}]->(property {Type: 'Identifier'}),
    (n)-[:AST_parentOf {RelationType: 'right'}]->(a)
    WHERE (property.Code= 'innerHTML' OR property.Code= 'outerHTML')
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "innerHTML/outerHTML"
        semantic_types = ["XSS"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"XSS": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getinsertAdjacentHTMLExpressions(tx):
    # someElement.insertAdjacentHTML(position, TAINT);
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'MemberExpression'}),
    (callee)-[:AST_parentOf {RelationType: 'property'}]->(property {Type: 'Identifier', Code: 'insertAdjacentHTML'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":1}'}]->(a)
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "insertAdjacentHTML"
        semantic_types = ["XSS"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"XSS": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getEvalExpressions(tx):
    # eval(TAINT)
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'Identifier', Code: 'eval'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a)
    RETURN n, a
    """
    results = tx.run(query)
    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "eval"
        semantic_types = ["XSS"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"XSS": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)

def getDocumentWriteExpressions(tx):
    # document.write(TAINT)
    # document.writeln(TAINT)
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(n1 {Type: 'MemberExpression'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a),
    (n1)-[:AST_parentOf {RelationType: 'object'}]->(object),
    (n1)-[:AST_parentOf {RelationType: 'property'}]->(property)
    WHERE object.Code= 'document' AND (property.Code= 'write' OR property.Code= 'writeln')
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "document.write/writeln"
        semantic_types = ["XSS"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"XSS": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)



def getJQueryAPIExpressions(tx):
    # $(selector).html(TAINT);

    # $(selector).append(TAINT);
    # $(selector).appendTo(TAINT);
    # $(selector).prepend(TAINT);
    # $(selector).prependTo(TAINT);
    # $(selector).add(TAINT);
    # $(selector).insertAfter(TAINT);
    # $(selector).insertBefore(TAINT);

    # $(selector).after(TAINT);
    # $(selector).before(TAINT);

    # $(selector).wrap(TAINT);
    # $(selector).wrapInner(TAINT);
    # $(selector).wrapAll(TAINT);

    # $(selector).replaceAll(TAINT);
    # $(selector).replaceWith(TAINT);

    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(n1 {Type: 'MemberExpression'})-[:AST_parentOf {RelationType: 'object'}]->(n2 {Type: 'CallExpression'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a),
    (n2)-[:AST_parentOf {RelationType: 'callee'}]->(callee),
    (n1)-[:AST_parentOf {RelationType: 'property'}]->(property)
    WHERE (callee.Code= '$' OR callee.Code= 'jQuery') AND (property.Code IN ['html', 'append', 'appendTo', 'prepend', 'prependTo', 'add', 'insertAfter', 'insertBefore', 'after', 'before', 'wrap', 'wrapInner', 'wrapAll', 'replaceAll', 'replaceWith'])
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "$(selector).ManipulateDOM"
        semantic_types = ["XSS"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"XSS": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getEventSourceExpressions(tx):
    # new EventSource(TAINT, config)    new WebTransport(TAINT);
    query = """
    MATCH (n {Type: 'NewExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'Identifier'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a)
    WHERE (callee.Code= 'EventSource' OR callee.Code= 'WebTransport')
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "new EventSource"
        semantic_types = ["SSE_HIJACK"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"SSE_HIJACK": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)



def getGetElementByExpressions(tx):
    # document.getElementById(TAINT)
    # document.getElementsByClassName(TAINT)
    # document.getElementsByTagName(TAINT)
    # document.querySelector(TAINT)
    # document.querySelectorAll(TAINT)
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(n1 {Type: 'MemberExpression'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a),
    (n1)-[:AST_parentOf {RelationType: 'object'}]->(object),
    (n1)-[:AST_parentOf {RelationType: 'property'}]->(property)
    WHERE object.Code= 'document' AND (property.Code= 'getElementById' OR property.Code= 'getElementsByClassName' OR property.Code= 'getElementsByTagName' OR property.Code= 'querySelector' OR property.Code= 'querySelectorAll')
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "getElementBy/querySelector"
        semantic_types = ["SELECTORS"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"SELECTORS": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)

def getJQueryExpressions(tx):

    # jQuery(Taint)
    # $(Taint)
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'Identifier'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a)
    WHERE callee.Code= 'jQuery' OR callee.Code= '$'
    RETURN n, a
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "jQuery_Selector"
        semantic_types = ["SELECTORS"]

        tree = QU.getChildsOf(tx, element['a'])
        ce = QU.get_code_expression(tree)
        possible_taints = {"SELECTORS": [{'id': element['a']['Id'], 'code': ce[0], 'identifiers': ce[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def getSendBeaconExpressions(tx):

    # sendBeacon(url, data);
    query = """
    MATCH (n {Type: 'CallExpression'})-[:AST_parentOf {RelationType: 'callee'}]->(callee {Type: 'Identifier'}),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":0}'}]->(a1),
    (n)-[:AST_parentOf {RelationType: 'arguments', Arguments: '{\"arg\":1}'}]->(a2)
    WHERE callee.Code= 'sendBeacon'
    RETURN n, a1, a2
    """
    results = tx.run(query)

    for element in results:
        tree = QU.getChildsOf(tx, element['n'])
        ce = QU.get_code_expression(tree)

        node_id = element['n']['Id']
        node_range = element['n']['Range']
        location = element['n']['Location']
        sink_code = ce[0]
        sink_type = "sendBeacon"
        semantic_types = ["BEACON_MANIPULATION"]

        tree1 = QU.getChildsOf(tx, element['a1'])
        ce1 = QU.get_code_expression(tree1)
        tree2 = QU.getChildsOf(tx, element['a2'])
        ce2 = QU.get_code_expression(tree2)
        possible_taints = {"BEACON_MANIPULATION": [{'id': element['a1']['Id'], 'code': ce1[0], 'identifiers': ce1[2]},
                                                    {'id': element['a2']['Id'], 'code': ce2[0], 'identifiers': ce2[2]}]}

        JS_file = return_js_file_path(node_id)

        prepare_sink_output_format(node_id, node_range, location, JS_file, sink_code, sink_type, semantic_types, possible_taints)


def prepare_sink_output_format(node_id=None, node_range=None, location=None, JS_file=None, sink_code=None, sink_type=None, semantic_types=None, possible_taints=None):
    final_output["sinks"].append({
        "id": node_id,
        "range": node_range,
        "location": location,
        "JS_file": JS_file,
        "sink_code": sink_code,
        "sink_type": sink_type,
        "semantic_types": semantic_types,
        "possible_taints": possible_taints
    })

def caller_function(tx, func):
    try:
        func(tx)
    except Exception as e:
        LOGGER.info("error while executing function %s. error: %s"%(func, e))

def run_traversals(tx, webpage_url, webpage_directory, webpage_directory_hash='xxx', named_properties=[]):
    """
    @param {string} webpage_url
    @param {string} webpage_directory
    @param {list} named_properties: `id` and `name` attributes in HTML that can be accessed through the `document` API
    @return {list} a list of candidate requests for hjacking
    """
    global program_node_IDs, program_node_Values, final_output

    program_node_IDs = []
    program_node_Values = []
    final_output["url"] = webpage_url
    final_output["sinks"] = []

    getAllProgramIDs(tx)

    sinks_file = os.path.join(webpage_directory, "sinks.out.json")
    if os.path.exists(sinks_file):
        LOGGER.error('sinks.out.json already exist in %s'%webpage_directory)
        return -1


    caller_function(tx, getWindowOpenCallExpressions)
    caller_function(tx, getWindowOrDocumentLocationCallExpressions)
    caller_function(tx, getWebSocketCallExpressions)
    caller_function(tx, getLinkManipulationExpressions)
    caller_function(tx, getCookieManipulationExpressions)
    caller_function(tx, getWebStorageManipulationExpressions)
    caller_function(tx, getJsonInjectionExpressions)
    caller_function(tx, getXMLHttpRequestExpressions)
    caller_function(tx, getFetchExpressions)
    caller_function(tx, getInnerOuterHTMLExpressions)
    caller_function(tx, getinsertAdjacentHTMLExpressions)
    caller_function(tx, getEvalExpressions)
    caller_function(tx, getDocumentWriteExpressions)
    caller_function(tx, getJQueryAPIExpressions)
    caller_function(tx, getJQueryExpressions)
    caller_function(tx, getEventSourceExpressions)
    caller_function(tx, getGetElementByExpressions)
    caller_function(tx, getSendBeaconExpressions)

    LOGGER.info('The sink detection is finished')

    with open(os.path.join(webpage_directory, 'sinks.out.json'), "w") as file:
        json.dump(final_output, file, indent=4)

