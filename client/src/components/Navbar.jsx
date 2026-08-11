import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { track } from '../lib/track.js';
import Icon from './Icon.jsx';

export default function Navbar() {
  const { isAuthenticated, customer, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  // No celular os dois grupos de links são o menu, e o botão abre os dois.
  const menuClass = (base) => `${base} ${open ? 'open' : ''}`.trim();

  const onSearch = (e) => {
    e.preventDefault();
    close();
    const query = term.trim();
    // Só o submit é medido: digitação sem enviar não é intenção, é rascunho.
    if (query) track('search_performed', { search_term: query, surface: 'navbar' });
    navigate(`/produtos${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };

  const onLogout = () => {
    close();
    logout();
  };

  const firstName = customer?.nome?.split(' ')[0];

  const cartLabel = cart.itemCount
    ? `Carrinho, ${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'itens'}`
    : 'Carrinho, vazio';

  return (
    <header className="shell-bar">
      <div className="container shell-bar-inner">
        <Link to="/" className="shell-brand" aria-label="TechLar — página inicial" onClick={close}>
          <img
            className="shell-logo"
            src="/logo.png"
            alt="TechLar"
            width="156"
            height="40"
            decoding="async"
          />
        </Link>

        <nav id="shell-nav" className={menuClass('shell-nav')} aria-label="Catálogo">
          <NavLink to="/produtos" className="shell-link" onClick={close}>
            Produtos
          </NavLink>

          {isAuthenticated && (
            <NavLink to="/lista-de-desejos" className="shell-link" onClick={close}>
              <Icon name="heart" size={18} />
              Lista de desejos
            </NavLink>
          )}
        </nav>

        <form className="shell-search" onSubmit={onSearch} role="search">
          <input
            className="shell-search-input"
            type="search"
            placeholder="Buscar smartphone, notebook…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Buscar produtos"
          />
          <button type="submit" className="shell-search-submit" aria-label="Buscar produtos">
            <Icon name="search" size={18} />
          </button>
        </form>

        <nav id="shell-account" className={menuClass('shell-account')} aria-label="Conta">
          {isAuthenticated ? (
            <>
              <NavLink to="/perfil" className="shell-link" onClick={close}>
                <Icon name="user" size={18} />
                {firstName ? `Olá, ${firstName}` : 'Perfil'}
              </NavLink>
              <button type="button" className="shell-link" onClick={onLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="shell-link" onClick={close}>
                <Icon name="user" size={18} />
                Entrar
              </NavLink>
              <Link to="/cadastro" className="shell-link shell-link-strong" onClick={close}>
                Criar conta
              </Link>
            </>
          )}
        </nav>

        <div className="shell-actions">
          <NavLink
            to="/carrinho"
            className={`shell-cart ${cart.itemCount ? 'shell-cart-full' : ''}`}
            aria-label={cartLabel}
            onClick={close}
          >
            <Icon name="cart" />
            <span className="shell-cart-label">Carrinho</span>
            {cart.itemCount > 0 && <span className="shell-cart-count">{cart.itemCount}</span>}
          </NavLink>

          <button
            type="button"
            className="shell-toggle"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            aria-controls="shell-nav shell-account"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  );
}
