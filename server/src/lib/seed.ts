import { pool } from './db';
import bcrypt from 'bcryptjs';

const SEED_SQL = `
-- ============================================================
-- SGP-ANEEL SEED — Dados iniciais para teste
-- ============================================================

-- Usuários (senha de todos: 123456)
INSERT INTO usuarios (id, nome_completo, cpf, email, hash_senha, perfil, ativo)
VALUES
  ('8bc10bb4-3b4a-4c7c-8c72-e0c9b2019720', 'Admin Gestor',   '11111111111', 'gestor@aneel.gov.br',   $1, 'GESTOR',      true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Maria Coordenadora', '22222222222', 'coord@aneel.gov.br',    $2, 'COORDENADOR', true),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Joao Pesquisador',   '33333333333', 'pesq@aneel.gov.br',     $3, 'PESQUISADOR', true),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Ana Bolsista',       '44444444444', 'bolsa@aneel.gov.br',    $4, 'BOLSISTA',    true)
ON CONFLICT (id) DO NOTHING;

-- Projeto teste
INSERT INTO projetos (id, codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim)
VALUES
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'SGP-2026-001', 'Sistema de Gestao de Projetos ANEEL',
   'Projeto piloto para gestao de projetos de P&D regulados pela ANEEL',
   'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '2026-01-01', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

-- Rubricas do projeto
INSERT INTO rubricas_projeto (projeto_id, rubrica, valor_previsto)
VALUES
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'RH', 150000.00),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'ST',  80000.00),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'MC',  60000.00),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'EP',  40000.00),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'VD',  30000.00),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'OU',  40000.00)
ON CONFLICT (projeto_id, rubrica) DO NOTHING;

-- Alocação de RH (pesquisador)
INSERT INTO alocacao_rh (projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado)
VALUES
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'PESQUISADOR', 'Mestrado', 8000.00, 1, 10666.67)
ON CONFLICT (projeto_id, usuario_id) DO NOTHING;

-- Competências geradas (janeiro a junho 2026)
INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
SELECT
  a.id,
  2026,
  m.mes,
  10666.67,
  'PENDENTE'
FROM alocacao_rh a
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) AS m(mes)
WHERE a.projeto_id = 'd4e5f6a7-b8c9-0123-defa-234567890123'
  AND a.usuario_id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
ON CONFLICT (alocacao_rh_id, ano, mes) DO NOTHING;
`;

async function seed() {
  console.log('🌱 Executando seed SGP-ANEEL...');

  const senhaHash = await bcrypt.hash('123456', 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert users with hashed passwords
    await client.query(
      `INSERT INTO usuarios (id, nome_completo, cpf, email, hash_senha, perfil, ativo)
       VALUES
         ('8bc10bb4-3b4a-4c7c-8c72-e0c9b2019720', 'Admin Gestor',    '11111111111', 'gestor@aneel.gov.br',  $1, 'GESTOR',      true),
         ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Maria Coordenadora','22222222222', 'coord@aneel.gov.br',   $2, 'COORDENADOR', true),
         ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Joao Pesquisador',  '33333333333', 'pesq@aneel.gov.br',    $3, 'PESQUISADOR', true),
         ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Ana Bolsista',      '44444444444', 'bolsa@aneel.gov.br',   $4, 'BOLSISTA',    true)
       ON CONFLICT (id) DO NOTHING`,
      [senhaHash, senhaHash, senhaHash, senhaHash]
    );

    // Insert project
    await client.query(
      `INSERT INTO projetos (id, codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim)
       VALUES ('d4e5f6a7-b8c9-0123-defa-234567890123', 'SGP-2026-001', 'Sistema de Gestao de Projetos ANEEL',
         'Projeto piloto para gestao de projetos de P&D regulados pela ANEEL',
         'a1b2c3d4-e5f6-7890-abcd-ef1234567890', '2026-01-01', '2026-12-31')
       ON CONFLICT (id) DO NOTHING`
    );

    // Insert rubricas
    const rubricas = [
      ['RH', 150000], ['ST', 80000], ['MC', 60000],
      ['EP', 40000],  ['VD', 30000], ['OU', 40000],
    ];
    for (const [rubrica, valor] of rubricas) {
      await client.query(
        `INSERT INTO rubricas_projeto (projeto_id, rubrica, valor_previsto)
         VALUES ($1, $2, $3) ON CONFLICT (projeto_id, rubrica) DO NOTHING`,
        ['d4e5f6a7-b8c9-0123-defa-234567890123', rubrica, valor]
      );
    }

    // Insert alocacao RH
    await client.query(
      `INSERT INTO alocacao_rh (projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado)
       VALUES ($1, $2, 'PESQUISADOR', 'Mestrado', 8000.00, 1, 10666.67)
       ON CONFLICT (projeto_id, usuario_id) DO NOTHING`,
      ['d4e5f6a7-b8c9-0123-defa-234567890123', 'b2c3d4e5-f6a7-8901-bcde-f12345678901']
    );

    // Get alocacao ID for competencias
    const alocacao = await client.query<{ id: string }>(
      `SELECT id FROM alocacao_rh WHERE projeto_id = $1 AND usuario_id = $2`,
      ['d4e5f6a7-b8c9-0123-defa-234567890123', 'b2c3d4e5-f6a7-8901-bcde-f12345678901']
    );

    if (alocacao.rows[0]) {
      const alocId = alocacao.rows[0].id;
      for (let mes = 1; mes <= 6; mes++) {
        await client.query(
          `INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
           VALUES ($1, 2026, $2, 10666.67, 'PENDENTE')
           ON CONFLICT (alocacao_rh_id, ano, mes) DO NOTHING`,
          [alocId, mes]
        );
      }
    }

    await client.query('COMMIT');
    console.log('✅ Seed concluído: 4 usuários, 1 projeto, 6 rubricas, 1 alocação, 6 competências');
    console.log('   Senha de todos: 123456');
    console.log('   Login: gestor@aneel.gov.br');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro no seed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
