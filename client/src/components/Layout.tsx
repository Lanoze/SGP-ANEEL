import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from './FormComponents';
import { changePasswordSchema, type changePasswordInput } from '../lib/schemas';
import api from '../lib/api';

const allNavItems = [
  { to: '/', label: 'Dashboard', icon: '📊', minPerfil: 'BOLSISTA' },
  { to: '/projetos', label: 'Projetos', icon: '📁', minPerfil: 'BOLSISTA' },
  { to: '/folha', label: 'Folha', icon: '💰', minPerfil: 'COORDENADOR' },
  { to: '/relatorios', label: 'Relatórios', icon: '📈', minPerfil: 'COORDENADOR' },
  { to: '/auditoria', label: 'Auditoria', icon: '🔍', minPerfil: 'GESTOR' },
  { to: '/usuarios', label: 'Usuários', icon: '👥', minPerfil: 'GESTOR' },
];

const ROLE_LEVELS: Record<string, number> = { GESTOR: 4, COORDENADOR: 3, PESQUISADOR: 2, BOLSISTA: 1 };

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const navItems = allNavItems.filter((item) => {
    const userLevel = ROLE_LEVELS[user?.perfil ?? 'BOLSISTA'] ?? 0;
    const requiredLevel = ROLE_LEVELS[item.minPerfil] ?? 0;
    return userLevel >= requiredLevel;
  });

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-white flex flex-col transition-all duration-300 shrink-0`}>
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
              <Link key={item.to} to={item.to}
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
  const form = useForm<changePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
  });

  const mutation = useMutation({
    mutationFn: async (data: changePasswordInput) => (await api.post('/auth/change-password', data)).data,
    onSuccess: () => setTimeout(onClose, 1000),
  });

  return (
    <Modal open={true} onClose={onClose} title="Alterar Senha"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancelar</button>
          <button onClick={form.handleSubmit((d) => mutation.mutate(d))} disabled={mutation.isPending || !form.formState.isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Senha Atual</label>
        <input type="password" {...form.register('senha_atual')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.senha_atual && <p className="text-red-500 text-xs mt-1">{form.formState.errors.senha_atual.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
        <input type="password" {...form.register('nova_senha')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        {form.formState.errors.nova_senha && <p className="text-red-500 text-xs mt-1">{form.formState.errors.nova_senha.message}</p>}
      </div>
      {mutation.isError && <p className="text-red-500 text-sm">{(mutation.error as Error).message}</p>}
      {mutation.isSuccess && <p className="text-green-600 text-sm">Senha alterada com sucesso!</p>}
    </Modal>
  );
}
