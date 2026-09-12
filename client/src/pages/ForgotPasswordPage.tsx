import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

interface ForgotError {
  response?: { data?: { error?: string } };
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const mutation = useMutation({
    mutationFn: async () => (await api.post('/auth/forgot-password', { email })).data,
    onSuccess: (data: { message: string }) => { setMsg(data.message); setErr(''); },
    onError: (e: ForgotError) => { setErr(e.response?.data?.error || 'Erro ao enviar'); setMsg(''); },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">SGP-ANEEL</h1>
          <p className="text-slate-500 mt-2">Recuperar Acesso</p>
        </div>
        <p className="text-sm text-slate-600 mb-4">Informe o email da sua conta. Um gestor poderá redefinir sua senha no painel de administração.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
          </div>
          {msg && <p className="text-green-600 text-sm">{msg}</p>}
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button onClick={() => mutation.mutate()} disabled={!email || mutation.isPending}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {mutation.isPending ? 'Enviando...' : 'Solicitar Recuperação'}
          </button>
        </div>
        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-800">← Voltar ao Login</Link>
        </div>
      </div>
    </div>
  );
}
