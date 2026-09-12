import express from 'express';
import cors from 'cors';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

import authRoutes from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';
import projetosRoutes from './routes/projetos.js';
import rubricasRoutes from './routes/rubricas.js';
import lancamentosRoutes from './routes/lancamentos.js';
import documentosRoutes from './routes/documentos.js';
import folhaRoutes from './routes/folha.js';
import relatoriosRoutes from './routes/relatorios.js';
import auditoriaRoutes from './routes/auditoria.js';

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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
