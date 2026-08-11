import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import Icon from '../components/Icon.jsx';
import { formatPrice, formatDate } from '../lib/format.js';
import { formatCPF, isValidCPF } from '../lib/cpf.js';
import { formatCNPJ, isValidCNPJ } from '../lib/cnpj.js';
import { formatPhone, isValidPhone } from '../lib/phone.js';
import { describedBy } from '../lib/form.js';

// Situação do pedido em português. A base de .status-badge já é a de confirmado.
const STATUS = {
  pending: { label: 'Pendente', variant: 'acc-badge-wait' },
  confirmed: { label: 'Confirmado', variant: '' },
  fulfilled: { label: 'Concluído', variant: 'acc-badge-done' },
  cancelled: { label: 'Cancelado', variant: 'acc-badge-off' },
};

// Mensagem de 4xx vem do servidor em português; 5xx e falha de rede não têm
// texto útil para quem está na tela, então recebem texto próprio.
function errorText(err) {
  if (err?.status >= 400 && err.status < 500) return err.message;
  return 'Não foi possível salvar agora: o serviço de contas não respondeu. Tente de novo em alguns instantes.';
}

// Ordem em que os campos aparecem na tela. Só um de cada par existe por vez,
// conforme a conta seja de pessoa física ou jurídica.
const FIELD_ORDER = ['razaoSocial', 'nome', 'telefone', 'cnpj', 'documento'];

