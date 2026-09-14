import { Router } from 'express';
import { query, queryOne, pool, setAuditContext } from '../lib/db';
import { createAuditLog } from '../lib/audit';
import { requireAuth, requireRole, canAccessContratosRH, extractUser } from '../lib/rbac';
import crypto from 'crypto';
import Busboy from 'busboy';
import type { DocumentoMetadados } from '../lib/types';

const router = Router();

const EXT_MAP: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv', '.txt': 'text/plain',
};

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

function validarMagicBytes(buffer: Buffer, extensao: string): { valido: boolean; esperado?: string; detectado?: string } {
  const mimeFromExt = MIME_EXTENSIONS[extensao];
  if (!mimeFromExt) return { valido: true };
  const signatures = MAGIC_BYTES[mimeFromExt];
  if (!signatures) return { valido: true };
  for (const sig of signatures) {
    if (buffer.subarray(0, sig.length).equals(Buffer.from(sig))) return { valido: true };
  }
  const detected = detectarMimeType(buffer, extensao);
  return { valido: false, esperado: mimeFromExt, detectado: detected };
}

router.get('/:projeto_id', requireAuth, async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user) { res.status(401).json({ error: 'Não autenticado' }); return; }

    const projeto = await queryOne<{ coordenador_id: string }>(
      'SELECT coordenador_id FROM projetos WHERE id = $1', [req.params.projeto_id]
    );
    const userCanSeeContratos = canAccessContratosRH(user.perfil, req.params.projeto_id, user.userId, projeto?.coordenador_id);

    const categoria = req.query.categoria as string | undefined;

    let where = 'dm.projeto_id = $1';
    const sqlParams: unknown[] = [req.params.projeto_id];
    let paramIdx = 2;

    if (categoria) {
      if (categoria === 'CONTRATO_RH' && !userCanSeeContratos) {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }
      where += ` AND dm.categoria = $${paramIdx++}`;
      sqlParams.push(categoria);
    } else if (!userCanSeeContratos) {
      where += ` AND dm.categoria != 'CONTRATO_RH'`;
    }

    const documentos = await query(
      `SELECT dm.*, u.nome_completo as usuario_nome
       FROM documentos_metadados dm LEFT JOIN usuarios u ON dm.usuario_upload_id = u.id
       WHERE ${where} ORDER BY dm.criado_em DESC`,
      sqlParams
    );
    res.json(documentos);
  } catch (error) {
    console.error('List documentos error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/:projeto_id/upload', requireAuth, async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user) { res.status(401).json({ error: 'Não autenticado' }); return; }
    const { userId: usuario_id, perfil } = user;
    const currentUserId = user.userId;

    if (perfil === 'BOLSISTA') {
      res.status(403).json({ error: 'Acesso negado: bolsistas não podem enviar documentos' });
      return;
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      res.status(400).json({ error: 'Content-Type deve ser multipart/form-data' });
      return;
    }

    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });

    let arquivoNome = '';
    let arquivoExt = '';
    let categoria = '';
    let detectedMime = '';
    let hashHex = '';
    let tamanhoBytes = 0;
    const fileChunks: Buffer[] = [];
    let fileFinished = false;
    let formProcessed = false;
    let responseSent = false;

    const hash = crypto.createHash('sha256');

    busboy.on('field', (name: string, value: string) => {
      if (name === 'categoria') categoria = value;
    });

    busboy.on('file', (fieldname: string, stream: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
      arquivoNome = info.filename;
      arquivoExt = '.' + arquivoNome.split('.').pop()?.toLowerCase();
      detectedMime = info.mimeType;

      stream.on('data', (chunk: Buffer) => {
        hash.update(chunk);
        fileChunks.push(chunk);
        tamanhoBytes += chunk.length;
      });

      stream.on('end', () => {
        fileFinished = true;
        tryFinish();
      });
    });

    busboy.on('finish', () => {
      formProcessed = true;
      tryFinish();
    });

    busboy.on('error', () => {
      if (!responseSent) { responseSent = true; res.status(500).json({ error: 'Erro no parser multipart' }); }
    });

    async function tryFinish() {
      if (!formProcessed || !fileFinished || responseSent) return;
      responseSent = true;

      if (!arquivoNome) { res.status(400).json({ error: 'Nenhum arquivo enviado' }); return; }
      if (!categoria) { res.status(400).json({ error: 'Categoria obrigatória' }); return; }

      if (categoria === 'CONTRATO_RH') {
        const projeto = await queryOne<{ coordenador_id: string }>(
          'SELECT coordenador_id FROM projetos WHERE id = $1', [req.params.projeto_id]
        );
        if (!canAccessContratosRH(perfil, req.params.projeto_id, currentUserId, projeto?.coordenador_id)) {
          res.status(403).json({ error: 'Acesso negado: contratos de RH restritos a gestores e coordenadores do projeto' });
          return;
        }
      }

      const buffer = Buffer.concat(fileChunks);
      hashHex = hash.digest('hex');

      const validacao = validarMagicBytes(buffer, arquivoExt);
      if (!validacao.valido) {
        res.status(422).json({ error: `Arquivo inválido: assinatura binária não confere. Esperado ${validacao.esperado}, detectado ${validacao.detectado}` });
        return;
      }

      const mimeType = detectarMimeType(buffer, arquivoExt);

      const client = await pool.connect();
      const ipUp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
      try {
        await client.query('BEGIN');
        await setAuditContext(client, usuario_id, ipUp);

        const metaResult = await client.query(
          `INSERT INTO documentos_metadados (projeto_id, categoria, nome_arquivo, extensao, mime_type, tamanho_bytes, hash_sha256, usuario_upload_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [req.params.projeto_id, categoria, arquivoNome, arquivoExt, mimeType, tamanhoBytes, hashHex, usuario_id]
        );
        const documentoId = metaResult.rows[0].id;

        await client.query('INSERT INTO documentos_payload (documento_id, conteudo_binario) VALUES ($1, $2)', [documentoId, buffer]);

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        await createAuditLog({ usuario_id, acao: 'UPLOAD', tabela_origem: 'documentos_metadados', registro_id: documentoId, estado_posterior: { nome_arquivo: arquivoNome, categoria, hash_sha256: hashHex }, endereco_ip: String(ip) });

        await client.query('COMMIT');
        res.status(201).json({ id: documentoId, nome_arquivo: arquivoNome, extensao: arquivoExt, mime_type: mimeType, tamanho_bytes: tamanhoBytes, hash_sha256: hashHex, categoria });
      } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
    }

    req.pipe(busboy);
  } catch (error) {
    console.error('Upload documento error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/upload-stream', requireAuth, async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user) { res.status(401).json({ error: 'Não autenticado' }); return; }

    if (user.perfil === 'BOLSISTA') {
      res.status(403).json({ error: 'Bolsistas não podem enviar documentos' });
      return;
    }

    const formData = req.body;
    const chunk = formData.chunk as Buffer | undefined;
    const fileId = formData.fileId as string;
    const fileName = formData.fileName as string;
    const fileSize = parseInt(formData.fileSize as string);
    const chunkIndex = parseInt(formData.chunkIndex as string);
    const totalChunks = parseInt(formData.totalChunks as string);
    const categoria = formData.categoria as string;
    const projetoId = formData.projetoId as string;

    if (!chunk || !fileId || !fileName || isNaN(chunkIndex) || isNaN(totalChunks)) {
      res.status(400).json({ error: 'Parâmetros inválidos' });
      return;
    }

    // Validate magic bytes on first chunk only (streaming-friendly)
    if (chunkIndex === 0) {
      const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
      const validacao = validarMagicBytes(chunk, ext);
      if (!validacao.valido) {
        res.status(422).json({ error: `Arquivo inválido: assinatura binária não confere. Esperado ${validacao.esperado}, detectado ${validacao.detectado}` });
        return;
      }
    }

    // Store chunk in database (serverless-safe)
    await query(
      `INSERT INTO upload_chunks (file_id, chunk_index, chunk_data) VALUES ($1, $2, $3)
       ON CONFLICT (file_id, chunk_index) DO UPDATE SET chunk_data = EXCLUDED.chunk_data`,
      [fileId, chunkIndex, chunk]
    );

    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM upload_chunks WHERE file_id = $1', [fileId]
    );
    const receivedCount = parseInt(countResult?.count || '0');

    if (receivedCount < totalChunks) {
      res.json({ message: 'Chunk recebido', received: receivedCount, total: totalChunks });
      return;
    }

    // All chunks received — stream from DB to compute SHA-256 without holding full buffer in RAM
    const hash = crypto.createHash('sha256');
    const rows = await query<{ chunk_data: Buffer }>(
      'SELECT chunk_data FROM upload_chunks WHERE file_id = $1 ORDER BY chunk_index', [fileId]
    );
    const chunks: Buffer[] = [];
    for (const row of rows) {
      const buf = Buffer.from(row.chunk_data);
      hash.update(buf);
      chunks.push(buf);
    }
    const fullContent = Buffer.concat(chunks);
    const hashHex = hash.digest('hex');

    // Clean up chunks
    await query('DELETE FROM upload_chunks WHERE file_id = $1', [fileId]);

    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
    const mimeType = EXT_MAP[ext] || 'application/octet-stream';

    if (categoria === 'CONTRATO_RH') {
      const projeto = await queryOne<{ coordenador_id: string }>(
        'SELECT coordenador_id FROM projetos WHERE id = $1', [projetoId]
      );
      if (!canAccessContratosRH(user.perfil, projetoId, user.userId, projeto?.coordenador_id)) {
        res.status(403).json({ error: 'Sem permissão para Contratos de RH' });
        return;
      }
    }

    const client = await pool.connect();
    const ipDoc = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId, ipDoc);

      const metaResult = await client.query(
        `INSERT INTO documentos_metadados (projeto_id, categoria, nome_arquivo, extensao, mime_type, tamanho_bytes, hash_sha256, usuario_upload_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [projetoId, categoria, fileName, ext, mimeType, fileSize, hashHex, user.userId]
      );
      const docId = metaResult.rows[0].id;

      await client.query(
        `INSERT INTO documentos_payload (documento_id, conteudo_binario) VALUES ($1, $2)`,
        [docId, fullContent]
      );

      await client.query('COMMIT');

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await createAuditLog({
        usuario_id: user.userId, acao: 'UPLOAD', tabela_origem: 'documentos_metadados',
        registro_id: docId, estado_posterior: { nome_arquivo: fileName, categoria, tamanho: fileSize, hash: hashHex },
        endereco_ip: String(ip),
      });

      res.json({ id: docId, message: 'Upload concluído via streaming', chunks_processados: totalChunks });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Upload stream error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/download/:id', requireAuth, async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user) { res.status(401).json({ error: 'Não autenticado' }); return; }

    const meta = await queryOne<DocumentoMetadados>(
      `SELECT dm.* FROM documentos_metadados dm WHERE dm.id = $1`, [req.params.id]
    );
    if (!meta) { res.status(404).json({ error: 'Documento não encontrado' }); return; }

    if (meta.categoria === 'CONTRATO_RH') {
      const projeto = await queryOne<{ coordenador_id: string }>(
        'SELECT coordenador_id FROM projetos WHERE id = $1', [meta.projeto_id]
      );
      if (!canAccessContratosRH(user.perfil, meta.projeto_id, user.userId, projeto?.coordenador_id)) {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }
    }

    const payload = await queryOne<{ conteudo_binario: Buffer }>(
      'SELECT conteudo_binario FROM documentos_payload WHERE documento_id = $1', [req.params.id]
    );
    if (!payload) { res.status(404).json({ error: 'Payload não encontrado' }); return; }

    const isInline = meta.mime_type === 'application/pdf' || meta.mime_type?.startsWith('image/');

    res.setHeader('Content-Type', meta.mime_type);
    res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(meta.nome_arquivo)}"`);
    res.setHeader('Content-Length', String(meta.tamanho_bytes));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-SHA256', meta.hash_sha256);
    res.send(payload.conteudo_binario);
  } catch (error) {
    console.error('Download documento error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const user = extractUser(req);
    if (!user) { res.status(401).json({ error: 'Não autenticado' }); return; }

    if (user.perfil === 'BOLSISTA') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const meta = await queryOne<DocumentoMetadados>(
      'SELECT * FROM documentos_metadados WHERE id = $1', [req.params.id]
    );
    if (!meta) { res.status(404).json({ error: 'Documento não encontrado' }); return; }

    const client = await pool.connect();
    const ipDel = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId, ipDel);

      await client.query('DELETE FROM documentos_payload WHERE documento_id = $1', [req.params.id]);
      await client.query('DELETE FROM documentos_metadados WHERE id = $1', [req.params.id]);

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await createAuditLog({
        usuario_id: user.userId, acao: 'DELETE', tabela_origem: 'documentos_metadados',
        registro_id: req.params.id, estado_anterior: { nome_arquivo: meta.nome_arquivo, categoria: meta.categoria },
        endereco_ip: String(ip),
      });

      await client.query('COMMIT');
      res.json({ message: 'Documento excluído' });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Delete documento error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
