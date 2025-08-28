(function () {
    const name = "_cookie";
    let nativeCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(Document.prototype, name, nativeCookieDesc);
    Object.defineProperty(Document.prototype, "cookie", {
        enumerable: true,
        configurable: true,
        get() {
            return this[name];
        },
        set(value) {
            this[name] = value;
            __nightcrawler_cookie(Error().stack, value);
        }
    });
})();
