const STAGES = [
  'Download','Detect','Classify','Extract','Consensus','SKU Match','Validate','Dedup','Output'
];

const Dot = ({ state }) => (
  <span className={`stage-dot stage-dot-${state}`}>
    {state === 'done' ? '✓' : state === 'active' ? '' : '·'}
  </span>
);

export default function PipelineBlock({ item }) {
  const stages = item.stages || STAGES.map(() => 'pending');

  return (
    <div className="pipeline-block" id={`pb-${item.id}`}>
      <div className="pb-header">
        <span className="pb-filename">{item.file.name}</span>
        {item.status === 'done' && !item.flagged && (
          <span className="pb-badge pb-ok">✓ {item.rows.length} line{item.rows.length !== 1 ? 's' : ''}</span>
        )}
        {item.flagged && (
          <span className="pb-badge pb-flag">⚠ {item.flagReason}</span>
        )}
      </div>

      <div className="stages-row">
        {STAGES.map((label, i) => {
          const s = stages[i] || 'pending';
          return (
            <div key={label} className={`stage stage-${s}`}>
              <Dot state={s} />
              <span className="stage-label">{label}</span>
            </div>
          );
        })}
      </div>

      {item.status === 'error' && item.msg && (
        <p className="pb-err">{item.msg}</p>
      )}
      {item.status === 'active' && item.msg && (
        <p className="pb-info">{item.msg}</p>
      )}
    </div>
  );
}
