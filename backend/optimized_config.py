# ================================
# 5000 KULLANICI İÇİN OPTİMİZE AYARLAR
# ================================

import redis
from fastapi import FastAPI
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
import asyncio
from functools import wraps
import time

# 1. DATABASE CONNECTION POOL OPTİMİZASYONU
def create_optimized_engine(database_url: str):
    """5000 kullanıcı için optimize edilmiş DB bağlantı havuzu"""
    return create_engine(
        database_url,
        echo=False,  # Production'da False!
        poolclass=QueuePool,
        pool_size=20,           # Ana connection pool boyutu
        max_overflow=30,        # Geçici ekstra bağlantılar
        pool_recycle=3600,      # 1 saat sonra bağlantıları yenile
        pool_pre_ping=True,     # Bağlantı sağlığını kontrol et
        pool_timeout=30,        # Bağlantı beklemesi max 30 saniye
        connect_args={
            "charset": "utf8mb4",
            "autocommit": False,
            "connect_timeout": 60,
            "read_timeout": 60,
            "write_timeout": 60,
        }
    )

# 2. REDIS CACHE SİSTEMİ
REDIS_CONFIG = {
    "host": "localhost", 
    "port": 6379,
    "db": 0,
    "decode_responses": True,
    "max_connections": 100,
    "retry_on_timeout": True,
    "socket_keepalive": True,
    "socket_keepalive_options": {},
}

# 3. RATE LIMITING KURALLARI
RATE_LIMITS = {
    # Genel API limitleri
    "general": "100/minute",
    "auth": "10/minute", 
    "registration": "3/minute",
    
    # Topluluk limitleri
    "community_post": "5/minute",
    "community_reply": "10/minute", 
    "community_like": "30/minute",
    
    # Premium kullanıcılar için artırılmış limitler
    "premium_post": "15/minute",
    "premium_reply": "30/minute",
}

# 4. CACHE SÜRE AYARLARI (saniye)
CACHE_DURATIONS = {
    "community_stats": 300,        # 5 dakika
    "popular_skills": 600,         # 10 dakika  
    "user_dashboard": 60,          # 1 dakika
    "roadmap_progress": 30,        # 30 saniye
    "community_posts": 120,        # 2 dakika
}

# 5. DATABASE INDEX'LER - Bu SQL'leri çalıştır!
REQUIRED_INDEXES = """
-- Performans için kritik indexler

-- User tablosu
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_subscription ON users(subscription_type);

-- Community Posts
CREATE INDEX idx_posts_active ON community_posts(is_active);
CREATE INDEX idx_posts_skill ON community_posts(skill_name);
CREATE INDEX idx_posts_user_id ON community_posts(user_id);
CREATE INDEX idx_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX idx_posts_likes ON community_posts(likes_count DESC);
CREATE INDEX idx_posts_replies ON community_posts(replies_count DESC);

-- Community Replies  
CREATE INDEX idx_replies_post_id ON community_replies(post_id);
CREATE INDEX idx_replies_user_id ON community_replies(user_id);
CREATE INDEX idx_replies_active ON community_replies(is_active);

-- Community Likes
CREATE INDEX idx_likes_user_post ON community_likes(user_id, post_id);
CREATE INDEX idx_likes_user_reply ON community_likes(user_id, reply_id);

-- Roadmaps
CREATE INDEX idx_roadmaps_user_id ON roadmaps(user_id);
CREATE INDEX idx_roadmaps_active ON roadmaps(is_active);

-- User Progress
CREATE INDEX idx_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_progress_roadmap_id ON user_progress(roadmap_id);
CREATE INDEX idx_progress_step_id ON user_progress(step_id);

-- Notification Logs
CREATE INDEX idx_notifications_user_id ON notification_logs(user_id);
CREATE INDEX idx_notifications_sent_at ON notification_logs(sent_at DESC);
"""

# 6. PAGINATION AYARLARI
PAGINATION_LIMITS = {
    "default_page_size": 20,
    "max_page_size": 100,
    "community_posts": 15,
    "community_replies": 50,
    "notification_history": 25,
}

# 7. BACKGROUND TASK AYARLARI
BACKGROUND_TASK_CONFIG = {
    "daily_reminders": {
        "batch_size": 100,      # Her seferinde 100 kullanıcı
        "delay_between_batches": 2,  # Batch'ler arası 2 saniye
    },
    "streak_warnings": {
        "batch_size": 50,
        "delay_between_batches": 1,
    }
}

# 8. CACHING DECORATORLERİ
def cache_result(duration: int):
    """Redis cache decorator"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Cache key oluştur
            cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Cache'den kontrol et
            redis_client = redis.Redis(**REDIS_CONFIG)
            cached_result = redis_client.get(cache_key)
            
            if cached_result:
                return cached_result
            
            # Cache yoksa hesapla ve cache'le
            result = await func(*args, **kwargs)
            redis_client.setex(cache_key, duration, result)
            
            return result
        return wrapper
    return decorator

# 9. MONITORING VE ALERTING
MONITORING_CONFIG = {
    "response_time_threshold": 2.0,  # 2 saniye üzeri yavaş
    "error_rate_threshold": 0.05,    # %5 üzeri hata oranı
    "memory_threshold": 0.85,        # %85 memory kullanımı
    "cpu_threshold": 0.80,           # %80 CPU kullanımı
}

# 10. LOGGING AYARLARI
LOGGING_CONFIG = {
    "level": "INFO",
    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    "file_rotation": "1 day",
    "max_files": 30,
    "log_sql_queries": False,  # Production'da False!
    "log_slow_queries": True,  # 1 saniye üzeri query'leri logla
} 