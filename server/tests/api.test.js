import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import handlerVercel, { criarApp } from '../src/app.js';
import { criarRepositorios } from '../src/repository/index.js';
import { servicosPadrao } from '../src/config/padrao.js';
import { criarUsuario } from '../src/usuarios.js';

const SEGREDO = 'segredo-de-teste-123456';
const DIA = '2026-11-10'; // terça-feira comum
const DOMINGO = '2026-11-08';
const FERIADO = '2026-12-25'; // sexta-feira

let repos;
let app;
let agora; // relógio fixo, mutável pelos testes
let token;
let servicos;
let cliente;

const autorizado = (metodo, url) => request(app)[metodo](url).set('Authorization', `Bearer ${token}`);

async function preparar(opcoes = {}) {
  repos = criarRepositorios(); // em memória
  agora = { data: '2026-11-03', hora: '10:00' };
  for (const s of servicosPadrao) await repos.servicos.criar(s);
  await criarUsuario(repos, { nome: 'Luciano', email: 'luciano@teste.com', senha: 'senha-forte-123' });
  app = criarApp({ repos, segredoJwt: SEGREDO, relogio: () => agora, limiteLogin: false, ...opcoes });

  const login = await request(app).post('/auth/login').send({ email: 'luciano@teste.com', senha: 'senha-forte-123' });
  token = login.body.token;

  servicos = Object.fromEntries((await repos.servicos.listar()).map((s) => [s.nome, s]));
  cliente = (await autorizado('post', '/clientes').send({ nome: 'João Silva', telefone: '(31) 99999-8888' })).body;
}

const agendar = (extra = {}) =>
  autorizado('post', '/agendamentos').send({
    clienteId: cliente.id,
    servicoId: servicos['Corte'].id,
    data: DIA,
    horaInicio: '09:00',
    ...extra,
  });

const horariosLivres = async (servico = 'Corte', data = DIA) =>
  (await autorizado('get', `/disponibilidade?data=${data}&servicoId=${servicos[servico].id}`)).body.horarios;

describe('segurança: autenticação', () => {
  beforeEach(() => preparar());

  const rotasProtegidas = [
    ['get', '/clientes'],
    ['post', '/clientes'],
    ['get', '/servicos'],
    ['get', '/agendamentos'],
    ['post', '/agendamentos'],
    ['get', '/disponibilidade'],
    ['get', '/configuracoes'],
    ['put', '/configuracoes'],
    ['post', '/agendamentos/qualquer/cancelar'],
  ];

  it.each(rotasProtegidas)('%s %s sem token retorna 401', async (metodo, url) => {
    const r = await request(app)[metodo](url);
    expect(r.status).toBe(401);
    expect(r.body.erro).toBe('NAO_AUTENTICADO');
  });

  it('token inválido retorna 401', async () => {
    const r = await request(app).get('/clientes').set('Authorization', 'Bearer lixo');
    expect(r.status).toBe(401);
    expect(r.body.erro).toBe('TOKEN_INVALIDO');
  });

  it('token assinado com outro segredo retorna 401', async () => {
    const falso = jwt.sign({ sub: 'x', email: 'luciano@teste.com' }, 'outro-segredo-qualquer-123');
    const r = await request(app).get('/clientes').set('Authorization', `Bearer ${falso}`);
    expect(r.status).toBe(401);
  });

  it('token expirado retorna 401', async () => {
    const expirado = jwt.sign({ sub: 'x', email: 'luciano@teste.com' }, SEGREDO, { expiresIn: -10 });
    const r = await request(app).get('/clientes').set('Authorization', `Bearer ${expirado}`);
    expect(r.status).toBe(401);
  });

  it('a rota de saúde é pública', async () => {
    const r = await request(app).get('/saude');
    expect(r.status).toBe(200);
  });
});

