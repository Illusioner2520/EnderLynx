ace.define("ace/mode/enderlynx_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("ace/lib/oop");
    const TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

    const EnderLynxHighlightRules = function () {

        this.$rules = {
            "start": [
                {
                    token: "comment",
                    regex: "//.*$"
                },
                {
                    token: "comment",
                    regex: "#.*$"
                },
                {
                    token: "comment.start",
                    regex: "/\\*",
                    next: "comment"
                },
                {
                    token: "info",
                    regex: ".*\\[.*INFO\\]\\:.*$"
                },
                {
                    token: "warn",
                    regex: ".*\\[.*WARN\\]\\:.*$"
                },
                {
                    token: "error",
                    regex: ".*\\[.*ERROR\\]\\:.*$"
                },
                {
                    token: "error.start",
                    regex: ".*(?:Exception|Error):.*$",
                    next: "error"
                },
                {
                    token: "string",
                    regex: '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
                },
                {
                    token: "string",
                    regex: "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
                },
                {
                    token: "number",
                    regex: /(\b|[+\-\.])[\d_]+(?:(?:\.[\d_]*)?(?:[eE][+\-]?[\d_]+)?)(?=[^\d\-\w]|$|M|K|G)/
                },
                {
                    token: "number",
                    regex: /[+\-]?\.inf\b|NaN\b|0x[\dA-Fa-f_]+|0b[10_]+/
                },
                {
                    token: "key",
                    regex: "key\\.(?:keyboard|mouse)\\..*$"
                },
                {
                    token: "keyword",
                    regex: "^(\\s)*[A-Za-z_\\-\\. \\d]+(?=:)"
                },
                {
                    token: "keyword",
                    regex: "^(\\s)*[A-Za-z_\\-\\.\\d]+(?:\\s)?(?=\\=)"
                },
                {
                    token: "keyword",
                    regex: "^/[a-zA-Z_\\-\\d]+"
                },
                {
                    token: "paren.lparen",
                    regex: "[[({]"
                },
                {
                    token: "paren.rparen",
                    regex: "[\\])}]"
                },
                {
                    token: "boolean",
                    regex: "\\b(?:true|false|TRUE|FALSE|True|False|yes|no)\\b"
                }
            ],

            "comment": [
                {
                    token: "comment.end",
                    regex: "\\*/",
                    next: "start"
                },
                {
                    defaultToken: "comment"
                }
            ],

            "error": [
                {
                    token: "error",
                    regex: "^\\s*at .*"
                },
                {
                    token: "error",
                    regex: "^Caused by:.*"
                },
                {
                    token: "error",
                    regex: "^\\s*\\.\\.\\.\\s*\\d+\\s*more"
                },
                {
                    token: "text",
                    regex: "^",
                    next: "start"
                }
            ]
        };
        this.normalizeRules();

    };

    oop.inherits(EnderLynxHighlightRules, TextHighlightRules);

    exports.EnderLynxHighlightRules = EnderLynxHighlightRules;

});

ace.define("ace/mode/enderlynx", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("ace/lib/oop");
    const TextMode = require("ace/mode/text").Mode;
    const EnderLynxHighlightRules = require("ace/mode/enderlynx_highlight_rules").EnderLynxHighlightRules;

    const Mode = function () {
        this.HighlightRules = EnderLynxHighlightRules;
    }

    oop.inherits(Mode, TextMode);
    exports.Mode = Mode;
});