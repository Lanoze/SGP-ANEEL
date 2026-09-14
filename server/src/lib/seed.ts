import { pool } from './db';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Executando seed SGP-ANEEL...');

  const senhaHash = await bcrypt.hash('123456', 12);

  const EXPECTED_USERS = [
    { id: '8bc10bb4-3b4a-4c7c-8c72-e0c9b2019720', nome: 'Admin Silva',        cpf: '11111111111', email: 'gestor@aneel.gov.br',  perfil: 'GESTOR' },
    { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', nome: 'Maria Oliveira',     cpf: '22222222222', email: 'coord@aneel.gov.br',   perfil: 'COORDENADOR' },
    { id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', nome: 'Joao Santos',        cpf: '33333333333', email: 'pesq@aneel.gov.br',    perfil: 'PESQUISADOR' },
    { id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', nome: 'Ana Costa',          cpf: '44444444444', email: 'bolsa@aneel.gov.br',   perfil: 'BOLSISTA' },
    { id: 'd5e6f7a8-b9c0-1234-defa-345678901234', nome: 'Carlos Lima',        cpf: '55555555555', email: 'carlos@aneel.gov.br',  perfil: 'COORDENADOR' },
    { id: 'e6f7a8b9-c0d1-2345-efab-456789012345', nome: 'Fernanda Almeida',   cpf: '66666666666', email: 'fernanda@aneel.gov.br', perfil: 'PESQUISADOR' },
    { id: 'f7a8b9c0-d1e2-3456-fabc-567890123456', nome: 'Pedro Ferreira',     cpf: '77777777777', email: 'pedro@aneel.gov.br',   perfil: 'PESQUISADOR' },
    { id: 'a8b9c0d1-e2f3-4567-abcd-678901234567', nome: 'Juliana Ribeiro',    cpf: '88888888888', email: 'juliana@aneel.gov.br',  perfil: 'BOLSISTA' },
    { id: 'b9c0d1e2-f3a4-5678-bcde-789012345678', nome: 'Lucas Rodrigues',    cpf: '99999999999', email: 'lucas@aneel.gov.br',   perfil: 'BOLSISTA' },
    { id: 'c0d1e2f3-a4b5-6789-cdef-890123456789', nome: 'Mariana Gomes',      cpf: '10101010101', email: 'mariana@aneel.gov.br',  perfil: 'PESQUISADOR' },
    { id: 'd1e2f3a4-b5c6-7890-defa-901234567890', nome: 'Rafael Souza',       cpf: '20202020202', email: 'rafael@aneel.gov.br',  perfil: 'PESQUISADOR' },
    { id: 'e2f3a4b5-c6d7-8901-efab-012345678901', nome: 'Beatriz Carvalho',   cpf: '30303030303', email: 'beatriz@aneel.gov.br',  perfil: 'BOLSISTA' },
    { id: 'f3a4b5c6-d7e8-9012-fabc-123456789012', nome: 'Thiago Mendes',      cpf: '40404040404', email: 'thiago@aneel.gov.br',  perfil: 'COORDENADOR' },
    { id: 'a4b5c6d7-e8f9-0123-abcd-234567890123', nome: 'Camila Pereira',     cpf: '50505050505', email: 'camila@aneel.gov.br',  perfil: 'PESQUISADOR' },
    { id: 'b5c6d7e8-f9a0-1234-bcde-345678901234', nome: 'Bruno Nascimento',   cpf: '60606060606', email: 'bruno@aneel.gov.br',   perfil: 'BOLSISTA' },
    { id: 'c6d7e8f9-a0b1-2345-cdef-456789012345', nome: 'Larissa Dias',       cpf: '70707070707', email: 'larissa@aneel.gov.br',  perfil: 'PESQUISADOR' },
    { id: 'd7e8f9a0-b1c2-3456-defa-567890123456', nome: 'Felipe Araujo',      cpf: '80808080808', email: 'felipe@aneel.gov.br',  perfil: 'BOLSISTA' },
    { id: 'e8f9a0b1-c2d3-4567-efab-678901234567', nome: 'Isabela Barbosa',    cpf: '90909090909', email: 'isabela@aneel.gov.br',  perfil: 'PESQUISADOR' },
    { id: 'f9a0b1c2-d3e4-5678-fabc-789012345678', nome: 'Gustavo Martins',    cpf: '01010101010', email: 'gustavo@aneel.gov.br',  perfil: 'BOLSISTA' },
    { id: 'a0b1c2d3-e4f5-6789-abcd-890123456789', nome: 'Patricia Lopes',     cpf: '12121212121', email: 'patricia@aneel.gov.br', perfil: 'COORDENADOR' },
    { id: 'b1c2d3e4-f5a6-7890-bcde-901234567890', nome: 'Andre Teixeira',     cpf: '13131313131', email: 'andre@aneel.gov.br',   perfil: 'PESQUISADOR' },
    { id: 'c2d3e4f5-a6b7-8901-cdef-012345678901', nome: 'Tatiana Campos',     cpf: '14141414141', email: 'tatiana@aneel.gov.br',  perfil: 'BOLSISTA' },
    { id: 'd3e4f5a6-b7c8-9012-defa-123456789012', nome: 'Rodrigo Vieira',     cpf: '15151515151', email: 'rodrigo@aneel.gov.br',  perfil: 'PESQUISADOR' },
    { id: 'e4f5a6b7-c8d9-0123-efab-234567890123', nome: 'Vanessa Cardoso',    cpf: '16161616161', email: 'vanessa@aneel.gov.br',  perfil: 'BOLSISTA' },
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
    console.log(`   ✓ ${EXPECTED_USERS.length} usuários`);

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
