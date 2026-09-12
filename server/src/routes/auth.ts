import { Router } from 'express';
import { authenticateUser, hashPassword } from '../lib/auth';
import { queryOne, query } from '../lib/db';
import { createAuditLog } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/rbac';
import { loginSchema, changePasswordSchema, resetPasswordSchema } from '../lib/schemas';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { email, senha } = parsed.data;
    const result = await authenticateUser(email, senha);
    if (!result) {
      res.status(401).json({ error: 'Email ou senha inválidos' });
      return;
    }
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email obrigatório' });
      return;
    }
    const user = await queryOne<{ id: string }>('SELECT id FROM usuarios WHERE email = $1 AND ativo = true', [email]);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({
      usuario_id: user?.id,
      acao: 'FORGOT_PASSWORD',
      tabela_origem: 'usuarios',
      registro_id: user?.id,
      endereco_ip: String(ip),
    });
    res.json({ message: 'Se o email estiver cadastrado, um gestor poderá redefinir sua senha.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { senha_atual, nova_senha } = parsed.data;
    const usuario = await queryOne<{ hash_senha: string }>('SELECT hash_senha FROM usuarios WHERE id = $1', [user.userId]);
    if (!usuario) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.default.compare(senha_atual, usuario.hash_senha);
    if (!valid) {
      res.status(401).json({ error: 'Senha atual incorreta' });
      return;
    }
    const newHash = await hashPassword(nova_senha);
    await query('UPDATE usuarios SET hash_senha = $1 WHERE id = $2', [newHash, user.userId]);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({ usuario_id: user.userId, acao: 'UPDATE_SENHA', tabela_origem: 'usuarios', registro_id: user.userId, endereco_ip: String(ip) });
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/reset-password', requireRole(['GESTOR']), async (req, res) => {
  try {
    const user = req.user!;
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { usuario_id, nova_senha } = parsed.data;
    const target = await queryOne<{ id: string }>('SELECT id FROM usuarios WHERE id = $1', [usuario_id]);
    if (!target) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    const newHash = await hashPassword(nova_senha);
    await query('UPDATE usuarios SET hash_senha = $1 WHERE id = $2', [newHash, usuario_id]);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({ usuario_id: user.userId, acao: 'RESET_SENHA', tabela_origem: 'usuarios', registro_id: usuario_id, endereco_ip: String(ip) });
    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
