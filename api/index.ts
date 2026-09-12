import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import authRoutes from '../server/src/routes/auth';
import usuariosRoutes from '../server/src/routes/usuarios';
import projetosRoutes from '../server/src/routes/projetos';
import rubricasRoutes from '../server/src/routes/rubricas';
import lancamentosRoutes from '../server/src/routes/lancamentos';
import documentosRoutes from '../server/src/routes/documentos';
import folhaRoutes from '../server/src/routes/folha';
import relatoriosRoutes from '../server/src/routes/relatorios';
import auditoriaRoutes from '../server/src/routes/auditoria';

const app = express();
app.use(cors());
app.use(express.json());

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

export default app;
