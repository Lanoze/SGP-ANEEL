import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const authRoutes = require('../server/dist/routes/auth').default;
const usuariosRoutes = require('../server/dist/routes/usuarios').default;
const projetosRoutes = require('../server/dist/routes/projetos').default;
const rubricasRoutes = require('../server/dist/routes/rubricas').default;
const lancamentosRoutes = require('../server/dist/routes/lancamentos').default;
const documentosRoutes = require('../server/dist/routes/documentos').default;
const folhaRoutes = require('../server/dist/routes/folha').default;
const relatoriosRoutes = require('../server/dist/routes/relatorios').default;
const auditoriaRoutes = require('../server/dist/routes/auditoria').default;

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
