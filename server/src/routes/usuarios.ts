import { Router } from 'express';
import { query, queryOne } from '../lib/db';
import { createAuditLog } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/rbac';
import { hashPassword } from '../lib/auth';
import { createUsuarioSchema } from '../lib/schemas';
import type { Usuario } from '../lib/types';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const usuarios = await query<Omit<Usuario, 'hash_senha'>>(
      'SELECT id, nome_completo, cpf, email, perfil, ativo, criado_em FROM usuarios ORDER BY criado_em DESC'
    );
    res.json(usuarios);
  } catch (error) {
    console.error('List usuarios error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/', requireRole(['GESTOR']), async (req, res) => {
  try {
    const user = req.user!;
    const parsed = createUsuarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { nome_completo, cpf, email, senha, perfil } = parsed.data;
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE cpf = $1 OR email = $2', [cpf, email]
    );
    if (existing) {
      res.status(409).json({ error: 'CPF ou email já cadastrado' });
      return;
    }
    const hash = await hashPassword(senha);
    const result = await queryOne<{ id: string }>(
      `INSERT INTO usuarios (nome_completo, cpf, email, hash_senha, perfil)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [nome_completo, cpf, email, hash, perfil]
    );
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({ usuario_id: user.userId, acao: 'CREATE', tabela_origem: 'usuarios', registro_id: result!.id, estado_posterior: { nome_completo, cpf, email, perfil }, endereco_ip: String(ip) });
    res.status(201).json({ id: result!.id, nome_completo, cpf, email, perfil });
  } catch (error) {
    console.error('Create usuario error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const usuario = await queryOne<Omit<Usuario, 'hash_senha'>>(
      'SELECT id, nome_completo, cpf, email, perfil, ativo, criado_em FROM usuarios WHERE id = $1',
      [req.params.id]
    );
    if (!usuario) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    res.json(usuario);
  } catch (error) {
    console.error('Get usuario error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/:id', requireRole(['GESTOR']), async (req, res) => {
  try {
    const user = req.user!;
    const existing = await queryOne<Usuario>('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
    if (!existing) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }

    const { nome_completo, email, perfil, ativo } = req.body as Partial<Pick<Usuario, 'nome_completo' | 'email' | 'perfil' | 'ativo'>>;
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (nome_completo !== undefined) { updates.push(`nome_completo = $${idx++}`); values.push(nome_completo); }
    if (email !== undefined) { updates.push(`email = $${idx++}`); values.push(email); }
    if (perfil !== undefined) { updates.push(`perfil = $${idx++}`); values.push(perfil); }
    if (ativo !== undefined) { updates.push(`ativo = $${idx++}`); values.push(ativo); }

    if (updates.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }

    values.push(req.params.id);
    await query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({ usuario_id: user.userId, acao: 'UPDATE', tabela_origem: 'usuarios', registro_id: req.params.id, estado_anterior: { nome_completo: existing.nome_completo, email: existing.email, perfil: existing.perfil, ativo: existing.ativo }, estado_posterior: { nome_completo, email, perfil, ativo }, endereco_ip: String(ip) });
    res.json({ message: 'Usuário atualizado' });
  } catch (error) {
    console.error('Update usuario error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/:id', requireRole(['GESTOR']), async (req, res) => {
  try {
    const user = req.user!;
    if (req.params.id === user.userId) { res.status(400).json({ error: 'Não é possível excluir seu próprio usuário' }); return; }

    const existing = await queryOne<Usuario>('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
    if (!existing) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }

    await query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({ usuario_id: user.userId, acao: 'DELETE', tabela_origem: 'usuarios', registro_id: req.params.id, estado_anterior: { nome_completo: existing.nome_completo, email: existing.email, perfil: existing.perfil }, endereco_ip: String(ip) });
    res.json({ message: 'Usuário excluído' });
  } catch (error) {
    console.error('Delete usuario error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
