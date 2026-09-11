'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import type { AlocacaoRH, RubricaProjeto } from '@/types';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const NOMINAL_VALUES: Record<string, number> = { 'Iniciação Científica': 700, 'Mestrado': 2100, 'Doutorado': 3100, 'Pós-Doutorado': 5200, 'Pesquisador Sênior': 6500 };

export default function FolhaPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;
  return <Layout><FolhaContent /></Layout>;
}

function FolhaContent() {
  const { projeto_id } = useParams<{ projeto_id: string }>();
  const queryClient = useQueryClient();
  const [showAlocacao, setShowAlocacao] = useState(false);

  const { data: rubricas } = useQuery({ queryKey: ['rubricas', projeto_id], queryFn: async () => (await api.get<RubricaProjeto[]>(`/projetos/${projeto_id}/rubricas`)).data, enabled: !!projeto_id });
  const { data: folha } = useQuery({ queryKey: ['folha', projeto_id], queryFn: async () => (await api.get<AlocacaoRH[]>(`/folha/folha/${projeto_id}`)).data, enabled: !!projeto_id });
  const { data: usuarios } = useQuery({ queryKey: ['usuarios'], queryFn: async () => (await api.get('/usuarios')).data });

  const alocacaoMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/folha/alocacao', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folha'] }); setShowAlocacao(false); },
  });
  const baixaMutation = useMutation({
    mutationFn: async (competencia_id: string) => (await api.post('/folha/baixar-individual', { competencia_id })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folha'] }),
  });

  const rhRubrica = rubricas?.find((r) => r.rubrica === 'RH');
  const saldoRH = rhRubrica ? parseFloat(rhRubrica.valor_previsto as any) - parseFloat(rhRubrica.valor_executado as any) : 0;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Folha de Pagamento</h1><p className="text-slate-500 text-sm">Saldo RH disponível: R$ {saldoRH.toLocaleString('pt-BR')}</p></div>
        <button onClick={() => setShowAlocacao(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Alocar Colaborador</button>
      </div>
      <div className="space-y-4">
        {folha?.map((a) => (
          <div key={a.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div><h3 className="font-semibold">{a.nome_completo}</h3><p className="text-sm text-slate-500">{a.papel_projeto} · {a.nivel_academico} · CPF: {a.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p></div>
              <div className="text-right"><p className="text-sm text-slate-500">Nominal: R$ {parseFloat(a.valor_nominal_capes as any).toLocaleString('pt-BR')}</p><p className="text-sm font-semibold">Complemento: {a.nivel_complemento}/3</p><p className="text-lg font-bold text-green-700">R$ {parseFloat(a.valor_mensal_calculado as any).toLocaleString('pt-BR')}/mês</p></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {a.competencias?.map((c) => (
                <button key={c.id} onClick={() => c.status === 'PENDENTE' && baixaMutation.mutate(c.id)} disabled={c.status !== 'PENDENTE'}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${c.status === 'PAGO' ? 'bg-green-100 text-green-700 border border-green-300' : c.status === 'PENDENTE' ? 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 cursor-pointer' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                  title={c.status === 'PAGO' ? `Pago em ${c.data_baixa}` : 'Clique para dar baixa'}>
                  {MESES[c.mes - 1]}/{String(c.ano).slice(2)} {c.status === 'PAGO' ? '✓' : c.status === 'PENDENTE' ? '●' : '○'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {showAlocacao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Alocar Colaborador</h2>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); alocacaoMutation.mutate({ projeto_id, usuario_id: fd.get('usuario_id'), papel_projeto: fd.get('papel_projeto'), nivel_academico: fd.get('nivel_academico'), valor_nominal_capes: parseFloat(fd.get('valor_nominal_capes') as string), nivel_complemento: parseInt(fd.get('nivel_complemento') as string) }); }} className="space-y-3">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Usuário</label><select name="usuario_id" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"><option value="">Selecione...</option>{usuarios?.map((u: any) => <option key={u.id} value={u.id}>{u.nome_completo} ({u.perfil})</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nível Acadêmico</label><select name="nivel_academico" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"><option value="">Selecione...</option>{Object.keys(NOMINAL_VALUES).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Papel no Projeto</label><select name="papel_projeto" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"><option value="PESQUISADOR">Pesquisador</option><option value="BOLSISTA">Bolsista</option><option value="COORDENADOR">Coordenador</option></select></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Valor Nominal (R$)</label><input name="valor_nominal_capes" type="number" step="0.01" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Complemento (0-3)</label><select name="nivel_complemento" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"><option value="0">Nível 0 (0%)</option><option value="1">Nível 1 (+33%)</option><option value="2">Nível 2 (+67%)</option><option value="3">Nível 3 (Dobro)</option></select></div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAlocacao(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Alocar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
