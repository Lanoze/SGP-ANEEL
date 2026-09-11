'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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
          <button onClick={handleLogout} className="w-full text-left text-sm text-red-400 hover:text-red-300">
            {sidebarOpen ? 'Sair' : '🚪'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
