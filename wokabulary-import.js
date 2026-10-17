// wokabulary-import.js
// Usage:
// 1) Open your Lerntool (Lerntool.html) in the browser (served from GitHub Pages or open file).
// 2) Open DevTools Console and paste the contents of this file, or load it as a script in the page.
// 3) Run: importWokabularyCommunication();
// This will fetch the CSV from Wokabulary (de-ja_communication.csv), try to map columns to Japanese and German,
// convert simple furigana parenthesis to the app's <ruby> markup, merge deduplicated entries into
// localStorage key 'yvi_vocab_final' and update the in-page `vocabularies` variable if present.

async function importWokabularyCSVToLocalStorage(url) {
  function parseCSV(text) {
    // detect delimiter: semicolon or comma or tab
    let delim = ',';
    const firstLine = text.split(/\r?\n/)[0] || '';
    if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delim = ';';
    else if ((firstLine.match(/\t/g) || []).length > 0) delim = '\t';

    // basic CSV parser supporting quoted fields
    const rows = [];
    let cur = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nxt = text[i+1];
      if (ch === '"') {
        if (inQuotes && nxt === '"') { cur += '"'; i++; continue; } // escaped quote
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === delim) {
        row.push(cur);
        cur = '';
        continue;
      }
      if (!inQuotes && (ch === '\n' || ch === '\r')) {
        // handle CRLF
        if (ch === '\r' && nxt === '\n') continue; // ignore CR, will handle on LF
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
        continue;
      }
      cur += ch;
    }
    // push last
    if (cur !== '' || row.length > 0) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  function tryFindColumnIndex(headers, patterns) {
    const lower = headers.map(h => String(h||'').toLowerCase());
    for (let p of patterns) {
      for (let i = 0; i < lower.length; i++) {
        if (lower[i].includes(p)) return i;
      }
    }
    return -1;
  }

  function parseFurigana(input) {
    // convert forms like 日本(にほん) into <ruby>日本<rt>にほん</rt></ruby>
    return String(input || '').replace(/([^\(\)]+)\(([^\)]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const txt = await res.text();
    const rows = parseCSV(txt).filter(r => r.length > 0);
    if (rows.length === 0) throw new Error('CSV leer oder konnte nicht geparst werden.');

    const header = rows[0].map(h => (h||'').trim());
    const dataRows = rows.slice(1).filter(r => r.some(c => (c||'').trim().length > 0));

    // heuristics to find japanese and german columns
    const jpCol = tryFindColumnIndex(header, ['jap','japanese','kanji','orth','word','headword','jpn']);
    const deCol = tryFindColumnIndex(header, ['de','german','ger','translation','gloss','engl']);
    const exampleCol = tryFindColumnIndex(header, ['example','note','notes','info','comment']);

    // fallback: if exactly 2 columns assume [jp, de]
    const effectiveRows = dataRows.map(r => r.map(c => (c||'').trim()));
    const mapped = effectiveRows.map(cols => {
      let japanese = '';
      let german = '';
      let example = '';
      if (jpCol >= 0) japanese = cols[jpCol] || '';
      if (deCol >= 0) german = cols[deCol] || '';
      if (exampleCol >= 0) example = cols[exampleCol] || '';

      if (jpCol < 0 && deCol < 0) {
        // try common case: two columns
        if (cols.length >= 2) {
          japanese = cols[0]; german = cols[1];
        } else if (cols.length === 1) {
          japanese = cols[0]; german = '';
        }
      } else if (jpCol < 0 && deCol >= 0) {
        // maybe jp in first column
        japanese = cols[0] || '';
      } else if (deCol < 0 && jpCol >= 0) {
        german = cols[1] || '';
      }

      return {
        japanese: parseFurigana(japanese),
        german: german,
        example: example,
        category: 'Vokabeln',
        verbType: ''
      };
    }).filter(x => (x.japanese || x.german));

    // read existing
    const existing = JSON.parse(localStorage.getItem('yvi_vocab_final')) || [];
    const key = x => ((x.japanese||'') + '||' + (x.german||'')).toLowerCase();
    const seen = new Set(existing.map(e => key(e)));
    const newOnes = [];
    for (let it of mapped) {
      const k = key(it);
      if (!seen.has(k)) { seen.add(k); newOnes.push(it); existing.push(it); }
    }

    localStorage.setItem('yvi_vocab_final', JSON.stringify(existing));

    // if the page has a global `vocabularies` variable, update it and refresh list
    try {
      if (typeof vocabularies !== 'undefined') {
        vocabularies = existing;
        if (typeof filterQuizList === 'function') filterQuizList();
        if (typeof renderList === 'function') renderList();
      }
    } catch (e) { /* ignore */ }

    return { imported: newOnes.length, total: existing.length };
  } catch (err) {
    throw err;
  }
}

// helper for the known URL the user requested
async function importWokabularyCommunication() {
  const url = 'https://wokabulary.com/assets/wordlists/de-ja/de-ja_communication.csv';
  try {
    const r = await importWokabularyCSVToLocalStorage(url);
    alert('Import fertig: ' + r.imported + ' neue Einträge. Gesamt: ' + r.total);
    return r;
  } catch (err) {
    console.error(err);
    alert('Import fehlgeschlagen: ' + err.message);
    throw err;
  }
}

// Export as module default for environments that support it
if (typeof module !== 'undefined' && module.exports) module.exports = { importWokabularyCSVToLocalStorage, importWokabularyCommunication };
