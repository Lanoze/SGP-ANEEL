import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';
import type { Projeto, RubricaProjeto } from '../types';

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

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Todos os Projetos</h2>
        <div className="space-y-3">
          {(['RH', 'ST', 'MC', 'EP', 'VD', 'OU'] as const).map((rubrica) => {
            let previsto = 0;
            let executado = 0;
            todasRubricas?.forEach((item) => {
              const r = item.rubricas?.find((x) => x.rubrica === rubrica);
              if (r) {
                previsto += parseFloat(String(r.valor_previsto));
                executado += parseFloat(String(r.valor_executado));
              }
            });
            const pct = previsto > 0 ? (executado / previsto) * 100 : 0;
            const corBarra = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
            return (
              <div key={rubrica} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <span className="font-mono font-bold text-sm bg-slate-100 px-2 py-1 rounded">{rubrica}</span>
                    <span className="ml-2 text-slate-600 text-sm">{RUBRICA_LABELS[rubrica]}</span>
                  </div>
                  <span className="text-sm text-slate-500">{pct.toFixed(1)}%</span>
                </div>
                <div className="flex gap-4 text-xs text-slate-500 mb-1">
                  <span>Previsto: R$ {previsto.toLocaleString('pt-BR')}</span>
                  <span>Executado: R$ {executado.toLocaleString('pt-BR')}</span>
                  <span>Saldo: R$ {(previsto - executado).toLocaleString('pt-BR')}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div className={`${corBarra} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mb-4">Visão Geral dos Projetos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {todasRubricas?.map((item) => {
          const previsto = item.rubricas?.reduce((s, r) => s + parseFloat(String(r.valor_previsto)), 0) || 0;
          const executado = item.rubricas?.reduce((s, r) => s + parseFloat(String(r.valor_executado)), 0) || 0;
          const pct = previsto > 0 ? (executado / previsto) * 100 : 0;
          const corBarra = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
          return (
            <a key={item.projeto.id} href={`/projetos/${item.projeto.id}`} className="bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow block">
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{item.projeto.titulo}</h3>
                  <span className="text-xs text-slate-400 font-mono">{item.projeto.codigo_aneel}</span>
                </div>
                <span className="text-xs font-medium text-slate-500 shrink-0 ml-2">{pct.toFixed(1)}%</span>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 mb-2">
                <span>Previsto: R$ {previsto.toLocaleString('pt-BR')}</span>
                <span>Executado: R$ {executado.toLocaleString('pt-BR')}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className={`${corBarra} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="mt-2 flex gap-1 flex-wrap">
                {item.rubricas?.map((r) => {
                  const p = parseFloat(String(r.valor_previsto));
                  const e = parseFloat(String(r.valor_executado));
                  const rp = p > 0 ? (e / p) * 100 : 0;
                  return (
                    <span key={r.id} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${rp >= 100 ? 'bg-red-100 text-red-700' : rp >= 80 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.rubrica} {rp.toFixed(0)}%
                    </span>
                  );
                })}
              </div>
            </a>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mb-4">Detalhamento por Projeto</h2>
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
