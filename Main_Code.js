/**
 * Creates a custom menu in the Google Sheet.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hippo App')
    .addItem('Launch Web App', 'openApp')
    .addToUi();
}

/**
 * Displays the Web App URL in a dialog.
 */
function openApp() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert("Web App not deployed. Please deploy it from 'Deploy > New deployment' as a Web App.");
    return;
  }
  
  const html = `
    <div style="font-family: 'Outfit', sans-serif; padding: 20px; text-align: center;">
      <p style="margin-bottom: 20px;">The Hippo Teacher Management System is ready.</p>
      <a href="${url}" target="_blank" style="
        background-color: #1a73e8;
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        display: inline-block;
      ">Launch Web App</a>
      <p style="margin-top: 20px; font-size: 0.8rem; color: #5f6368;">URL: ${url}</p>
    </div>
  `;
  
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(400)
    .setHeight(200)
    .setTitle('Hippo Web App');
    
  SpreadsheetApp.getUi().showModalDialog(ui, 'Hippo App');
}
