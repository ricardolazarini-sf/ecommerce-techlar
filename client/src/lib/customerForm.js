// Regras do cadastro de cliente, num só lugar porque agora há dois lugares que
// cadastram: a página "Criar conta" e a etapa 02 da finalização da compra. As
// duas telas pedem os mesmos campos e recusam os mesmos valores — se as regras
// morassem em cada página, a diferença apareceria só no servidor.

import { isValidCPF } from './cpf.js';
import { isValidCNPJ } from './cnpj.js';
import { isValidPhone } from './phone.js';
import { looksLikeEmail } from './form.js';

export const EMPTY_CUSTOMER = {
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
};

// Ordem em que os campos aparecem na tela. O foco vai para o primeiro que
// precisa de correção, e "primeiro" é o mais acima na tela, não o primeiro que a
// validação encontrou.
export const FIELD_ORDER = [
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

// Valida o formulário inteiro de uma vez: quem preencheu errado dois campos
// merece saber dos dois agora, e não um a cada envio.
export function validateCustomer(form, tipo) {
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
}

// O par nome/documento depende do tipo: a conta de empresa manda razão social e
// CNPJ, a de pessoa manda nome e CPF. Mandar os quatro deixaria no cadastro o
// lixo do tipo que a pessoa não escolheu.
export function customerPayload(form, tipo) {
  return {
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
}

// Só o endereço, para quem já tem conta e quer corrigir o destino da entrega
// sem passar pelo cadastro de novo.
export function validateAddress(form) {
  const found = {};
  if (!form.addressLine1.trim()) found.addressLine1 = 'Informe a rua e o número.';
  if (!form.city.trim()) found.city = 'Informe a cidade.';
  return found;
}

export default { EMPTY_CUSTOMER, FIELD_ORDER, validateCustomer, customerPayload, validateAddress };
