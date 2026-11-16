import fs from 'node:fs';
import path from 'node:path';

const vazio = () => ({ usuarios: [], clientes: [], servicos: [], agendamentos: [], configuracao: null });

/**
 * Armazenamento em arquivo JSON (MVP). Com `arquivo = null` funciona só em memória (testes).
 * A gravação é atômica: escreve um arquivo temporário e renomeia, para não corromper
 * o arquivo se o processo cair no meio.
 *
 * TODO(DB): este módulo inteiro some quando migrarmos para SQLite/PostgreSQL
 * (ex.: Prisma). Só a pasta `repository/` muda; regras e rotas continuam iguais.
 */
export function criarArmazenamento(arquivo = null) {
  const dados = vazio();

  if (arquivo && fs.existsSync(arquivo)) {
    Object.assign(dados, JSON.parse(fs.readFileSync(arquivo, 'utf8')));
  }

  function salvar() {
    if (!arquivo) return;
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    const temporario = `${arquivo}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2));
    fs.renameSync(temporario, arquivo);
  }

  function limpar() {
    Object.assign(dados, vazio());
    salvar();
  }

  return { dados, salvar, limpar };
}
