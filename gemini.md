# Gemini AI Agent Guidelines

Welcome to the Google Sheet Custom Functions (UDF) project. This document serves as a guide for AI agents modifying, extending, or maintaining this codebase.

## 🎯 Purpose of the Project
This project is dedicated to providing high-quality, custom user-defined functions (UDFs) for Google Sheets using Google Apps Script. 
By utilizing clasp, we manage and develop this codebase locally in JavaScript, pushing modifications directly to the Google App Script console.

---

## 🛠️ Project Structure
- `appsscript.json`: Google Apps Script manifest file.
- `.clasp.json`: clasp configuration specifying script ID and local root.
- `math.js`: Contains math-related custom functions (e.g., `=plus2`).
- `gemini.md`: This AI agent guidance, rules, and instructions file.

---

## 📋 Directions and Rules for AI Agents

When working on this repository, you must adhere to the following rules:

### 1. Custom Function Structure & JSDoc
Every user-defined function (UDF) MUST include proper JSDoc comments. Google Sheets parses these comments to provide inline help and autocomplete suggestions.
* You must include the `@customfunction` tag.
* You must document all parameters using `@param {type} name Description`.
* You must document the return value using `@return {type} Description`.

**Example:**
```javascript
/**
 * Adds 2 to the input number.
 *
 * @param {number} input The number to add 2 to.
 * @return {number} The input number plus 2.
 * @customfunction
 */
function plus2(input) {
  // logic...
}
```

### 2. Apps Script Runtime (V8)
* Write clean, modern ES6+ Javascript (let/const, arrow functions, destructuring, template literals, etc.) which is fully supported by the Apps Script V8 engine.
* Do not use browser-specific APIs (like `window`, `document`, `fetch`, `XMLHttpRequest`). Instead, use Apps Script services such as `UrlFetchApp` if network requests are needed.

### 3. Graceful Error & Input Handling
* **Input Types**: Google Sheets users can pass diverse input types: numbers, strings, booleans, Date objects, empty cells (which map to `null`, `undefined`, or empty string `""`), or 2D arrays (ranges).
* **Validation**: Always validate inputs. If a function expects a number but gets a non-numeric string, return `#VALUE!` or a descriptive error.
* **Empty Values**: Ensure empty inputs are handled cleanly. By default, return `""` (empty string) for empty inputs so they do not print standard errors or arbitrary numbers in empty spreadsheet cells.
* **Error Propagation**: If input values contain active sheet errors (e.g., `#VALUE!`, `#N/A`, `#DIV/0!`), UDFs should handle them gracefully (e.g., return the error string or a default value) rather than crashing or throwing unhandled JavaScript exceptions.

### 4. Code Modularity
* Keep functions organized. Group related functions in files named by category (e.g., `math.js`, `text.js`, `utils.js`).
* Avoid creating large monolithic files with unrelated functions.
* **Local Test Export Guard**: To facilitate local unit testing via Jest while remaining fully compatible with the Apps Script environment, always add a conditional export block at the bottom of each file:
  ```javascript
  if (typeof module !== 'undefined') {
    module.exports = { function1, function2 };
  }
  ```

### 5. Clasp Connection & Git
* Do not touch or modify `.git/` or `.clasp.json` configuration unless explicitly requested.
* Always push changes to Apps Script using `clasp push` or pull remote changes with `clasp pull`.

---

## ⚡ Scalability & Optimization Rules

To ensure functions are fast, responsive, and do not freeze spreadsheets:

### 6. Native Vectorization (Range/Array Processing)
* **Vectorized by Default**: UDFs should be designed to handle 2D array inputs natively if the operation makes sense across a range.
* Instead of requiring a formula to be dragged across thousands of rows (which invokes the Apps Script engine thousands of times and slows down the sheet), passing a range should return a 2D array of results in one single execution call.
* **Iterative Mapping**: Use helper functions (e.g., `processSingle(cell)`) mapped recursively over nested arrays (representing rows and cells) when array inputs are detected.

### 7. Network & API Call Optimization
* **Mandatory Caching**: Any network request via `UrlFetchApp` or database fetch must utilize `CacheService` (User or Document cache) to cache response payloads. This avoids redundant slow requests and respects Apps Script API quotas.
* **Batch Requests**: If a function processes a range and requires external data, use `UrlFetchApp.fetchAll()` rather than querying APIs sequentially inside a loop.
* **Execution Limit**: Custom functions must return a result within **30 seconds**. If a task takes longer, it will fail. Make functions lightweight and optimize loops.
* **Read-only Scope**: UDFs cannot modify cells other than the cell returning the formula (no spreadsheet mutations or `setValue()` calls).

---

## 🧪 Testing Framework

To maintain an error-free codebase, we use a local Node.js + Jest unit testing framework:

### 8. Unit Testing
* All functions must have corresponding test cases in a `.test.js` file (e.g., `math.test.js` for `math.js`).
* Tests must verify:
  1. Standard scalar inputs.
  2. Edge cases (empty values, zero, negative numbers, extremely large inputs).
  3. Invalid types (passing string instead of number, mismatching ranges).
  4. 2D array / range inputs.
* To run tests locally, run `npm test`. Make sure all tests pass before proposing or pushing changes.
