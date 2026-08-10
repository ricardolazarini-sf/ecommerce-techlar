import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import ProductImage from '../components/ProductImage.jsx';
import PixPayment from '../components/PixPayment.jsx';
import Icon from '../components/Icon.jsx';
import { formatPrice, warrantyFee, WARRANTY_RATE } from '../lib/format.js';
import { formatCPF, isValidCPF } from '../lib/cpf.js';
import { formatPhone, isValidPhone } from '../lib/phone.js';

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const RATE_LABEL = `${Math.round(WARRANTY_RATE * 100)}%`;
const itemLabel = (n) => `${n} ${n === 1 ? 'item' : 'itens'}`;
const isService = (item) => String(item.sku || '').startsWith('SVC-');

// O Pix é simulado, mas a compra não: o pedido é criado de verdade antes de a tela
// dizer "aprovado". Como a API responde em poucas centenas de milissegundos, o
// piso de espera existe para o pagamento parecer um pagamento e não um clique —
// e o repouso, para dar tempo de ler o comprovante antes de a página trocar.
const PIX_MIN_WAIT = 1500;
const PIX_HOLD = 2600;

// The API answers 4xx with a readable message; 5xx and transport failures need
// a message the customer can act on.
const friendlyError = (err, subject) =>
  err?.status && err.status < 500 && err.message
    ? err.message
    : `${subject}: a conexão com a TechLar falhou. Tente de novo em alguns segundos.`;

