import { pool } from './db';

const DDL = `
-- ============================================================
-- SGP-ANEEL DDL — PostgreSQL 16 / Neon
-- ============================================================

-- 1. TABELA: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo VARCHAR(255) NOT NULL,
  cpf          VARCHAR(11) UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  hash_senha   VARCHAR(255) NOT NULL,
  perfil       VARCHAR(20) NOT NULL CHECK (perfil IN ('GESTOR','COORDENADOR','PESQUISADOR','BOLSISTA')),
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA: projetos
CREATE TABLE IF NOT EXISTS projetos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_aneel    VARCHAR(50) UNIQUE NOT NULL,
  titulo          VARCHAR(500) NOT NULL,
  descricao       TEXT,
  coordenador_id  UUID NOT NULL REFERENCES usuarios(id),
  data_inicio     DATE NOT NULL,
  data_fim        DATE NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA: rubricas_projeto
CREATE TABLE IF NOT EXISTS rubricas_projeto (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id      UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  rubrica         VARCHAR(2) NOT NULL CHECK (rubrica IN ('RH','ST','MC','EP','VD','OU')),
  valor_previsto  NUMERIC(15,2) NOT NULL DEFAULT 0,
  UNIQUE (projeto_id, rubrica)
);

-- 4. TABELA: lancamentos
CREATE TABLE IF NOT EXISTS lancamentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubrica_projeto_id  UUID NOT NULL REFERENCES rubricas_projeto(id) ON DELETE CASCADE,
  descricao           VARCHAR(500) NOT NULL,
  valor               NUMERIC(15,2) NOT NULL,
  data_despesa        DATE NOT NULL,
  usuario_registro_id UUID NOT NULL REFERENCES usuarios(id),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABELA: alocacao_rh
CREATE TABLE IF NOT EXISTS alocacao_rh (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id               UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  usuario_id               UUID NOT NULL REFERENCES usuarios(id),
  papel_projeto            VARCHAR(20) NOT NULL CHECK (papel_projeto IN ('GESTOR','COORDENADOR','PESQUISADOR','BOLSISTA')),
  nivel_academico          VARCHAR(100) NOT NULL,
  valor_nominal_capes      NUMERIC(15,2) NOT NULL,
  nivel_complemento        INTEGER NOT NULL DEFAULT 0 CHECK (nivel_complemento BETWEEN 0 AND 3),
  valor_mensal_calculado   NUMERIC(15,2) NOT NULL,
  UNIQUE (projeto_id, usuario_id)
);

-- 6. TABELA: competencias_folha
CREATE TABLE IF NOT EXISTS competencias_folha (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alocacao_rh_id   UUID NOT NULL REFERENCES alocacao_rh(id) ON DELETE CASCADE,
  ano              INTEGER NOT NULL,
  mes              INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor_devido     NUMERIC(15,2) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','PAGO','CANCELADO')),
  data_baixa       TIMESTAMPTZ,
  usuario_baixa_id UUID REFERENCES usuarios(id),
  UNIQUE (alocacao_rh_id, ano, mes)
);

-- 7. TABELA: documentos_metadados
CREATE TABLE IF NOT EXISTS documentos_metadados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id        UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  categoria         VARCHAR(50) NOT NULL CHECK (categoria IN ('CONTRATO_RH','COMPROVANTE_LANCAMENTO','RELATORIO_TECNICO','GERAL')),
  nome_arquivo      VARCHAR(500) NOT NULL,
  extensao          VARCHAR(20) NOT NULL,
  mime_type         VARCHAR(100) NOT NULL,
  tamanho_bytes     BIGINT NOT NULL,
  hash_sha256       VARCHAR(64) NOT NULL,
  usuario_upload_id UUID NOT NULL REFERENCES usuarios(id),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABELA: documentos_payload (TOAST / BYTEA)
CREATE TABLE IF NOT EXISTS documentos_payload (
  documento_id     UUID PRIMARY KEY REFERENCES documentos_metadados(id) ON DELETE CASCADE,
  conteudo_binario BYTEA NOT NULL
) WITH (toast_tuple_target = 128);

ALTER TABLE documentos_payload ALTER COLUMN conteudo_binario SET STORAGE EXTENDED;

-- 9. TABELA: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id               BIGSERIAL PRIMARY KEY,
  usuario_id       UUID REFERENCES usuarios(id),
  acao             VARCHAR(50) NOT NULL,
  tabela_origem    VARCHAR(100) NOT NULL,
  registro_id      UUID,
  estado_anterior  JSONB,
  estado_posterior JSONB,
  endereco_ip      VARCHAR(45),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES B-TREE (padrão PostgreSQL)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projetos_coordenador    ON projetos (coordenador_id);
CREATE INDEX IF NOT EXISTS idx_rubricas_projeto        ON rubricas_projeto (projeto_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_rubrica     ON lancamentos (rubrica_projeto_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario     ON lancamentos (usuario_registro_id);
CREATE INDEX IF NOT EXISTS idx_alocacao_projeto        ON alocacao_rh (projeto_id);
CREATE INDEX IF NOT EXISTS idx_alocacao_usuario        ON alocacao_rh (usuario_id);
CREATE INDEX IF NOT EXISTS idx_competencias_alocacao   ON competencias_folha (alocacao_rh_id);
CREATE INDEX IF NOT EXISTS idx_competencias_status     ON competencias_folha (status);
CREATE INDEX IF NOT EXISTS idx_documentos_projeto      ON documentos_metadados (projeto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_categoria    ON documentos_metadados (categoria);
CREATE INDEX IF NOT EXISTS idx_audit_usuario           ON audit_logs (usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabela            ON audit_logs (tabela_origem);
CREATE INDEX IF NOT EXISTS idx_audit_criado            ON audit_logs (criado_em);

-- ============================================================
-- TRIGGERS DE AUDITORIA (PL/pgSQL)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id UUID;
  v_estado_anterior JSONB;
  v_estado_posterior JSONB;
  v_registro_id UUID;
  v_ip TEXT;
BEGIN
  v_usuario_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  v_ip         := current_setting('app.current_ip', true);

  IF TG_OP = 'INSERT' THEN
    v_registro_id    := NEW.id;
    v_estado_anterior := NULL;
    v_estado_posterior := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id    := NEW.id;
    v_estado_anterior := to_jsonb(OLD);
    v_estado_posterior := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_registro_id    := OLD.id;
    v_estado_anterior := to_jsonb(OLD);
    v_estado_posterior := NULL;
  END IF;

  INSERT INTO audit_logs (usuario_id, acao, tabela_origem, registro_id, estado_anterior, estado_posterior, endereco_ip)
  VALUES (v_usuario_id, TG_OP, TG_TABLE_NAME, v_registro_id, v_estado_anterior, v_estado_posterior, v_ip);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: usuarios
DROP TRIGGER IF EXISTS trg_audit_usuarios ON usuarios;
CREATE TRIGGER trg_audit_usuarios
  AFTER INSERT OR UPDATE OR DELETE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Trigger: projetos
DROP TRIGGER IF EXISTS trg_audit_projetos ON projetos;
CREATE TRIGGER trg_audit_projetos
  AFTER INSERT OR UPDATE OR DELETE ON projetos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Trigger: rubricas_projeto
DROP TRIGGER IF EXISTS trg_audit_rubricas ON rubricas_projeto;
CREATE TRIGGER trg_audit_rubricas
  AFTER INSERT OR UPDATE OR DELETE ON rubricas_projeto
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Trigger: lancamentos
DROP TRIGGER IF EXISTS trg_audit_lancamentos ON lancamentos;
CREATE TRIGGER trg_audit_lancamentos
  AFTER INSERT OR UPDATE OR DELETE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Trigger: alocacao_rh
DROP TRIGGER IF EXISTS trg_audit_alocacao ON alocacao_rh;
CREATE TRIGGER trg_audit_alocacao
  AFTER INSERT OR UPDATE OR DELETE ON alocacao_rh
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Trigger: competencias_folha
DROP TRIGGER IF EXISTS trg_audit_competencias ON competencias_folha;
CREATE TRIGGER trg_audit_competencias
  AFTER INSERT OR UPDATE OR DELETE ON competencias_folha
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Trigger: documentos_metadados
DROP TRIGGER IF EXISTS trg_audit_documentos ON documentos_metadados;
CREATE TRIGGER trg_audit_documentos
  AFTER INSERT OR UPDATE OR DELETE ON documentos_metadados
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ============================================================
-- TABELA TEMPORÁRIA: chunks para upload stream (serverless-safe)
-- ============================================================
CREATE TABLE IF NOT EXISTS upload_chunks (
  file_id     VARCHAR(100) NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_data  BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (file_id, chunk_index)
);

-- Limpeza automática de chunks abandonados (mais de 1 hora)
CREATE OR REPLACE FUNCTION fn_cleanup_old_chunks()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM upload_chunks WHERE created_at < NOW() - INTERVAL '1 hour';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_chunks ON upload_chunks;
CREATE TRIGGER trg_cleanup_chunks
  AFTER INSERT ON upload_chunks
  FOR EACH STATEMENT EXECUTE FUNCTION fn_cleanup_old_chunks();
`;

async function migrate() {
  console.log('🚀 Executando migração SGP-ANEEL...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(DDL);
    await client.query('COMMIT');
    console.log('✅ Migração concluída: 9 tabelas + 13 índices + 7 triggers de auditoria');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
