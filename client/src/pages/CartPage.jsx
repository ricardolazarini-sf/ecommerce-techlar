import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import ProductImage from '../components/ProductImage.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';
import Loader from '../components/Loader.jsx';
import Icon from '../components/Icon.jsx';
import { formatPrice, isServiceItem, WARRANTY_RATE } from '../lib/format.js';

const RATE_LABEL = `${Math.round(WARRANTY_RATE * 100)}%`;
const itemLabel = (n) => `${n} ${n === 1 ? 'item' : 'itens'}`;

export default function CartPage() {
  const {
    cart,
    loading,
    updateItem,
    removeItem,
    warranty,
    warrantyOn,
    warrantyTotal,
    total,
    setWarranty,
    refresh,
  } = useCart();
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

  // A garantia é uma decisão da compra: o servidor informa a base garantível
  // (subtotal menos serviços e menos linhas em promoção) e o contexto calcula os
  // 3%. Quando não há base, a caixa não aparece — no lugar dela, o motivo.
  const inCombo = cart.items.filter((i) => i.in_combo).length;
  const onlyServices = cart.items.every(isServiceItem);
  const allInCombo = inCombo > 0 && inCombo === cart.items.length;
  const partialBase = inCombo > 0 && !allInCombo;
  let warrantyWhyNot = 'Nada nesta compra recebe garantia estendida.';
  if (allInCombo) {
    warrantyWhyNot =
      'Os produtos do combo já estão com desconto, e desconto e garantia estendida não se cruzam.';
  } else if (onlyServices) {
    warrantyWhyNot = 'Serviço não recebe garantia estendida.';
  } else if (inCombo > 0) {
    warrantyWhyNot =
      'O que sobrou fora do combo é serviço, e serviço não recebe garantia estendida.';
  }

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
            const isService = isServiceItem(item);
            const busy = pendingId === item.product_id;
            return (
              <div className="co-line" key={item.product_id} aria-busy={busy}>
                <ProductImage src={item.imagem_url} name={item.nome} className="co-thumb" />

                <div className="co-line-main">
                  <Link to={`/produtos/${item.product_id}`} className="co-line-name">
                    {item.nome}
                  </Link>
                  {isService && <span className="chip">Serviço</span>}
                  {item.in_combo && cart.combo && (
                    <span className="chip co-chip-combo">{cart.combo.percent}% no combo</span>
                  )}
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
          {cart.combo && cart.discountTotal > 0 && (
            <div className="co-sum-row co-sum-row-off">
              <span>
                {cart.combo.nome}
                <span className="co-sum-rate">{cart.combo.percent}% no combo</span>
              </span>
              <span className="price co-sum-value">− {formatPrice(cart.discountTotal)}</span>
            </div>
          )}

          {/* A garantia é uma escolha da compra: uma caixa, no resumo, onde o
              total está sendo formado. Sem base para medir, o motivo no lugar. */}
          {cart.warrantyAvailable ? (
            <div className={`co-warranty ${warrantyOn ? 'co-warranty-on' : ''}`}>
              <label className="inline-check co-warranty-label">
                <input
                  type="checkbox"
                  checked={warranty}
                  onChange={(e) => setWarranty(e.target.checked)}
                />
                <Icon
                  name="shield"
                  size={16}
                  className={warrantyOn ? 'co-icon' : 'co-icon-quiet'}
                />
                Garantia estendida da compra
              </label>
              <span className="co-warranty-rate">
                {RATE_LABEL} {partialBase ? 'dos itens fora do combo' : 'do total'} ·{' '}
                {formatPrice(cart.warrantyBase)}
              </span>
              <span className="co-warranty-value">+ {formatPrice(warrantyTotal)}</span>
            </div>
          ) : (
            <div className="co-warranty co-warranty-off">
              <span className="co-warranty-label">
                <Icon name="shield" size={16} className="co-icon-quiet" />
                Sem garantia estendida
              </span>
              <span className="co-warranty-rate">{warrantyWhyNot}</span>
            </div>
          )}

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
