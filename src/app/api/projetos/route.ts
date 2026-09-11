import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim } = body;

    if (!codigo_aneel || !titulo || !coordenador_id || !data_inicio || !data_fim) {
      return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 });
    }

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

    await createAuditLog({ acao: 'CREATE', tabela_origem: 'projetos', registro_id: String(projeto!.id), estado_posterior: { codigo_aneel, titulo } });

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
