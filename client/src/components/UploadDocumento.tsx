import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Progress from '@radix-ui/react-progress';
import api from '../lib/api';

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  '.pdf': [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
  '.png': [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
  '.jpg': [new Uint8Array([0xff, 0xd8, 0xff])],
  '.jpeg': [new Uint8Array([0xff, 0xd8, 0xff])],
  '.xlsx': [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
  '.docx': [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
};

function validateMagicBytes(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const expected = MAGIC_BYTES[ext];
  if (!expected) return true;
  return new Promise<boolean>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer);
      resolve(expected.some((magic) => magic.every((b, i) => arr[i] === b)));
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 4));
  }) as unknown as boolean;
}

interface UploadDocumentoProps {
  projetoId: string;
  onSuccess?: () => void;
}

export default function UploadDocumento({ projetoId, onSuccess }: UploadDocumentoProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState('GERAL');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [validating, setValidating] = useState(false);

  const CHUNK_SIZE = 1024 * 1024;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error('Nenhum arquivo selecionado');
      setValidating(true);

      const valid = await validateMagicBytes(arquivo);
      if (!valid) {
        setValidating(false);
        throw new Error('Tipo de arquivo não corresponde à extensão (magic bytes inválidos)');
      }
      setValidating(false);

      const totalChunks = Math.ceil(arquivo.size / CHUNK_SIZE);
      const fileId = crypto.randomUUID();

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, arquivo.size);
        const chunk = arquivo.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('fileId', fileId);
        formData.append('fileName', arquivo.name);
        formData.append('fileSize', String(arquivo.size));
        formData.append('chunkIndex', String(i));
        formData.append('totalChunks', String(totalChunks));
        formData.append('categoria', categoria);
        formData.append('projetoId', projetoId);

        await api.post('/documentos/upload-stream', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) {
              const chunkProgress = (e.loaded / e.total) * (100 / totalChunks);
              setProgress(Math.min(((i + chunkProgress / (100 / totalChunks)) / totalChunks) * 100, 100));
            }
          },
        });
      }

      setProgress(100);
      return { success: true };
    },
    onSuccess: () => {
      setArquivo(null);
      setProgress(0);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['documentos', projetoId] });
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message);
      setProgress(0);
    },
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setError('Arquivo excede 50MB'); return; }
    setArquivo(file);
    setError('');
  }

  return (
    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" />
          {!arquivo ? (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 text-center text-slate-500 hover:text-slate-700">
              Arraste ou clique para selecionar arquivo
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{arquivo.name}</p>
                  <p className="text-xs text-slate-500">{(arquivo.size / 1024).toFixed(1)} KB · Chunks de {(CHUNK_SIZE / 1024 / 1024).toFixed(0)}MB</p>
                </div>
                <button onClick={() => { setArquivo(null); setProgress(0); }} className="text-red-500 text-sm">Remover</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="GERAL">Geral</option>
                  <option value="COMPROVANTE_LANCAMENTO">Comprovante de Lançamento</option>
                  <option value="RELATORIO_TECNICO">Relatório Técnico</option>
                  <option value="CONTRATO_RH">Contrato de RH</option>
                </select>
              </div>
              {progress > 0 && (
                <Progress.Root className="h-2 bg-slate-200 rounded-full overflow-hidden" value={progress}>
                  <Progress.Indicator className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                </Progress.Root>
              )}
              {progress > 0 && progress < 100 && <p className="text-xs text-slate-500 text-right">{progress.toFixed(0)}%</p>}
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      {validating && <p className="text-amber-600 text-sm mt-2">Validando magic bytes...</p>}
      {arquivo && progress === 0 && (
        <button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}
          className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {uploadMutation.isPending ? 'Enviando chunks...' : 'Enviar'}
        </button>
      )}
    </div>
  );
}
