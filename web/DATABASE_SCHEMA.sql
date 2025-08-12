-- =====================================================
-- Voice Whisper Bot - Оптимальная схема БД
-- Основана на research tldraw позиционирования
-- =====================================================

-- Удаляем старые таблицы если есть (для dev окружения)
DROP TABLE IF EXISTS note_relations CASCADE;
DROP TABLE IF EXISTS note_collections CASCADE;
DROP TABLE IF EXISTS note_position_history CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- ОСНОВНЫЕ ТАБЛИЦЫ
-- =====================================================

-- Таблица пользователей
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'ru',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Основная таблица заметок (минимальная структура для MVP)
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Связь с пользователем
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Основной контент
    title VARCHAR(500) NOT NULL,
    content TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('voice', 'text', 'collection')),
    
    -- Позиционирование (вычисляем x,y на основе этих данных)
    date DATE NOT NULL,              -- Дата определяет колонку
    time TIME DEFAULT CURRENT_TIME,  -- Время для сортировки внутри колонки
    order_in_column INTEGER DEFAULT 0, -- Ручная сортировка если нужно
    
    -- Специфичные поля для типов
    voice_duration INTEGER,          -- Длительность в секундах для voice заметок
    voice_file_url TEXT,            -- URL файла в S3 или локальном хранилище
    
    -- Telegram метаданные
    telegram_message_id BIGINT,
    telegram_chat_id BIGINT,
    
    -- Статус и метаданные
    is_archived BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    tags TEXT[], -- Массив тегов
    
    -- Системные поля
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ограничения
    CONSTRAINT valid_voice_note CHECK (
        (type != 'voice') OR (voice_duration IS NOT NULL AND voice_file_url IS NOT NULL)
    )
);

-- =====================================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- =====================================================

-- Основные индексы для быстрой выборки
CREATE INDEX idx_notes_user_date ON notes(user_id, date DESC);
CREATE INDEX idx_notes_date_order ON notes(date DESC, order_in_column, time);
CREATE INDEX idx_notes_type ON notes(type);
CREATE INDEX idx_notes_archived ON notes(is_archived) WHERE is_archived = false;
CREATE INDEX idx_notes_pinned ON notes(is_pinned) WHERE is_pinned = true;

-- GIN индекс для поиска по тегам
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);

-- Полнотекстовый поиск
CREATE INDEX idx_notes_search ON notes USING GIN(
    to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(content, ''))
);

-- =====================================================
-- РАСШИРЕННЫЕ ТАБЛИЦЫ (для будущего)
-- =====================================================

-- Таблица для группировки заметок в коллекции
CREATE TABLE note_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    child_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    position_in_collection INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(parent_note_id, child_note_id)
);

-- Таблица для связей между заметками
CREATE TABLE note_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    to_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    relation_type VARCHAR(20) CHECK (relation_type IN ('follows', 'references', 'replies_to', 'related')),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(from_note_id, to_note_id, relation_type)
);

-- Опциональная таблица для кеширования позиций (для оптимизации)
CREATE TABLE note_position_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    source VARCHAR(20) CHECK (source IN ('auto', 'user', 'system')),
    changed_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ФУНКЦИИ И ТРИГГЕРЫ
-- =====================================================

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для обновления updated_at
CREATE TRIGGER update_notes_updated_at 
    BEFORE UPDATE ON notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Функция для автоматического присвоения order_in_column
CREATE OR REPLACE FUNCTION assign_order_in_column()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_in_column IS NULL OR NEW.order_in_column = 0 THEN
        SELECT COALESCE(MAX(order_in_column), 0) + 1
        INTO NEW.order_in_column
        FROM notes
        WHERE user_id = NEW.user_id 
          AND date = NEW.date
          AND is_archived = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического присвоения порядка
CREATE TRIGGER assign_note_order 
    BEFORE INSERT ON notes 
    FOR EACH ROW 
    EXECUTE FUNCTION assign_order_in_column();

-- =====================================================
-- VIEWS ДЛЯ УДОБСТВА
-- =====================================================

-- View для активных заметок текущей недели
CREATE VIEW active_notes_week AS
SELECT 
    n.*,
    u.telegram_username,
    ARRAY_AGG(DISTINCT nc.child_note_id) AS collection_items
