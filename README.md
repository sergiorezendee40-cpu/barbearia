# Sistema de Agendamento - Barbearia

Aplicação para o barbeiro gerenciar a agenda (um barbeiro, só ele usa o sistema).
Stack: Node.js + Express no back-end; React + Vite + Tailwind no front-end.

Status da Fase 1:

| Etapa | Situação |
|---|---|
| Servidor, repository em JSON | feito |
| Regras de agenda com testes | feito |
| Login, clientes, serviços, agendar/cancelar/reagendar/concluir | feito |
| Seed de dados de teste | feito |
| Front: login e agenda do dia (novo agendamento, detalhes, concluir, cancelar, reagendar, WhatsApp) | feito |
| Front: tela de clientes (lista e histórico) | próxima etapa |
| Front: tela de configurações (serviços, preços, horários, feriados extras) | próxima etapa |
| Agenda semanal | próxima etapa |
| Testes E2E (Playwright) como arquivos do projeto | próxima etapa |

## Como rodar

São dois programas: a API (porta 3000) e o front (porta 5173). Use dois terminais.

```bash
# terminal 1: API
cd server
npm install
cp .env.example .env        # defina JWT_SECRET
npm run seed                # dados de teste + usuário de login
npm run dev                 # http://localhost:3000

# terminal 2: front
cd client
npm install
npm run dev                 # http://localhost:5173  (abra no navegador)
```

O front fala com a API por `/api` (o Vite encaminha para a porta 3000; ver `client/vite.config.js`).
Se a API estiver em outro endereço: `API_URL=http://localhost:4000 npm run dev`.
Testes do front: `cd client && npm test`.

Login de teste do seed: `barbeiro@exemplo.com` / `barbearia123` (troque a senha antes de usar com dados reais).
Para criar o usuário real, sem seed: `npm run criar-usuario -- email@exemplo.com "Nome"`.

| Comando | O que faz |
|---|---|
| `npm test` | roda todos os testes (Vitest) |
| `npm run seed` | popula dados de teste (não duplica se já houver dados) |
| `npm run seed:reset` | **apaga tudo** e recria os dados de teste |
| `npm run criar-usuario` | cria o usuário do barbeiro (senha pedida no terminal) |

O seed gera, entre outros casos de borda: dia lotado, combo às 19:00 (último horário), combo terminando às 12:00 (início do almoço),
reagendamento encadeado e cancelamentos com motivo. Ele recusa rodar com `NODE_ENV=production`.

## Regras de negócio (resumo)

- Segunda a sábado, 08:00 às 20:00, grade de 30 min. Domingo é folga.
- Almoço bloqueado das 12:00 às 13:00. Nenhum atendimento começa nem passa por dentro dele.
- Não abre em feriados nacionais (calculados pelo sistema, inclusive a Sexta-feira Santa). Datas extras vão em `feriadosExtras`, nas configurações.
- Corte 30 min (R$ 40), barba 20 min (R$ 20), combo 50 min (R$ 60). Cada atendimento ocupa slots inteiros: corte e barba 1, combo 2.
- Antecedência mínima para agendar: 60 min. Para cancelar, 120 min, mas é só **aviso**: abaixo disso a API pede `confirmarForaDoPrazo: true`.
- Cancelar exige motivo. Cancelados e reagendados ficam no histórico e liberam o horário.
- Reagendar marca o original como `reagendado` e cria um novo com `agendamentoOriginalId`.
- Não existe bloqueio de cliente por cancelamentos.

## API

Tudo exige `Authorization: Bearer <token>`, exceto `/saude` e `/auth/login`. Erros vêm como `{ "erro": "CODIGO", "mensagem": "..." }`.

