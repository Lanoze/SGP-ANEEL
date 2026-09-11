'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import type { Projeto } from '@/types';

export default function ProjetosPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;
  return <Layout><ProjetosContent /></Layout>;
}

function ProjetosContent() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: projetos, isLoading } = useQuery({
    queryKey: ['projetos'],
    queryFn: async () => (await api.get<Projeto[]>('/projetos')).data,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/projetos', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projetos'] }); setShowCreate(false); },
  });

  if (isLoading) return <div className="p-6 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Projetos</h1>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">+ Novo Projeto</button>
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Novo Projeto</h2>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createMutation.mutate({ codigo_aneel: fd.get('codigo_aneel'), titulo: fd.get('titulo'), descricao: fd.get('descricao'), coordenador_id: fd.get('coordenador_id'), data_inicio: fd.get('data_inicio'), data_fim: fd.get('data_fim') }); }} className="space-y-3">
              <Input name="codigo_aneel" label="Código ANEEL" required />
              <Input name="titulo" label="Título" required />
              <Input name="descricao" label="Descrição" />
              <Input name="coordenador_id" label="ID Coordenador (UUID)" required />
              <div className="grid grid-cols-2 gap-3">
                <Input name="data_inicio" label="Data Início" type="date" required />
                <Input name="data_fim" label="Data Fim" type="date" required />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="grid gap-4">
        {projetos?.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/projetos/${p.id}`)}>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">{p.codigo_aneel}</span>
                <h3 className="text-lg font-semibold mt-2">{p.titulo}</h3>
                <p className="text-slate-500 text-sm mt-1">Coordenador: {p.coordenador_nome}</p>
              </div>
              <div className="text-right text-sm text-slate-500"><p>{p.data_inicio} → {p.data_fim}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Input({ name, label, type = 'text', required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input name={name} type={type} required={required} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}
