import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env.local') });

import authRoutes from './routes/auth';
import usuariosRoutes from './routes/usuarios';
import projetosRoutes from './routes/projetos';
import rubricasRoutes from './routes/rubricas';
import lancamentosRoutes from './routes/lancamentos';
import documentosRoutes from './routes/documentos';
import folhaRoutes from './routes/folha';
import relatoriosRoutes from './routes/relatorios';
import auditoriaRoutes from './routes/auditoria';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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

if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SGP-ANEEL API running on port ${PORT}`);
  });
}

export default app;
