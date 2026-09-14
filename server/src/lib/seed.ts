import { pool } from './db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function uuid(): string {
  return crypto.randomUUID();
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 10);
}

function randomBudget(): number {
  const base = randInt(1000000, 10000000);
  return Math.round(base / 1000) * 1000;
}

function distributeBudget(total: number): Record<string, number> {
  const weights = {
    RH: 0.25 + Math.random() * 0.1,
    ST: 0.15 + Math.random() * 0.1,
    MC: 0.10 + Math.random() * 0.08,
    EP: 0.15 + Math.random() * 0.1,
    VD: 0.05 + Math.random() * 0.05,
    OU: 0.10 + Math.random() * 0.07,
  };
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const result: Record<string, number> = {};
  let remaining = total;
  const keys = Object.keys(weights) as (keyof typeof weights)[];
  for (let i = 0; i < keys.length - 1; i++) {
    const val = Math.round((weights[keys[i]] / sum) * total / 1000) * 1000;
    result[keys[i]] = val;
    remaining -= val;
  }
  result[keys[keys.length - 1]] = Math.max(remaining, 0);
  return result;
}

const RUBRICA_LABELS: Record<string, string> = {
  RH: 'Recursos Humanos', ST: 'Serviços de Terceiros', MC: 'Materiais de Consumo',
  EP: 'Equipamentos', VD: 'Viagens e Diárias', OU: 'Outros Custos',
};

const LANCAMENTO_DESC: Record<string, string[]> = {
  RH: ['Bolsista de iniciação científica', 'Pesquisador Dedicado', 'Auxiliar de pesquisa'],
  ST: ['Consultoria técnica', 'Análise laboratorial', 'Serviço de manutenção'],
  MC: ['Reagentes químicos', 'Material de escritório', 'Insumos para laboratório'],
  EP: ['Microcomputadores', 'Monitor de medição', 'Servidor de dados'],
  VD: ['Viagem a congresso', 'Deslocamento técnica', 'Hospedagem reunião'],
  OU: ['Publicação de artigo', 'Taxas bancárias', 'Serviços de nuvem'],
};

const NIVEIS_ACADEMICOS = ['Graduação', 'Especialização', 'Mestrado', 'Doutorado'];

