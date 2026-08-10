import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import { formatPrice, formatDate } from '../lib/format.js';
import { formatCPF, isValidCPF } from '../lib/cpf.js';
import { formatCNPJ, isValidCNPJ } from '../lib/cnpj.js';
import { formatPhone, isValidPhone } from '../lib/phone.js';

export default function ProfilePage() {
  const { customer, setCustomer } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    documento: '',
    razaoSocial: '',
    cnpj: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [msgError, setMsgError] = useState(false);

  const isPJ = (customer?.tipo || 'PF') === 'PJ';

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
          telefone: formatPhone(d.customer.telefone || ''),
          documento: formatCPF(d.customer.documento || ''),
          razaoSocial: d.customer.razao_social || d.customer.nome || '',
          cnpj: formatCNPJ(d.customer.cnpj || ''),
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
  const updateCpf = (e) => setForm((f) => ({ ...f, documento: formatCPF(e.target.value) }));
  const updateCnpj = (e) => setForm((f) => ({ ...f, cnpj: formatCNPJ(e.target.value) }));
  const updatePhone = (e) => setForm((f) => ({ ...f, telefone: formatPhone(e.target.value) }));

  const fail = (msg) => {
    setMsgError(true);
    setMessage(msg);
  };

  const save = async (e) => {
    e.preventDefault();
    setMessage('');
    setMsgError(false);

    if (form.telefone.trim() && !isValidPhone(form.telefone)) {
      return fail('Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.');
    }

    let payload;
    if (isPJ) {
      if (!form.razaoSocial.trim()) return fail('Informe a razão social.');
      if (form.cnpj.trim() && !isValidCNPJ(form.cnpj)) return fail('Informe um CNPJ válido.');
      // razão social alimenta tanto razao_social quanto nome (consistência).
      payload = {
        nome: form.razaoSocial,
        razaoSocial: form.razaoSocial,
        cnpj: form.cnpj,
        telefone: form.telefone,
      };
    } else {
      if (!form.nome.trim()) return fail('Informe o nome completo.');
      if (form.documento.trim() && !isValidCPF(form.documento)) return fail('Informe um CPF válido.');
      payload = { nome: form.nome, documento: form.documento, telefone: form.telefone };
    }

    setSaving(true);
    try {
      const d = await api.updateProfile(payload);
      setCustomer(d.customer);
      setMsgError(false);
      setMessage('Perfil atualizado!');
    } catch (err) {
      fail(err.message || 'Erro ao salvar');
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
          {message && (
            <div className={`alert ${msgError ? 'alert-error' : 'alert-success'}`}>{message}</div>
          )}
          <form className="form-grid" onSubmit={save}>
            {isPJ ? (
              <div className="field">
                <label>Razão social</label>
                <input
                  value={form.razaoSocial}
                  onChange={update('razaoSocial')}
                  autoComplete="organization"
                />
              </div>
            ) : (
              <div className="field">
                <label>Nome</label>
                <input value={form.nome} onChange={update('nome')} autoComplete="name" />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input value={customer?.email || ''} disabled />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input
                inputMode="numeric"
                maxLength={15}
                placeholder="(11) 91234-5678"
                value={form.telefone}
                onChange={updatePhone}
              />
            </div>
            {isPJ ? (
              <div className="field">
                <label>CNPJ</label>
                <input
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={updateCnpj}
                />
              </div>
            ) : (
              <div className="field">
                <label>CPF</label>
                <input
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  value={form.documento}
                  onChange={updateCpf}
                />
              </div>
            )}
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
