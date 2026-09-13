# ATIVIDADE DE IA DA SEMANA – 08/09/2026

## ESPECIFICAÇÃO TÉCNICA E DIRETRIZES DE ENGENHARIA DE SOFTWARE

### 1 Sistema Integrado de Gestão de Projetos de P&D (Padrão Regulatório ANEEL) — SGP-ANEEL

- **Destinatários:** Arthur e Lorenzo
- **Coordenação e Orientação Técnica:** Prof. Dr. Paulo César Rodrigues de Lima Júnior
- **Classificação:** Plano de Trabalho, Arquitetura de Sistemas e Especificação de Requisitos

---

### 2 Contextualização Regulamentar, Escopo e Objetivos do Sistema

O objetivo deste projeto é o desenvolvimento completo de uma aplicação Web corporativa voltada à gestão econômico-financeira, alocação de recursos humanos, controle de conformidade regulatória e custódia transacional de artefatos documentais para projetos de Pesquisa e Desenvolvimento Tecnológico enquadados no Programa de P&D Regulado pela Agência Nacional de Energia Elétrica (ANEEL).

A aplicação deve assegurar estrita aderência aos manuais de conformidade da ANEEL, às diretrizes de concessão e parametrização de bolsas praticadas pelas agências de fomento nacionais (CAPES/CNPq) e às melhores práticas da Engenharia de Software moderna: tipagem estática ponta a ponta, isolamento transacional ACID, rastreabilidade forense de eventos e armazenamento binário interno no banco de dados.

---

### 3 Pilha Tecnológica (Tech Stack) e Diretrizes de Arquitetura

A arquitetura do sistema adota o padrão desacoplado cliente-servidor (SPA + Backend API/Server Functions), garantindo integridade de dados na persistência e reatividade na interface.

```
+-----------------------------------------------------------------------------+
|                      CAMADA DE APRESENTAÇÃO (FRONTEND)                      |
|  React 18+ | Vite | TypeScript (strict) | Tailwind CSS | TanStack Query     |
+-----------------------------------------------------------------------------+
                                    |
                                    |  JSON / Multipart-Stream (HTTPS)
                                    v
+-----------------------------------------------------------------------------+
|                       CAMADA DE SERVIÇOS (BACKEND API)                      |
|  Node.js / Express ou Fastify | TypeScript | Validação com Zod | JWT + RBAC |
+-----------------------------------------------------------------------------+
                                    |
                                    |  SQL Nativo / Conexão Pooling via TCP
                                    v
+-----------------------------------------------------------------------------+
|                     BANCO DE DADOS SERVERLESS (NEON)                        |
|  PostgreSQL 16 | Tabelas TOAST (BYTEA) | Índices B-Tree | Triggers Aud      |
+-----------------------------------------------------------------------------+
```

---

### 4 Definição da Pilha

- **Persistência Relacional:** Neon (PostgreSQL 16 Serverless com connection pooling via PgBouncer).
- **Armazenamento de Arquivos:** Banco de Dados Neon (uso estrito do tipo de dado nativo BYTEA com compressão TOAST ativada). Não será utilizado object storage externo (AWS S3, GCS, Cloudflare R2 ou MinIO).
- **Frontend SPA:** React (versão 18+) inicializado com Vite, em TypeScript estrito ("strict": true no tsconfig.json).
- **Estilização e Primitivas de UI:** HTML5 semântico, CSS3 moderno com Tailwind CSS e componentes base do Radix UI (acessibilidade WAI-ARIA nativa).
- **Gerenciamento de Estado e Cache:** TanStack Query v5 para sincronização assíncrona, cache de requisições e mutações com optimistic updates. Formulários operados via React Hook Form integrados a validações de schema Zod.

---

### 5 Formalização Matemática e Regras de Negócio

#### 5.1 Estrutura Canônica de Rubricas Orçamentárias ANEEL

Todo projeto cadastrado possui dotação orçamentária distribuída entre as seis rubricas canônicas da ANEEL:

