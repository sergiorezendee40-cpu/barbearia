import { describe, it, expect } from 'vitest';
import {
  slotsOcupados,
  validarAgendamento,
  listarHorariosDisponiveis,
  verificarPrazoCancelamento,
} from '../src/regras/agenda.js';
import { configPadrao } from '../src/config/padrao.js';

const config = { ...configPadrao };

const corte = { id: 's-corte', nome: 'Corte', duracaoMin: 30, preco: 4000, ativo: true };
const barba = { id: 's-barba', nome: 'Barba', duracaoMin: 20, preco: 2000, ativo: true };
const combo = { id: 's-combo', nome: 'Corte + barba', duracaoMin: 50, preco: 6000, ativo: true };

// "Agora" fixo: terça, 03/11/2026, 10:00
const agora = { data: '2026-11-03', hora: '10:00' };
const DIA = '2026-11-10'; // terça-feira comum, sem feriado

function validar(sobrescrever = {}) {
  return validarAgendamento({
    data: DIA,
    horaInicio: '09:00',
    servico: corte,
    agendamentos: [],
    config,
    agora,
    ...sobrescrever,
  });
}

function agendamento(horaInicio, servico, extra = {}) {
  const slots = slotsOcupados(servico.duracaoMin, config.tamanhoSlotMin);
  return {
    id: `ag-${horaInicio}`,
    data: DIA,
    horaInicio,
    slotsOcupados: slots,
    status: 'confirmado',
    ...extra,
  };
}

describe('agenda: slots ocupados', () => {
  it('arredonda a duração para cima em múltiplos de 30 min', () => {
    expect(slotsOcupados(30, 30)).toBe(1);
    expect(slotsOcupados(20, 30)).toBe(1);
    expect(slotsOcupados(50, 30)).toBe(2);
    expect(slotsOcupados(60, 30)).toBe(2);
    expect(slotsOcupados(61, 30)).toBe(3);
  });
});

describe('agenda: agendamento válido', () => {
  it('aceita corte, barba e combo em horário livre e calcula o horário de fim real', () => {
    expect(validar()).toEqual({ ok: true, horaFim: '09:30', slotsOcupados: 1 });
    expect(validar({ servico: barba })).toEqual({ ok: true, horaFim: '09:20', slotsOcupados: 1 });
    expect(validar({ servico: combo })).toEqual({ ok: true, horaFim: '09:50', slotsOcupados: 2 });
  });
});

describe('agenda: dias fechados', () => {
  it('recusa domingo', () => {
    const r = validar({ data: '2026-11-08' });
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe('DOMINGO');
  });

  it('recusa feriado nacional (25/12, sexta-feira)', () => {
    const r = validar({ data: '2026-12-25' });
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe('FERIADO');
  });

  it('recusa Consciência Negra (20/11, sexta-feira)', () => {
    expect(validar({ data: '2026-11-20' }).codigo).toBe('FERIADO');
  });

  it('recusa data extra cadastrada como folga', () => {
    const r = validar({ config: { ...config, feriadosExtras: [DIA] } });
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe('FERIADO');
  });

  it('aceita sábado', () => {
    expect(validar({ data: '2026-11-14' }).ok).toBe(true);
  });
});

describe('agenda: horário de funcionamento', () => {
  it('recusa começar antes das 08:00', () => {
    expect(validar({ horaInicio: '07:30' }).codigo).toBe('FORA_DO_HORARIO');
  });

  it('recusa começar às 20:00', () => {
    expect(validar({ horaInicio: '20:00' }).codigo).toBe('FORA_DO_HORARIO');
  });

  it('aceita corte às 19:30 (termina às 20:00)', () => {
    expect(validar({ horaInicio: '19:30' }).ok).toBe(true);
  });

  it('recusa combo às 19:30 (ocupa 2 slots e passa das 20:00)', () => {
    expect(validar({ horaInicio: '19:30', servico: combo }).codigo).toBe('FORA_DO_HORARIO');
  });

  it('aceita combo às 19:00', () => {
    expect(validar({ horaInicio: '19:00', servico: combo }).ok).toBe(true);
  });

  it('recusa horário fora da grade de 30 min', () => {
    expect(validar({ horaInicio: '09:15' }).codigo).toBe('FORA_DA_GRADE');
  });
});

