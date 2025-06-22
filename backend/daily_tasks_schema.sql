-- ================================
-- GÜNLÜK AKTİVİTE VE GAMİFİCATİON SİSTEMİ
-- ================================

-- Günlük görevler tablosu
CREATE TABLE daily_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    roadmap_id INT NOT NULL,
    step_id INT NOT NULL,
    day_number INT NOT NULL, -- Kaçıncı gün (1, 2, 3...)
    title VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_minutes INT DEFAULT 120, -- Tahmini süre (dakika)
    task_type ENUM('reading', 'practice', 'project', 'quiz') DEFAULT 'practice',
    resources JSON, -- Kaynaklar (linkler, dökümanlar)
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id),
    FOREIGN KEY (step_id) REFERENCES roadmap_steps(id),
    INDEX idx_roadmap_day (roadmap_id, day_number),
    INDEX idx_step_day (step_id, day_number)
);

-- Günlük çalışma seansları
CREATE TABLE study_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    roadmap_id INT,
    daily_task_id INT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    duration_minutes INT DEFAULT 0,
    session_type ENUM('focus', 'break', 'review') DEFAULT 'focus',
    notes TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id),
    FOREIGN KEY (daily_task_id) REFERENCES daily_tasks(id),
    INDEX idx_user_date (user_id, start_time)
);

-- Gamification tabloları
CREATE TABLE user_gamification (
    user_id INT PRIMARY KEY,
    total_xp INT DEFAULT 0,
    current_level INT DEFAULT 1,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_activity_date DATE,
    daily_xp_today INT DEFAULT 0,
    weekly_xp INT DEFAULT 0,
    monthly_xp INT DEFAULT 0,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Rozetler tablosu
CREATE TABLE achievements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    xp_reward INT DEFAULT 0,
    category ENUM('learning', 'community', 'streak', 'special') DEFAULT 'learning',
    condition_type VARCHAR(50), -- 'complete_roadmap', 'streak_days', 'total_xp'
    condition_value INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kullanıcı rozetleri
CREATE TABLE user_achievements (
    user_id INT,
    achievement_id INT,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    xp_earned INT DEFAULT 0,
    
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);

-- XP geçmişi
CREATE TABLE xp_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    xp_amount INT NOT NULL,
    reason VARCHAR(100),
    reference_type VARCHAR(50), -- 'daily_task', 'study_session', 'community_post'
    reference_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_date (user_id, created_at)
);

-- Günlük görevler için başlangıç verileri
INSERT INTO achievements (name, description, icon, xp_reward, category, condition_type, condition_value) VALUES
('İlk Adım', 'İlk günlük görevini tamamla', '🎯', 25, 'learning', 'complete_daily_task', 1),
('Günlük Kahraman', 'Bir günde tüm görevleri tamamla', '⭐', 50, 'learning', 'complete_day_tasks', 1),
('3 Günlük Streak', '3 gün üst üste çalış', '🔥', 100, 'streak', 'streak_days', 3),
('Haftalık Şampiyon', '7 gün üst üste çalış', '👑', 250, 'streak', 'streak_days', 7),
('Çalışkan', 'Toplam 10 saat çalış', '📚', 150, 'learning', 'total_study_hours', 600),
('İlk Roadmap', 'İlk roadmap\'ini tamamla', '🏆', 500, 'learning', 'complete_roadmap', 1),
('Topluluk Üyesi', 'İlk soruyu sor', '💬', 25, 'community', 'create_post', 1),
('Yardımsever', '5 yoruma cevap ver', '🤝', 75, 'community', 'reply_count', 5); 