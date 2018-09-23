module.exports = {
    "env": {
        "es6": true
    },
    "globals": {
        '_': false,
        'ARGV': false,
        'C_': false,
        'Debugger': false,
        'GjsFileImporter': false,
        'global': false,
        'imports': false,
        'InternalError': false,
        'Iterator': false,
        'log': false,
        'logError': false,
        'N_': false,
        'ngettext': false,
        'print': false,
        'printerr': false,
        'StopIteration': false,
        'uneval': false,
        'window': false
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2017
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ]
    }
};
