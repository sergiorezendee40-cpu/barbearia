const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 4000 -> "R$ 40,00" (a API trabalha em centavos). */
export const moeda = (centavos) => brl.format(centavos / 100).replace(/ /g, ' ');

/** "31999990001" -> "(31) 99999-0001" */
export function telefone(digitos) {
  if (!digitos) return '';
  const d = String(digitos).replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

/** 1 -> "1 atendimento", 3 -> "3 atendimentos" */
export const plural = (n, singular, pluralTxt = `${singular}s`) => `${n} ${n === 1 ? singular : pluralTxt}`;
