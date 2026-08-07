import { useState } from 'react';

// Renders a product image, gracefully falling back to a gold tile with the
// product's initial if the remote image fails to load.
export default function ProductImage({ src, alt, name = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return <div className={`img-fallback ${className}`} aria-label={alt || name}>{initial}</div>;
  }
  return (
    <img
      src={src}
      alt={alt || name}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
