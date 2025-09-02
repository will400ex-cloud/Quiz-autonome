// Apps Script endpoint (CORS-safe simple request)
const SHEET_ID = 'VOTRE_SHEET_ID_ICI';  // <-- mets l'ID de ta feuille
const SHEET_NAME = 'Réponses';
const EXPECTED_KEY = ''; // optionnel: mets une clé simple ici et dans config.json > sendResults.apiKey

function _ensureSheet(){ const ss=SpreadsheetApp.openById(SHEET_ID); return ss.getSheetByName(SHEET_NAME)||ss.insertSheet(SHEET_NAME); }
function _parseBody_(e){ const text=e?.postData?.contents||''; try{return JSON.parse(text);}catch(_){ if(e.parameter?.payload){ try{return JSON.parse(e.parameter.payload);}catch(__){} } return null; } }
function doPost(e){
  const p=_parseBody_(e);
  if(!p) return ContentService.createTextOutput(JSON.stringify({ok:false,error:'No/invalid body'})).setMimeType(ContentService.MimeType.JSON);
  if(EXPECTED_KEY && p.apiKey!==EXPECTED_KEY) return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Unauthorized'})).setMimeType(ContentService.MimeType.JSON);
  const sh=_ensureSheet();
  sh.appendRow([ new Date(), p.quizId||'', p.student?.name||'', p.student?.id||'', p.score?.raw||'', p.score?.max||'', p.score?.percent||'', p.time?.totalSec||'', JSON.stringify(p.answers||[]), JSON.stringify(p.meta||{}) ]);
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){ return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT); }