export default function CheckoutPage() {
  const { cart, loading: cartLoading, warranties, refresh, resetAfterCheckout } = useCart();
  const { isAuthenticated, customer, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pix, setPix] = useState(null);
  const [guest, setGuest] = useState({ nome: '', email: '', telefone: '', documento: '' });
  const timers = useRef([]);
  const opened = useRef(false);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const wait = (ms) =>
    new Promise((resolve) => {
      timers.current.push(window.setTimeout(resolve, Math.max(0, ms)));
    });

  // O carrinho só é zerado na saída daqui: zerar antes fazia a página se
  // redesenhar como carrinho vazio por baixo do comprovante. Guardado por `opened`
  // porque o botão do comprovante e o tempo do comprovante levam ao mesmo lugar, e
  // quem chegar primeiro leva.
  const openOrder = (order) => {
    if (opened.current) return;
    opened.current = true;
    resetAfterCheckout();
    navigate(`/pedido/${order.order_number}`, { state: { order } });
  };

  // Starting checkout emits `checkout_started` server-side and returns the
  // authoritative totals, warranty selections included. Waits for the cart so a
  // direct load of /checkout does not mistake a pending cart for an empty one.
  useEffect(() => {
    if (cartLoading) return undefined;
    if (!cart.cart_id || !cart.items.length) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setLoadError('');
    api
      .startCheckout(warranties)
      .then((d) => active && setReview(d.review))
      .catch((e) => active && setLoadError(friendlyError(e, 'A revisão não carregou')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLoading, cart.cart_id, cart.itemCount, reloadKey]);

  const updateGuest = (key) => (e) => setGuest((g) => ({ ...g, [key]: e.target.value }));
  const updateGuestCpf = (e) => setGuest((g) => ({ ...g, documento: formatCPF(e.target.value) }));
  const updateGuestPhone = (e) => setGuest((g) => ({ ...g, telefone: formatPhone(e.target.value) }));

  const confirm = async () => {
    setError('');
    if (!isAuthenticated) {
      if (!guest.nome.trim() || !guest.email.trim()) {
        setError('Preencha nome e email na etapa 02 para finalizar a compra.');
        return;
      }
      if (guest.documento.trim() && !isValidCPF(guest.documento)) {
        setError('O CPF informado não é válido. Confira os 11 dígitos.');
        return;
      }
      if (guest.telefone.trim() && !isValidPhone(guest.telefone)) {
        setError('O telefone informado não é válido. Use DDD e número, como (11) 91234-5678.');
        return;
      }
    }
    setSubmitting(true);
    setPix({ order: null });
    const started = Date.now();
    try {
      const payload = { warranties };
      if (!isAuthenticated) payload.customer = guest;
      const d = await api.confirmCheckout(payload);
      await wait(PIX_MIN_WAIT - (Date.now() - started));
      setPix({ order: d.order });
      await wait(PIX_HOLD);
      openOrder(d.order);
    } catch (err) {
      // A falha volta para a página: o comprovante sai da tela sem nunca ter dito
      // que o pagamento passou.
      setPix(null);
      setError(friendlyError(err, 'A compra não foi finalizada'));
      setSubmitting(false);
    }
  };

  // Waits for the profile too: the customer block must not flash a guest form.
  if (authLoading || cartLoading || loading) return <Loader label="Carregando sua revisão" />;

  // `!pix`: durante o pagamento o carrinho pode chegar vazio de uma atualização do
  // contexto, e a tela de carrinho vazio não pode aparecer no meio de uma compra
  // que está sendo paga.
  if (cart.cart_id && !cart.items.length && !pix) {
    return (
      <div className="empty-state">
        <div className="big">
          <Icon name="cart" size={24} />
        </div>
        <h1>Seu carrinho está vazio</h1>
        <p>Não há nada para finalizar. Escolha um produto no catálogo e volte para cá.</p>
        <div className="co-empty-actions">
          <Link to="/produtos" className="btn btn-primary">
            Ver produtos
          </Link>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <>
        <div className="co-head">
          <h1 className="co-head-title">Revisar e finalizar</h1>
        </div>
        <div className="alert alert-error" role="alert">
          {loadError || 'A revisão não carregou: a conexão com a TechLar falhou. Tente de novo em alguns segundos.'}
        </div>
        <div className="co-retry">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              refresh();
              setReloadKey((k) => k + 1);
            }}
          >
            Tentar de novo
          </button>
          <Link to="/carrinho" className="btn btn-outline">
            Voltar ao carrinho
          </Link>
        </div>
      </>
    );
  }

  const warrantyItems = review.items.filter((i) => i.warranty);
  const serviceItems = review.items.filter(isService);
  const guestValid = isAuthenticated || Boolean(guest.nome.trim() && guest.email.trim());
  const contact = isAuthenticated ? customer : null;

  return (
    <>
      <div className="co-head">
        <h1 className="co-head-title">Revisar e finalizar</h1>
        <span className="co-count">{itemLabel(review.itemCount)}</span>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="split">
        <div>
          <div className="co-step">
            <div className="co-step-mark">
              <span className="co-step-num">01</span>
              <span className="co-step-trace" aria-hidden="true" />
            </div>
            <div className="co-step-body">
              <div className="co-step-head">
                <h2 className="co-step-title">Revisar itens</h2>
                <Link to="/carrinho" className="btn btn-ghost">
                  <Icon name="cart" size={16} />
                  Editar carrinho
                </Link>
              </div>
              <div className="co-lines">
                {review.items.map((item) => {
                  const fee = warrantyFee(item.unit_price, item.qty);
                  return (
                    <div className="co-line" key={item.product_id}>
                      <ProductImage src={item.imagem_url} name={item.nome} className="co-thumb" />
                      <div className="co-line-main">
                        <span className="co-line-name">{item.nome}</span>
                        {isService(item) && <span className="chip">Serviço</span>}
                        <span className="co-line-meta">
                          {item.qty} × {formatPrice(item.unit_price)}
                        </span>
                      </div>
                      <span className="price co-line-value">
                        {formatPrice(round2(item.unit_price * item.qty))}
                      </span>
                      {item.warranty && (
                        <div className="co-addon co-addon-on">
                          <span className="co-addon-label">
                            <Icon name="shield" size={16} className="co-icon" />
                            Garantia estendida
                            <span className="co-addon-rate">{RATE_LABEL} do item</span>
                          </span>
                          <span className="co-addon-value">+ {formatPrice(fee)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="co-step co-step-last">
            <div className="co-step-mark">
              <span className="co-step-num">02</span>
            </div>
            <div className="co-step-body">
              <div className="co-step-head">
                <h2 className="co-step-title">Seus dados</h2>
              </div>

              {contact ? (
                <div className="panel">
                  <div className="co-kv">
                    <div className="co-kv-item">
                      <span className="co-kv-label">Nome</span>
                      <span className="co-kv-value">{contact.nome}</span>
                    </div>
                    <div className="co-kv-item">
                      <span className="co-kv-label">Email</span>
                      <span className="co-kv-value">{contact.email}</span>
                    </div>
                    {contact.telefone && (
                      <div className="co-kv-item">
                        <span className="co-kv-label">Telefone</span>
                        <span className="co-kv-value">{contact.telefone}</span>
                      </div>
                    )}
                    {contact.documento && (
                      <div className="co-kv-item">
                        <span className="co-kv-label">CPF</span>
                        <span className="co-kv-value">{contact.documento}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="panel">
                  <p className="co-panel-lead">
                    Finalize como convidado ou{' '}
                    <Link to="/login" state={{ from: '/checkout' }} className="co-link">
                      entre na sua conta
                    </Link>{' '}
                    para guardar o pedido no seu histórico.
                  </p>
                  <form
                    className="form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      confirm();
                    }}
                  >
                    <div className="field">
                      <label htmlFor="co-nome">Nome</label>
                      <input
                        id="co-nome"
                        autoComplete="name"
                        required
                        value={guest.nome}
                        onChange={updateGuest('nome')}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="co-email">Email</label>
                      <input
                        id="co-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={guest.email}
                        onChange={updateGuest('email')}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="co-telefone">Telefone (opcional)</label>
                      <input
                        id="co-telefone"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={15}
                        placeholder="(11) 91234-5678"
                        value={guest.telefone}
                        onChange={updateGuestPhone}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="co-documento">CPF (opcional)</label>
                      <input
                        id="co-documento"
                        inputMode="numeric"
                        maxLength={14}
                        placeholder="000.000.000-00"
                        value={guest.documento}
                        onChange={updateGuestCpf}
                      />
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          <div className="co-note co-note-spaced">
            <p className="eyebrow">Antes de finalizar</p>
            <span className="co-note-item">
              <Icon name="truck" size={20} className="co-icon" />
              <span>
                <span className="co-note-strong">A TechLar combina a entrega pelo contato deste pedido.</span>{' '}
                Nenhum endereço é pedido nesta compra.
              </span>
            </span>
            {serviceItems.length > 0 && (
              <span className="co-note-item">
                <Icon name="tool" size={20} className="co-icon" />
                <span>
                  <span className="co-note-strong">Serviço no pedido: {serviceItems.map((i) => i.nome).join(', ')}.</span>{' '}
                  A TechLar agenda a visita pelo mesmo contato.
                </span>
              </span>
            )}
            {warrantyItems.length > 0 && (
              <span className="co-note-item">
                <Icon name="shield" size={20} className="co-icon" />
                <span>
                  <span className="co-note-strong">
                    Garantia estendida em {itemLabel(warrantyItems.length)}.
                  </span>{' '}
                  Custa {RATE_LABEL} do valor de cada item e já está somada no total.
                </span>
              </span>
            )}
          </div>
        </div>

        <aside className="panel co-summary" aria-label="Resumo do pedido">
          <p className="eyebrow">Resumo</p>
          <div className="co-sum-row">
            <span>Produtos</span>
            <span className="price co-sum-value">{formatPrice(review.subtotal)}</span>
          </div>
          <div className="co-sum-row">
            <span>
              Garantia estendida
              {warrantyItems.length > 0 && ` · ${itemLabel(warrantyItems.length)}`}
            </span>
            <span className="price co-sum-value">{formatPrice(review.warrantyTotal)}</span>
          </div>
          <div className="co-sum-total">
            <span>Total</span>
            <span className="price co-total">{formatPrice(review.total)}</span>
          </div>
          <div className="co-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              disabled={submitting || !guestValid}
              aria-describedby={guestValid ? undefined : 'co-submit-hint'}
              onClick={confirm}
            >
              {submitting ? 'Confirmando o Pix…' : 'Pagar com Pix'}
            </button>
          </div>
          {!guestValid && (
            <p className="co-fineprint" id="co-submit-hint">
              <Icon name="user" size={16} className="co-icon-quiet" />
              Preencha nome e email na etapa 02 para finalizar.
            </p>
          )}
          <p className="co-fineprint">
            <Icon name="lock" size={16} className="co-icon-quiet" />
            Pix simulado nesta demonstração: nada é cobrado agora.
          </p>
        </aside>
      </div>

      {pix && (
        <PixPayment
          amount={review.total}
          order={pix.order}
          onOpen={() => openOrder(pix.order)}
        />
      )}
    </>
  );
}
