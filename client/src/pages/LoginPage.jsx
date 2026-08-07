import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/perfil';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Falha ao entrar');
      setSubmitting(false);
    }
  };

  return (
    <div className="panel auth-card">
      <h2>Entrar</h2>
      <p className="muted">Acesse sua conta TechLar.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <form className="form-grid" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Não tem conta? <Link to="/cadastro" state={{ from }}>Criar conta</Link>
      </p>
      <div
        className="alert"
        style={{ background: 'var(--gold-soft)', color: 'var(--gold-dark)', marginTop: '1rem' }}
      >
        Conta de demonstração: <strong>demo@techlar.com</strong> / <strong>techlar123</strong>
      </div>
    </div>
  );
}
