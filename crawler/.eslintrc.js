module.exports = {
    "env": {
        "es6": true,
        "node": true,
        "mocha": true,
        "browser": true,
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2017
    },
    "rules": {
        "indent": [
            "warn",
            4
        ],
        "semi": [
            "warn",
            "always"
        ],
        "no-console": "off",
        "no-debugger": "off",
        "no-constant-condition": "off",
        "no-prototype-builtins": "off",
        "no-unused-vars": [2, {"varsIgnorePattern": "common|browser|fs", "argsIgnorePattern": "params|res"}]
    },
    "globals": {
        "common": true,
        "rootRequire": true,
        "log": true,
        "__nightcrawler_taint_report": true,
        "__nightcrawler_cookie": true,
        "__nightcrawler_log": true,
        "__nightcrawler_acceptify": true
    }
};
