import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';
import type { AuditLog, Usuario } from '../types';

interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

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
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (usuarioId) queryParams.set('usuario_id', usuarioId);
  if (tabela) queryParams.set('tabela_origem', tabela);
  if (dataInicio) queryParams.set('data_inicio', dataInicio);
  if (dataFim) queryParams.set('data_fim', dataFim);
  queryParams.set('page', String(page));
  queryParams.set('limit', '50');

  const { data: response, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit-logs', usuarioId, tabela, dataInicio, dataFim, page],
    queryFn: async () => (await api.get<AuditResponse>(`/auditoria?${queryParams.toString()}`)).data,
  });

  const { data: usuarios } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await api.get('/usuarios')).data,
  });

  const logs = response?.data || [];
  const total = response?.total || 0;
  const limit = response?.limit || 50;
  const totalPages = Math.ceil(total / limit);

  const tabelas = ['usuarios', 'projetos', 'rubricas_projeto', 'lancamentos', 'alocacao_rh', 'competencias_folha', 'documentos_metadados', 'audit_logs'];

  function limparFiltros() { setUsuarioId(''); setTabela(''); setDataInicio(''); setDataFim(''); setPage(1); }

  function copiarUUID(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function formatJSON(obj: Record<string, unknown> | null) {
    if (!obj) return null;
    return Object.entries(obj).map(([key, val]) => {
      const display = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
      return (
        <div key={key} className="flex gap-2 text-xs">
          <span className="font-mono text-slate-500 min-w-[140px]">{key}:</span>
          <span className="font-mono text-slate-800 break-all">{display}</span>
        </div>
      );
    });
  }

  if (isLoading) return <div className="p-6 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: 'Auditoria' }]} />
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Trilha de Auditoria</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Usuário</label>
            <select value={usuarioId} onChange={(e) => { setUsuarioId(e.target.value); setPage(1); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todos</option>
              {usuarios?.map((u) => <option key={u.id} value={u.id}>{u.nome_completo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tabela</label>
            <select value={tabela} onChange={(e) => { setTabela(e.target.value); setPage(1); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todas</option>
              {tabelas.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPage(1); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPage(1); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
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
              <th className="text-left px-4 py-3 font-medium text-slate-600 w-8"></th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Usuário</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Ação</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Tabela</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Registro</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhum registro encontrado</td></tr>}
            {logs.map((log) => {
              const isExpanded = expandedId === log.id;
              const hasDetails = log.estado_anterior || log.estado_posterior;
              return (
                <>
                  <tr key={log.id} className={`hover:bg-slate-50 ${hasDetails ? 'cursor-pointer' : ''}`} onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}>
                    <td className="px-4 py-3 text-slate-400 text-xs">{hasDetails ? (isExpanded ? '▾' : '▸') : ''}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(log.criado_em).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3">{log.usuario_nome || 'Sistema'}</td>
                    <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">{log.acao}</span></td>
                    <td className="px-4 py-3 text-slate-500">{log.tabela_origem}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500" title={log.registro_id || ''}>
                        {log.registro_id ? (
                          <button onClick={(e) => { e.stopPropagation(); copiarUUID(log.registro_id); }} className="hover:text-blue-600 transition-colors">
                            {log.registro_id.slice(0, 8)}...{copiedId === log.registro_id && <span className="text-green-600 ml-1">copiado</span>}
                          </button>
                        ) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{log.endereco_ip}</td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={7} className="px-4 py-3 bg-slate-50 border-b">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {log.estado_anterior && (
                            <div>
                              <p className="font-medium text-slate-600 mb-1">Estado Anterior</p>
                              <div className="bg-white rounded p-2 border space-y-0.5">{formatJSON(log.estado_anterior)}</div>
                            </div>
                          )}
                          {log.estado_posterior && (
                            <div>
                              <p className="font-medium text-slate-600 mb-1">Estado Posterior</p>
                              <div className="bg-white rounded p-2 border space-y-0.5">{formatJSON(log.estado_posterior)}</div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Mostrando {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} de {total}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
              <span className="px-3 py-1 text-slate-600 font-medium">Página {page} de {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-1 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
