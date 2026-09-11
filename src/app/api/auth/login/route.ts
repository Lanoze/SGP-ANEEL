import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { loginSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await authenticateUser(parsed.data.email, parsed.data.senha);
    if (!result) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
