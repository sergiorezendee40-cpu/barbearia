// Camada de acesso aos dados. O resto do sistema só conversa com estas funções.
// Todas são async de propósito: assim, trocar o JSON por um banco real não muda quem chama.
// Cada função traz um comentário TODO(DB) com a consulta equivalente.

import crypto from 'node:crypto';
import { criarArmazenamento } from './jsonStore.js';
import { configPadrao } from '../config/padrao.js';

const copia = (x) => (x === undefined || x === null ? x : structuredClone(x));
const agora = () => new Date().toISOString();
const semAcento = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const semUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
const porDataHora = (a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio);

export function criarRepositorios({ arquivo = null } = {}) {
  const store = criarArmazenamento(arquivo);
  const { dados } = store;

  const usuarios = {
    // TODO(DB): SELECT * FROM usuarios WHERE lower(email) = lower($1)
    async buscarPorEmail(email) {
      return copia(dados.usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase()));
    },
    // TODO(DB): SELECT count(*) FROM usuarios
    async contar() {
      return dados.usuarios.length;
    },
    // TODO(DB): INSERT INTO usuarios (...) VALUES (...) RETURNING *
    async criar(novo) {
      const usuario = { id: crypto.randomUUID(), criadoEm: agora(), ...novo };
      dados.usuarios.push(usuario);
      store.salvar();
      return copia(usuario);
    },
  };

  const clientes = {
    // TODO(DB): SELECT * FROM clientes WHERE unaccent(nome) ILIKE '%' || $1 || '%' OR telefone LIKE '%' || $2 || '%' ORDER BY nome
    async listar({ busca } = {}) {
      let lista = dados.clientes;
      if (busca) {
        const termo = semAcento(busca.trim());
        const digitos = busca.replace(/\D/g, '');
        lista = lista.filter((c) => semAcento(c.nome).includes(termo) || (digitos && c.telefone.includes(digitos)));
      }
      return copia([...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    },
    // TODO(DB): SELECT * FROM clientes WHERE id = $1
    async buscarPorId(id) {
      return copia(dados.clientes.find((c) => c.id === id) ?? null);
    },
    // TODO(DB): SELECT * FROM clientes WHERE id = ANY($1)
    async buscarVarios(ids) {
      return copia(dados.clientes.filter((c) => ids.includes(c.id)));
    },
    // TODO(DB): SELECT * FROM clientes WHERE telefone = $1
    async buscarPorTelefone(telefone) {
      return copia(dados.clientes.find((c) => c.telefone === telefone) ?? null);
    },
    // TODO(DB): INSERT INTO clientes (...) VALUES (...) RETURNING *
    async criar(novo) {
      const cliente = { id: crypto.randomUUID(), criadoEm: agora(), atualizadoEm: agora(), ...semUndefined(novo) };
      dados.clientes.push(cliente);
      store.salvar();
      return copia(cliente);
    },
    // TODO(DB): UPDATE clientes SET ... WHERE id = $1 RETURNING *
    async atualizar(id, alteracoes) {
      const cliente = dados.clientes.find((c) => c.id === id);
      if (!cliente) return null;
      Object.assign(cliente, semUndefined(alteracoes), { atualizadoEm: agora() });
      store.salvar();
      return copia(cliente);
    },
  };

  const servicos = {
    // TODO(DB): SELECT * FROM servicos [WHERE ativo] ORDER BY nome
    async listar({ apenasAtivos = false } = {}) {
      const lista = apenasAtivos ? dados.servicos.filter((s) => s.ativo) : dados.servicos;
      return copia([...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    },
    // TODO(DB): SELECT * FROM servicos WHERE id = $1
    async buscarPorId(id) {
      return copia(dados.servicos.find((s) => s.id === id) ?? null);
    },
    // TODO(DB): SELECT * FROM servicos WHERE id = ANY($1)
    async buscarVarios(ids) {
      return copia(dados.servicos.filter((s) => ids.includes(s.id)));
    },
    // TODO(DB): INSERT INTO servicos (...) VALUES (...) RETURNING *
    async criar(novo) {
      const servico = { id: crypto.randomUUID(), ativo: true, criadoEm: agora(), ...semUndefined(novo) };
      dados.servicos.push(servico);
      store.salvar();
      return copia(servico);
    },
    // TODO(DB): UPDATE servicos SET ... WHERE id = $1 RETURNING *
    async atualizar(id, alteracoes) {
      const servico = dados.servicos.find((s) => s.id === id);
      if (!servico) return null;
      Object.assign(servico, semUndefined(alteracoes));
      store.salvar();
      return copia(servico);
    },
  };

  const agendamentos = {
    // TODO(DB): SELECT * FROM agendamentos WHERE data BETWEEN $1 AND $2 ORDER BY data, hora_inicio
    async listarPorPeriodo(inicio, fim) {
      return copia(dados.agendamentos.filter((a) => a.data >= inicio && a.data <= fim).sort(porDataHora));
    },
    // TODO(DB): SELECT * FROM agendamentos WHERE data = $1 ORDER BY hora_inicio
    async listarPorData(data) {
      return copia(dados.agendamentos.filter((a) => a.data === data).sort(porDataHora));
    },
    // TODO(DB): SELECT * FROM agendamentos WHERE cliente_id = $1 ORDER BY data DESC, hora_inicio DESC
    async listarPorCliente(clienteId) {
      return copia(dados.agendamentos.filter((a) => a.clienteId === clienteId).sort(porDataHora));
    },
    // TODO(DB): SELECT * FROM agendamentos WHERE id = $1
    async buscarPorId(id) {
      return copia(dados.agendamentos.find((a) => a.id === id) ?? null);
    },
    // TODO(DB): INSERT INTO agendamentos (...) VALUES (...) RETURNING *
    async criar(novo) {
      const ag = { id: crypto.randomUUID(), criadoEm: agora(), atualizadoEm: agora(), ...semUndefined(novo) };
      dados.agendamentos.push(ag);
      store.salvar();
      return copia(ag);
    },
    // TODO(DB): UPDATE agendamentos SET ... WHERE id = $1 RETURNING *
    async atualizar(id, alteracoes) {
      const ag = dados.agendamentos.find((a) => a.id === id);
      if (!ag) return null;
      Object.assign(ag, semUndefined(alteracoes), { atualizadoEm: agora() });
      store.salvar();
      return copia(ag);
    },
  };

  const configuracao = {
    // TODO(DB): SELECT * FROM configuracao LIMIT 1 (linha única)
    async obter() {
      return copia({ ...configPadrao, ...(dados.configuracao ?? {}) });
    },
    // TODO(DB): UPDATE configuracao SET ... (linha única)
    async salvar(nova) {
      dados.configuracao = copia(nova);
      store.salvar();
      return copia(nova);
    },
  };

  return { usuarios, clientes, servicos, agendamentos, configuracao, limpar: store.limpar };
}
