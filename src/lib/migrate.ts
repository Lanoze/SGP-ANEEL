import { pool } from './db';

const DDL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE role_usuario AS ENUM ('GESTOR', 'COORDENADOR', 'PESQUISADOR', 'BOLSISTA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE codigo_rubrica AS ENUM ('RH', 'ST', 'MC', 'EP', 'VD', 'OU');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_folha AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE categoria_documento AS ENUM ('CONTRATO_RH', 'COMPROVANTE_LANCAMENTO', 'RELATORIO_TECNICO', 'GERAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_completo VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  hash_senha VARCHAR(255) NOT NULL,
  perfil role_usuario NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projetos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_aneel VARCHAR(50) NOT NULL UNIQUE,
  titulo VARCHAR(500) NOT NULL,
  descricao TEXT,
  coordenador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_datas_projeto CHECK (data_fim > data_inicio)
);

CREATE TABLE IF NOT EXISTS rubricas_projeto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  rubrica codigo_rubrica NOT NULL,
  valor_previsto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  CONSTRAINT uq_projeto_rubrica UNIQUE (projeto_id, rubrica),
  CONSTRAINT chk_valor_previsto_positivo CHECK (valor_previsto >= 0)
);

CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rubrica_projeto_id UUID NOT NULL REFERENCES rubricas_projeto(id) ON DELETE RESTRICT,
  descricao VARCHAR(500) NOT NULL,
  valor NUMERIC(14, 2) NOT NULL,
  data_despesa DATE NOT NULL,
  usuario_registro_id UUID NOT NULL REFERENCES usuarios(id),
  documento_id UUID,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_valor_lancamento_positivo CHECK (valor > 0)
);

CREATE TABLE IF NOT EXISTS alocacao_rh (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  papel_projeto role_usuario NOT NULL,
  nivel_academico VARCHAR(100) NOT NULL,
  valor_nominal_capes NUMERIC(10, 2) NOT NULL,
  nivel_complemento INT NOT NULL DEFAULT 0,
  valor_mensal_calculado NUMERIC(10, 2) NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_projeto_usuario UNIQUE (projeto_id, usuario_id),
  CONSTRAINT chk_nivel_complemento CHECK (nivel_complemento IN (0, 1, 2, 3)),
  CONSTRAINT chk_valor_nominal CHECK (valor_nominal_capes > 0)
);

CREATE TABLE IF NOT EXISTS competencias_folha (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alocacao_rh_id UUID NOT NULL REFERENCES alocacao_rh(id) ON DELETE CASCADE,
  ano INT NOT NULL,
  mes INT NOT NULL,
  valor_devido NUMERIC(10, 2) NOT NULL,
  status status_folha NOT NULL DEFAULT 'PENDENTE',
  data_baixa TIMESTAMP WITH TIME ZONE,
  usuario_baixa_id UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_alocacao_mes_ano UNIQUE (alocacao_rh_id, ano, mes),
  CONSTRAINT chk_mes_valido CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT chk_ano_valido CHECK (ano >= 2020)
);

CREATE TABLE IF NOT EXISTS documentos_metadados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  categoria categoria_documento NOT NULL,
  nome_arquivo VARCHAR(255) NOT NULL,
  extensao VARCHAR(20) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  hash_sha256 CHAR(64) NOT NULL,
  usuario_upload_id UUID NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documentos_payload (
  documento_id UUID PRIMARY KEY REFERENCES documentos_metadados(id) ON DELETE CASCADE,
  conteudo_binario BYTEA NOT NULL
);

ALTER TABLE documentos_payload ALTER COLUMN conteudo_binario SET STORAGE EXTENDED;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  acao VARCHAR(50) NOT NULL,
  tabela_origem VARCHAR(50) NOT NULL,
  registro_id UUID,
  estado_anterior JSONB,
  estado_posterior JSONB,
  endereco_ip VARCHAR(45),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rubricas_projeto ON rubricas_projeto(projeto_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_rubrica ON lancamentos(rubrica_projeto_id);
CREATE INDEX IF NOT EXISTS idx_competencias_busca ON competencias_folha(ano, mes, status);
CREATE INDEX IF NOT EXISTS idx_documentos_categoria ON documentos_metadados(projeto_id, categoria);
CREATE INDEX IF NOT EXISTS idx_audit_logs_busca ON audit_logs(tabela_origem, registro_id);
`;

async function migrate() {
  console.log('Running migrations...');
  await pool.query(DDL);
  console.log('Migrations completed successfully');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
