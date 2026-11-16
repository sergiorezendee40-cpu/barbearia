import { somarDias } from './tempo.js';

const pad = (n) => String(n).padStart(2, '0');

/** Data da Páscoa (algoritmo de Meeus/Jones/Butcher), no formato "YYYY-MM-DD". */
export function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/**
 * Feriados nacionais do ano, em ordem. Não inclui Carnaval nem Corpus Christi
 * (são pontos facultativos). O 20/11 (Consciência Negra) é nacional desde 2024.
 */
export function feriadosNacionais(ano) {
  const fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'];
  const lista = fixos.map((md) => `${ano}-${md}`);
  lista.push(somarDias(pascoa(ano), -2)); // Sexta-feira Santa
  if (ano >= 2024) lista.push(`${ano}-11-20`);
  return lista.sort();
}

/** Feriado nacional ou data extra cadastrada nas configurações (feriadosExtras). */
export function ehFeriado(data, config) {
  const ano = Number(data.slice(0, 4));
  if (feriadosNacionais(ano).includes(data)) return true;
  return (config.feriadosExtras ?? []).includes(data);
}
