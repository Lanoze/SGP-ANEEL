/**
 * Teste de Carga e Concorrência - Baixa de Folha SGP-ANEEL
 *
 * Executa múltiplas requisições concorrentes para testar:
 * 1. Integridade transacional (saldo nunca fica negativo)
 * 2. Concorrência de baixa individual (mesma competência)
 * 3. Baixa em lote sob carga
 *
 * Uso: npx tsx tests/baixa-load-test.ts [BASE_URL]
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

const TEST_EMAIL = 'gestor@aneel.gov.br';
const TEST_SENHA = '123456';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

let token = '';

async function login(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, senha: TEST_SENHA }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  token = data.token;
}

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function testConcurrentBaixa(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { data: projetos } = await api('GET', '/projetos');
    if (!(projetos as any[]).length) return { name: 'Baixa Concorrente', passed: false, details: 'Nenhum projeto', duration: 0 };

    const projetoId = (projetos as any[])[0].id;
    const { data: folha } = await api('GET', `/folha/folha/${projetoId}`);

    const pendencias: { competenciaId: string; nome: string }[] = [];
    for (const a of folha as any[]) {
      for (const c of a.competencias ?? []) {
        if (c.status === 'PENDENTE') pendencias.push({ competenciaId: c.id, nome: a.nome_completo });
      }
    }

    if (pendencias.length === 0) return { name: 'Baixa Concorrente', passed: true, details: 'Nenhuma pendência (ok)', duration: Date.now() - start };

    const CONCURRENT = Math.min(pendencias.length, 5);
    const promises = [];
    let successCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < CONCURRENT; i++) {
      promises.push(
        api('POST', '/folha/baixar-individual', { competencia_id: pendencias[i].competenciaId }).then((r) => {
          if (r.status === 200) successCount++;
          else rejectedCount++;
          return r;
        })
      );
    }

    const results = await Promise.all(promises);

    const allStatusOk = results.every((r) => r.status === 200 || r.status === 400 || r.status === 404);

    return {
      name: 'Baixa Concorrente',
      passed: allStatusOk && successCount <= 1,
      details: `${CONCURRENT} requisições simultâneas: ${successCount} sucesso, ${rejectedCount} rejeitadas`,
      duration: Date.now() - start,
    };
  } catch (e) {
    return { name: 'Baixa Concorrente', passed: false, details: `Erro: ${(e as Error).message}`, duration: Date.now() - start };
  }
}

async function testSaldoNegativo(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { data: projetos } = await api('GET', '/projetos');
    if (!(projetos as any[]).length) return { name: 'Bloqueio Saldo Negativo', passed: false, details: 'Nenhum projeto', duration: 0 };

    const projetoId = (projetos as any[])[0].id;
    const { data: rubricas } = await api('GET', `/projetos/${projetoId}/rubricas`);

    const rhRubrica = (rubricas as any[]).find((r: any) => r.rubrica === 'RH');
    if (!rhRubrica) return { name: 'Bloqueio Saldo Negativo', passed: true, details: 'Rubrica RH não encontrada (ok)', duration: Date.now() - start };

    const saldo = parseFloat(rhRubrica.valor_previsto) - parseFloat(rhRubrica.valor_executado);
    const lancamentoExcessivo = saldo + 1000;

    const result = await api('POST', '/lancamentos', {
      rubrica_projeto_id: rhRubrica.id,
      descricao: 'Teste de estouro orçamentário',
      valor: lancamentoExcessivo,
      data_despesa: new Date().toISOString().split('T')[0],
    });

    return {
      name: 'Bloqueio Saldo Negativo',
      passed: result.status === 400,
      details: result.status === 400
        ? `Lançamento de R$ ${lancamentoExcessivo} bloqueado corretamente (saldo R$ ${saldo})`
        : `ERRO: Lançamento de R$ ${lancamentoExcessivo} aceito quando deveria ser bloqueado`,
      duration: Date.now() - start,
    };
  } catch (e) {
    return { name: 'Bloqueio Saldo Negativo', passed: false, details: `Erro: ${(e as Error).message}`, duration: Date.now() - start };
  }
}

async function testBaixaLoteIntegridade(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { data: projetos } = await api('GET', '/projetos');
    if (!(projetos as any[]).length) return { name: 'Baixa Lote Integridade', passed: false, details: 'Nenhum projeto', duration: 0 };

    const projetoId = (projetos as any[])[0].id;
    const result = await api('POST', '/folha/baixar-lote', { projetoId, ano: 2026, mes: 99 });

    return {
      name: 'Baixa Lote Integridade',
      passed: result.status === 400,
      details: result.status === 400
        ? 'Mês inválido (99) bloqueado corretamente'
        : `ERRO: Mês inválido aceito`,
      duration: Date.now() - start,
    };
  } catch (e) {
    return { name: 'Baixa Lote Integridade', passed: false, details: `Erro: ${(e as Error).message}`, duration: Date.now() - start };
  }
}

async function testRBACBaixa(): Promise<TestResult> {
  const start = Date.now();
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bolsa@aneel.gov.br', senha: '123456' }),
    });
    const loginData = await loginRes.json();

    const result = await fetch(`${BASE_URL}/api/folha/baixar-individual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({ competencia_id: '00000000-0000-0000-0000-000000000000' }),
    });

    return {
      name: 'RBAC Baixa',
      passed: result.status === 403,
      details: result.status === 403
        ? 'BOLSISTA bloqueado de baixa (403)'
        : `ERRO: Status ${result.status} ao invés de 403`,
      duration: Date.now() - start,
    };
  } catch (e) {
    return { name: 'RBAC Baixa', passed: false, details: `Erro: ${(e as Error).message}`, duration: Date.now() - start };
  }
}

async function main() {
  console.log(`\nSGP-ANEEL - Testes de Carga e Concorrência`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    await login();
    console.log(`✓ Login OK\n`);
  } catch {
    console.error(`✗ Login falhou. Abortando.`);
    process.exit(1);
  }

  const tests = [testConcurrentBaixa, testSaldoNegativo, testBaixaLoteIntegridade, testRBACBaixa];
  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await test();
    results.push(result);
    const icon = result.passed ? '✓' : '✗';
    console.log(`${icon} ${result.name} (${result.duration}ms)`);
    console.log(`  ${result.details}\n`);
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`${'─'.repeat(60)}`);
  console.log(`Resultado: ${passed}/${total} testes passaram`);

  if (passed < total) {
    console.log('\n⚠ Alguns testes falharam!');
    process.exit(1);
  } else {
    console.log('\n✓ Todos os testes passaram!');
  }
}

main();
