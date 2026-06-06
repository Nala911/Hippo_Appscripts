/**
 * Standard Google Sheet Error Strings.
 */
const SheetErrors = {
  VALUE: "#VALUE!",
  NA: "#N/A",
  DIV0: "#DIV/0!",
  NUM: "#NUM!",
  REF: "#REF!",
  NAME: "#NAME!",
  NULL: "#NULL!",
  ERROR: "#ERROR!",
};

/**
 * Checks if a value represents an empty cell or input.
 *
 * @param {*} value The value to check.
 * @return {boolean} True if empty, false otherwise.
 */
function isEmpty(value) {
  return value === null || value === undefined || value === "";
}

/**
 * Checks if a value is a standard Google Sheets error string.
 *
 * @param {*} value The value to check.
 * @return {boolean} True if the value is a sheet error string.
 */
function isSheetError(value) {
  if (typeof value !== "string") {
    return false;
  }
  return (
    value.startsWith("#") &&
    (value.endsWith("!") || value.endsWith("?") || value === "#N/A")
  );
}

/**
 * Helper to validate and coerce a single cell value based on options.
 *
 * @param {*} value The raw cell value.
 * @param {Object} [options] Validation and coercion options.
 * @param {string} [options.type] Expected type: 'number', 'string', 'boolean'.
 * @param {boolean} [options.allowEmpty=true] If true, return empty string for empty inputs. If false, fails validation.
 * @param {boolean} [options.propagateErrors=true] If true, propagates standard sheet errors immediately.
 * @param {*} [options.errorOnInvalid=SheetErrors.VALUE] The error string to return if validation fails.
 * @return {*} The validated/coerced value, or an error.
 */
function validateAndCoerceSingle(value, options = {}) {
  const allowEmpty = options.allowEmpty !== false;
  const propagateErrors = options.propagateErrors !== false;
  const errorOnInvalid = options.errorOnInvalid || SheetErrors.VALUE;

  if (isSheetError(value)) {
    return propagateErrors ? value : errorOnInvalid;
  }

  if (isEmpty(value)) {
    return allowEmpty ? "" : errorOnInvalid;
  }

  if (options.type === "number") {
    const num = Number(value);
    if (isNaN(num)) {
      return errorOnInvalid;
    }
    return num;
  }

  if (options.type === "string") {
    return String(value);
  }

  if (options.type === "boolean") {
    return Boolean(value);
  }

  return value;
}

/**
 * Transforms a single-cell function to support 2D ranges, 1D arrays, and scalar values.
 *
 * @param {function(*): *} singleCellFn The function to apply to each cell.
 * @param {Object} [options] Optional validation and coercion settings.
 * @param {string} [options.type] Expected type: 'number', 'string', 'boolean'.
 * @param {boolean} [options.allowEmpty=true] If true, return empty string for empty inputs.
 * @param {boolean} [options.propagateErrors=true] If true, propagates standard sheet errors immediately.
 * @param {*} [options.errorOnInvalid=SheetErrors.VALUE] The error string to return if validation fails.
 * @return {function(*): *} A function that can process ranges or scalars.
 */
function vectorize(singleCellFn, options = {}) {
  const cellProcessor = (cell) => {
    const validated = validateAndCoerceSingle(cell, options);
    if (isSheetError(validated)) {
      return validated;
    }
    if (isEmpty(cell) && options.allowEmpty !== false) {
      return "";
    }
    try {
      return singleCellFn(validated);
    } catch (e) {
      console.error("Error in cell logic execution:", e);
      return options.errorOnInvalid || SheetErrors.ERROR;
    }
  };

  return function (input) {
    if (Array.isArray(input)) {
      return input.map((row) => {
        if (Array.isArray(row)) {
          return row.map((cell) => cellProcessor(cell));
        }
        return cellProcessor(row);
      });
    }
    return cellProcessor(input);
  };
}

/**
 * Hashes a string to a safe length for use as a cache key.
 * Google Apps Script CacheService has a 250-character limit on keys.
 *
 * @param {string} str The input key/URL.
 * @param {string} [namespace=''] Optional namespace to isolate cached data.
 * @return {string} A safe cache key of fixed length.
 */
function getSafeCacheKey(str, namespace = "") {
  if (typeof str !== "string") {
    return str;
  }

  const prefixStr = namespace ? `${namespace}_` : "";
  const fullStr = prefixStr + str;

  if (fullStr.length <= 200) {
    return fullStr;
  }

  // Calculate polynomial rolling hash (32-bit int)
  let hash = 0;
  for (let i = 0; i < fullStr.length; i++) {
    const char = fullStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const prefix = str
    .split("?")[0]
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 100);

  return `${prefixStr}${prefix}_hash_${Math.abs(hash).toString(36)}_${fullStr.length}`;
}

