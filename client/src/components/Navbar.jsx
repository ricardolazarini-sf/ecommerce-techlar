import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { isAuthenticated, customer, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const onSearch = (e) => {
    e.preventDefault();
    close();
    navigate(`/produtos${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ''}`);
  };

  const onLogout = () => {
    close();
    logout();
  };

  const firstName = customer?.nome?.split(' ')[0];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" aria-label="TechLar — página inicial" onClick={close}>
          <img src="/logo.png" alt="TechLar" />
        </Link>

        <form className="nav-search" onSubmit={onSearch} role="search">
          <input
            type="search"
            placeholder="Buscar por notebooks, monitores, casa inteligente..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Buscar produtos"
          />
          <button type="submit">Buscar</button>
        </form>

        <NavLink to="/carrinho" className="nav-link cart-btn" aria-label="Carrinho" onClick={close}>
          <span aria-hidden="true">🛒</span>
          <span className="cart-label">Carrinho</span>
          {cart.itemCount > 0 && <span className="cart-badge">{cart.itemCount}</span>}
        </NavLink>

        <button
          type="button"
          className={`nav-toggle ${open ? 'open' : ''}`}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-menu ${open ? 'open' : ''}`}>
          <NavLink to="/produtos" className="nav-link" onClick={close}>
            Produtos
          </NavLink>

          {isAuthenticated && (
            <NavLink to="/lista-de-desejos" className="nav-link" onClick={close}>
              Desejos
            </NavLink>
          )}

          {isAuthenticated ? (
            <>
              <NavLink to="/perfil" className="nav-link" onClick={close}>
                {firstName ? `Olá, ${firstName}` : 'Perfil'}
              </NavLink>
              <button className="btn btn-ghost btn-sm" onClick={onLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link" onClick={close}>
                Entrar
              </NavLink>
              <Link to="/cadastro" className="btn btn-primary btn-sm" onClick={close}>
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
