import { pool } from './db';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Executando seed SGP-ANEEL...');

  const senhaHash = await bcrypt.hash('123456', 12);

  const EXPECTED_USERS = [
    { id: '8bc10bb4-3b4a-4c7c-8c72-e0c9b2019720', nome: 'Admin Gestor',       cpf: '11111111111', email: 'gestor@aneel.gov.br',  perfil: 'GESTOR' },
    { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', nome: 'Maria Coordenadora', cpf: '22222222222', email: 'coord@aneel.gov.br',   perfil: 'COORDENADOR' },
    { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', nome: 'Joao Pesquisador',   cpf: '33333333333', email: 'pesq@aneel.gov.br',    perfil: 'PESQUISADOR' },
    { id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', nome: 'Ana Bolsista',       cpf: '44444444444', email: 'bolsa@aneel.gov.br',   perfil: 'BOLSISTA' },
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clean existing data (respect FK order)
    await client.query('DELETE FROM competencias_folha');
    await client.query('DELETE FROM alocacao_rh');
    await client.query('DELETE FROM upload_chunks');
    await client.query('DELETE FROM documentos_payload');
    await client.query('DELETE FROM documentos_metadados');
    await client.query('DELETE FROM lancamentos');
    await client.query('DELETE FROM rubricas_projeto');
    await client.query('DELETE FROM projetos');
    await client.query('DELETE FROM usuarios');
    console.log('   ✓ Dados antigos removidos');

    // Insert users
    for (const u of EXPECTED_USERS) {
      await client.query(
        `INSERT INTO usuarios (id, nome_completo, cpf, email, hash_senha, perfil, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [u.id, u.nome, u.cpf, u.email, senhaHash, u.perfil]
      );
    }
    console.log('   ✓ 4 usuários');

    // Insert project
    await client.query(
      `INSERT INTO projetos (id, codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim)
       VALUES ('d4e5f6a7-b8c9-0123-defa-234567890123', 'SGP-2026-001', 'Sistema de Gestao de Projetos ANEEL',
         'Projeto piloto para gestao de projetos de P&D regulados pela ANEEL',
         $1, '2026-01-01', '2026-12-31')`,
      [EXPECTED_USERS[1].id]
    );
    console.log('   ✓ 1 projeto');

    // Insert rubricas
    const rubricas: [string, number][] = [
      ['RH', 150000], ['ST', 80000], ['MC', 60000],
      ['EP', 40000],  ['VD', 30000], ['OU', 40000],
    ];
    for (const [rubrica, valor] of rubricas) {
      await client.query(
        `INSERT INTO rubricas_projeto (projeto_id, rubrica, valor_previsto)
         VALUES ('d4e5f6a7-b8c9-0123-defa-234567890123', $1, $2)`,
        [rubrica, valor]
      );
    }
    console.log('   ✓ 6 rubricas');

    // Insert alocacao RH
    await client.query(
      `INSERT INTO alocacao_rh (projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado)
       VALUES ('d4e5f6a7-b8c9-0123-defa-234567890123', $1, 'PESQUISADOR', 'Mestrado', 8000.00, 1, 10666.67)`,
      [EXPECTED_USERS[2].id]
    );
    console.log('   ✓ 1 alocação');

    // Get alocacao ID for competencias
    const alocacao = await client.query<{ id: string }>(
      `SELECT id FROM alocacao_rh WHERE projeto_id = $1 AND usuario_id = $2`,
      ['d4e5f6a7-b8c9-0123-defa-234567890123', EXPECTED_USERS[2].id]
    );

    if (alocacao.rows[0]) {
      const alocId = alocacao.rows[0].id;
      for (let mes = 1; mes <= 6; mes++) {
        await client.query(
          `INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
           VALUES ($1, 2026, $2, 10666.67, 'PENDENTE')`,
          [alocId, mes]
        );
      }
    }
    console.log('   ✓ 6 competências');

    await client.query('COMMIT');
    console.log('\n✅ Seed concluído!');
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
