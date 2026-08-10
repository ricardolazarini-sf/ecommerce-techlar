import Icon from './Icon.jsx';

export default function QuantityStepper({ value, onChange, min = 1, disabled = false }) {
  return (
    <div className="qty">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Icon name="minus" size={16} />
      </button>
      <span>{value}</span>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
