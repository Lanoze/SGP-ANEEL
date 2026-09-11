'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import type { AuditLog } from '@/types';

export default function AuditoriaPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;
  return <Layout><AuditoriaContent /></Layout>;
}

function AuditoriaContent() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => (await api.get<AuditLog[]>('/auditoria')).data,
  });

  if (isLoading) return <div className="p-6 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Trilha de Auditoria</h1>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Usuário</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Ação</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tabela</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhum registro de auditoria</td></tr>}
            {logs?.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{new Date(log.criado_em).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3">{log.usuario_nome}</td>
                <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">{log.acao}</span></td>
                <td className="px-4 py-3 text-slate-500">{log.tabela_origem}</td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{log.registro_id?.slice(0, 8)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