describe('segurança: login', () => {
  beforeEach(() => preparar());

  it('autentica a conta pública de portfólio no handler da Vercel', async () => {
    const segredoOriginal = process.env.JWT_SECRET;
    process.env.JWT_SECRET = SEGREDO;

    try {
      const r = await request(handlerVercel).post('/auth/login').send({
        email: 'barbeiro@exemplo.com',
        senha: 'barbeiro123',
      });

      expect(r.status).toBe(200);
      expect(r.body.usuario.email).toBe('barbeiro@exemplo.com');
      expect(r.body.token).toBeTruthy();
    } finally {
      if (segredoOriginal === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = segredoOriginal;
    }
  });

  it('processa cabeçalhos do proxy quando a confiança está configurada', async () => {
    await preparar({ trustProxy: 1 });
    const r = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.24')
      .set('Forwarded', 'for=198.51.100.24;proto=https')
      .send({});

    expect(r.status).toBe(400);
  });

  it('login correto devolve token e usuário, sem expor o hash da senha', async () => {
    const r = await request(app).post('/auth/login').send({ email: 'luciano@teste.com', senha: 'senha-forte-123' });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.usuario.email).toBe('luciano@teste.com');
    expect(JSON.stringify(r.body)).not.toContain('senhaHash');
  });

  it('e-mail não diferencia maiúsculas de minúsculas', async () => {
    const r = await request(app).post('/auth/login').send({ email: 'LUCIANO@Teste.com', senha: 'senha-forte-123' });
    expect(r.status).toBe(200);
  });

  it('senha errada e e-mail inexistente dão a mesma resposta', async () => {
    const errada = await request(app).post('/auth/login').send({ email: 'luciano@teste.com', senha: 'errada-123' });
    const inexistente = await request(app).post('/auth/login').send({ email: 'ninguem@teste.com', senha: 'qualquer' });
    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body).toEqual(inexistente.body);
  });

  it('corpo vazio retorna 400', async () => {
    const r = await request(app).post('/auth/login').send({});
    expect(r.status).toBe(400);
    expect(r.body.erro).toBe('DADOS_INVALIDOS');
  });

  it('bloqueia depois de muitas tentativas erradas (429)', async () => {
    await preparar({ limiteLogin: { limit: 3, windowMs: 60_000 } });
    const tentar = () => request(app).post('/auth/login').send({ email: 'luciano@teste.com', senha: 'errada-123' });
    expect((await tentar()).status).toBe(401);
    expect((await tentar()).status).toBe(401);
    expect((await tentar()).status).toBe(401);
    expect((await tentar()).status).toBe(429);
  });

  it('GET /auth/eu devolve o usuário logado', async () => {
    const r = await autorizado('get', '/auth/eu');
    expect(r.status).toBe(200);
    expect(r.body.email).toBe('luciano@teste.com');
  });
});

describe('requisições malformadas', () => {
  beforeEach(() => preparar());

  it('JSON quebrado retorna 400 JSON_INVALIDO', async () => {
    const r = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(r.status).toBe(400);
    expect(r.body.erro).toBe('JSON_INVALIDO');
  });

  it('rota inexistente retorna 404', async () => {
    const r = await autorizado('get', '/nao-existe');
    expect(r.status).toBe(404);
    expect(r.body.erro).toBe('ROTA_NAO_ENCONTRADA');
  });
});

describe('clientes', () => {
  beforeEach(() => preparar());

  it('cadastra e normaliza o telefone para só dígitos', async () => {
    expect(cliente.telefone).toBe('31999998888');
    expect(cliente.id).toBeTruthy();
  });

  it('recusa telefone inválido', async () => {
    const r = await autorizado('post', '/clientes').send({ nome: 'Maria', telefone: '123' });
    expect(r.status).toBe(400);
    expect(r.body.detalhes[0].campo).toBe('telefone');
  });

  it('recusa telefone já cadastrado', async () => {
    const r = await autorizado('post', '/clientes').send({ nome: 'Outro João', telefone: '31 99999-8888' });
    expect(r.status).toBe(409);
    expect(r.body.erro).toBe('TELEFONE_JA_CADASTRADO');
  });

  it('recusa campos desconhecidos (não existe mais cliente VIP)', async () => {
    const r = await autorizado('post', '/clientes').send({ nome: 'Pedro', telefone: '31988887777', isVIP: true });
    expect(r.status).toBe(400);
  });

  it('recusa nome curto e e-mail inválido', async () => {
    const r = await autorizado('post', '/clientes').send({ nome: 'A', telefone: '31988887777', email: 'xx' });
    expect(r.status).toBe(400);
    expect(r.body.detalhes.map((d) => d.campo).sort()).toEqual(['email', 'nome']);
  });

  it('busca por nome sem diferenciar acento e por parte do telefone', async () => {
    expect((await autorizado('get', '/clientes?busca=joao')).body).toHaveLength(1);
    expect((await autorizado('get', '/clientes?busca=99998888')).body).toHaveLength(1);
    expect((await autorizado('get', '/clientes?busca=zzz')).body).toHaveLength(0);
  });

  it('atualiza dados e impede usar o telefone de outro cliente', async () => {
    const outro = (await autorizado('post', '/clientes').send({ nome: 'Pedro Lima', telefone: '31988887777' })).body;
    const ok = await autorizado('put', `/clientes/${outro.id}`).send({ nome: 'Pedro Lima Souza' });
    expect(ok.status).toBe(200);
    expect(ok.body.nome).toBe('Pedro Lima Souza');
    expect(ok.body.telefone).toBe('31988887777');

    const conflito = await autorizado('put', `/clientes/${outro.id}`).send({ telefone: '31999998888' });
    expect(conflito.status).toBe(409);
  });

  it('cliente inexistente retorna 404', async () => {
    expect((await autorizado('get', '/clientes/nao-existe')).status).toBe(404);
  });
});

