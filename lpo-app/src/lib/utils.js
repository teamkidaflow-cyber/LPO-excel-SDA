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
  'LPO_Number','Supplier','Supermarket','Branch','Date','Item_Code',
  'Item_Description','Quantity','Unit_Price','Line_Total','Grand_Total',
  'Math_Correct','Accuracy','Status','Status_Reasons','Source_File',
];

export function parseRows(data) {
  let raw = [];
  if (Array.isArray(data))             raw = data;
  else if (Array.isArray(data?.rows))  raw = data.rows;
  else if (Array.isArray(data?.data))  raw = data.data;
  else if (Array.isArray(data?.items)) raw = data.items;
  if (!raw.length) return [];

  const first = raw[0];
  if (first?.combined_string) {
    try {
      const parsed = JSON.parse(first.combined_string);
      if (Array.isArray(parsed) && parsed.length > 0) raw = parsed;
    } catch { /* fall through */ }
  }

  return raw.map(r => {
    const clean = {};
    COL_ORDER.forEach(k => {
      if (k in r && !INTERNAL_FIELDS.has(k)) clean[k] = r[k];
    });
    Object.keys(r).forEach(k => {
      if (!INTERNAL_FIELDS.has(k) && !(k in clean)) clean[k] = r[k];
    });
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
