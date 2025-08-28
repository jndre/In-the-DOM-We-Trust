(async function () {

    let acceptWords = [
        /*English*/     "Accept", "Agree", "Enable", "Allow", "Got it", "Consent", "Accept and continue", "I am happy",
        /*German*/      "Akzeptiere", "Akzeptieren", "Annehmen", "Erlauben", "Zustimmen", "Zulassen", "Bestätigen",
        "Ich stimme zu", "Stimme zu", "Einverstanden", "Standardeinstellung",
        /*French*/      "Accepter", "J'accepte", "Autoriser", "d'accord",
        /*Italian*/     "Accetto", "Accetta", "Accettare", "permettere",
        /*Spanish*/     "Acepto", "Aceptar", "Permitir", "acuerdo", "entendi", "entendido",
        /*Polish*/      "Zaakceptować", "Dopuszczać", "Zgadzam",
        /*Portuguese*/  "Aceitar", "Aceita", "Permitir", "Prosseguir", "concordo",
        /*Swedish*/     "Acceptera",
        /*Norwegian*/   "Aksepterer"
    ];

    let badWords = [
        /* English */ "manage", "manager", "settings", "not", "only", "refuse", "selection", "don't",
        /* German */ "auswahl", "nur", "nicht",
        /* French */ "sans",
        /* Italian */ "senza",
    ];

    let goodRegex = [/^ok$/, /^okay$/];
    for (let word of acceptWords) {
        //Use word boundaries to prevent "allow" matching "disallow"
        goodRegex.push(new RegExp("\\b" + word.toLowerCase() + "\\b"));
    }
    let badRegex = [];
    for (let word of badWords) {
        badRegex.push(new RegExp("\\b" + word.toLowerCase() + "\\b"));
    }

    function getText(ele) {
        let text = "";
        if (ele.textContent) {
            text = ele.textContent.toString();
        }
        else if (ele.value) {
            text = ele.value.toString();
        }
        return text.toLowerCase().trim();
    }

    function isVisible(ele) {
        return ele.offsetParent != null;
    }

    //Taken from https://stackoverflow.com/questions/123999/how-can-i-tell-if-a-dom-element-is-visible-in-the-current-viewport
    function isInViewport(ele) {
        const rect = ele.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
            rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
        );
    }

    function isTopLevel(ele) {
        let {x, y} = ele.getBoundingClientRect();
        return ele === document.elementFromPoint(x,y);
    }

    function isShort(ele) {
        //Limit to X characters and Y words
        let text = getText(ele);
        return text.length < 200 && text.split(" ").length <= 6;
    }

    function includesWord(ele, regexes) {
        let text = getText(ele);
        for (let re of regexes) {
            if (text.match(re)) {
                return true;
            }
        }
        return false;
    }

    function printCandidates(text, candidates) {
        if (candidates.length > 0) {
            __nightcrawler_log(text);
            for (let ele of candidates) {
                __nightcrawler_log("\t" + ele.nodeName + "\t" + ele.textContent);
            }
            __nightcrawler_log("--------------");
        }
    }

    function filter(str, elements, func) {
        if (elements.length <= 1) {
            return elements;
        }
        let result = [];
        for (let ele of elements) {
            if (func(ele)) {
                result.push(ele);
            }
        }
        if (result.length > 0 && result.length < elements.length) {
            printCandidates(str, result);
            return result;
        }
        return elements;
    }

    //Get all clickable elements that contain a good word
    let candidates = [];
    for (let ele of document.querySelectorAll("*")) {
        if (ele.click && includesWord(ele, goodRegex) && isShort(ele)) {
            candidates.push(ele);
        }
    }
    printCandidates("Good words", candidates);

    //Prefer certain elements: button > a > div
    let buttons = candidates.filter(x => x.nodeName.includes("BUTTON"));
    let links = candidates.filter(x => x.nodeName === "A");
    let divs = candidates.filter(x => x.nodeName === "DIV");
    if (buttons.length > 0) {
        candidates = buttons;
    }
    else if (links.length > 0) {
        candidates = links;
    }
    else if (divs.length > 0) {
        candidates = divs;
    }
    printCandidates("Node type sort", candidates);

    candidates = filter("Visible", candidates, function(ele) { return isVisible(ele); });
    candidates = filter("Viewport", candidates, function(ele) { return isInViewport(ele); });
    candidates = filter("Bad words", candidates, function(ele) { return !includesWord(ele, badRegex); });
    candidates = filter("Top level", candidates, function(ele) { return isTopLevel(ele); });

    // TODO If still multiple candidates, prefer high color contrast over low?

    //Highlight them for debugging and screenshots
    for (let ele of candidates) {
        ele.style.border = '#ff0 solid 8px';
        ele.style.outline = '#f00 solid 16px';
    }

    //Notify backend of all candidates
    for (let ele of candidates) {
        __nightcrawler_acceptify(ele.nodeName.toLowerCase(), getText(ele));
    }

    //Only click if we found exactly one
    if (candidates.length === 1) {
        //Expose element for later clicking
        window.__nightcrawler_cookie_ele = candidates[0];
    }
})();
