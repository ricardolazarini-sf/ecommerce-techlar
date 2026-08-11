import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import ProductImage from '../components/ProductImage.jsx';
import PixPayment from '../components/PixPayment.jsx';
import Icon from '../components/Icon.jsx';
import { DrawnRule } from '../components/Drawn.jsx';
import CustomerFields, { AddressFields, useCustomerForm } from '../components/CustomerForm.jsx';
import { track } from '../lib/track.js';
import { validateAddress } from '../lib/customerForm.js';
import { formatPrice, isServiceItem, WARRANTY_RATE } from '../lib/format.js';
import { formatCPF } from '../lib/cpf.js';
import { formatCNPJ, formatCEP } from '../lib/cnpj.js';

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const RATE_LABEL = `${Math.round(WARRANTY_RATE * 100)}%`;
const itemLabel = (n) => `${n} ${n === 1 ? 'item' : 'itens'}`;

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
  const { cart, loading: cartLoading, warranty, refresh, resetAfterCheckout } = useCart();
  const { isAuthenticated, customer, loading: authLoading, register, setCustomer } = useAuth();
  const navigate = useNavigate();

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pix, setPix] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressNote, setAddressNote] = useState(null);
  const timers = useRef([]);
  const opened = useRef(false);

  // Sem conta, a etapa 02 é o cadastro inteiro — o mesmo da página "Criar conta".
  // Com conta, é só o endereço, que é o dado que muda de uma compra para outra.
  const account = useCustomerForm();
  const address = useCustomerForm({ validate: validateAddress });
  const fillAddress = address.fill;

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (!customer) return;
    fillAddress({
      addressLine1: customer.address_line1 || '',
      city: customer.city || '',
      state: customer.state || '',
      postalCode: formatCEP(customer.postal_code || ''),
    });
  }, [customer, fillAddress]);

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
    // Pagamento em curso não pede revisão nova: o carrinho já virou pedido, e o
    // pedido de revisão voltaria 400 em cima de uma compra que deu certo.
    if (submitting || pix) return undefined;
    if (!cart.cart_id || !cart.items.length) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setLoadError('');
    api
      .startCheckout(warranty)
      .then((d) => {
        if (!active) return;
        setReview(d.review);
        track('checkout_started', {
          item_count: d.review.itemCount,
          subtotal: d.review.subtotal,
          total: d.review.total,
          discount: d.review.discountTotal,
          combo_id: d.review.combo?.slug,
          action: warranty ? 'com-garantia' : 'sem-garantia',
        });
      })
      .catch((e) => active && setLoadError(friendlyError(e, 'A revisão não carregou')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLoading, cart.cart_id, cart.itemCount, warranty, reloadKey]);

  // Atualizar o endereço aqui vale para este pedido e para os próximos: é o
  // cadastro que está sendo corrigido, não uma cópia do endereço no pedido.
  const saveAddress = async (e) => {
    e.preventDefault();
    setAddressNote(null);
    if (!address.check()) return;

    setSavingAddress(true);
    try {
      const d = await api.updateProfile({
        addressLine1: address.form.addressLine1,
        city: address.form.city,
        state: address.form.state,
        postalCode: address.form.postalCode,
      });
      setCustomer(d.customer);
      setAddressNote({ text: 'Endereço atualizado.', ok: true });
    } catch (err) {
      setAddressNote({ text: friendlyError(err, 'O endereço não foi salvo'), ok: false });
    } finally {
      setSavingAddress(false);
    }
  };

  const confirm = async () => {
    setError('');
    // Sem conta, o cadastro é criado antes de o pagamento aparecer: se o e-mail
    // já existir, ninguém vê uma tela de Pix que não vai virar pedido.
    if (!isAuthenticated && !account.check()) {
      setError('Confira os campos marcados na etapa 02 para finalizar a compra.');
      return;
    }

    setSubmitting(true);
    try {
      if (!isAuthenticated) await register(account.payload());

      setPix({ order: null });
      const started = Date.now();
      const d = await api.confirmCheckout({ warranty });
      // Fecha o funil: clique no combo -> carrinho qualificado -> pedido pago.
      track('order_placed', {
        order_number: d.order.order_number,
        status: d.order.status,
        subtotal: d.order.subtotal,
        total: d.order.total,
        discount: d.order.discount_total,
        combo_id: d.order.combo_slug,
        item_count: d.order.items?.length,
        items: d.order.items?.map((i) => ({
          product_id: i.product_id,
          qty: i.qty,
          unit_price: i.unit_price,
        })),
        action: d.order.warranty ? 'com-garantia' : 'sem-garantia',
      });
      await wait(PIX_MIN_WAIT - (Date.now() - started));
      setPix({ order: d.order });
      await wait(PIX_HOLD);
      openOrder(d.order);
    } catch (err) {
      // A falha volta para a página: o comprovante sai da tela sem nunca ter dito
      // que o pagamento passou. O topo é onde o aviso está, e o formulário é
      // longo o bastante para o aviso ficar fora da tela.
      setPix(null);
      setError(friendlyError(err, 'A compra não foi finalizada'));
      setSubmitting(false);
      window.scrollTo({ top: 0 });
    }
  };

  // Waits for the profile too: the customer block must not flash a guest form.
  // Durante o pagamento não: criar a conta reidrata o perfil, e a espera do
  // perfil não pode apagar o comprovante que já está na tela.
  if ((authLoading || cartLoading || loading) && !pix && !submitting) {
    return <Loader label="Carregando sua revisão" />;
  }

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

  const serviceItems = review.items.filter(isServiceItem);
  const contact = isAuthenticated ? customer : null;
  const isPJ = (contact?.tipo || 'PF') === 'PJ';

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
                {review.items.map((item) => (
                  <div className="co-line" key={item.product_id}>
                    <ProductImage src={item.imagem_url} name={item.nome} className="co-thumb" />
                    <div className="co-line-main">
                      <span className="co-line-name">{item.nome}</span>
                      {isServiceItem(item) && <span className="chip">Serviço</span>}
                      {item.in_combo && review.combo && (
                        <span className="chip co-chip-combo">
                          {review.combo.percent}% no combo
                        </span>
                      )}
                      <span className="co-line-meta">
                        {item.qty} × {formatPrice(item.unit_price)}
                      </span>
                    </div>
                    <span className="price co-line-value">
                      {formatPrice(round2(item.unit_price * item.qty))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="co-step co-step-last">
            <div className="co-step-mark">
              <span className="co-step-num">02</span>
            </div>
            <div className="co-step-body">
              <div className="co-step-head">
                <h2 className="co-step-title">{contact ? 'Seus dados' : 'Seu cadastro'}</h2>
              </div>

              {contact ? (
                <div className="panel">
                  <div className="co-kv">
                    <div className="co-kv-item">
                      <span className="co-kv-label">{isPJ ? 'Razão social' : 'Nome'}</span>
                      <span className="co-kv-value">{contact.nome}</span>
                    </div>
                    <div className="co-kv-item">
                      <span className="co-kv-label">E-mail</span>
                      <span className="co-kv-value">{contact.email}</span>
                    </div>
                    {contact.telefone && (
                      <div className="co-kv-item">
                        <span className="co-kv-label">Telefone</span>
                        <span className="co-kv-value">{contact.telefone}</span>
                      </div>
                    )}
                    {isPJ && contact.cnpj && (
                      <div className="co-kv-item">
                        <span className="co-kv-label">CNPJ</span>
                        <span className="co-kv-value">{formatCNPJ(contact.cnpj)}</span>
                      </div>
                    )}
                    {!isPJ && contact.documento && (
                      <div className="co-kv-item">
                        <span className="co-kv-label">CPF</span>
                        <span className="co-kv-value">{formatCPF(contact.documento)}</span>
                      </div>
                    )}
                  </div>

                  <p className="co-panel-lead co-panel-lead-spaced">
                    Estes dados vêm da sua conta e você muda em{' '}
                    <Link to="/perfil" className="co-link">
                      Minha conta
                    </Link>
                    . O endereço pode ser corrigido aqui mesmo.
                  </p>

                  <DrawnRule className="acc-group-rule" />

                  {addressNote && (
                    <div
                      className={`alert ${addressNote.ok ? 'alert-success' : 'alert-error'}`}
                      role={addressNote.ok ? 'status' : 'alert'}
                    >
                      {addressNote.text}
                    </div>
                  )}

                  <form className="acc-auth-form" onSubmit={saveAddress} noValidate>
                    <fieldset className="acc-group">
                      <legend>
                        <span className="eyebrow">Onde entregamos e instalamos</span>
                      </legend>
                      <AddressFields state={address} />
                    </fieldset>

                    <div className="co-address-actions">
                      <button className="btn btn-outline" disabled={savingAddress}>
                        {savingAddress ? 'Salvando...' : 'Atualizar endereço'}
                      </button>
                      <span className="co-address-hint">
                        Vale para este pedido e para os próximos.
                      </span>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="panel">
                  <p className="co-panel-lead">
                    Sua conta é criada com este cadastro quando você finaliza — assim o pedido, a
                    nota e a garantia ficam no seu nome. Já tem conta?{' '}
                    <Link to="/login" state={{ from: '/checkout' }} className="co-link">
                      Entre para pagar mais rápido
                    </Link>
                    .
                  </p>
                  <form
                    className="acc-auth-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      confirm();
                    }}
                    noValidate
                  >
                    <CustomerFields state={account} />
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
                <span className="co-note-strong">
                  A TechLar combina a entrega pelo contato deste pedido.
                </span>{' '}
                A visita vai ao endereço da etapa 02.
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
            {review.warranty && (
              <span className="co-note-item">
                <Icon name="shield" size={20} className="co-icon" />
                <span>
                  <span className="co-note-strong">Garantia estendida desta compra.</span>{' '}
                  Custa {RATE_LABEL} de {formatPrice(review.warrantyBase)}
                  {review.discountTotal > 0 ? ', o que ficou fora do combo' : ''}, e já está somada
                  no total. Você muda a escolha no{' '}
                  <Link to="/carrinho" className="co-link">
                    carrinho
                  </Link>
                  .
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
          {review.combo && review.discountTotal > 0 && (
            <div className="co-sum-row co-sum-row-off">
              <span>
                {review.combo.nome}
                <span className="co-sum-rate">{review.combo.percent}% no combo</span>
              </span>
              <span className="price co-sum-value">− {formatPrice(review.discountTotal)}</span>
            </div>
          )}
          <div className="co-sum-row">
            <span>
              Garantia estendida
              {review.warranty && <span className="co-sum-rate">{RATE_LABEL} da compra</span>}
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
              disabled={submitting}
              aria-describedby={isAuthenticated ? undefined : 'co-submit-hint'}
              onClick={confirm}
            >
              {submitting ? 'Confirmando o Pix…' : 'Pagar com Pix'}
            </button>
          </div>
          {!isAuthenticated && (
            <p className="co-fineprint" id="co-submit-hint">
              <Icon name="user" size={16} className="co-icon-quiet" />
              Ao finalizar, criamos sua conta com o cadastro da etapa 02.
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
