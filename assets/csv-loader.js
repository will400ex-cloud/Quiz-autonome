// CSV loader with delimiter auto-detect (comma or semicolon) and BOM trim
const CSV = {
  _stripBOM(text) { return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text; },
  _detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (!lines.length) return ',';
    const first = lines[0];
    const c = (first.match(/,/g) || []).length;
    const s = (first.match(/;/g) || []).length;
    return s > c ? ';' : ',';
  },
  parse(text) {
    text = this._stripBOM(text);
    const delim = this._detectDelimiter(text);
    const rows = [];
    let i = 0, field = '', row = [], inQuotes = false;
    while (i < text.length) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (text[i+1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += char; }
      } else {
        if (char === '"') { inQuotes = true; }
        else if (char === delim) { row.push(field); field=''; }
        else if (char === '\n') { row.push(field); rows.push(row); row=[]; field=''; }
        else if (char === '\r') { /* ignore */ }
        else { field += char; }
      }
      i++;
    }
    row.push(field);
    if (row.length > 1 || row[0] != '') rows.push(row);
    return rows;
  },
  toObjects(text) {
    const rows = this.parse(text);
    if (!rows.length) return [];
    const headers = rows.shift().map(h => h.trim().toLowerCase());
    const required = ['question','option_a','option_b','option_c','option_d','correct'];
    const missing = required.filter(h => !headers.includes(h));
    if (missing.length) { throw new Error('Colonnes manquantes: ' + missing.join(', ')); }
    return rows
      .filter(r => r.some(cell => (cell||'').trim() !== ''))
      .map(r => { const obj = {}; headers.forEach((h,i)=> obj[h]=(r[i]??'').trim()); return obj; });
  }
};
async function loadCSV(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de charger le CSV: ' + res.status + ' ' + url);
  const text = await res.text();
  return CSV.toObjects(text);
}
