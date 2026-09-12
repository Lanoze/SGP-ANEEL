import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const app = express();
app.use(cors());
app.use(express.json());

async function setupRoutes() {
  const authRoutes = (await import('../server/src/routes/auth')).default;
  const usuariosRoutes = (await import('../server/src/routes/usuarios')).default;
  const projetosRoutes = (await import('../server/src/routes/projetos')).default;
  const rubricasRoutes = (await import('../server/src/routes/rubricas')).default;
  const lancamentosRoutes = (await import('../server/src/routes/lancamentos')).default;
  const documentosRoutes = (await import('../server/src/routes/documentos')).default;
  const folhaRoutes = (await import('../server/src/routes/folha')).default;
  const relatoriosRoutes = (await import('../server/src/routes/relatorios')).default;
  const auditoriaRoutes = (await import('../server/src/routes/auditoria')).default;

  app.use('/api/auth', authRoutes);
  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api/projetos', projetosRoutes);
  app.use('/api/projetos', rubricasRoutes);
  app.use('/api/lancamentos', lancamentosRoutes);
  app.use('/api/documentos', documentosRoutes);
  app.use('/api/folha', folhaRoutes);
  app.use('/api/relatorios', relatoriosRoutes);
  app.use('/api/auditoria', auditoriaRoutes);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

const routesReady = setupRoutes();

app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  await routesReady;
  next();
});

export default app;