describe('agenda: almoço', () => {
  it('recusa corte às 12:00 e às 12:30', () => {
    expect(validar({ horaInicio: '12:00' }).codigo).toBe('ALMOCO');
    expect(validar({ horaInicio: '12:30' }).codigo).toBe('ALMOCO');
  });

  it('recusa combo às 11:30 (invade o almoço)', () => {
    expect(validar({ horaInicio: '11:30', servico: combo }).codigo).toBe('ALMOCO');
  });

  it('aceita corte e barba às 11:30 (terminam às 12:00)', () => {
    expect(validar({ horaInicio: '11:30' }).ok).toBe(true);
    expect(validar({ horaInicio: '11:30', servico: barba }).ok).toBe(true);
  });

  it('aceita corte às 13:00', () => {
    expect(validar({ horaInicio: '13:00' }).ok).toBe(true);
  });
});

describe('agenda: antecedência mínima', () => {
  const hoje = '2026-11-10';

  it('recusa com menos de 1 hora de antecedência', () => {
    const r = validar({ data: hoje, horaInicio: '08:30', agora: { data: hoje, hora: '08:00' } });
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe('ANTECEDENCIA_MINIMA');
  });

  it('aceita com exatamente 1 hora de antecedência', () => {
    const r = validar({ data: hoje, horaInicio: '09:00', agora: { data: hoje, hora: '08:00' } });
    expect(r.ok).toBe(true);
  });

  it('recusa horário que já passou no mesmo dia', () => {
    const r = validar({ data: hoje, horaInicio: '09:00', agora: { data: hoje, hora: '10:00' } });
    expect(r.codigo).toBe('HORARIO_PASSADO');
  });

  it('recusa data de dias anteriores', () => {
    const r = validar({ data: '2026-10-30', agora });
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe('HORARIO_PASSADO');
  });

  it('respeita a antecedência configurada', () => {
    const cfg = { ...config, antecedenciaAgendarMin: 120 };
    const r = validar({
      config: cfg,
      data: hoje,
      horaInicio: '09:30',
      agora: { data: hoje, hora: '08:00' },
    });
    expect(r.codigo).toBe('ANTECEDENCIA_MINIMA');
  });
});

describe('agenda: conflitos de horário', () => {
  it('recusa o mesmo horário de um agendamento confirmado', () => {
    const r = validar({ horaInicio: '10:00', agendamentos: [agendamento('10:00', corte)] });
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe('CONFLITO');
  });

  it('recusa combo que sobrepõe um corte já marcado', () => {
    const r = validar({
      horaInicio: '09:30',
      servico: combo,
      agendamentos: [agendamento('10:00', corte)],
    });
    expect(r.codigo).toBe('CONFLITO');
  });

  it('recusa corte dentro do segundo slot de um combo', () => {
    const r = validar({
      horaInicio: '10:30',
      agendamentos: [agendamento('10:00', combo)],
    });
    expect(r.codigo).toBe('CONFLITO');
  });

  it('aceita horários encostados (sem sobreposição)', () => {
    const existentes = [agendamento('10:00', corte)];
    expect(validar({ horaInicio: '09:30', agendamentos: existentes }).ok).toBe(true);
    expect(validar({ horaInicio: '10:30', agendamentos: existentes }).ok).toBe(true);
    const comb = [agendamento('10:00', combo)];
    expect(validar({ horaInicio: '11:00', agendamentos: comb }).ok).toBe(true);
  });

  it('agendamento cancelado ou reagendado não bloqueia o horário', () => {
    const cancelado = agendamento('10:00', corte, { status: 'cancelado' });
    const reagendado = agendamento('10:30', corte, { status: 'reagendado', id: 'ag-r' });
    expect(validar({ horaInicio: '10:00', agendamentos: [cancelado] }).ok).toBe(true);
    expect(validar({ horaInicio: '10:30', agendamentos: [reagendado] }).ok).toBe(true);
  });

  it('agendamento concluído continua ocupando o horário', () => {
    const concluido = agendamento('10:00', corte, { status: 'concluido' });
    expect(validar({ horaInicio: '10:00', agendamentos: [concluido] }).codigo).toBe('CONFLITO');
  });

  it('agendamento de outro dia não conflita', () => {
    const outroDia = agendamento('10:00', corte, { data: '2026-11-11' });
    expect(validar({ horaInicio: '10:00', agendamentos: [outroDia] }).ok).toBe(true);
  });

  it('ignora o próprio agendamento ao reagendar (ignorarId)', () => {
    const atual = agendamento('10:00', corte);
    const r = validar({ horaInicio: '10:00', agendamentos: [atual], ignorarId: atual.id });
    expect(r.ok).toBe(true);
  });
});

