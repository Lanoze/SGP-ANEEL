import { NextResponse } from 'next/server';
import { requireAuth, canAccessContratosRHForProject } from '@/lib/rbac';
import { queryOne, pool } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import crypto from 'crypto';

const EXT_MAP: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv', '.txt': 'text/plain',
};

const chunkBuffers = new Map<string, { chunks: Buffer[]; totalChunks: number; fileName: string; fileSize: number; projetoId: string; categoria: string }>();

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    if (auth.user.perfil === 'BOLSISTA') {
      return NextResponse.json({ error: 'Bolsistas não podem enviar documentos' }, { status: 403 });
    }

    const formData = await request.formData();
    const chunk = formData.get('chunk') as File | null;
    const fileId = formData.get('fileId') as string;
    const fileName = formData.get('fileName') as string;
    const fileSize = parseInt(formData.get('fileSize') as string);
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const categoria = formData.get('categoria') as string;
    const projetoId = formData.get('projetoId') as string;

    if (!chunk || !fileId || !fileName || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());

    if (!chunkBuffers.has(fileId)) {
      chunkBuffers.set(fileId, { chunks: [], totalChunks, fileName, fileSize, projetoId, categoria });
    }
    const state = chunkBuffers.get(fileId)!;
    state.chunks[chunkIndex] = chunkBuffer;

    const receivedCount = state.chunks.filter((c) => c !== undefined).length;

    if (receivedCount < totalChunks) {
      return NextResponse.json({ message: 'Chunk recebido', received: receivedCount, total: totalChunks });
    }

    const fullContent = Buffer.concat(state.chunks);
    chunkBuffers.delete(fileId);

    const hash = crypto.createHash('sha256').update(fullContent).digest('hex');
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
    const mimeType = EXT_MAP[ext] || 'application/octet-stream';

    if (categoria === 'CONTRATO_RH' && !(await canAccessContratosRHForProject(auth.user.perfil, projetoId, auth.user.userId))) {
      return NextResponse.json({ error: 'Sem permissão para Contratos de RH' }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const metaResult = await client.query(
        `INSERT INTO documentos_metadados (projeto_id, categoria, nome_arquivo, extensao, mime_type, tamanho_bytes, hash_sha256, usuario_upload_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [projetoId, categoria, fileName, ext, mimeType, fileSize, hash, auth.user.userId]
      );
      const docId = metaResult.rows[0].id;

      await client.query(
        `INSERT INTO documentos_payload (documento_id, conteudo_binario) VALUES ($1, $2)`,
        [docId, fullContent]
      );

      await client.query('COMMIT');

      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      await createAuditLog({
        usuario_id: auth.user.userId, acao: 'UPLOAD', tabela_origem: 'documentos_metadados',
        registro_id: docId, estado_posterior: { nome_arquivo: fileName, categoria, tamanho: fileSize, hash },
        endereco_ip: ip,
      });

      return NextResponse.json({ id: docId, message: 'Upload concluído via streaming', chunks_processados: totalChunks });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Upload stream error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
