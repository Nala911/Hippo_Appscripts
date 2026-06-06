if (typeof require !== "undefined") {
  var { UDF } = require("./utils");
}

/**
 * Adds 2 to the input parameter number or range of numbers.
 *
 * @param {number|number[][]} input The number or range of numbers to add 2 to.
 * @return {number|number[][]} The input number(s) plus 2.
 * @customfunction
 */
const plus2 = UDF.vectorize((val) => val + 2, {
  type: "number",
  allowEmpty: true,
});

if (typeof module !== "undefined") {
  module.exports = { plus2 };
}