1. **RH (Recursos Humanos):** Custeio de pesquisadores vinculados à instituição e bolsistas.
2. **ST (Serviços de Terceiros):** Consultorias técnicas, assessorias, ensaios laboratoriais externos (PF/PJ).
3. **MC (Materiais de Consumo):** Insumos de bancada, reagentes, peças de reposição e componentes descartáveis.
4. **EP (Equipamentos e Materiais Permanentes):** Equipamentos científicos, servidores e instrumentos de longa duração.
5. **VD (Viagens e Diárias):** Passagens aéreas/terrestres, hospedagens e diárias de campo ou de participação em congressos técnicos.
6. **OU (Outros Custos Indiretos):** Despesas administrativas correlatas, taxas de importação e auditoria contábil independente.

#### 5.2 Equilíbrio Financeiro, Saldos e Bloqueio Orçamentário

Considere o conjunto de rubricas ℛ={RH,ST,MC,EP,VD,OU}. Para cada rubrica *r* ∈ ℛ de um projeto *p*, define-se:

- **V_{previsto,r}** ∈ ℝ⁺: Orçamento teto aprovado pela concessionária/ANEEL.
- **V_{executado,r}** = Σ V_{lançado,r,i} (i=1..n): Somatório de todos os lançamentos financeiros efetuados e liquidados.
- **S_r**: Saldo remanescente da rubrica *r*:
  - S_r = V_{previsto,r} − V_{executado,r}
- **S_{global}**: Saldo global liquidável do projeto *p*:
  - S_{global} = Σ S_r (r ∈ ℛ) = Σ V_{previsto,r} (r ∈ ℛ) − Σ V_{executado,r} (r ∈ ℛ)

**Restrição de Invariância Orçamentária:**

O sistema deve barrar lançamentos que violem a restrição S_r ≥ 0. Caso um novo lançamento com valor *v* seja solicitado:

- Se v > S_r ⟹ Lançamento **Rejeitado** (Exceção: `ESTOURO_DE_RUBRICA`)

Não é permitida a compensação automática entre rubricas distintas sem a formalização de um Termo de Remanejamento Orçamentário formal aprovado pela gestão do projeto.

#### 5.3 Modelo de Parametrização e Cálculo de Bolsas de Pesquisa (CAPES com Fatores de Complemento)

A remuneração mensal de qualquer colaborador (Coordenador, Pesquisador ou Bolsista) apoia-se em uma tabela base de valores nominais estabelecida pelas agências reguladoras (Portaria Conjunta CAPES/CNPq), acrescida de um fator discreto de complementação *k* ∈ {0,1,2,3}.

Seja V_{nominal} o valor da bolsa de referência conforme a titulação ou modalidade da alocação:

| Modalidade | V_{nominal} |
|---|---|
| Iniciação Científica (Graduação) | R$ 700,00 |
| Mestrado | R$ 2.100,00 |
| Doutorado | R$ 3.100,00 |
| Pós-Doutorado / Pesquisador Júnior | R$ 5.200,00 |
| Pesquisador Sênior / Coordenador | R$ 6.500,00 (ou teto parametrizável homologado) |

A remuneração mensal efetiva (V_{efetivo}) é expressa por:

**V_{efetivo} = V_{nominal} · (1 + k/3), k ∈ {0,1,2,3}**

| Nível (k) | Descrição | Fator | Resultado |
|---|---|---|---|
| 0 | Adicional nulo | 1,00 | V_{efetivo} = 1,00 · V_{nominal} |
| 1 | Adicional de um terço | 4/3 ≈ 1,3333 | V_{efetivo} ≈ 1,3333 · V_{nominal} |
| 2 | Adicional de dois terços | 5/3 ≈ 1,6667 | V_{efetivo} ≈ 1,6667 · V_{nominal} |
| 3 | Adicional integral | 2,00 | V_{efetivo} = 2,00 · V_{nominal} |

#### 5.4 Engenharia de Dados: Schema DDL do Neon (PostgreSQL)

