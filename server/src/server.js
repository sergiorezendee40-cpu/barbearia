import { carregarAmbiente } from './ambiente.js';
import { criarApp } from './app.js';
import { criarRepositorios } from './repository/index.js';

const { porta, arquivoDados, segredoJwt, origensCors } = carregarAmbiente();

const repos = criarRepositorios({ arquivo: arquivoDados });
const app = criarApp({ repos, segredoJwt, origensCors });

app.listen(porta, async () => {
  console.log(`API da barbearia rodando em http://localhost:${porta}`);
  console.log(`Dados em: ${arquivoDados}`);
  if ((await repos.usuarios.contar()) === 0) {
    console.log('Nenhum usuário cadastrado. Rode: npm run criar-usuario -- email "Nome"  (ou npm run seed)');
  }
});
