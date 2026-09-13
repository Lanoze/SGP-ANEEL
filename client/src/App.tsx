import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProjetosPage from './pages/ProjetosPage';
import ProjetoDetailPage from './pages/ProjetoDetailPage';
import DocumentosPage from './pages/DocumentosPage';
import FolhaPage from './pages/FolhaPage';
import FolhaDetailPage from './pages/FolhaDetailPage';
import RelatoriosPage from './pages/RelatoriosPage';
import AuditoriaPage from './pages/AuditoriaPage';
import UsuariosPage from './pages/UsuariosPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projetos" element={<ProjetosPage />} />
        <Route path="/projetos/:id" element={<ProjetoDetailPage />} />
        <Route path="/projetos/:id/documentos" element={<DocumentosPage />} />
        <Route path="/folha" element={<FolhaPage />} />
        <Route path="/folha/:projeto_id" element={<FolhaDetailPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/auditoria" element={<AuditoriaPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
