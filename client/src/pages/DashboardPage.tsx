import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';
import type { Projeto, RubricaProjeto, Usuario } from '../types';

const RUBRICA_LABELS: Record<string, string> = {
  RH: 'Recursos Humanos', ST: 'Serviços de Terceiros', MC: 'Materiais de Consumo',
  EP: 'Equipamentos', VD: 'Viagens e Diárias', OU: 'Outros Custos',
};

interface ProjetoComRubricas { projeto: Projeto; rubricas: RubricaProjeto[]; }

export default function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!isAuthenticated) navigate('/login'); }, [isAuthenticated, navigate]);
  if (!isAuthenticated) return null;
  return <Layout><DashboardContent /></Layout>;
}

function DashboardContent() {
  const { user } = useAuth();

  const { data: projetos } = useQuery<Projeto[]>({ queryKey: ['projetos'], queryFn: async () => (await api.get('/projetos')).data });

  const { data: todasRubricas } = useQuery<ProjetoComRubricas[]>({
    queryKey: ['todas-rubricas'],
    queryFn: async () => {
      if (!projetos?.length) return [];
      const results = await Promise.all(
        projetos.map(async (p) => {
          const r = await api.get<RubricaProjeto[]>(`/projetos/${p.id}/rubricas`);
          return { projeto: p, rubricas: r.data };
        })
      );
      return results;
    },
    enabled: !!projetos?.length,
  });

  let totalPrevisto = 0;
  let totalExecutado = 0;
  todasRubricas?.forEach((item) => {
    item.rubricas?.forEach((r) => {
      totalPrevisto += parseFloat(String(r.valor_previsto));
      totalExecutado += parseFloat(String(r.valor_executado));
    });
  });
  const saldoGlobal = totalPrevisto - totalExecutado;
  const pctGeral = totalPrevisto > 0 ? (totalExecutado / totalPrevisto) * 100 : 0;

  return (
    <div className="p-6">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card titulo="Projetos Ativos" valor={projetos?.length?.toString() ?? '0'} cor="blue" />
        <Card titulo="Orçamento Total" valor={`R$ ${totalPrevisto.toLocaleString('pt-BR')}`} cor="slate" />
        <Card titulo="Executado" valor={`R$ ${totalExecutado.toLocaleString('pt-BR')}`} cor="amber" />
        <Card titulo="Saldo Global" valor={`R$ ${saldoGlobal.toLocaleString('pt-BR')}`} cor="green" />
        <Card titulo="% Execução" valor={`${pctGeral.toFixed(1)}%`} cor={pctGeral >= 100 ? 'red' : pctGeral >= 80 ? 'amber' : 'green'} />
      </div>

      {todasRubricas?.map((item) => (
        <div key={item.projeto.id} className="bg-white rounded-xl shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{item.projeto.titulo} <span className="text-sm text-slate-400 font-normal">({item.projeto.codigo_aneel})</span></h2>
          <div className="space-y-3">
            {item.rubricas?.map((r) => {
              const previsto = parseFloat(String(r.valor_previsto));
              const executado = parseFloat(String(r.valor_executado));
              const pct = previsto > 0 ? (executado / previsto) * 100 : 0;
              const corBarra = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
              return (
                <div key={r.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <div><span className="font-mono font-bold text-sm bg-slate-100 px-2 py-1 rounded">{r.rubrica}</span><span className="ml-2 text-slate-600 text-sm">{RUBRICA_LABELS[r.rubrica]}</span></div>
                    <span className="text-sm text-slate-500">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500 mb-1">
                    <span>Previsto: R$ {previsto.toLocaleString('pt-BR')}</span>
                    <span>Executado: R$ {executado.toLocaleString('pt-BR')}</span>
                    <span>Saldo: R$ {(previsto - executado).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2"><div className={`${corBarra} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {user?.perfil === 'GESTOR' && <ResetPasswordSection />}
    </div>
  );
}

function ResetPasswordSection() {
  const [usuarioId, setUsuarioId] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const { data: usuarios } = useQuery<Usuario[]>({ queryKey: ['usuarios'], queryFn: async () => (await api.get('/usuarios')).data });

  const mutation = useMutation({
    mutationFn: async () => (await api.post('/auth/reset-password', { usuario_id: usuarioId, nova_senha: novaSenha })).data,
    onSuccess: (data) => { setMsg(data.message); setErr(''); setUsuarioId(''); setNovaSenha(''); },
    onError: (e: Error) => { setErr(e.message); setMsg(''); },
  });

  return (
    <div className="bg-white rounded-xl shadow p-6 mt-6">
      <h2 className="text-lg font-semibold mb-4">Redefinir Senha de Usuário</h2>
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">Usuário</label>
          <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="">Selecione...</option>
            {usuarios?.map((u) => <option key={u.id} value={u.id}>{u.nome_completo} ({u.email})</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
          <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <button onClick={() => mutation.mutate()} disabled={!usuarioId || !novaSenha || mutation.isPending}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
          {mutation.isPending ? 'Redefinindo...' : 'Redefinir'}
        </button>
      </div>
      {msg && <p className="text-green-600 text-sm mt-2">{msg}</p>}
      {err && <p className="text-red-500 text-sm mt-2">{err}</p>}
    </div>
  );
}

function Card({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) {
  const cores: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-900 border-blue-200',
    slate: 'bg-slate-50 text-slate-900 border-slate-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    green: 'bg-green-50 text-green-900 border-green-200',
    red: 'bg-red-50 text-red-900 border-red-200',
  };
  return <div className={`rounded-xl border p-4 ${cores[cor]}`}><p className="text-sm opacity-75">{titulo}</p><p className="text-2xl font-bold mt-1">{valor}</p></div>;
}
