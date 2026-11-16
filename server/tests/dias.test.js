import { describe, it, expect } from 'vitest';
import { motivoDiaFechado, proximoDiaAberto } from '../src/regras/agenda.js';
import { configPadrao } from '../src/config/padrao.js';

const config = { ...configPadrao };

describe('dias: motivoDiaFechado', () => {
  it('domingo, feriado e dia normal', () => {
    expect(motivoDiaFechado('2026-11-08', config).codigo).toBe('DOMINGO');
    expect(motivoDiaFechado('2026-12-25', config).codigo).toBe('FERIADO');
    expect(motivoDiaFechado('2026-11-10', config)).toBeNull();
  });

  it('dia da semana fora da lista de funcionamento', () => {
    const semSabado = { ...config, diasFuncionamento: [1, 2, 3, 4, 5] };
    expect(motivoDiaFechado('2026-11-14', semSabado).codigo).toBe('DIA_FECHADO');
  });
});

describe('dias: proximoDiaAberto', () => {
  it('sexta para sábado', () => {
    expect(proximoDiaAberto('2026-11-06', config)).toBe('2026-11-07');
  });

  it('pula o domingo', () => {
    expect(proximoDiaAberto('2026-11-07', config)).toBe('2026-11-09');
  });

  it('pula feriado (20/11 é sexta)', () => {
    expect(proximoDiaAberto('2026-11-19', config)).toBe('2026-11-21');
    expect(proximoDiaAberto('2026-12-24', config)).toBe('2026-12-26');
  });

  it('procura para trás com passo -1', () => {
    expect(proximoDiaAberto('2026-11-09', config, -1)).toBe('2026-11-07');
  });
});
