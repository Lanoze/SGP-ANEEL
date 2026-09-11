import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/rbac';
import { createProjetoSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['GESTOR']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = createProjetoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim } = parsed.data;

    if (new Date(data_fim) <= new Date(data_inicio)) {
      return NextResponse.json({ error: 'Data fim deve ser posterior à data início' }, { status: 400 });
    }

    const existing = await queryOne('SELECT id FROM projetos WHERE codigo_aneel = $1', [codigo_aneel]);
    if (existing) {
      return NextResponse.json({ error: 'Código ANEEL já cadastrado' }, { status: 409 });
    }

    const projeto = await queryOne(
      `INSERT INTO projetos (codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [codigo_aneel, titulo, descricao || null, coordenador_id, data_inicio, data_fim]
    );

    const rubricas = ['RH', 'ST', 'MC', 'EP', 'VD', 'OU'];
    for (const rubrica of rubricas) {
      await query('INSERT INTO rubricas_projeto (projeto_id, rubrica, valor_previsto) VALUES ($1, $2, 0)', [projeto!.id, rubrica]);
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: auth.user.userId, acao: 'CREATE', tabela_origem: 'projetos', registro_id: String(projeto!.id), estado_posterior: { codigo_aneel, titulo }, endereco_ip: ip });

    return NextResponse.json(projeto, { status: 201 });
  } catch (error) {
    console.error('Create projeto error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const projetos = await query(
      `SELECT p.*, u.nome_completo as coordenador_nome
       FROM projetos p LEFT JOIN usuarios u ON p.coordenador_id = u.id
       ORDER BY p.criado_em DESC`
    );
    return NextResponse.json(projetos);
  } catch (error) {
    console.error('Get projetos error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
