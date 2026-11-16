import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { criarRepositorios } from '../src/repository/index.js';

let pasta;
const novoArquivo = () => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'barbearia-teste-'));
  return path.join(pasta, 'dados.json');
};

afterEach(() => {
  if (pasta) fs.rmSync(pasta, { recursive: true, force: true });
  pasta = undefined;
});

describe('repository em JSON', () => {
  it('persiste no arquivo e recarrega em uma nova instância', async () => {
    const arquivo = novoArquivo();
    const a = criarRepositorios({ arquivo });
    const criado = await a.clientes.criar({ nome: 'João', telefone: '31999998888' });

    const b = criarRepositorios({ arquivo });
    expect(await b.clientes.buscarPorId(criado.id)).toMatchObject({ nome: 'João' });
  });

  it('grava de forma atômica (sem sobrar arquivo temporário)', async () => {
    const arquivo = novoArquivo();
    const repos = criarRepositorios({ arquivo });
    await repos.clientes.criar({ nome: 'João', telefone: '31999998888' });
    expect(fs.existsSync(arquivo)).toBe(true);
    expect(fs.existsSync(`${arquivo}.tmp`)).toBe(false);
    expect(() => JSON.parse(fs.readFileSync(arquivo, 'utf8'))).not.toThrow();
  });

  it('devolve cópias: alterar o resultado não altera os dados guardados', async () => {
    const repos = criarRepositorios();
    const criado = await repos.clientes.criar({ nome: 'João', telefone: '31999998888' });
    criado.nome = 'ALTERADO FORA';
    expect((await repos.clientes.buscarPorId(criado.id)).nome).toBe('João');
  });

  it('atualizar ignora campos undefined e retorna null para id inexistente', async () => {
    const repos = criarRepositorios();
    const c = await repos.clientes.criar({ nome: 'João', telefone: '31999998888', email: 'a@b.com' });
    const atualizado = await repos.clientes.atualizar(c.id, { nome: 'João Pedro', email: undefined });
    expect(atualizado).toMatchObject({ nome: 'João Pedro', email: 'a@b.com' });
    expect(await repos.clientes.atualizar('nao-existe', { nome: 'x' })).toBeNull();
  });

  it('configuração começa com os valores padrão e guarda alterações', async () => {
    const repos = criarRepositorios();
    const inicial = await repos.configuracao.obter();
    expect(inicial.horaAbertura).toBe('08:00');
    await repos.configuracao.salvar({ ...inicial, antecedenciaAgendarMin: 90 });
    expect((await repos.configuracao.obter()).antecedenciaAgendarMin).toBe(90);
  });

  it('limpar apaga tudo', async () => {
    const arquivo = novoArquivo();
    const repos = criarRepositorios({ arquivo });
    await repos.clientes.criar({ nome: 'João', telefone: '31999998888' });
    repos.limpar();
    expect(await repos.clientes.listar()).toEqual([]);
    expect(await criarRepositorios({ arquivo }).clientes.listar()).toEqual([]);
  });
});
