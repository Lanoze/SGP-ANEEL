import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth, canAccessContratosRH } from '@/lib/rbac';
import type { DocumentoMetadados } from '@/types';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const meta = await queryOne<DocumentoMetadados>(
      `SELECT dm.* FROM documentos_metadados dm WHERE dm.id = $1`, [id]
    );
    if (!meta) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

    if (meta.categoria === 'CONTRATO_RH' && !canAccessContratosRH(auth.user.perfil)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const payload = await queryOne<{ conteudo_binario: Buffer }>(
      'SELECT conteudo_binario FROM documentos_payload WHERE documento_id = $1', [id]
    );
    if (!payload) return NextResponse.json({ error: 'Payload não encontrado' }, { status: 404 });

    const isInline = meta.mime_type === 'application/pdf' || meta.mime_type?.startsWith('image/');

    return new Response(new Uint8Array(payload.conteudo_binario), {
      headers: {
        'Content-Type': meta.mime_type,
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(meta.nome_arquivo)}"`,
        'Content-Length': String(meta.tamanho_bytes),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-SHA256': meta.hash_sha256,
      },
    });
  } catch (error) {
    console.error('Download documento error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
