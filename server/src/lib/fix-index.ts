import { pool } from './db';

async function run() {
  try {
    await pool.query('ALTER INDEX IF EXISTS idx_documentos_categoria RENAME TO idx_documentos_categoria_simples');
    console.log('OK: renamed idx_documentos_categoria');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('SKIP rename: ' + msg);
  }
  try {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_documentos_categoria_composite ON documentos_metadados (projeto_id, categoria)');
    console.log('OK: created composite index');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('SKIP composite: ' + msg);
  }
  await pool.end();
}
run();
