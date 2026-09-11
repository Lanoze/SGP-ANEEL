import { NextResponse } from 'next/server';
import { queryOne, pool } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import crypto from 'crypto';

const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4b, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4b, 0x03, 0x04]],
};

const MIME_EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain', '.csv': 'text/csv',
};

function detectarMimeType(buffer: Buffer, extensao: string): string {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (buffer.subarray(0, sig.length).equals(Buffer.from(sig))) return mime;
    }
  }
  return MIME_EXTENSIONS[extensao] || 'application/octet-stream';
}

export async function POST(request: Request, { params }: { params: Promise<{ projeto_id: string }> }) {
  try {
    const { projeto_id } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    const { verifyToken } = await import('@/lib/auth');
    const payload = token ? verifyToken(token) : null;
    const usuario_id = payload?.userId;

    const formData = await request.formData();
    const arquivo = formData.get('arquivo') as File | null;
    const categoria = formData.get('categoria') as string;

    if (!arquivo) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    if (!categoria) return NextResponse.json({ error: 'Categoria obrigatória' }, { status: 400 });

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const extensao = '.' + arquivo.name.split('.').pop()?.toLowerCase();
    const mimeType = detectarMimeType(buffer, extensao);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const metaResult = await client.query(
        `INSERT INTO documentos_metadados (projeto_id, categoria, nome_arquivo, extensao, mime_type, tamanho_bytes, hash_sha256, usuario_upload_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [projeto_id, categoria, arquivo.name, extensao, mimeType, arquivo.size, hash, usuario_id]
      );
      const documentoId = metaResult.rows[0].id;

      await client.query('INSERT INTO documentos_payload (documento_id, conteudo_binario) VALUES ($1, $2)', [documentoId, buffer]);

      await createAuditLog({ usuario_id, acao: 'UPLOAD', tabela_origem: 'documentos_metadados', registro_id: documentoId, estado_posterior: { nome_arquivo: arquivo.name, categoria, hash_sha256: hash } });

      await client.query('COMMIT');
      return NextResponse.json({ id: documentoId, nome_arquivo: arquivo.name, extensao, mime_type: mimeType, tamanho_bytes: arquivo.size, hash_sha256: hash, categoria }, { status: 201 });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Upload documento error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
