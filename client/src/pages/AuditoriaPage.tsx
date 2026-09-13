import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';
import type { AuditLog, Usuario } from '../types';

export default function AuditoriaPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
    if (isAuthenticated && user?.perfil !== 'GESTOR') navigate('/');
  }, [isAuthenticated, user, navigate]);
  if (!isAuthenticated || user?.perfil !== 'GESTOR') return null;
  return <Layout><AuditoriaContent /></Layout>;
}

function AuditoriaContent() {
  const [usuarioId, setUsuarioId] = useState('');
  const [tabela, setTabela] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const queryParams = new URLSearchParams();
  if (usuarioId) queryParams.set('usuario_id', usuarioId);
  if (tabela) queryParams.set('tabela_origem', tabela);
  if (dataInicio) queryParams.set('data_inicio', dataInicio);
  if (dataFim) queryParams.set('data_fim', dataFim);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', usuarioId, tabela, dataInicio, dataFim],
    queryFn: async () => (await api.get<AuditLog[]>(`/auditoria?${queryParams.toString()}`)).data,
  });

  const { data: usuarios } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios')).data,
  });

  const tabelas = ['usuarios', 'projetos', 'rubricas_projeto', 'lancamentos', 'alocacao_rh', 'competencias_folha', 'documentos_metadados', 'audit_logs'];

  function limparFiltros() { setUsuarioId(''); setTabela(''); setDataInicio(''); setDataFim(''); }

  if (isLoading) return <div className="p-6 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: 'Auditoria' }]} />
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Trilha de Auditoria</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Usuário</label>
            <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todos</option>
              {usuarios?.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tabela</label>
            <select value={tabela} onChange={(e) => setTabela(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todas</option>
              {tabelas.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={limparFiltros} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Limpar</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Usuário</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Ação</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tabela</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Registro</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs?.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum registro encontrado</td></tr>}
            {logs?.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-500">{new Date(log.criado_em).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3">{log.usuario_nome || 'Sistema'}</td>
                <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">{log.acao}</span></td>
                <td className="px-4 py-3 text-slate-500">{log.tabela_origem}</td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400">{log.registro_id?.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-xs text-slate-400">{log.endereco_ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
