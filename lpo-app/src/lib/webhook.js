import { detectMime, parseRows, parseCsv } from './utils';

const FLAG_REASONS = {
  CORRUPTED:      'File appears corrupted or unreadable',
  FAILED:         'Pipeline processing failed',
  QUALITY_FAIL:   'Quality score too low',
  WRONG_SUPPLIER: 'Not a Melvin/Marsh supplier — rejected',
  DUPLICATE:      'Duplicate LPO — already processed',
};

export async function processFile(item, webhookUrl, onStageUpdate) {
  onStageUpdate({ stage: 0, state: 'active', msg: '⏳ Uploading — waiting for n8n…' });

  const form = new FormData();
  form.append('file', item.file, item.file.name);
  form.append('filename', item.file.name);
  form.append('original_filename', item.file.name);
  form.append('file_size', item.file.size);
  form.append('file_type', item.file.type || detectMime(item.file.name));
  form.append('source', 'lpo-frontend');

  let res;
  try {
    res = await fetch(webhookUrl.trim(), { method: 'POST', body: form });
  } catch (networkErr) {
    console.error('[webhook] fetch failed:', networkErr);
    const msg = networkErr.message || '';
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('CORS')) {
      throw new Error('CORS blocked — set N8N_CORS_ORIGIN=* in Railway env vars.');
    }
    throw new Error(`Network error — ${msg || 'cannot reach server'}`);
  }

  onStageUpdate({ stage: 0, state: 'done', msg: '' });
  onStageUpdate({ stage: 1, state: 'active', msg: '⏳ Response received — parsing…' });

  if (!res.ok) {
    throw new Error(
      res.status === 404 ? 'Webhook not found — check the URL and that the workflow is active.'
      : res.status === 401 || res.status === 403 ? 'Access denied — check the webhook URL.'
      : res.status >= 500 ? `Server error ${res.status} — try again.`
      : `HTTP ${res.status}`
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const isCsv = contentType.includes('csv') || contentType.includes('octet-stream') || contentType.includes('text/plain');

  if (isCsv) {
    // n8n sent raw CSV binary — use directly for download, parse for table
    const csvText = await res.text();
    if (!csvText.trim()) throw new Error('Empty CSV response from n8n.');

    const blob = new Blob([csvText], { type: 'text/csv' });
    const csvBlobUrl = URL.createObjectURL(blob);
    const rows = parseRows(parseCsv(csvText));

    if (!rows.length) throw new Error('CSV had no data rows.');

    const allReview = rows.every(r => String(r.Status || '').toUpperCase() === 'REVIEW');
    return {
      rows, flagged: allReview, flagReason: allReview ? 'All items need review' : null,
      sheetsUrl: null, csvBlobUrl,
    };
  }

  // JSON path
  const rawText = await res.text();
  if (!rawText.trim()) {
    throw new Error(webhookUrl.includes('webhook-test')
      ? 'Empty response — click Execute in n8n first.'
      : 'Empty response — check n8n execution logs.');
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error('Server returned non-JSON. Check the n8n "Respond to Webhook" node.');
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error('Empty response — workflow may not have reached the Respond node.');
  }

  const top = Array.isArray(data) ? (data[0] || {}) : (data || {});
  const pipelineStatus = String(top.status || top.pipeline_status || '').toUpperCase();

  if (FLAG_REASONS[pipelineStatus]) {
    return { rows: [], flagged: true, flagReason: FLAG_REASONS[pipelineStatus], sheetsUrl: null, csvBlobUrl: null };
  }

  if (!Array.isArray(data) && data?.error && !data?.rows && !data?.data) {
    throw new Error(String(data.error));
  }

  const rows = parseRows(data);
  if (rows.length === 0) {
    throw new Error('No order lines found — document may be empty or unsupported format.');
  }

  const sheetsUrl = top.sheets_url || top.sheetsUrl || top.google_sheets_url || null;

  // Check if JSON also embeds a CSV field
  const csvRaw = top.csv_data || top.csv_content || top.csvData || top.csv || null;
  let csvBlobUrl = null;
  if (csvRaw) {
    const blob = new Blob([csvRaw], { type: 'text/csv' });
    csvBlobUrl = URL.createObjectURL(blob);
  }

  const allReview = rows.every(r => String(r.Status || '').toUpperCase() === 'REVIEW');
  return {
    rows, flagged: allReview, flagReason: allReview ? 'All items need review' : null,
    sheetsUrl, csvBlobUrl,
  };
}