FROM notes n
LEFT JOIN users u ON n.user_id = u.id
LEFT JOIN note_collections nc ON n.id = nc.parent_note_id
WHERE n.is_archived = false
  AND n.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY n.id, u.telegram_username
ORDER BY n.date DESC, n.order_in_column, n.time;

-- View для статистики по пользователям
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.telegram_username,
    COUNT(n.id) AS total_notes,
    COUNT(CASE WHEN n.type = 'voice' THEN 1 END) AS voice_notes,
    COUNT(CASE WHEN n.type = 'text' THEN 1 END) AS text_notes,
    COUNT(CASE WHEN n.type = 'collection' THEN 1 END) AS collections,
    MAX(n.created_at) AS last_note_at
FROM users u
LEFT JOIN notes n ON u.id = n.user_id
GROUP BY u.id, u.telegram_username;

-- =====================================================
-- ФУНКЦИИ API ДЛЯ BACKEND
-- =====================================================

-- Функция для получения заметок с вычисленными позициями
CREATE OR REPLACE FUNCTION get_notes_with_positions(
    p_user_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    content TEXT,
    type VARCHAR,
    date DATE,
    time TIME,
    order_in_column INTEGER,
    calculated_x INTEGER,
    calculated_y INTEGER
) AS $$
DECLARE
    v_column_width INTEGER := 180;
    v_column_spacing INTEGER := 50;
    v_start_x INTEGER := 100;
    v_start_y INTEGER := 120;
    v_row_height INTEGER := 150;
    v_row_spacing INTEGER := 30;
BEGIN
    RETURN QUERY
    WITH date_columns AS (
        SELECT DISTINCT date,
               DENSE_RANK() OVER (ORDER BY date) - 1 AS column_index
        FROM notes
        WHERE user_id = p_user_id
          AND date BETWEEN p_start_date AND p_end_date
          AND is_archived = false
    ),
    notes_with_row_numbers AS (
        SELECT n.*,
               dc.column_index,
               ROW_NUMBER() OVER (PARTITION BY n.date ORDER BY n.order_in_column, n.time) - 1 AS row_index
        FROM notes n
        JOIN date_columns dc ON n.date = dc.date
        WHERE n.user_id = p_user_id
          AND n.is_archived = false
    )
    SELECT 
        n.id,
        n.title,
        n.content,
        n.type,
        n.date,
        n.time,
        n.order_in_column,
        v_start_x + (n.column_index * (v_column_width + v_column_spacing)) AS calculated_x,
        v_start_y + (n.row_index * (v_row_height + v_row_spacing)) AS calculated_y
    FROM notes_with_row_numbers n
    ORDER BY n.date DESC, n.order_in_column, n.time;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ТЕСТОВЫЕ ДАННЫЕ (для разработки)
-- =====================================================

-- Вставляем тестового пользователя
INSERT INTO users (telegram_id, telegram_username, first_name) 
VALUES (123456789, 'test_user', 'Test');

-- Вставляем тестовые заметки
INSERT INTO notes (user_id, title, content, type, date, time) VALUES
((SELECT id FROM users WHERE telegram_id = 123456789), 'Утренний стендап', 'Обсуждение задач на день', 'voice', CURRENT_DATE, '09:00'),
((SELECT id FROM users WHERE telegram_id = 123456789), 'Список дел', '- Позвонить клиенту\n- Code review\n- Документация', 'text', CURRENT_DATE, '10:00'),
((SELECT id FROM users WHERE telegram_id = 123456789), 'Идея для проекта', 'Интеграция с Notion API', 'text', CURRENT_DATE, '11:30'),
((SELECT id FROM users WHERE telegram_id = 123456789), 'Встреча с командой', 'Обсуждение архитектуры', 'voice', CURRENT_DATE - INTERVAL '1 day', '14:00'),
((SELECT id FROM users WHERE telegram_id = 123456789), 'Заметки по рефакторингу', 'Нужно улучшить производительность', 'text', CURRENT_DATE - INTERVAL '1 day', '16:00');

-- =====================================================
-- ПРАВА ДОСТУПА
-- =====================================================

-- Создаем роль для приложения (если нужно)
-- CREATE ROLE voice_bot_app LOGIN PASSWORD 'secure_password';
-- GRANT CONNECT ON DATABASE your_database TO voice_bot_app;
-- GRANT USAGE ON SCHEMA public TO voice_bot_app;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO voice_bot_app;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO voice_bot_app;