export default function ProfilePage() {
  const { customer, setCustomer } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
  const [errors, setErrors] = useState({});

  // Conta de empresa pede razão social e CNPJ no lugar de nome e CPF.
  const isPJ = (customer?.tipo || 'PF') === 'PJ';

  // Cada erro fica ao lado do campo que precisa de correção, e o foco vai até o
  // primeiro deles.
  const inputs = useRef({});
  const bind = (name) => (el) => {
    inputs.current[name] = el;
  };

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
      .catch(() => {
        if (active) {
          setLoadError(
            'Não foi possível carregar seus dados agora. Atualize a página em alguns instantes.',
          );
        }
      })
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

  const errorFor = (field) => errors[field] || '';

  // Valida o formulário inteiro de uma vez: quem errou dois campos merece saber
  // dos dois agora, e não um a cada envio.
  const validate = () => {
    const found = {};
    if (isPJ) {
      if (!form.razaoSocial.trim()) found.razaoSocial = 'Informe a razão social para continuar.';
      if (form.cnpj.trim() && !isValidCNPJ(form.cnpj)) {
        found.cnpj = 'CNPJ inválido. Confira os 14 dígitos e digite de novo.';
      }
    } else {
      if (!form.nome.trim()) found.nome = 'Informe o nome completo para continuar.';
      if (form.documento.trim() && !isValidCPF(form.documento)) {
        found.documento = 'CPF inválido. Confira os 11 dígitos e digite de novo.';
      }
    }
    if (form.telefone.trim() && !isValidPhone(form.telefone)) {
      found.telefone = 'Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.';
    }
    return found;
  };

  const save = async (e) => {
    e.preventDefault();
    setMessage('');
    setMsgError(false);

    const found = validate();
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      inputs.current[first]?.focus();
      return;
    }

    // Na conta de empresa a razão social alimenta razao_social e nome, para os
    // dois não divergirem no registro.
    const payload = isPJ
      ? {
          nome: form.razaoSocial,
          razaoSocial: form.razaoSocial,
          cnpj: form.cnpj,
          telefone: form.telefone,
        }
      : { nome: form.nome, documento: form.documento, telefone: form.telefone };

    setSaving(true);
    try {
      const d = await api.updateProfile(payload);
      setCustomer(d.customer);
      setMsgError(false);
      setMessage('Alterações salvas.');
    } catch (err) {
      fail(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Carregando sua conta..." />;

  // Sem histórico e sem falha de carga são coisas diferentes: só convida a
  // comprar quando a lista voltou vazia de verdade.
  const showBlank = !loadError && !orders.length;

  return (
    <>
      <div className="acc-page-head">
        <h1 className="acc-page-title">Minha conta</h1>
        <p className="acc-page-lead">Acompanhe seus pedidos e mantenha seus dados em dia.</p>
      </div>

      {loadError && (
        <div className="alert alert-error" role="alert">
          {loadError}
        </div>
      )}

      <div className="split">
        <section className="panel">
          <div className="acc-panel-head">
            <h2 className="acc-panel-title">Histórico de pedidos</h2>
            {orders.length > 0 && (
              <span className="acc-panel-count">
                {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            )}
          </div>

          {orders.length > 0 && (
            <ul className="acc-list">
              {orders.map((o) => {
                const status = STATUS[o.status] || { label: o.status, variant: '' };
                const warranty = Number(o.total) - Number(o.subtotal);
                return (
                  <li className="acc-record" key={o.order_number}>
                    <div className="acc-order-head">
                      <span className="order-number acc-order-number">{o.order_number}</span>
                      <span className={`status-badge ${status.variant}`}>{status.label}</span>
                    </div>
                    {/* Quando e quanto, na mesma linha: é o que se procura ao
                        percorrer o histórico de cima a baixo. */}
                    <div className="acc-order-meta">
                      <span className="acc-order-date">{formatDate(o.created_at)}</span>
                      <span className="price">
                        <span className="sr-only">Total do pedido: </span>
                        {formatPrice(o.total)}
                      </span>
                    </div>

                    <ul className="acc-order-items">
                      {o.items.map((i) => (
                        <li className="acc-order-item" key={i.product_id}>
                          <div className="acc-order-line">
                            <Link to={`/produtos/${i.product_id}`} className="acc-order-name">
                              {i.nome}
                            </Link>
                            <span className="acc-order-value">
                              {formatPrice(Number(i.unit_price) * i.qty)}
                            </span>
                          </div>
                          {(i.qty > 1 || i.warranty) && (
                            <div className="acc-order-note">
                              {i.qty > 1 && (
                                <span className="acc-order-unit">
                                  {i.qty} × {formatPrice(i.unit_price)}
                                </span>
                              )}
                              {i.warranty && (
                                <span className="acc-order-warranty">
                                  <Icon name="shield" size={14} />
                                  Garantia estendida
                                </span>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>

                    {warranty > 0.005 && (
                      <div className="acc-order-breakdown">
                        <div className="acc-order-breakdown-row">
                          <span>Produtos</span>
                          <span className="acc-order-value">{formatPrice(o.subtotal)}</span>
                        </div>
                        <div className="acc-order-breakdown-row">
                          <span>Garantia estendida</span>
                          <span className="acc-order-value">{formatPrice(warranty)}</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {showBlank && (
            <div className="acc-blank">
              <span className="acc-blank-mark">
                <Icon name="package" />
              </span>
              <div className="acc-blank-body">
                <p className="acc-blank-text">
                  Você ainda não fez pedidos. Cada compra aparece aqui com os itens, as garantias e o
                  total.
                </p>
                <Link to="/produtos" className="acc-blank-link">
                  Ver produtos
                  <Icon name="arrowRight" size={16} />
                </Link>
              </div>
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="acc-panel-head">
            <h2 className="acc-panel-title">Dados cadastrais</h2>
          </div>

          {message && (
            <div
              className={`alert ${msgError ? 'alert-error' : 'alert-success'}`}
              role={msgError ? 'alert' : 'status'}
            >
              {message}
            </div>
          )}

          <div className="acc-fact">
            <span className="acc-fact-label">E-mail</span>
            <span className="acc-fact-value">{customer?.email || '—'}</span>
            <p className="field-hint acc-fact-hint">
              O e-mail identifica sua conta e não muda por aqui.
            </p>
          </div>

          <form className="form-grid" onSubmit={save}>
            {isPJ ? (
              <div className="field">
                <label htmlFor="perfil-razao">Razão social</label>
                <input
                  id="perfil-razao"
                  ref={bind('razaoSocial')}
                  value={form.razaoSocial}
                  onChange={update('razaoSocial')}
                  autoComplete="organization"
                  aria-invalid={errorFor('razaoSocial') ? 'true' : undefined}
                  aria-describedby={describedBy(errorFor('razaoSocial') && 'perfil-razao-erro')}
                />
                {errorFor('razaoSocial') && (
                  <span className="acc-field-error" id="perfil-razao-erro" role="alert">
                    {errorFor('razaoSocial')}
                  </span>
                )}
              </div>
            ) : (
              <div className="field">
                <label htmlFor="perfil-nome">Nome completo</label>
                <input
                  id="perfil-nome"
                  ref={bind('nome')}
                  value={form.nome}
                  onChange={update('nome')}
                  autoComplete="name"
                  aria-invalid={errorFor('nome') ? 'true' : undefined}
                  aria-describedby={describedBy(errorFor('nome') && 'perfil-nome-erro')}
                />
                {errorFor('nome') && (
                  <span className="acc-field-error" id="perfil-nome-erro" role="alert">
                    {errorFor('nome')}
                  </span>
                )}
              </div>
            )}

            <div className="field">
              <label htmlFor="perfil-telefone">Telefone</label>
              <input
                id="perfil-telefone"
                ref={bind('telefone')}
                inputMode="tel"
                maxLength={15}
                placeholder="(11) 91234-5678"
                value={form.telefone}
                onChange={updatePhone}
                autoComplete="tel"
                aria-invalid={errorFor('telefone') ? 'true' : undefined}
                aria-describedby={describedBy(
                  'perfil-telefone-hint',
                  errorFor('telefone') && 'perfil-telefone-erro',
                )}
              />
              <span className="field-hint" id="perfil-telefone-hint">
                DDD + número, para combinarmos a entrega e a instalação.
              </span>
              {errorFor('telefone') && (
                <span className="acc-field-error" id="perfil-telefone-erro" role="alert">
                  {errorFor('telefone')}
                </span>
              )}
            </div>

            {isPJ ? (
              <div className="field">
                <label htmlFor="perfil-cnpj">CNPJ</label>
                <input
                  id="perfil-cnpj"
                  ref={bind('cnpj')}
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={updateCnpj}
                  autoComplete="off"
                  aria-invalid={errorFor('cnpj') ? 'true' : undefined}
                  aria-describedby={describedBy(
                    'perfil-cnpj-hint',
                    errorFor('cnpj') && 'perfil-cnpj-erro',
                  )}
                />
                <span className="field-hint" id="perfil-cnpj-hint">
                  Vai na nota fiscal e registra a garantia estendida no nome da empresa.
                </span>
                {errorFor('cnpj') && (
                  <span className="acc-field-error" id="perfil-cnpj-erro" role="alert">
                    {errorFor('cnpj')}
                  </span>
                )}
              </div>
            ) : (
              <div className="field">
                <label htmlFor="perfil-cpf">CPF</label>
                <input
                  id="perfil-cpf"
                  ref={bind('documento')}
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  value={form.documento}
                  onChange={updateCpf}
                  autoComplete="off"
                  aria-invalid={errorFor('documento') ? 'true' : undefined}
                  aria-describedby={describedBy(
                    'perfil-cpf-hint',
                    errorFor('documento') && 'perfil-cpf-erro',
                  )}
                />
                <span className="field-hint" id="perfil-cpf-hint">
                  Vai na nota fiscal e registra a garantia estendida no seu nome.
                </span>
                {errorFor('documento') && (
                  <span className="acc-field-error" id="perfil-cpf-erro" role="alert">
                    {errorFor('documento')}
                  </span>
                )}
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
