import { describe, it, expect } from 'vitest';
import { pascoa, feriadosNacionais, ehFeriado } from '../src/regras/feriados.js';
import { configPadrao } from '../src/config/padrao.js';

describe('feriados: Páscoa', () => {
  it('calcula a data da Páscoa de vários anos', () => {
    expect(pascoa(2024)).toBe('2024-03-31');
    expect(pascoa(2025)).toBe('2025-04-20');
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
  });
});

describe('feriados: nacionais', () => {
  it('lista os 10 feriados nacionais de 2026, em ordem', () => {
    const lista = feriadosNacionais(2026);
    expect(lista).toEqual([
      '2026-01-01',
      '2026-04-03', // Sexta-feira Santa
      '2026-04-21',
      '2026-05-01',
      '2026-09-07',
      '2026-10-12',
      '2026-11-02',
      '2026-11-15',
      '2026-11-20', // Consciência Negra
      '2026-12-25',
    ]);
  });

  it('Sexta-feira Santa muda de data conforme o ano', () => {
    expect(feriadosNacionais(2025)).toContain('2025-04-18');
    expect(feriadosNacionais(2027)).toContain('2027-03-26');
  });

  it('20 de novembro só é feriado nacional a partir de 2024', () => {
    expect(feriadosNacionais(2023)).not.toContain('2023-11-20');
    expect(feriadosNacionais(2023)).toHaveLength(9);
    expect(feriadosNacionais(2024)).toContain('2024-11-20');
  });

  it('Carnaval e Corpus Christi não entram (não são feriados nacionais)', () => {
    const lista = feriadosNacionais(2026);
    expect(lista).not.toContain('2026-02-17');
    expect(lista).not.toContain('2026-06-04');
  });
});

describe('feriados: ehFeriado', () => {
  it('reconhece feriado nacional', () => {
    expect(ehFeriado('2026-12-25', configPadrao)).toBe(true);
    expect(ehFeriado('2026-12-24', configPadrao)).toBe(false);
  });

  it('reconhece datas extras cadastradas nas configurações', () => {
    const config = { ...configPadrao, feriadosExtras: ['2026-02-17'] };
    expect(ehFeriado('2026-02-17', config)).toBe(true);
    expect(ehFeriado('2026-02-17', configPadrao)).toBe(false);
  });
});
