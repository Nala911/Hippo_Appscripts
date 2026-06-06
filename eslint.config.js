module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        // Google Apps Script Globals
        UrlFetchApp: "readonly",
        CacheService: "readonly",
        Logger: "readonly",
        console: "readonly",
        SpreadsheetApp: "readonly",
        Session: "readonly",
        PropertiesService: "readonly",
        Utilities: "readonly",
        MailApp: "readonly",
        DriveApp: "readonly",
        CalendarApp: "readonly",
        GmailApp: "readonly",
        DocumentApp: "readonly",

        // Node / Jest Globals
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
        require: "readonly",
        module: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { vars: "all", args: "none" }],
      "no-console": "off",
      "no-undef": "error",
    },
  },
];
