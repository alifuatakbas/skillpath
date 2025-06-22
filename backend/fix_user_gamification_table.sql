-- Fix user_gamification table schema
-- Add missing id column and update table structure

-- First backup existing data
CREATE TABLE user_gamification_backup AS SELECT * FROM user_gamification;

-- Drop existing table
DROP TABLE user_gamification;

-- Recreate table with proper schema
CREATE TABLE user_gamification (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    total_xp INT DEFAULT 0,
    current_level INT DEFAULT 1,
    daily_xp_today INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_activity_date DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);

-- Restore data from backup (excluding id since it will auto-increment)
INSERT INTO user_gamification (
    user_id, total_xp, current_level, daily_xp_today, 
    current_streak, longest_streak, last_activity_date, created_at, updated_at
)
SELECT 
    user_id, total_xp, current_level, daily_xp_today, 
    current_streak, longest_streak, last_activity_date, created_at, updated_at
FROM user_gamification_backup;

-- Drop backup table
DROP TABLE user_gamification_backup;

-- Verify the structure
DESCRIBE user_gamification; 