// Auto-injects a button into the app's backup section and imports the Wokabulary CSV.
// Add this script tag to Lerntool.html before </body>:
// <script src="https://raw.githubusercontent.com/dokupendium/Japan/Integrate-basic-wordlist/wokabulary-auto-import.js"></script>

(function () {
  async function parseCSV(text) {
    let delim = ',';
    const firstLine = text.split(/\r?\n/)[0] || '';
    if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delim = ';';
    else if ((firstLine.match(/\t/g) || []).length > 0) delim = '\t';

    const rows = [];
    let cur = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nxt = text[i + 1];
      if (ch === '"') {
        if (inQuotes && nxt === '"') { cur += '"'; i++; continue; }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === delim) {
        row.push(cur);
        cur = '';
        continue;
      }
      if (!inQuotes && (ch === '\n' || ch === '\r')) {
        if (ch === '\r' && nxt === '\n') continue;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur !== '' || row.length > 0) {
      row.push(cur);
      rows.push(row);
    }
    return rows;
  }

  function normalize(str) {
    return String(str || '').trim();
  }

  function parseFurigana(input) {
    return normalize(input).replace(/([^\(\)]+)\(([^\)]+)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
  }

  function getColumnIndex(headers, patterns) {
    const lower = headers.map(h => String(h || '').toLowerCase());
    for (const p of patterns) {
      for (let i = 0; i < lower.length; i++) {
        if (lower[i].includes(p)) return i;
      }
    }
    return -1;
  }

  async function importWokabularyCommunication() {
    const url = 'https://wokabulary.com/assets/wordlists/de-ja/de-ja_communication.csv';
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      const txt = await res.text();
      const rows = parseCSV(txt).filter(r => r.some(c => normalize(c).length > 0));
      if (rows.length < 2) throw new Error('CSV leer oder unpassend formatiert.');

      const header = rows[0].map(h => normalize(h));
      const dataRows = rows.slice(1);
      const jpCol = getColumnIndex(header, ['jap', 'japanese', 'kanji', 'word', 'headword', 'jpn']);
      const deCol = getColumnIndex(header, ['de', 'german', 'ger', 'translation', 'gloss']);
      const exampleCol = getColumnIndex(header, ['example', 'note', 'notes', 'comment', 'info']);

      const mapped = dataRows.map(cols => {
        let japanese = '';
        let german = '';
        let example = '';

        if (jpCol >= 0) japanese = cols[jpCol] || '';
        if (deCol >= 0) german = cols[deCol] || '';
        if (exampleCol >= 0) example = cols[exampleCol] || '';

        if (jpCol < 0 && deCol >= 0 && cols.length >= 2) {
          japanese = cols[0] || '';
        }
        if (deCol < 0 && jpCol >= 0 && cols.length >= 2) {
          german = cols[1] || '';
        }
        if (jpCol < 0 && deCol < 0 && cols.length >= 2) {
          japanese = cols[0] || '';
          german = cols[1] || '';
        }

        return {
          category: 'Vokabeln',
          japanese: parseFurigana(japanese),
          german: normalize(german),
          example: normalize(example),
          verbType: ''
        };
      }).filter(item => item.japanese || item.german);

      const existing = JSON.parse(localStorage.getItem('yvi_vocab_final')) || [];
      const seen = new Set(existing.map(item => ((item.japanese || '') + '||' + (item.german || '')).toLowerCase()));
      const additions = [];
      for (const item of mapped) {
        const key = ((item.japanese || '') + '||' + (item.german || '')).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          existing.push(item);
          additions.push(item);
        }
      }

      localStorage.setItem('yvi_vocab_final', JSON.stringify(existing));

      if (typeof window.vocabularies !== 'undefined') {
        window.vocabularies = existing;
        if (typeof window.filterQuizList === 'function') window.filterQuizList();
        if (typeof window.renderList === 'function') window.renderList();
      }

      alert('Wokabulary-Import fertig: ' + additions.length + ' neue Einträge. Gesamt: ' + existing.length);
      return { imported: additions.length, total: existing.length };
    } catch (err) {
      console.error(err);
      alert('Wokabulary-Import fehlgeschlagen: ' + err.message);
      throw err;
    }
  }

  function injectButton() {
    const target = document.querySelector('#backup .backup-actions') || document.querySelector('.backup-actions');
    if (!target) return;
    const existing = document.getElementById('wokabulary-import-btn');
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = 'wokabulary-import-btn';
    btn.className = 'backup-btn';
    btn.type = 'button';
    btn.textContent = '📥 Wokabulary-CSV importieren';
    btn.onclick = function () {
      importWokabularyCommunication();
    };
    target.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButton, { once: true });
  } else {
    injectButton();
  }

  window.importWokabularyCommunication = importWokabularyCommunication;
})();