```sql
-- ============================================================================
-- SGP-ANEEL: ESQUEMA RELACIONAL PRINCIPAL
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tipos Enumerados (Enums)
CREATE TYPE role_usuario AS ENUM ('GESTOR', 'COORDENADOR', 'PESQUISADOR', 'BOLSISTA');
CREATE TYPE codigo_rubrica AS ENUM ('RH', 'ST', 'MC', 'EP', 'VD', 'OU');
CREATE TYPE status_folha AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');
CREATE TYPE categoria_documento AS ENUM ('CONTRATO_RH', 'COMPROVANTE_LANCAMENTO', 'RELATORIO_TECNICO', 'GERAL');

-- 1. Tabela de Usuários
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    hash_senha VARCHAR(255) NOT NULL,
    perfil role_usuario NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Projetos
CREATE TABLE projetos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_aneel VARCHAR(50) NOT NULL UNIQUE,
    titulo VARCHAR(500) NOT NULL,
    descricao TEXT,
    coordenador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_datas_projeto CHECK (data_fim > data_inicio)
);

-- 3. Tabela de Rubricas Orçamentárias por Projeto
CREATE TABLE rubricas_projeto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    rubrica codigo_rubrica NOT NULL,
    valor_previsto NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT uq_projeto_rubrica UNIQUE (projeto_id, rubrica),
    CONSTRAINT chk_valor_previsto_positivo CHECK (valor_previsto >= 0)
);

-- 4. Tabela de Lançamentos de Despesas
CREATE TABLE lancamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rubrica_projeto_id UUID NOT NULL REFERENCES rubricas_projeto(id) ON DELETE RESTRICT,
    descricao VARCHAR(500) NOT NULL,
    valor NUMERIC(14, 2) NOT NULL,
    data_despesa DATE NOT NULL,
    usuario_registro_id UUID NOT NULL REFERENCES usuarios(id),
    documento_id UUID,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_valor_lancamento_positivo CHECK (valor > 0)
);

-- 5. Tabela de Alocação de RH (Vínculo de Colaborador ao Projeto)
CREATE TABLE alocacao_rh (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    papel_projeto role_usuario NOT NULL,
    nivel_academico VARCHAR(100) NOT NULL,
    valor_nominal_capes NUMERIC(10, 2) NOT NULL,
    nivel_complemento INT NOT NULL DEFAULT 0,
    valor_mensal_calculado NUMERIC(10, 2) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_projeto_usuario UNIQUE (projeto_id, usuario_id),
    CONSTRAINT chk_nivel_complemento CHECK (nivel_complemento IN (0, 1, 2, 3)),
    CONSTRAINT chk_valor_nominal CHECK (valor_nominal_capes > 0)
);

-- 6. Tabela de Competências da Folha de Pagamento (Pills Temporais)
CREATE TABLE competencias_folha (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alocacao_rh_id UUID NOT NULL REFERENCES alocacao_rh(id) ON DELETE CASCADE,
    ano INT NOT NULL,
    mes INT NOT NULL,
    valor_devido NUMERIC(10, 2) NOT NULL,
    status status_folha NOT NULL DEFAULT 'PENDENTE',
    data_baixa TIMESTAMP WITH TIME ZONE,
    usuario_baixa_id UUID REFERENCES usuarios(id),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_alocacao_mes_ano UNIQUE (alocacao_rh_id, ano, mes),
    CONSTRAINT chk_mes_valido CHECK (mes BETWEEN 1 AND 12),
    CONSTRAINT chk_ano_valido CHECK (ano >= 2020)
);

-- 7. Metadados de Documentos (Particionamento Vertical - Consulta Leve)
CREATE TABLE documentos_metadados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    categoria categoria_documento NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    extensao VARCHAR(20) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    tamanho_bytes BIGINT NOT NULL,
    hash_sha256 CHAR(64) NOT NULL,
    usuario_upload_id UUID NOT NULL REFERENCES usuarios(id),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Payload Binário de Documentos (Armazenamento Isolado via BYTEA)
CREATE TABLE documentos_payload (
    documento_id UUID PRIMARY KEY REFERENCES documentos_metadados(id) ON DELETE CASCADE,
    conteudo_binario BYTEA NOT NULL
);

-- Habilitar compactação estendida TOAST para o binário (LZ4/pglz)
ALTER TABLE documentos_payload ALTER COLUMN conteudo_binario SET STORAGE EXTENDED;

-- 9. Tabela Imutável de Trilha de Auditoria (Audit Trail)
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),
    acao VARCHAR(50) NOT NULL,
    tabela_origem VARCHAR(50) NOT NULL,
    registro_id UUID,
    estado_anterior JSONB,
    estado_posterior JSONB,
    endereco_ip VARCHAR(45),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Otimização
CREATE INDEX idx_rubricas_projeto ON rubricas_projeto(projeto_id);
CREATE INDEX idx_lancamentos_rubrica ON lancamentos(rubrica_projeto_id);
CREATE INDEX idx_competencias_busca ON competencias_folha(ano, mes, status);
CREATE INDEX idx_documentos_categoria ON documentos_metadados(projeto_id, categoria);
CREATE INDEX idx_audit_logs_busca ON audit_logs(tabela_origem, registro_id);
```

