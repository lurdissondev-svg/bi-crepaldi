-- ============================================================
-- BI CREPALDI - User Management Schema
-- Migration 006
-- Sistema de autenticacao, usuarios, cargos e permissoes
-- ============================================================

-- ============================================================
-- TABELAS DE USUARIOS E PERMISSOES
-- ============================================================

-- Cargos/Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS 'Cargos de usuarios para controle de acesso';

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role_id INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_role FOREIGN KEY (role_id)
        REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

COMMENT ON TABLE users IS 'Usuarios do sistema com autenticacao';

-- Permissoes por cargo (paginas que cada cargo pode acessar)
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL,
    page_slug VARCHAR(50) NOT NULL,
    can_view BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_permission_role FOREIGN KEY (role_id)
        REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT uq_role_page UNIQUE (role_id, page_slug)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

COMMENT ON TABLE role_permissions IS 'Permissoes de acesso a paginas por cargo';

-- Refresh tokens para JWT
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_token_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

COMMENT ON TABLE refresh_tokens IS 'Tokens de refresh para autenticacao JWT';

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_role_permissions_updated_at ON role_permissions;
CREATE TRIGGER update_role_permissions_updated_at BEFORE UPDATE ON role_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED: Cargos padrao
-- ============================================================

INSERT INTO roles (name, description, is_system_role) VALUES
    ('Admin', 'Administrador do sistema com acesso total', true),
    ('Diretor', 'Diretor com acesso total e gestao de usuarios', true),
    ('Gerente', 'Gerente com acesso configuravel', false),
    ('Operador', 'Operador com acesso limitado', false)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED: Permissoes padrao por cargo
-- ============================================================

-- Paginas disponiveis no sistema
-- resumo, faturamento, marketing, comercial, atendimento, metas, pacientes, meta-ads, como-funciona, usuarios

DO $$
DECLARE
    role_rec RECORD;
    pages TEXT[] := ARRAY[
        'resumo',
        'faturamento',
        'marketing',
        'comercial',
        'atendimento',
        'metas',
        'pacientes',
        'meta-ads',
        'como-funciona',
        'usuarios'
    ];
    page TEXT;
BEGIN
    FOR role_rec IN SELECT id, name FROM roles LOOP
        FOREACH page IN ARRAY pages LOOP
            INSERT INTO role_permissions (role_id, page_slug, can_view)
            VALUES (
                role_rec.id,
                page,
                CASE
                    -- Admin e Diretor: acesso total
                    WHEN role_rec.name IN ('Admin', 'Diretor') THEN true
                    -- Gerente: tudo exceto usuarios
                    WHEN role_rec.name = 'Gerente' AND page != 'usuarios' THEN true
                    -- Operador: apenas paginas basicas
                    WHEN role_rec.name = 'Operador' AND page IN ('resumo', 'faturamento', 'como-funciona') THEN true
                    ELSE false
                END
            )
            ON CONFLICT (role_id, page_slug) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================
-- SEED: Usuario admin inicial
-- Senha padrao: admin123 (DEVE SER ALTERADA)
-- Hash bcrypt gerado com 10 salt rounds
-- ============================================================

INSERT INTO users (email, password_hash, name, role_id)
SELECT
    'admin@grupocrepaldi.com.br',
    '$2b$10$8K1p/q8Q9Q9Q9Q9Q9Q9QuOWvTI3Mp5.C.ry.VQoEq1D1P3xJGI9HO',
    'Administrador',
    (SELECT id FROM roles WHERE name = 'Admin')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@grupocrepaldi.com.br');
