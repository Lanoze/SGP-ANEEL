'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';

const RUBRICA_LABELS: Record<string, string> = {
  RH: 'Recursos Humanos', ST: 'Serviços de Terceiros', MC: 'Materiais de Consumo',
  EP: 'Equipamentos', VD: 'Viagens e Diárias', OU: 'Outros Custos',
};

export default function Home() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;
  return <Layout><DashboardContent /></Layout>;
}

function DashboardContent() {
  const { data: projetos } = useQuery({ queryKey: ['projetos'], queryFn: async () => (await api.get('/projetos')).data });
  const projetoId = projetos?.[0]?.id;
  const { data: rubricas } = useQuery({ queryKey: ['rubricas', projetoId], queryFn: async () => (await api.get(`/projetos/${projetoId}/rubricas`)).data, enabled: !!projetoId });

  const totalPrevisto = rubricas?.reduce((sum: number, r: any) => sum + parseFloat(r.valor_previsto), 0) ?? 0;
  const totalExecutado = rubricas?.reduce((sum: number, r: any) => sum + parseFloat(r.valor_executado), 0) ?? 0;
  const saldoGlobal = totalPrevisto - totalExecutado;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card titulo="Projetos Ativos" valor={projetos?.length?.toString() ?? '0'} cor="blue" />
        <Card titulo="Orçamento Total" valor={`R$ ${totalPrevisto.toLocaleString('pt-BR')}`} cor="slate" />
        <Card titulo="Executado" valor={`R$ ${totalExecutado.toLocaleString('pt-BR')}`} cor="amber" />
        <Card titulo="Saldo Global" valor={`R$ ${saldoGlobal.toLocaleString('pt-BR')}`} cor="green" />
      </div>
      {projetoId && rubricas && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Rubricas ANEEL - {projetos?.[0]?.titulo}</h2>
          <div className="space-y-4">
            {rubricas.map((r: any) => {
              const previsto = parseFloat(r.valor_previsto);
              const executado = parseFloat(r.valor_executado);
              const pct = previsto > 0 ? (executado / previsto) * 100 : 0;
              const corBarra = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
              return (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div><span className="font-mono font-bold text-sm bg-slate-100 px-2 py-1 rounded">{r.rubrica}</span><span className="ml-2 text-slate-600 text-sm">{RUBRICA_LABELS[r.rubrica]}</span></div>
                    <span className="text-sm text-slate-500">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-600 mb-2">
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
      )}
    </div>
  );
}

function Card({ titulo, valor, cor }: { titulo: string; valor: string; cor: string }) {
  const cores: Record<string, string> = { blue: 'bg-blue-50 text-blue-900 border-blue-200', slate: 'bg-slate-50 text-slate-900 border-slate-200', amber: 'bg-amber-50 text-amber-900 border-amber-200', green: 'bg-green-50 text-green-900 border-green-200' };
  return <div className={`rounded-xl border p-4 ${cores[cor]}`}><p className="text-sm opacity-75">{titulo}</p><p className="text-2xl font-bold mt-1">{valor}</p></div>;
}
