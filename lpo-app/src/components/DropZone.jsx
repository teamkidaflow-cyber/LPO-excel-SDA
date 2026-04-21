import { useRef, useState } from 'react';
import { isAllowed } from '../lib/utils';

const FORMATS = ['PDF','PNG','JPG','WEBP','TIFF'];

export default function DropZone({ onFiles, webhookUrl, onWebhookChange }) {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    onFiles([...e.dataTransfer.files].filter(isAllowed));
  };

  const handleChange = e => {
    onFiles([...e.target.files].filter(isAllowed));
    e.target.value = '';
  };

  return (
    <div className="card">
      <div className="card-header">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        </svg>
        Upload Purchase Orders
      </div>
      <div className="card-body">
        <div className="config-row">
          <label>Webhook URL</label>
          <input
            type="url"
            value={webhookUrl}
            onChange={e => onWebhookChange(e.target.value)}
            placeholder="https://…/webhook/lpo-upload"
          />
        </div>

        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.tif" multiple onChange={handleChange} style={{ display: 'none' }} />
          <div className="dz-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
          </div>
          <h3>Drop LPO files here</h3>
          <p>or click to browse · multiple files supported</p>
          <div className="formats">
            {FORMATS.map(f => <span key={f} className="fmt-badge">{f}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
