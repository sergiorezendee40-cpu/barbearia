import { z } from 'zod';
import { hashSenha } from './auth.js';

const esquema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto.').max(100),
  email: z.email('E-mail inválido.'),
  senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(200),
});

/** Cria o usuário do barbeiro (senha guardada só como hash). Lança Error com mensagem legível. */
export async function criarUsuario(repos, entrada) {
  const r = esquema.safeParse(entrada);
  if (!r.success) {
    throw new Error(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const { nome, senha } = r.data;
  const email = r.data.email.toLowerCase();
  if (await repos.usuarios.buscarPorEmail(email)) {
    throw new Error('Já existe um usuário com esse e-mail.');
  }
  return repos.usuarios.criar({ nome, email, senhaHash: await hashSenha(senha) });
}
