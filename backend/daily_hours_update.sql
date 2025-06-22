-- Roadmap tablosuna daily_hours alanını ekle
ALTER TABLE roadmaps ADD COLUMN daily_hours INT DEFAULT 2 COMMENT 'Kullanıcının günlük çalışma saati';

-- Mevcut roadmap'lere varsayılan değer ata
UPDATE roadmaps SET daily_hours = 2 WHERE daily_hours IS NULL;

-- Kontrol et
SELECT id, title, daily_hours FROM roadmaps LIMIT 5; 