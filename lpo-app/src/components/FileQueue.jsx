import { useState } from 'react';
import { formatBytes } from '../lib/utils';
import PreviewModal from './PreviewModal';

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

export default function FileQueue({ queue, processing, onRemove, onProcess, onReset, onJump, onRerun }) {
  const [preview, setPreview] = useState(null);

  const pending = queue.filter(q => q.status === 'pending').length;
  const errors  = queue.filter(q => q.status === 'error').length;
  const done    = queue.filter(q => q.status === 'done').length;

  if (!queue.length) return null;

  return (
    <div className="queue-section">
      <PreviewModal file={preview} onClose={() => setPreview(null)} />
      <div className="file-list">
        {queue.map(item => (
          <div key={item.id} className={`file-row status-${item.status}`}>
            <span className="fr-icon"><FileIcon /></span>
            <span className="fr-name">{item.file.name}</span>
            <span className="fr-size">{formatBytes(item.file.size)}</span>

            {item.status === 'active' && <span className="fr-spinner" />}
            {item.status === 'done'   && <span className="fr-tick">✓</span>}
            {item.status === 'error'  && <span className="fr-note">{item.error}</span>}

            <button className="fr-eye" onClick={() => setPreview(item.file)} title="Preview file">
              <EyeIcon />
            </button>

            {item.status === 'error' && (
              <button className="fr-rerun" onClick={() => onRerun(item.id)} title="Retry">↺ Retry</button>
            )}
            {item.status === 'done' && (
              <button className="fr-jump" onClick={() => onJump(item.id)} title="View results">
                <EyeIcon /> Results
              </button>
            )}
            {item.status !== 'active' && (
              <button className="fr-remove" onClick={() => onRemove(item.id)} title="Remove">✕</button>
            )}
          </div>
        ))}
      </div>

      <div className="queue-controls">
        {pending > 0 && (
          <button className="btn btn-primary" onClick={onProcess}>
            {processing ? `Process ${pending} pending` : 'Process All'}
          </button>
        )}
        {pending > 0 && (
          <button className="btn btn-outline btn-sm" onClick={() => onRemove('all')}>Clear Pending</button>
        )}
        {!processing && (done > 0 || errors > 0) && pending === 0 && (
          <button className="btn btn-outline btn-sm" onClick={onReset}>New Batch</button>
        )}
        <span className="queue-summary">
          {done > 0    && <span>{done} done</span>}
          {pending > 0 && <span>{pending} pending</span>}
          {errors > 0  && <span className="err-count">{errors} failed</span>}
          <span>{queue.length}/20</span>
        </span>
      </div>
    </div>
  );
}
