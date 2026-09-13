import { pool } from '../lib/db';

async function run() {
  const stmts: [string, string][] = [
    ['ALTER TABLE projetos ADD CONSTRAINT chk_datas_projeto CHECK (data_fim > data_inicio)', 'chk_datas_projeto'],
    ['ALTER TABLE rubricas_projeto ADD CONSTRAINT chk_valor_previsto_positivo CHECK (valor_previsto >= 0)', 'chk_valor_previsto_positivo'],
    ['ALTER TABLE lancamentos ADD CONSTRAINT chk_valor_lancamento_positivo CHECK (valor > 0)', 'chk_valor_lancamento_positivo'],
    ['ALTER TABLE lancamentos ADD COLUMN documento_id UUID REFERENCES documentos_metadados(id) ON DELETE SET NULL', 'documento_id'],
    ['ALTER TABLE alocacao_rh ADD CONSTRAINT chk_valor_nominal_positivo CHECK (valor_nominal_capes > 0)', 'chk_valor_nominal_positivo'],
    ['ALTER TABLE competencias_folha ADD CONSTRAINT chk_ano_valido CHECK (ano >= 2020)', 'chk_ano_valido'],
    ['CREATE INDEX IF NOT EXISTS idx_comp_busca ON competencias_folha (ano, mes, status)', 'idx_comp_busca'],
    ['CREATE INDEX IF NOT EXISTS idx_doc_cat_comp ON documentos_metadados (projeto_id, categoria)', 'idx_doc_cat_comp'],
    ['CREATE INDEX IF NOT EXISTS idx_audit_busca ON audit_logs (tabela_origem, registro_id)', 'idx_audit_busca'],
  ];
  for (const [sql, name] of stmts) {
    try {
      await pool.query(sql);
      console.log('OK: ' + name);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('SKIP: ' + name + ' - ' + msg);
    }
  }
  console.log('DONE');
  await pool.end();
}
run();
