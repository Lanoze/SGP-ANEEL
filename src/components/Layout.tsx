'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

const allNavItems = [
  { to: '/', label: 'Dashboard', icon: '📊', minPerfil: 'BOLSISTA' },
  { to: '/projetos', label: 'Projetos', icon: '📁', minPerfil: 'BOLSISTA' },
  { to: '/folha', label: 'Folha', icon: '💰', minPerfil: 'COORDENADOR' },
  { to: '/relatorios', label: 'Relatórios', icon: '📈', minPerfil: 'COORDENADOR' },
  { to: '/auditoria', label: 'Auditoria', icon: '🔍', minPerfil: 'GESTOR' },
];

const ROLE_LEVELS: Record<string, number> = { GESTOR: 4, COORDENADOR: 3, PESQUISADOR: 2, BOLSISTA: 1 };

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const navItems = allNavItems.filter((item) => {
    const userLevel = ROLE_LEVELS[user?.perfil ?? 'BOLSISTA'] ?? 0;
    const requiredLevel = ROLE_LEVELS[item.minPerfil] ?? 0;
    return userLevel >= requiredLevel;
  });

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-white flex flex-col transition-all duration-300`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-lg font-bold">SGP-ANEEL</h1>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="flex-1 mt-4">
          {navItems.map((item) => {
            const isActive = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
            return (
              <Link key={item.to} href={item.to}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${isActive ? 'bg-slate-700 text-white' : 'text-gray-400 hover:bg-slate-800 hover:text-white'}`}>
                <span className="text-lg">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700">
          {sidebarOpen && (
            <div className="text-sm text-gray-400 mb-2">
              <p className="font-medium text-white">{user?.nome_completo}</p>
              <p className="text-xs">{user?.perfil}</p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <button onClick={() => setShowChangePassword(true)} className="w-full text-left text-sm text-gray-400 hover:text-white">
              {sidebarOpen ? 'Alterar Senha' : '🔑'}
            </button>
            <button onClick={handleLogout} className="w-full text-left text-sm text-red-400 hover:text-red-300">
              {sidebarOpen ? 'Sair' : '🚪'}
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (novaSenha !== confirmar) throw new Error('Senhas não conferem');
      if (novaSenha.length < 6) throw new Error('Nova senha deve ter no mínimo 6 caracteres');
      return (await api.post('/auth/change-password', { senha_atual: senhaAtual, nova_senha: novaSenha })).data;
    },
    onSuccess: (data) => { setSuccess(data.message); setError(''); setTimeout(onClose, 1500); },
    onError: (err: Error) => { setError(err.message); setSuccess(''); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Alterar Senha</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha Atual</label>
            <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
            <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
            <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
