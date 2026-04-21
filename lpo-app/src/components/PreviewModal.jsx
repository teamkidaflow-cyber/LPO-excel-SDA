import { useState, useEffect, useCallback } from 'react';

export default function PreviewModal({ file, onClose }) {
  const [url, setUrl]       = useState(null);
  const [rotate, setRotate] = useState(0);
  const [scale, setScale]   = useState(1);
  const isPdf = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const close = useCallback(() => {
    setRotate(0); setScale(1); onClose();
  }, [onClose]);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  if (!file || !url) return null;

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-toolbar">
          <span className="modal-filename">{file.name}</span>
          {!isPdf && (
            <div className="modal-controls">
              <button onClick={() => setScale(s => Math.max(.25, +(s - .25).toFixed(2)))}>−</button>
              <span>{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(4, +(s + .25).toFixed(2)))}>+</button>
              <button onClick={() => setRotate(r => (r + 90) % 360)} title="Rotate">↻</button>
              <button onClick={() => { setScale(1); setRotate(0); }}>Reset</button>
            </div>
          )}
          <button className="modal-close" onClick={close}>✕</button>
        </div>

        <div className="modal-content">
          {isPdf ? (
            <iframe
              src={url}
              title={file.name}
              className="modal-pdf"
            />
          ) : (
            <div className="modal-img-wrap">
              <img
                src={url}
                alt={file.name}
                style={{
                  transform: `rotate(${rotate}deg) scale(${scale})`,
                  transition: 'transform .2s',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
