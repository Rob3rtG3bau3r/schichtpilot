// src/utils/spCsv.js

export function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

// sehr robuste "simple CSV" Parser-Variante (Quotes + delimiter auto)
export function parseCsv(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!raw) return { rows: [], delimiter: ',' };

  const firstLine = raw.split('\n')[0] || '';
  const delimiter = detectDelimiter(firstLine);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];

    if (c === '"') {
      // doppelte Quotes in Quotes -> escaped quote
      if (inQuotes && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && c === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += c;
  }

  // last field
  row.push(field);
  rows.push(row);

  // trim cells
  const clean = rows.map((r) => r.map((v) => String(v ?? '').trim()));
  return { rows: clean, delimiter };
}

export function rowsToObjects(rows) {
  if (!rows?.length) return [];
  const header = rows[0].map((h) => normalizeHeader(h));
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r?.length || r.every((c) => String(c || '').trim() === '')) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = (r[j] ?? '').trim();
    }
    out.push(obj);
  }
  return out;
}

export function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

export function toNumberDE(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
