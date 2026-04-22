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

const INTERNAL_FIELDS = new Set([
  'combined_string','file_base64','binary','document_base64',
  'file_mime','pipeline_status','quality_score','sheets_url','sheetsUrl','google_sheets_url',
]);

export const COL_ORDER = [
  'LPO_Number','Supplier','Supermarket','Branch','Date',
  'Item_Code','Item_Description','Quantity','Unit_Price','Line_Total','Grand_Total',
  'Math_Correct','Accuracy','Status','Status_Reasons','Source_File',
];

// Extract ALL LPO objects from combined_string.
// Structure: JSON array → each item has content[].text → JSON LPO object
function extractLpos(combinedStr) {
  try {
    const outer = JSON.parse(combinedStr);
    if (!Array.isArray(outer)) return [];

    const lpos = [];
    for (const chunk of outer) {
      // Handle [{content:[{type:"text",text:"..."}]}] format
      const contents = chunk?.content || (chunk?.type === 'text' ? [chunk] : []);
      for (const c of contents) {
        if (c?.type !== 'text' || !c?.text) continue;
        try {
          const obj = JSON.parse(c.text);
          if (obj && typeof obj === 'object') lpos.push(obj);
        } catch {}
      }
      // Handle flat [{type:"text",text:"..."}] format at top level
      if (chunk?.type === 'text' && chunk?.text) {
        try {
          const obj = JSON.parse(chunk.text);
          if (obj && typeof obj === 'object' && !lpos.includes(obj)) lpos.push(obj);
        } catch {}
      }
    }
    return lpos;
  } catch { return []; }
}

// Expand a single LPO object into one row per line item
function lpoToRows(lpo, fallbackHeader = {}) {
  const header = {
    LPO_Number:  lpo.lpo_number  || lpo.LPO_Number  || fallbackHeader.LPO_Number  || '',
    Supplier:    lpo.supplier    || lpo.Supplier     || fallbackHeader.Supplier     || '',
    Supermarket: lpo.supermarket || lpo.Supermarket  || fallbackHeader.Supermarket  || '',
    Branch:      lpo.branch      || lpo.Branch       || fallbackHeader.Branch       || '',
    Date:        lpo.date        || lpo.Date         || fallbackHeader.Date         || '',
    Grand_Total: lpo.grand_total || lpo.Grand_Total  || '',
  };

  // Support multiple field names for line items
  const items = lpo.line_items || lpo.items || lpo.products || lpo.rows || [];
  if (!items.length) return [header];

  return items.map(it => ({
    ...header,
    Item_Code:        it.item_code        || it.barcode      || it.Item_Code   || '',
    Item_Description: it.description      || it.Item_Description || it.name   || '',
    Quantity:         it.quantity         ?? it.Quantity      ?? '',
    Unit_Price:       it.unit_price       ?? it.Unit_Price    ?? '',
    Line_Total:       it.line_total       ?? it.Line_Total    ?? '',
    Status: (it.quantity_confidence === 'high' || it.quantity_confidence == null)
      ? 'OK' : 'REVIEW',
  }));
}

export function parseRows(data) {
  let raw = [];
  if (Array.isArray(data))             raw = data;
  else if (Array.isArray(data?.rows))  raw = data.rows;
  else if (Array.isArray(data?.data))  raw = data.data;
  else if (Array.isArray(data?.items)) raw = data.items;
  if (!raw.length) return [];

  // If first item has combined_string, extract LPO + line items from all items
  if (raw[0]?.combined_string) {
    const rows = [];
    for (const item of raw) {
      const lpos = extractLpos(item.combined_string);
      console.log('[parseRows] combined_string → lpos extracted:', lpos.length, lpos);
      if (lpos.length) {
        for (const lpo of lpos) rows.push(...lpoToRows(lpo, item));
      } else {
        // Fallback: clean the top-level fields
        const clean = {};
        Object.keys(item).forEach(k => { if (!INTERNAL_FIELDS.has(k)) clean[k] = item[k]; });
        rows.push(clean);
      }
    }
    console.log('[parseRows] total rows:', rows.length);
    return rows;
  }

  // Plain row array — clean internal fields
  return raw.map(r => {
    const clean = {};
    COL_ORDER.forEach(k => { if (k in r && !INTERNAL_FIELDS.has(k)) clean[k] = r[k]; });
    Object.keys(r).forEach(k => { if (!INTERNAL_FIELDS.has(k) && !(k in clean)) clean[k] = r[k]; });
    return clean;
  });
}

export function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = v => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}
