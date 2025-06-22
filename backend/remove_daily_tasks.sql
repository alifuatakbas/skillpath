-- Daily task sistemini tamamen kaldır

-- Önce foreign key constraint'leri kontrol et
DROP TABLE IF EXISTS daily_tasks;
DROP TABLE IF EXISTS study_sessions;

-- XP history'den daily task ile ilgili kayıtları sil
DELETE FROM xp_history WHERE reference_type IN ('daily_task', 'study_session');

-- User achievements'tan daily task ile ilgili achievement'ları sil
DELETE FROM user_achievements WHERE achievement_id IN (
    SELECT id FROM achievements WHERE category = 'daily_task' OR name LIKE '%Daily%' OR name LIKE '%Günlük%'
);

-- Achievement tablosundan daily task ile ilgili achievement'ları sil
DELETE FROM achievements WHERE category = 'daily_task' OR name LIKE '%Daily%' OR name LIKE '%Günlük%';

-- Kontrol et
SELECT COUNT(*) as remaining_daily_tasks FROM information_schema.tables WHERE table_name = 'daily_tasks';
SELECT COUNT(*) as remaining_study_sessions FROM information_schema.tables WHERE table_name = 'study_sessions'; 