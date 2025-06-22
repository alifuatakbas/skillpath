-- Fix user_achievements table schema
-- Add missing id column and update table structure

-- First backup existing data
CREATE TABLE user_achievements_backup AS SELECT * FROM user_achievements;

-- Drop existing table
DROP TABLE user_achievements;

-- Recreate table with proper schema including id column
CREATE TABLE user_achievements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    achievement_id INT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    xp_earned INT DEFAULT 0,
    UNIQUE KEY unique_user_achievement (user_id, achievement_id),
    INDEX idx_user_id (user_id),
    INDEX idx_achievement_id (achievement_id)
);

-- Restore data from backup (excluding id since it will auto-increment)
INSERT INTO user_achievements (user_id, achievement_id, earned_at, xp_earned)
SELECT user_id, achievement_id, earned_at, xp_earned
FROM user_achievements_backup;

-- Drop backup table
DROP TABLE user_achievements_backup;

-- Verify the structure
DESCRIBE user_achievements; 