---

### 6 Especificações Técnicas de Persistência Binária no Banco

A persistência de arquivos diretamente no Neon (PostgreSQL) exige estratégias rígidas para evitar contenção de memória e sobrecarga do mecanismo de buffer do banco de dados:

1. **Particionamento Vertical Obrigatório:** A segregação estrutural entre `documentos_metadados` e `documentos_payload` impede que consultas usuais (como listagem de anexos de um projeto) carreguem gigabytes de dados binários no barramento. A tabela `documentos_payload` deve ser acessada exclusivamente no instante de download ou renderização do arquivo.

2. **Streaming de Entrada (Ingestão):** O backend construído pela EQUIPE não deve armazenar o arquivo em buffer de memória RAM (`Buffer.from()`). Deve-se utilizar canal de stream de dados recebido pelo parser multipart, calculando simultaneamente a função de dispersão criptográfica SHA-256 e transmitindo os blocos (chunks) para o comando parametrizado do banco:

```
Payload do Cliente → Chunk Stream → [Cálculo SHA-256 ∥ Inserção em documentos_payload]
```

3. **Inspeção de Assinatura de Arquivo (Magic Bytes):** Para repelir arquivos executáveis maliciosos ou mascaramentos por extensão, o backend deve inspecionar os primeiros bytes do arquivo (ex.: `%PDF` para arquivos .pdf, `\x89PNG` para imagens .png, `PK\x03\x04` para planilhas .xlsx).

4. **Entrega com Cabeçalhos HTTP Canônicos:** O download deve ser configurado com:
   - `Content-Type: <mime_type>`
   - `Content-Disposition: inline; filename="<nome>"` (para PDFs e imagens permitidas) ou `attachment; filename="<nome>"` (para planilhas e demais arquivos).
   - `Cache-Control: private, max-age=3600` (evitando re-downloads repetitivos).

---

### 7 Módulos do Sistema e Especificação de Interface (Frontend)

A EQUIPE deve estruturar as interfaces em páginas e modais, priorizando clareza informacional, resposta visual imediata e estados vazios (empty states) amigáveis.

#### 7.1 Painel Orçamentário e Financeiro do Projeto

- **Visão Geral Superior:** Cartões de indicadores exibindo o Orçamento Total (V_{previsto}), Total Executado (V_{executado}), Saldo Global Remanescente (S_{global}) e Percentual de Execução Financeira.
- **Tabela de Rubricas ANEEL:** Uma matriz contendo as 6 rubricas padrão. Cada linha exibirá: Código, Descrição da Rubrica, Valor Aprovado, Valor Liquidado, Saldo Disponível e uma barra horizontal de progresso percentual:
  - **Normal:** 0% a 79% consumido (Verde).
  - **Atenção:** 80% a 99% consumido (Âmbar).
  - **Esgotado:** 100% consumido (Vermelho).
- **Extrato de Lançamentos:** Listagem paginada dos lançamentos de despesas da rubrica selecionada, com botão de ação para visualização rápida do comprovante anexado.

#### 7.2 Módulo de Alocação de RH e Componente Interativo de Pills (Meses de Atuação)

Para cada colaborador associado ao projeto, a interface apresentará uma linha de alocação que detalha:

- Nome Completo, Titulação/Perfil e CPF mascarado (***.456.789-**).
- Valor Nominal da Bolsa CAPES, Seletor de Complemento (k ∈ {0,1,2,3}) e o Salário/Bolsa Mensal Final calculado dinamicamente em tela.
- **Componente de Matriz de Competências (Pills Temporal):** Um contêiner horizontal contendo botões interativos (pills) para cada mês do projeto (ex.: 03/26, 04/26, ..., 02/28):
  - **Pill Inativa (Cinza claro):** Mês não contemplado no plano de trabalho do bolsista.
  - **Pill Pendente (Fundo Âmbar, Borda Amarela):** Mês programado, mas sem liquidação financeira registrada.
  - **Pill Baixada/Paga (Fundo Verde Esmeralda, Ícone de Check):** Pagamento efetuado e registrado.

