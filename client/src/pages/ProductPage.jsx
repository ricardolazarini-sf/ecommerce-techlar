import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductImage from '../components/ProductImage.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';
import Loader from '../components/Loader.jsx';
import { formatPrice, categoryLabel, warrantyFee, WARRANTY_RATE } from '../lib/format.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, setWarranty, warranties } = useCart();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qty, setQty] = useState(1);
  const [warranty, setW] = useState(false);
  const [message, setMessage] = useState('');
  const [wished, setWished] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .getProduct(id)
      .then((d) => {
        if (!active) return;
        setProduct(d.product);
        setW(Boolean(warranties[d.product.id]));
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getWishlist()
      .then((d) => setWished(d.items.some((i) => String(i.product_id) === String(id))))
      .catch(() => {});
  }, [id, isAuthenticated]);

  const handleAdd = async () => {
    await addItem(product.id, qty, warranty);
    setWarranty(product.id, warranty);
    setMessage('Produto adicionado ao carrinho!');
    setTimeout(() => setMessage(''), 2500);
  };

  const toggleWish = async () => {
    try {
      if (wished) {
        await api.removeWishlist(product.id);
        setWished(false);
      } else {
        await api.addWishlist(product.id);
        setWished(true);
      }
    } catch {
      /* ignore */
    }
  };

  if (loading) return <Loader />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!product) return null;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Home</Link> /{' '}
        <Link to={`/produtos?categoria=${product.categoria}`}>
          {categoryLabel(product.categoria)}
        </Link>{' '}
        / {product.nome}
      </div>

      <div className="detail">
        <div className="detail-media">
          <ProductImage src={product.imagem_url} name={product.nome} className="product-thumb" />
        </div>
        <div>
          <span className="chip">{categoryLabel(product.categoria)}</span>
          <h1>{product.nome}</h1>
          <div className="muted">SKU: {product.sku}</div>
          <div className="price">{formatPrice(product.preco)}</div>
          <p>{product.descricao}</p>

          <div className="warranty-box">
            <input
              id="warranty"
              type="checkbox"
              className="inline-check"
              checked={warranty}
              onChange={(e) => setW(e.target.checked)}
            />
            <label htmlFor="warranty">
              <strong>Garantia estendida</strong> (+{Math.round(WARRANTY_RATE * 100)}%) — proteja seu
              produto por mais 12 meses.
              <br />
              <span className="muted">Adicional de {formatPrice(warrantyFee(product.preco, qty))}</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '1rem 0' }}>
            <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} />
            <button className="btn btn-primary" onClick={handleAdd}>
              Adicionar ao carrinho
            </button>
            {isAuthenticated && (
              <button
                className={`heart ${wished ? 'on' : ''}`}
                onClick={toggleWish}
                aria-label="Adicionar à lista de desejos"
                title="Lista de desejos"
              >
                ♥
              </button>
            )}
          </div>

          {message && (
            <div className="alert alert-success">
              {message} <Link to="/carrinho">Ver carrinho →</Link>
            </div>
          )}

          <button className="btn btn-outline" onClick={() => navigate('/produtos')}>
            ← Continuar comprando
          </button>
        </div>
      </div>
    </>
  );
}
