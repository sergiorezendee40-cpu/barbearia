// Gera dados de teste (clientes, serviços e agendamentos) para desenvolver e testar a tela cheia.
//
//   npm run seed          -> popula um arquivo de dados vazio
//   npm run seed:reset    -> APAGA todos os dados do arquivo e recria tudo
//
// Os agendamentos passam pelos mesmos casos de uso da API (e portanto pelas mesmas regras),
// com um relógio controlado. Assim o histórico no passado também é válido.
// Casos de borda gerados: dia lotado, combo no último horário (19:00), combo terminando
// exatamente no almoço (11:00), reagendamento encadeado, cancelamentos com motivo.
//
// Por segurança, o seed se recusa a rodar com NODE_ENV=production.

import { carregarAmbiente } from './ambiente.js';
import { criarRepositorios } from './repository/index.js';
import { criarCasosDeUso } from './casosDeUso/agendamentos.js';
import { criarUsuario } from './usuarios.js';
import { servicosPadrao } from './config/padrao.js';
import { agoraSaoPaulo, somarDias, horaParaMin } from './regras/tempo.js';
import { proximoDiaAberto, motivoDiaFechado, listarHorariosDisponiveis } from './regras/agenda.js';
import { normalizarTelefone } from './regras/whatsapp.js';

if (process.env.NODE_ENV === 'production') {
  console.error('O seed não roda em produção (ele cria um usuário com senha conhecida e pode apagar dados).');
  process.exit(1);
}

const reset = process.argv.includes('--reset');
const { arquivoDados } = carregarAmbiente();
const repos = criarRepositorios({ arquivo: arquivoDados });

if (!reset && ((await repos.clientes.listar()).length > 0 || (await repos.usuarios.contar()) > 0)) {
  console.log(`Já existem dados em ${arquivoDados}. Para apagar tudo e recriar, rode: npm run seed:reset`);
  process.exit(0);
}
if (reset) {
  console.log(`Apagando todos os dados de ${arquivoDados} ...`);
  repos.limpar();
}

// ---------- relógio controlado ----------
const hoje = agoraSaoPaulo();
// Para criar, reagendar e cancelar usamos um "agora" bem antigo: tudo passa na antecedência.
const RELOGIO_ANTIGO = { data: somarDias(hoje.data, -15), hora: '06:00' };
let relogioAtual = RELOGIO_ANTIGO;
const casos = criarCasosDeUso({ repos, relogio: () => relogioAtual });

async function noRelogio(relogio, fn) {
  relogioAtual = relogio;
  try {
    return await fn();
  } finally {
    relogioAtual = RELOGIO_ANTIGO;
  }
}

// ---------- usuário, serviços e clientes ----------
const email = process.env.SEED_EMAIL || 'barbeiro@exemplo.com';
const senha = process.env.SEED_SENHA || 'barbearia123';
await criarUsuario(repos, { nome: 'Luciano', email, senha });

const servicos = {};
for (const s of servicosPadrao) {
  const criado = await repos.servicos.criar(s);
  servicos[s.nome] = criado;
}
const { Corte, Barba } = servicos;
const Combo = servicos['Corte + barba'];

// Nomes e telefones fictícios (31 9 9999-000X).
const dadosClientes = [
  { nome: 'Carlos Eduardo Silva', tel: '31999990001' },
  { nome: 'João Pedro Almeida', tel: '(31) 99999-0002', email: 'joao.almeida@exemplo.com' },
  { nome: 'Marcos Vinícius Souza', tel: '31 99999-0003', observacoes: 'Prefere degradê baixo.' },
  { nome: 'Rafael Costa', tel: '31999990004', dataNascimento: '1992-05-14' },
  { nome: 'André Luiz Ferreira', tel: '31999990005' },
  { nome: 'Thiago Martins', tel: '31999990006', observacoes: 'Chega sempre 10 min antes.' },
  { nome: 'Bruno Henrique Lima', tel: '31999990007' },
  { nome: 'Felipe Ribeiro', tel: '31999990008', email: 'felipe.r@exemplo.com' },
];
const clientes = [];
for (const c of dadosClientes) {
  const telefone = normalizarTelefone(c.tel);
  if (!telefone) throw new Error(`Telefone de teste inválido: ${c.tel}`);
  clientes.push(
    await repos.clientes.criar({
      nome: c.nome,
      telefone,
      email: c.email,
      dataNascimento: c.dataNascimento,
      observacoes: c.observacoes,
    }),
  );
}
let proximoCliente = 0;
const clienteDaVez = () => clientes[proximoCliente++ % clientes.length];