describe('agendar', () => {
  beforeEach(() => preparar());

  it('cria agendamento confirmado com horário de fim e dados de cliente e serviço', async () => {
    const r = await agendar();
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      status: 'confirmado',
      horaInicio: '09:00',
      horaFim: '09:30',
      slotsOcupados: 1,
      cliente: { nome: 'João Silva' },
      servico: { nome: 'Corte', preco: 4000 },
    });
  });

  it('combo ocupa 2 slots e termina 50 minutos depois', async () => {
    const r = await agendar({ servicoId: servicos['Corte + barba'].id, horaInicio: '10:00' });
    expect(r.status).toBe(201);
    expect(r.body.horaFim).toBe('10:50');
    expect(r.body.slotsOcupados).toBe(2);
  });

  it('recusa o mesmo horário (409) e o combo que sobrepõe outro atendimento', async () => {
    await agendar({ horaInicio: '10:00' });
    const igual = await agendar({ horaInicio: '10:00' });
    expect(igual.status).toBe(409);
    expect(igual.body.erro).toBe('CONFLITO');
    const combo = await agendar({ servicoId: servicos['Corte + barba'].id, horaInicio: '09:30' });
    expect(combo.status).toBe(409);
  });

  it.each([
    ['domingo', { data: DOMINGO }, 'DOMINGO'],
    ['feriado nacional', { data: FERIADO }, 'FERIADO'],
    ['almoço', { horaInicio: '12:00' }, 'ALMOCO'],
    ['antes de abrir', { horaInicio: '07:30' }, 'FORA_DO_HORARIO'],
    ['fora da grade', { horaInicio: '09:15' }, 'FORA_DA_GRADE'],
  ])('recusa agendar em %s', async (_nome, extra, codigo) => {
    const r = await agendar(extra);
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe(codigo);
  });

  it('combo às 19:30 passa das 20:00 e é recusado; às 19:00 é aceito', async () => {
    const combo = servicos['Corte + barba'].id;
    expect((await agendar({ servicoId: combo, horaInicio: '19:30' })).body.erro).toBe('FORA_DO_HORARIO');
    expect((await agendar({ servicoId: combo, horaInicio: '19:00' })).status).toBe(201);
  });

  it('recusa com menos de 1 hora de antecedência', async () => {
    agora = { data: DIA, hora: '08:30' };
    const r = await agendar({ horaInicio: '09:00' });
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('ANTECEDENCIA_MINIMA');
  });

  it('recusa data inválida e horário mal formatado (400)', async () => {
    expect((await agendar({ data: '2026-02-30' })).status).toBe(400);
    expect((await agendar({ horaInicio: '9h' })).status).toBe(400);
  });

  it('recusa cliente ou serviço inexistente (404)', async () => {
    expect((await agendar({ clienteId: 'nao-existe' })).status).toBe(404);
    expect((await agendar({ servicoId: 'nao-existe' })).status).toBe(404);
  });

  it('recusa serviço desativado', async () => {
    await autorizado('put', `/servicos/${servicos['Barba'].id}`).send({ ativo: false });
    const r = await agendar({ servicoId: servicos['Barba'].id });
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('SERVICO_INATIVO');
  });

  it('lista os agendamentos do dia em ordem de horário', async () => {
    await agendar({ horaInicio: '14:00' });
    await agendar({ horaInicio: '09:00' });
    const r = await autorizado('get', `/agendamentos?data=${DIA}`);
    expect(r.body.map((a) => a.horaInicio)).toEqual(['09:00', '14:00']);
  });

  it('lista por período e recusa período grande demais', async () => {
    await agendar();
    const ok = await autorizado('get', `/agendamentos?inicio=${DIA}&fim=2026-11-12`);
    expect(ok.body).toHaveLength(1);
    expect((await autorizado('get', '/agendamentos?inicio=2026-01-01&fim=2026-12-31')).status).toBe(400);
    expect((await autorizado('get', `/agendamentos?inicio=${DIA}`)).status).toBe(400);
  });
});

