import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';
import { Modal } from '../components/FormComponents';
import { createLancamentoSchema, createProjetoSchema, type createLancamentoInput, type createProjetoInput } from '../lib/schemas';
import type { Projeto, RubricaProjeto, Lancamento } from '../types';

const RUBRICA_LABELS: Record<string, string> = {
  RH: 'Recursos Humanos', ST: 'Serviços de Terceiros', MC: 'Materiais de Consumo',
  EP: 'Equipamentos', VD: 'Viagens e Diárias', OU: 'Outros Custos',
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ProjetoDetailPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!isAuthenticated) navigate('/login'); }, [isAuthenticated, navigate]);
  if (!isAuthenticated) return null;
  return <Layout><ProjetoDetalheContent /></Layout>;
}

function ProjetoDetalheContent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showLancamento, setShowLancamento] = useState(false);
  const [selectedRubrica, setSelectedRubrica] = useState<string | null>(null);
  const [editingProjeto, setEditingProjeto] = useState(false);
  const [deletingProjeto, setDeletingProjeto] = useState(false);
  const [editingLancamento, setEditingLancamento] = useState<Lancamento | null>(null);
  const [deletingLancamento, setDeletingLancamento] = useState<Lancamento | null>(null);
  const isGestor = user?.perfil === 'GESTOR';
  const canCreateLancamento = user?.perfil === 'GESTOR' || user?.perfil === 'COORDENADOR';
  const canViewRubricas = user?.perfil !== 'BOLSISTA';

  const { data: projeto } = useQuery({ queryKey: ['projeto', id], queryFn: async () => (await api.get<Projeto>(`/projetos/${id}`)).data, enabled: !!id });
  const { data: rubricas } = useQuery({ queryKey: ['rubricas', id], queryFn: async () => (await api.get<RubricaProjeto[]>(`/projetos/${id}/rubricas`)).data, enabled: !!id && canViewRubricas });
  const { data: lancamentos } = useQuery({ queryKey: ['lancamentos', selectedRubrica], queryFn: async () => (await api.get<{ data: Lancamento[] }>(`/lancamentos/rubrica/${selectedRubrica}`)).data.data, enabled: !!selectedRubrica });

  const [lancamentoError, setLancamentoError] = useState<string | null>(null);
  const lancamentoMutation = useMutation({
    mutationFn: async (data: createLancamentoInput) => (await api.post('/lancamentos', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rubricas'] }); queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); setShowLancamento(false); setLancamentoError(null); },
    onError: (err: unknown) => { const msg = (err && typeof err === 'object' && 'response' in err) ? (err as { response: { data?: { error?: string } } }).response?.data?.error || 'Erro ao registrar lançamento' : 'Erro ao registrar lançamento'; setLancamentoError(msg); },
  });

  const updateLancamentoMutation = useMutation({
    mutationFn: async ({ id: lancId, data }: { id: string; data: Partial<createLancamentoInput> }) => (await api.put(`/lancamentos/${lancId}`, data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rubricas'] }); queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); setEditingLancamento(null); },
    onError: (err: unknown) => { const msg = (err && typeof err === 'object' && 'response' in err) ? (err as { response: { data?: { error?: string } } }).response?.data?.error || 'Erro ao atualizar' : 'Erro ao atualizar'; alert(msg); },
  });

  const deleteLancamentoMutation = useMutation({
    mutationFn: async (lancId: string) => (await api.delete(`/lancamentos/${lancId}`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rubricas'] }); queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); setDeletingLancamento(null); },
    onError: (err: unknown) => { const msg = (err && typeof err === 'object' && 'response' in err) ? (err as { response: { data?: { error?: string } } }).response?.data?.error || 'Erro ao excluir' : 'Erro ao excluir'; alert(msg); },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<createProjetoInput>) => (await api.put(`/projetos/${id}`, data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projeto', id] }); queryClient.invalidateQueries({ queryKey: ['projetos'] }); setEditingProjeto(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => (await api.delete(`/projetos/${id}`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projetos'] }); navigate('/projetos'); },
  });

  return (
    <div className="p-6">
      {projeto && (
        <>
          <Breadcrumbs items={[{ label: 'Projetos', to: '/projetos' }, { label: projeto.codigo_aneel }]} />
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{projeto.codigo_aneel}</span>
                <h1 className="text-2xl font-bold text-slate-900 mt-2">{projeto.titulo}</h1>
                <p className="text-slate-500 mt-1">{projeto.descricao}</p>
                <p className="text-slate-400 text-sm mt-1">Coordenador: {projeto.coordenador_nome} · {fmtDate(projeto.data_inicio)} → {fmtDate(projeto.data_fim)}</p>
              </div>
              {isGestor && (
                <div className="flex gap-2">
                  <button onClick={() => setEditingProjeto(true)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300">Editar</button>
                  <button onClick={() => setDeletingProjeto(true)} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-300">Excluir</button>
                </div>
              )}
            </div>
            <Link to={`/projetos/${id}/documentos`} className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800">Gerenciar Documentos</Link>
          </div>
          {canViewRubricas && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Rubricas Orçamentárias</h2>
              {canCreateLancamento && <button onClick={() => setShowLancamento(true)} disabled={!!selectedRubrica && rubricas && (parseFloat(String(rubricas.find((r) => r.id === selectedRubrica)?.valor_previsto)) - parseFloat(String(rubricas.find((r) => r.id === selectedRubrica)?.valor_executado))) <= 0} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">+ Novo Lançamento</button>}
            </div>
            <div className="grid gap-3">
              {rubricas?.map((r) => {
                const previsto = parseFloat(String(r.valor_previsto));
                const executado = parseFloat(String(r.valor_executado));
                const pct = previsto > 0 ? (executado / previsto) * 100 : 0;
                const cor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
                const isSelected = selectedRubrica === r.id;
                return (
                  <div key={r.id} className="bg-white rounded-xl shadow">
                    <div className={`border rounded-lg p-4 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'hover:border-slate-400'}`} onClick={() => setSelectedRubrica(isSelected ? null : r.id)}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-sm bg-slate-100 px-2 py-1 rounded">{r.rubrica}</span>
                          <span className="text-sm text-slate-600">{RUBRICA_LABELS[r.rubrica]}</span>
                        </div>
                        <span className="text-sm font-medium">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="flex gap-6 text-sm text-slate-500 mt-2">
                        <span>Previsto: R$ {previsto.toLocaleString('pt-BR')}</span>
                        <span>Executado: R$ {executado.toLocaleString('pt-BR')}</span>
                        <span>Saldo: R$ {(previsto - executado).toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-2"><div className={`${cor} h-2 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                    </div>
                    {isSelected && canViewRubricas && (
                      <div className="border-t px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Lançamentos</h3>
                        {!lancamentos ? (
                          <p className="text-slate-400 text-xs">Carregando...</p>
                        ) : lancamentos.length === 0 ? (
                          <p className="text-slate-400 text-xs">Nenhum lançamento registrado.</p>
                        ) : (
                          <div className="space-y-1">
                            {lancamentos.map((l) => (
                              <div key={l.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                                <div>
                                  <p className="font-medium text-sm">{l.descricao}</p>
                                  <p className="text-xs text-slate-500">{fmtDate(l.data_despesa)} · {l.usuario_nome}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold text-red-600">- R$ {parseFloat(String(l.valor)).toLocaleString('pt-BR')}</span>
                                  {canCreateLancamento && (
                                    <div className="flex gap-1">
                                      <button onClick={() => setEditingLancamento(l)} className="text-xs text-blue-600 hover:text-blue-800 px-1">Editar</button>
                                      <button onClick={() => setDeletingLancamento(l)} className="text-xs text-red-600 hover:text-red-800 px-1">Excluir</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}
          {showLancamento && (
            <LancamentoModal
              rubricaId={selectedRubrica}
              rubricas={rubricas}
              onClose={() => { setShowLancamento(false); setLancamentoError(null); }}
              onSubmit={(data) => { setLancamentoError(null); lancamentoMutation.mutate(data); }}
              isPending={lancamentoMutation.isPending}
              error={lancamentoError}
            />
          )}
          {editingLancamento && (
            <EditLancamentoModal
              lancamento={editingLancamento}
              rubricas={rubricas}
              onClose={() => setEditingLancamento(null)}
              onSubmit={(data) => updateLancamentoMutation.mutate({ id: editingLancamento.id, data })}
              isPending={updateLancamentoMutation.isPending}
            />
          )}
          {deletingLancamento && (
            <ConfirmDeleteLancamentoModal
              lancamento={deletingLancamento}
              onClose={() => setDeletingLancamento(null)}
              onConfirm={() => deleteLancamentoMutation.mutate(deletingLancamento.id)}
              isPending={deleteLancamentoMutation.isPending}
            />
          )}
          {editingProjeto && projeto && (
            <EditProjetoModal
              projeto={projeto}
              onClose={() => setEditingProjeto(false)}
              onSubmit={(data) => updateMutation.mutate(data)}
              isPending={updateMutation.isPending}
              error={updateMutation.error?.message}
            />
          )}
          {deletingProjeto && (
            <ConfirmDeleteProjetoModal
              titulo={projeto?.titulo || ''}
              onClose={() => setDeletingProjeto(false)}
              onConfirm={() => deleteMutation.mutate()}
              isPending={deleteMutation.isPending}
              error={deleteMutation.error?.message}
            />
          )}
        </>
      )}
    </div>
  );
}

function LancamentoModal({ rubricaId, rubricas, onClose, onSubmit, isPending, error }: { rubricaId: string | null; rubricas: RubricaProjeto[] | undefined; onClose: () => void; onSubmit: (data: createLancamentoInput) => void; isPending: boolean; error?: string | null }) {
  const form = useForm<createLancamentoInput>({
    resolver: zodResolver(createLancamentoSchema),
    defaultValues: { rubrica_projeto_id: rubricaId || '', descricao: '', valor: 0, data_despesa: '' },
    mode: 'onChange',
  });
  const selectedId = form.watch('rubrica_projeto_id');
  const valorAtual = form.watch('valor');
  const selectedRubrica = rubricas?.find((r) => r.id === selectedId);
  const saldoRubrica = selectedRubrica ? parseFloat(String(selectedRubrica.valor_previsto)) - parseFloat(String(selectedRubrica.valor_executado)) : null;
  const semSaldo = saldoRubrica !== null && saldoRubrica <= 0;
  const excedeSaldo = saldoRubrica !== null && (valorAtual ?? 0) > 0 && (valorAtual ?? 0) > saldoRubrica;

  useEffect(() => {
    if (rubricaId) form.setValue('rubrica_projeto_id', rubricaId, { shouldValidate: true });
  }, [rubricaId, form]);

  return (
    <Modal open={true} onClose={onClose} title="Novo Lançamento"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={form.handleSubmit(onSubmit)} disabled={isPending || !form.formState.isValid || semSaldo || excedeSaldo}
            className={`px-4 py-2 rounded-lg text-sm ${isPending || !form.formState.isValid || semSaldo || excedeSaldo ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {isPending ? 'Registrando...' : 'Registrar'}
          </button>
        </>
      }>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Rubrica</label>
        <select {...form.register('rubrica_projeto_id')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">Selecione a rubrica...</option>
          {rubricas?.filter((r) => r.rubrica !== 'RH').map((r) => <option key={r.id} value={r.id}>{r.rubrica} - {RUBRICA_LABELS[r.rubrica]}</option>)}
        </select>
        {form.formState.errors.rubrica_projeto_id && <p className="text-red-500 text-xs mt-1">{form.formState.errors.rubrica_projeto_id.message}</p>}
      </div>
      {semSaldo && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">Saldo insuficiente nesta rubrica (R$ {saldoRubrica?.toLocaleString('pt-BR')}). Não é possível registrar lançamentos.</div>}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
        <input {...form.register('descricao')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.descricao && <p className="text-red-500 text-xs mt-1">{form.formState.errors.descricao.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
        <input type="number" step="0.01" min="0.01" {...form.register('valor', { valueAsNumber: true })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.valor && <p className="text-red-500 text-xs mt-1">{form.formState.errors.valor.message}</p>}
        {excedeSaldo && <p className="text-red-600 text-xs mt-1">Valor excede o saldo disponível da rubrica (R$ {saldoRubrica?.toLocaleString('pt-BR')}).</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
        <input type="date" {...form.register('data_despesa')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.data_despesa && <p className="text-red-500 text-xs mt-1">{form.formState.errors.data_despesa.message}</p>}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
    </Modal>
  );
}

function EditLancamentoModal({ lancamento, rubricas, onClose, onSubmit, isPending }: { lancamento: Lancamento; rubricas: RubricaProjeto[] | undefined; onClose: () => void; onSubmit: (data: Partial<createLancamentoInput>) => void; isPending: boolean }) {
  const form = useForm<Partial<createLancamentoInput>>({
    resolver: zodResolver(createLancamentoSchema.partial()),
    defaultValues: { rubrica_projeto_id: lancamento.rubrica_projeto_id, descricao: lancamento.descricao, valor: parseFloat(String(lancamento.valor)), data_despesa: lancamento.data_despesa?.split('T')[0] || '' },
    mode: 'onChange',
  });
  const selectedId = form.watch('rubrica_projeto_id');
  const valorAtual = form.watch('valor');
  const selectedRubrica = rubricas?.find((r) => r.id === selectedId);
  const saldoRubrica = selectedRubrica ? parseFloat(String(selectedRubrica.valor_previsto)) - parseFloat(String(selectedRubrica.valor_executado)) : null;
  const valorAntigo = lancamento.rubrica_projeto_id === selectedId ? parseFloat(String(lancamento.valor)) : 0;
  const saldoComReversao = saldoRubrica !== null ? saldoRubrica + valorAntigo : null;
  const excedeSaldo = saldoComReversao !== null && (valorAtual ?? 0) > 0 && (valorAtual ?? 0) > saldoComReversao;

  return (
    <Modal open={true} onClose={onClose} title="Editar Lançamento"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={form.handleSubmit(onSubmit)} disabled={isPending || !form.formState.isValid || excedeSaldo}
            className={`px-4 py-2 rounded-lg text-sm ${isPending || !form.formState.isValid || excedeSaldo ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Rubrica</label>
        <select {...form.register('rubrica_projeto_id')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
          {rubricas?.filter((r) => r.rubrica !== 'RH').map((r) => <option key={r.id} value={r.id}>{r.rubrica} - {RUBRICA_LABELS[r.rubrica]}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
        <input {...form.register('descricao')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.descricao && <p className="text-red-500 text-xs mt-1">{form.formState.errors.descricao.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
        <input type="number" step="0.01" min="0.01" {...form.register('valor', { valueAsNumber: true })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.valor && <p className="text-red-500 text-xs mt-1">{form.formState.errors.valor.message}</p>}
        {excedeSaldo && <p className="text-red-600 text-xs mt-1">Valor excede o saldo disponível da rubrica (R$ {saldoComReversao?.toLocaleString('pt-BR')}).</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
        <input type="date" {...form.register('data_despesa')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.data_despesa && <p className="text-red-500 text-xs mt-1">{form.formState.errors.data_despesa.message}</p>}
      </div>
    </Modal>
  );
}

function ConfirmDeleteLancamentoModal({ lancamento, onClose, onConfirm, isPending }: { lancamento: Lancamento; onClose: () => void; onConfirm: () => void; isPending: boolean }) {
  return (
    <Modal open={true} onClose={onClose} title="Excluir Lançamento"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={onConfirm} disabled={isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
            {isPending ? 'Excluindo...' : 'Excluir'}
          </button>
        </>
      }>
      <p className="text-sm text-slate-600">Tem certeza que deseja excluir o lançamento <strong>{lancamento.descricao}</strong>?</p>
      <p className="text-xs text-slate-500 mt-1">Valor: R$ {parseFloat(String(lancamento.valor)).toLocaleString('pt-BR')} · {fmtDate(lancamento.data_despesa)}</p>
    </Modal>
  );
}

function EditProjetoModal({ projeto, onClose, onSubmit, isPending, error }: { projeto: Projeto; onClose: () => void; onSubmit: (d: Partial<createProjetoInput>) => void; isPending: boolean; error?: string }) {
  const form = useForm<createProjetoInput>({
    resolver: zodResolver(createProjetoSchema),
    defaultValues: { codigo_aneel: projeto.codigo_aneel, titulo: projeto.titulo, descricao: projeto.descricao || '', coordenador_id: projeto.coordenador_id, data_inicio: projeto.data_inicio, data_fim: projeto.data_fim },
    mode: 'onChange',
  });

  return (
    <Modal open={true} onClose={onClose} title="Editar Projeto"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={form.handleSubmit(onSubmit)} disabled={isPending || !form.formState.isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Código ANEEL</label>
        <input {...form.register('codigo_aneel')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.codigo_aneel && <p className="text-red-500 text-xs mt-1">{form.formState.errors.codigo_aneel.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
        <input {...form.register('titulo')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.titulo && <p className="text-red-500 text-xs mt-1">{form.formState.errors.titulo.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
        <input {...form.register('descricao')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">ID Coordenador (UUID)</label>
        <input {...form.register('coordenador_id')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.coordenador_id && <p className="text-red-500 text-xs mt-1">{form.formState.errors.coordenador_id.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
          <input type="date" {...form.register('data_inicio')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
          <input type="date" {...form.register('data_fim')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </Modal>
  );
}

function ConfirmDeleteProjetoModal({ titulo, onClose, onConfirm, isPending, error }: { titulo: string; onClose: () => void; onConfirm: () => void; isPending: boolean; error?: string }) {
  return (
    <Modal open={true} onClose={onClose} title="Confirmar Exclusão"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={onConfirm} disabled={isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
            {isPending ? 'Excluindo...' : 'Excluir'}
          </button>
        </>
      }>
      <p className="text-sm text-slate-600">Tem certeza que deseja excluir o projeto <strong>{titulo}</strong>?</p>
      <p className="text-xs text-red-500 mt-1">Esta ação irá excluir todas as rubricas, lançamentos e documentos associados.</p>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </Modal>
  );
}
