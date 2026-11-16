// Funções de data e hora sem depender do fuso do servidor.
// Datas são strings "YYYY-MM-DD" e horas são strings "HH:mm" (fuso America/Sao_Paulo).
// Internamente usamos Date.UTC só como calculadora de calendário.

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const FUSO = 'America/Sao_Paulo';

export function dataValida(data) {
  if (typeof data !== 'string') return false;
  const m = RE_DATA.exec(data);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export function horaValida(hora) {
  return typeof hora === 'string' && RE_HORA.test(hora);
}

export function horaParaMin(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minParaHora(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function partesData(data) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return { ano, mes, dia };
}

/** 0 = domingo ... 6 = sábado */
export function diaDaSemana(data) {
  const { ano, mes, dia } = partesData(data);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function somarDias(data, dias) {
  const { ano, mes, dia } = partesData(data);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

function instante(data, hora) {
  const { ano, mes, dia } = partesData(data);
  const [h, m] = hora.split(':').map(Number);
  return Date.UTC(ano, mes - 1, dia, h, m);
}

/** Minutos de (dataA, horaA) até (dataB, horaB). Negativo se B for antes de A. */
export function diffMinutos(dataA, horaA, dataB, horaB) {
  return (instante(dataB, horaB) - instante(dataA, horaA)) / 60000;
}

/** Data e hora atuais em São Paulo: { data: "YYYY-MM-DD", hora: "HH:mm" } */
export function agoraSaoPaulo(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}
