export const RoleUsuario = {
  GESTOR: 'GESTOR',
  COORDENADOR: 'COORDENADOR',
  PESQUISADOR: 'PESQUISADOR',
  BOLSISTA: 'BOLSISTA',
} as const;
export type RoleUsuario = typeof RoleUsuario[keyof typeof RoleUsuario];

export const CodigoRubrica = {
  RH: 'RH', ST: 'ST', MC: 'MC', EP: 'EP', VD: 'VD', OU: 'OU',
} as const;
export type CodigoRubrica = typeof CodigoRubrica[keyof typeof CodigoRubrica];

export const StatusFolha = {
  PENDENTE: 'PENDENTE', PAGO: 'PAGO', CANCELADO: 'CANCELADO',
} as const;
export type StatusFolha = typeof StatusFolha[keyof typeof StatusFolha];

export const CategoriaDocumento = {
  CONTRATO_RH: 'CONTRATO_RH',
  COMPROVANTE_LANCAMENTO: 'COMPROVANTE_LANCAMENTO',
  RELATORIO_TECNICO: 'RELATORIO_TECNICO',
  GERAL: 'GERAL',
} as const;
export type CategoriaDocumento = typeof CategoriaDocumento[keyof typeof CategoriaDocumento];

export interface Usuario {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  hash_senha: string;
  perfil: RoleUsuario;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Projeto {
  id: string;
  codigo_aneel: string;
  titulo: string;
  descricao: string | null;
  coordenador_id: string;
  coordenador_nome?: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  criado_em: string;
}

export interface RubricaProjeto {
  id: string;
  projeto_id: string;
  rubrica: CodigoRubrica;
  valor_previsto: number;
  valor_executado?: number;
  saldo?: number;
}

export interface Lancamento {
  id: string;
  rubrica_projeto_id: string;
  descricao: string;
  valor: number;
  data_despesa: string;
  usuario_registro_id: string;
  documento_id?: string | null;
  documento_nome?: string | null;
  usuario_nome?: string;
  rubrica?: CodigoRubrica;
  criado_em: string;
}

export interface AlocacaoRH {
  id: string;
  projeto_id: string;
  usuario_id: string;
  papel_projeto: RoleUsuario;
  nivel_academico: string;
  valor_nominal_capes: number;
  nivel_complemento: number;
  valor_mensal_calculado: number;
  nome_completo?: string;
  cpf?: string;
  email?: string;
  competencias?: CompetenciaFolha[];
}

export interface CompetenciaFolha {
  id: string;
  alocacao_rh_id: string;
  ano: number;
  mes: number;
  valor_devido: number;
  status: StatusFolha;
  data_baixa: string | null;
  usuario_baixa_nome?: string | null;
}

export interface DocumentoMetadados {
  id: string;
  projeto_id: string;
  categoria: CategoriaDocumento;
  nome_arquivo: string;
  extensao: string;
  mime_type: string;
  tamanho_bytes: number;
  hash_sha256: string;
  usuario_upload_id: string;
  usuario_nome?: string;
  criado_em: string;
}

export interface AuditLog {
  id: number;
  usuario_id: string;
  usuario_nome?: string;
  acao: string;
  tabela_origem: string;
  registro_id: string;
  estado_anterior: Record<string, unknown> | null;
  estado_posterior: Record<string, unknown> | null;
  endereco_ip: string;
  criado_em: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  perfil: RoleUsuario;
}
