// Lightweight CSV loader (handles quoted fields, escaped quotes, newlines)
const CSV = {
  parse(text) {
    const rows = [];
    let i = 0, field = '', row = [], inQuotes = false;
    while (i < text.length) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (text[i+1] === '"') { field += '"'; i++; } // escaped quote
          else { inQuotes = false; }
        } else { field += char; }
      } else {
        if (char === '"') { inQuotes = true; }
        else if (char === ',') { row.push(field); field=''; }
        else if (char === '\n') { row.push(field); rows.push(row); row=[]; field=''; }
        else if (char === '\r') { /* ignore */ }
        else { field += char; }
      }
      i++;
    }
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  },
  toObjects(text) {
    const rows = this.parse(text);
    if (!rows.length) return [];
    const headers = rows.shift().map(h => h.trim());
    return rows
      .filter(r => r.some(cell => (cell||'').trim() !== ''))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => obj[h] = (r[idx] ?? '').trim());
        return obj;
      });
  }
};

async function loadCSV(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de charger le CSV: ' + res.status);
  const text = await res.text();
  return CSV.toObjects(text);
}