describe('disponibilidade', () => {
  beforeEach(() => preparar());

  it('dia livre tem 22 horários de corte, sem o almoço', async () => {
    const horarios = await horariosLivres('Corte');
    expect(horarios).toHaveLength(22);
    expect(horarios).not.toContain('12:00');
    expect(horarios.at(-1)).toBe('19:30');
  });

  it('horário ocupado some da lista', async () => {
    await agendar({ horaInicio: '10:00' });
    expect(await horariosLivres('Corte')).not.toContain('10:00');
  });

  it('domingo e feriado voltam vazios com o motivo', async () => {
    const dom = (await autorizado('get', `/disponibilidade?data=${DOMINGO}&servicoId=${servicos['Corte'].id}`)).body;
    expect(dom.horarios).toEqual([]);
    expect(dom.fechado.codigo).toBe('DOMINGO');
    const fer = (await autorizado('get', `/disponibilidade?data=${FERIADO}&servicoId=${servicos['Corte'].id}`)).body;
    expect(fer.fechado.codigo).toBe('FERIADO');
  });

  it('exige o serviço', async () => {
    expect((await autorizado('get', `/disponibilidade?data=${DIA}`)).status).toBe(400);
  });
});

describe('cancelar', () => {
  beforeEach(() => preparar());

  it('exige motivo', async () => {
    const ag = (await agendar()).body;
    expect((await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({})).status).toBe(400);
    expect((await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({ motivo: '  ' })).status).toBe(400);
  });

  it('cancela com motivo, mantém o registro e libera o horário', async () => {
    const ag = (await agendar()).body;
    const r = await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({ motivo: 'Cliente não pode vir' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('cancelado');
    expect(r.body.motivoCancelamento).toBe('Cliente não pode vir');
    expect(await horariosLivres('Corte')).toContain('09:00');
    expect((await autorizado('get', `/agendamentos/${ag.id}`)).status).toBe(200);
  });

  it('não cancela duas vezes', async () => {
    const ag = (await agendar()).body;
    await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({ motivo: 'Teste' });
    const r = await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({ motivo: 'Teste' });
    expect(r.status).toBe(409);
    expect(r.body.erro).toBe('STATUS_INVALIDO');
  });

  it('com menos de 2 horas apenas avisa e pede confirmação extra', async () => {
    const ag = (await agendar({ horaInicio: '14:00' })).body;
    agora = { data: DIA, hora: '13:00' };

    const aviso = await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({ motivo: 'Imprevisto' });
    expect(aviso.status).toBe(409);
    expect(aviso.body).toMatchObject({ erro: 'CONFIRMACAO_NECESSARIA', aviso: true, minutosAteInicio: 60 });
    expect((await autorizado('get', `/agendamentos/${ag.id}`)).body.status).toBe('confirmado');

    const confirmado = await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({
      motivo: 'Imprevisto',
      confirmarForaDoPrazo: true,
    });
    expect(confirmado.status).toBe(200);
    expect(confirmado.body.status).toBe('cancelado');
  });

  it('muitos cancelamentos do mesmo cliente nunca bloqueiam novos agendamentos', async () => {
    for (let i = 0; i < 5; i++) {
      const ag = (await agendar()).body;
      await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({ motivo: `Cancelamento ${i + 1}` });
    }
    expect((await agendar()).status).toBe(201);
  });
});

describe('reagendar', () => {
  beforeEach(() => preparar());

  it('cria o novo horário, marca o original como reagendado e libera o horário antigo', async () => {
    const original = (await agendar({ horaInicio: '09:00' })).body;
    const r = await autorizado('post', `/agendamentos/${original.id}/reagendar`).send({ data: DIA, horaInicio: '15:00' });
    expect(r.status).toBe(200);
    expect(r.body.original.status).toBe('reagendado');
    expect(r.body.novo).toMatchObject({ status: 'confirmado', horaInicio: '15:00', agendamentoOriginalId: original.id });
    expect(r.body.novo.cliente.id).toBe(cliente.id);

    const livres = await horariosLivres('Corte');
    expect(livres).toContain('09:00');
    expect(livres).not.toContain('15:00');
  });

  it('se o destino estiver ocupado, falha e o original continua confirmado', async () => {
    const original = (await agendar({ horaInicio: '09:00' })).body;
    await agendar({ horaInicio: '11:00' });
    const r = await autorizado('post', `/agendamentos/${original.id}/reagendar`).send({ data: DIA, horaInicio: '11:00' });
    expect(r.status).toBe(409);
    expect((await autorizado('get', `/agendamentos/${original.id}`)).body.status).toBe('confirmado');
    expect((await autorizado('get', `/agendamentos?data=${DIA}`)).body).toHaveLength(2);
  });

  it('as mesmas regras do agendamento valem no reagendamento', async () => {
    const original = (await agendar()).body;
    const domingo = await autorizado('post', `/agendamentos/${original.id}/reagendar`).send({ data: DOMINGO, horaInicio: '10:00' });
    expect(domingo.body.erro).toBe('DOMINGO');
    const almoco = await autorizado('post', `/agendamentos/${original.id}/reagendar`).send({ data: DIA, horaInicio: '12:30' });
    expect(almoco.body.erro).toBe('ALMOCO');
  });

  it('recusa reagendar para o mesmo horário', async () => {
    const original = (await agendar()).body;
    const r = await autorizado('post', `/agendamentos/${original.id}/reagendar`).send({ data: DIA, horaInicio: '09:00' });
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('MESMO_HORARIO');
  });

  it('permite deslocar o combo por cima do próprio horário (10:00 para 10:30)', async () => {
    const combo = (await agendar({ servicoId: servicos['Corte + barba'].id, horaInicio: '10:00' })).body;
    const r = await autorizado('post', `/agendamentos/${combo.id}/reagendar`).send({ data: DIA, horaInicio: '10:30' });
    expect(r.status).toBe(200);
  });

  it('permite trocar o serviço ao reagendar', async () => {
    const original = (await agendar()).body;
    const r = await autorizado('post', `/agendamentos/${original.id}/reagendar`).send({
      data: DIA,
      horaInicio: '16:00',
      servicoId: servicos['Corte + barba'].id,
    });
    expect(r.status).toBe(200);
    expect(r.body.novo.slotsOcupados).toBe(2);
  });

  it('não reagenda agendamento cancelado', async () => {
    const ag = (await agendar()).body;
    await autorizado('post', `/agendamentos/${ag.id}/cancelar`).send({ motivo: 'Teste' });
    const r = await autorizado('post', `/agendamentos/${ag.id}/reagendar`).send({ data: DIA, horaInicio: '15:00' });
    expect(r.status).toBe(409);
  });

  it('reagendamentos encadeados mantêm a referência a cada anterior', async () => {
    const a = (await agendar({ horaInicio: '09:00' })).body;
    const b = (await autorizado('post', `/agendamentos/${a.id}/reagendar`).send({ data: DIA, horaInicio: '11:00' })).body.novo;
    const c = (await autorizado('post', `/agendamentos/${b.id}/reagendar`).send({ data: DIA, horaInicio: '15:00' })).body.novo;
    expect(c.agendamentoOriginalId).toBe(b.id);
    expect(b.agendamentoOriginalId).toBe(a.id);
    expect((await autorizado('get', `/agendamentos/${a.id}`)).body.status).toBe('reagendado');
    expect((await autorizado('get', `/agendamentos/${b.id}`)).body.status).toBe('reagendado');
  });
});

describe('concluir', () => {
  beforeEach(() => preparar());

  it('não conclui atendimento que ainda não começou', async () => {
    const ag = (await agendar()).body;
    const r = await autorizado('post', `/agendamentos/${ag.id}/concluir`);
    expect(r.status).toBe(409);
    expect(r.body.erro).toBe('AINDA_NAO_OCORREU');
  });

  it('conclui depois do horário e não conclui duas vezes', async () => {
    const ag = (await agendar()).body;
    agora = { data: DIA, hora: '09:40' };
    const r = await autorizado('post', `/agendamentos/${ag.id}/concluir`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('concluido');
    expect((await autorizado('post', `/agendamentos/${ag.id}/concluir`)).status).toBe(409);
  });

  it('atendimento concluído continua ocupando o horário', async () => {
    const ag = (await agendar()).body;
    agora = { data: DIA, hora: '09:40' };
    await autorizado('post', `/agendamentos/${ag.id}/concluir`);
    agora = { data: '2026-11-03', hora: '10:00' };
    expect((await agendar()).status).toBe(409);
  });
});

describe('histórico do cliente', () => {
  beforeEach(() => preparar());

  it('resume agendamentos por status, mais recentes primeiro', async () => {
    const a = (await agendar({ horaInicio: '09:00' })).body;
    await autorizado('post', `/agendamentos/${a.id}/cancelar`).send({ motivo: 'Teste' });
    const b = (await agendar({ horaInicio: '10:00' })).body;
    await autorizado('post', `/agendamentos/${b.id}/reagendar`).send({ data: DIA, horaInicio: '14:00' });

    const r = await autorizado('get', `/clientes/${cliente.id}/agendamentos`);
    expect(r.status).toBe(200);
    expect(r.body.resumo).toEqual({ total: 3, confirmados: 1, concluidos: 0, cancelados: 1, reagendados: 1 });
    expect(r.body.agendamentos[0].horaInicio).toBe('14:00');
  });

  it('cliente inexistente retorna 404', async () => {
    expect((await autorizado('get', '/clientes/nao-existe/agendamentos')).status).toBe(404);
  });
});

describe('WhatsApp', () => {
  beforeEach(() => preparar());

  it('gera mensagem e link wa.me com o telefone do cliente', async () => {
    const ag = (await agendar()).body;
    const r = await autorizado('get', `/agendamentos/${ag.id}/whatsapp?tipo=confirmacao`);
    expect(r.status).toBe(200);
    expect(r.body.link.startsWith('https://wa.me/5531999998888?text=')).toBe(true);
    expect(r.body.mensagem).toContain('João');
    expect(r.body.mensagem).toContain('09:00');
    expect(r.body.mensagem).toContain('Luciano');
  });

  it('recusa tipo de mensagem inválido', async () => {
    const ag = (await agendar()).body;
    expect((await autorizado('get', `/agendamentos/${ag.id}/whatsapp?tipo=xyz`)).status).toBe(400);
  });
});

describe('configurações', () => {
  beforeEach(() => preparar());

  it('mostra as configurações e os feriados nacionais calculados', async () => {
    const r = await autorizado('get', '/configuracoes');
    expect(r.status).toBe(200);
    expect(r.body.nomeBarbearia).toBe('Luciano');
    expect(r.body.feriadosNacionais).toContain('2026-12-25');
    expect(r.body.feriadosNacionais).toContain('2027-01-01');
  });

  it('aumentar a antecedência mínima passa a valer nos agendamentos', async () => {
    agora = { data: DIA, hora: '08:00' };
    expect((await agendar({ horaInicio: '09:30' })).status).toBe(201);
    await autorizado('put', '/configuracoes').send({ antecedenciaAgendarMin: 180 });
    const r = await agendar({ horaInicio: '10:30' });
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe('ANTECEDENCIA_MINIMA');
  });

  it('data extra cadastrada vira folga', async () => {
    await autorizado('put', '/configuracoes').send({ feriadosExtras: [DIA, DIA] });
    const r = await agendar();
    expect(r.body.erro).toBe('FERIADO');
    expect((await autorizado('get', '/configuracoes')).body.feriadosExtras).toEqual([DIA]);
  });

  it('desligar o almoço libera o horário das 12:00', async () => {
    expect((await agendar({ horaInicio: '12:00' })).status).toBe(422);
    const r = await autorizado('put', '/configuracoes').send({ almocoInicio: null, almocoFim: null });
    expect(r.status).toBe(200);
    expect((await agendar({ horaInicio: '12:00' })).status).toBe(201);
  });

  it('recusa configurações inconsistentes', async () => {
    const fechaAntes = await autorizado('put', '/configuracoes').send({ horaFechamento: '07:00' });
    expect(fechaAntes.status).toBe(400);
    expect(fechaAntes.body.erro).toBe('CONFIGURACAO_INVALIDA');
    const almocoMeio = await autorizado('put', '/configuracoes').send({ almocoInicio: null });
    expect(almocoMeio.status).toBe(400);
    const almocoInvertido = await autorizado('put', '/configuracoes').send({ almocoInicio: '13:00', almocoFim: '12:00' });
    expect(almocoInvertido.status).toBe(400);
  });

  it('não deixa alterar o tamanho do slot nem enviar campos desconhecidos', async () => {
    expect((await autorizado('put', '/configuracoes').send({ tamanhoSlotMin: 15 })).status).toBe(400);
    expect((await autorizado('put', '/configuracoes').send({ qualquer: 1 })).status).toBe(400);
  });
});
