const {
  isEmpty,
  isSheetError,
  vectorize,
  cachedFetch,
  cachedFetchAll,
} = require("./utils");

describe("isEmpty", () => {
  test("returns true for null, undefined, and empty string", () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty("")).toBe(true);
  });

  test("returns false for actual values", () => {
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty("hello")).toBe(false);
  });
});

describe("isSheetError", () => {
  test("returns true for standard sheet error strings", () => {
    expect(isSheetError("#VALUE!")).toBe(true);
    expect(isSheetError("#N/A")).toBe(true);
    expect(isSheetError("#DIV/0!")).toBe(true);
    expect(isSheetError("#NUM!")).toBe(true);
    expect(isSheetError("#ERROR!")).toBe(true);
  });

  test("returns false for non-error strings or other types", () => {
    expect(isSheetError("hello")).toBe(false);
    expect(isSheetError("#VALUE")).toBe(false);
    expect(isSheetError(123)).toBe(false);
    expect(isSheetError(null)).toBe(false);
  });
});

describe("validateAndCoerceSingle", () => {
  const { validateAndCoerceSingle } = require("./utils");

  test("handles numeric type validation", () => {
    expect(validateAndCoerceSingle(123, { type: "number" })).toBe(123);
    expect(validateAndCoerceSingle("123", { type: "number" })).toBe(123);
    expect(validateAndCoerceSingle("abc", { type: "number" })).toBe("#VALUE!");
    expect(
      validateAndCoerceSingle("abc", {
        type: "number",
        errorOnInvalid: "#NUM!",
      }),
    ).toBe("#NUM!");
  });

  test("handles string and boolean validation", () => {
    expect(validateAndCoerceSingle(123, { type: "string" })).toBe("123");
    expect(validateAndCoerceSingle(1, { type: "boolean" })).toBe(true);
    expect(validateAndCoerceSingle(0, { type: "boolean" })).toBe(false);
  });

  test("handles empty cells", () => {
    expect(validateAndCoerceSingle("", { allowEmpty: true })).toBe("");
    expect(validateAndCoerceSingle("", { allowEmpty: false })).toBe("#VALUE!");
    expect(validateAndCoerceSingle(null, { allowEmpty: true })).toBe("");
    expect(validateAndCoerceSingle(null, { allowEmpty: false })).toBe(
      "#VALUE!",
    );
  });

  test("handles sheet errors", () => {
    expect(validateAndCoerceSingle("#N/A", { propagateErrors: true })).toBe(
      "#N/A",
    );
    expect(validateAndCoerceSingle("#N/A", { propagateErrors: false })).toBe(
      "#VALUE!",
    );
  });
});

describe("vectorize with options", () => {
  test("handles scalar input with number validation", () => {
    const fn = vectorize((x) => x * 2, { type: "number", allowEmpty: true });
    expect(fn(5)).toBe(10);
    expect(fn("abc")).toBe("#VALUE!");
    expect(fn("")).toBe("");
  });

  test("handles arrays with number validation", () => {
    const fn = vectorize((x) => x * 2, { type: "number", allowEmpty: true });
    expect(fn([1, "abc", ""])).toEqual([2, "#VALUE!", ""]);
    expect(
      fn([
        [1, 2],
        ["", "abc"],
      ]),
    ).toEqual([
      [2, 4],
      ["", "#VALUE!"],
    ]);
  });
});