describe('agenda: horários disponíveis', () => {
  it('dia livre: 22 horários de corte, de 08:00 a 19:30, sem o almoço', () => {
    const lista = listarHorariosDisponiveis({ data: DIA, servico: corte, agendamentos: [], config, agora });
    expect(lista).toHaveLength(22);
    expect(lista[0]).toBe('08:00');
    expect(lista.at(-1)).toBe('19:30');
    expect(lista).not.toContain('12:00');
    expect(lista).not.toContain('12:30');
    expect(lista).toContain('11:30');
    expect(lista).toContain('13:00');
  });

  it('combo: último horário 19:00 e nenhum às 11:30', () => {
    const lista = listarHorariosDisponiveis({ data: DIA, servico: combo, agendamentos: [], config, agora });
    expect(lista.at(-1)).toBe('19:00');
    expect(lista).not.toContain('11:30');
    expect(lista).toContain('11:00');
    expect(lista).toContain('13:00');
  });

  it('domingo e feriado não têm horários', () => {
    const base = { servico: corte, agendamentos: [], config, agora };
    expect(listarHorariosDisponiveis({ ...base, data: '2026-11-08' })).toEqual([]);
    expect(listarHorariosDisponiveis({ ...base, data: '2026-12-25' })).toEqual([]);
  });

  it('remove horários ocupados e os que causariam sobreposição', () => {
    const lista = listarHorariosDisponiveis({
      data: DIA,
      servico: combo,
      agendamentos: [agendamento('10:00', corte)],
      config,
      agora,
    });
    expect(lista).not.toContain('09:30');
    expect(lista).not.toContain('10:00');
    expect(lista).toContain('09:00');
    expect(lista).toContain('10:30');
  });

  it('respeita a antecedência mínima no próprio dia', () => {
    const lista = listarHorariosDisponiveis({
      data: DIA,
      servico: corte,
      agendamentos: [],
      config,
      agora: { data: DIA, hora: '09:10' },
    });
    expect(lista[0]).toBe('10:30');
  });

  it('dia lotado não tem horários', () => {
    const lotado = [];
    for (let min = 8 * 60; min < 20 * 60; min += 30) {
      const h = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
      if (h === '12:00' || h === '12:30') continue;
      lotado.push(agendamento(h, corte));
    }
    const lista = listarHorariosDisponiveis({ data: DIA, servico: corte, agendamentos: lotado, config, agora });
    expect(lista).toEqual([]);
  });
});

describe('agenda: prazo de cancelamento (apenas aviso)', () => {
  const dia = '2026-11-10';

  it('com 3 horas de antecedência não há aviso', () => {
    const r = verificarPrazoCancelamento({
      data: dia, horaInicio: '14:00', config, agora: { data: dia, hora: '11:00' },
    });
    expect(r).toEqual({ foraDoPrazo: false, minutosAteInicio: 180 });
  });

  it('com exatamente 2 horas não há aviso', () => {
    const r = verificarPrazoCancelamento({
      data: dia, horaInicio: '14:00', config, agora: { data: dia, hora: '12:00' },
    });
    expect(r.foraDoPrazo).toBe(false);
  });

  it('com 119 minutos há aviso', () => {
    const r = verificarPrazoCancelamento({
      data: dia, horaInicio: '14:00', config, agora: { data: dia, hora: '12:01' },
    });
    expect(r).toEqual({ foraDoPrazo: true, minutosAteInicio: 119 });
  });

  it('horário que já começou também gera aviso', () => {
    const r = verificarPrazoCancelamento({
      data: dia, horaInicio: '14:00', config, agora: { data: dia, hora: '14:10' },
    });
    expect(r.foraDoPrazo).toBe(true);
    expect(r.minutosAteInicio).toBe(-10);
  });
});
