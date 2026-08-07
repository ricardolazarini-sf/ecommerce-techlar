import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import ProductImage from '../components/ProductImage.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';
import Loader from '../components/Loader.jsx';
import { formatPrice, warrantyFee } from '../lib/format.js';

export default function CartPage() {
  const { cart, loading, updateItem, removeItem, warranties, setWarranty } = useCart();
  const navigate = useNavigate();

  if (loading) return <Loader />;

  if (!cart.items.length) {
    return (
      <div className="empty-state">
        <div className="big">🛒</div>
        <h2>Seu carrinho está vazio</h2>
        <p>Adicione produtos do nosso catálogo.</p>
        <Link to="/produtos" className="btn btn-primary">
          Ver produtos
        </Link>
      </div>
    );
  }

  const warrantyTotal = cart.items.reduce(
    (sum, i) => sum + (warranties[i.product_id] ? warrantyFee(i.unit_price, i.qty) : 0),
    0,
  );
  const total = Math.round((cart.subtotal + warrantyTotal) * 100) / 100;

  return (
    <>
      <div className="section-head">
        <h2>Seu carrinho</h2>
      </div>
      <div className="split">
        <div className="panel">
          {cart.items.map((item) => {
            const hasWarranty = Boolean(warranties[item.product_id]);
            const lineWarranty = hasWarranty ? warrantyFee(item.unit_price, item.qty) : 0;
            return (
              <div className="line-item" key={item.product_id}>
                <ProductImage src={item.imagem_url} name={item.nome} className="line-thumb" />
                <div>
                  <Link to={`/produtos/${item.product_id}`} style={{ fontWeight: 600 }}>
                    {item.nome}
                  </Link>
                  <div className="muted">{formatPrice(item.unit_price)} cada</div>
                  <label className="inline-check" style={{ marginTop: '0.4rem' }}>
                    <input
                      type="checkbox"
                      checked={hasWarranty}
                      onChange={(e) => setWarranty(item.product_id, e.target.checked)}
                    />
                    Garantia estendida (+{formatPrice(warrantyFee(item.unit_price, item.qty))})
                  </label>
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <QuantityStepper
                      value={item.qty}
                      min={1}
                      onChange={(v) => (v < 1 ? removeItem(item.product_id) : updateItem(item.product_id, v))}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => removeItem(item.product_id)}>
                      Remover
                    </button>
                  </div>
                </div>
                <div className="price">{formatPrice(item.line_total + lineWarranty)}</div>
              </div>
            );
          })}
        </div>

        <aside className="panel summary">
          <h3>Resumo</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Garantia estendida</span>
            <span>{formatPrice(warrantyTotal)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: '1rem' }}
            onClick={() => navigate('/checkout')}
          >
            Finalizar compra
          </button>
          <Link to="/produtos" className="btn btn-ghost btn-block" style={{ marginTop: '0.5rem' }}>
            Continuar comprando
          </Link>
        </aside>
      </div>
    </>
  );
}
