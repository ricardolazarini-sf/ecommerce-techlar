export default function Loader({ label }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="spinner" />
      {label ? <span className="muted" style={{ marginLeft: '0.75rem' }}>{label}</span> : null}
    </div>
  );
}
