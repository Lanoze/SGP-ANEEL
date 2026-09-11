import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, senha } = await request.json();
    if (!email || !senha) {
      return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 });
    }

    const result = await authenticateUser(email, senha);
    if (!result) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