**Exemplo Visual do Componente de Pills (Bolsista: João Silva):**

```
+---------+---------+---------+---------+---------+---------+
| MAR/26  | ABR/26  | MAI/26  | JUN/26  | JUL/26  | AGO/26  |
|  [ ✓ ]  |  [ ✓ ]  | [ PEND ]| [ PEND ]| [ OFF ] | [ OFF ] |
|  Verde  |  Verde  | Amarelo | Amarelo | Cinza   | Cinza   |
+---------+---------+---------+---------+---------+---------+
```

#### 7.3 Operação de "Dar Baixa" em Folha e Controle de Pagamentos

1. **Baixa Individual:** O gestor clica sobre a Pill amarela de um colaborador específico. Abre-se um diálogo modal contendo: Nome do Colaborador, Projeto, Mês/Ano de Referência, Valor a ser Liquidado e Rubrica de Débito (automaticamente atribuída como RH). Ao clicar em "Confirmar Liquidação", o backend processa o débito na rubrica RH, altera o status da competência para 'PAGO', grava o usuário autenticado em `usuario_baixa_id` e emite o registro em `audit_logs`.

2. **Baixa em Lote:** O gestor pode selecionar a opção "Baixar Competência do Mês Corrente". O sistema exibe o total global da folha, a lista nominal de pessoas e valida se o saldo S_{RH} comporta o montante agregado. Em caso positivo, efetua a liquidação atômica de todos os participantes sob uma única transação SQL.

#### 7.4 Central de Repositório de Documentos e Módulo Segregado de Contratos de RH

A interface de gestão documental subdivide-se em duas seções lógicas:

1. **Repositório Geral do Projeto:** Upload de notas fiscais, faturas de serviços de terceiros, relatórios técnicos semestrais e apresentações de resultados. Aberto para visualização de todos os membros alocados.

2. **Módulo Especial e Segregado — Contratos de Recursos Humanos:**
   - Área estritamente confidencial, protegida por barreira de permissão (RBAC: perfis GESTOR e COORDENADOR).
   - Armazena: Termos de Aceite e Concessão de Bolsa, Termos de Compromisso e Não Acúmulo de Vínculo Empregatício, Contratos de Pesquisa, Comprovantes de Escolaridade/Titulação e Planos Individuais de Trabalho (PIT).
   - Colaboradores com perfil BOLSISTA ou PESQUISADOR não visualizam sequer a existência da aba de contratos de terceiros (ocultação total na UI e bloqueio com HTTP 403 Forbidden no backend).

#### 7.5 Painel de Relatórios Gerenciais

Geração de telas preparadas com estilos de impressão (`@media print`) e exportação estruturada:

- **Relatório ANEEL por Rubricas:** Quadro consolidado demonstrando dotação orçamentária inicial, aditivos, valores executados e saldos remanescentes.
- **Extrato Mensal da Folha de Pagamento:** Consolidação da folha de bolsistas por projeto e listagem consolidada interprojetos (visão corporativa da instituição de pesquisa).
- **Relatório de Pendências Financeiras:** Listagem de competências passadas que não tiveram a respectiva baixa financeira concluída.

---

### 8 Matriz de Controle de Acesso Baseada em Funções (RBAC)

A segurança deve ser exercida no nível das rotas e validada por tokens JWT assinados:

| Ação / Módulo | Gestor Geral | Coordenador do Projeto | Pesquisador | Bolsista |
|---|---|---|---|---|
| Cadastrar Novo Projeto | Permitido | Negado | Negado | Negado |
| Definir Valores de Rubricas | Permitido | Leitura | Leitura | Negado |
| Alocar Usuários ao Projeto | Permitido | Permitido | Negado | Negado |
| Realizar Lançamento Financeiro | Permitido | Permitido | Negado | Negado |
| Alterar Nível de Bolsa (k) | Permitido | Permitido | Negado | Negado |
| Dar Baixa em Pagamento (Folha) | Permitido | Negado | Negado | Negado |
| Acessar Contratos de RH | Permitido | Permitido (próprio proj.) | Negado | Negado |
| Upload de Arquivos Gerais | Permitido | Permitido | Permitido | Leitura |
| Visualizar Auditoria Forense | Permitido | Negado | Negado | Negado |

