import { query } from './db';
import type { JwtPayload } from './types';

export async function createAuditLog(params: {
  usuario_id?: string;
  acao: string;
  tabela_origem: string;
  registro_id?: string;
  estado_anterior?: Record<string, unknown>;
  estado_posterior?: Record<string, unknown>;
  endereco_ip?: string;
}): Promise<void> {
  await query(
    `INSERT INTO audit_logs (usuario_id, acao, tabela_origem, registro_id, estado_anterior, estado_posterior, endereco_ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.usuario_id || null,
      params.acao,
      params.tabela_origem,
      params.registro_id || null,
      params.estado_anterior ? JSON.stringify(params.estado_anterior) : null,
      params.estado_posterior ? JSON.stringify(params.estado_posterior) : null,
      params.endereco_ip || null,
    ]
  );
}
