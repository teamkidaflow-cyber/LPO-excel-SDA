export default function Header() {
  return (
    <header>
      <div className="logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div>
        <h1>LPO Extraction System</h1>
        <p>Melvin's Kenya — automated order processing</p>
      </div>
      <span className="badge">v2</span>
    </header>
  );
}
