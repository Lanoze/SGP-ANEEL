'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import type { Projeto } from '@/types';

export default function FolhaPage() {
  const { data: projetos, isLoading } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: async () => { const r = await api.get('/api/projetos'); return r.data; },
  });

  if (isLoading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Folha de Pagamento</h1>
      <p className="text-gray-600 mb-6">Selecione um projeto para gerenciar a folha:</p>
      <div className="grid gap-4">
        {projetos?.map((p) => (
          <Link key={p.id} href={`/folha/${p.id}`}
            className="block p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow border">
            <h2 className="font-semibold text-lg">{p.titulo}</h2>
            <p className="text-sm text-gray-500">{p.codigo_aneel}</p>
          </Link>
        ))}
        {projetos?.length === 0 && <p className="text-gray-500">Nenhum projeto encontrado.</p>}
      </div>
    </div>
  );
}
