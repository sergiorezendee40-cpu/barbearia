import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const raizServidor = fileURLToPath(new URL('..', import.meta.url));

/** Lê o arquivo .env (se existir) e devolve a configuração do servidor. */
export function carregarAmbiente() {
  try {
    process.loadEnvFile(path.join(raizServidor, '.env'));
  } catch {
    // Sem .env: usa só as variáveis do ambiente.
  }

  const producao = process.env.NODE_ENV === 'production';
  let segredoJwt = process.env.JWT_SECRET;
  if (!segredoJwt) {
    if (producao) throw new Error('Defina JWT_SECRET (pelo menos 16 caracteres) em produção.');
    segredoJwt = crypto.randomBytes(32).toString('hex');
    console.warn('Aviso: JWT_SECRET não definido. Usando um segredo temporário (os logins caem ao reiniciar).');
  }

  return {
    producao,
    porta: Number(process.env.PORT) || 3000,
    arquivoDados: process.env.DATA_FILE || path.join(raizServidor, 'data', 'barbearia.json'),
    segredoJwt,
    origensCors: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
