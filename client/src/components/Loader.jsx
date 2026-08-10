export default function Loader({ label }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="spinner" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
