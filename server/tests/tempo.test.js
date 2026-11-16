import { describe, it, expect } from 'vitest';
import {
  horaParaMin,
  minParaHora,
  diaDaSemana,
  diffMinutos,
  somarDias,
  dataValida,
  horaValida,
} from '../src/regras/tempo.js';

describe('tempo: conversão de hora', () => {
  it('converte HH:mm em minutos e de volta', () => {
    expect(horaParaMin('08:30')).toBe(510);
    expect(horaParaMin('00:00')).toBe(0);
    expect(horaParaMin('20:00')).toBe(1200);
    expect(minParaHora(510)).toBe('08:30');
    expect(minParaHora(0)).toBe('00:00');
    expect(minParaHora(1190)).toBe('19:50');
  });
});

describe('tempo: datas', () => {
  it('calcula o dia da semana sem depender do fuso', () => {
    expect(diaDaSemana('2026-11-03')).toBe(2); // terça
    expect(diaDaSemana('2026-11-08')).toBe(0); // domingo
    expect(diaDaSemana('2026-11-14')).toBe(6); // sábado
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('calcula diferença em minutos entre dois instantes', () => {
    expect(diffMinutos('2026-11-10', '08:00', '2026-11-10', '09:00')).toBe(60);
    expect(diffMinutos('2026-11-10', '23:30', '2026-11-11', '00:30')).toBe(60);
    expect(diffMinutos('2026-11-10', '10:00', '2026-11-10', '09:00')).toBe(-60);
  });

  it('valida formatos de data e hora', () => {
    expect(dataValida('2026-02-28')).toBe(true);
    expect(dataValida('2026-02-30')).toBe(false);
    expect(dataValida('2026-13-01')).toBe(false);
    expect(dataValida('10/11/2026')).toBe(false);
    expect(horaValida('23:59')).toBe(true);
    expect(horaValida('24:00')).toBe(false);
    expect(horaValida('9:00')).toBe(false);
    expect(horaValida('09:60')).toBe(false);
  });
});
