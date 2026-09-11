import { NextResponse } from 'next/server';
import { query, pool } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tabela_origem = url.searchParams.get('tabela_origem');
    const registro_id = url.searchParams.get('registro_id');
    const usuario_id = url.searchParams.get('usuario_id');

    let where = '1=1';
    const sqlParams: unknown[] = [];
    let paramIdx = 1;

    if (tabela_origem) { where += ` AND al.tabela_origem = $${paramIdx++}`; sqlParams.push(tabela_origem); }
    if (registro_id) { where += ` AND al.registro_id = $${paramIdx++}`; sqlParams.push(registro_id); }
    if (usuario_id) { where += ` AND al.usuario_id = $${paramIdx++}`; sqlParams.push(usuario_id); }

    const logs = await query(
      `SELECT al.*, u.nome_completo as usuario_nome
       FROM audit_logs al LEFT JOIN usuarios u ON al.usuario_id = u.id
       WHERE ${where} ORDER BY al.criado_em DESC LIMIT 200`,
      sqlParams
    );
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
