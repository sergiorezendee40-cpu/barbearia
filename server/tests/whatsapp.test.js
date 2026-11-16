import { describe, it, expect } from 'vitest';
import { normalizarTelefone, gerarLinkWhatsapp, montarMensagem } from '../src/regras/whatsapp.js';

describe('telefone: normalização e validação', () => {
  it('aceita celular com máscara, com +55 e só com dígitos', () => {
    expect(normalizarTelefone('(31) 99999-8888')).toBe('31999998888');
    expect(normalizarTelefone('+55 31 99999-8888')).toBe('31999998888');
    expect(normalizarTelefone('31999998888')).toBe('31999998888');
  });

  it('aceita telefone fixo (10 dígitos começando com 2 a 5)', () => {
    expect(normalizarTelefone('(31) 3333-4444')).toBe('3133334444');
  });

  it('recusa números inválidos', () => {
    expect(normalizarTelefone('123')).toBeNull();
    expect(normalizarTelefone('')).toBeNull();
    expect(normalizarTelefone('abc')).toBeNull();
    expect(normalizarTelefone('00999998888')).toBeNull(); // DDD começando com 0
    expect(normalizarTelefone('31899998888')).toBeNull(); // celular sem o 9 inicial
    expect(normalizarTelefone('3199998888')).toBeNull(); // 8 dígitos começando com 9
    expect(normalizarTelefone('319999988889')).toBeNull(); // dígitos demais
  });
});

describe('whatsapp: link', () => {
  it('gera link wa.me com DDI 55 e texto codificado', () => {
    expect(gerarLinkWhatsapp('(31) 99999-8888', 'Olá, tudo bem?')).toBe(
      'https://wa.me/5531999998888?text=Ol%C3%A1%2C%20tudo%20bem%3F',
    );
  });

  it('retorna null para telefone inválido', () => {
    expect(gerarLinkWhatsapp('123', 'oi')).toBeNull();
  });
});

describe('whatsapp: mensagens prontas', () => {
  const dados = {
    nomeCliente: 'João',
    nomeBarbearia: 'Luciano',
    data: '2026-11-10',
    hora: '09:00',
    servico: 'Corte',
  };

  it('confirmação traz cliente, barbearia, dia, data, hora e serviço', () => {
    const msg = montarMensagem('confirmacao', dados);
    expect(msg).toContain('João');
    expect(msg).toContain('Luciano');
    expect(msg).toContain('terça-feira');
    expect(msg).toContain('10/11');
    expect(msg).toContain('09:00');
    expect(msg).toContain('Corte');
  });

  it('existem mensagens para lembrete, cancelamento e reagendamento', () => {
    expect(montarMensagem('lembrete', dados)).toContain('09:00');
    expect(montarMensagem('cancelamento', dados)).toContain('cancel');
    expect(montarMensagem('reagendamento', dados)).toContain('10/11');
  });

  it('tipo desconhecido gera erro', () => {
    expect(() => montarMensagem('xyz', dados)).toThrow();
  });
});
