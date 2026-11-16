// Datas são strings "YYYY-MM-DD" e horas são "HH:mm", sempre no fuso de São Paulo.
// Nunca guardamos objetos Date: assim o fuso do computador do usuário não causa bug de dia.

export const FUSO = 'America/Sao_Paulo';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dataValida(data) {
  if (typeof data !== 'string') return false;
  const m = RE_DATA.exec(data);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

export function horaParaMin(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function minParaHora(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function partes(data) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return { ano, mes, dia };
}

/** 0 = domingo ... 6 = sábado */
export function diaDaSemana(data) {
  const { ano, mes, dia } = partes(data);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function somarDias(data, dias) {
  const { ano, mes, dia } = partes(data);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Data e hora de agora em São Paulo: { data, hora }. */
export function agoraSaoPaulo(agora = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(agora)
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

export const nomeDiaSemana = (data) => DIAS[diaDaSemana(data)];

/** "4 de novembro de 2026" */
export function dataPorExtenso(data) {
  const { ano, mes, dia } = partes(data);
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

/** "04/11" */
export function dataCurta(data) {
  const { mes, dia } = partes(data);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}
