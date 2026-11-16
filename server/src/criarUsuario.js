// Uso: npm run criar-usuario -- email@exemplo.com "Nome do Barbeiro"
// A senha é pedida no terminal (sem aparecer na tela) ou lida de ADMIN_SENHA.

import readline from 'node:readline';
import { carregarAmbiente } from './ambiente.js';
import { criarRepositorios } from './repository/index.js';
import { criarUsuario } from './usuarios.js';

function perguntarSenha(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const escrever = rl._writeToOutput.bind(rl);
    let mudo = false;
    rl._writeToOutput = (texto) => {
      if (!mudo) escrever(texto);
    };
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stdout.write('\n');
      resolve(resposta);
    });
    mudo = true;
  });
}

const [email, nome] = process.argv.slice(2);
if (!email || !nome) {
  console.error('Uso: npm run criar-usuario -- email@exemplo.com "Nome do Barbeiro"');
  process.exit(1);
}

const { arquivoDados } = carregarAmbiente();
const repos = criarRepositorios({ arquivo: arquivoDados });
const senha = process.env.ADMIN_SENHA || (await perguntarSenha('Senha (mínimo 8 caracteres): '));

try {
  const usuario = await criarUsuario(repos, { nome, email, senha });
  console.log(`Usuário criado: ${usuario.email}`);
} catch (erro) {
  console.error(`Não foi possível criar o usuário: ${erro.message}`);
  process.exit(1);
}