describe("caching and network utilities", () => {
  let mockCache;
  let mockCacheService;
  let mockUrlFetchApp;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      put: jest.fn(),
      getAll: jest.fn(),
      putAll: jest.fn(),
    };
    mockCacheService = {
      getScriptCache: jest.fn(() => mockCache),
    };
    mockUrlFetchApp = {
      fetch: jest.fn(() => ({
        getContentText: () => "",
        getResponseCode: () => 200,
      })),
      fetchAll: jest.fn(() => []),
    };

    // @ts-ignore
    global.CacheService = mockCacheService;
    // @ts-ignore
    global.UrlFetchApp = mockUrlFetchApp;
  });

  afterEach(() => {
    delete global.CacheService;
    delete global.UrlFetchApp;
  });

  describe("getSafeCacheKey", () => {
    const { getSafeCacheKey } = require("./utils");

    test("returns the same string if length is less than or equal to 200", () => {
      const shortKey = "http://example.com/short";
      expect(getSafeCacheKey(shortKey)).toBe(shortKey);
    });

    test("applies namespace prefix to key", () => {
      const shortKey = "http://example.com/short";
      expect(getSafeCacheKey(shortKey, "testNs")).toBe(
        "testNs_http://example.com/short",
      );
    });

    test("returns hashed string for keys longer than 200 characters including namespace", () => {
      const longKey = "http://example.com/query?" + "a".repeat(250);
      const safeKey = getSafeCacheKey(longKey, "mathFunc");
      expect(safeKey.length).toBeLessThan(250);
      expect(safeKey).toContain("hash_");
      expect(safeKey).toContain("mathFunc_http___example_com_query");
    });
  });

  describe("cachedFetch", () => {
    test("returns cached value if present", () => {
      mockCache.get.mockReturnValue("cached response");
      const result = cachedFetch("http://example.com");
      expect(result).toBe("cached response");
      expect(mockCache.get).toHaveBeenCalledWith("http://example.com");
      expect(mockUrlFetchApp.fetch).not.toHaveBeenCalled();
    });

    test("returns cached error if present (negative cache)", () => {
      mockCache.get.mockReturnValue("__ERROR__:#VALUE!");
      const result = cachedFetch("http://example.com");
      expect(result).toBe("#VALUE!");
      expect(mockCache.get).toHaveBeenCalledWith("http://example.com");
      expect(mockUrlFetchApp.fetch).not.toHaveBeenCalled();
    });

    test("fetches and caches value if not present", () => {
      mockCache.get.mockReturnValue(null);
      mockUrlFetchApp.fetch.mockReturnValue({
        getContentText: () => "fetched content",
        getResponseCode: () => 200,
      });

      const result = cachedFetch("http://example.com", 300);
      expect(result).toBe("fetched content");
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith("http://example.com", {
        muteHttpExceptions: true,
      });
      expect(mockCache.put).toHaveBeenCalledWith(
        "http://example.com",
        "fetched content",
        300,
      );
    });

    test("caches HTTP errors (negative cache) for 60 seconds", () => {
      mockCache.get.mockReturnValue(null);
      mockUrlFetchApp.fetch.mockReturnValue({
        getContentText: () => "Not Found",
        getResponseCode: () => 404,
      });

      const result = cachedFetch("http://example.com", 300);
      expect(result).toBe("#ERROR!: HTTP 404");
      expect(mockCache.put).toHaveBeenCalledWith(
        "http://example.com",
        "__ERROR__:#ERROR!: HTTP 404",
        60,
      );
    });

    test("caches network exceptions (negative cache) for 60 seconds", () => {
      mockCache.get.mockReturnValue(null);
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw new Error("Connection timeout");
      });

      const result = cachedFetch("http://example.com", 300);
      expect(result).toBe("#ERROR!: Connection timeout");
      expect(mockCache.put).toHaveBeenCalledWith(
        "http://example.com",
        "__ERROR__:#ERROR!: Connection timeout",
        60,
      );
    });

    test("does not cache if content exceeds 100KB", () => {
      mockCache.get.mockReturnValue(null);
      const largeContent = "a".repeat(102400); // 100KB exactly
      mockUrlFetchApp.fetch.mockReturnValue({
        getContentText: () => largeContent,
        getResponseCode: () => 200,
      });

      const result = cachedFetch("http://example.com");
      expect(result).toBe(largeContent);
      expect(mockCache.put).not.toHaveBeenCalled();
    });
  });

  describe("cachedFetchAll", () => {
    test("returns empty array for empty inputs", () => {
      expect(cachedFetchAll([])).toEqual([]);
    });

    test("resolves cache hits and performs batch requests for cache misses", () => {
      const urls = ["http://url1.com", "http://url2.com", "http://url3.com"];

      mockCache.getAll.mockReturnValue({
        "http://url1.com": "cached1",
      });
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getContentText: () => "fetched2", getResponseCode: () => 200 },
        { getContentText: () => "fetched3", getResponseCode: () => 200 },
      ]);

      const result = cachedFetchAll(urls, 600);

      expect(result).toEqual(["cached1", "fetched2", "fetched3"]);
      expect(mockCache.getAll).toHaveBeenCalledWith(urls);
      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith([
        { url: "http://url2.com", muteHttpExceptions: true },
        { url: "http://url3.com", muteHttpExceptions: true },
      ]);
      expect(mockCache.putAll).toHaveBeenCalledWith(
        {
          "http://url2.com": "fetched2",
          "http://url3.com": "fetched3",
        },
        600,
      );
    });

    test("handles HTTP errors inside fetchAll and caches them as negative cache entries", () => {
      const urls = ["http://url1.com", "http://url2.com"];

      mockCache.getAll.mockReturnValue({});
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getContentText: () => "success", getResponseCode: () => 200 },
        { getContentText: () => "error", getResponseCode: () => 500 },
      ]);

      const result = cachedFetchAll(urls, 600);

      expect(result).toEqual(["success", "#ERROR!: HTTP 500"]);
      expect(mockCache.putAll).toHaveBeenCalledWith(
        {
          "http://url1.com": "success",
        },
        600,
      );
      expect(mockCache.putAll).toHaveBeenCalledWith(
        {
          "http://url2.com": "__ERROR__:#ERROR!: HTTP 500",
        },
        60,
      );
    });
  });
});

