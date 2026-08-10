import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { formatPrice, formatTime } from '../lib/format.js';

// A tela do pagamento toma a página inteira, como num app de banco: no segundo em
// que o dinheiro sai, nada mais na tela tem importância. São dois estados e um só
// caminho entre eles — confirmando, aprovado —, porque um pagamento não tem meio
// termo para quem paga.
//
// Só apresentação: quem manda no tempo é o checkout, que só declara aprovado
// depois que o pedido existe de verdade (ver PIX_MIN_WAIT e PIX_HOLD lá). Esta
// tela nunca diz "aprovado" antes da confirmação do servidor.
export default function PixPayment({ amount, order, onOpen }) {
  const approved = Boolean(order);
  const openButton = useRef(null);

  // Aprovado, o foco vai para a única ação da tela: quem usa teclado não fica
  // esperando o tempo do recibo correr sem ter o que fazer.
  useEffect(() => {
    if (approved) openButton.current?.focus();
  }, [approved]);

  return (
    <div className="co-pix">
      <div className="co-pix-sheet">
        <p className="eyebrow">Pagamento Pix</p>

        <div className={`co-pix-mark ${approved ? 'co-pix-mark-on' : ''}`} aria-hidden="true">
          {approved ? (
            <svg className="co-pix-tick" viewBox="0 0 44 44" focusable="false">
              <path
                className="drawn-path co-pix-tick-path"
                pathLength="1"
                d="M11 22.5 L18.5 30 L33 15.5"
              />
            </svg>
          ) : (
            <span className="spinner" />
          )}
        </div>

        <p className="price co-pix-amount">{formatPrice(amount)}</p>

        {/* Uma região viva só: o estado do pagamento é a única coisa que muda. */}
        <div className="co-pix-state" role="status">
          <p className="co-pix-title">{approved ? 'Pix aprovado' : 'Confirmando o pagamento'}</p>
          <p className="co-pix-note">
            {approved
              ? `Recebido por TechLar às ${formatTime(order.created_at || Date.now())}`
              : 'O banco confirma o Pix em alguns segundos.'}
          </p>
        </div>

        {approved && (
          <>
            <dl className="co-pix-receipt">
              <dt className="co-pix-receipt-label">Identificador</dt>
              <dd className="co-pix-receipt-value">{order.order_number}</dd>
            </dl>

            <button
              ref={openButton}
              type="button"
              className="btn btn-primary btn-lg btn-block co-pix-open"
              onClick={onOpen}
            >
              Ver o pedido
              <Icon name="arrowRight" size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
