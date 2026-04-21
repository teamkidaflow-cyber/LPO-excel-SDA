import { useState } from 'react';
import { initClient, fetchHistory } from '../lib/supabase';

const PAGE = 5;

export default function HistoryPanel() {
  const [url, setUrl]       = useState(() => localStorage.getItem('lpo_sb_url') || '');
  const [key, setKey]       = useState(() => localStorage.getItem('lpo_sb_key') || '');
  const [rows, setRows]     = useState([]);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [connected, setConnected] = useState(false);

  const connect = async () => {
    if (!url || !key) { setError('Enter both URL and key.'); return; }
    setError(''); setLoading(true);
    try {
      initClient(url, key);
      const data = await fetchHistory();
      localStorage.setItem('lpo_sb_url', url);
      localStorage.setItem('lpo_sb_key', key);
      setRows(data);
      setConnected(true);
    } catch (e) {
      setError('Could not connect — check your URL and key.');
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = (run) => {
    if (!run.csv_data) return;
    const blob = new Blob([run.csv_data], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `LPO_${run.processed_at?.slice(0,10)}_${run.filename}.csv`,
    });
    a.click();
  };

  const visible = showAll ? rows : rows.slice(0, PAGE);

  return (
    <div className="card">
      <div className="card-header">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        Processing History
      </div>
      <div className="card-body">
        {!connected && (
          <div className="sb-connect">
            <div className="config-row">
              <label>Supabase URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxx.supabase.co" />
            </div>
            <div className="config-row">
              <label>Anon Key</label>
              <input value={key} onChange={e => setKey(e.target.value)} type="password" placeholder="eyJ…" />
            </div>
            {error && <p className="sb-error">{error}</p>}
            <button className="btn btn-outline btn-sm" onClick={connect} disabled={loading}>
              {loading ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        )}

        {connected && (
          <>
            {!rows.length && <p style={{ fontSize: '.82rem', color: 'var(--gray-500)' }}>No runs yet.</p>}
            <div className="history-list">
              {visible.map(run => (
                <div key={run.id} className={`history-row${run.flagged ? ' flagged' : ''}`}>
                  <div className="hr-main">
                    <span className="hr-file">{run.filename}</span>
                    <span className="hr-date">{new Date(run.processed_at).toLocaleString()}</span>
                  </div>
                  <div className="hr-meta">
                    {run.lpo_numbers?.filter(Boolean).length > 0 && (
                      <span className="hr-tag">LPO: {run.lpo_numbers.join(', ')}</span>
                    )}
                    <span className={`hr-status hr-${run.status}`}>{run.status}</span>
                    {run.flag_reason && <span className="hr-flag">{run.flag_reason}</span>}
                    {run.csv_data && (
                      <button className="btn btn-outline btn-sm" onClick={() => downloadCsv(run)}>↓ CSV</button>
                    )}
                    {run.sheets_url && (
                      <a href={run.sheets_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Sheets ↗</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {rows.length > PAGE && (
              <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setShowAll(v => !v)}>
                {showAll ? 'Show less' : `Show ${rows.length - PAGE} more`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