// ---------- helpers de agendamento ----------
let total = 0;
async function agendar(servico, data, horaInicio, cliente = clienteDaVez()) {
  total += 1;
  return noRelogio(RELOGIO_ANTIGO, () =>
    casos.criar({ clienteId: cliente.id, servicoId: servico.id, data, horaInicio }),
  );
}
const concluir = (ag) => noRelogio({ data: ag.data, hora: ag.horaInicio }, () => casos.concluir(ag.id));
const cancelar = (ag, motivo) => noRelogio(RELOGIO_ANTIGO, () => casos.cancelar(ag.id, { motivo }));

const config = await repos.configuracao.obter();
const diaAnterior = (d) => proximoDiaAberto(d, config, -1);
const diaSeguinte = (d) => proximoDiaAberto(d, config, 1);

// ---------- passado: histórico dos últimos dias abertos ----------
const d1 = diaAnterior(hoje.data);
const d2 = diaAnterior(d1);
const d3 = diaAnterior(d2);

for (const [servico, data, hora] of [
  [Corte, d3, '09:00'],
  [Barba, d3, '09:30'],
  [Combo, d3, '10:00'],
  [Corte, d2, '08:00'],
  [Combo, d2, '16:00'],
  [Corte, d1, '08:30'],
  [Barba, d1, '10:00'],
  [Corte, d1, '15:00'],
]) {
  await concluir(await agendar(servico, data, hora));
}
await cancelar(await agendar(Corte, d3, '14:00'), 'Cliente avisou que não poderia vir.');
await cancelar(await agendar(Corte, d2, '17:00'), 'Cliente remarcou por telefone.');

// ---------- hoje (se a barbearia abre) ----------
if (!motivoDiaFechado(hoje.data, config)) {
  for (const [servico, hora] of [
    [Corte, '09:00'],
    [Barba, '10:30'],
    [Combo, '15:00'],
    [Corte, '18:00'],
  ]) {
    const ag = await agendar(servico, hoje.data, hora);
    if (horaParaMin(hora) < horaParaMin(hoje.hora)) await concluir(ag); // já aconteceu hoje
  }
}

// ---------- futuro ----------
const f1 = diaSeguinte(hoje.data);
const f2 = diaSeguinte(f1);
const f3 = diaSeguinte(f2);
const f4 = diaSeguinte(f3);

// f1: dia movimentado, incluindo o combo no último horário possível (19:00).
for (const [servico, hora] of [
  [Corte, '08:00'],
  [Barba, '08:30'],
  [Combo, '09:00'],
  [Corte, '13:30'],
  [Corte, '15:00'],
  [Combo, '19:00'],
]) {
  await agendar(servico, f1, hora);
}

// f2: dia lotado (todos os horários livres viram corte).
const doDia = await repos.agendamentos.listarPorData(f2);
const livres = listarHorariosDisponiveis({
  data: f2,
  servico: Corte,
  agendamentos: doDia,
  config,
  agora: RELOGIO_ANTIGO,
});
for (const hora of livres) await agendar(Corte, f2, hora);

// f3: combo que termina exatamente no início do almoço, cancelamento futuro e reagendamento encadeado.
await agendar(Combo, f3, '11:00');
await cancelar(await agendar(Corte, f3, '16:00'), 'Cliente desistiu.');
const cliente = clienteDaVez();
const original = await agendar(Corte, f3, '10:00', cliente);
total += 2; // os dois reagendamentos abaixo criam um agendamento novo cada
const r1 = await noRelogio(RELOGIO_ANTIGO, () => casos.reagendar(original.id, { data: f3, horaInicio: '14:00' }));
await noRelogio(RELOGIO_ANTIGO, () => casos.reagendar(r1.novo.id, { data: f4, horaInicio: '09:00' }));

// ---------- resumo ----------
console.log('Seed concluído.');
console.log(`  Arquivo:        ${arquivoDados}`);
console.log(`  Login:          ${email}  /  ${process.env.SEED_SENHA ? '(senha de SEED_SENHA)' : senha}`);
console.log(`  Clientes:       ${clientes.length}`);
console.log(`  Serviços:       ${Object.keys(servicos).length}`);
console.log(`  Agendamentos:   ${total} criados`);
console.log(`  Dia lotado:     ${f2} (${livres.length} cortes)`);
console.log(`  Reagendamento:  ${f3} 10:00 -> ${f3} 14:00 -> ${f4} 09:00`);
console.log('Troque a senha de teste antes de usar com dados reais.');
