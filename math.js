/**
 * Adds 2 to the input parameter number or range of numbers.
 *
 * @param {number|number[][]} input The number or range of numbers to add 2 to.
 * @return {number|number[][]} The input number(s) plus 2.
 * @customfunction
 */
function plus2(input) {
  if (Array.isArray(input)) {
    return input.map(row => {
      if (Array.isArray(row)) {
        return row.map(cell => plus2Single(cell));
      }
      return plus2Single(row);
    });
  }
  return plus2Single(input);
}

/**
 * Helper function to add 2 to a single value.
 * Handles empty values, null, and non-numeric inputs.
 * 
 * @param {*} value The cell value to process.
 * @return {number|string} The value plus 2, or error/empty.
 */
function plus2Single(value) {
  // If the cell is empty, return empty string so it doesn't display '2' or error in sheets
  if (value === null || value === undefined || value === '') {
    return '';
  }
  
  const num = Number(value);
  if (isNaN(num)) {
    return '#VALUE!';
  }
  
  return num + 2;
}

if (typeof module !== 'undefined') {
  module.exports = { plus2, plus2Single };
}