---

### 9 Atribuições da Equipe

1. **Infraestrutura e Migrações:** Inicializar o banco de dados no Neon; escrever e executar as migrações DDL completas; configurar pools de conexão e índices.
2. **Modelagem e Validação Zod:** Criar todos os schemas de validação no TypeScript para assegurar que dados recebidos nas requisições obedeçam às regras de negócio.
3. **Mecanismo de Persistência Binária:** Desenvolver as rotas com suporte a streams multipart para a ingestão de documentos no campo BYTEA; configurar cálculo automatizado de SHA-256 e recuperação com MIME types corretos.
4. **Transações Orçamentárias ACID:** Implementar a lógica de débito em rubricas dentro de transações seguras no PostgreSQL (`BEGIN ... COMMIT`), impedindo condições de corrida (race conditions) e saldos negativos.
5. **Motor de Cálculo de Bolsas e Baixa de Folha:** Implementar os endpoints de cálculo da fórmula de bolsas e a liquidação em lote/unitária de competências.
6. **Trilha de Auditoria:** Desenvolver a rotina de interceptação que captura as alterações de tabelas e alimenta a entidade `audit_logs`.
7. **Setup do Frontend e Rotas:** Inicializar o ambiente Vite com TypeScript e Tailwind CSS; estruturar a malha de rotas protegidas com React Router DOM; configurar autenticação via JWT no cliente com interceptores Axios/Fetch.
8. **Componente de Matriz Temporal (Pills):** Criar o componente modular e reativo das pills de competência mensal, com animações suaves de transição de estado e renderização visual condicional (Pendente, Pago, Inativo).
9. **Dashboards e Painéis Financeiros:** Construir o painel orçamentário das rubricas ANEEL, com cartões de indicadores, gráficos de barras de consumo orçamentário e tabelas de lançamentos financeiros.
10. **Gerenciador de Alocação de Pessoal:** Desenvolver a interface onde o gestor/coordenador seleciona colaboradores, define papéis, escolhe a bolsa base e interage com o seletor dos níveis de complemento (0, +1/3, +2/3, Dobro), visualizando o cálculo em tempo real.
11. **Componente de Ingestão de Documentos:** Criar área de envio de arquivos com suporte a arrastar-e-soltar (drag and drop), com indicadores visuais de progresso de upload e validação de extensão antes do disparo.
12. **Área Segregada de Contratos de RH e Módulo de Relatórios:** Desenvolver a interface segura dos contratos e compor os layouts dos relatórios impressos e visuais para prestação de contas.

---

### 10 Cronograma de Execução e Metas por Sprint

O desenvolvimento está estruturado em 6 sprints DIÁRIOS:

```
+-----------------------------------------------------------------------------+
| CRONOGRAMA DE SPRINTS (6 DIAS)                                              |
+-----------------------------------------------------------------------------+
| SPRINT 1: Setup, Modelagem DDL no Neon, Auth JWT e Layout Base              |
| SPRINT 2: Gestão de Projetos, Orçamento ANEEL e Motor de Lançamentos        |
| SPRINT 3: Mecanismo de Bolsas, Matriz Temporal (Pills) e Folha              |
| SPRINT 4: Liquidação Financeira (Baixas) e Relatórios Contábeis             |
| SPRINT 5: Persistência Binária (BYTEA), Uploads e Contratos de RH           |
| SPRINT 6: Auditoria Forense, Otimização de Queries e Validação de Aceite    |
+-----------------------------------------------------------------------------+
```

---

### 11 Sprint 1: Fundação do Sistema, Esquema Relacional e Autenticação

- Configuração da instância Neon; aplicação das migrações do DDL; desenvolvimento do serviço de autenticação com senhas criptografadas via bcrypt e emissão de tokens JWT; implementação do middleware de RBAC.
- Configuração do repositório React + Vite com TypeScript; parametrização do Tailwind CSS; desenvolvimento das telas de Login, recuperação de credenciais e esqueleto estrutural da aplicação (Sidebar, Header e breadcrumbs).

