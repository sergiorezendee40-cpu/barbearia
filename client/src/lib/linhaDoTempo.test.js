import { describe, it, expect } from 'vitest';
import {
  motivoFechado,
  proximoDiaAberto,
  montarLinhaDoTempo,
  resumirDia,
  proximosAtendimentos,
} from './linhaDoTempo.js';

const config = {
  horaAbertura: '08:00',
  horaFechamento: '20:00',
  diasFuncionamento: [1, 2, 3, 4, 5, 6],
  tamanhoSlotMin: 30,
  almocoInicio: '12:00',
  almocoFim: '13:00',
  antecedenciaAgendarMin: 60,
  feriadosNacionais: ['2026-11-15', '2026-11-20'],
  feriadosExtras: ['2026-11-25'],
};

// Quarta-feira, 4/11/2026, 09:00
const agora = { data: '2026-11-04', hora: '09:00' };

const ag = (extra) => ({
  id: 'x',
  data: '2026-11-04',
  horaInicio: '10:00',
  horaFim: '10:30',
  slotsOcupados: 1,
  status: 'confirmado',
  servico: { preco: 4000 },
  ...extra,
});

const estadoDe = (linha, hora) => linha.slots.find((s) => s.hora === hora).estado;

describe('motivoFechado', () => {
  it('domingo é folga', () => {
    expect(motivoFechado('2026-11-08', config)).toMatch(/domingo/i);
  });
  it('feriado nacional e data extra fecham', () => {
    expect(motivoFechado('2026-11-20', config)).toMatch(/feriado/i);
    expect(motivoFechado('2026-11-25', config)).toMatch(/feriado/i);
  });
  it('dia comum abre', () => {
    expect(motivoFechado('2026-11-04', config)).toBeNull();
  });
});

describe('proximoDiaAberto', () => {
  it('pula o domingo para frente e para trás', () => {
    expect(proximoDiaAberto('2026-11-07', config, 1)).toBe('2026-11-09'); // sábado -> segunda
    expect(proximoDiaAberto('2026-11-09', config, -1)).toBe('2026-11-07'); // segunda -> sábado
  });
  it('pula feriado', () => {
    expect(proximoDiaAberto('2026-11-19', config, 1)).toBe('2026-11-21'); // 20/11 é feriado
  });
});