const PROJECT_TITLES = [
  'Modernização do Sistema de Distribuição de Energia Elétrica',
  'Desenvolvimento de Painel Solar de Alta Eficiência',
  'Estudo de Impacto Ambiental de Linhas de Transmissão',
  'Automação de Subestações com IoT',
  'Análise de Qualidade da Energia em Redes Inteligentes',
  'Estocagem de Energia com Baterias de Estado Sólido',
  'Monitoramento de Linhas de Transmissão por Drones',
  'Desenvolvimento de Transformador Amorfico',
  'Sistema de Proteção contra Descargas Atmosféricas',
  'Otimização de Fluxo de Carga em Redes de Distribuição',
  'Implementação de Medidor Inteligente (AMI)',
  'Estudo de Micro Redes para Áreas Remotas',
  'Controle Inteligente de Iluminação Pública LED',
  'Desenvolvimento de Condutor de Alta Temperatura',
  'Análise de Harmônicos na Rede de Distribuição',
  'Sistema de Gestão de Demanda em Tempo Real',
  'Monitoramento Acústico de Transformadores',
  'Desenvolvimento de isolante nanoestruturado',
  'Plataforma de Dados para Gestão de Perdas',
  'Protótipo de Turbólica Eólica para Distribuição',
];

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

  const coordenadores = EXPECTED_USERS.filter(u => u.perfil === 'COORDENADOR');
  const pesquisadores = EXPECTED_USERS.filter(u => u.perfil === 'PESQUISADOR');
  const bolsistas = EXPECTED_USERS.filter(u => u.perfil === 'BOLSISTA');
  const colaboraveis = EXPECTED_USERS.filter(u => u.perfil !== 'GESTOR');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM audit_logs');
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

    for (const u of EXPECTED_USERS) {
      await client.query(
        `INSERT INTO usuarios (id, nome_completo, cpf, email, hash_senha, perfil, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [u.id, u.nome, u.cpf, u.email, senhaHash, u.perfil]
      );
    }
    console.log(`   ✓ ${EXPECTED_USERS.length} usuários`);

    let totalRubricas = 0;
    let totalLancamentos = 0;
    let totalAlocacoes = 0;
    let totalCompetencias = 0;

    for (let i = 0; i < 20; i++) {
      const projetoId = uuid();
      const codigo = `SGP-2026-${String(i + 1).padStart(3, '0')}`;
      const titulo = PROJECT_TITLES[i];
      const duracaoMeses = pick([12, 24, 36]);
      const dataInicio = randomDate(new Date('2026-01-01'), new Date('2026-06-01'));
      const inicio = new Date(dataInicio);
      inicio.setMonth(inicio.getMonth() + duracaoMeses);
      const dataFim = inicio.toISOString().slice(0, 10);
      const coordenador = pick(coordenadores);

      await client.query(
        `INSERT INTO projetos (id, codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [projetoId, codigo, titulo, `Projeto de P&D regulamentado pela ANEEL — ${titulo}`, coordenador.id, dataInicio, dataFim]
      );

      const budget = randomBudget();
      const rubricaValues = distributeBudget(budget);
      const rubricaIds: Record<string, string> = {};

      for (const [rubrica, valor] of Object.entries(rubricaValues)) {
        const rid = uuid();
        rubricaIds[rubrica] = rid;
        await client.query(
          `INSERT INTO rubricas_projeto (id, projeto_id, rubrica, valor_previsto)
           VALUES ($1, $2, $3, $4)`,
          [rid, projetoId, rubrica, valor]
        );
        totalRubricas++;
      }

      const numColaboradores = randInt(2, 6);
      const colaboradores = pickN(colaboraveis.filter(u => u.id !== coordenador.id), numColaboradores);

      for (const col of colaboradores) {
        const papel = pick(['PESQUISADOR', 'BOLSISTA', 'PESQUISADOR', 'PESQUISADOR']);
        const nivel = pick(NIVEIS_ACADEMICOS);
        const valorNominal = pick([3000, 4000, 5000, 6000, 8000, 10000, 12000]);
        const nivelComplemento = pick([0, 1, 2, 3]);
        const multiplicador = 1 + nivelComplemento / 3;
        const valorMensal = Math.round(valorNominal * multiplicador * 100) / 100;

        await client.query(
          `INSERT INTO alocacao_rh (projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [projetoId, col.id, papel, nivel, valorNominal, nivelComplemento, valorMensal]
        );
        totalAlocacoes++;

        const alocResult = await client.query<{ id: string }>(
          `SELECT id FROM alocacao_rh WHERE projeto_id = $1 AND usuario_id = $2`,
          [projetoId, col.id]
        );
        const alocId = alocResult.rows[0].id;

        const mesesComp = Math.min(duracaoMeses, 12);
        for (let mes = 1; mes <= mesesComp; mes++) {
          const statuses = ['PENDENTE', 'PENDENTE', 'PENDENTE', 'PAGO'];
          await client.query(
            `INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
             VALUES ($1, 2026, $2, $3, $4)`,
            [alocId, mes, valorMensal, pick(statuses)]
          );
          totalCompetencias++;
        }
      }

      const rubricaEntries = Object.entries(rubricaIds);
      const numLancamentos = randInt(5, 15);

      for (let j = 0; j < numLancamentos; j++) {
        const [, rid] = pick(rubricaEntries);
        const rubricaKey = rubricaEntries.find(([, v]) => v === rid)?.[0] || 'OU';
        const desc = pick(LANCAMENTO_DESC[rubricaKey]);
        const valorLanc = Math.round((Math.random() * 50000 + 1000) * 100) / 100;
        const usuario = pick(colaboraveis);
        const dataDespesa = randomDate(new Date(dataInicio), new Date(dataFim));

        await client.query(
          `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [rid, desc, valorLanc, dataDespesa, usuario.id]
        );
        totalLancamentos++;
      }
    }

    await client.query('COMMIT');
    console.log(`   ✓ 20 projetos`);
    console.log(`   ✓ ${totalRubricas} rubricas`);
    console.log(`   ✓ ${totalAlocacoes} alocações RH`);
    console.log(`   ✓ ${totalCompetencias} competências`);
    console.log(`   ✓ ${totalLancamentos} lançamentos`);
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
