import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { formatPrice } from '../lib/format.js';

export default function CheckoutPage() {
  const { cart, warranties, resetAfterCheckout } = useCart();
  const { isAuthenticated, customer } = useAuth();
  const navigate = useNavigate();

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [guest, setGuest] = useState({ nome: '', email: '', telefone: '', documento: '' });

  // Starting checkout emits `checkout_started` server-side and returns
  // authoritative totals (including warranty selections).
  useEffect(() => {
    let active = true;
    if (!cart.items.length) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    api
      .startCheckout(warranties)
      .then((d) => active && setReview(d.review))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateGuest = (key) => (e) => setGuest((g) => ({ ...g, [key]: e.target.value }));

  const confirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = { warranties };
      if (!isAuthenticated) payload.customer = guest;
      const d = await api.confirmCheckout(payload);
      resetAfterCheckout();
      navigate(`/pedido/${d.order.order_number}`, { state: { order: d.order } });
    } catch (err) {
      setError(err.message || 'Falha ao confirmar o pedido');
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;

  if (!cart.items.length && !review) {
    return (
      <div className="empty-state">
        <div className="big">🛒</div>
        <h2>Seu carrinho está vazio</h2>
        <Link to="/produtos" className="btn btn-primary">
          Ver produtos
        </Link>
      </div>
    );
  }

  const guestValid = isAuthenticated || (guest.nome.trim() && guest.email.trim());

  return (
    <>
      <div className="section-head">
        <h2>Revisão do pedido</h2>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="split">
        <div>
          <div className="panel">
            <h3>Itens</h3>
            {review?.items.map((i) => (
              <div className="line-item" key={i.product_id}>
                <ProductImage src={i.imagem_url} name={i.nome} className="line-thumb" />
                <div>
                  <div style={{ fontWeight: 600 }}>{i.nome}</div>
                  <div className="muted">
                    {i.qty} × {formatPrice(i.unit_price)}
                    {i.warranty ? ' · com garantia estendida' : ''}
                  </div>
                </div>
                <div className="price">{formatPrice(i.unit_price * i.qty)}</div>
              </div>
            ))}
          </div>

          {isAuthenticated ? (
            <div className="panel">
              <h3>Cliente</h3>
              <p>
                {customer?.nome} · {customer?.email}
              </p>
            </div>
          ) : (
            <div className="panel">
              <h3>Seus dados</h3>
              <p className="muted">
                Finalize como convidado ou{' '}
                <Link to="/login" state={{ from: '/checkout' }}>
                  entre na sua conta
                </Link>
                .
              </p>
              <div className="form-grid">
                <div className="field">
                  <label>Nome*</label>
                  <input value={guest.nome} onChange={updateGuest('nome')} />
                </div>
                <div className="field">
                  <label>Email*</label>
                  <input type="email" value={guest.email} onChange={updateGuest('email')} />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input value={guest.telefone} onChange={updateGuest('telefone')} />
                </div>
                <div className="field">
                  <label>CPF/CNPJ</label>
                  <input value={guest.documento} onChange={updateGuest('documento')} />
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="panel summary">
          <h3>Resumo</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(review?.subtotal || 0)}</span>
          </div>
          <div className="summary-row">
            <span>Garantia estendida</span>
            <span>{formatPrice(review?.warrantyTotal || 0)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(review?.total || 0)}</span>
          </div>
          <button
            className="btn btn-primary btn-block"
            style={{ marginTop: '1rem' }}
            disabled={submitting || !guestValid}
            onClick={confirm}
          >
            {submitting ? 'Processando...' : 'Confirmar pedido'}
          </button>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.6rem' }}>
            Pagamento simulado — nenhum valor será cobrado.
          </p>
        </aside>
      </div>
    </>
  );
}
