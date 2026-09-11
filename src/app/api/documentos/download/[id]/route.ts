import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const meta = await queryOne(
      `SELECT dm.* FROM documentos_metadados dm WHERE dm.id = $1`, [id]
    );
    if (!meta) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

    const payload = await queryOne<{ conteudo_binario: Buffer }>(
      'SELECT conteudo_binario FROM documentos_payload WHERE documento_id = $1', [id]
    );
    if (!payload) return NextResponse.json({ error: 'Payload não encontrado' }, { status: 404 });

    const isInline = (meta as any).mime_type === 'application/pdf' || (meta as any).mime_type?.startsWith('image/');

    return new Response(new Uint8Array(payload.conteudo_binario), {
      headers: {
        'Content-Type': (meta as any).mime_type,
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent((meta as any).nome_arquivo)}"`,
        'Content-Length': String((meta as any).tamanho_bytes),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-SHA256': (meta as any).hash_sha256,
      },
    });
  } catch (error) {
    console.error('Download documento error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
