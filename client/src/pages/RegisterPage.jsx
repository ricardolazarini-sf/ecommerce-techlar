import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCPF, isValidCPF } from '../lib/cpf.js';
import { formatPhone, isValidPhone } from '../lib/phone.js';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/perfil';

  const [form, setForm] = useState({
    nome: '',
    documento: '',
    email: '',
    telefone: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateCpf = (e) => setForm((f) => ({ ...f, documento: formatCPF(e.target.value) }));
  const updatePhone = (e) => setForm((f) => ({ ...f, telefone: formatPhone(e.target.value) }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nome.trim()) {
      setError('Informe o nome completo.');
      return;
    }
    if (!isValidCPF(form.documento)) {
      setError('Informe um CPF válido (necessário para identificar seu cadastro).');
      return;
    }
    if (form.telefone.trim() && !isValidPhone(form.telefone)) {
      setError('Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.');
      return;
    }
    setSubmitting(true);
    try {
      await register(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Falha ao criar conta');
      setSubmitting(false);
    }
  };

  return (
    <div className="panel auth-card">
      <h2>Criar conta</h2>
      <p className="muted">Cadastre-se para acompanhar seus pedidos.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <form className="form-grid" onSubmit={submit}>
        <div className="field">
          <label htmlFor="nome">Nome completo*</label>
          <input id="nome" required value={form.nome} onChange={update('nome')} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="documento">CPF*</label>
          <input
            id="documento"
            required
            inputMode="numeric"
            maxLength={14}
            placeholder="000.000.000-00"
            value={form.documento}
            onChange={updateCpf}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="email">Email*</label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="telefone">Telefone (opcional)</label>
          <input
            id="telefone"
            inputMode="numeric"
            maxLength={15}
            value={form.telefone}
            onChange={updatePhone}
            placeholder="(11) 91234-5678"
            autoComplete="tel"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha* (mín. 6 caracteres)</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
          />
        </div>
        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Criando...' : 'Criar conta'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Já tem conta? <Link to="/login" state={{ from }}>Entrar</Link>
      </p>
    </div>
  );
}
