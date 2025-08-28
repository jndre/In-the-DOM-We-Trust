# Dynamic Verification of DOM gadget data flows

- analyzes the selector of the gadget to craft a markup that matches the selector
    - markup contains a benign string `testpayload` that should flow into the sink if the flow exists
- crawls the web page using puppeteer
- intercepts parameters passed to the sinks to detect the testpayload string
- inserts the generated markup into the HTTP response of the server