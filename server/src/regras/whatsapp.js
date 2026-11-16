// Telefone brasileiro e links de WhatsApp (wa.me). Nenhuma mensagem é enviada
// automaticamente: o barbeiro clica no link e envia pelo próprio WhatsApp.

import { diaDaSemana } from './tempo.js';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/**
 * Devolve só os dígitos com DDD (10 ou 11 dígitos), ou null se for inválido.
 * Aceita máscara e DDI +55. Celular: 9 dígitos começando com 9. Fixo: 8 dígitos começando com 2 a 5.
 */
export function normalizarTelefone(entrada) {
  if (typeof entrada !== 'string') return null;
  if (/[^\d\s()+\-.]/.test(entrada)) return null;
  let d = entrada.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (!/^[1-9]\d$/.test(d.slice(0, 2))) return null;
  const numero = d.slice(2);
  if (numero.length === 9) return numero[0] === '9' ? d : null;
  return /^[2-5]/.test(numero) ? d : null;
}

export function gerarLinkWhatsapp(telefone, texto) {
  const n = normalizarTelefone(telefone);
  if (!n) return null;
  return `https://wa.me/55${n}?text=${encodeURIComponent(texto)}`;
}

function quando(data, hora) {
  const [, mes, dia] = data.split('-');
  return `${DIAS[diaDaSemana(data)]}, ${dia}/${mes}, às ${hora}`;
}

export const TIPOS_MENSAGEM = ['confirmacao', 'lembrete', 'cancelamento', 'reagendamento'];

export function montarMensagem(tipo, { nomeCliente, nomeBarbearia, data, hora, servico }) {
  const q = quando(data, hora);
  switch (tipo) {
    case 'confirmacao':
      return `Olá, ${nomeCliente}! Seu horário está confirmado: ${servico} na ${q}. Te esperamos! — ${nomeBarbearia}`;
    case 'lembrete':
      return `Olá, ${nomeCliente}! Lembrete do seu horário: ${servico} na ${q}. Se não puder comparecer, avise com antecedência. — ${nomeBarbearia}`;
    case 'cancelamento':
      return `Olá, ${nomeCliente}! Seu horário de ${servico} na ${q} foi cancelado. Quando quiser, é só chamar para marcar outro. — ${nomeBarbearia}`;
    case 'reagendamento':
      return `Olá, ${nomeCliente}! Seu horário foi reagendado: ${servico} agora na ${q}. Qualquer dúvida, é só chamar. — ${nomeBarbearia}`;
    default:
      throw new Error(`Tipo de mensagem desconhecido: ${tipo}`);
  }
}
