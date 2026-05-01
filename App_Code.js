/**
 * MAIN WEB APP ENTRY POINT
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('App_UI')
    .evaluate()
    .setTitle('Hippo - Teacher Management System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * DATABASE CONFIGURATION
 */
const CONFIG = {
  SHEET_NAME: 'Teachers',
  DEFAULT_HEADERS: ['Teacher ID', 'Full Name', 'Department', 'Grade Level', 'Email Address', 'Years of Experience']
};

/**
 * UTILITY: Get the Teachers sheet
 */
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(CONFIG.SHEET_NAME) || ss.getSheets()[0];
}

/**
 * 1. DIRECTORY LOGIC: Fetch all teachers
 */
function getAllTeachers() {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    return data.slice(1).map(row => {
      let teacher = {};
      headers.forEach((header, index) => teacher[header] = row[index]);
      return teacher;
    });
  } catch (e) {
    console.error('Error fetching teachers: ' + e.toString());
    return [];
  }
}

/**
 * 2. DATA ENTRY LOGIC: Save a new teacher
 */
function saveData(dataObject) {
  try {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow === 0) {
      sheet.appendRow(CONFIG.DEFAULT_HEADERS);
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
 * 2b. DATA ENTRY LOGIC: Get metadata for the form
 */
function getFormData() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  
  let nextId = "T-101";
  let departments = [];
  let gradeLevels = [];
  
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    const lastId = data[data.length - 1][0];
    if (lastId && typeof lastId === 'string' && lastId.includes('-')) {
      const parts = lastId.split('-');
      nextId = parts[0] + '-' + (parseInt(parts[1]) + 1);
    }
    departments = [...new Set(data.map(row => row[2]).filter(String))].sort();
    gradeLevels = [...new Set(data.map(row => row[3]).filter(String))].sort();
  }
  
  return { nextId, departments, gradeLevels };
}

/**
 * 3. REPORTS LOGIC: Fetch names for dropdown
 */
function getTeacherNames() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return [...new Set(data.slice(1).map(row => row[1]).filter(String))].sort();
}

/**
 * 3b. REPORTS LOGIC: Generate PDF
 */
function getPDFBase64(teacherName) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const teacherRow = data.find(row => row[1] === teacherName);

    if (!teacherRow) throw new Error("Teacher not found: " + teacherName);

    let htmlContent = HtmlService.createHtmlOutputFromFile('PDF_Template').getContent();

    headers.forEach((header, index) => {
      const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`{{${escapedHeader}}}`, 'g');
      htmlContent = htmlContent.replace(regex, teacherRow[index]);
    });

    const blob = HtmlService.createHtmlOutput(htmlContent).getAs('application/pdf');
    blob.setName(`${teacherName}_Profile.pdf`);
    
    return {
      success: true,
      base64: Utilities.base64Encode(blob.getBytes()),
      fileName: `${teacherName}_Profile.pdf`
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
