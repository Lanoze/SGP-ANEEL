import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';
import { Modal } from '../components/FormComponents';
import { createUsuarioSchema, type createUsuarioInput } from '../lib/schemas';
import type { Usuario } from '../types';

export default function UsuáriosPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!isAuthenticated || user?.perfil !== 'GESTOR') navigate('/'); }, [isAuthenticated, user, navigate]);
  if (!isAuthenticated || user?.perfil !== 'GESTOR') return null;
  return <Layout><UsuáriosContent /></Layout>;
}

function UsuáriosContent() {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState<Usuario | null>(null);
  const queryClient = useQueryClient();

  const { data: usuarios, isLoading } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios')).data,
  });

  const createMutation = useMutation({
    mutationFn: async (data: createUsuarioInput) => (await api.post('/usuarios', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['usuarios'] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Usuario>) => (await api.put(`/usuarios/${editing!.id}`, data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['usuarios'] }); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => (await api.delete(`/usuarios/${deleting!.id}`)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['usuarios'] }); setDeleting(null); },
  });

  if (isLoading) return <div className="p-6 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: 'Usuários' }]} />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">+ Novo Usuário</button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">CPF</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Perfil</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios?.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{u.nome_completo}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.perfil === 'GESTOR' ? 'bg-purple-100 text-purple-700' :
                    u.perfil === 'COORDENADOR' ? 'bg-blue-100 text-blue-700' :
                    u.perfil === 'PESQUISADOR' ? 'bg-green-100 text-green-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>{u.perfil}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => setEditing(u)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                  <button onClick={() => setDeleting(u)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUsuarioModal onClose={() => setShowCreate(false)} onSubmit={(d) => createMutation.mutate(d)} isPending={createMutation.isPending} error={createMutation.error?.message} />}
      {editing && <EditUsuarioModal usuario={editing} onClose={() => setEditing(null)} onSubmit={(d) => updateMutation.mutate(d)} isPending={updateMutation.isPending} error={updateMutation.error?.message} />}
      {deleting && <ConfirmDeleteModal nome={deleting.nome_completo} onClose={() => setDeleting(null)} onConfirm={() => deleteMutation.mutate()} isPending={deleteMutation.isPending} error={deleteMutation.error?.message} />}
    </div>
  );
}

function CreateUsuarioModal({ onClose, onSubmit, isPending, error }: { onClose: () => void; onSubmit: (d: createUsuarioInput) => void; isPending: boolean; error?: string }) {
  const form = useForm<createUsuarioInput>({
    resolver: zodResolver(createUsuarioSchema),
    defaultValues: { nome_completo: '', cpf: '', email: '', senha: '', perfil: 'BOLSISTA' },
    mode: 'onChange',
  });

  return (
    <Modal open={true} onClose={onClose} title="Novo Usuário"
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
        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
        <input {...form.register('nome_completo')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.nome_completo && <p className="text-red-500 text-xs mt-1">{form.formState.errors.nome_completo.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">CPF (somente números)</label>
        <input {...form.register('cpf')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" maxLength={11} />
        {form.formState.errors.cpf && <p className="text-red-500 text-xs mt-1">{form.formState.errors.cpf.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input type="email" {...form.register('email')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
        <input type="password" {...form.register('senha')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.senha && <p className="text-red-500 text-xs mt-1">{form.formState.errors.senha.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Perfil</label>
        <select {...form.register('perfil')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="GESTOR">Gestor</option>
          <option value="COORDENADOR">Coordenador</option>
          <option value="PESQUISADOR">Pesquisador</option>
          <option value="BOLSISTA">Bolsista</option>
        </select>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </Modal>
  );
}

interface EditUsuarioInput {
  nome_completo: string;
  email: string;
  perfil: 'GESTOR' | 'COORDENADOR' | 'PESQUISADOR' | 'BOLSISTA';
  ativo: boolean;
}

function EditUsuarioModal({ usuario, onClose, onSubmit, isPending, error }: { usuario: Usuario; onClose: () => void; onSubmit: (d: EditUsuarioInput) => void; isPending: boolean; error?: string }) {
  const form = useForm<EditUsuarioInput>({
    defaultValues: { nome_completo: usuario.nome_completo, email: usuario.email, perfil: usuario.perfil, ativo: usuario.ativo },
    mode: 'onChange',
  });

  return (
    <Modal open={true} onClose={onClose} title="Editar Usuário"
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
        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
        <input {...form.register('nome_completo')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input type="email" {...form.register('email')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Perfil</label>
        <select {...form.register('perfil')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="GESTOR">Gestor</option>
          <option value="COORDENADOR">Coordenador</option>
          <option value="PESQUISADOR">Pesquisador</option>
          <option value="BOLSISTA">Bolsista</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="ativo" {...form.register('ativo')} className="rounded border-slate-300" />
        <label htmlFor="ativo" className="text-sm font-medium text-slate-700">Ativo</label>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </Modal>
  );
}

function ConfirmDeleteModal({ nome, onClose, onConfirm, isPending, error }: { nome: string; onClose: () => void; onConfirm: () => void; isPending: boolean; error?: string }) {
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
      <p className="text-sm text-slate-600">Tem certeza que deseja excluir o usuário <strong>{nome}</strong>?</p>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </Modal>
  );
}
