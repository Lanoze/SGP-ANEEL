'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import type { AlocacaoRH, RubricaProjeto, CompetenciaFolha, Usuario } from '@/types';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAlocacao, setShowAlocacao] = useState(false);
  const [showLoteModal, setShowLoteModal] = useState(false);
  const [loteMes, setLoteMes] = useState('');
  const [loteAno, setLoteAno] = useState('2026');
  const [baixaModal, setBaixaModal] = useState<{ competencia: CompetenciaFolha; alocacao: AlocacaoRH } | null>(null);
  const [nivelModal, setNivelModal] = useState<AlocacaoRH | null>(null);

  const { data: rubricas } = useQuery({ queryKey: ['rubricas', projeto_id], queryFn: async () => (await api.get<RubricaProjeto[]>(`/projetos/${projeto_id}/rubricas`)).data, enabled: !!projeto_id });
  const { data: folha } = useQuery({ queryKey: ['folha', projeto_id], queryFn: async () => (await api.get<AlocacaoRH[]>(`/folha/folha/${projeto_id}`)).data, enabled: !!projeto_id });
  const { data: usuarios } = useQuery<Usuario[]>({ queryKey: ['usuarios'], queryFn: async () => (await api.get('/usuarios')).data });

  const alocacaoMutation = useMutation({
    mutationFn: async (data: { projeto_id: string; usuario_id: string; papel_projeto: string; nivel_academico: string; valor_nominal_capes: number; nivel_complemento: number }) => (await api.post(`/folha/alocacao/${projeto_id}`, data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folha'] }); setShowAlocacao(false); },
  });
  const baixaMutation = useMutation({
    mutationFn: async (competencia_id: string) => (await api.post('/folha/baixar-individual', { competencia_id })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folha'] }); setBaixaModal(null); },
  });
  const baixaLoteMutation = useMutation({
    mutationFn: async () => (await api.post('/folha/baixar-lote', { projeto_id, ano: parseInt(loteAno), mes: parseInt(loteMes) })).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folha'] }); setShowLoteModal(false); },
  });
  const nivelMutation = useMutation({
    mutationFn: async (data: { alocacao_id: string; nivel_complemento: number }) => (await api.put('/folha/alterar-nivel', data)).data,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['folha'] }); queryClient.invalidateQueries({ queryKey: ['rubricas'] }); setNivelModal(null); },
  });

  const rhRubrica = rubricas?.find((r) => r.rubrica === 'RH');
  const saldoRH = rhRubrica ? parseFloat(String(rhRubrica.valor_previsto)) - parseFloat(String(rhRubrica.valor_executado)) : 0;

  const pendentesCount = folha?.reduce((acc, a) => {
    return acc + (a.competencias?.filter((c) => c.status === 'PENDENTE').length ?? 0);
  }, 0) ?? 0;

  const pendentesTotal = folha?.reduce((acc, a) => {
    return acc + (a.competencias?.filter((c) => c.status === 'PENDENTE').reduce((s, c) => s + parseFloat(String(c.valor_devido)), 0) ?? 0);
  }, 0) ?? 0;

  const canBaixarLote = user?.perfil === 'GESTOR' || user?.perfil === 'COORDENADOR';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Folha de Pagamento</h1>
          <p className="text-slate-500 text-sm">Saldo RH disponível: R$ {saldoRH.toLocaleString('pt-BR')} · Pendências: {pendentesCount} ({pendentesTotal > 0 ? `R$ ${pendentesTotal.toLocaleString('pt-BR')}` : '-'})</p>
        </div>
        <div className="flex gap-2">
          {canBaixarLote && pendentesCount > 0 && (
            <button onClick={() => setShowLoteModal(true)} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700">Baixar em Lote</button>
          )}
          <button onClick={() => setShowAlocacao(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Alocar Colaborador</button>
        </div>
      </div>
      <div className="space-y-4">
        {folha?.map((a) => (
          <div key={a.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div><h3 className="font-semibold">{a.nome_completo}</h3><p className="text-sm text-slate-500">{a.papel_projeto} · {a.nivel_academico} · CPF: {a.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-$4')}</p></div>
              <div className="text-right"><p className="text-sm text-slate-500">Nominal: R$ {parseFloat(String(a.valor_nominal_capes)).toLocaleString('pt-BR')}</p><p className="text-sm font-semibold">Complemento: {a.nivel_complemento}/3</p><p className="text-lg font-bold text-green-700">R$ {parseFloat(String(a.valor_mensal_calculado)).toLocaleString('pt-BR')}/mês</p>{user?.perfil === 'GESTOR' && <button onClick={() => setNivelModal(a)} className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline">Alterar Nível</button>}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {a.competencias?.map((c) => (
                <button key={c.id} onClick={() => c.status === 'PENDENTE' && canBaixarLote && setBaixaModal({ competencia: c, alocacao: a })} disabled={c.status !== 'PENDENTE' || !canBaixarLote}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${c.status === 'PAGO' ? 'bg-green-100 text-green-700 border border-green-300' : c.status === 'PENDENTE' ? 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 cursor-pointer' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                  title={c.status === 'PAGO' ? `Pago em ${c.data_baixa}` : canBaixarLote ? 'Clique para dar baixa' : 'Sem permissão'}>
                  {MESES[c.mes - 1]}/{String(c.ano).slice(2)} {c.status === 'PAGO' ? '✓' : c.status === 'PENDENTE' ? '●' : '○'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {baixaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Confirmar Liquidação</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Colaborador:</span><span className="font-medium text-sm">{baixaModal.alocacao.nome_completo}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Competência:</span><span className="font-medium text-sm">{MESES[baixaModal.competencia.mes - 1]}/{baixaModal.competencia.ano}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Valor a Liquidar:</span><span className="font-bold text-sm text-amber-700">R$ {parseFloat(String(baixaModal.competencia.valor_devido)).toLocaleString('pt-BR')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Rubrica de Débito:</span><span className="font-medium text-sm">RH</span></div>
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Saldo RH Atual:</span><span className={`font-medium text-sm ${saldoRH < baixaModal.competencia.valor_devido ? 'text-red-600' : ''}`}>R$ {saldoRH.toLocaleString('pt-BR')}</span></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setBaixaModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => baixaMutation.mutate(baixaModal.competencia.id)} disabled={baixaMutation.isPending}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">
                {baixaMutation.isPending ? 'Processando...' : 'Confirmar Liquidação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Baixa em Lote</h2>
            <p className="text-sm text-slate-600 mb-4">Total de pendências: <strong>{pendentesCount}</strong> competências</p>
            <p className="text-sm text-slate-600 mb-4">Valor total: <strong>R$ {pendentesTotal.toLocaleString('pt-BR')}</strong></p>
            <p className="text-sm text-slate-600 mb-4">Saldo RH: <strong>R$ {saldoRH.toLocaleString('pt-BR')}</strong></p>
            {pendentesTotal > saldoRH && <p className="text-sm text-red-600 mb-4">Saldo RH insuficiente para esta operação</p>}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mês</label>
                <select value={loteMes} onChange={(e) => setLoteMes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">Selecione...</option>
                  {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ano</label>
                <select value={loteAno} onChange={(e) => setLoteAno(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowLoteModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => baixaLoteMutation.mutate()} disabled={!loteMes || pendentesTotal > saldoRH || baixaLoteMutation.isPending}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50">
                {baixaLoteMutation.isPending ? 'Processando...' : 'Confirmar Baixa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAlocacao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Alocar Colaborador</h2>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); alocacaoMutation.mutate({ projeto_id, usuario_id: fd.get('usuario_id') as string, papel_projeto: fd.get('papel_projeto') as string, nivel_academico: fd.get('nivel_academico') as string, valor_nominal_capes: parseFloat(fd.get('valor_nominal_capes') as string), nivel_complemento: parseInt(fd.get('nivel_complemento') as string) }); }} className="space-y-3">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Usuário</label><select name="usuario_id" required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"><option value="">Selecione...</option>{usuarios?.map((u) => <option key={u.id} value={u.id}>{u.nome_completo} ({u.perfil})</option>)}</select></div>
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

      {nivelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Alterar Nível de Complemento</h2>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Colaborador:</span><span className="font-medium text-sm">{nivelModal.nome_completo}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Nível Acadêmico:</span><span className="font-medium text-sm">{nivelModal.nivel_academico}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Nominal CAPEs:</span><span className="font-medium text-sm">R$ {parseFloat(String(nivelModal.valor_nominal_capes)).toLocaleString('pt-BR')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 text-sm">Complemento Atual:</span><span className="font-medium text-sm">{nivelModal.nivel_complemento}/3 → R$ {parseFloat(String(nivelModal.valor_mensal_calculado)).toLocaleString('pt-BR')}/mês</span></div>
            </div>
            <p className="text-xs text-amber-600 mb-4">A alteração recalcula automaticamente as competências pendentes do projeto.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Novo Nível (0-3)</label>
              <select id="novo-nivel" defaultValue={nivelModal.nivel_complemento} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="0">Nível 0 (0%)</option>
                <option value="1">Nível 1 (+33%)</option>
                <option value="2">Nível 2 (+67%)</option>
                <option value="3">Nível 3 (Dobro)</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setNivelModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
              <button onClick={() => { const sel = document.getElementById('novo-nivel') as HTMLSelectElement; nivelMutation.mutate({ alocacao_id: nivelModal.id, nivel_complemento: parseInt(sel.value) }); }} disabled={nivelMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {nivelMutation.isPending ? 'Salvando...' : 'Salvar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
