'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Modal, SelectInput } from '@/components/FormComponents';
import { createLancamentoSchema, type createLancamentoInput } from '@/lib/schemas';
import type { Projeto, RubricaProjeto, Lancamento } from '@/types';

const RUBRICA_LABELS: Record<string, string> = {
  RH: 'Recursos Humanos', ST: 'Serviços de Terceiros', MC: 'Materiais de Consumo',
  EP: 'Equipamentos', VD: 'Viagens e Diárias', OU: 'Outros Custos',
};

export default function ProjetoDetalhePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;
  return <Layout><ProjetoDetalheContent /></Layout>;
}

function ProjetoDetalheContent() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showLancamento, setShowLancamento] = useState(false);
  const [selectedRubrica, setSelectedRubrica] = useState<string | null>(null);

  const { data: projeto } = useQuery({ queryKey: ['projeto', id], queryFn: async () => (await api.get<Projeto>(`/projetos/${id}`)).data, enabled: !!id });
  const { data: rubricas } = useQuery({ queryKey: ['rubricas', id], queryFn: async () => (await api.get<RubricaProjeto[]>(`/projetos/${id}/rubricas`)).data, enabled: !!id });
  const { data: lancamentos } = useQuery({ queryKey: ['lancamentos', selectedRubrica], queryFn: async () => (await api.get<Lancamento[]>(`/lancamentos/rubrica/${selectedRubrica}`)).data, enabled: !!selectedRubrica });

  const lancamentoMutation = useMutation({
    mutationFn: async (data: createLancamentoInput) => (await api.post('/lancamentos', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rubricas'] }); queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); setShowLancamento(false); },
  });

  return (
    <div className="p-6">
      {projeto && (
        <>
          <div className="mb-6">
            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{projeto.codigo_aneel}</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">{projeto.titulo}</h1>
            <p className="text-slate-500 mt-1">{projeto.descricao}</p>
            <Link href={`/projetos/${id}/documentos`} className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800">📁 Gerenciar Documentos</Link>
          </div>
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Rubricas Orçamentárias</h2>
              <button onClick={() => setShowLancamento(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">+ Novo Lançamento</button>
            </div>
            <div className="grid gap-3">
              {rubricas?.map((r) => {
                const previsto = parseFloat(String(r.valor_previsto));
                const executado = parseFloat(String(r.valor_executado));
                const pct = previsto > 0 ? (executado / previsto) * 100 : 0;
                const cor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
                return (
                  <div key={r.id} className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedRubrica === r.id ? 'border-blue-500 bg-blue-50' : 'hover:border-slate-400'}`} onClick={() => setSelectedRubrica(selectedRubrica === r.id ? null : r.id)}>
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
                );
              })}
            </div>
          </div>
          {selectedRubrica && lancamentos && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Extrato de Lançamentos</h2>
              {lancamentos.length === 0 ? <p className="text-slate-500 text-sm">Nenhum lançamento registrado.</p> : (
                <div className="space-y-2">
                  {lancamentos.map((l) => (
                    <div key={l.id} className="flex justify-between items-center border-b py-2">
                      <div><p className="font-medium text-sm">{l.descricao}</p><p className="text-xs text-slate-500">{l.data_despesa} · {l.usuario_nome}</p></div>
                      <span className="text-sm font-semibold text-red-600">- R$ {parseFloat(String(l.valor)).toLocaleString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {showLancamento && (
            <LancamentoModal
              rubricaId={selectedRubrica}
              onClose={() => setShowLancamento(false)}
              onSubmit={(data) => lancamentoMutation.mutate(data)}
              isPending={lancamentoMutation.isPending}
            />
          )}
        </>
      )}
    </div>
  );
}

function LancamentoModal({ rubricaId, onClose, onSubmit, isPending }: { rubricaId: string | null; onClose: () => void; onSubmit: (data: createLancamentoInput) => void; isPending: boolean }) {
  const form = useForm<createLancamentoInput>({
    resolver: zodResolver(createLancamentoSchema),
    defaultValues: { rubrica_projeto_id: rubricaId || '', descricao: '', valor: 0, data_despesa: '' },
    mode: 'onChange',
  });

  return (
    <Modal open={true} onClose={onClose} title="Novo Lançamento"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={form.handleSubmit(onSubmit)} disabled={isPending || !form.formState.isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Registrando...' : 'Registrar'}
          </button>
        </>
      }>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
        <input {...form.register('descricao')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.descricao && <p className="text-red-500 text-xs mt-1">{form.formState.errors.descricao.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
        <input type="number" step="0.01" min="0.01" {...form.register('valor', { valueAsNumber: true })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.valor && <p className="text-red-500 text-xs mt-1">{form.formState.errors.valor.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
        <input type="date" {...form.register('data_despesa')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.data_despesa && <p className="text-red-500 text-xs mt-1">{form.formState.errors.data_despesa.message}</p>}
      </div>
    </Modal>
  );
}
