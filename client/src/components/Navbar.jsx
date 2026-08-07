import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { isAuthenticated, customer, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/produtos${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ''}`);
  };

  const firstName = customer?.nome?.split(' ')[0];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" aria-label="TechLar — página inicial">
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

        <nav className="nav-actions">
          <NavLink to="/produtos" className="nav-link">
            Produtos
          </NavLink>

          {isAuthenticated && (
            <NavLink to="/lista-de-desejos" className="nav-link">
              Desejos
            </NavLink>
          )}

          <NavLink to="/carrinho" className="nav-link cart-btn" aria-label="Carrinho">
            🛒 Carrinho
            {cart.itemCount > 0 && <span className="cart-badge">{cart.itemCount}</span>}
          </NavLink>

          {isAuthenticated ? (
            <>
              <NavLink to="/perfil" className="nav-link">
                {firstName ? `Olá, ${firstName}` : 'Perfil'}
              </NavLink>
              <button className="btn btn-ghost btn-sm" onClick={logout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">
                Entrar
              </NavLink>
              <Link to="/cadastro" className="btn btn-primary btn-sm">
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
