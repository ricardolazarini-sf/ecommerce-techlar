import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import ProductImage from '../components/ProductImage.jsx';
import DeliveryMap from '../components/DeliveryMap.jsx';
import Icon from '../components/Icon.jsx';
import { formatPrice, formatDate, WARRANTY_RATE } from '../lib/format.js';

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const RATE_LABEL = `${Math.round(WARRANTY_RATE * 100)}%`;
const itemLabel = (n) => `${n} ${n === 1 ? 'item' : 'itens'}`;
const isService = (item) => String(item.sku || '').startsWith('SVC-');

const STATUS_LABEL = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  fulfilled: 'Concluído',
};

export default function OrderConfirmationPage() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const { isAuthenticated, customer } = useAuth();
  const fromCheckout = location.state?.order || null;

  const [order, setOrder] = useState(fromCheckout);
  const [loading, setLoading] = useState(!fromCheckout && isAuthenticated);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Order details are only readable by the customer who owns them; a guest sees
  // what checkout handed over and nothing more.
  useEffect(() => {
    if (order || !isAuthenticated) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setLoadError('');
    setNotFound(false);
    api
      .getOrder(orderNumber)
      .then((d) => active && setOrder(d.order))
      .catch((err) => {
        if (!active) return;
        if (err?.status === 404) setNotFound(true);
        else
          setLoadError(
            'O resumo deste pedido não carregou: a conexão com a TechLar falhou. Tente de novo em alguns segundos.',
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator.clipboard);

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (loading) return <Loader label="Carregando seu pedido" />;

  if (notFound) {
    return (
      <div className="panel co-receipt">
        <div className="alert alert-error" role="alert">
          Não encontramos o pedido {orderNumber} na sua conta. Confira o número que aparece na
          confirmação da compra.
        </div>
        <div className="co-block-actions">
          <Link to="/perfil" className="btn btn-primary">
            Ver meus pedidos
          </Link>
          <Link to="/produtos" className="btn btn-outline">
            Ver produtos
          </Link>
        </div>
      </div>
    );
  }

  const warrantyItems = order?.items?.filter((i) => i.warranty) || [];
  const serviceItems = order?.items?.filter(isService) || [];
  const warrantyTotal =
    order?.warrantyTotal ?? (order ? round2(Number(order.total) - Number(order.subtotal)) : 0);
  const statusOk = !order || order.status === 'confirmed' || order.status === 'fulfilled';
  const statusText = order ? STATUS_LABEL[order.status] || order.status : 'Confirmado';
  const hasNextSteps = serviceItems.length > 0 || warrantyItems.length > 0 || isAuthenticated;

  return (
    <div className="panel co-receipt">
      <div className="co-confirm">
        <div className={`co-confirm-mark ${statusOk ? '' : 'co-confirm-mark-off'}`}>
          <Icon name={statusOk ? 'check' : 'package'} size={20} />
        </div>
        <div>
          <p className="eyebrow">Pedido {statusText}</p>
          <h1 className="order-number co-order-no">
            <span className="sr-only">Pedido </span>
            {orderNumber}
          </h1>
          <p className="co-panel-lead">
            {order?.created_at
              ? `Compra finalizada em ${formatDate(order.created_at)}.`
              : 'Compra finalizada.'}
          </p>
          {canCopy && (
            <div className="co-order-line">
              <button type="button" className="btn btn-outline" onClick={copyNumber}>
                {copied && <Icon name="check" size={16} />}
                {copied ? 'Número copiado' : 'Copiar número'}
              </button>
            </div>
          )}
        </div>
      </div>

      {loadError && (
        <div className="co-block">
          <div className="alert alert-error" role="alert">
            {loadError}
          </div>
          <div className="co-block-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Tentar de novo
            </button>
          </div>
        </div>
      )}

      <div className="co-block">
        <p className="eyebrow">Entrega</p>
        <DeliveryMap sentAt={order?.created_at} city={customer?.city} />
        <p className="co-fineprint">
          <Icon name="truck" size={16} className="co-icon-quiet" />
          Rastreio simulado nesta demonstração: a TechLar combina a entrega pelo contato do
          pedido.
        </p>
      </div>

      {order ? (
        <div className="co-block">
          <p className="eyebrow">Itens</p>
          {order.items?.length > 0 && (
            <div className="co-ledger">
              {order.items.map((item) => (
                <div className="co-line" key={item.product_id}>
                  <ProductImage src={item.imagem_url} name={item.nome} className="co-thumb" />
                  <div className="co-line-main">
                    <span className="co-line-name">{item.nome}</span>
                    {isService(item) && <span className="chip">Serviço</span>}
                    <span className="co-line-meta">
                      {item.qty} × {formatPrice(item.unit_price)}
                    </span>
                    {item.warranty && (
                      <span className="co-line-tag">
                        <Icon name="shield" size={16} className="co-icon" />
                        Com garantia estendida
                      </span>
                    )}
                  </div>
                  <span className="price co-line-value">
                    {formatPrice(round2(Number(item.unit_price) * Number(item.qty)))}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="co-sum-row">
            <span>Produtos</span>
            <span className="price co-sum-value">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="co-sum-row">
            <span>
              Garantia estendida
              {warrantyItems.length > 0 && ` · ${itemLabel(warrantyItems.length)}`}
            </span>
            <span className="price co-sum-value">{formatPrice(warrantyTotal)}</span>
          </div>
          <div className="co-sum-total">
            <span>Total</span>
            <span className="price co-total">{formatPrice(order.total)}</span>
          </div>
          <p className="co-fineprint">
            <Icon name="lock" size={16} className="co-icon-quiet" />
            Pago em Pix, simulado nesta demonstração: nada foi cobrado.
          </p>
        </div>
      ) : (
        !loadError && (
          <div className="co-block">
            <p className="co-panel-lead">
              Você finalizou como convidado, então o resumo dos itens não fica disponível nesta
              página. Guarde o número acima: é por ele que a TechLar identifica sua compra.
            </p>
          </div>
        )
      )}

      {/* A entrega saiu daqui: já está dita no mapa acima, e repetir seria a mesma
          frase duas vezes na mesma página. Sem serviço, sem garantia e sem conta,
          não sobra o que dizer — e seção com rótulo e nada dentro é pior que seção
          nenhuma. */}
      {hasNextSteps && (
      <div className="co-block">
        <p className="eyebrow">O que acontece agora</p>
        <div className="co-note">
          {serviceItems.length > 0 && (
            <span className="co-note-item">
              <Icon name="tool" size={20} className="co-icon" />
              <span>
                <span className="co-note-strong">
                  Serviço no pedido: {serviceItems.map((i) => i.nome).join(', ')}.
                </span>{' '}
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
                Custa {RATE_LABEL} do valor de cada item e já está no total acima.
              </span>
            </span>
          )}
          {isAuthenticated && (
            <span className="co-note-item">
              <Icon name="user" size={20} className="co-icon" />
              <span>
                <span className="co-note-strong">O pedido fica no seu histórico.</span> Consulte
                quando quiser em{' '}
                <Link to="/perfil" className="co-link">
                  Meus pedidos
                </Link>
                .
              </span>
            </span>
          )}
        </div>
      </div>
      )}

      <div className="co-block">
        <div className="co-block-actions">
          <Link to="/produtos" className="btn btn-primary">
            Continuar comprando
          </Link>
          {isAuthenticated && (
            <Link to="/perfil" className="btn btn-outline">
              Ver meus pedidos
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