/**
 * Safely fetches a URL using CacheService to prevent hitting Google API quotas and speed up sheets.
 *
 * @param {string} url The URL to fetch.
 * @param {number} [expirationInSeconds=600] Cache expiration time (default 10 minutes).
 * @param {string} [namespace=''] Optional namespace prefix for key isolation.
 * @return {string} The text content of the response.
 */
function cachedFetch(url, expirationInSeconds = 600, namespace = "") {
  const safeKey = getSafeCacheKey(url, namespace);

  // If we are in Jest / local environment, fallback or error out nicely if CacheService is not mocked
  if (typeof CacheService === "undefined") {
    if (typeof UrlFetchApp !== "undefined") {
      try {
        const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        const code = response.getResponseCode();
        if (code >= 200 && code < 300) {
          return response.getContentText();
        }
        return `${SheetErrors.ERROR}: HTTP ${code}`;
      } catch (e) {
        return `${SheetErrors.ERROR}: ${e.message || e}`;
      }
    }
    throw new Error(
      "CacheService/UrlFetchApp are not available in this environment",
    );
  }

  const cache = CacheService.getScriptCache();
  const cached = cache.get(safeKey);
  if (cached !== null) {
    // If it's a negative cache entry representing an error
    if (cached.startsWith("__ERROR__:")) {
      return cached.substring(10);
    }
    return cached;
  }

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = response.getResponseCode();

    if (code >= 200 && code < 300) {
      const content = response.getContentText();
      // Cache limit is 100KB (102,400 bytes)
      if (content.length < 102400) {
        cache.put(safeKey, content, expirationInSeconds);
      }
      return content;
    } else {
      const errorMsg = `${SheetErrors.ERROR}: HTTP ${code}`;
      cache.put(safeKey, `__ERROR__:${errorMsg}`, 60);
      return errorMsg;
    }
  } catch (e) {
    const errorMsg = `${SheetErrors.ERROR}: ${e.message || e}`;
    try {
      cache.put(safeKey, `__ERROR__:${errorMsg}`, 60);
    } catch {
      // Ignore cache put errors
    }
    return errorMsg;
  }
}

/**
 * Performs parallel batch requests using UrlFetchApp.fetchAll and caches the results.
 *
 * @param {string[]} urls Array of URLs to fetch.
 * @param {number} [expirationInSeconds=600] Cache expiration time (default 10 minutes).
 * @param {string} [namespace=''] Optional namespace prefix for key isolation.
 * @return {string[]} Array of response texts.
 */
function cachedFetchAll(urls, expirationInSeconds = 600, namespace = "") {
  if (urls.length === 0) return [];

  const safeKeys = urls.map((url) => getSafeCacheKey(url, namespace));

  if (
    typeof CacheService === "undefined" ||
    typeof UrlFetchApp === "undefined"
  ) {
    if (typeof UrlFetchApp !== "undefined") {
      const requests = urls.map((url) => ({
        url: url,
        muteHttpExceptions: true,
      }));
      try {
        return UrlFetchApp.fetchAll(requests).map((res) => {
          const code = res.getResponseCode();
          if (code >= 200 && code < 300) {
            return res.getContentText();
          }
          return `${SheetErrors.ERROR}: HTTP ${code}`;
        });
      } catch (e) {
        return urls.map(() => `${SheetErrors.ERROR}: ${e.message || e}`);
      }
    }
    throw new Error(
      "CacheService/UrlFetchApp are not available in this environment",
    );
  }

  const cache = CacheService.getScriptCache();
  const cachedResults = cache.getAll(safeKeys);

  const results = [];
  const uncachedUrls = [];
  const uncachedIndices = [];

  urls.forEach((url, index) => {
    const safeKey = safeKeys[index];
    const cached = cachedResults[safeKey];
    if (cached !== undefined && cached !== null) {
      if (cached.startsWith("__ERROR__:")) {
        results[index] = cached.substring(10);
      } else {
        results[index] = cached;
      }
    } else {
      uncachedUrls.push(url);
      uncachedIndices.push(index);
    }
  });

  if (uncachedUrls.length > 0) {
    const requests = uncachedUrls.map((url) => ({
      url: url,
      muteHttpExceptions: true,
    }));

    let responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (e) {
      const errorMsg = `${SheetErrors.ERROR}: Batch fetch failed: ${e.message || e}`;
      const newCacheObj = {};

      uncachedUrls.forEach((url, i) => {
        const originalIndex = uncachedIndices[i];
        const safeKey = safeKeys[originalIndex];
        results[originalIndex] = errorMsg;
        newCacheObj[safeKey] = `__ERROR__:${errorMsg}`;
      });

      try {
        cache.putAll(newCacheObj, 60);
      } catch {}

      return results;
    }

    const successCacheObj = {};
    const errorCacheObj = {};

    responses.forEach((response, i) => {
      const originalIndex = uncachedIndices[i];
      const safeKey = safeKeys[originalIndex];
      const code = response.getResponseCode();

      if (code >= 200 && code < 300) {
        const content = response.getContentText();
        results[originalIndex] = content;
        if (content.length < 102400) {
          successCacheObj[safeKey] = content;
        }
      } else {
        const errorMsg = `${SheetErrors.ERROR}: HTTP ${code}`;
        results[originalIndex] = errorMsg;
        errorCacheObj[safeKey] = `__ERROR__:${errorMsg}`;
      }
    });

    try {
      if (Object.keys(successCacheObj).length > 0) {
        cache.putAll(successCacheObj, expirationInSeconds);
      }
      if (Object.keys(errorCacheObj).length > 0) {
        cache.putAll(errorCacheObj, 60);
      }
    } catch {}
  }

  return results;
}

