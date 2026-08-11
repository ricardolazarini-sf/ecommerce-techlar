// Os campos do cadastro de cliente, compartilhados pela página "Criar conta" e
// pela etapa 02 da finalização da compra. As duas telas pedem exatamente os
// mesmos dados, então pedem com o mesmo componente: rótulo, dica, ordem do foco
// e mensagem de erro não têm como divergir entre uma e outra.

import { useCallback, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { track } from '../lib/track.js';
import { DrawnRule } from './Drawn.jsx';
import { formatCPF } from '../lib/cpf.js';
import { formatCNPJ, formatCEP } from '../lib/cnpj.js';
import { formatPhone } from '../lib/phone.js';
import { describedBy, UFS } from '../lib/form.js';
import {
  EMPTY_CUSTOMER,
  FIELD_ORDER,
  validateCustomer,
  customerPayload,
} from '../lib/customerForm.js';

// Estado, máscaras, erros e foco do formulário. A tela que usa decide o que
// fazer com `payload()`: criar a conta na hora ou criar junto com o pedido.
export function useCustomerForm({ validate = validateCustomer } = {}) {
  const [tipo, setTipo] = useState('PF');
  const [form, setForm] = useState(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState({});

  // Cada erro fica colado no campo que precisa de correção, e o foco vai até o
  // primeiro deles.
  const inputs = useRef({});
  const bind = (name) => (el) => {
    inputs.current[name] = el;
  };

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateMasked = (key, mask) => (e) => setForm((f) => ({ ...f, [key]: mask(e.target.value) }));

  // Trocar de tipo esconde campos: um erro pendente pode ser de campo que saiu
  // da tela, então sai junto.
  const changeTipo = (next) => {
    setTipo(next);
    setErrors({});
    // Qualifica B2B antes de o cadastro terminar: quem clicou em PJ e desistiu no
    // meio some do banco de clientes, mas não deste evento.
    if (next !== tipo) track('customer_type_selected', { action: next, reason: 'cadastro' });
  };

  const fill = useCallback((values) => {
    setForm((f) => ({ ...f, ...values }));
  }, []);

  // Devolve true quando está tudo em ordem. Quando não está, marca os campos e
  // leva o foco ao primeiro erro de cima para baixo.
  const check = () => {
    const found = validate(form, tipo);
    setErrors(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (!first) return true;
    inputs.current[first]?.focus();
    return false;
  };

  return {
    tipo,
    form,
    errors,
    fill,
    setErrors,
    changeTipo,
    bind,
    update,
    updateCpf: updateMasked('documento', formatCPF),
    updateCnpj: updateMasked('cnpj', formatCNPJ),
    updatePhone: updateMasked('telefone', formatPhone),
    updateCep: updateMasked('postalCode', formatCEP),
    errorFor: (field) => errors[field] || '',
    check,
    payload: () => customerPayload(form, tipo),
  };
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <span className="acc-field-error" id={id} role="alert">
      {message}
    </span>
  );
}

// Onde a entrega e a instalação acontecem. Sai à parte porque quem já tem conta
// vê só este grupo, para conferir e corrigir o destino antes de pagar.
export function AddressFields({ state }) {
  const { form, bind, update, updateCep, errorFor } = state;
  return (
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
        <FieldError id="addressLine1-erro" message={errorFor('addressLine1')} />
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
        <FieldError id="city-erro" message={errorFor('city')} />
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
  );
}

// Os três grupos do cadastro. Cada um diz para que serve o dado que pede — quem
// recebe a nota, onde o técnico vai, como se entra depois.
export default function CustomerFields({ state }) {
  const { tipo, form, changeTipo, bind, update, updateCpf, updateCnpj, updatePhone, errorFor } =
    state;
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
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
                <FieldError id="razaoSocial-erro" message={errorFor('razaoSocial')} />
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
                <FieldError id="cnpj-erro" message={errorFor('cnpj')} />
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
                <FieldError id="nome-erro" message={errorFor('nome')} />
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
                <FieldError id="documento-erro" message={errorFor('documento')} />
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
              aria-describedby={describedBy('telefone-hint', errorFor('telefone') && 'telefone-erro')}
            />
            <span className="field-hint" id="telefone-hint">
              Opcional. É por aqui que combinamos a entrega e a instalação.
            </span>
            <FieldError id="telefone-erro" message={errorFor('telefone')} />
          </div>
        </div>
      </fieldset>

      <DrawnRule className="acc-group-rule" />

      <fieldset className="acc-group">
        <legend>
          <span className="eyebrow">Onde entregamos e instalamos</span>
        </legend>
        <AddressFields state={state} />
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
            <FieldError id="email-erro" message={errorFor('email')} />
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
            <FieldError id="password-erro" message={errorFor('password')} />
          </div>
        </div>
      </fieldset>
    </>
  );
}
