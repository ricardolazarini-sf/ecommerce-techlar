import { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';
import { DrawnFrame, DrawnRule } from '../components/Drawn.jsx';
import { formatCPF, isValidCPF } from '../lib/cpf.js';
import { formatCNPJ, isValidCNPJ, formatCEP } from '../lib/cnpj.js';
import { formatPhone, isValidPhone } from '../lib/phone.js';
import { describedBy, looksLikeEmail, UFS } from '../lib/form.js';

// Mensagem de 4xx vem do servidor em português; 5xx e falha de rede não têm
// texto útil para quem está na tela, então recebem texto próprio.
function errorText(err) {
  if (err?.status >= 400 && err.status < 500) return err.message;
  return 'Não foi possível criar a conta: o serviço de contas não respondeu. Tente de novo em alguns instantes.';
}

// Ordem em que os campos aparecem na tela. O foco vai para o primeiro que
// precisa de correção, e "primeiro" é o mais acima na tela, não o primeiro que a
// validação encontrou.
const FIELD_ORDER = [
  'razaoSocial',
  'cnpj',
  'nome',
  'documento',
  'telefone',
  'postalCode',
  'addressLine1',
  'city',
  'email',
  'password',
];

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
  });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cada erro fica colado no campo que precisa de correção, e o foco vai até o
  // primeiro deles.
  const inputs = useRef({});
  const bind = (name) => (el) => {
    inputs.current[name] = el;
  };

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateCpf = (e) => setForm((f) => ({ ...f, documento: formatCPF(e.target.value) }));
  const updateCnpj = (e) => setForm((f) => ({ ...f, cnpj: formatCNPJ(e.target.value) }));
  const updatePhone = (e) => setForm((f) => ({ ...f, telefone: formatPhone(e.target.value) }));
  const updateCep = (e) => setForm((f) => ({ ...f, postalCode: formatCEP(e.target.value) }));

  // Trocar de tipo esconde campos: um erro pendente pode ser de campo que saiu
  // da tela, então sai junto.
  const changeTipo = (next) => {
    setTipo(next);
    setErrors({});
    setError('');
  };

  const errorFor = (field) => errors[field] || '';

  // Valida o formulário inteiro de uma vez: quem preencheu errado dois campos
  // merece saber dos dois agora, e não um a cada envio.
  const validate = () => {
    const found = {};
    if (tipo === 'PJ') {
      if (!form.razaoSocial.trim()) found.razaoSocial = 'Informe a razão social para continuar.';
      if (!isValidCNPJ(form.cnpj)) found.cnpj = 'CNPJ inválido. Confira os 14 dígitos e digite de novo.';
    } else {
      if (!form.nome.trim()) found.nome = 'Informe o nome completo para continuar.';
      if (!isValidCPF(form.documento)) {
        found.documento = 'CPF inválido. Confira os 11 dígitos e digite de novo.';
      }
    }
    if (form.telefone.trim() && !isValidPhone(form.telefone)) {
      found.telefone = 'Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.';
    }
    if (!form.addressLine1.trim()) found.addressLine1 = 'Informe a rua e o número.';
    if (!form.city.trim()) found.city = 'Informe a cidade.';
    if (!form.email.trim()) found.email = 'Informe o e-mail para criar a conta.';
    else if (!looksLikeEmail(form.email)) {
      found.email = 'E-mail inválido. Confira o endereço e digite de novo.';
    }
    if (form.password.length < 6) found.password = 'A senha precisa de no mínimo 6 caracteres.';
    return found;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const found = validate();
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first) {
      inputs.current[first]?.focus();
      return;
    }

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
      country: 'Brasil',
      ...(tipo === 'PJ'
        ? { razaoSocial: form.razaoSocial, cnpj: form.cnpj }
        : { nome: form.nome, documento: form.documento }),
    };
    try {
      await register(payload);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorText(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="panel auth-card acc-auth-wide">
      <DrawnFrame />

      <div className="acc-auth-head">
        <span className="acc-auth-mark">
          <Icon name="user" />
        </span>
        <div>
          <h1 className="acc-auth-title">Criar conta</h1>
          <p className="acc-auth-lead">
            Com a conta, você acompanha os pedidos e mantém as garantias estendidas no seu nome.
          </p>
        </div>
      </div>
      <DrawnRule className="acc-auth-rule acc-auth-rule-head" />

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form className="acc-auth-form" onSubmit={submit} noValidate>
        <fieldset className="acc-group">
          <legend>
            <span className="eyebrow">Quem recebe a nota</span>
          </legend>

          <fieldset className="acc-typeswitch">
            <legend className="sr-only">Tipo de cadastro</legend>
            <label className="acc-typeswitch-option">
              <input
                type="radio"
                name="tipo"
                value="PF"
                checked={tipo === 'PF'}
                onChange={() => changeTipo('PF')}
              />
              <span>Pessoa física</span>
            </label>
            <label className="acc-typeswitch-option">
              <input
                type="radio"
                name="tipo"
                value="PJ"
                checked={tipo === 'PJ'}
                onChange={() => changeTipo('PJ')}
              />
              <span>Pessoa jurídica</span>
            </label>
          </fieldset>

          <div className="form-grid acc-grid-2">
            {tipo === 'PJ' ? (
              <>
                <div className="field acc-field-full">
                  <label htmlFor="razaoSocial">Razão social</label>
                  <input
                    id="razaoSocial"
                    ref={bind('razaoSocial')}
                    required
                    value={form.razaoSocial}
                    onChange={update('razaoSocial')}
                    autoComplete="organization"
                    aria-invalid={errorFor('razaoSocial') ? 'true' : undefined}
                    aria-describedby={describedBy(
                      'razaoSocial-hint',
                      errorFor('razaoSocial') && 'razaoSocial-erro',
                    )}
                  />
                  <span className="field-hint" id="razaoSocial-hint">
                    Como está no cartão CNPJ.
                  </span>
                  {errorFor('razaoSocial') && (
                    <span className="acc-field-error" id="razaoSocial-erro" role="alert">
                      {errorFor('razaoSocial')}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="cnpj">CNPJ</label>
                  <input
                    id="cnpj"
                    ref={bind('cnpj')}
                    required
                    inputMode="numeric"
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    value={form.cnpj}
                    onChange={updateCnpj}
                    autoComplete="off"
                    aria-invalid={errorFor('cnpj') ? 'true' : undefined}
                    aria-describedby={describedBy('cnpj-hint', errorFor('cnpj') && 'cnpj-erro')}
                  />
                  <span className="field-hint" id="cnpj-hint">
                    Registra a garantia estendida no nome da empresa.
                  </span>
                  {errorFor('cnpj') && (
                    <span className="acc-field-error" id="cnpj-erro" role="alert">
                      {errorFor('cnpj')}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="field acc-field-full">
                  <label htmlFor="nome">Nome completo</label>
                  <input
                    id="nome"
                    ref={bind('nome')}
                    required
                    value={form.nome}
                    onChange={update('nome')}
                    autoComplete="name"
                    aria-invalid={errorFor('nome') ? 'true' : undefined}
                    aria-describedby={describedBy('nome-hint', errorFor('nome') && 'nome-erro')}
                  />
                  <span className="field-hint" id="nome-hint">
                    Como está no documento.
                  </span>
                  {errorFor('nome') && (
                    <span className="acc-field-error" id="nome-erro" role="alert">
                      {errorFor('nome')}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="documento">CPF</label>
                  <input
                    id="documento"
                    ref={bind('documento')}
                    required
                    inputMode="numeric"
                    maxLength={14}
                    placeholder="000.000.000-00"
                    value={form.documento}
                    onChange={updateCpf}
                    autoComplete="off"
                    aria-invalid={errorFor('documento') ? 'true' : undefined}
                    aria-describedby={describedBy(
                      'documento-hint',
                      errorFor('documento') && 'documento-erro',
                    )}
                  />
                  <span className="field-hint" id="documento-hint">
                    Registra a garantia estendida no seu nome.
                  </span>
                  {errorFor('documento') && (
                    <span className="acc-field-error" id="documento-erro" role="alert">
                      {errorFor('documento')}
                    </span>
                  )}
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="telefone">Telefone</label>
              <input
                id="telefone"
                ref={bind('telefone')}
                inputMode="tel"
                maxLength={15}
                value={form.telefone}
                onChange={updatePhone}
                placeholder="(11) 91234-5678"
                autoComplete="tel"
                aria-invalid={errorFor('telefone') ? 'true' : undefined}
                aria-describedby={describedBy(
                  'telefone-hint',
                  errorFor('telefone') && 'telefone-erro',
                )}
              />
              <span className="field-hint" id="telefone-hint">
                Opcional. É por aqui que combinamos a entrega e a instalação.
              </span>
              {errorFor('telefone') && (
                <span className="acc-field-error" id="telefone-erro" role="alert">
                  {errorFor('telefone')}
                </span>
              )}
            </div>
          </div>
        </fieldset>

        <DrawnRule className="acc-group-rule" />

        <fieldset className="acc-group">
          <legend>
            <span className="eyebrow">Onde entregamos e instalamos</span>
          </legend>

          <div className="form-grid acc-grid-address">
            <div className="field acc-span-2">
              <label htmlFor="postalCode">CEP</label>
              <input
                id="postalCode"
                ref={bind('postalCode')}
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                value={form.postalCode}
                onChange={updateCep}
                autoComplete="postal-code"
              />
            </div>

            <div className="field acc-span-4">
              <label htmlFor="addressLine1">Rua e número</label>
              <input
                id="addressLine1"
                ref={bind('addressLine1')}
                required
                value={form.addressLine1}
                onChange={update('addressLine1')}
                placeholder="Rua das Flores, 100"
                autoComplete="address-line1"
                aria-invalid={errorFor('addressLine1') ? 'true' : undefined}
                aria-describedby={describedBy(errorFor('addressLine1') && 'addressLine1-erro')}
              />
              {errorFor('addressLine1') && (
                <span className="acc-field-error" id="addressLine1-erro" role="alert">
                  {errorFor('addressLine1')}
                </span>
              )}
            </div>

            <div className="field acc-span-4">
              <label htmlFor="city">Cidade</label>
              <input
                id="city"
                ref={bind('city')}
                required
                value={form.city}
                onChange={update('city')}
                autoComplete="address-level2"
                aria-invalid={errorFor('city') ? 'true' : undefined}
                aria-describedby={describedBy(errorFor('city') && 'city-erro')}
              />
              {errorFor('city') && (
                <span className="acc-field-error" id="city-erro" role="alert">
                  {errorFor('city')}
                </span>
              )}
            </div>

            <div className="field acc-span-2">
              <label htmlFor="state">Estado</label>
              <select
                id="state"
                value={form.state}
                onChange={update('state')}
                autoComplete="address-level1"
                data-empty={form.state ? undefined : 'true'}
              >
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <DrawnRule className="acc-group-rule" />

        <fieldset className="acc-group">
          <legend>
            <span className="eyebrow">Como você entra na conta</span>
          </legend>

          <div className="form-grid acc-grid-2">
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                ref={bind('email')}
                type="email"
                required
                inputMode="email"
                value={form.email}
                onChange={update('email')}
                autoComplete="email"
                aria-invalid={errorFor('email') ? 'true' : undefined}
                aria-describedby={describedBy(errorFor('email') && 'email-erro')}
              />
              {errorFor('email') && (
                <span className="acc-field-error" id="email-erro" role="alert">
                  {errorFor('email')}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="password">Senha</label>
              <div className="acc-pass">
                <input
                  id="password"
                  ref={bind('password')}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={update('password')}
                  autoComplete="new-password"
                  aria-invalid={errorFor('password') ? 'true' : undefined}
                  aria-describedby={describedBy(
                    'password-hint',
                    errorFor('password') && 'password-erro',
                  )}
                />
                <button
                  type="button"
                  className="acc-pass-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
                </button>
              </div>
              <span className="field-hint" id="password-hint">
                No mínimo 6 caracteres.
              </span>
              {errorFor('password') && (
                <span className="acc-field-error" id="password-erro" role="alert">
                  {errorFor('password')}
                </span>
              )}
            </div>
          </div>
        </fieldset>

        <button className="btn btn-primary btn-block btn-lg acc-submit" disabled={submitting}>
          {submitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <DrawnRule className="acc-auth-rule acc-auth-rule-foot" />
      <div className="acc-auth-foot">
        <span className="acc-auth-foot-label">Já tem conta?</span>
        <Link to="/login" state={{ from }} className="acc-auth-link">
          Entrar
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </div>
  );
}
