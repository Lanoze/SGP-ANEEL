import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const createUsuarioSchema = z.object({
  nome_completo: z.string().min(3).max(255),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  perfil: z.enum(['GESTOR', 'COORDENADOR', 'PESQUISADOR', 'BOLSISTA']),
});

export const createProjetoSchema = z.object({
  codigo_aneel: z.string().min(1).max(50),
  titulo: z.string().min(1).max(500),
  descricao: z.string().optional(),
  coordenador_id: z.string().uuid(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((d) => d.data_inicio <= d.data_fim, {
  message: 'Data de início deve ser anterior ou igual à data de fim',
  path: ['data_fim'],
});

export const updateProjetoSchema = z.object({
  codigo_aneel: z.string().min(1).max(50),
  titulo: z.string().min(1).max(500),
  descricao: z.string().optional(),
  coordenador_id: z.string().uuid(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((d) => d.data_inicio <= d.data_fim, {
  message: 'Data de início deve ser anterior ou igual à data de fim',
  path: ['data_fim'],
});

export const createLancamentoSchema = z.object({
  rubrica_projeto_id: z.string().uuid('Selecione uma rubrica válida'),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(500),
  valor: z.number({ message: 'Valor é obrigatório' }).positive('Valor deve ser maior que zero'),
  data_despesa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
});

export const createAlocacaoSchema = z.object({
  projeto_id: z.string().uuid(),
  usuario_id: z.string().uuid(),
  papel_projeto: z.enum(['GESTOR', 'COORDENADOR', 'PESQUISADOR', 'BOLSISTA']),
  nivel_academico: z.string().min(1).max(100),
  valor_nominal_capes: z.number({ message: 'Valor nominal é obrigatório' }).positive('Valor nominal deve ser maior que zero'),
  nivel_complemento: z.number({ message: 'Nível é obrigatório' }).int().min(0).max(3),
});

export const baixaCompetenciaSchema = z.object({
  competencia_id: z.string().uuid(),
});

export const baixaLoteSchema = z.object({
  projeto_id: z.string().uuid(),
  ano: z.number().int().min(2020),
  mes: z.number().int().min(1).max(12),
});

export const changePasswordSchema = z.object({
  senha_atual: z.string().min(6),
  nova_senha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
});

export const resetPasswordSchema = z.object({
  usuario_id: z.string().uuid(),
  nova_senha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
});

export type loginInput = z.infer<typeof loginSchema>;
export type createUsuarioInput = z.infer<typeof createUsuarioSchema>;
export type createProjetoInput = z.infer<typeof createProjetoSchema>;
export type createLancamentoInput = z.infer<typeof createLancamentoSchema>;
export type createAlocacaoInput = z.infer<typeof createAlocacaoSchema>;
export type baixaCompetenciaInput = z.infer<typeof baixaCompetenciaSchema>;
export type baixaLoteInput = z.infer<typeof baixaLoteSchema>;
export type changePasswordInput = z.infer<typeof changePasswordSchema>;
export type resetPasswordInput = z.infer<typeof resetPasswordSchema>;
