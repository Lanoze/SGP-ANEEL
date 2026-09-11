'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import UploadDocumento from '@/components/UploadDocumento';
import type { DocumentoMetadados } from '@/types';

const CATEGORIA_LABELS: Record<string, string> = { GERAL: 'Geral', COMPROVANTE_LANCAMENTO: 'Comprovante', RELATORIO_TECNICO: 'Relatório Técnico', CONTRATO_RH: 'Contrato RH' };
const CATEGORIA_CORES: Record<string, string> = { GERAL: 'bg-slate-100 text-slate-700', COMPROVANTE_LANCAMENTO: 'bg-blue-100 text-blue-700', RELATORIO_TECNICO: 'bg-purple-100 text-purple-700', CONTRATO_RH: 'bg-red-100 text-red-700' };
function formatarTamanho(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

const CAN_ACCESS_CONTRATOS = ['GESTOR', 'COORDENADOR'];

export default function DocumentosPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;
  return <Layout><DocumentosContent /></Layout>;
}

function DocumentosContent() {
  const { id: projetoId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [filtro, setFiltro] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const queryClient = useQueryClient();
  const canSeeContratos = CAN_ACCESS_CONTRATOS.includes(user?.perfil ?? '');

  const categoriasVisiveis = Object.entries(CATEGORIA_LABELS).filter(([key]) => {
    if (key === 'CONTRATO_RH' && !canSeeContratos) return false;
    return true;
  });

  const { data: documentos, isLoading } = useQuery({
    queryKey: ['documentos', projetoId, filtro],
    queryFn: async () => { const params = filtro ? `?categoria=${filtro}` : ''; return (await api.get<DocumentoMetadados[]>(`/documentos/${projetoId}${params}`)).data; },
    enabled: !!projetoId,
  });

  const deleteMutation = useMutation({ mutationFn: async (id: string) => api.delete(`/documentos/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documentos', projetoId] }) });

  function handleDownload(doc: DocumentoMetadados) { const link = window.document.createElement('a'); link.href = `/api/documentos/download/${doc.id}`; link.download = doc.nome_arquivo; link.click(); }

  if (isLoading) return <div className="p-6 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Documentos do Projeto</h1>
        <button onClick={() => setShowUpload(!showUpload)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{showUpload ? 'Fechar' : '+ Enviar Documento'}</button>
      </div>
      {showUpload && <div className="mb-6"><UploadDocumento projetoId={projetoId!} onSuccess={() => setShowUpload(false)} /></div>}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFiltro('')} className={`px-3 py-1.5 rounded-lg text-sm ${!filtro ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Todos</button>
        {categoriasVisiveis.map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)} className={`px-3 py-1.5 rounded-lg text-sm ${filtro === val ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b"><tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Arquivo</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Categoria</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Tamanho</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">SHA-256</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Enviado por</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
            <th className="text-right px-4 py-3 font-medium text-slate-600">Ações</th>
          </tr></thead>
          <tbody className="divide-y">
            {documentos?.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhum documento encontrado</td></tr>}
            {documentos?.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="text-lg">{doc.extensao === '.pdf' ? '📄' : doc.extensao === '.xlsx' ? '📊' : doc.extensao === '.docx' ? '📝' : '📎'}</span><span className="font-medium">{doc.nome_arquivo}</span></div></td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${CATEGORIA_CORES[doc.categoria] || 'bg-slate-100'}`}>{CATEGORIA_LABELS[doc.categoria] || doc.categoria}</span></td>
                <td className="px-4 py-3 text-slate-500">{formatarTamanho(doc.tamanho_bytes)}</td>
                <td className="px-4 py-3 text-xs font-mono text-slate-400" title={doc.hash_sha256}>{doc.hash_sha256.slice(0, 12)}...</td>
                <td className="px-4 py-3 text-slate-500">{doc.usuario_nome}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(doc.criado_em).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDownload(doc)} className="text-blue-600 hover:text-blue-800 text-sm mr-2">Download</button>
                  {canSeeContratos && (
                    <button onClick={() => { if (confirm('Remover este documento?')) deleteMutation.mutate(doc.id); }} className="text-red-500 hover:text-red-700 text-sm">Remover</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