describe('montarLinhaDoTempo', () => {
  it('gera uma linha por 30 min entre abertura e fechamento (24 linhas)', () => {
    const l = montarLinhaDoTempo({ data: '2026-11-05', config, agendamentos: [], agora });
    expect(l.totalLinhas).toBe(24);
    expect(l.slots[0].hora).toBe('08:00');
    expect(l.slots.at(-1).hora).toBe('19:30');
  });

  it('dia futuro vazio: tudo livre, exceto o almoço', () => {
    const l = montarLinhaDoTempo({ data: '2026-11-05', config, agendamentos: [], agora });
    expect(estadoDe(l, '08:00')).toBe('livre');
    expect(estadoDe(l, '11:30')).toBe('livre');
    expect(estadoDe(l, '12:00')).toBe('almoco');
    expect(estadoDe(l, '12:30')).toBe('almoco');
    expect(estadoDe(l, '13:00')).toBe('livre');
    expect(l.almoco).toMatchObject({ linhaInicial: 8, linhas: 2, inicio: '12:00', fim: '13:00' });
  });

  it('hoje: horários que já passaram ou com menos de 60 min de antecedência ficam indisponíveis', () => {
    const l = montarLinhaDoTempo({ data: '2026-11-04', config, agendamentos: [], agora }); // são 09:00
    expect(estadoDe(l, '08:30')).toBe('indisponivel');
    expect(estadoDe(l, '09:30')).toBe('indisponivel'); // só 30 min de antecedência
    expect(estadoDe(l, '10:00')).toBe('livre'); // exatamente 60 min: o servidor aceita
  });

  it('dia passado inteiro é indisponível', () => {
    const l = montarLinhaDoTempo({ data: '2026-11-03', config, agendamentos: [], agora });
    expect(l.slots.filter((s) => s.estado === 'livre')).toHaveLength(0);
  });

  it('combo (2 linhas) ocupa dois slots e o bloco começa na linha certa', () => {
    const combo = ag({ horaInicio: '10:00', horaFim: '10:50', slotsOcupados: 2 });
    const l = montarLinhaDoTempo({ data: '2026-11-04', config, agendamentos: [combo], agora });
    expect(estadoDe(l, '10:00')).toBe('ocupado');
    expect(estadoDe(l, '10:30')).toBe('ocupado');
    expect(estadoDe(l, '11:00')).toBe('livre');
    expect(l.blocos).toEqual([{ agendamento: combo, linhaInicial: 4, linhas: 2 }]);
  });

  it('cancelado e reagendado liberam o horário e não viram bloco', () => {
    const lista = [ag({ id: 'a', status: 'cancelado' }), ag({ id: 'b', horaInicio: '11:00', status: 'reagendado' })];
    const l = montarLinhaDoTempo({ data: '2026-11-04', config, agendamentos: lista, agora });
    expect(l.blocos).toHaveLength(0);
    expect(estadoDe(l, '10:00')).toBe('livre');
    expect(estadoDe(l, '11:00')).toBe('livre');
  });

  it('concluído continua ocupando o horário', () => {
    const l = montarLinhaDoTempo({ data: '2026-11-04', config, agendamentos: [ag({ status: 'concluido' })], agora });
    expect(l.blocos).toHaveLength(1);
    expect(estadoDe(l, '10:00')).toBe('ocupado');
  });

  it('linha de agora: só hoje e dentro do expediente, com posição fracionada', () => {
    const hoje = montarLinhaDoTempo({ data: '2026-11-04', config, agendamentos: [], agora: { data: '2026-11-04', hora: '09:15' } });
    expect(hoje.linhaAgora).toBe(2.5);
    const outroDia = montarLinhaDoTempo({ data: '2026-11-05', config, agendamentos: [], agora });
    expect(outroDia.linhaAgora).toBeNull();
    const noite = montarLinhaDoTempo({ data: '2026-11-04', config, agendamentos: [], agora: { data: '2026-11-04', hora: '21:00' } });
    expect(noite.linhaAgora).toBeNull();
  });

  it('sem almoço configurado, não há faixa', () => {
    const l = montarLinhaDoTempo({
      data: '2026-11-05',
      config: { ...config, almocoInicio: null, almocoFim: null },
      agendamentos: [],
      agora,
    });
    expect(l.almoco).toBeNull();
    expect(estadoDe(l, '12:00')).toBe('livre');
  });
});

describe('resumirDia', () => {
  it('conta por status e soma só o que está confirmado ou concluído', () => {
    const lista = [
      ag({ id: '1', status: 'confirmado', servico: { preco: 4000 } }),
      ag({ id: '2', status: 'concluido', servico: { preco: 6000 } }),
      ag({ id: '3', status: 'cancelado', servico: { preco: 2000 } }),
      ag({ id: '4', status: 'reagendado', servico: { preco: 2000 } }),
    ];
    expect(resumirDia(lista)).toEqual({
      atendimentos: 2,
      concluidos: 1,
      cancelados: 1,
      reagendados: 1,
      previstoCentavos: 10000,
    });
  });
  it('dia vazio', () => {
    expect(resumirDia([])).toMatchObject({ atendimentos: 0, previstoCentavos: 0 });
  });
});

describe('proximosAtendimentos', () => {
  it('só confirmados de hoje a partir de agora, em ordem', () => {
    const lista = [
      ag({ id: 'c', horaInicio: '15:00' }),
      ag({ id: 'a', horaInicio: '08:00' }), // já passou
      ag({ id: 'b', horaInicio: '10:00' }),
      ag({ id: 'd', horaInicio: '11:00', status: 'cancelado' }),
      ag({ id: 'e', horaInicio: '16:00', data: '2026-11-05' }), // outro dia
    ];
    expect(proximosAtendimentos(lista, agora).map((a) => a.id)).toEqual(['b', 'c']);
  });
});