/**
 * Transforms a batch-processing function into a vectorized function that supports 2D ranges, 1D arrays, and scalar values.
 * The batch function receives an array of unique non-empty, non-error values, processes them, and returns a key-value mapping (Object).
 *
 * @param {function(Array<*>): Object<*, *>} batchFn A function that processes an array of unique inputs and returns an object mapping inputs to results.
 * @param {Object} [options] Optional validation and coercion settings.
 * @param {string} [options.type] Expected type: 'number', 'string', 'boolean'.
 * @param {boolean} [options.allowEmpty=true] If true, return empty string for empty inputs.
 * @param {boolean} [options.propagateErrors=true] If true, propagates standard sheet errors immediately.
 * @param {*} [options.errorOnInvalid=SheetErrors.VALUE] The error string to return if validation fails.
 * @return {function(*): *} A function that can process ranges or scalars.
 */
function vectorizeBatch(batchFn, options = {}) {
  return function (input) {
    if (Array.isArray(input)) {
      // 1. Flatten the input array and collect all values
      const flatCells = [];
      const traverse = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          if (Array.isArray(arr[i])) {
            traverse(arr[i]);
          } else {
            flatCells.push(arr[i]);
          }
        }
      };
      traverse(input);

      // 2. Map cells to their validated/coerced state
      const cellValidations = flatCells.map((cell) => ({
        original: cell,
        validated: validateAndCoerceSingle(cell, options),
      }));

      // Gather unique, validated values that are NOT errors and NOT empty
      const uniqueInputs = Array.from(
        new Set(
          cellValidations
            .map((cv) => cv.validated)
            .filter((val) => !isEmpty(val) && !isSheetError(val)),
        ),
      );

      // 3. Execute batchFn to get a map of results
      let resultsMap = {};
      if (uniqueInputs.length > 0) {
        try {
          resultsMap = batchFn(uniqueInputs) || {};
        } catch (e) {
          console.error("Batch function execution failed:", e);
          const errorMsg = `${SheetErrors.ERROR}: ${e.message || e}`;
          uniqueInputs.forEach((val) => {
            resultsMap[val] = errorMsg;
          });
        }
      }

      // 4. Map values back to their original array structure
      const mapCellResult = (cellInfo) => {
        const { original, validated } = cellInfo;
        if (isSheetError(validated)) {
          return validated;
        }
        if (isEmpty(original) && options.allowEmpty !== false) {
          return "";
        }
        const mapped = resultsMap[validated];
        return mapped !== undefined ? mapped : "";
      };

      let cellIndex = 0;
      const reconstruct = (arr) => {
        return arr.map((item) => {
          if (Array.isArray(item)) {
            return reconstruct(item);
          }
          return mapCellResult(cellValidations[cellIndex++]);
        });
      };

      return reconstruct(input);
    }

    // Scalar input handling
    const validated = validateAndCoerceSingle(input, options);
    if (isSheetError(validated)) {
      return validated;
    }
    if (isEmpty(input) && options.allowEmpty !== false) {
      return "";
    }

    try {
      const resultsMap = batchFn([validated]) || {};
      const mapped = resultsMap[validated];
      return mapped !== undefined ? mapped : "";
    } catch (e) {
      console.error("Batch function execution failed for scalar:", e);
      return `${SheetErrors.ERROR}: ${e.message || e}`;
    }
  };
}

/**
 * Unified Global Namespace Object.
 */
const UDF = {
  errors: SheetErrors,
  isEmpty,
  isSheetError,
  validateAndCoerceSingle,
  vectorize,
  vectorizeBatch,
  getSafeCacheKey,
  cachedFetch,
  cachedFetchAll,
};

if (typeof module !== "undefined") {
  module.exports = {
    UDF,
    SheetErrors,
    isEmpty,
    isSheetError,
    validateAndCoerceSingle,
    vectorize,
    getSafeCacheKey,
    cachedFetch,
    cachedFetchAll,
    vectorizeBatch,
  };
}
