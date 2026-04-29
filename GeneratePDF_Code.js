/**
 * Fetches teacher names from the second column of the active sheet.
 */
function getTeacherNames() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Only headers or empty
  
  // Get all names from Column B (index 1), skipping the header
  const names = data.slice(1).map(row => row[1]).filter(String);
  return [...new Set(names)]; // Return unique names
}

/**
 * Generates a PDF from PDF_Template.html and returns it as a Base64 string.
 */
function getPDFBase64(teacherName) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const teacherRow = data.find(row => row[1] === teacherName);

    if (!teacherRow) throw new Error("Teacher not found: " + teacherName);

    let htmlContent = HtmlService.createHtmlOutputFromFile('PDF_Template').getContent();

    // Replace placeholders with row data
    headers.forEach((header, index) => {
      const placeholder = `{{${header}}}`;
      // Use a global regex to replace all occurrences
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
