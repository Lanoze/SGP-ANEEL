import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Breadcrumbs from '../components/Breadcrumbs';

const RUBRICA_LABELS: Record<string, string> = {
  RH: 'Recursos Humanos', ST: 'Serviços de Terceiros', MC: 'Materiais de Consumo',
  EP: 'Equipamentos', VD: 'Viagens e Diárias', OU: 'Outros Custos',
};
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface RubricaRel {
  codigo_aneel: string; titulo: string; rubrica: string;
  valor_previsto: string; valor_executado: string; saldo: string;
}
interface FolhaRel {
  codigo_aneel: string; nome_completo: string; perfil: string;
  nivel_academico: string; valor_mensal_calculado: string;
  ano: number; mes: number; valor_devido: string; status: string;
}
interface PendenciaRel {
  codigo_aneel: string; nome_completo: string; nivel_academico: string;
  ano: number; mes: number; valor_devido: string;
}
interface InstituicaoRel {
  nome_completo: string; perfil: string; email: string;
  total_projetos: number; valor_mensal_total: string;
  competencias_pendentes: number; competencias_pagas: number;
  total_pendente: string; total_pago: string;
}

export default function RelatoriosPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
    if (isAuthenticated && user?.perfil === 'BOLSISTA') navigate('/');
  }, [isAuthenticated, user, navigate]);
  if (!isAuthenticated || user?.perfil === 'BOLSISTA') return null;
  return <Layout><RelatoriosContent /></Layout>;
}

