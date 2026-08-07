import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import { formatPrice, categoryLabel } from '../lib/format.js';
import { useCart } from '../context/CartContext.jsx';
import { useState } from 'react';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addItem(product.id, 1);
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className="card product-card">
      <Link to={`/produtos/${product.id}`} aria-label={product.nome}>
        <ProductImage
          src={product.imagem_url}
          name={product.nome}
          className="product-thumb"
        />
      </Link>
      <div className="product-body">
        <span className="chip">{categoryLabel(product.categoria)}</span>
        <Link to={`/produtos/${product.id}`} className="product-name">
          {product.nome}
        </Link>
        <div className="price">{formatPrice(product.preco)}</div>
        <div className="actions">
          <Link to={`/produtos/${product.id}`} className="btn btn-outline btn-sm">
            Detalhes
          </Link>
          <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={adding}>
            {adding ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </article>
  );
}
