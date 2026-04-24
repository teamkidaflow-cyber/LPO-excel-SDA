import { useState, useMemo } from 'react'; // useState used by RowModal
import { COL_ORDER } from '../lib/utils';

const STATUS_COLOR = { OK: 'var(--green)', REVIEW: 'var(--amber)', REJECTED: 'var(--red)' };

function SummaryCards({ rows }) {
  const lpos    = [...new Set(rows.map(r => r.LPO_Number).filter(Boolean))];
  const ok      = rows.filter(r => String(r.Status || '').toUpperCase() === 'OK').length;
  const review  = rows.filter(r => String(r.Status || '').toUpperCase() === 'REVIEW').length;
  const total   = rows.reduce((s, r) => s + (parseFloat(r.Total_Price) || 0), 0);

  return (
    <div className="summary-cards">
      <div className="sc"><div className="sc-val">{rows.length}</div><div className="sc-lbl">Line Items</div></div>
      <div className="sc"><div className="sc-val">{lpos.length || '—'}</div><div className="sc-lbl">LPO Numbers</div></div>
      <div className="sc"><div className="sc-val sc-ok">{ok}</div><div className="sc-lbl">Confirmed</div></div>
      <div className="sc"><div className="sc-val sc-rev">{review}</div><div className="sc-lbl">Review</div></div>
    </div>
  );
}

function RowModal({ row, cols, onClose }) {
  if (!row) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="row-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-toolbar">
          <span style={{ fontWeight: 700 }}>Row Detail</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          {cols.map(k => row[k] != null && row[k] !== '' ? (
            <div key={k} className="rd-row">
              <span className="rd-key">{k.replace(/_/g, ' ')}</span>
              <span className="rd-val" style={{ color: k === 'Status' ? STATUS_COLOR[String(row[k]).toUpperCase()] : undefined }}>
                {row[k]}
              </span>
            </div>
          ) : null)}
        </div>
      </div>
    </div>
  );
}

function DataTable({ rows, showFilename }) {
  const [selectedRow, setSelectedRow] = useState(null);

  if (!rows.length) return null;
  const cols = COL_ORDER.filter(k => rows.some(r => r[k] != null && r[k] !== ''));

  const status0 = String(rows[0]?.Status || '').toUpperCase();
  if (status0 === 'REJECTED') {
    return (
      <div className="rejected-card">
        <strong>REJECTED</strong>
        {rows[0].Status_Reasons && <p>{rows[0].Status_Reasons}</p>}
      </div>
    );
  }

  return (
    <>
      <RowModal row={selectedRow} cols={cols} onClose={() => setSelectedRow(null)} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {showFilename && <th>File</th>}
              {cols.map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const s = String(row.Status || '').toUpperCase();
              return (
                <tr
                  key={i}
                  style={{ color: STATUS_COLOR[s] || 'inherit', cursor: 'pointer' }}
                  onDoubleClick={() => setSelectedRow(row)}
                  title="Double-click to view full row"
                >
                  {showFilename && <td style={{ fontFamily: 'monospace', fontSize: '.72rem' }}>{row._filename || ''}</td>}
                  {cols.map(k => <td key={k}>{row[k] ?? ''}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="dbl-hint">Double-click any row to view full detail</p>
    </>
  );
}

function PreviewPane({ file }) {
  const url    = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  const [rotate, setRotate] = useState(0);
  const isPdf  = file?.name?.toLowerCase().endsWith('.pdf') || file?.type === 'application/pdf';

  if (!url) return null;
  return (
    <div className="preview-pane">
      <div className="pane-header">
        Original Document
        {!isPdf && (
          <button
            onClick={() => setRotate(r => (r + 90) % 360)}
            className="rotate-btn"
            title="Rotate image"
          >↻</button>
        )}
      </div>
      {isPdf
        ? <iframe src={url} title={file.name} className="preview-frame" />
        : <div className="preview-img-wrap">
            <img
              src={url}
              alt={file.name}
              style={{ transform: `rotate(${rotate}deg)`, transition: 'transform .25s' }}
              className="preview-img"
            />
          </div>
      }
    </div>
  );
}

function FilePane({ item }) {
  const rows = item.rows || [];
  const isRejected = rows.length === 0 ||
    (rows.length === 1 && String(rows[0]?.Status || '').toUpperCase() === 'REJECTED');

  return (
    <div id={`result-${item.id}`} className="results-split">
      <PreviewPane file={item.file} />
      <div className="data-pane">
        <div className="pane-header">Extracted Data</div>
        {isRejected ? (
          <div className="rejected-card" style={{ margin: 14 }}>
            <strong>Could not process</strong>
            <p>{rows[0]?.Status_Reasons || 'Document may be unsupported or low quality.'}</p>
            {item.flagReason && <p style={{ marginTop: 4 }}>⚠ {item.flagReason}</p>}
          </div>
        ) : (
          <>
            <SummaryCards rows={rows} />
            <DataTable rows={rows} showFilename={false} />
          </>
        )}
      </div>
    </div>
  );
}

export default function ResultsSection({ queue, allRows, csvContent, csvBlobUrl, sheetsUrl, activeTab, onTabChange }) {
  const tab = activeTab ?? 'all';
  const setTab = onTabChange ?? (() => {});
  const done = queue.filter(q => q.status === 'done');
  if (!done.length) return null;

  const download = () => {
    // Single file → use binary blob from webhook; multiple files → combine all rows
    const href = (done.length === 1 && csvBlobUrl)
      ? csvBlobUrl
      : URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), {
      href,
      download: `LPO_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
  };

  const copy = () => navigator.clipboard?.writeText(csvContent);

  const shortName = n => n.length > 22 ? n.slice(0, 10) + '…' + n.slice(-8) : n;

  return (
    <div className="card">
      <div className="card-header">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
        </svg>
        Extraction Results
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {sheetsUrl && (
            <a href={sheetsUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Sheets ↗</a>
          )}
          <button className="btn btn-outline btn-sm" onClick={copy}>Copy CSV</button>
          <button className="btn btn-primary btn-sm" onClick={download}>↓ Download CSV</button>
        </div>
      </div>

      <div className="results-tabs">
        <div className={`rtab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All Files <span className="rtab-badge">{allRows.length}</span>
        </div>
        {done.map(item => (
          <div key={item.id} className={`rtab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
            {shortName(item.file.name)} <span className="rtab-badge">{item.rows.length}</span>
          </div>
        ))}
      </div>

      {tab === 'all' && (
        <div style={{ padding: '14px 16px' }}>
          <SummaryCards rows={allRows} />
          <DataTable rows={allRows} showFilename={done.length > 1} />
        </div>
      )}
      {done.map(item => tab === item.id && <FilePane key={item.id} item={item} />)}
    </div>
  );
}
