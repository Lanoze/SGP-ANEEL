'use client';

import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface Props { projetoId: string; onSuccess?: () => void; }

const CATEGORIAS = [
  { value: 'GERAL', label: 'Geral' },
  { value: 'COMPROVANTE_LANCAMENTO', label: 'Comprovante de Lançamento' },
  { value: 'RELATORIO_TECNICO', label: 'Relatório Técnico' },
  { value: 'CONTRATO_RH', label: 'Contrato de RH' },
];

const EXTENSOES_PERMITIDAS = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.docx', '.pptx', '.txt', '.csv'];

export default function UploadDocumento({ projetoId, onSuccess }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState('GERAL');
  const [dragOver, setDragOver] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post(`/documentos/${projetoId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => { if (e.total) setProgresso(Math.round((e.loaded * 100) / e.total)); },
      });
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['documentos', projetoId] }); setArquivo(null); setProgresso(0); onSuccess?.(); },
  });

  const validarArquivo = useCallback((file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!EXTENSOES_PERMITIDAS.includes(ext)) { alert(`Extensão não permitida: ${ext}`); return false; }
    if (file.size > 50 * 1024 * 1024) { alert('Arquivo muito grande (máx. 50MB)'); return false; }
    return true;
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && validarArquivo(file)) setArquivo(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && validarArquivo(file)) setArquivo(file);
  }

  function handleSubmit() {
    if (!arquivo) return;
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    fd.append('categoria', categoria);
    uploadMutation.mutate(fd);
  }

  const uploading = uploadMutation.isPending;

  return (
    <div className="border-2 border-dashed rounded-xl p-6 transition-colors"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
      <div className={`text-center ${dragOver ? 'text-blue-600' : 'text-slate-400'}`}>
        <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm">
          {arquivo ? <span className="font-medium text-slate-700">{arquivo.name} ({(arquivo.size / 1024).toFixed(1)} KB)</span>
            : <>Arraste e solte um arquivo aqui ou <button type="button" onClick={() => inputRef.current?.click()} className="text-blue-600 underline">selecione</button></>}
        </p>
        <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG, XLSX, DOCX, PPTX, TXT, CSV (máx. 50MB)</p>
      </div>
      <input ref={inputRef} type="file" className="hidden" accept={EXTENSOES_PERMITIDAS.join(',')} onChange={handleFileChange} />
      {arquivo && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {uploading && <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progresso}%` }} /></div>}
          {uploadMutation.isError && <p className="text-red-500 text-sm">Erro no upload.</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setArquivo(null); setProgresso(0); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
            <button onClick={handleSubmit} disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {uploading ? `Enviando... ${progresso}%` : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