describe("vectorizeBatch", () => {
  const { vectorizeBatch } = require("./utils");

  test("processes scalar input correctly", () => {
    const mockBatchFn = jest.fn((inputs) => {
      return { [inputs[0]]: inputs[0] * 2 };
    });
    const fn = vectorizeBatch(mockBatchFn);

    expect(fn(5)).toBe(10);
    expect(mockBatchFn).toHaveBeenCalledWith([5]);
  });

  test("processes 2D array range input and filters duplicate non-empty values", () => {
    const mockBatchFn = jest.fn((inputs) => {
      const results = {};
      inputs.forEach((v) => {
        results[v] = v * 10;
      });
      return results;
    });
    const fn = vectorizeBatch(mockBatchFn);

    const input = [
      [1, 2, ""],
      [2, 3, "#VALUE!"],
      [null, 1, 3],
    ];
    const expected = [
      [10, 20, ""],
      [20, 30, "#VALUE!"],
      ["", 10, 30],
    ];

    const result = fn(input);
    expect(result).toEqual(expected);
    expect(mockBatchFn).toHaveBeenCalledWith([1, 2, 3]);
  });

  test("handles errors thrown by the batch function gracefully", () => {
    const mockBatchFn = jest.fn(() => {
      throw new Error("API failure");
    });
    const fn = vectorizeBatch(mockBatchFn);

    expect(fn(5)).toBe("#ERROR!: API failure");
    expect(fn([[5, 10]])).toEqual([
      ["#ERROR!: API failure", "#ERROR!: API failure"],
    ]);
  });

  test("returns empty string if value is not mapped in results map", () => {
    const mockBatchFn = jest.fn(() => {
      return { 5: 50 };
    });
    const fn = vectorizeBatch(mockBatchFn);

    expect(fn([[5, 10]])).toEqual([[50, ""]]);
  });

  test("applies type coercion and validation options", () => {
    const mockBatchFn = jest.fn((inputs) => {
      const results = {};
      inputs.forEach((v) => {
        results[v] = v + 1;
      });
      return results;
    });
    const fn = vectorizeBatch(mockBatchFn, {
      type: "number",
      allowEmpty: true,
    });

    expect(fn([["5", "abc", ""]])).toEqual([[6, "#VALUE!", ""]]);
    expect(mockBatchFn).toHaveBeenCalledWith([5]);
  });
});
