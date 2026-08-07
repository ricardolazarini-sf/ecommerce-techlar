import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import { formatPrice, formatDate } from '../lib/format.js';

export default function ProfilePage() {
  const { customer, setCustomer } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: '', telefone: '', documento: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((d) => {
        if (!active) return;
        setCustomer(d.customer);
        setOrders(d.orders);
        setForm({
          nome: d.customer.nome || '',
          telefone: d.customer.telefone || '',
          documento: d.customer.documento || '',
        });
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const d = await api.updateProfile(form);
      setCustomer(d.customer);
      setMessage('Perfil atualizado!');
    } catch (err) {
      setMessage(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <>
      <div className="section-head">
        <h2>Minha conta</h2>
      </div>
      <div className="split">
        <div className="panel">
          <h3>Histórico de pedidos</h3>
          {orders.length ? (
            orders.map((o) => (
              <div
                key={o.order_number}
                style={{ borderBottom: '1px solid var(--line)', padding: '0.9rem 0' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{o.order_number}</strong>
                  <span className="status-badge">{o.status}</span>
                </div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {formatDate(o.created_at)}
                </div>
                <div style={{ marginTop: '0.4rem' }}>
                  {o.items.map((i) => (
                    <div key={i.product_id} className="muted">
                      {i.qty}× {i.nome}
                      {i.warranty ? ' + garantia' : ''}
                    </div>
                  ))}
                </div>
                <div style={{ fontWeight: 700, marginTop: '0.3rem' }}>{formatPrice(o.total)}</div>
              </div>
            ))
          ) : (
            <p className="muted">Você ainda não tem pedidos.</p>
          )}
        </div>

        <aside className="panel">
          <h3>Dados cadastrais</h3>
          {message && <div className="alert alert-success">{message}</div>}
          <form className="form-grid" onSubmit={save}>
            <div className="field">
              <label>Nome</label>
              <input value={form.nome} onChange={update('nome')} />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={customer?.email || ''} disabled />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input value={form.telefone} onChange={update('telefone')} />
            </div>
            <div className="field">
              <label>CPF/CNPJ</label>
              <input value={form.documento} onChange={update('documento')} />
            </div>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
