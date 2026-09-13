import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  createUsuarioSchema,
  createProjetoSchema,
  createLancamentoSchema,
  createAlocacaoSchema,
  baixaLoteSchema,
  changePasswordSchema,
} from '../src/lib/schemas';

describe('loginSchema', () => {
  it('accepts valid login', () => {
    expect(loginSchema.safeParse({ email: 'test@example.com', senha: '123456' }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'invalid', senha: '123456' }).success).toBe(false);
  });

  it('rejects short password', () => {
    expect(loginSchema.safeParse({ email: 'test@example.com', senha: '123' }).success).toBe(false);
  });
});

describe('createUsuarioSchema', () => {
  const valid = {
    nome_completo: 'Arthur Silva',
    cpf: '12345678901',
    email: 'arthur@test.com',
    senha: '123456',
    perfil: 'GESTOR' as const,
  };

  it('accepts valid usuario', () => {
    expect(createUsuarioSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid CPF (letters)', () => {
    expect(createUsuarioSchema.safeParse({ ...valid, cpf: 'abc' }).success).toBe(false);
  });

  it('rejects CPF with wrong length', () => {
    expect(createUsuarioSchema.safeParse({ ...valid, cpf: '1234567890' }).success).toBe(false);
  });

  it('rejects invalid perfil', () => {
    expect(createUsuarioSchema.safeParse({ ...valid, perfil: 'ADMIN' }).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(createUsuarioSchema.safeParse({ ...valid, nome_completo: '' }).success).toBe(false);
  });
});

describe('createProjetoSchema', () => {
  const valid = {
    codigo_aneel: 'SGP-2026-001',
    titulo: 'Projeto Teste',
    coordenador_id: '550e8400-e29b-41d4-a716-446655440000',
    data_inicio: '2026-01-01',
    data_fim: '2026-12-31',
  };

  it('accepts valid projeto', () => {
    expect(createProjetoSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid UUID coordenador', () => {
    expect(createProjetoSchema.safeParse({ ...valid, coordenador_id: 'invalid' }).success).toBe(false);
  });

  it('rejects invalid date format', () => {
    expect(createProjetoSchema.safeParse({ ...valid, data_inicio: '01/01/2026' }).success).toBe(false);
  });
});

describe('createLancamentoSchema', () => {
  const valid = {
    rubrica_projeto_id: '550e8400-e29b-41d4-a716-446655440000',
    descricao: 'Compra de material',
    valor: 1500.50,
    data_despesa: '2026-03-15',
  };

  it('accepts valid lancamento', () => {
    expect(createLancamentoSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects negative value', () => {
    expect(createLancamentoSchema.safeParse({ ...valid, valor: -100 }).success).toBe(false);
  });

  it('rejects zero value', () => {
    expect(createLancamentoSchema.safeParse({ ...valid, valor: 0 }).success).toBe(false);
  });
});

describe('createAlocacaoSchema', () => {
  const valid = {
    projeto_id: '550e8400-e29b-41d4-a716-446655440000',
    usuario_id: '550e8400-e29b-41d4-a716-446655440001',
    papel_projeto: 'PESQUISADOR' as const,
    nivel_academico: 'Doutor',
    valor_nominal_capes: 3100,
    nivel_complemento: 0,
  };

  it('accepts valid alocacao', () => {
    expect(createAlocacaoSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects nivel_complemento out of range', () => {
    expect(createAlocacaoSchema.safeParse({ ...valid, nivel_complemento: 4 }).success).toBe(false);
  });

  it('rejects nivel_complemento negative', () => {
    expect(createAlocacaoSchema.safeParse({ ...valid, nivel_complemento: -1 }).success).toBe(false);
  });
});

describe('baixaLoteSchema', () => {
  it('accepts valid baixa lote', () => {
    expect(baixaLoteSchema.safeParse({ projeto_id: '550e8400-e29b-41d4-a716-446655440000', ano: 2026, mes: 3 }).success).toBe(true);
  });

  it('rejects mes out of range', () => {
    expect(baixaLoteSchema.safeParse({ projeto_id: '550e8400-e29b-41d4-a716-446655440000', ano: 2026, mes: 13 }).success).toBe(false);
  });

  it('rejects ano before 2020', () => {
    expect(baixaLoteSchema.safeParse({ projeto_id: '550e8400-e29b-41d4-a716-446655440000', ano: 2019, mes: 1 }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts valid passwords', () => {
    expect(changePasswordSchema.safeParse({ senha_atual: '123456', nova_senha: '654321' }).success).toBe(true);
  });

  it('rejects short nova_senha', () => {
    expect(changePasswordSchema.safeParse({ senha_atual: '123456', nova_senha: '123' }).success).toBe(false);
  });
});
