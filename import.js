/* FlexLex — spreadsheet import for the web set builder.
 *
 * Reads .xlsx, .csv, .tsv and .txt entirely in the browser. Nothing is
 * uploaded: the file is read with FileReader and parsed here, which is the
 * same no-server promise the share links make.
 *
 * No third-party library. .xlsx is a ZIP of XML, and the platform already
 * gives us both halves — DecompressionStream('deflate-raw') to inflate the
 * entries and DOMParser to read them. (The site already depends on
 * DecompressionStream('gzip') for share links, so this needs no browser we
 * didn't already need.) SheetJS would be ~400KB and, more to the point, the
 * pages here deliberately ship nothing from a third party — see the note on
 * the vendored qrcode.js.
 *
 * Usage:
 *   FlexLexImport.parseFile(file) -> Promise<{
 *     pairs: [{word, translation}],   // already trimmed + capped
 *     sheet: string|null,             // sheet name, .xlsx only
 *     droppedHeader: boolean,         // first row looked like a header
 *     truncated: number,              // rows dropped by MAX_WORDS
 *     source: 'xlsx'|'csv'|'tsv'
 *   }>
 * Throws Error with a human-readable message.
 */
(function () {
  'use strict';

  var MAX_WORDS = 5000;   // mirrors create/index.html + share_link_format.dart
  var MAX_FIELD = 500;    // mirrors _kMaxFieldLength
  var MAX_BYTES = 12 * 1024 * 1024;

  function cap(s) {
    return s.length > MAX_FIELD ? s.slice(0, MAX_FIELD) : s;
  }

  /* ── ZIP ──────────────────────────────────────────────────────────────
   * Only what .xlsx needs: no encryption, no multi-disk, no ZIP64. Sizes and
   * offsets come from the central directory, never the local header — local
   * headers may carry zeroes when the writer used a data descriptor, which
   * Excel does.
   */
  function openZip(buf) {
    var dv = new DataView(buf);
    var eocd = -1;
    // EOCD is at the end, after a comment of up to 64KB.
    var floor = Math.max(0, buf.byteLength - 65557);
    for (var i = buf.byteLength - 22; i >= floor; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('That file isn’t a readable .xlsx.');

    var count = dv.getUint16(eocd + 10, true);
    var off = dv.getUint32(eocd + 16, true);
    var files = {};
    var dec = new TextDecoder();
    for (var n = 0; n < count; n++) {
      if (off + 46 > buf.byteLength) break;
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true);
      var compSize = dv.getUint32(off + 20, true);
      var nameLen = dv.getUint16(off + 28, true);
      var extraLen = dv.getUint16(off + 30, true);
      var cmtLen = dv.getUint16(off + 32, true);
      var localOff = dv.getUint32(off + 42, true);
      var name = dec.decode(new Uint8Array(buf, off + 46, nameLen));
      files[name] = { method: method, size: compSize, at: localOff };
      off += 46 + nameLen + extraLen + cmtLen;
    }
    return { buf: buf, dv: dv, files: files };
  }

  async function readEntry(zip, name) {
    var f = zip.files[name];
    if (!f) return null;
    var dv = zip.dv;
    if (dv.getUint32(f.at, true) !== 0x04034b50) return null;
    var nameLen = dv.getUint16(f.at + 26, true);
    var extraLen = dv.getUint16(f.at + 28, true);
    var start = f.at + 30 + nameLen + extraLen;
    var bytes = new Uint8Array(zip.buf, start, f.size);
    if (f.method === 0) return new TextDecoder().decode(bytes);
    if (f.method !== 8) throw new Error('That .xlsx uses an unsupported compression.');
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return await new Response(stream).text();
  }

  /* ── XML helpers ─────────────────────────────────────────────────────── */
  function parseXml(text, what) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('The ' + what + ' inside that .xlsx is malformed.');
    }
    return doc;
  }

  // Namespace-agnostic: writers differ on prefixes.
  function tags(node, name) {
    return node.getElementsByTagNameNS('*', name);
  }

  function textOf(node) {
    var t = tags(node, 't');
    var out = '';
    for (var i = 0; i < t.length; i++) out += t[i].textContent;
    return out;
  }

  // "BC12" -> 54. Excel columns are bijective base-26, not zero-padded.
  function colOf(ref) {
    var n = 0;
    for (var i = 0; i < ref.length; i++) {
      var c = ref.charCodeAt(i);
      if (c < 65 || c > 90) break;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  /* ── xlsx ─────────────────────────────────────────────────────────────
   * Reads the first sheet in *workbook order*, which is the one the user sees
   * first — not xl/worksheets/sheet1.xml, whose filename says nothing about
   * position. Falls back to sheet1.xml only if the rels lookup fails.
   */
  async function firstSheetPath(zip) {
    try {
      var wbXml = await readEntry(zip, 'xl/workbook.xml');
      var relsXml = await readEntry(zip, 'xl/_rels/workbook.xml.rels');
      if (wbXml && relsXml) {
        var wb = parseXml(wbXml, 'workbook');
        var sheets = tags(wb, 'sheet');
        if (sheets.length) {
          var name = sheets[0].getAttribute('name');
          var rid = sheets[0].getAttribute('r:id') ||
            sheets[0].getAttributeNS(
              'http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
          var rels = parseXml(relsXml, 'relationships');
          var rl = tags(rels, 'Relationship');
          for (var i = 0; i < rl.length; i++) {
            if (rl[i].getAttribute('Id') === rid) {
              var t = rl[i].getAttribute('Target').replace(/^\/?xl\//, '').replace(/^\//, '');
              return { path: 'xl/' + t, name: name };
            }
          }
        }
      }
    } catch (e) { /* fall through to the conventional path */ }
    return { path: 'xl/worksheets/sheet1.xml', name: null };
  }

  async function parseXlsx(buf) {
    var zip = openZip(buf);

    var shared = [];
    var ssXml = await readEntry(zip, 'xl/sharedStrings.xml');
    if (ssXml) {
      var ss = parseXml(ssXml, 'shared strings');
      var si = tags(ss, 'si');
      // <si> may hold one <t>, or several <r><t> runs when the cell is
      // rich-styled — concatenating every <t> covers both.
      for (var i = 0; i < si.length; i++) shared.push(textOf(si[i]));
    }

    var target = await firstSheetPath(zip);
    var shXml = await readEntry(zip, target.path);
    if (!shXml) throw new Error('That .xlsx has no readable sheet.');
    var sheet = parseXml(shXml, 'sheet');

    var rowEls = tags(sheet, 'row');
    var grid = [];
    for (var r = 0; r < rowEls.length; r++) {
      var cells = tags(rowEls[r], 'c');
      var row = [];
      for (var c = 0; c < cells.length; c++) {
        var cell = cells[c];
        var ref = cell.getAttribute('r') || '';
        // Honour the cell's real column so a gap (B empty, C filled) doesn't
        // silently shift C's value left into B.
        var idx = ref ? colOf(ref) : c;
        if (idx < 0) idx = c;
        row[idx] = cellValue(cell, shared);
      }
      grid.push(row);
    }
    return { grid: grid, sheet: target.name, source: 'xlsx' };
  }

  function cellValue(cell, shared) {
    var t = cell.getAttribute('t');
    if (t === 'inlineStr') return textOf(cell);
    var v = tags(cell, 'v')[0];
    if (!v) return '';
    var raw = v.textContent;
    if (t === 's') {
      var i = parseInt(raw, 10);
      return shared[i] == null ? '' : shared[i];
    }
    if (t === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
    // Numbers arrive as text already; dates are serial numbers we don't try to
    // decode — a vocabulary set shouldn't have any, and guessing at the style
    // table would be worse than showing what's there.
    return raw;
  }

  /* ── delimited text ───────────────────────────────────────────────────
   * RFC 4180: quoted fields may contain the delimiter, newlines, and "" for a
   * literal quote.
   */
  function parseDelimited(text, delim) {
    var grid = [];
    var row = [];
    var field = '';
    var quoted = false;
    var i = 0;

    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM

    function endField() { row.push(field); field = ''; }
    function endRow() { endField(); grid.push(row); row = []; }

    while (i < text.length) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          quoted = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"' && field === '') { quoted = true; i++; continue; }
      if (ch === delim) { endField(); i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { endRow(); i++; continue; }
      field += ch; i++;
    }
    if (field !== '' || row.length) endRow();
    return grid;
  }

  // Pick the delimiter that best explains the first few lines, so a set full
  // of "hello, world" commas doesn't get read as a comma-separated file when
  // it's really tab-separated.
  function sniffDelimiter(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); }).slice(0, 20);
    if (!lines.length) return ',';
    var best = ',', bestScore = -1;
    [['\t', 'tsv'], [',', 'csv'], [';', 'csv']].forEach(function (d) {
      var counts = lines.map(function (l) { return l.split(d[0]).length - 1; });
      var min = Math.min.apply(null, counts);
      if (min < 1) return;                       // not on every line → not it
      var total = counts.reduce(function (a, b) { return a + b; }, 0);
      // Consistency matters more than volume.
      var score = min * 100 + total;
      if (score > bestScore) { bestScore = score; best = d[0]; }
    });
    return best;
  }

  /* ── grid → pairs ─────────────────────────────────────────────────────── */
  var HEADERS = [
    'word', 'words', 'term', 'terms', 'front', 'question', 'source',
    'vocabulary', 'vocab', 'original', 'expression', 'phrase',
    'translation', 'translations', 'meaning', 'definition', 'back',
    'answer', 'target', 'english', 'german', 'spanish', 'french'
  ];

  function looksLikeHeader(row) {
    if (!row || !row.length) return false;
    var cells = row.filter(function (c) { return (c || '').trim(); });
    if (!cells.length) return false;
    var hits = cells.filter(function (c) {
      return HEADERS.indexOf(c.trim().toLowerCase()) !== -1;
    });
    // Both columns named → certainly a header. One of two → good enough.
    return hits.length >= Math.min(2, cells.length);
  }

  function toPairs(grid) {
    var rows = grid.filter(function (r) {
      return r && r.some(function (c) { return (c || '').trim(); });
    });

    var droppedHeader = false;
    if (rows.length > 1 && looksLikeHeader(rows[0])) {
      rows = rows.slice(1);
      droppedHeader = true;
    }

    var pairs = [];
    var truncated = 0;
    for (var i = 0; i < rows.length; i++) {
      if (pairs.length >= MAX_WORDS) { truncated = rows.length - i; break; }
      var r = rows[i];
      var word = cap(((r[0] == null ? '' : r[0]) + '').trim());
      var translation = cap(((r[1] == null ? '' : r[1]) + '').trim());
      // A row with only a translation is still a row — the app allows a word
      // with an empty side, and dropping it would lose the user's data.
      if (!word && !translation) continue;
      pairs.push({ word: word, translation: translation });
    }
    return { pairs: pairs, droppedHeader: droppedHeader, truncated: truncated };
  }

  /* ── entry point ──────────────────────────────────────────────────────── */
  function readAsArrayBuffer(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error('Could not read that file.')); };
      fr.readAsArrayBuffer(file);
    });
  }

  function readAsText(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error('Could not read that file.')); };
      fr.readAsText(file);
    });
  }

  /* .flexlex.json — what the app's "Download file" and this site's /s page
   * both emit. Accepting it back closes the loop: export from the app, study
   * or edit it here. Tolerant like the share decoder: unknown keys ignored,
   * both the folders envelope and a bare array accepted.
   */
  function fromJson(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('That .json file isn’t valid JSON.');
    }

    var words = null;
    var name = '';
    if (data && Array.isArray(data.folders) && data.folders.length) {
      var f = data.folders[0];
      words = f.words;
      name = f.name || '';
    } else if (Array.isArray(data)) {
      words = data;
    } else if (data && Array.isArray(data.words)) {
      words = data.words;
      name = data.name || '';
    }
    if (!Array.isArray(words)) {
      throw new Error('That .json file isn’t a FlexLex set.');
    }

    var grid = words.map(function (w) {
      if (Array.isArray(w)) return [w[0], w[1]];
      if (w && typeof w === 'object') {
        return [w.word != null ? w.word : w.w, w.translation != null ? w.translation : w.t];
      }
      return [w, ''];
    });
    return { grid: grid, name: name };
  }

  async function parseFile(file) {
    if (!file) throw new Error('No file chosen.');
    if (file.size > MAX_BYTES) {
      throw new Error('That file is larger than 12 MB.');
    }
    var name = (file.name || '').toLowerCase();

    if (/\.xls$/.test(name)) {
      throw new Error(
        'Old .xls files aren’t supported. Open it in Excel and use ' +
        'File → Save As → .xlsx (or .csv).');
    }
    if (/\.numbers$/.test(name)) {
      throw new Error('Numbers files aren’t supported — export to .csv or .xlsx first.');
    }

    if (/\.xlsx$/.test(name)) {
      var buf = await readAsArrayBuffer(file);
      var x = await parseXlsx(buf);
      var out = toPairs(x.grid);
      out.sheet = x.sheet;
      out.source = 'xlsx';
      return out;
    }

    var text = await readAsText(file);

    if (/\.json$/.test(name)) {
      var j = fromJson(text);
      var jr = toPairs(j.grid);
      // A JSON set has no header row to guess at.
      jr.droppedHeader = false;
      jr.sheet = null;
      jr.setName = j.name;
      jr.source = 'json';
      return jr;
    }

    var delim = /\.tsv$/.test(name) ? '\t' : sniffDelimiter(text);
    var grid = parseDelimited(text, delim);
    var res = toPairs(grid);
    res.sheet = null;
    res.source = delim === '\t' ? 'tsv' : 'csv';
    return res;
  }

  window.FlexLexImport = {
    parseFile: parseFile,
    MAX_WORDS: MAX_WORDS,
    MAX_FIELD: MAX_FIELD,
    // exposed for tests
    _parseDelimited: parseDelimited,
    _sniffDelimiter: sniffDelimiter,
    _toPairs: toPairs,
    _colOf: colOf,
    _fromJson: fromJson
  };
})();
