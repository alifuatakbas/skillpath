-- Add trial fields to users table
ALTER TABLE users 
ADD COLUMN trial_start_date DATETIME NULL,
ADD COLUMN trial_end_date DATETIME NULL;

-- Update existing users to have trial_start_date if they don't have subscription
UPDATE users 
SET trial_start_date = NOW(), 
    trial_end_date = DATE_ADD(NOW(), INTERVAL 3 DAY),
    subscription_type = 'trial'
WHERE subscription_type = 'free' AND trial_start_date IS NULL; 