-- CustomERP Platform Database Schema
-- Migration: 001_initial_schema
-- Created: January 2026

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS - User accounts
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- 2. ROLES - Role definitions
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES 
    ('admin', 'Administrator with full access'),
    ('user', 'Standard business user')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 3. USER_ROLES - Many-to-many user-role mapping
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(role_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- ============================================
-- 4. PROJECTS - ERP generation projects
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_owner ON projects(owner_user_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Status values: Draft, Analyzing, Clarifying, Ready, Generated, Approved

-- ============================================
-- 5. SDFS - System Definition Files
-- ============================================
CREATE TABLE IF NOT EXISTS sdfs (
    sdf_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    sdf_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sdfs_project ON sdfs(project_id);

-- ============================================
-- 6. SDF_ENTITIES - Extracted entities from SDF
-- ============================================
CREATE TABLE IF NOT EXISTS sdf_entities (
    entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sdf_id UUID REFERENCES sdfs(sdf_id) ON DELETE CASCADE,
    slug VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sdf_entities_sdf ON sdf_entities(sdf_id);

-- ============================================
-- 7. SDF_ATTRIBUTES - Entity attributes/fields
-- ============================================
CREATE TABLE IF NOT EXISTS sdf_attributes (
    attribute_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID REFERENCES sdf_entities(entity_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT false,
    is_unique BOOLEAN DEFAULT false,
    default_value TEXT,
    constraints JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sdf_attributes_entity ON sdf_attributes(entity_id);

-- ============================================
-- 8. SDF_RELATIONS - Entity relationships
-- ============================================
CREATE TABLE IF NOT EXISTS sdf_relations (
    relation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sdf_id UUID REFERENCES sdfs(sdf_id) ON DELETE CASCADE,
    name VARCHAR(255),
    relation_type VARCHAR(50) NOT NULL, -- one-to-one, one-to-many, many-to-many
    source_entity_id UUID REFERENCES sdf_entities(entity_id) ON DELETE CASCADE,
    target_entity_id UUID REFERENCES sdf_entities(entity_id) ON DELETE CASCADE,
    source_field VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sdf_relations_sdf ON sdf_relations(sdf_id);

-- ============================================
-- 9. QUESTIONS - AI clarification questions
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
    question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'text', -- yes_no, choice, text
    options JSONB, -- For choice questions
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_project ON questions(project_id);

-- ============================================
-- 10. ANSWERS - User answers to questions
-- ============================================
CREATE TABLE IF NOT EXISTS answers (
    answer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID REFERENCES questions(question_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_answers_project ON answers(project_id);

-- ============================================
-- 11. MODULES - Generated ERP modules
-- ============================================
CREATE TABLE IF NOT EXISTS modules (
    module_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    module_type VARCHAR(50) NOT NULL, -- inventory, customer, invoicing
    status VARCHAR(50) DEFAULT 'pending', -- pending, generating, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_modules_project ON modules(project_id);

-- ============================================
-- 12. SCHEMA_ARTIFACTS - Generated files
-- ============================================
CREATE TABLE IF NOT EXISTS schema_artifacts (
    artifact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID REFERENCES modules(module_id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- js, jsx, json, yml
    content_hash VARCHAR(64), -- SHA256 for change detection
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_artifacts_module ON schema_artifacts(module_id);

-- ============================================
-- 13. GENERATION_JOBS - Async job tracking
-- ============================================
CREATE TABLE IF NOT EXISTS generation_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- analyze, clarify, generate, package
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    progress INTEGER DEFAULT 0, -- 0-100
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    error_message TEXT,
    result_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_project ON generation_jobs(project_id);
CREATE INDEX idx_jobs_status ON generation_jobs(status);

-- ============================================
-- 14. APPROVALS - Module approval decisions
-- ============================================
CREATE TABLE IF NOT EXISTS approvals (
    approval_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    module_id UUID REFERENCES modules(module_id) ON DELETE CASCADE,
    decided_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    decision VARCHAR(50) NOT NULL, -- approved, rejected, revision_requested
    comments TEXT,
    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_approvals_project ON approvals(project_id);

-- ============================================
-- 15. LOG_ENTRIES - Audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS log_entries (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    level VARCHAR(20) NOT NULL, -- info, warn, error
    category VARCHAR(50), -- auth, project, ai, generation
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_project ON log_entries(project_id);
CREATE INDEX idx_logs_level ON log_entries(level);
CREATE INDEX idx_logs_created ON log_entries(created_at);

-- ============================================
-- Trigger for updated_at timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Summary
-- ============================================
-- Tables created:
--   1. users
--   2. roles
--   3. user_roles
--   4. projects
--   5. sdfs
--   6. sdf_entities
--   7. sdf_attributes
--   8. sdf_relations
--   9. questions
--  10. answers
--  11. modules
--  12. schema_artifacts
--  13. generation_jobs
--  14. approvals
--  15. log_entries