---

### 12 Sprint 2: Gestão de Projetos e Motor Orçamentário de Rubricas

- Criação das rotas de CRUD de Projetos; implementação da regra de inicialização das 6 rubricas orçamentárias obrigatórias ANEEL; endpoint de lançamento financeiro com validação de saldo S_r ≥ v.
- Interface de cadastro de projetos; visualizador de rubricas orçamentárias com barras de progresso percentual; formulário modal de inserção de lançamentos de despesas.

---

### 13 Sprint 3: Alocação de Recursos Humanos e Componente de Pills

- Implementação da tabela de alocação de RH; motor de cálculo da bolsa conforme a equação V_{nominal} · (1 + k/3); geração automatizada dos registros de competências mensais do projeto.
- Construção do componente interativo de Pills de competências; tela de alocação de equipe com seleção de nível de complementação e reflexo instantâneo do valor da bolsa.

---

### 14 Sprint 4: Gestão de Folha de Pagamento e Rotinas de Baixa

- Criação dos endpoints para liquidação de competências (`/api/folha/baixar-individual` e `/api/folha/baixar-lote`); débito automático no montante da rubrica RH; validação de disponibilidade de caixa do projeto.
- Painel consolidado da Folha de Pagamento (visão do projeto e visão agregada da instituição); modal interativo de confirmação de baixa; filtros de listagem por competência, colaborador e pendência.

---

### 15 Sprint 5: Repositório de Documentos Interno no Banco de Dados

- Criação das rotas de ingestão de arquivos binários multipart; gravação do conteúdo na tabela `documentos_payload` (BYTEA); cálculo do checksum SHA-256; endpoints seguros de recuperação com headers de stream; controle de acesso aos Contratos de RH.
- Componente de upload unificado (drag-and-drop); visualizador integrado para pré-visualização de documentos (PDF e imagens em modal); isolamento visual estrito da pasta de Contratos de Recursos Humanos.

---

### 16 Sprint 6: Trilha de Auditoria, Testes Integrados e Fechamento

- Ativação das rotinas de log de auditoria em operações de alteração financeira; otimização de índices de busca no PostgreSQL; execução de testes de carga e concorrência na baixa de pagamentos.
- Interface de visualização da Trilha de Auditoria com filtros por usuário e data; refinamento responsivo de todas as telas; aplicação dos estilos para emissão limpa de relatórios em modo de impressão (`@media print`).

---

### 17 Critérios de Homologação e Definição de Pronto (Definition of Done - DoD)

Para que o projeto seja considerado concluído e aprovado pela coordenação, os seguintes requisitos formais deverão ser integralmente comprovados:

1. **Tipagem Estrita sem Concessões:** Zero ocorrências do tipo `any` no código TypeScript, tanto no Frontend quanto no Backend.
2. **Integridade do Teto Orçamentário:** O sistema deve abortar categoricamente qualquer tentativa de lançamento de despesa ou baixa de bolsa que resulte em saldo negativo (S_r < 0) na respectiva rubrica.
3. **Precisão do Cálculo de Bolsas:** O sistema deve validar matematicamente que para k=3 o valor da bolsa seja rigorosamente o dobro do valor nominal (2 × V_{nominal}), mantendo os acréscimos proporcionais de 1/3 e 2/3 para os níveis 1 e 2.
4. **Armazenamento Exclusivo em Banco de Dados:** Nenhuma dependência externa de serviços S3 ou salvamento no sistema de arquivos local (`fs.writeFile`) pode existir. Todos os arquivos devem transitar e repousar nas tabelas do Neon.
5. **Rastreabilidade Operacional Mandatória:** Cada baixa de pagamento efetuada pelo gestor deve gerar uma entrada indelével em `audit_logs`, registrando com precisão o executor, a data, a hora e o saldo precedente/sucedente.
6. **Proteção dos Contratos de RH:** Deve ser demonstrado que um usuário autenticado com credenciais de Pesquisador ou Bolsista é sumariamente bloqueado ao tentar consultar ou transferir qualquer documento categorizado como `CONTRATO_RH`.
