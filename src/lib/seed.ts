import { pool, query } from './db';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');

  const existing = await query('SELECT COUNT(*) as count FROM usuarios');
  if (parseInt(existing[0].count as string) > 0) {
    console.log('Database already seeded, skipping');
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash('123456', 12);

  const gestor = await query(
    `INSERT INTO usuarios (nome_completo, cpf, email, hash_senha, perfil)
     VALUES ($1, $2, $3, $4, 'GESTOR') RETURNING id`,
    ['Admin Gestor', '00000000000', 'gestor@aneel.gov.br', hash]
  );

  const coordenador = await query(
    `INSERT INTO usuarios (nome_completo, cpf, email, hash_senha, perfil)
     VALUES ($1, $2, $3, $4, 'COORDENADOR') RETURNING id`,
    ['Coordenador Projeto', '11111111111', 'coord@aneel.gov.br', hash]
  );

  const pesquisador = await query(
    `INSERT INTO usuarios (nome_completo, cpf, email, hash_senha, perfil)
     VALUES ($1, $2, $3, $4, 'PESQUISADOR') RETURNING id`,
    ['Pesquisador Silva', '22222222222', 'pesq@aneel.gov.br', hash]
  );

  const bolsista = await query(
    `INSERT INTO usuarios (nome_completo, cpf, email, hash_senha, perfil)
     VALUES ($1, $2, $3, $4, 'BOLSISTA') RETURNING id`,
    ['Bolsista Joao', '33333333333', 'bolsa@aneel.gov.br', hash]
  );

  const projeto = await query(
    `INSERT INTO projetos (codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    ['ANEEL-2026-001', 'Projeto Piloto SGP-ANEEL', 'Projeto de demonstracao do sistema', coordenador[0].id, '2026-01-01', '2027-12-31']
  );

  const rubricas = ['RH', 'ST', 'MC', 'EP', 'VD', 'OU'];
  const valores = [500000, 200000, 100000, 150000, 80000, 70000];
  const rubricaIds: string[] = [];

  for (let i = 0; i < rubricas.length; i++) {
    const r = await query(
      'INSERT INTO rubricas_projeto (projeto_id, rubrica, valor_previsto) VALUES ($1, $2, $3) RETURNING id',
      [projeto[0].id, rubricas[i], valores[i]]
    );
    rubricaIds.push(r[0].id as string);
  }

  const alocacao = await query(
    `INSERT INTO alocacao_rh (projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado)
     VALUES ($1, $2, 'PESQUISADOR', 'Doutor', 5200, 1, 6933.33) RETURNING id`,
    [projeto[0].id, pesquisador[0].id]
  );

  const alocacaoBolsista = await query(
    `INSERT INTO alocacao_rh (projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado)
     VALUES ($1, $2, 'BOLSISTA', 'Graduando', 700, 0, 700) RETURNING id`,
    [projeto[0].id, bolsista[0].id]
  );

  for (let mes = 1; mes <= 12; mes++) {
    await query(
      `INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
       VALUES ($1, 2026, $2, $3, 'PENDENTE')`,
      [alocacao[0].id, mes, 6933.33]
    );
    await query(
      `INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
       VALUES ($1, 2026, $2, $3, 'PENDENTE')`,
      [alocacaoBolsista[0].id, mes, 700]
    );
  }

  console.log('Seed completed successfully');
  console.log('Users created:');
  console.log('  Gestor:      gestor@aneel.gov.br / 123456');
  console.log('  Coordenador: coord@aneel.gov.br / 123456');
  console.log('  Pesquisador: pesq@aneel.gov.br / 123456');
  console.log('  Bolsista:    bolsa@aneel.gov.br / 123456');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
