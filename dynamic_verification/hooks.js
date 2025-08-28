window.requestApiCalls = [];
(function () {
    var LOG_ENABLED = false;
    var TEST_PAYLOAD = "testpayload";
    if (!window.installedFunctionInstrumentations) {
        // only instrument once
        window.installedFunctionInstrumentations = true;
        LOG_ENABLED && console.log("[[ Hooks ]] Init");

        /**
         * Hook for EventSource
         */
        var o_eventsource = EventSource;
        EventSource = function (url) {
            LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: EventSource");
            try {
                if (url.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ EventSource: url });
                }
            } catch (e) {
                console.error("Error in EventSource hook:", e);
            }

            return new o_eventsource(url);
        };

        /**
         * Hook for XMLHttpRequest.open(url), .open(username), .open(password)
         */
        var o_xmlhttprequest_open = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, async, username, password) {
            LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: XMLHttpRequest.open");
            try {
                if (url.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "XMLHttpRequest.open(url)": url });
                }
                if (username && username.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "XMLHttpRequest.open(username)": username });
                }
                if (password && password.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "XMLHttpRequest.open(password)": password });
                }
            } catch (e) {
                console.error("Error in XMLHttpRequest.open hook:", e);
            }

            return o_xmlhttprequest_open.apply(this, arguments);
        };

        /**
         * Hook for XMLHttpRequest.send
         */
        var o_xmlhttprequest_send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (body) {
            LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: XMLHttpRequest.send");
            try {
                if (typeof body === "string" && body.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "XMLHttpRequest.send": body });
                }
            } catch (e) {
                console.error("Error in XMLHttpRequest.send hook:", e);
            }

            return o_xmlhttprequest_send.apply(this, arguments);
        };

        /**
         * Hook for XMLHttpRequest.setRequestHeader(name), .setRequestHeader(value)
         */
        var o_xmlhttprequest_setreqheader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
            LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: XMLHttpRequest.setRequestHeader");
            try {
                if (name.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "XMLHttpRequest.setRequestHeader(name)": name });
                }
                if (value.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "XMLHttpRequest.setRequestHeader(value)": value });
                }
            } catch (e) {
                console.error("Error in XMLHttpRequest.setRequestHeader hook:", e);
            }

            return o_xmlhttprequest_setreqheader.apply(this, arguments);
        };
        /**
         * Hook for a.href
         */
        Object.defineProperty(HTMLAnchorElement.prototype, "href", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: a.href");

                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "a.href": value });
                    }

                    // Use the original setter to maintain expected behavior
                    Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href").set.call(this, value);
                } catch (e) {
                    console.error("Error in a.href setter hook:", e);
                }
            },
            get: function () {
                try {
                    return Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "href").get.call(this);
                } catch (e) {
                    console.error("Error in a.href getter hook:", e);
                    // Return a default value or rethrow the error if necessary
                    return ""; // Default fallback value
                }
            },
        });

        /**
         * Hook for document.cookie
         */
        Object.defineProperty(document, "cookie", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: document.cookie");
                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "document.cookie": value });
                    }
                    // Use original method to set cookie
                    Object.getOwnPropertyDescriptor(Document.prototype, "cookie").set.call(document, value);
                } catch (e) {
                    console.error("Error in document.cookie setter hook:", e);
                }
            },
            get: function () {
                try {
                    return Object.getOwnPropertyDescriptor(Document.prototype, "cookie").get.call(document);
                } catch (e) {
                    console.error("Error in document.cookie getter hook:", e);
                    // Return a default value or rethrow the error if necessary
                    return ""; // Default fallback value
                }
            },
        });

        /**
         * Hook for document.write
         */
        var o_document_write = document.write;
        document.write = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: document.write");
                if (typeof arguments[0] === "string" && arguments[0].includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "document.write": arguments[0] });
                }
            } catch (e) {
                console.error("Error in document.write hook:", e);
            }

            return o_document_write.apply(this, arguments);
        };

        /**
         * Hook for document.writeln
         */
        var o_document_writeln = document.writeln;
        document.writeln = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: document.writeln");
                if (typeof arguments[0] === "string" && arguments[0].includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "document.writeln": arguments[0] });
                }
            } catch (e) {
                console.error("Error in document.writeln hook:", e);
            }

            return o_document_writeln.apply(this, arguments);
        };
        /**
         * Hook for embed.src
         */
        Object.defineProperty(HTMLEmbedElement.prototype, "src", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: embed.src");
                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "embed.src": value });
                    }
                    Object.getOwnPropertyDescriptor(HTMLEmbedElement.prototype, "src").set.call(this, value);
                } catch (e) {
                    console.error("Error in embed.src setter hook:", e);
                }
            },
            get: function () {
                try {
                    return Object.getOwnPropertyDescriptor(HTMLEmbedElement.prototype, "src").get.call(this);
                } catch (e) {
                    console.error("Error in embed.src getter hook:", e);
                    return ""; // Default fallback value
                }
            },
        });

        /**
         * Hook for eval
         */
        var o_eval = eval;
        window.eval = function (code) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: eval");
                if (typeof code === "string" && code.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ eval: code });
                }
            } catch (e) {
                console.error("Error in eval hook:", e);
            }
            return o_eval.apply(this, arguments);
        };

        /**
         * Hook for fetch.url and fetch.body
         */
        var o_fetch = fetch;
        fetch = function (resource, options) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: fetch");
                if (typeof resource === "string" && resource.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "fetch.url": resource });
                }
                if (options && options.body && options.body.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "fetch.body": options.body });
                }
            } catch (e) {
                console.error("Error in fetch hook:", e);
            }

            return o_fetch.apply(this, arguments);
        };

        /**
         * Hook for iframe.src
         */
        Object.defineProperty(HTMLIFrameElement.prototype, "src", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: iframe.src");
                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "iframe.src": value });
                    }

                    // Get the original descriptor from HTMLElement (not HTMLIFrameElement)
                    var descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "src");
                    if (descriptor && descriptor.set) {
                        descriptor.set.call(this, value);
                    } else {
                        this.setAttribute("src", value); // Fallback in case descriptor is undefined
                    }
                } catch (e) {
                    console.error("Error in iframe.src setter hook:", e);
                }
            },
            get: function () {
                try {
                    var descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "src");
                    return descriptor && descriptor.get ? descriptor.get.call(this) : this.getAttribute("src");
                } catch (e) {
                    console.error("Error in iframe.src getter hook:", e);
                    // Return a default value or rethrow the error if necessary
                    return ""; // Default fallback value
                }
            },
        });
        /**
         * Hook for innerHTML
         */
        Object.defineProperty(Element.prototype, "innerHTML", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: innerHTML");
                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ innerHTML: value });
                    }
                    Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML").set.call(this, value);
                } catch (e) {
                    console.error("Error in innerHTML hook:", e);
                }
            },
            get: function () {
                try {
                    return Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML").get.call(this);
                } catch (e) {
                    console.error("Error in innerHTML getter hook:", e);
                    // Return a default value or rethrow the error if necessary
                    return ""; // Default fallback value
                }
            },
        });

        /**
         * Hook for insertAdjacentHTML
         */
        var o_insertAdjacentHTML = Element.prototype.insertAdjacentHTML;
        Element.prototype.insertAdjacentHTML = function (position, text) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: insertAdjacentHTML");
                if (typeof text === "string" && text.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ insertAdjacentHTML: text });
                }
            } catch (e) {
                console.error("Error in insertAdjacentHTML hook:", e);
            }

            return o_insertAdjacentHTML.apply(this, arguments);
        };

        /**
         * Hook for insertAdjacentText
         */
        var o_insertAdjacentText = Element.prototype.insertAdjacentText;
        Element.prototype.insertAdjacentText = function (position, text) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: insertAdjacentText");
                if (typeof text === "string" && text.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ insertAdjacentText: text });
                }
            } catch (e) {
                console.error("Error in insertAdjacentText hook:", e);
            }

            return o_insertAdjacentText.apply(this, arguments);
        };
        /**
         * Hook for localStorage.setItem and sessionStorage.setItem
         */
        var o_localStorage_setItem = localStorage.setItem;
        localStorage.setItem = function (key, value) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: localStorage.setItem");
                if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "localStorage.setItem": value });
                }
            } catch (e) {
                console.error("Error in localStorage.setItem hook:", e);
            }

            return o_localStorage_setItem.apply(this, arguments);
        };

        var o_sessionStorage_setItem = sessionStorage.setItem;
        sessionStorage.setItem = function (key, value) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: sessionStorage.setItem");
                if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "sessionStorage.setItem": value });
                }
            } catch (e) {
                console.error("Error in sessionStorage.setItem hook:", e);
            }

            return o_sessionStorage_setItem.apply(this, arguments);
        };
        /**
         * Hook for location.assign, location.replace, and location.href
         */
        var o_location_assign = window.location.assign;
        window.location.assign = function (url) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: location.assign");
                if (typeof url === "string" && url.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "location.assign": url });
                }
            } catch (e) {
                console.error("Error in location.assign/replace/href hook:", e);
            }

            return o_location_assign.apply(this, arguments);
        };

        var o_location_replace = window.location.replace;
        window.location.replace = function (url) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: location.replace");
                if (typeof url === "string" && url.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "location.replace": url });
                }
            } catch (e) {
                console.error("Error in location.assign/replace/href hook:", e);
            }

            return o_location_replace.apply(this, arguments);
        };

        Object.defineProperty(window.location, "href", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: location.href");

                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "location.href": value });
                    }

                    // Use the original location setter
                    Object.getOwnPropertyDescriptor(Location.prototype, "href").set.call(window.location, value);
                } catch (e) {
                    console.error("Error in location.assign/replace/href setter hook:", e);
                }
            },
            get: function () {
                try {
                    return Object.getOwnPropertyDescriptor(Location.prototype, "href").get.call(window.location);
                } catch (e) {
                    console.error("Error in location.href getter hook:", e);
                    // Return a default value or rethrow the error if necessary
                    return ""; // Default fallback value
                }
            },
        });

        // Additional hooks for the location properties
        var locationProperties = ["hash", "host", "pathname", "port", "protocol", "search"];

        locationProperties.forEach(function (prop) {
            var originalDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, prop);

            Object.defineProperty(window.location, prop, {
                set: function (value) {
                    try {
                        LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: location." + prop);

                        if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                            window.requestApiCalls.push({ ["location." + prop]: value });
                        }

                        // Call the original setter to correctly update location
                        originalDescriptor.set.call(window.location, value);
                    } catch (e) {
                        console.error("Error in location... setter hook:", e);
                    }
                },
                get: function () {
                    try {
                        return originalDescriptor.get.call(window.location);
                    } catch (e) {
                        console.error("Error in location... getter hook:", e);
                        // Return a default value or rethrow the error if necessary
                        return ""; // Default fallback value
                    }
                },
            });
        });

        /**
         * Hook for navigator.sendBeacon
         */
        var o_sendBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function (url, data) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: navigator.sendBeacon");

                if (typeof url === "string" && url.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "navigator.sendBeacon(url)": url });
                }

                // Ensure data is properly checked (handle Blob, FormData, etc.)
                if (data && typeof data === "string" && data.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "navigator.sendBeacon(body)": data });
                } else if (data instanceof Blob) {
                    data.text().then((text) => {
                        if (text.includes(TEST_PAYLOAD)) {
                            window.requestApiCalls.push({ "navigator.sendBeacon(body)": text });
                        }
                    });
                } else if (data instanceof FormData) {
                    for (let value of data.values()) {
                        if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                            window.requestApiCalls.push({ "navigator.sendBeacon(body)": value });
                            break;
                        }
                    }
                }
            } catch (e) {
                console.error("Error in navigator.sendBeacon hook:", e);
            }

            return o_sendBeacon.apply(this, arguments);
        };

        /**
         * Hook for object.data
         */
        Object.defineProperty(HTMLObjectElement.prototype, "data", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: object.data");
                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "object.data": value });
                    }

                    Object.getOwnPropertyDescriptor(HTMLObjectElement.prototype, "data").set.call(this, value);
                } catch (e) {
                    console.error("Error in object.data hook:", e);
                }
            },
            get: function () {
                try {
                    return Object.getOwnPropertyDescriptor(HTMLObjectElement.prototype, "data").get.call(this);
                } catch (e) {
                    console.error("Error in object.data getter hook:", e);
                    return ""; // Default fallback value
                }
            },
        });

        /**
         * Hook for outerHTML
         */
        Object.defineProperty(Element.prototype, 'outerHTML', {
            set: function(value){
                try {
                    LOG_ENABLED && console.log('[[ Hooks ]] Intercepted: outerHTML');
                    if (typeof value === 'string' && value.includes(TEST_PAYLOAD)){
                        window.requestApiCalls.push({'outerHTML': value});
                    }

                    Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML').set.call(this, value);
                } catch (e) {
                    console.error('Error in outerHTML setter hook:', e);
                }
            },
            get: function() {
                try {
                    return Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML').get.call(this);
                } catch (e) {
                    console.error('Error in outerHTML getter hook:', e);
                    // Return a default value or rethrow the error if necessary
                    return ''; // Default fallback value
                }
            }
        });

        /**
         * Hook for element.append
         */
        var originalAppend = Element.prototype.append;
        Element.prototype.append = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: element.append");

                // Check if any argument contains the test payload
                if (Array.from(arguments).some((arg) => typeof arg === "string" && arg.includes(TEST_PAYLOAD))) {
                    window.requestApiCalls.push({ "element.append": Array.from(arguments).join(", ") });
                }
            } catch (e) {
                console.error("Error in element.append hook:", e);
            }

            // Call the original append method
            return originalAppend.apply(this, arguments);
        };
        /**
         * Hook for element.prepend
         */
        var originalPrepend = Element.prototype.prepend;
        Element.prototype.prepend = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: element.prepend");

                // Check if any argument contains the test payload
                if (Array.from(arguments).some((arg) => typeof arg === "string" && arg.includes(TEST_PAYLOAD))) {
                    window.requestApiCalls.push({ "element.prepend": Array.from(arguments).join(", ") });
                }
            } catch (e) {
                console.error("Error in element.prepend hook:", e);
            }

            // Call the original prepend method
            return originalPrepend.apply(this, arguments);
        };

        /**
         * Hook for element.after
         */
        var originalAfter = Element.prototype.after;
        Element.prototype.after = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: element.after");

                // Check if any argument contains the test payload
                if (Array.from(arguments).some((arg) => typeof arg === "string" && arg.includes(TEST_PAYLOAD))) {
                    window.requestApiCalls.push({ "element.after": Array.from(arguments).join(", ") });
                }
            } catch (e) {
                console.error("Error in element.after hook:", e);
            }

            // Call the original after method
            return originalAfter.apply(this, arguments);
        };

        /**
         * Hook for script.innerHTML, script.src, script.text
         */

        const originalScriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
        Object.defineProperty(HTMLScriptElement.prototype, "src", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: script.src");
                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "script.src": value });
                    }
                    originalScriptSrc.set.call(this, value);
                } catch (e) {
                    console.error("Error in script. hook:", e);
                }
            },
            get: function () {
                try {
                    return originalScriptSrc.get.call(this);
                } catch (e) {
                    console.error("Error in script. getter hook:", e);
                    // Return a default value or rethrow the error if necessary
                    return ""; // Default fallback value
                }
            },
        });

        const originalImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
        Object.defineProperty(HTMLImageElement.prototype, "src", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: img.src");
                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "img.src": value });
                    }
                    originalImageSrc.set.call(this, value);
                } catch (e) {
                    console.error("Error in img.src setter hook:", e);
                }
            },
            get: function () {
                try {
                    return originalImageSrc.get.call(this);
                } catch (e) {
                    console.error("Error in img.src getter hook:", e);
                    return "";
                }
            },
        });

        /**
         * Hook for setInterval
         */
        var o_setInterval = window.setInterval;
        window.setInterval = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: setInterval");
                if (typeof arguments[0] === "string" && arguments[0].includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ setInterval: arguments[0] });
                }
            } catch (e) {
                console.error("Error in setInterval hook:", e);
            }
            return o_setInterval.apply(this, arguments);
        };

        /**
         * Hook for setTimeout
         */
        var o_setTimeout = window.setTimeout;
        window.setTimeout = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: setTimeout");
                if (typeof arguments[0] === "string" && arguments[0].includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ setTimeout: arguments[0] });
                }
            } catch (e) {
                console.error("Error in setTimeout hook:", e);
            }

            return o_setTimeout.apply(this, arguments);
        };

        /**
         * Hook for window.open
         */
        var o_window_open = window.open;
        window.open = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: window.open");

                if (typeof arguments[0] === "string" && arguments[0].includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "window.open": arguments[0] });
                }
            } catch (e) {
                console.error("Error in window.open hook:", e);
            }

            return o_window_open.apply(this, arguments);
        };

        /**
         * Hook for window.postMessage
         */
        var o_postMessage = window.postMessage;
        window.postMessage = function (message, targetOrigin) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: window.postMessage");
                if (typeof message === "string" && message.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "window.postMessage": message });
                }
            } catch (e) {
                console.error("Error in window.postMessage hook:", e);
            }

            return o_postMessage.apply(this, arguments);
        };

        /**
         * Hook for WebSocket.send
         */

        Copy;
        var originalWebSocketSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: WebSocket.send");

                if (typeof data === "string" && data.includes(TEST_PAYLOAD)) {
                    window.requestApiCalls.push({ "WebSocket.send": data });
                } else if (data instanceof Blob) {
                    data.text().then((text) => {
                        if (text.includes(TEST_PAYLOAD)) {
                            window.requestApiCalls.push({ "WebSocket.send": text });
                        }
                    });
                } else if (data instanceof ArrayBuffer) {
                    const decoder = new TextDecoder();
                    const text = decoder.decode(data);
                    if (text.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "WebSocket.send": text });
                    }
                }
            } catch (e) {
                console.error("Error in WebSocket.send hook:", e);
            }

            // Call the original WebSocket.send function
            return originalWebSocketSend.apply(this, [data]);
        };

        /**
         * Hook for Function.ctor
         */
        var originalFunctionConstructor = Function.prototype.constructor;
        Function.prototype.constructor = function () {
            try {
                LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: Function.ctor");

                // Check if any argument contains the test payload
                if (Array.from(arguments).some((arg) => typeof arg === "string" && arg.includes(TEST_PAYLOAD))) {
                    window.requestApiCalls.push({ "Function.ctor": Array.from(arguments).join(", ") });
                }
            } catch (e) {
                console.error("Error in Function.ctor hook:", e);
            }

            return originalFunctionConstructor.apply(this, arguments);
        };

        /**
         * Hook for form.action
         */
        Object.defineProperty(HTMLFormElement.prototype, "action", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: form.action");

                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "form.action": value });
                    }

                    // Use the original setter
                    Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "action").set.call(this, value);
                } catch (e) {
                    console.error("Error in form.action setter hook:", e);
                }
            },
            get: function () {
                try {
                    return Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, "action").get.call(this);
                } catch (e) {
                    console.error("Error in form.action getter hook:", e);
                    return ""; // Default fallback value
                }
            },
        });

        /**
         * Hook for element.style
         */
        Object.defineProperty(Element.prototype, "style", {
            set: function (value) {
                try {
                    LOG_ENABLED && console.log("[[ Hooks ]] Intercepted: element.style");

                    if (typeof value === "string" && value.includes(TEST_PAYLOAD)) {
                        window.requestApiCalls.push({ "element.style": value });
                    }

                    // Use the original setter
                    Object.getOwnPropertyDescriptor(Element.prototype, "style").set.call(this, value);
                } catch (e) {
                    console.error("Error in element.style setter hook:", e);
                }
            },
            get: function () {
                try {
                    return Object.getOwnPropertyDescriptor(Element.prototype, "style").get.call(this);
                } catch (e) {
                    console.error("Error in element.style getter hook:", e);
                    return ""; // Default fallback value
                }
            },
        });
    }
})();