| Método | Rota | Função |
|---|---|---|
| POST | `/auth/login` | login (limite de 10 tentativas por 15 min) |
| GET | `/auth/eu` | dados do usuário logado |
| GET/POST | `/clientes` | lista (`?busca=`) / cadastra |
| GET/PUT | `/clientes/:id` | detalhe / edita |
| GET | `/clientes/:id/agendamentos` | histórico do cliente com resumo (inclui cancelamentos, só para consulta) |
| GET/POST/PUT | `/servicos` | gerencia serviços |
| GET/PUT | `/configuracoes` | lê / altera configurações |
| GET | `/agendamentos?data=` ou `?inicio=&fim=` | agenda do dia ou do período |
| POST | `/agendamentos` | cria |
| POST | `/agendamentos/:id/cancelar` | cancela (`motivo`, `confirmarForaDoPrazo`) |
| POST | `/agendamentos/:id/reagendar` | reagenda (`data`, `horaInicio`, `servicoId?`) |
| POST | `/agendamentos/:id/concluir` | conclui (só depois do início) |
| GET | `/agendamentos/:id/whatsapp?tipo=` | mensagem pronta + link `wa.me` |
| GET | `/disponibilidade?data=&servicoId=` | horários livres |

## Estrutura

```
server/src/
  regras/         funções puras (tempo, feriados, agenda, whatsapp), sem banco nem relógio
  casosDeUso/     junta regras + repository
  repository/     único lugar que toca nos dados (JSON hoje; cada função tem TODO(DB))
  rotas/          rotas finas, com validação Zod
  validacao/      esquemas de entrada
  seed.js  criarUsuario.js  server.js  app.js
server/tests/     Vitest + Supertest
```

## Migrar para banco de dados

Só a pasta `repository/` muda: reescreva `criarRepositorios` com SQLite/PostgreSQL (Prisma, por exemplo) mantendo as mesmas funções.
Os comentários `TODO(DB)` trazem a consulta equivalente de cada uma. Ao migrar:

- Troque a checagem de conflito de horário por uma restrição/transação no banco. Com o arquivo JSON ela é segura porque
  validar e gravar acontecem sem pausa no mesmo processo; com vários processos isso deixa de valer.
- Guarde o preço do serviço no agendamento (snapshot), para o histórico não mudar quando o preço mudar.

## Front-end (client)

```
client/src/
  lib/          api.js (único lugar que chama o servidor), tempo.js, formatar.js,
                linhaDoTempo.js (lógica da agenda em funções puras, com testes)
  auth/         login e sessão (token)
  pages/        Login, Agenda
  components/   LinhaDoTempo, NovoAgendamento, DetalheAgendamento, Dialogo, Avisos...
```

Decisões:
- Datas e horas são strings (`2026-11-05`, `14:30`) no fuso de São Paulo, como no servidor. Por isso não usa date-fns.
- O tamanho de cada atendimento na tela é proporcional à duração (combo ocupa 2 linhas de 30 min).
- Faixas diagonais (o "poste de barbeiro") marcam o que está fora do jogo: almoço e dias fechados.
- Os formulários são poucos e simples e a validação mora no servidor (Zod); o front mostra as mensagens dele.
  Quando houver mais formulários (clientes, configurações), vale adotar React Hook Form + Zod.
- Acessibilidade: diálogos nativos (`<dialog>`: foco preso, Esc fecha), foco visível, alvos de toque de 44 px, mensagens com `aria-live`.

## Segurança

- O token de login fica no `localStorage` do navegador, para a sessão sobreviver a recarregar a página. Contrapartida: um XSS
  conseguiria lê-lo; por isso o token expira em 8 h e o React escapa todo texto. Para uso comercial, o ideal é cookie `HttpOnly`.

- Senhas só como hash (bcrypt); login com limite de tentativas e resposta igual para e-mail inexistente ou senha errada.
- Token JWT com expiração de 8 h; toda entrada validada no servidor com Zod.
- Os dados de clientes são dados pessoais: `server/data/` fica fora do Git. Se for vender o sistema, a LGPD precisa ser tratada.
