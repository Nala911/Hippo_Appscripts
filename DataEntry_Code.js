/**
 * Appends data to the active sheet.
 * @param {Object} dataObject The data from the form.
 */
function saveData(dataObject) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Check if headers exist, if not add them
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(['Teacher ID', 'Full Name', 'Department', 'Grade Level', 'Email Address', 'Years of Experience']);
    }
    
    sheet.appendRow([
      dataObject.teacherId,
      dataObject.fullName,
      dataObject.department,
      dataObject.gradeLevel,
      dataObject.email,
      dataObject.experience
    ]);
    
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Gets the next Teacher ID and existing unique values for Department and Grade Level.
 */
function getFormData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  let nextId = "T-101"; // Default start
  let departments = [];
  let gradeLevels = [];
  
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    
    // Get last Teacher ID
    const lastId = data[data.length - 1][0];
    if (lastId && typeof lastId === 'string' && lastId.includes('-')) {
      const parts = lastId.split('-');
      const prefix = parts[0];
      const num = parseInt(parts[1]);
      if (!isNaN(num)) {
        nextId = prefix + '-' + (num + 1);
      }
    }

    // Get unique departments (Column C - index 2)
    departments = [...new Set(data.map(row => row[2]).filter(val => val !== ""))];
    
    // Get unique grade levels (Column D - index 3) and sort ascending
    gradeLevels = [...new Set(data.map(row => row[3]).filter(val => val !== ""))].sort();
  }

  
  return {
    nextId: nextId,
    departments: departments,
    gradeLevels: gradeLevels
  };
}

