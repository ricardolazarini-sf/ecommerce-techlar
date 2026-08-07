export default function QuantityStepper({ value, onChange, min = 1, disabled = false }) {
  return (
    <div className="qty">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span>{value}</span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
