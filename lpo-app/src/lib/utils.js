export const uid = () => Math.random().toString(36).slice(2, 9);

export const formatBytes = b =>
  b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

export const detectMime = name => {
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.(jpg|jpeg)$/i.test(name)) return 'image/jpeg';
  if (/\.webp$/i.test(name)) return 'image/webp';
  if (/\.tiff?$/i.test(name)) return 'image/tiff';
  return 'application/octet-stream';
};

export const isAllowed = f =>
  /\.(pdf|png|jpg|jpeg|webp|tiff?)$/i.test(f.name);

// Fields never shown in the table or CSV
const INTERNAL_FIELDS = new Set([
  'combined_string','file_base64','binary','document_base64',
  'file_mime','pipeline_status','quality_score',
  'sheets_url','sheetsUrl','google_sheets_url',
  'Accuracy','accuracy',
  // Snake-case metadata that doesn't belong in output
  'lpo_index','lpo_count','calculated_total','total_quantity',
  'math_status','math_errors','total_diff','supplier_correct',
  'items_total','items_review','item_confidence',
  'quantity_sources','barcode_sources','line_number',
]);

// Canonical display order — PascalCase
export const COL_ORDER = [
  'LPO_Number','Supplier','Supermarket','Branch','Date',
  'Item_Code','Barcode','Item_Description',
  'Quantity','Unit_Price','Line_Total','Grand_Total',
  'Math_Correct','Status','Status_Reasons','Source_File',
];

// snake_case → PascalCase field name map (matching what Google Sheets uses)
const FIELD_MAP = {
  lpo_number:       'LPO_Number',
  supplier:         'Supplier',
  supermarket:      'Supermarket',
  branch:           'Branch',
  date:             'Date',
  delivery_date:    'Delivery_Date',
  item_code:        'Item_Code',
  barcode:          'Barcode',
  description:      'Item_Description',
  quantity:         'Quantity',
  unit_price:       'Unit_Price',
  line_total:       'Line_Total',
  grand_total:      'Grand_Total',
  subtotal:         'Subtotal',
  vat_rate:         'VAT_Rate',
  math_correct:     'Math_Correct',
  status:           'Status',
  status_reasons:   'Status_Reasons',
  source_file:      'Source_File',
  sources_used:     'Sources_Used',
  sources_agreed:   'Sources_Agreed',
};

// Normalize a single raw row (snake or PascalCase) to PascalCase display row
function normalizeRow(r) {
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    if (INTERNAL_FIELDS.has(k)) continue;
    const mapped = FIELD_MAP[k.toLowerCase()] || FIELD_MAP[k] || k;
    if (INTERNAL_FIELDS.has(mapped)) continue;
    // Join array values (e.g. status_reasons: ["a","b"] → "a | b")
    out[mapped] = Array.isArray(v) ? v.filter(Boolean).join(' | ') : v;
  }
  return out;
}

// Sort row keys in COL_ORDER first, then any extras
function orderRow(r) {
  const out = {};
  COL_ORDER.forEach(k => { if (k in r) out[k] = r[k]; });
  Object.keys(r).forEach(k => { if (!(k in out)) out[k] = r[k]; });
  return out;
}

// Extract ALL LPO objects from combined_string
// Format: JSON array → each item has content[].text → JSON LPO object
function extractLpos(combinedStr) {
  try {
    const outer = JSON.parse(combinedStr);
    if (!Array.isArray(outer)) return [];
    const lpos = [];
    for (const chunk of outer) {
      const contents = chunk?.content || (chunk?.type === 'text' ? [chunk] : []);
      for (const c of contents) {
        if (c?.type !== 'text' || !c?.text) continue;
        try {
          const obj = JSON.parse(c.text);
          if (obj && typeof obj === 'object') lpos.push(obj);
        } catch {}
      }
    }
    return lpos;
  } catch { return []; }
}

// Expand a single LPO object (with line_items) into one row per item
function lpoToRows(lpo, fallback = {}) {
  const header = normalizeRow({
    lpo_number:  lpo.lpo_number  || fallback.LPO_Number  || '',
    supplier:    lpo.supplier    || fallback.Supplier     || '',
    supermarket: lpo.supermarket || fallback.Supermarket  || '',
    branch:      lpo.branch      || fallback.Branch       || '',
    date:        lpo.date        || fallback.Date         || '',
    grand_total: lpo.grand_total || '',
  });

  const items = lpo.line_items || lpo.items || lpo.products || lpo.rows || [];
  if (!items.length) return [orderRow(header)];

  return items.map(it => orderRow({
    ...header,
    Item_Code:        it.item_code   || it.Item_Code   || '',
    Barcode:          it.barcode     || '',
    Item_Description: it.description || it.Item_Description || '',
    Quantity:         it.quantity    ?? '',
    Unit_Price:       it.unit_price  ?? '',
    Line_Total:       it.line_total  ?? '',
    Status: (it.quantity_confidence === 'high' || it.quantity_confidence == null) ? 'OK' : 'REVIEW',
  }));
}

export function parseRows(data) {
  let raw = [];
  if (Array.isArray(data))             raw = data;
  else if (Array.isArray(data?.rows))  raw = data.rows;
  else if (Array.isArray(data?.data))  raw = data.data;
  else if (Array.isArray(data?.items)) raw = data.items;
  if (!raw.length) return [];

  // Has combined_string — need to extract from it
  if (raw[0]?.combined_string) {
    const rows = [];
    for (const item of raw) {
      let outer;
      try { outer = JSON.parse(item.combined_string); } catch { outer = null; }

      if (!Array.isArray(outer) || !outer.length) {
        rows.push(orderRow(normalizeRow(item)));
        continue;
      }

      if (outer[0]?.content) {
        // Claude structured: [{content:[{type:"text",text:"{lpo_json}"}]}]
        const lpos = extractLpos(item.combined_string);
        if (lpos.length) {
          for (const lpo of lpos) rows.push(...lpoToRows(lpo, item));
        } else {
          rows.push(orderRow(normalizeRow(item)));
        }
      } else {
        // Flat rows inside combined_string: [{lpo_number|LPO_Number, ...}]
        for (const row of outer) rows.push(orderRow(normalizeRow(row)));
      }
    }
    return rows;
  }

  // Plain flat array — normalize each row directly
  return raw.map(r => orderRow(normalizeRow(r)));
}

export function toCSV(rows) {
  if (!rows.length) return '';
  // Collect all keys across all rows (some rows may have extra fields)
  const keySet = new Set();
  rows.forEach(r => Object.keys(r).forEach(k => keySet.add(k)));
  // Order: COL_ORDER first, then extras
  const keys = [...COL_ORDER.filter(k => keySet.has(k)),
                 ...[...keySet].filter(k => !COL_ORDER.includes(k))];
  const esc = v => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k] ?? '')).join(','))].join('\n');
}
