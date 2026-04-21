import { createClient } from '@supabase/supabase-js';
import { toCSV } from './utils';

let _client = null;

export function getClient() { return _client; }

export function initClient(url, key) {
  _client = createClient(url, key);
  return _client;
}

export async function saveRun({ queue, allRows, csvContent }) {
  if (!_client) return;
  const done = queue.filter(q => q.status === 'done');
  if (!done.length) return;

  const lpoNumbers = [...new Set(allRows.map(r => r.LPO_Number).filter(Boolean))];
  const flagged = done.some(q => q.flagged);
  const flagReason = done.filter(q => q.flagged).map(q => q.flagReason).filter(Boolean).join('; ') || null;
  const sheetsUrl = done.find(q => q.sheetsUrl)?.sheetsUrl || null;
  const okCount = allRows.filter(r => String(r.Status || '').toUpperCase() === 'OK').length;
  const reviewCount = allRows.filter(r => String(r.Status || '').toUpperCase() === 'REVIEW').length;

  await _client.from('lpo_runs').insert({
    filename: done.map(q => q.file.name).join(', '),
    lpo_numbers: lpoNumbers,
    row_count: allRows.length,
    ok_count: okCount,
    review_count: reviewCount,
    flagged,
    flag_reason: flagReason,
    sheets_url: sheetsUrl,
    csv_data: csvContent || toCSV(allRows),
    status: flagged ? 'flagged' : 'done',
  });
}

export async function fetchHistory() {
  if (!_client) return [];
  const { data, error } = await _client
    .from('lpo_runs')
    .select('*')
    .order('processed_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return data || [];
}
