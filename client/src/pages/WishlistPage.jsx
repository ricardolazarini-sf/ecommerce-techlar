import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Loader from '../components/Loader.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { formatPrice, categoryLabel } from '../lib/format.js';
import { useCart } from '../context/CartContext.jsx';

export default function WishlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    let active = true;
    api
      .getWishlist()
      .then((d) => active && setItems(d.items))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const remove = async (productId) => {
    const d = await api.removeWishlist(productId);
    setItems(d.items);
  };

  if (loading) return <Loader />;

  if (!items.length) {
    return (
      <div className="empty-state">
        <div className="big">♥</div>
        <h2>Sua lista de desejos está vazia</h2>
        <Link to="/produtos" className="btn btn-primary">
          Explorar produtos
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="section-head">
        <h2>Lista de desejos</h2>
      </div>
      <div className="grid">
        {items.map((p) => (
          <article className="card product-card" key={p.product_id}>
            <Link to={`/produtos/${p.product_id}`}>
              <ProductImage src={p.imagem_url} name={p.nome} className="product-thumb" />
            </Link>
            <div className="product-body">
              <span className="chip">{categoryLabel(p.categoria)}</span>
              <Link to={`/produtos/${p.product_id}`} className="product-name">
                {p.nome}
              </Link>
              <div className="price">{formatPrice(p.preco)}</div>
              <div className="actions">
                <button className="btn btn-primary btn-sm" onClick={() => addItem(p.product_id, 1)}>
                  Adicionar
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(p.product_id)}>
                  Remover
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
