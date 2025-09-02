// Google Apps Script — Web App endpoint to collect quiz results
// 1) Créez une Google Sheet et récupérez son ID (URL).
// 2) Ouvrez Apps Script (Extensions > Apps Script), collez ce code, remplacez SHEET_ID et le nom d'onglet.
// 3) Déployez : Déployer > Déployer en tant qu'application web > Accessible par "Tout le monde" (ou votre domaine).
// 4) Collez l'URL du déploiement dans data/config.json (sendResults.endpoint) et mettez enabled=true.

const SHEET_ID = 'VOTRE_SHEET_ID_ICI';
const SHEET_NAME = 'Réponses';

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME) || SpreadsheetApp.openById(SHEET_ID).insertSheet(SHEET_NAME);
    const data = JSON.parse(e.postData.contents);
    const now = new Date();
    const row = [
      now,
      data.quizId || '',
      (data.student && data.student.name) || '',
      (data.student && data.student.id) || '',
      (data.score && data.score.raw) || '',
      (data.score && data.score.max) || '',
      (data.score && data.score.percent) || '',
      (data.time && data.time.totalSec) || '',
      JSON.stringify(data.answers || []),
      JSON.stringify(data.meta || {})
    ];
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}
