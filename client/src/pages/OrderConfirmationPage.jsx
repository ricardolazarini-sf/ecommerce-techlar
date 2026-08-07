import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import { formatPrice, formatDate } from '../lib/format.js';

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);

  useEffect(() => {
    if (order || !isAuthenticated) {
      setLoading(false);
      return;
    }
    api
      .getOrder(orderNumber)
      .then((d) => setOrder(d.order))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="panel" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="confirm-hero">
        <div className="confirm-check">✓</div>
        <h1>Pedido confirmado!</h1>
        <p className="muted">Obrigado pela sua compra na TechLar.</p>
        <div className="order-number">{orderNumber}</div>
      </div>

      {order ? (
        <>
          <div className="summary-row">
            <span>Status</span>
            <span className="status-badge">{order.status}</span>
          </div>
          {order.created_at && (
            <div className="summary-row">
              <span>Data</span>
              <span>{formatDate(order.created_at)}</span>
            </div>
          )}
          <div style={{ margin: '1rem 0', borderTop: '1px solid var(--line)' }} />
          {order.items?.map((i) => (
            <div className="summary-row" key={i.product_id}>
              <span>
                {i.qty}× {i.nome}
                {i.warranty ? ' + garantia' : ''}
              </span>
              <span>{formatPrice(i.unit_price * i.qty)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>
          Guarde o número do seu pedido para acompanhamento.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.2rem' }}>
        <Link to="/produtos" className="btn btn-primary btn-block">
          Continuar comprando
        </Link>
        {isAuthenticated && (
          <Link to="/perfil" className="btn btn-outline btn-block">
            Meus pedidos
          </Link>
        )}
      </div>
    </div>
  );
}
