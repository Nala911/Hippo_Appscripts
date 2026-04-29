/**
 * Creates a custom menu in the Google Sheet.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Toolbox')
    .addItem('Data entry', 'dataentry')
    .addItem('Generate Report', 'GenerateReport')
    .addToUi();
}

/**
 * Displays the Data Entry full-screen modal form.
 */
function dataentry() {
  const html = HtmlService.createTemplateFromFile('DataEntry_Sidebar')
    .evaluate()
    .setWidth(800)
    .setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add New Teacher Record');
}


/**
 * Displays the Generate PDF sidebar.
 */
function GenerateReport() {
  const html = HtmlService.createTemplateFromFile('GeneratePDF_Sidebar')
    .evaluate()
    .setTitle('Generate PDF')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}
