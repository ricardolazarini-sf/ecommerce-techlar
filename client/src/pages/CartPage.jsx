import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import ProductImage from '../components/ProductImage.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';
import Loader from '../components/Loader.jsx';
import Icon from '../components/Icon.jsx';
import { formatPrice, warrantyFee, WARRANTY_RATE } from '../lib/format.js';

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const RATE_LABEL = `${Math.round(WARRANTY_RATE * 100)}%`;
const itemLabel = (n) => `${n} ${n === 1 ? 'item' : 'itens'}`;

export default function CartPage() {
  const { cart, loading, updateItem, removeItem, warranties, setWarranty, refresh } = useCart();
  const navigate = useNavigate();
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState('');

  // Cart mutations reject on failure; keep the row locked and say what happened.
  const run = async (productId, action) => {
    setActionError('');
    setPendingId(productId);
    try {
      await action();
    } catch {
      setActionError('A alteração não foi salva: a conexão com a TechLar falhou. Tente de novo.');
    } finally {
      setPendingId(null);
    }
  };

  if (loading) return <Loader label="Carregando seu carrinho" />;

  // A cart that loaded always carries an id; a null id means the request failed.
  if (!cart.cart_id) {
    return (
      <>
        <div className="co-head">
          <h1 className="co-head-title">Seu carrinho</h1>
        </div>
        <div className="alert alert-error" role="alert">
          O carrinho não carregou: a conexão com a TechLar falhou. Tente de novo em alguns segundos.
        </div>
        <div className="co-retry">
          <button type="button" className="btn btn-primary" onClick={refresh}>
            Tentar de novo
          </button>
          <Link to="/produtos" className="btn btn-outline">
            Ver produtos
          </Link>
        </div>
      </>
    );
  }

  if (!cart.items.length) {
    return (
      <div className="empty-state">
        <div className="big">
          <Icon name="cart" size={24} />
        </div>
        <h1>Seu carrinho está vazio</h1>
        <p>
          Escolha um produto no catálogo. Aqui você ajusta a quantidade e decide a garantia
          estendida antes de finalizar.
        </p>
        <div className="co-empty-actions">
          <Link to="/produtos" className="btn btn-primary">
            Ver produtos
          </Link>
        </div>
      </div>
    );
  }

  // Warranty lives client-side (cart_items has no warranty column), so the cart
  // total is computed here with the same per-line rounding the server uses at
  // checkout, where the totals become authoritative.
  const warrantyTotal = cart.items.reduce(
    (sum, i) => round2(sum + (warranties[i.product_id] ? warrantyFee(i.unit_price, i.qty) : 0)),
    0,
  );
  const warrantyCount = cart.items.filter((i) => warranties[i.product_id]).length;
  const total = round2(cart.subtotal + warrantyTotal);

  return (
    <>
      <div className="co-head">
        <h1 className="co-head-title">Seu carrinho</h1>
        <span className="co-count">{itemLabel(cart.itemCount)}</span>
      </div>

      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}

      <div className="split">
        <div className="co-lines">
          {cart.items.map((item) => {
            const hasWarranty = Boolean(warranties[item.product_id]);
            const fee = warrantyFee(item.unit_price, item.qty);
            const isService = item.categoria === 'servicos';
            const busy = pendingId === item.product_id;
            return (
              <div className="co-line" key={item.product_id} aria-busy={busy}>
                <ProductImage src={item.imagem_url} name={item.nome} className="co-thumb" />

                <div className="co-line-main">
                  <Link to={`/produtos/${item.product_id}`} className="co-line-name">
                    {item.nome}
                  </Link>
                  {isService && <span className="chip">Serviço</span>}
                  {item.qty > 1 && (
                    <span className="co-line-meta">
                      {item.qty} × {formatPrice(item.unit_price)}
                    </span>
                  )}
                  <div className="co-line-acts">
                    <QuantityStepper
                      value={item.qty}
                      min={1}
                      disabled={busy}
                      onChange={(v) =>
                        run(item.product_id, () =>
                          v < 1 ? removeItem(item.product_id) : updateItem(item.product_id, v),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-ghost co-remove"
                      disabled={busy}
                      onClick={() => run(item.product_id, () => removeItem(item.product_id))}
                    >
                      <Icon name="trash" size={16} />
                      Remover
                    </button>
                  </div>
                </div>

                <span className="price co-line-value">{formatPrice(item.line_total)}</span>

                {isService && !hasWarranty ? (
                  <div className="co-addon">
                    <span className="co-addon-note">
                      Serviço não recebe garantia estendida.
                    </span>
                  </div>
                ) : (
                  <div className={`co-addon ${hasWarranty ? 'co-addon-on' : ''}`}>
                    <label className="inline-check co-addon-label co-addon-pick">
                      <input
                        type="checkbox"
                        checked={hasWarranty}
                        onChange={(e) => setWarranty(item.product_id, e.target.checked)}
                      />
                      <Icon
                        name="shield"
                        size={16}
                        className={hasWarranty ? 'co-icon' : 'co-icon-quiet'}
                      />
                      Garantia estendida
                      <span className="co-addon-rate">{RATE_LABEL} do item</span>
                    </label>
                    <span className="co-addon-value">+ {formatPrice(fee)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <aside className="panel co-summary" aria-label="Resumo do carrinho">
          <p className="eyebrow">Resumo</p>
          <div className="co-sum-row">
            <span>Produtos</span>
            <span className="price co-sum-value">{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="co-sum-row">
            <span>
              Garantia estendida
              {warrantyCount > 0 && ` · ${itemLabel(warrantyCount)}`}
            </span>
            <span className="price co-sum-value">{formatPrice(warrantyTotal)}</span>
          </div>
          <div className="co-sum-total">
            <span>Total</span>
            <span className="price co-total">{formatPrice(total)}</span>
          </div>
          <div className="co-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => navigate('/checkout')}
            >
              Revisar e finalizar
            </button>
            <Link to="/produtos" className="btn btn-outline btn-block">
              Continuar comprando
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
