// Único lugar do front que conversa com o servidor.
// Em desenvolvimento, o Vite encaminha /api para http://localhost:3000 (ver vite.config.js).

const BASE = '/api';
const CHAVE_TOKEN = 'barbearia.token';

// O token fica no localStorage para o login sobreviver a recarregar a página.
// Contrapartida: um XSS conseguiria lê-lo. Por isso o token expira em 8 h e o React escapa todo texto.
// Se o armazenamento estiver bloqueado, o sistema ainda funciona (só pede login de novo ao recarregar).
function lerToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

let token = lerToken();

export function temToken() {
  return Boolean(token);
}

export function guardarToken(novo) {
  token = novo;
  try {
    if (novo) localStorage.setItem(CHAVE_TOKEN, novo);
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    // sem armazenamento: segue só em memória
  }
}

let aoExpirar = () => {};
/** Registra o que fazer quando o servidor disser que o login venceu (401). */
export function definirAoExpirar(fn) {
  aoExpirar = fn;
}

export class ErroApi extends Error {
  constructor({ status = 0, erro = 'ERRO', mensagem = 'Algo deu errado.', detalhes, ...extra }) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.erro = erro;
    this.detalhes = detalhes;
    this.extra = extra;
  }

  /** Mensagem pronta para mostrar na tela (junta os detalhes de validação, se houver). */
  get textoParaTela() {
    if (this.detalhes?.length) return this.detalhes.map((d) => d.mensagem).join(' ');
    return this.message;
  }
}

async function requisitar(metodo, caminho, corpo, { semLogin = false } = {}) {
  const cabecalhos = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (token && !semLogin) cabecalhos.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(BASE + caminho, {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi({
      erro: 'SEM_CONEXAO',
      mensagem: 'Não foi possível falar com o servidor. Confira se ele está rodando e tente de novo.',
    });
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 401 && !semLogin) aoExpirar();
    throw new ErroApi({ status: resposta.status, ...(dados ?? { mensagem: 'Resposta inesperada do servidor.' }) });
  }
  return dados;
}

const consulta = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  login: (email, senha) => requisitar('POST', '/auth/login', { email, senha }, { semLogin: true }),
  eu: () => requisitar('GET', '/auth/eu'),

  configuracoes: () => requisitar('GET', '/configuracoes'),
  servicos: () => requisitar('GET', `/servicos${consulta({ ativos: 'true' })}`),

  clientes: (busca) => requisitar('GET', `/clientes${consulta({ busca })}`),
  criarCliente: (dados) => requisitar('POST', '/clientes', dados),

  agendamentos: (data) => requisitar('GET', `/agendamentos${consulta({ data })}`),
  disponibilidade: (data, servicoId) => requisitar('GET', `/disponibilidade${consulta({ data, servicoId })}`),
  criarAgendamento: (dados) => requisitar('POST', '/agendamentos', dados),
  cancelar: (id, dados) => requisitar('POST', `/agendamentos/${encodeURIComponent(id)}/cancelar`, dados),
  reagendar: (id, dados) => requisitar('POST', `/agendamentos/${encodeURIComponent(id)}/reagendar`, dados),
  concluir: (id) => requisitar('POST', `/agendamentos/${encodeURIComponent(id)}/concluir`),
  whatsapp: (id, tipo) => requisitar('GET', `/agendamentos/${encodeURIComponent(id)}/whatsapp${consulta({ tipo })}`),
};
