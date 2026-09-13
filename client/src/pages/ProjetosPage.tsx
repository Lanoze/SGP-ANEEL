import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';
import { Modal, SelectInput } from '../components/FormComponents';
import { createProjetoSchema, type createProjetoInput } from '../lib/schemas';
import type { Projeto, Usuario } from '../types';

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ProjetosPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!isAuthenticated) navigate('/login'); }, [isAuthenticated, navigate]);
  if (!isAuthenticated) return null;
  return <Layout><ProjetosContent /></Layout>;
}

function ProjetosContent() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGestor = user?.perfil === 'GESTOR';

  const { data: projetos, isLoading } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: async () => (await api.get('/projetos')).data,
  });

  const createMutation = useMutation({
    mutationFn: async (data: createProjetoInput) => (await api.post('/projetos', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projetos'] }); setShowCreate(false); },
  });

  if (isLoading) return <div className="p-6 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: 'Projetos' }]} />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Projetos</h1>
        {isGestor && <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">+ Novo Projeto</button>}
      </div>
      {showCreate && (
        <CreateProjetoModal onClose={() => setShowCreate(false)} onSubmit={(d) => createMutation.mutate(d)} isPending={createMutation.isPending} />
      )}
      <div className="grid gap-4">
        {projetos?.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/projetos/${p.id}`)}>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{p.codigo_aneel}</span>
                <h3 className="text-lg font-semibold mt-2">{p.titulo}</h3>
                <p className="text-slate-500 text-sm mt-1">Coordenador: {p.coordenador_nome}</p>
              </div>
              <div className="text-right text-sm text-slate-500"><p>{fmtDate(p.data_inicio)} → {fmtDate(p.data_fim)}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateProjetoModal({ onClose, onSubmit, isPending }: { onClose: () => void; onSubmit: (d: createProjetoInput) => void; isPending: boolean }) {
  const { data: usuarios } = useQuery<Usuario[]>({ queryKey: ['usuarios'], queryFn: async () => (await api.get('/usuarios')).data });
  const coordOptions = usuarios?.filter((u) => u.perfil === 'GESTOR' || u.perfil === 'COORDENADOR').map((u) => ({ value: u.id, label: `${u.nome_completo} (${u.perfil})` })) || [];

  const form = useForm<createProjetoInput>({
    resolver: zodResolver(createProjetoSchema),
    defaultValues: { codigo_aneel: '', titulo: '', descricao: '', coordenador_id: '', data_inicio: '', data_fim: '' },
    mode: 'onChange',
  });

  return (
    <Modal open={true} onClose={onClose} title="Novo Projeto"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={form.handleSubmit(onSubmit)} disabled={isPending || !form.formState.isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {isPending ? 'Criando...' : 'Criar'}
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
        <label className="block text-sm font-medium text-slate-700 mb-1">Coordenador</label>
        <SelectInput value={form.watch('coordenador_id')} onValueChange={(v) => form.setValue('coordenador_id', v)} placeholder="Selecione o coordenador..." options={coordOptions} />
        {form.formState.errors.coordenador_id && <p className="text-red-500 text-xs mt-1">{form.formState.errors.coordenador_id.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
          <input type="date" {...form.register('data_inicio')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          {form.formState.errors.data_inicio && <p className="text-red-500 text-xs mt-1">{form.formState.errors.data_inicio.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
          <input type="date" {...form.register('data_fim')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          {form.formState.errors.data_fim && <p className="text-red-500 text-xs mt-1">{form.formState.errors.data_fim.message}</p>}
        </div>
      </div>
    </Modal>
  );
}
