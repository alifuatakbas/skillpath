-- ================================
-- 5000 KULLANICI İÇİN KRİTİK DATABASE İNDEXLERİ
-- Bu SQL'leri MySQL'de çalıştır!
-- ================================

-- Performans için kritik indexler

-- User tablosu optimizasyonu
CREATE INDEX idx_users_email ON users(email) IF NOT EXISTS;
CREATE INDEX idx_users_active ON users(is_active) IF NOT EXISTS;
CREATE INDEX idx_users_subscription ON users(subscription_type) IF NOT EXISTS;
CREATE INDEX idx_users_created_at ON users(created_at) IF NOT EXISTS;

-- Community Posts optimizasyonu (En kritik!)
CREATE INDEX idx_posts_active ON community_posts(is_active) IF NOT EXISTS;
CREATE INDEX idx_posts_skill ON community_posts(skill_name) IF NOT EXISTS;
CREATE INDEX idx_posts_user_id ON community_posts(user_id) IF NOT EXISTS;
CREATE INDEX idx_posts_created_at ON community_posts(created_at DESC) IF NOT EXISTS;
CREATE INDEX idx_posts_likes ON community_posts(likes_count DESC) IF NOT EXISTS;
CREATE INDEX idx_posts_replies ON community_posts(replies_count DESC) IF NOT EXISTS;
CREATE INDEX idx_posts_type ON community_posts(post_type) IF NOT EXISTS;
CREATE INDEX idx_posts_expert ON community_posts(is_expert_post) IF NOT EXISTS;

-- Community Replies optimizasyonu  
CREATE INDEX idx_replies_post_id ON community_replies(post_id) IF NOT EXISTS;
CREATE INDEX idx_replies_user_id ON community_replies(user_id) IF NOT EXISTS;
CREATE INDEX idx_replies_active ON community_replies(is_active) IF NOT EXISTS;
CREATE INDEX idx_replies_created_at ON community_replies(created_at DESC) IF NOT EXISTS;

-- Community Likes optimizasyonu (Beğeni sistemi için kritik!)
CREATE INDEX idx_likes_user_post ON community_likes(user_id, post_id) IF NOT EXISTS;
CREATE INDEX idx_likes_user_reply ON community_likes(user_id, reply_id) IF NOT EXISTS;
CREATE INDEX idx_likes_post_id ON community_likes(post_id) IF NOT EXISTS;
CREATE INDEX idx_likes_reply_id ON community_likes(reply_id) IF NOT EXISTS;

-- Roadmaps optimizasyonu
CREATE INDEX idx_roadmaps_user_id ON roadmaps(user_id) IF NOT EXISTS;
CREATE INDEX idx_roadmaps_active ON roadmaps(is_active) IF NOT EXISTS;
CREATE INDEX idx_roadmaps_skill_id ON roadmaps(skill_id) IF NOT EXISTS;

-- User Progress optimizasyonu
CREATE INDEX idx_progress_user_id ON user_progress(user_id) IF NOT EXISTS;
CREATE INDEX idx_progress_roadmap_id ON user_progress(roadmap_id) IF NOT EXISTS;
CREATE INDEX idx_progress_step_id ON user_progress(step_id) IF NOT EXISTS;
CREATE INDEX idx_progress_status ON user_progress(status) IF NOT EXISTS;

-- Notification sistemleri optimizasyonu
CREATE INDEX idx_notifications_user_id ON notification_logs(user_id) IF NOT EXISTS;
CREATE INDEX idx_notifications_sent_at ON notification_logs(sent_at DESC) IF NOT EXISTS;
CREATE INDEX idx_notifications_type ON notification_logs(notification_type) IF NOT EXISTS;

CREATE INDEX idx_notification_prefs_user_id ON notification_preferences(user_id) IF NOT EXISTS;
CREATE INDEX idx_notification_prefs_reminder ON notification_preferences(daily_reminder_enabled, daily_reminder_time) IF NOT EXISTS;

-- Push Tokens optimizasyonu
CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id) IF NOT EXISTS;
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active) IF NOT EXISTS;
CREATE INDEX idx_push_tokens_device ON push_tokens(device_type) IF NOT EXISTS;

-- User Activities optimizasyonu
CREATE INDEX idx_activities_user_id ON user_activities(user_id) IF NOT EXISTS;
CREATE INDEX idx_activities_type ON user_activities(activity_type) IF NOT EXISTS;
CREATE INDEX idx_activities_created_at ON user_activities(created_at DESC) IF NOT EXISTS;

-- Skills optimizasyonu
CREATE INDEX idx_skills_active ON skills(is_active) IF NOT EXISTS;
CREATE INDEX idx_skills_category ON skills(category) IF NOT EXISTS;
CREATE INDEX idx_skills_difficulty ON skills(difficulty_level) IF NOT EXISTS;

-- ================================
-- COMPOSITE INDEX'LER (Daha da hızlı sorgular için)
-- ================================

-- Community posts için composite indexler
CREATE INDEX idx_posts_active_skill ON community_posts(is_active, skill_name) IF NOT EXISTS;
CREATE INDEX idx_posts_active_created ON community_posts(is_active, created_at DESC) IF NOT EXISTS;
CREATE INDEX idx_posts_active_likes ON community_posts(is_active, likes_count DESC) IF NOT EXISTS;
CREATE INDEX idx_posts_user_active ON community_posts(user_id, is_active) IF NOT EXISTS;

-- User progress için composite indexler  
CREATE INDEX idx_progress_user_roadmap ON user_progress(user_id, roadmap_id) IF NOT EXISTS;
CREATE INDEX idx_progress_roadmap_status ON user_progress(roadmap_id, status) IF NOT EXISTS;

-- ================================
-- PERFORMANS AYARLARI
-- ================================

-- MySQL ayarları (my.cnf dosyasına ekle)
/*
[mysqld]
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
max_connections = 200
query_cache_type = 1
query_cache_size = 64M
tmp_table_size = 64M
max_heap_table_size = 64M
*/

-- ================================
-- INDEX USAGE KONTROL KOMUTLARI
-- ================================

-- Index'lerin kullanılıp kullanılmadığını kontrol et:
-- EXPLAIN SELECT * FROM community_posts WHERE is_active = 1 ORDER BY created_at DESC LIMIT 20;
-- EXPLAIN SELECT * FROM community_likes WHERE user_id = 1 AND post_id = 1;

-- Index boyutlarını kontrol et:
-- SELECT 
--     table_name,
--     index_name,
--     stat_value as pages_count
-- FROM mysql.innodb_index_stats 
-- WHERE database_name = 'skillpath' 
-- ORDER BY stat_value DESC; 