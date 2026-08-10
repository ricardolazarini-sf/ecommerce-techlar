import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCPF, isValidCPF } from '../lib/cpf.js';
import { formatCNPJ, isValidCNPJ, formatCEP } from '../lib/cnpj.js';
import { formatPhone, isValidPhone } from '../lib/phone.js';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/perfil';

  const [tipo, setTipo] = useState('PF');
  const [form, setForm] = useState({
    nome: '',
    documento: '',
    razaoSocial: '',
    cnpj: '',
    email: '',
    telefone: '',
    password: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Brasil',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateCpf = (e) => setForm((f) => ({ ...f, documento: formatCPF(e.target.value) }));
  const updateCnpj = (e) => setForm((f) => ({ ...f, cnpj: formatCNPJ(e.target.value) }));
  const updatePhone = (e) => setForm((f) => ({ ...f, telefone: formatPhone(e.target.value) }));
  const updateCep = (e) => setForm((f) => ({ ...f, postalCode: formatCEP(e.target.value) }));
  const updateUf = (e) =>
    setForm((f) => ({ ...f, state: e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2) }));

  const validate = () => {
    if (tipo === 'PJ') {
      if (!form.razaoSocial.trim()) return 'Informe a razão social.';
      if (!isValidCNPJ(form.cnpj)) return 'Informe um CNPJ válido.';
    } else {
      if (!form.nome.trim()) return 'Informe o nome completo.';
      if (!isValidCPF(form.documento)) return 'Informe um CPF válido.';
    }
    if (form.telefone.trim() && !isValidPhone(form.telefone)) {
      return 'Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.';
    }
    if (!form.addressLine1.trim()) return 'Informe o endereço (rua e número).';
    if (!form.city.trim()) return 'Informe a cidade.';
    if (form.password.length < 6) return 'A senha deve ter no mínimo 6 caracteres.';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    setSubmitting(true);
    const payload = {
      tipo,
      email: form.email,
      telefone: form.telefone,
      password: form.password,
      addressLine1: form.addressLine1,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      country: form.country || 'Brasil',
      ...(tipo === 'PJ'
        ? { razaoSocial: form.razaoSocial, cnpj: form.cnpj }
        : { nome: form.nome, documento: form.documento }),
    };
    try {
      await register(payload);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Falha ao criar conta');
      setSubmitting(false);
    }
  };

  return (
    <div className="panel auth-card auth-wide">
      <h2>Criar conta</h2>
      <p className="muted">Cadastre-se para acompanhar seus pedidos.</p>

      <div className="segmented" role="tablist" aria-label="Tipo de cadastro">
        <button
          type="button"
          role="tab"
          aria-selected={tipo === 'PF'}
          className={tipo === 'PF' ? 'active' : ''}
          onClick={() => setTipo('PF')}
        >
          Pessoa Física
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tipo === 'PJ'}
          className={tipo === 'PJ' ? 'active' : ''}
          onClick={() => setTipo('PJ')}
        >
          Pessoa Jurídica
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="form-grid form-grid-2" onSubmit={submit} noValidate>
        {tipo === 'PJ' ? (
          <>
            <div className="field">
              <label htmlFor="razaoSocial">Razão social*</label>
              <input
                id="razaoSocial"
                value={form.razaoSocial}
                onChange={update('razaoSocial')}
                autoComplete="organization"
              />
            </div>
            <div className="field">
              <label htmlFor="cnpj">CNPJ*</label>
              <input
                id="cnpj"
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={updateCnpj}
                autoComplete="off"
              />
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="nome">Nome completo*</label>
              <input id="nome" value={form.nome} onChange={update('nome')} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="documento">CPF*</label>
              <input
                id="documento"
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                value={form.documento}
                onChange={updateCpf}
                autoComplete="off"
              />
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="email">Email*</label>
          <input
            id="email"
            type="email"
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

        <div className="field field-full">
          <label htmlFor="addressLine1">Endereço* (rua e número)</label>
          <input
            id="addressLine1"
            value={form.addressLine1}
            onChange={update('addressLine1')}
            placeholder="Rua das Flores, 100"
            autoComplete="address-line1"
          />
        </div>
        <div className="field">
          <label htmlFor="postalCode">CEP</label>
          <input
            id="postalCode"
            inputMode="numeric"
            maxLength={9}
            placeholder="00000-000"
            value={form.postalCode}
            onChange={updateCep}
            autoComplete="postal-code"
          />
        </div>
        <div className="field">
          <label htmlFor="city">Cidade*</label>
          <input id="city" value={form.city} onChange={update('city')} autoComplete="address-level2" />
        </div>
        <div className="field">
          <label htmlFor="state">Estado (UF)</label>
          <input
            id="state"
            maxLength={2}
            placeholder="SP"
            value={form.state}
            onChange={updateUf}
            autoComplete="address-level1"
          />
        </div>
        <div className="field">
          <label htmlFor="country">País</label>
          <input id="country" value={form.country} onChange={update('country')} />
        </div>

        <div className="field field-full">
          <label htmlFor="password">Senha* (mín. 6 caracteres)</label>
          <input
            id="password"
            type="password"
            minLength={6}
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
          />
        </div>

        <button className="btn btn-primary btn-block field-full" disabled={submitting}>
          {submitting ? 'Criando...' : 'Criar conta'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: '1rem' }}>
        Já tem conta?{' '}
        <Link to="/login" state={{ from }}>
          Entrar
        </Link>
      </p>
    </div>
  );
}