function RelatoriosContent() {
  const [aba, setAba] = useState<'rubricas' | 'folha' | 'folha_instituicao' | 'pendencias'>('rubricas');

  const { data: rubricasDados, isLoading: loadingRubricas } = useQuery<RubricaRel[]>({
    queryKey: ['rel-rubricas'],
    queryFn: async () => (await api.get('/relatorios?tipo=rubricas')).data,
    enabled: aba === 'rubricas',
  });

  const { data: folhaDados, isLoading: loadingFolha } = useQuery<FolhaRel[]>({
    queryKey: ['rel-folha'],
    queryFn: async () => (await api.get('/relatorios?tipo=folha')).data,
    enabled: aba === 'folha',
  });

  const { data: pendDados, isLoading: loadingPend } = useQuery<PendenciaRel[]>({
    queryKey: ['rel-pendencias'],
    queryFn: async () => (await api.get('/relatorios?tipo=pendencias')).data,
    enabled: aba === 'pendencias',
  });

  const { data: instDados, isLoading: loadingInst } = useQuery<InstituicaoRel[]>({
    queryKey: ['rel-instituicao'],
    queryFn: async () => (await api.get('/relatorios?tipo=folha_instituicao')).data,
    enabled: aba === 'folha_instituicao',
  });

  const isLoading = loadingRubricas || loadingFolha || loadingPend || loadingInst;

  return (
    <div className="p-6">
      <style>{`
        @media print {
          aside, nav, button, .no-print { display: none !important; }
          main { overflow: visible !important; }
          .print-container { padding: 0 !important; }
          .print-container > div { box-shadow: none !important; border: 1px solid #ddd !important; }
          table { font-size: 11px !important; }
          th, td { padding: 4px 8px !important; }
          body { font-size: 12px !important; }
          @page { margin: 1.5cm; size: landscape; }
        }
      `}</style>
      <div className="flex justify-between items-center mb-6 no-print">
        <div>
          <Breadcrumbs items={[{ label: 'Relatórios' }]} />
          <h1 className="text-2xl font-bold text-slate-900">Relatórios Gerenciais</h1>
        </div>
        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800">Imprimir / PDF</button>
      </div>

      <div className="flex gap-2 mb-6 no-print">
        <button onClick={() => setAba('rubricas')} className={`px-4 py-2 rounded-lg text-sm font-medium ${aba === 'rubricas' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Relatório ANEEL por Rubricas</button>
        <button onClick={() => setAba('folha')} className={`px-4 py-2 rounded-lg text-sm font-medium ${aba === 'folha' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Extrato Mensal da Folha</button>
        <button onClick={() => setAba('pendencias')} className={`px-4 py-2 rounded-lg text-sm font-medium ${aba === 'pendencias' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Relatório de Pendências</button>
        <button onClick={() => setAba('folha_instituicao')} className={`px-4 py-2 rounded-lg text-sm font-medium ${aba === 'folha_instituicao' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Folha Instituição</button>
      </div>

      {isLoading && <div className="p-6 text-center text-slate-500">Carregando...</div>}

      {aba === 'rubricas' && !isLoading && (
        <div className="space-y-6">
          {rubricasDados?.length === 0 && <p className="text-slate-500 text-center py-8">Nenhum dado encontrado</p>}
          {(() => {
            const projetos = new Map<string, { titulo: string; rubricas: RubricaRel[] }>();
            rubricasDados?.forEach((r) => {
              if (!projetos.has(r.codigo_aneel)) projetos.set(r.codigo_aneel, { titulo: r.titulo, rubricas: [] });
              projetos.get(r.codigo_aneel)!.rubricas.push(r);
            });
            return Array.from(projetos.entries()).map(([cod, dados]) => (
              <div key={cod} className="bg-white rounded-xl shadow overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b">
                  <h3 className="font-semibold text-lg">{dados.titulo}</h3>
                  <span className="text-xs font-mono text-slate-500">{cod}</span>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Rubrica</th>
                    <th className="text-right px-6 py-3 font-medium text-slate-600">Previsto</th>
                    <th className="text-right px-6 py-3 font-medium text-slate-600">Executado</th>
                    <th className="text-right px-6 py-3 font-medium text-slate-600">Saldo</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {dados.rubricas.map((r) => {
                      const previsto = parseFloat(r.valor_previsto);
                      const executado = parseFloat(r.valor_executado);
                      const saldo = previsto - executado;
                      return (
                        <tr key={r.rubrica} className="hover:bg-slate-50">
                          <td className="px-6 py-3"><span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded mr-2">{r.rubrica}</span>{RUBRICA_LABELS[r.rubrica]}</td>
                          <td className="px-6 py-3 text-right">R$ {previsto.toLocaleString('pt-BR')}</td>
                          <td className="px-6 py-3 text-right">R$ {executado.toLocaleString('pt-BR')}</td>
                          <td className={`px-6 py-3 text-right font-medium ${saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>R$ {saldo.toLocaleString('pt-BR')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ));
          })()}
        </div>
      )}

      {aba === 'folha' && !isLoading && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b"><tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Projeto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Colaborador</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Perfil</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nível</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Mensal</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Competência</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
            </tr></thead>
            <tbody className="divide-y">
              {folhaDados?.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nenhum dado encontrado</td></tr>}
              {folhaDados?.map((f, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs">{f.codigo_aneel}</td>
                  <td className="px-4 py-3 font-medium">{f.nome_completo}</td>
                  <td className="px-4 py-3">{f.perfil}</td>
                  <td className="px-4 py-3">{f.nivel_academico}</td>
                  <td className="px-4 py-3 text-right">R$ {parseFloat(f.valor_mensal_calculado).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3">{MESES[f.mes - 1]}/{f.ano}</td>
                  <td className="px-4 py-3 text-right">R$ {parseFloat(f.valor_devido).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.status === 'PAGO' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'pendencias' && !isLoading && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-6 py-4 bg-amber-50 border-b">
            <p className="text-sm text-amber-800">Total de pendências: <strong>{pendDados?.length ?? 0}</strong> competências</p>
            <p className="text-sm text-amber-800">Valor total pendente: <strong>R$ {pendDados?.reduce((s, p) => s + parseFloat(p.valor_devido), 0).toLocaleString('pt-BR') ?? '0'}</strong></p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b"><tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Projeto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Colaborador</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nível</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Competência</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Valor Devido</th>
            </tr></thead>
            <tbody className="divide-y">
              {pendDados?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhuma pendência encontrada</td></tr>}
              {pendDados?.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs">{p.codigo_aneel}</td>
                  <td className="px-4 py-3 font-medium">{p.nome_completo}</td>
                  <td className="px-4 py-3">{p.nivel_academico}</td>
                  <td className="px-4 py-3">{MESES[p.mes - 1]}/{p.ano}</td>
                  <td className="px-4 py-3 text-right font-medium text-amber-700">R$ {parseFloat(p.valor_devido).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'folha_instituicao' && !isLoading && (
        <div className="space-y-6">
          {instDados?.length === 0 && <p className="text-slate-500 text-center py-8">Nenhum dado encontrado</p>}
          {(() => {
            const totalMensal = instDados?.reduce((s, d) => s + parseFloat(String(d.valor_mensal_total)), 0) ?? 0;
            const totalPendente = instDados?.reduce((s, d) => s + parseFloat(String(d.total_pendente)), 0) ?? 0;
            const totalPago = instDados?.reduce((s, d) => s + parseFloat(String(d.total_pago)), 0) ?? 0;
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Folha Mensal Total</p><p className="text-2xl font-bold text-slate-900">R$ {totalMensal.toLocaleString('pt-BR')}</p></div>
                  <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Total Pago</p><p className="text-2xl font-bold text-green-700">R$ {totalPago.toLocaleString('pt-BR')}</p></div>
                  <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Total Pendente</p><p className="text-2xl font-bold text-amber-700">R$ {totalPendente.toLocaleString('pt-BR')}</p></div>
                </div>
                <div className="bg-white rounded-xl shadow overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b"><tr>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Colaborador</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Perfil</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Projetos</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Mensal</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Pagas</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Pendentes</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Total Pago</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Total Pendente</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {instDados?.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium">{d.nome_completo}</td>
                          <td className="px-4 py-3">{d.perfil}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{d.email}</td>
                          <td className="px-4 py-3 text-center">{d.total_projetos}</td>
                          <td className="px-4 py-3 text-right">R$ {parseFloat(String(d.valor_mensal_total)).toLocaleString('pt-BR')}/mês</td>
                          <td className="px-4 py-3 text-center"><span className="text-green-600 font-medium">{d.competencias_pagas}</span></td>
                          <td className="px-4 py-3 text-center"><span className="text-amber-600 font-medium">{d.competencias_pendentes}</span></td>
                          <td className="px-4 py-3 text-right text-green-700">R$ {parseFloat(String(d.total_pago)).toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-3 text-right text-amber-700">R$ {parseFloat(String(d.total_pendente)).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
