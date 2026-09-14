import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';

const loginFormSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginFormSchema>;

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginFormSchema),
  });

  async function onSubmit(data: LoginForm) {
    setError('');
    setLoading(true);
    try {
      await login(data.email, data.senha);
      navigate('/');
    } catch {
      setError('Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fef3e2 0%, #fed7aa 50%, #fdba74 100%)' }}>
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-10 w-full max-w-[420px] mx-4">
        <div className="text-center mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-100 border border-orange-300 rounded-full px-4 py-1.5 tracking-wider uppercase">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Acesso Restrito
          </span>
        </div>

        <div className="flex justify-center my-6">
          <div className="relative w-56 h-56 flex items-center justify-center">
            <style>{`
              @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
              @keyframes shimmer { 0% { left: -100%; } 40%, 100% { left: 200%; } }
              .login-ring { animation: spin-slow 20s linear infinite; }
              .login-float { animation: float 3s ease-in-out infinite; }
              .login-shimmer { position: relative; overflow: hidden; }
              .login-shimmer::after {
                content: '';
                position: absolute;
                top: 0; left: -100%;
                width: 50%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(251, 146, 60, 0.35), transparent);
                animation: shimmer 5s ease-in-out infinite;
                pointer-events: none;
              }
            `}</style>
            <div className="absolute inset-0 rounded-full border border-orange-200" />
            <div className="login-ring absolute inset-3 rounded-full border-2 border-dashed border-orange-300 opacity-50" />
            <div className="login-shimmer w-[154px] h-[154px] rounded-2xl bg-white shadow-lg border border-orange-100 flex items-center justify-center relative z-10">
              <img src="/logo-inesc.png" alt="INESC Brasil" className="w-28 h-28 object-contain login-float" />
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-orange-600 tracking-tight">IBGP</h1>
          <p className="text-slate-500 text-sm mt-1 tracking-wide uppercase">Informe suas credenciais de acesso</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </span>
              <input type="email" {...register('email')} placeholder="Email"
                className="w-full pl-11 pr-4 py-3 border border-orange-200 rounded-xl bg-orange-50/50 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition" />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </span>
              <input type="password" {...register('senha')} placeholder="Senha"
                className="w-full pl-11 pr-4 py-3 border border-orange-200 rounded-xl bg-orange-50/50 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition" />
            </div>
            {errors.senha && <p className="text-red-500 text-xs mt-1">{errors.senha.message}</p>}
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm tracking-wide shadow-lg shadow-orange-300/50">
            {loading ? 'Entrando...' : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Entrar
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/esqueci-senha" className="text-sm text-orange-500 hover:text-orange-700 transition">Esqueceu a senha?</Link>
        </div>

        <div className="mt-8 pt-6 border-t border-orange-100 flex flex-col items-center gap-3">
          <img src="/logo-inesc.png" alt="INESC Brasil" className="h-10 object-contain" />
          <p className="text-xs text-slate-400 tracking-widest uppercase font-medium">V1.0.0 • INESC P&D Brasil</p>
        </div>
      </div>
    </div>
  );
}
