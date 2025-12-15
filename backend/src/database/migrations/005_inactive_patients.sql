-- Migration: Tabela de Pacientes Inativos
-- Armazena pacientes que não visitam a clínica há muito tempo
-- Dados desde 01/01/2024 até hoje, atualizado a cada 15 minutos

-- Tabela principal de pacientes inativos
CREATE TABLE IF NOT EXISTS pacientes_inativos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    cliente_nome VARCHAR(255) NOT NULL,
    cod_estab INTEGER,
    telefone VARCHAR(50),
    celular VARCHAR(50),
    email VARCHAR(255),
    ultima_visita DATE NOT NULL,
    dias_sem_vir INTEGER NOT NULL,
    total_investido DECIMAL(12, 2) DEFAULT 0,
    total_compras INTEGER DEFAULT 0,
    ticket_medio DECIMAL(12, 2) DEFAULT 0,
    nivel_risco VARCHAR(20) DEFAULT 'medio', -- critico, alto, medio, baixo
    data_inclusao TIMESTAMP DEFAULT NOW(),
    data_atualizacao TIMESTAMP DEFAULT NOW(),
    reativado_em TIMESTAMP, -- Preenchido quando paciente agenda novamente
    UNIQUE(cliente_id)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_pacientes_inativos_dias ON pacientes_inativos(dias_sem_vir DESC);
CREATE INDEX IF NOT EXISTS idx_pacientes_inativos_risco ON pacientes_inativos(nivel_risco);
CREATE INDEX IF NOT EXISTS idx_pacientes_inativos_investido ON pacientes_inativos(total_investido DESC);
CREATE INDEX IF NOT EXISTS idx_pacientes_inativos_ultima_visita ON pacientes_inativos(ultima_visita);
CREATE INDEX IF NOT EXISTS idx_pacientes_inativos_reativado ON pacientes_inativos(reativado_em) WHERE reativado_em IS NULL;

-- Historico de reativacoes
CREATE TABLE IF NOT EXISTS pacientes_inativos_historico (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    cliente_nome VARCHAR(255),
    dias_inativo INTEGER,
    total_investido_quando_inativo DECIMAL(12, 2),
    data_reativacao TIMESTAMP DEFAULT NOW(),
    data_nova_visita DATE
);

CREATE INDEX IF NOT EXISTS idx_historico_cliente ON pacientes_inativos_historico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_historico_data ON pacientes_inativos_historico(data_reativacao);

-- Adicionar entrada no sync_status para controle
INSERT INTO sync_status (entity_type, sync_interval_minutes, is_enabled)
VALUES ('pacientes_inativos', 15, true)
ON CONFLICT (entity_type) DO UPDATE SET
    sync_interval_minutes = 15,
    is_enabled = true;

-- Comentarios
COMMENT ON TABLE pacientes_inativos IS 'Pacientes que nao visitam a clinica ha mais de X dias. Atualizado a cada 15 minutos.';
COMMENT ON COLUMN pacientes_inativos.nivel_risco IS 'critico (180+ dias), alto (120-179 dias), medio (90-119 dias), baixo (60-89 dias)';
COMMENT ON COLUMN pacientes_inativos.reativado_em IS 'Data em que o paciente foi removido da lista por ter agendado novamente';
