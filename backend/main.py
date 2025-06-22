from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta, timezone, date
from passlib.context import CryptContext
from jose import JWTError, jwt
import uvicorn
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.sql import func
import os
from dotenv import load_dotenv
import openai
import json
import re
from difflib import SequenceMatcher
# Yeni import'lar - Push Notifications ve Scheduler için
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from exponent_server_sdk import PushClient, PushMessage, PushServerError, DeviceNotRegisteredError
import pytz
import atexit
import logging
from sqlalchemy.sql import text

# Daily task import'ları kaldırıldı

# Load environment variables
load_dotenv()

app = FastAPI(
    title="SkillPath API",
    description="Modern öğrenme platformu API'si",
    version="1.0.0"
)

# CORS middleware - Frontend ve Mobile app için
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev
        "http://localhost:3001",  # Next.js dev (alternative port)
        "http://localhost:19006", # Expo web
        "exp://192.168.1.133:19000", # Expo mobile
        "http://192.168.1.133:8081", # Expo mobile HTTP
        "*",  # Geçici olarak tüm origin'lere izin ver
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:Alifuat201@localhost:3306/skillpath")

# Create SQLAlchemy engine with optimized connection pool
engine = create_engine(
    DATABASE_URL, 
    echo=False,  # Production'da echo=False
    pool_size=20,           # 20 ana bağlantı
    max_overflow=30,        # 30 ekstra bağlantı
    pool_recycle=3600,      # 1 saat sonra bağlantıları yenile
    pool_pre_ping=True,     # Bağlantı sağlığını kontrol et
    pool_timeout=30,        # 30 saniye timeout
    connect_args={
        "charset": "utf8mb4",
        "connect_timeout": 60,
        "read_timeout": 60,
        "write_timeout": 60,
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=True)
    username = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Integer, default=1)  # tinyint(1) in MySQL
    is_superuser = Column(Integer, default=0)  # tinyint(1) in MySQL
    subscription_type = Column(String(20), default="free")  # free, premium
    subscription_expires = Column(DateTime(timezone=True), nullable=True)
    preferred_language = Column(String(10), default="tr")  # tr, en
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Skill(Base):
    __tablename__ = "skills"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # Data Science, Programming, Design, etc.
    difficulty_level = Column(String(20))  # beginner, intermediate, advanced
    estimated_duration_weeks = Column(Integer)  # Ortalama öğrenme süresi
    icon_url = Column(String(500))
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserSkillAssessment(Base):
    __tablename__ = "user_skill_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    skill_id = Column(Integer, nullable=False)
    current_level = Column(String(20))  # beginner, intermediate, advanced
    target_level = Column(String(20))
    target_duration_weeks = Column(Integer)
    assessment_answers = Column(Text)  # JSON format
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Roadmap(Base):
    __tablename__ = "roadmaps"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    skill_id = Column(Integer, nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    total_weeks = Column(Integer)
    difficulty_level = Column(String(20))
    daily_hours = Column(Integer, default=2)  # Kullanıcının günlük çalışma saati
    roadmap_data = Column(Text)  # JSON format - yol haritası detayları
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class RoadmapStep(Base):
    __tablename__ = "roadmap_steps"
    
    id = Column(Integer, primary_key=True, index=True)
    roadmap_id = Column(Integer, nullable=False)
    step_order = Column(Integer, nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    estimated_hours = Column(Integer)
    resources = Column(Text)  # JSON format - linkler, kaynaklar
    prerequisites = Column(Text)  # JSON format
    is_completed = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserProgress(Base):
    __tablename__ = "user_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    roadmap_id = Column(Integer, nullable=False)
    step_id = Column(Integer, nullable=False)
    status = Column(String(20), default="not_started")  # not_started, in_progress, completed
    completion_percentage = Column(Integer, default=0)
    notes = Column(Text)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    daily_reminder_enabled = Column(Integer, default=1)  # 1 = enabled, 0 = disabled
    daily_reminder_time = Column(String(5), default="09:00")  # HH:MM format
    step_completion_enabled = Column(Integer, default=1)
    streak_warning_enabled = Column(Integer, default=1)
    weekly_progress_enabled = Column(Integer, default=1)
    do_not_disturb_start = Column(String(5), default="22:00")  # HH:MM format
    do_not_disturb_end = Column(String(5), default="08:00")  # HH:MM format
    timezone = Column(String(50), nullable=True)  # Will be auto-detected from device
    device_timezone = Column(String(50), nullable=True)  # Store original device timezone
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class NotificationLog(Base):
    __tablename__ = "notification_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    notification_type = Column(String(50), nullable=False)  # daily_reminder, step_completion, etc.
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    roadmap_id = Column(Integer, nullable=True)
    step_id = Column(Integer, nullable=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(20), default="sent")  # sent, failed, clicked
    push_token = Column(String(500), nullable=True)  # Expo push token

class UserActivity(Base):
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    activity_type = Column(String(50), nullable=False)  # login, step_complete, roadmap_create
    roadmap_id = Column(Integer, nullable=True)
    step_id = Column(Integer, nullable=True)
    activity_data = Column(Text, nullable=True)  # JSON format for additional data
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PushToken(Base):
    __tablename__ = "push_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    push_token = Column(String(500), nullable=False)
    device_type = Column(String(20), default="mobile")  # mobile, web
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class CommunityPost(Base):
    __tablename__ = "community_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    skill_name = Column(String(100), nullable=True)
    post_type = Column(String(20), default="question")  # question, tip, resource, discussion
    likes_count = Column(Integer, default=0)
    replies_count = Column(Integer, default=0)
    is_expert_post = Column(Integer, default=0)  # 1 if posted by expert
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class CommunityReply(Base):
    __tablename__ = "community_replies"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, nullable=False)
    user_id = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class CommunityLike(Base):
    __tablename__ = "community_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    post_id = Column(Integer, nullable=True)
    reply_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# Günlük Görevler ve Gamification Modelleri
# Daily Task ve Study Session modelleri kaldırıldı

class UserGamification(Base):
    __tablename__ = "user_gamification"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, unique=True)
    total_xp = Column(Integer, default=0)
    current_level = Column(Integer, default=1)
    daily_xp_today = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Achievement(Base):
    __tablename__ = "achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(50))
    category = Column(String(30))  # learning, community, streak
    condition_type = Column(String(30))  # xp_total, streak_days, tasks_completed
    condition_value = Column(Integer)
    xp_reward = Column(Integer, default=0)
    is_active = Column(Integer, default=1)

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    achievement_id = Column(Integer, nullable=False)
    earned_at = Column(DateTime(timezone=True), server_default=func.now())

class XPHistory(Base):
    __tablename__ = "xp_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    xp_amount = Column(Integer, nullable=False)
    reason = Column(String(200), nullable=False)
    reference_type = Column(String(30), nullable=True)  # daily_task, study_session, etc.
    reference_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Gamification Helper Functions
def award_xp(db: Session, user_id: int, xp_amount: int, reason: str, reference_type: str = None, reference_id: int = None):
    """XP ver ve seviye kontrolü yap"""
    
    # XP geçmişine ekle
    xp_record = XPHistory(
        user_id=user_id,
        xp_amount=xp_amount,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id
    )
    db.add(xp_record)
    
    # Kullanıcı gamification bilgilerini güncelle
    user_game = db.query(UserGamification).filter(
        UserGamification.user_id == user_id
    ).first()
    
    if not user_game:
        user_game = UserGamification(user_id=user_id, total_xp=0, current_level=1)
        db.add(user_game)
    
    # XP güncelle
    user_game.total_xp += xp_amount
    user_game.daily_xp_today += xp_amount
    
    # Seviye hesapla
    new_level = calculate_level(user_game.total_xp)
    if new_level > user_game.current_level:
        user_game.current_level = new_level
        # Seviye atlama bonusu (recursive call önlemek için direkt XP ekliyoruz)
        bonus_xp = XPHistory(
            user_id=user_id,
            xp_amount=50,
            reason=f"Seviye {new_level}'e yükseldi!",
            reference_type="level_up"
        )
        db.add(bonus_xp)
        user_game.total_xp += 50
    
    # Streak güncelle
    today = datetime.now(timezone.utc).date()
    if user_game.last_activity_date and user_game.last_activity_date.date() == today - timedelta(days=1):
        user_game.current_streak += 1
        user_game.longest_streak = max(user_game.longest_streak, user_game.current_streak)
    elif not user_game.last_activity_date or user_game.last_activity_date.date() != today:
        user_game.current_streak = 1
    
    user_game.last_activity_date = datetime.now(timezone.utc)
    
    db.commit()
    
    # Achievement kontrolü yap
    check_and_award_achievements(db, user_id, reference_type, reference_id)
    
    return {
        "xp_earned": xp_amount,
        "total_xp": user_game.total_xp,
        "current_level": user_game.current_level,
        "current_streak": user_game.current_streak
    }

def check_and_award_achievements(db: Session, user_id: int, reference_type: str = None, reference_id: int = None):
    """Kullanıcının achievement'larını kontrol et ve ödülle"""
    
    try:
        # Kullanıcının mevcut gamification verilerini al
        user_game = db.query(UserGamification).filter(
            UserGamification.user_id == user_id
        ).first()
        
        if not user_game:
            return
        
        # Henüz kazanılmamış achievement'ları al
        earned_achievement_ids = db.query(UserAchievement.achievement_id).filter(
            UserAchievement.user_id == user_id
        ).subquery()
        
        available_achievements = db.query(Achievement).filter(
            ~Achievement.id.in_(earned_achievement_ids),
            Achievement.is_active == 1
        ).all()
        
        new_achievements = []
        
        for achievement in available_achievements:
            earned = False
            
            # Achievement türüne göre kontrol et
            if achievement.condition_type == "complete_daily_task":
                if reference_type == "daily_task":
                    daily_task_count = db.query(XPHistory).filter(
                        XPHistory.user_id == user_id,
                        XPHistory.reference_type == "daily_task"
                    ).count()
                    earned = daily_task_count >= achievement.condition_value
                    
            elif achievement.condition_type == "streak_days":
                earned = user_game.current_streak >= achievement.condition_value
                
            elif achievement.condition_type == "total_xp":
                earned = user_game.total_xp >= achievement.condition_value
                
            elif achievement.condition_type == "complete_roadmap":
                if reference_type == "roadmap_complete":
                    completed_roadmaps = db.query(XPHistory).filter(
                        XPHistory.user_id == user_id,
                        XPHistory.reference_type == "roadmap_complete"
                    ).count()
                    earned = completed_roadmaps >= achievement.condition_value
                    
            elif achievement.condition_type == "study_hours":
                total_study_minutes = db.query(func.sum(StudySession.duration_minutes)).filter(
                    StudySession.user_id == user_id
                ).scalar() or 0
                total_study_hours = total_study_minutes / 60
                earned = total_study_hours >= achievement.condition_value
                
            elif achievement.condition_type == "create_post":
                # Community post oluşturma achievement'ı
                total_posts = db.query(CommunityPost).filter(
                    CommunityPost.user_id == user_id,
                    CommunityPost.is_active == 1
                ).count()
                earned = total_posts >= achievement.condition_value
                
            elif achievement.condition_type == "reply_count":
                # Community reply achievement'ı
                total_replies = db.query(CommunityReply).filter(
                    CommunityReply.user_id == user_id,
                    CommunityReply.is_active == 1
                ).count()
                earned = total_replies >= achievement.condition_value
            
            # Achievement kazanıldıysa kaydet
            if earned:
                user_achievement = UserAchievement(
                    user_id=user_id,
                    achievement_id=achievement.id,
                    earned_at=datetime.now(timezone.utc)
                )
                db.add(user_achievement)
                new_achievements.append(achievement)
                
                # Achievement XP'si varsa ver
                if achievement.xp_reward > 0:
                    xp_record = XPHistory(
                        user_id=user_id,
                        xp_amount=achievement.xp_reward,
                        reason=f"Achievement: {achievement.name}",
                        reference_type="achievement",
                        reference_id=achievement.id
                    )
                    db.add(xp_record)
                    user_game.total_xp += achievement.xp_reward
        
        db.commit()
        
        # Yeni achievement'lar varsa bildirim gönder
        if new_achievements:
            for achievement in new_achievements:
                print(f"🏆 User {user_id} earned achievement: {achievement.name}")
                # TODO: Push notification gönder
                
    except Exception as e:
        print(f"Achievement check failed for user {user_id}: {e}")
        db.rollback()

def calculate_level(total_xp: int) -> int:
    """XP'ye göre seviye hesapla"""
    if total_xp < 500:
        return 1  # Beginner
    elif total_xp < 2000:
        return 2  # Intermediate  
    elif total_xp < 5000:
        return 3  # Advanced
    else:
        return 4  # Expert

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200  # 30 days (30 * 24 * 60 minutes)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# AI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "your-openai-api-key-here")
openai_client = None
if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
    except ImportError:
        print("OpenAI library not found. AI features will be disabled.")
    except Exception as e:
        print(f"OpenAI client initialization failed: {e}")
        openai_client = None

# Skill suggestion and normalization
class SkillNormalizer:
    """AI destekli skill normalizasyonu ve önerileri"""
    
    # Popüler skill kategorileri (backup için)
    POPULAR_SKILLS = {
        "programming": ["Python", "JavaScript", "Java", "C++", "React", "Node.js", "Django", "Flask"],
        "data_science": ["Machine Learning", "Data Analysis", "Deep Learning", "Statistics", "Pandas", "NumPy"],
        "design": ["UI/UX Design", "Graphic Design", "Figma", "Adobe Photoshop", "Web Design"],
        "business": ["Digital Marketing", "Project Management", "Excel", "Business Analysis"],
        "languages": ["English", "Spanish", "French", "German", "Mandarin"],
        "other": ["Photography", "Video Editing", "Public Speaking", "Writing"]
    }
    
    @staticmethod
    def normalize_skill_with_ai(user_input: str) -> dict:
        """AI ile skill normalizasyonu ve öneriler"""
        try:
            if not openai_client:
                return SkillNormalizer.fallback_normalization(user_input)
            
            prompt = f"""
            Kullanıcı şu skill'i öğrenmek istiyor: "{user_input}"
            
            Lütfen şunları yap:
            1. Bu skill'in doğru ve standart ismini belirle
            2. Benzer 3-5 skill öner
            3. Kategori belirle (programming, data_science, design, business, languages, other)
            4. Zorluk seviyesi tahmin et (beginner, intermediate, advanced)
            5. Tahmini öğrenme süresi (hafta)
            
            JSON formatında döndür:
            {{
                "normalized_name": "Standart skill ismi",
                "category": "kategori",
                "difficulty": "zorluk_seviyesi",
                "estimated_weeks": 12,
                "similar_skills": ["skill1", "skill2", "skill3"],
                "confidence": 0.95,
                "suggestions": ["Bu mu demek istediniz: X?", "Belki şunu da düşünebilirsiniz: Y"]
            }}
            """
            
            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            print(f"AI normalization failed: {e}")
            return SkillNormalizer.fallback_normalization(user_input)
    
    @staticmethod
    def fallback_normalization(user_input: str) -> dict:
        """AI olmadığında fallback çözüm"""
        cleaned_input = re.sub(r'[^\w\s]', '', user_input.lower().strip())
        
        # Basit benzerlik kontrolü
        best_match = None
        best_score = 0
        category = "other"
        
        for cat, skills in SkillNormalizer.POPULAR_SKILLS.items():
            for skill in skills:
                score = SequenceMatcher(None, cleaned_input, skill.lower()).ratio()
                if score > best_score and score > 0.6:
                    best_score = score
                    best_match = skill
                    category = cat
        
        normalized_name = best_match if best_match else user_input.title()
        
        return {
            "normalized_name": normalized_name,
            "category": category,
            "difficulty": "intermediate",
            "estimated_weeks": 8,
            "similar_skills": SkillNormalizer.POPULAR_SKILLS.get(category, [])[:3],
            "confidence": best_score,
            "suggestions": [f"Bu mu demek istediniz: {normalized_name}?"] if best_match else []
        }

# Pydantic models
class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: str  # This will map to full_name
    email: str
    created_at: datetime

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict  # Dictionary olarak değiştir

# Yeni AI destekli modeller
class SkillSuggestionRequest(BaseModel):
    user_input: str
    language: str = "tr"  # tr, en

class SkillSuggestionResponse(BaseModel):
    normalized_name: str
    category: str
    difficulty: str
    estimated_weeks: int
    similar_skills: List[str]
    confidence: float
    suggestions: List[str]

class AssessmentQuestion(BaseModel):
    question: str
    options: List[str]
    question_type: str  # multiple_choice, scale, text

class AssessmentRequest(BaseModel):
    skill_name: str
    target_duration_weeks: int = 12
    language: str = "tr"

class AssessmentResponse(BaseModel):
    questions: List[AssessmentQuestion]
    skill_info: dict

class RoadmapRequest(BaseModel):
    skill_name: str
    target_weeks: int
    current_level: str
    daily_hours: int = 2

class RoadmapResponse(BaseModel):
    success: bool
    roadmap_id: int
    roadmap: dict
    message: str

# Dashboard response models
class DashboardStats(BaseModel):
    total_roadmaps: int
    active_roadmaps: int
    completed_roadmaps: int
    total_steps: int
    completed_steps: int
    completion_percentage: float
    total_learning_hours: int
    current_streak: int
    longest_streak: int

class RoadmapSummary(BaseModel):
    id: int
    title: str
    description: str
    total_weeks: int
    difficulty_level: str
    total_steps: int
    completed_steps: int
    completion_percentage: float
    created_at: str
    last_activity: Optional[str]

class StepProgress(BaseModel):
    step_id: int
    step_order: int
    title: str
    description: str
    estimated_hours: int
    is_completed: bool
    completed_at: Optional[str]
    resources: List[str]
    projects: List[str]

class RoadmapProgress(BaseModel):
    roadmap_id: int
    title: str
    total_steps: int
    completed_steps: int
    completion_percentage: float
    steps: List[StepProgress]
    next_step: Optional[StepProgress]

# Notification Models
class NotificationPreferenceRequest(BaseModel):
    daily_reminder_enabled: bool = True
    daily_reminder_time: str = "09:00"  # HH:MM format
    step_completion_enabled: bool = True
    streak_warning_enabled: bool = True
    weekly_progress_enabled: bool = True
    do_not_disturb_start: str = "22:00"
    do_not_disturb_end: str = "08:00"
    timezone: Optional[str] = None  # Auto-detected from device
    device_timezone: Optional[str] = None  # Original device timezone

class NotificationPreferenceResponse(BaseModel):
    id: int
    user_id: int
    daily_reminder_enabled: bool
    daily_reminder_time: str
    step_completion_enabled: bool
    streak_warning_enabled: bool
    weekly_progress_enabled: bool
    do_not_disturb_start: str
    do_not_disturb_end: str
    timezone: Optional[str]
    device_timezone: Optional[str]

class PushTokenRequest(BaseModel):
    push_token: str
    device_type: str = "mobile"  # mobile, web

class DailyReminderResponse(BaseModel):
    success: bool
    message: str
    reminder_data: Optional[dict] = None

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    sent_at: str
    roadmap_title: Optional[str] = None
    step_title: Optional[str] = None

# Utility functions
def verify_password(plain_password, hashed_password):
    """Şifreyi doğrula"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Şifreyi hash'le"""
    return pwd_context.hash(password)

def get_user_by_email(db: Session, email: str):
    """Email ile kullanıcı bul"""
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    """Yeni kullanıcı oluştur"""
    hashed_password = get_password_hash(user.password)
    # Username'i email'den oluştur (@ işaretinden önceki kısım)
    username = user.email.split('@')[0]
    
    db_user = User(
        full_name=user.name,
        username=username,
        email=user.email,
        hashed_password=hashed_password,
        is_active=1,
        is_superuser=0,
        subscription_type="free",
        preferred_language="tr"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """JWT token oluştur"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    """Mevcut kullanıcıyı token'dan al"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        print(f"🔑 Received token: {credentials.credentials[:50]}...")
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"📋 JWT payload: {payload}")
        email: str = payload.get("sub")
        print(f"📧 Email from token: {email}")
        if email is None:
            print("❌ Email is None in token payload")
            raise credentials_exception
    except JWTError as e:
        print(f"❌ JWT Error: {e}")
        raise credentials_exception
    
    user = get_user_by_email(db, email=email)
    if user is None:
        print(f"❌ User not found for email: {email}")
        raise credentials_exception
    print(f"✅ User found: {user.email}, Premium: {user.subscription_type}")
    return user

# Notification Service Functions
class NotificationService:
    """Smart notification service for daily reminders"""
    
    @staticmethod
    def get_or_create_notification_preferences(db: Session, user_id: int, timezone_info: dict = None) -> NotificationPreference:
        """Kullanıcının notification preferences'ını getir veya oluştur"""
        prefs = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
        
        if not prefs:
            # Yeni kullanıcı için default preferences oluştur
            prefs = NotificationPreference(
                user_id=user_id,
                daily_reminder_enabled=1,
                daily_reminder_time="09:00",
                step_completion_enabled=1,
                streak_warning_enabled=1,
                weekly_progress_enabled=1,
                do_not_disturb_start="22:00",
                do_not_disturb_end="08:00",
                timezone=timezone_info.get('timezone') if timezone_info else None,
                device_timezone=timezone_info.get('device_timezone') if timezone_info else None
            )
            db.add(prefs)
            db.commit()
            db.refresh(prefs)
        
        return prefs
    
    @staticmethod
    def get_next_step_for_reminder(db: Session, user_id: int) -> dict:
        """Kullanıcının daily reminder için en uygun adımını bulur"""
        try:
            # Aktif roadmapları getir
            active_roadmaps = db.query(Roadmap).filter(
                Roadmap.user_id == user_id,
                Roadmap.is_active == 1
            ).order_by(Roadmap.created_at.desc()).all()
            
            if not active_roadmaps:
                return None
            
            # Her roadmap için next step'i bul
            best_reminder = None
            
            for roadmap in active_roadmaps:
                # Tamamlanmamış adımları getir
                next_step = db.query(RoadmapStep).filter(
                    RoadmapStep.roadmap_id == roadmap.id,
                    RoadmapStep.is_completed == 0
                ).order_by(RoadmapStep.step_order).first()
                
                if next_step:
                    # Bu roadmap için reminder data'sı oluştur
                    total_steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap.id).count()
                    completed_steps = db.query(RoadmapStep).filter(
                        RoadmapStep.roadmap_id == roadmap.id,
                        RoadmapStep.is_completed == 1
                    ).count()
                    
                    reminder_data = {
                        'roadmap_id': roadmap.id,
                        'roadmap_title': roadmap.title,
                        'step_id': next_step.id,
                        'step_title': next_step.title,
                        'step_description': next_step.description,
                        'estimated_hours': next_step.estimated_hours,
                        'total_steps': total_steps,
                        'completed_steps': completed_steps,
                        'progress_percentage': round((completed_steps / total_steps) * 100, 1) if total_steps > 0 else 0,
                        'difficulty_level': roadmap.difficulty_level,
                        'total_weeks': roadmap.total_weeks
                    }
                    
                    # İlk bulunan aktif roadmap'i kullan (en son oluşturulan)
                    if not best_reminder:
                        best_reminder = reminder_data
                        break
            
            return best_reminder
            
        except Exception as e:
            print(f"Get next step for reminder failed: {e}")
            return None
    
    @staticmethod
    def generate_daily_reminder_message(reminder_data: dict, user_name: str = None) -> dict:
        """Daily reminder mesajını oluşturur"""
        if not reminder_data:
            return {
                'title': 'Öğrenme zamanı! 📚',
                'message': 'Bugün yeni bir şeyler öğrenmeye ne dersin?',
                'emoji': '🚀'
            }
        
        roadmap_title = reminder_data['roadmap_title']
        step_title = reminder_data['step_title']
        progress = reminder_data['progress_percentage']
        estimated_hours = reminder_data.get('estimated_hours', 2)
        
        # Kişiselleştirilmiş mesajlar
        greetings = [
            f"{roadmap_title} yolculuğun devam ediyor! 🚀",
            f"Bugün {roadmap_title} öğrenme zamanı! 💻",
            f"{roadmap_title} konusunda ilerlemen harika! 🎯"
        ]
        
        motivations = [
            f"'{step_title}' adımını tamamlamaya hazır mısın?",
            f"Sadece {estimated_hours} saat ayırsan '{step_title}' konusunu bitirebilirsin!",
            f"'{step_title}' seni bekliyor - hadi başlayalım! 💪"
        ]
        
        progress_messages = []
        if progress > 0:
            progress_messages = [
                f"Şu ana kadar %{progress} tamamladın - harika! 🔥",
                f"İlerleme: %{progress} - devam et! 📈",
                f"%{progress} tamamlandı - hedefe yaklaşıyorsun! 🎯"
            ]
        
        # Rastgele mesaj seç
        import random
        title = random.choice(greetings)
        message_parts = [random.choice(motivations)]
        
        if progress_messages:
            message_parts.append(random.choice(progress_messages))
        
        return {
            'title': title,
            'message': ' '.join(message_parts),
            'emoji': '🚀',
            'progress': progress,
            'estimated_hours': estimated_hours
        }
    
    @staticmethod
    def log_notification(db: Session, user_id: int, notification_type: str, title: str, message: str, 
                        roadmap_id: int = None, step_id: int = None, push_token: str = None):
        """Notification'ı veritabanına kaydet"""
        try:
            log_entry = NotificationLog(
                user_id=user_id,
                notification_type=notification_type,
                title=title,
                message=message,
                roadmap_id=roadmap_id,
                step_id=step_id,
                push_token=push_token,
                status="sent"
            )
            db.add(log_entry)
            db.commit()
            return log_entry
        except Exception as e:
            print(f"Notification logging failed: {e}")
            return None

# Push Notification Service
class PushNotificationService:
    """Expo Push Notification servisi"""
    
    def __init__(self):
        self.client = PushClient()
    
    def send_push_notification(self, push_token: str, title: str, message: str, data: dict = None):
        """Expo push notification gönder"""
        try:
            # Push token formatını kontrol et
            if not push_token.startswith('ExponentPushToken[') and not push_token.startswith('ExpoPushToken['):
                print(f"Invalid push token format: {push_token}")
                return {"success": False, "error": "Invalid push token format"}
            
            # Push message oluştur
            push_message = PushMessage(
                to=push_token,
                title=title,
                body=message,
                data=data or {},
                sound='default',
                badge=1
            )
            
            # Gönder
            response = self.client.publish(push_message)
            print(f"Push notification sent successfully: {response}")
            return {"success": True, "response": str(response)}
            
        except PushServerError as exc:
            print(f"Push server error: {exc}")
            return {"success": False, "error": f"Push server error: {exc}"}
        except DeviceNotRegisteredError:
            print(f"Device not registered: {push_token}")
            return {"success": False, "error": "Device not registered"}
        except Exception as e:
            print(f"Push notification failed: {e}")
            return {"success": False, "error": str(e)}
    
    def calculate_user_streak(self, db: Session, user_id: int) -> dict:
        """Kullanıcının güncel streak durumunu hesapla"""
        try:
            # Son 30 günlük aktiviteleri al
            thirty_days_ago = datetime.now() - timedelta(days=30)
            
            activities = db.query(UserActivity).filter(
                UserActivity.user_id == user_id,
                UserActivity.activity_type == "step_complete",
                UserActivity.created_at >= thirty_days_ago
            ).order_by(UserActivity.created_at.desc()).all()
            
            if not activities:
                return {"current_streak": 0, "last_activity": None, "days_since_last": 0}
            
            # Günlük aktiviteleri grupla
            daily_activities = {}
            for activity in activities:
                activity_date = activity.created_at.date()
                if activity_date not in daily_activities:
                    daily_activities[activity_date] = []
                daily_activities[activity_date].append(activity)
            
            # Streak hesapla
            current_streak = 0
            today = datetime.now().date()
            check_date = today
            
            # Bugünden geriye doğru streak'i hesapla
            while check_date in daily_activities:
                current_streak += 1
                check_date -= timedelta(days=1)
            
            # Eğer bugün aktivite yoksa, dünden başla
            if today not in daily_activities:
                current_streak = 0
                check_date = today - timedelta(days=1)
                while check_date in daily_activities:
                    current_streak += 1
                    check_date -= timedelta(days=1)
            
            # Son aktivite tarihi
            last_activity = max(daily_activities.keys()) if daily_activities else None
            days_since_last = (today - last_activity).days if last_activity else 999
            
            return {
                "current_streak": current_streak,
                "last_activity": last_activity,
                "days_since_last": days_since_last
            }
            
        except Exception as e:
            print(f"Error calculating streak for user {user_id}: {e}")
            return {"current_streak": 0, "last_activity": None, "days_since_last": 0}
    
    def check_streak_warnings(self):
        """Streak bozulma riski olan kullanıcıları kontrol et ve uyarı gönder"""
        try:
            db = SessionLocal()
            
            print("Checking streak warnings...")
            
            # Streak uyarısı aktif olan kullanıcıları al
            preferences = db.query(NotificationPreference).filter(
                NotificationPreference.streak_warning_enabled == 1
            ).all()
            
            print(f"Found {len(preferences)} users with streak warnings enabled")
            
            for pref in preferences:
                try:
                    # Kullanıcının streak durumunu hesapla
                    streak_data = self.calculate_user_streak(db, pref.user_id)
                    days_since_last = streak_data["days_since_last"]
                    current_streak = streak_data["current_streak"]
                    
                    # Uyarı koşulları:
                    # 1. Son aktiviteden 1 gün geçti ve streak > 0
                    # 2. Son aktiviteden 2 gün geçti (streak kaybetme riski)
                    should_warn = False
                    warning_type = ""
                    
                    if days_since_last == 1 and current_streak > 0:
                        should_warn = True
                        warning_type = "streak_risk"
                    elif days_since_last >= 2 and current_streak > 0:
                        should_warn = True
                        warning_type = "streak_lost"
                    
                    if not should_warn:
                        continue
                    
                    # Son 24 saatte aynı türde uyarı gönderildi mi kontrol et
                    last_24h = datetime.now() - timedelta(hours=24)
                    recent_warning = db.query(NotificationLog).filter(
                        NotificationLog.user_id == pref.user_id,
                        NotificationLog.notification_type.like(f"{warning_type}%"),
                        NotificationLog.sent_at >= last_24h
                    ).first()
                    
                    if recent_warning:
                        print(f"Recent {warning_type} warning already sent to user {pref.user_id}")
                        continue
                    
                    # Push token al
                    push_token_result = db.execute(
                        text("SELECT push_token FROM push_tokens WHERE user_id = :user_id AND is_active = 1 ORDER BY created_at DESC LIMIT 1"),
                        {"user_id": pref.user_id}
                    ).fetchone()
                    
                    if not push_token_result:
                        print(f"No active push token found for user {pref.user_id}")
                        continue
                    
                    push_token = push_token_result[0]
                    
                    # Kullanıcı bilgilerini al
                    user = db.query(User).filter(User.id == pref.user_id).first()
                    user_name = user.full_name if user and user.full_name else "Kullanıcı"
                    
                    # Uyarı mesajını oluştur
                    if warning_type == "streak_risk":
                        title = f"🔥 {current_streak} günlük seriniz risk altında!"
                        message = f"Merhaba {user_name}! Bugün bir adım tamamlayarak {current_streak} günlük serinizi koruyun! 💪"
                    else:  # streak_lost
                        title = f"💔 {current_streak} günlük seriniz sona erdi"
                        message = f"Üzülme {user_name}! Yeni bir seri başlatmak için bugün bir adım tamamla! 🚀"
                    
                    # Push notification gönder
                    result = self.send_push_notification(
                        push_token=push_token,
                        title=title,
                        message=message,
                        data={
                            'type': warning_type,
                            'current_streak': current_streak,
                            'days_since_last': days_since_last
                        }
                    )
                    
                    # Bildirimi logla
                    NotificationService.log_notification(
                        db=db,
                        user_id=pref.user_id,
                        notification_type=f"{warning_type}_warning",
                        title=title,
                        message=message,
                        push_token=push_token
                    )
                    
                    print(f"Streak warning sent to user {pref.user_id}: {warning_type} - {result['success']}")
                    
                except Exception as e:
                    print(f"Failed to check streak for user {pref.user_id}: {e}")
                    continue
            
            db.close()
            
        except Exception as e:
            print(f"Streak warning job failed: {e}")
    
    def send_daily_reminders(self):
        """Tüm kullanıcılar için günlük hatırlatmaları gönder"""
        try:
            db = SessionLocal()
            
            # Şu anki saat ve dakikayı al (HH:MM formatında)
            now = datetime.now()
            current_time = now.strftime("%H:%M")
            
            print(f"Checking daily reminders for time: {current_time}")
            
            # Bu saatte bildirim almak isteyen kullanıcıları bul
            preferences = db.query(NotificationPreference).filter(
                NotificationPreference.daily_reminder_enabled == 1,
                NotificationPreference.daily_reminder_time == current_time
            ).all()
            
            print(f"Found {len(preferences)} users for daily reminders at {current_time}")
            
            for pref in preferences:
                try:
                    # Kullanıcının en son push token'ını al
                    latest_push_token = db.query(PushToken).filter(
                        PushToken.user_id == pref.user_id,
                        PushToken.is_active == 1
                    ).order_by(PushToken.updated_at.desc()).first()
                    
                    if not latest_push_token:
                        print(f"No push token found for user {pref.user_id}")
                        continue
                    
                    push_token = latest_push_token.push_token
                    
                    # Kullanıcının roadmap bilgilerini al
                    reminder_data = NotificationService.get_next_step_for_reminder(db, pref.user_id)
                    
                    if not reminder_data:
                        print(f"No active roadmap found for user {pref.user_id}")
                        continue
                    
                    # Hatırlatma mesajı oluştur
                    user = db.query(User).filter(User.id == pref.user_id).first()
                    reminder_message = NotificationService.generate_daily_reminder_message(
                        reminder_data, 
                        user.full_name if user else None
                    )
                    
                    # Push notification gönder
                    result = self.send_push_notification(
                        push_token=push_token,
                        title=reminder_message['title'],
                        message=reminder_message['message'],
                        data={
                            'type': 'daily_reminder',
                            'roadmap_id': reminder_data.get('roadmap_id'),
                            'step_id': reminder_data.get('step_id')
                        }
                    )
                    
                    # Bildirimi logla
                    NotificationService.log_notification(
                        db=db,
                        user_id=pref.user_id,
                        notification_type="daily_reminder_scheduled",
                        title=reminder_message['title'],
                        message=reminder_message['message'],
                        roadmap_id=reminder_data.get('roadmap_id'),
                        step_id=reminder_data.get('step_id'),
                        push_token=push_token
                    )
                    
                    print(f"Daily reminder sent to user {pref.user_id}: {result['success']}")
                    
                except Exception as e:
                    print(f"Failed to send daily reminder to user {pref.user_id}: {e}")
                    continue
            
            db.close()
            
        except Exception as e:
            print(f"Daily reminder job failed: {e}")

# Scheduler sistemi
push_service = PushNotificationService()
scheduler = BackgroundScheduler(timezone=pytz.timezone('Europe/Istanbul'))

def setup_scheduler():
    """Scheduler'ı başlat ve günlük hatırlatma job'ı ekle"""
    try:
        # Her dakika kontrol et (kullanıcıların farklı saatleri olabilir)
        scheduler.add_job(
            func=push_service.send_daily_reminders,
            trigger=CronTrigger(minute='*'),  # Her dakika çalışır
            id='daily_reminders',
            name='Daily Reminders Job',
            replace_existing=True
        )
        
        # Streak kontrolü - her 2 saatte bir çalışır (10:00, 12:00, 14:00, 16:00, 18:00, 20:00)
        scheduler.add_job(
            func=push_service.check_streak_warnings,
            trigger=CronTrigger(hour='10,12,14,16,18,20', minute=0),
            id='streak_warnings',
            name='Streak Warning Job',
            replace_existing=True
        )
        
        scheduler.start()
        print("Scheduler started successfully")
        
        # Uygulama kapanırken scheduler'ı durdur
        atexit.register(lambda: scheduler.shutdown())
        
    except Exception as e:
        print(f"Scheduler setup failed: {e}")

def initialize_default_achievements(db: Session):
    """Varsayılan achievement'ları oluştur"""
    
    default_achievements = [
        {
            "name": "İlk Adım",
            "description": "İlk günlük görevini tamamla",
            "icon": "🎯",
            "category": "learning",
            "condition_type": "complete_daily_task",
            "condition_value": 1,
            "xp_reward": 25
        },
        {
            "name": "Çalışkan",
            "description": "Toplam 10 saat çalış",
            "icon": "📚",
            "category": "learning", 
            "condition_type": "study_hours",
            "condition_value": 10,
            "xp_reward": 150
        },
        {
            "name": "3 Günlük Streak",
            "description": "3 gün üst üste çalış",
            "icon": "🔥",
            "category": "streak",
            "condition_type": "streak_days",
            "condition_value": 3,
            "xp_reward": 100
        },
        {
            "name": "Haftalık Şampiyon",
            "description": "7 gün üst üste çalış",
            "icon": "👑",
            "category": "streak", 
            "condition_type": "streak_days",
            "condition_value": 7,
            "xp_reward": 250
        },
        {
            "name": "XP Avcısı",
            "description": "1000 XP topla",
            "icon": "⭐",
            "category": "learning",
            "condition_type": "total_xp", 
            "condition_value": 1000,
            "xp_reward": 200
        },
        {
            "name": "İlk Roadmap",
            "description": "İlk roadmap'ini tamamla",
            "icon": "🏆",
            "category": "learning",
            "condition_type": "complete_roadmap",
            "condition_value": 1,
            "xp_reward": 500
        }
    ]
    
    for ach_data in default_achievements:
        # Mevcut achievement'ı kontrol et
        existing = db.query(Achievement).filter(
            Achievement.name == ach_data["name"]
        ).first()
        
        if not existing:
            achievement = Achievement(**ach_data)
            db.add(achievement)
    
    try:
        db.commit()
        print("✅ Default achievements initialized")
    except Exception as e:
        print(f"❌ Achievement initialization failed: {e}")
        db.rollback()

# Initialize database with sample data
@app.on_event("startup")
async def startup_event():
    """Initialize database"""
    # Tabloları oluştur
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        
        # Default achievement'ları initialize et
        db = SessionLocal()
        try:
            initialize_default_achievements(db)
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
    
    setup_scheduler()

# API Endpoints
@app.get("/")
async def root():
    return {"message": "SkillPath API'sine Hoş Geldiniz!", "version": "1.0.0"}

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Mevcut kullanıcının profilini getir"""
    return UserResponse(
        id=current_user.id,
        name=current_user.full_name,
        email=current_user.email,
        created_at=current_user.created_at
    )

@app.post("/api/auth/login", response_model=AuthResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Kullanıcı girişi"""
    user = get_user_by_email(db, user_data.email)
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz email veya şifre"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # User verisini dictionary olarak oluştur
    user_dict = {
        "id": user.id,
        "name": user.full_name or user.username,  # full_name yoksa username kullan
        "email": user.email,
        "subscription_type": user.subscription_type or "free",  # Premium bilgisi ekle
        "subscription_expires": user.subscription_expires.isoformat() if user.subscription_expires else None,
        "created_at": user.created_at.isoformat()
    }
    
    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_dict
    )

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Kullanıcı kaydı"""
    try:
        # Email kontrolü
        existing_user = get_user_by_email(db, user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu email adresi zaten kayıtlı"
            )
        
        # Şifre uzunluk kontrolü
        if len(user_data.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Şifre en az 6 karakter olmalıdır"
            )
        
        # Yeni kullanıcı oluştur
        user = create_user(db, user_data)
        
        # JWT token oluştur
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        # User verisini dictionary olarak oluştur
        user_dict = {
            "id": user.id,
            "name": user.full_name or user.username,  # full_name yoksa username kullan
            "email": user.email,
            "subscription_type": user.subscription_type or "free",  # Premium bilgisi ekle
            "subscription_expires": user.subscription_expires.isoformat() if user.subscription_expires else None,
            "created_at": user.created_at.isoformat()
        }
        
        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_dict
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Register error: {str(e)}")
        raise HTTPException(status_code=500, detail="Kayıt işlemi başarısız")

@app.get("/api/health")
async def health_check():
    """API sağlık kontrolü"""
    return {"status": "healthy", "service": "SkillPath API"}

# Dashboard & Analytics Endpoints
@app.get("/api/user/dashboard", response_model=DashboardStats)
async def get_user_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının genel istatistiklerini getir"""
    try:
        # Gerçek kullanıcı ID'sini kullan
        user_id = current_user.id
        
        # Toplam roadmap sayısı
        total_roadmaps = db.query(Roadmap).filter(Roadmap.user_id == user_id).count()
        
        # Aktif roadmap sayısı
        active_roadmaps = db.query(Roadmap).filter(
            Roadmap.user_id == user_id,
            Roadmap.is_active == 1
        ).count()
        
        # Tamamlanan roadmap sayısı (tüm adımları tamamlanan)
        completed_roadmaps = 0
        roadmaps = db.query(Roadmap).filter(Roadmap.user_id == user_id).all()
        
        total_steps = 0
        completed_steps = 0
        total_learning_hours = 0
        
        for roadmap in roadmaps:
            steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap.id).all()
            roadmap_total_steps = len(steps)
            roadmap_completed_steps = sum(1 for step in steps if step.is_completed)
            
            total_steps += roadmap_total_steps
            completed_steps += roadmap_completed_steps
            
            # Learning hours hesapla
            for step in steps:
                total_learning_hours += step.estimated_hours or 0
                
            # Eğer tüm adımlar tamamlandıysa roadmap tamamlanmış
            if roadmap_total_steps > 0 and roadmap_completed_steps == roadmap_total_steps:
                completed_roadmaps += 1
        
        # Completion percentage
        completion_percentage = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
        # Streak hesaplama
        user_game = db.query(UserGamification).filter(
            UserGamification.user_id == user_id
        ).first()
        
        if user_game:
            current_streak = user_game.current_streak
            longest_streak = user_game.longest_streak
        else:
            current_streak = 0
            longest_streak = 0
        
        return DashboardStats(
            total_roadmaps=total_roadmaps,
            active_roadmaps=active_roadmaps,
            completed_roadmaps=completed_roadmaps,
            total_steps=total_steps,
            completed_steps=completed_steps,
            completion_percentage=round(completion_percentage, 1),
            total_learning_hours=total_learning_hours,
            current_streak=current_streak,
            longest_streak=longest_streak
        )
        
    except Exception as e:
        print(f"Dashboard stats failed: {e}")
        raise HTTPException(status_code=500, detail="Dashboard verileri getirilemedi")

@app.get("/api/user/roadmaps", response_model=List[RoadmapSummary])
async def get_user_roadmaps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının tüm roadmap'lerini getir"""
    try:
        # Gerçek kullanıcı ID'sini kullan
        user_id = current_user.id
        
        roadmaps = db.query(Roadmap).filter(
            Roadmap.user_id == user_id
        ).order_by(Roadmap.created_at.desc()).all()
        
        roadmap_summaries = []
        
        for roadmap in roadmaps:
            # Steps bilgilerini getir
            steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap.id).all()
            total_steps = len(steps)
            completed_steps = sum(1 for step in steps if step.is_completed)
            completion_percentage = (completed_steps / total_steps * 100) if total_steps > 0 else 0
            
            # Son aktivite tarihi (şimdilik created_at kullan)
            last_activity = roadmap.created_at.isoformat() if roadmap.created_at else None
            
            roadmap_summaries.append(RoadmapSummary(
                id=roadmap.id,
                title=roadmap.title,
                description=roadmap.description or "",
                total_weeks=roadmap.total_weeks or 0,
                difficulty_level=roadmap.difficulty_level or "intermediate",
                total_steps=total_steps,
                completed_steps=completed_steps,
                completion_percentage=round(completion_percentage, 1),
                created_at=roadmap.created_at.isoformat() if roadmap.created_at else "",
                last_activity=last_activity
            ))
        
        return roadmap_summaries
        
    except Exception as e:
        print(f"Get user roadmaps failed: {e}")
        raise HTTPException(status_code=500, detail="Roadmap listesi getirilemedi")

@app.get("/api/roadmap/{roadmap_id}/progress", response_model=RoadmapProgress)
async def get_roadmap_progress(
    roadmap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Belirli bir roadmap'in detaylı progress bilgilerini getir"""
    try:
        # Roadmap'i kullanıcıya ait olup olmadığını kontrol et
        roadmap = db.query(Roadmap).filter(
            Roadmap.id == roadmap_id,
            Roadmap.user_id == current_user.id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap bulunamadı")
        
        # Steps'leri getir
        steps = db.query(RoadmapStep).filter(
            RoadmapStep.roadmap_id == roadmap_id
        ).order_by(RoadmapStep.step_order).all()
        
        total_steps = len(steps)
        completed_steps = sum(1 for step in steps if step.is_completed)
        completion_percentage = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
        # Steps'leri format'la
        step_progress_list = []
        next_step = None
        
        for step in steps:
            step_resources = json.loads(step.resources) if step.resources else []
            step_prerequisites = json.loads(step.prerequisites) if step.prerequisites else []
            
            step_progress = StepProgress(
                step_id=step.id,
                step_order=step.step_order,
                title=step.title,
                description=step.description or "",
                estimated_hours=step.estimated_hours or 0,
                is_completed=bool(step.is_completed),
                completed_at=None,  # TODO: Add completed_at tracking
                resources=step_resources,
                projects=step_prerequisites
            )
            
            step_progress_list.append(step_progress)
            
            # İlk tamamlanmamış adımı next_step olarak belirle
            if not step.is_completed and next_step is None:
                next_step = step_progress
        
        return RoadmapProgress(
            roadmap_id=roadmap.id,
            title=roadmap.title,
            total_steps=total_steps,
            completed_steps=completed_steps,
            completion_percentage=round(completion_percentage, 1),
            steps=step_progress_list,
            next_step=next_step
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get roadmap progress failed: {e}")
        raise HTTPException(status_code=500, detail="Roadmap progress getirilemedi")

@app.put("/api/roadmap/{roadmap_id}/step/{step_id}/complete")
async def complete_roadmap_step(
    roadmap_id: int,
    step_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bir roadmap adımını tamamlanmış olarak işaretle"""
    try:
        # Roadmap'in kullanıcıya ait olduğunu kontrol et
        roadmap = db.query(Roadmap).filter(
            Roadmap.id == roadmap_id,
            Roadmap.user_id == current_user.id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap bulunamadı")
        
        # Step'i bul
        step = db.query(RoadmapStep).filter(
            RoadmapStep.id == step_id,
            RoadmapStep.roadmap_id == roadmap_id
        ).first()
        
        if not step:
            raise HTTPException(status_code=404, detail="Adım bulunamadı")
        
        # Step'i tamamlanmış olarak işaretle
        step.is_completed = 1
        
        # UserActivity kaydı ekle (streak hesaplaması için) - activity_data olmadan
        try:
            activity = UserActivity(
                user_id=current_user.id,
                activity_type="step_complete",
                roadmap_id=roadmap_id,
                step_id=step_id
            )
            db.add(activity)
        except Exception as activity_error:
            print(f"UserActivity creation failed: {activity_error}")
            # Activity creation başarısız olsa da step completion devam etsin
        
        db.commit()
        
        # Achievement kontrolü yap
        check_and_award_achievements(db, current_user.id, "roadmap_step", step_id)
        
        # Progress bilgilerini hesapla
        steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap_id).all()
        total_steps = len(steps)
        completed_steps = sum(1 for s in steps if s.is_completed)
        completion_percentage = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
        # Eğer roadmap tamamen tamamlandıysa, roadmap completion achievement'ı kontrol et
        if completion_percentage == 100:
            check_and_award_achievements(db, current_user.id, "roadmap_complete", roadmap_id)
        
        return {
            "success": True,
            "message": "Adım başarıyla tamamlandı!",
            "step_id": step_id,
            "completed_steps": completed_steps,
            "total_steps": total_steps,
            "completion_percentage": round(completion_percentage, 1)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Complete step failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Adım tamamlanamadı: {str(e)}")

@app.put("/api/roadmap/{roadmap_id}/step/{step_id}/uncomplete")
async def uncomplete_roadmap_step(
    roadmap_id: int,
    step_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bir roadmap adımını tamamlanmamış olarak işaretle"""
    try:
        # Roadmap'in kullanıcıya ait olduğunu kontrol et
        roadmap = db.query(Roadmap).filter(
            Roadmap.id == roadmap_id,
            Roadmap.user_id == current_user.id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap bulunamadı")
        
        # Step'i bul
        step = db.query(RoadmapStep).filter(
            RoadmapStep.id == step_id,
            RoadmapStep.roadmap_id == roadmap_id
        ).first()
        
        if not step:
            raise HTTPException(status_code=404, detail="Adım bulunamadı")
        
        # Step'i tamamlanmamış olarak işaretle
        step.is_completed = 0
        db.commit()
        
        # Progress bilgilerini hesapla
        steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap_id).all()
        total_steps = len(steps)
        completed_steps = sum(1 for s in steps if s.is_completed)
        completion_percentage = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
        return {
            "success": True,
            "message": "Adım işareti kaldırıldı!",
            "step_id": step_id,
            "completed_steps": completed_steps,
            "total_steps": total_steps,
            "completion_percentage": round(completion_percentage, 1)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Uncomplete step failed: {e}")
        raise HTTPException(status_code=500, detail="Adım işareti kaldırılamadı")

# Yeni AI destekli endpoint'ler
@app.post("/api/skills/suggest", response_model=SkillSuggestionResponse)
async def suggest_skill(request: SkillSuggestionRequest):
    """Kullanıcının yazdığı skill'i normalize et ve öneriler sun"""
    result = SkillNormalizer.normalize_skill_with_ai(request.user_input)
    
    return SkillSuggestionResponse(
        normalized_name=result["normalized_name"],
        category=result["category"],
        difficulty=result["difficulty"],
        estimated_weeks=result["estimated_weeks"],
        similar_skills=result["similar_skills"],
        confidence=result["confidence"],
        suggestions=result["suggestions"]
    )

@app.post("/api/skills/assessment", response_model=AssessmentResponse)
async def generate_assessment(request: AssessmentRequest):
    """Belirli bir skill için assessment soruları oluştur"""
    try:
        if not openai_client:
            # Fallback sorular
            questions = [
                AssessmentQuestion(
                    question=f"{request.skill_name} konusunda ne kadar deneyiminiz var?",
                    options=["Hiç deneyimim yok", "Temel seviye", "Orta seviye", "İleri seviye"],
                    question_type="multiple_choice"
                ),
                AssessmentQuestion(
                    question="Günde kaç saat çalışmayı planlıyorsunuz?",
                    options=["1 saat", "2-3 saat", "4-5 saat", "6+ saat"],
                    question_type="multiple_choice"
                ),
                AssessmentQuestion(
                    question="Hangi öğrenme stilini tercih edersiniz?",
                    options=["Video izleyerek", "Kitap okuyarak", "Uygulama yaparak", "Karma"],
                    question_type="multiple_choice"
                )
            ]
        else:
            # AI ile dinamik sorular oluştur
            prompt = f"""
            "{request.skill_name}" skill'i için {request.target_duration_weeks} haftalık öğrenme planı yapacağız.
            
            Kullanıcının mevcut seviyesini ve ihtiyaçlarını anlamak için 3-5 soru oluştur.
            
            JSON formatında döndür:
            {{
                "questions": [
                    {{
                        "question": "Soru metni",
                        "options": ["Seçenek 1", "Seçenek 2", "Seçenek 3", "Seçenek 4"],
                        "question_type": "multiple_choice"
                    }}
                ]
            }}
            
            Türkçe sorular oluştur.
            """
            
            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5
            )
            
            ai_result = json.loads(response.choices[0].message.content)
            questions = [AssessmentQuestion(**q) for q in ai_result["questions"]]
        
        return AssessmentResponse(
            questions=questions,
            skill_info={
                "skill_name": request.skill_name,
                "target_duration_weeks": request.target_duration_weeks,
                "language": request.language
            }
        )
        
    except Exception as e:
        print(f"Assessment generation failed: {e}")
        # Fallback sorular
        questions = [
            AssessmentQuestion(
                question=f"{request.skill_name} konusunda ne kadar deneyiminiz var?",
                options=["Hiç deneyimim yok", "Temel seviye", "Orta seviye", "İleri seviye"],
                question_type="multiple_choice"
            )
        ]
        
        return AssessmentResponse(
            questions=questions,
            skill_info={
                "skill_name": request.skill_name,
                "target_duration_weeks": request.target_duration_weeks,
                "language": request.language
            }
        )

@app.post("/api/roadmap/create", response_model=RoadmapResponse)
async def generate_roadmap_new(
    request: RoadmapRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """AI ile kişiselleştirilmiş roadmap oluştur - POST body ile"""
    try:
        print(f"🚀 Roadmap oluşturma başladı - User: {current_user.id}, Skill: {request.skill_name}")
        
        # POST body'den değerleri al
        skill_name = request.skill_name
        target_weeks = request.target_weeks
        current_level = request.current_level
        daily_hours = request.daily_hours
        
        print(f"📝 Parametreler: {skill_name}, {target_weeks} hafta, {current_level}, {daily_hours} saat/gün")
        
        if not openai_client:
            print("⚠️ OpenAI client yok, fallback kullanılıyor")
            # Basit fallback roadmap
            roadmap_data = {
                "title": f"{skill_name} Öğrenme Yol Haritası",
                "total_weeks": target_weeks,
                "steps": [
                    {
                        "step_order": 1,
                        "title": f"{skill_name} Temelleri",
                        "description": "Temel kavramları öğrenin",
                        "estimated_hours": 20,
                        "resources": ["Online kurslar", "Dokümantasyon"],
                        "projects": ["Basit proje"]
                    },
                    {
                        "step_order": 2,
                        "title": "Uygulamalı Projeler",
                        "description": "Pratik yapın",
                        "estimated_hours": target_weeks * 5,
                        "resources": ["GitHub projeleri", "Pratik örnekler"],
                        "projects": ["Orta seviye proje"]
                    },
                    {
                        "step_order": 3,
                        "title": "İleri Seviye Konular",
                        "description": "Derinlemesine öğrenin",
                        "estimated_hours": 30,
                        "resources": ["İleri seviye kurslar", "Uzman blog yazıları"],
                        "projects": ["Kapsamlı proje"]
                    }
                ]
            }
        else:
            print("🤖 OpenAI ile roadmap oluşturuluyor")
            # AI ile detaylı roadmap oluştur
            prompt = f"""
            Kullanıcı "{skill_name}" öğrenmek istiyor.
            - Mevcut seviye: {current_level}
            - Hedef süre: {target_weeks} hafta
            - Günlük çalışma: {daily_hours} saat
            
            Detaylı bir öğrenme yol haritası oluştur. Her adım için MUTLAKA şunları ekle:
            - step_order: adım sırası (1, 2, 3...)
            - title: başlık
            - description: açıklama
            - estimated_hours: tahmini saat (sayısal değer, MUTLAKA gerekli)
            - resources: önerilen kaynaklar listesi
            - projects: yapılacak projeler listesi
            
            JSON formatında döndür:
            {{
                "roadmap": {{
                    "title": "Roadmap başlığı",
                    "total_weeks": {target_weeks},
                    "steps": [
                        {{
                            "step_order": 1,
                            "title": "Adım başlığı",
                            "description": "Detaylı açıklama",
                            "estimated_hours": 20,
                            "resources": ["Kaynak 1", "Kaynak 2"],
                            "projects": ["Proje 1", "Proje 2"]
                        }}
                    ]
                }}
            }}
            
            ÖNEMLİ: estimated_hours alanını MUTLAKA dahil et ve sayısal değer ver.
            Türkçe oluştur.
            """
            
            response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            ai_result = json.loads(response.choices[0].message.content)
            roadmap_data = ai_result["roadmap"]
        
        print(f"✅ Roadmap verisi hazırlandı: {roadmap_data['title']}")
        
        # Veritabanına kaydet
        new_roadmap = Roadmap(
            user_id=current_user.id,
            skill_id=0,  # Dinamik skill için 0
            title=roadmap_data["title"],
            description=f"{skill_name} için kişiselleştirilmiş öğrenme yolu",
            total_weeks=target_weeks,
            difficulty_level=current_level,
            daily_hours=daily_hours,
            roadmap_data=json.dumps(roadmap_data),
            is_active=1
        )
        
        db.add(new_roadmap)
        db.commit()
        db.refresh(new_roadmap)
        
        print(f"💾 Roadmap veritabanına kaydedildi: ID {new_roadmap.id}")
        
        # Adımları kaydet
        for step_data in roadmap_data["steps"]:
            step = RoadmapStep(
                roadmap_id=new_roadmap.id,
                step_order=step_data["step_order"],
                title=step_data["title"],
                description=step_data["description"],
                estimated_hours=step_data.get("estimated_hours", 20),  # Varsayılan 20 saat
                resources=json.dumps(step_data.get("resources", [])),
                prerequisites=json.dumps(step_data.get("projects", [])),  # Projects'i prerequisites olarak kaydet
                is_completed=0
            )
            db.add(step)
        
        db.commit()
        print(f"📋 {len(roadmap_data['steps'])} adım kaydedildi")
        
        # Günlük görevleri otomatik olarak oluştur - AI İLE AKILLI ÜRETIM
        try:
            print("⚙️ Günlük görevler oluşturuluyor...")
            daily_tasks = await generate_daily_tasks_for_roadmap(new_roadmap.id, current_user.id, db)
            print(f"✅ {len(daily_tasks)} günlük görev oluşturuldu")
        except Exception as e:
            print(f"⚠️ AI günlük görev oluşturma hatası: {e}")
            # AI başarısız olursa fallback kullan
            try:
                print("🔄 Fallback günlük görev sistemi devreye giriyor...")
                daily_tasks = await generate_daily_tasks_for_roadmap_simple(new_roadmap.id, current_user.id, db)
                print(f"✅ {len(daily_tasks)} fallback günlük görev oluşturuldu")
            except Exception as fallback_error:
                print(f"❌ Fallback günlük görev oluşturma da başarısız: {fallback_error}")
            # Hata olsa bile roadmap'i döndür
        
        return RoadmapResponse(
            success=True,
            roadmap_id=new_roadmap.id,
            roadmap=roadmap_data,
            message="Kişiselleştirilmiş roadmap ve günlük görevler başarıyla oluşturuldu!"
        )
            
    except Exception as e:
        print(f"❌ Roadmap generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Roadmap oluşturulamadı: {str(e)}")

# Daily task oluşturma fonksiyonu kaldırıldı

@app.get("/api/roadmap/{roadmap_id}")
async def get_roadmap(
    roadmap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının roadmap detaylarını getir"""
    try:
        # Roadmap'i kullanıcıya ait olup olmadığını kontrol et
        roadmap = db.query(Roadmap).filter(
            Roadmap.id == roadmap_id,
            Roadmap.user_id == current_user.id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap bulunamadı")
        
        # Roadmap adımlarını getir
        steps = db.query(RoadmapStep).filter(
            RoadmapStep.roadmap_id == roadmap_id
        ).order_by(RoadmapStep.step_order).all()
        
        # Daily task kaldırıldı
        
        # JSON formatında roadmap verisini parse et
        roadmap_data = json.loads(roadmap.roadmap_data) if roadmap.roadmap_data else {}
        
        # Response formatını düzenle
        steps_data = []
        for step in steps:
            step_resources = json.loads(step.resources) if step.resources else []
            step_prerequisites = json.loads(step.prerequisites) if step.prerequisites else []
            
            steps_data.append({
                "step_order": step.step_order,
                "title": step.title,
                "description": step.description,
                "estimated_hours": step.estimated_hours,
                "resources": step_resources,
                "projects": step_prerequisites,  # Prerequisites'ı projeler olarak kullan
                "is_completed": bool(step.is_completed)
            })
        
        # Daily task kaldırıldı
        
        return {
            "success": True,
            "roadmap": {
                "id": roadmap.id,
                "title": roadmap.title,
                "description": roadmap.description,
                "total_weeks": roadmap.total_weeks,
                "difficulty_level": roadmap.difficulty_level,
                "steps": steps_data,
                "created_at": roadmap.created_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get roadmap failed: {e}")
        raise HTTPException(status_code=500, detail="Roadmap getirilemedi")

# Notification Endpoints
@app.post("/api/notifications/preferences", response_model=NotificationPreferenceResponse)
async def update_notification_preferences(
    request: NotificationPreferenceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının bildirim tercihlerini güncelle"""
    try:
        # Mevcut tercihleri kontrol et
        existing_prefs = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == current_user.id
        ).first()
        
        if existing_prefs:
            # Güncelle
            existing_prefs.daily_reminder_enabled = int(request.daily_reminder_enabled)
            existing_prefs.daily_reminder_time = request.daily_reminder_time
            existing_prefs.step_completion_enabled = int(request.step_completion_enabled)
            existing_prefs.streak_warning_enabled = int(request.streak_warning_enabled)
            existing_prefs.weekly_progress_enabled = int(request.weekly_progress_enabled)
            existing_prefs.do_not_disturb_start = request.do_not_disturb_start
            existing_prefs.do_not_disturb_end = request.do_not_disturb_end
            if request.timezone:
                existing_prefs.timezone = request.timezone
            if request.device_timezone:
                existing_prefs.device_timezone = request.device_timezone
            
            db.commit()
            db.refresh(existing_prefs)
            prefs = existing_prefs
        else:
            # Yeni oluştur
            prefs = NotificationPreference(
                user_id=current_user.id,
                daily_reminder_enabled=int(request.daily_reminder_enabled),
                daily_reminder_time=request.daily_reminder_time,
                step_completion_enabled=int(request.step_completion_enabled),
                streak_warning_enabled=int(request.streak_warning_enabled),
                weekly_progress_enabled=int(request.weekly_progress_enabled),
                do_not_disturb_start=request.do_not_disturb_start,
                do_not_disturb_end=request.do_not_disturb_end,
                timezone=request.timezone,
                device_timezone=request.device_timezone
            )
            db.add(prefs)
            db.commit()
            db.refresh(prefs)
        
        return NotificationPreferenceResponse(
            id=prefs.id,
            user_id=prefs.user_id,
            daily_reminder_enabled=bool(prefs.daily_reminder_enabled),
            daily_reminder_time=prefs.daily_reminder_time,
            step_completion_enabled=bool(prefs.step_completion_enabled),
            streak_warning_enabled=bool(prefs.streak_warning_enabled),
            weekly_progress_enabled=bool(prefs.weekly_progress_enabled),
            do_not_disturb_start=prefs.do_not_disturb_start,
            do_not_disturb_end=prefs.do_not_disturb_end,
            timezone=prefs.timezone,
            device_timezone=prefs.device_timezone
        )
        
    except Exception as e:
        print(f"Update notification preferences failed: {e}")
        raise HTTPException(status_code=500, detail="Bildirim tercihleri güncellenemedi")

@app.get("/api/notifications/preferences", response_model=NotificationPreferenceResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının bildirim tercihlerini getir"""
    try:
        prefs = NotificationService.get_or_create_notification_preferences(db, current_user.id)
        
        return NotificationPreferenceResponse(
            id=prefs.id,
            user_id=prefs.user_id,
            daily_reminder_enabled=bool(prefs.daily_reminder_enabled),
            daily_reminder_time=prefs.daily_reminder_time,
            step_completion_enabled=bool(prefs.step_completion_enabled),
            streak_warning_enabled=bool(prefs.streak_warning_enabled),
            weekly_progress_enabled=bool(prefs.weekly_progress_enabled),
            do_not_disturb_start=prefs.do_not_disturb_start,
            do_not_disturb_end=prefs.do_not_disturb_end,
            timezone=prefs.timezone,
            device_timezone=prefs.device_timezone
        )
    except Exception as e:
        print(f"Get notification preferences failed: {e}")
        raise HTTPException(status_code=500, detail="Bildirim tercihleri getirilemedi")

@app.get("/api/notifications/daily-reminder", response_model=DailyReminderResponse)
async def get_daily_reminder(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcı için günlük hatırlatma oluştur"""
    try:
        # Kullanıcının bildirim tercihlerini kontrol et
        prefs = NotificationService.get_or_create_notification_preferences(db, current_user.id)
        
        if not prefs.daily_reminder_enabled:
            return DailyReminderResponse(
                success=False,
                message="Günlük hatırlatmalar devre dışı"
            )
        
        # Sonraki adımı bul
        reminder_data = NotificationService.get_next_step_for_reminder(db, current_user.id)
        
        if not reminder_data:
            return DailyReminderResponse(
                success=False,
                message="Aktif roadmap bulunamadı"
            )
        
        # Hatırlatma mesajı oluştur
        reminder_message = NotificationService.generate_daily_reminder_message(
            reminder_data, 
            current_user.full_name
        )
        
        # Bildirimi logla
        NotificationService.log_notification(
            db=db,
            user_id=current_user.id,
            notification_type="daily_reminder",
            title=reminder_message["title"],
            message=reminder_message["message"],
            roadmap_id=reminder_data.get("roadmap_id"),
            step_id=reminder_data.get("step_id")
        )
        
        return DailyReminderResponse(
            success=True,
            message="Günlük hatırlatma oluşturuldu",
            reminder_data={
                **reminder_message,
                "roadmap_title": reminder_data.get("roadmap_title"),
                "step_title": reminder_data.get("step_title")
            }
        )
        
    except Exception as e:
        print(f"Daily reminder failed: {e}")
        raise HTTPException(status_code=500, detail="Günlük hatırlatma oluşturulamadı")

@app.post("/api/notifications/push-token")
async def register_push_token(
    request: PushTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının push notification token'ını kaydet"""
    try:
        # Eski token'ları deaktif et (aynı kullanıcı için)
        db.execute(
            text("UPDATE push_tokens SET is_active = 0 WHERE user_id = :user_id"),
            {"user_id": current_user.id}
        )
        
        # Yeni token'ı kaydet
        new_token = PushToken(
            user_id=current_user.id,
            push_token=request.push_token,
            device_type=request.device_type,
            is_active=1
        )
        db.add(new_token)
        db.commit()
        
        print(f"Push token registered for user {current_user.id}: {request.push_token[:20]}...")
        
        return {"success": True, "message": "Push token kaydedildi"}
        
    except Exception as e:
        print(f"Push token registration failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Push token kaydedilemedi")

@app.get("/api/notifications/history", response_model=List[NotificationResponse])
async def get_notification_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get user's notification history
    notifications = db.execute(
        text("""
            SELECT id, title, message, notification_type, sent_at, roadmap_id, step_id
            FROM notification_logs 
            WHERE user_id = :user_id 
            ORDER BY sent_at DESC 
            LIMIT :limit
        """),
        {"user_id": current_user.id, "limit": limit}
    ).fetchall()
    
    result = []
    for notification in notifications:
        # Get roadmap and step titles if available
        roadmap_title = None
        step_title = None
        
        if notification.roadmap_id:
            roadmap = db.execute(
                text("SELECT title FROM roadmaps WHERE id = :roadmap_id"),
                {"roadmap_id": notification.roadmap_id}
            ).fetchone()
            if roadmap:
                roadmap_title = roadmap.title
        
        if notification.step_id:
            step = db.execute(
                text("SELECT title FROM roadmap_steps WHERE id = :step_id"),
                {"step_id": notification.step_id}
            ).fetchone()
            if step:
                step_title = step.title
        
        result.append(NotificationResponse(
            id=notification.id,
            title=notification.title,
            message=notification.message,
            notification_type=notification.notification_type,
            sent_at=notification.sent_at.isoformat(),
            roadmap_title=roadmap_title,
            step_title=step_title
        ))
    
    return result

@app.post("/api/notifications/test-push")
async def send_test_push_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test push notification gönder"""
    try:
        print(f"User found: {current_user.email}")
        
        # En son push token'ı al
        push_token_result = db.execute(
            text("SELECT push_token FROM push_tokens WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1"),
            {"user_id": current_user.id}
        ).fetchone()
        
        if not push_token_result:
            return {"success": False, "message": "Push token bulunamadı"}
        
        push_token = push_token_result[0]
        
        # Test notification gönder
        result = push_service.send_push_notification(
            push_token=push_token,
            title="Test Bildirimi 🧪",
            message=f"Merhaba {current_user.full_name or 'Test Kullanıcı'}! Bu bir test bildirimidir.",
            data={
                'type': 'test',
                'user_id': current_user.id
            }
        )
        
        if result.get('success'):
            return {"success": True, "message": "Test bildirimi başarıyla gönderildi!"}
        else:
            return {"success": False, "message": f"Test bildirimi gönderilemedi: {result.get('error', 'Bilinmeyen hata')}"}
        
    except Exception as e:
        print(f"Test push notification error: {e}")
        return {"success": False, "message": f"Hata: {str(e)}"}

@app.get("/api/notifications/streak")
async def get_user_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının streak bilgilerini getir"""
    try:
        streak_data = push_service.calculate_user_streak(db, current_user.id)
        
        return {
            "success": True,
            "streak_data": streak_data,
            "message": f"Mevcut seriniz: {streak_data['current_streak']} gün"
        }
        
    except Exception as e:
        print(f"Get streak error: {e}")
        return {"success": False, "message": f"Streak bilgisi alınamadı: {str(e)}"}

@app.post("/api/notifications/test-streak")
async def test_streak_warnings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test streak warning notifications"""
    try:
        push_service = PushNotificationService()
        
        # Get user's active push tokens
        push_tokens = db.query(PushToken).filter(
            PushToken.user_id == current_user.id,
            PushToken.is_active == 1
        ).all()
        
        if not push_tokens:
            return {"success": False, "message": "No active push tokens found"}
        
        # Send test streak warning
        for token in push_tokens:
            push_service.send_push_notification(
                push_token=token.push_token,
                title="🔥 Streak Uyarısı",
                message="Streakini kaybetme! Bugün bir adım tamamla.",
                data={"type": "streak_warning", "test": True}
            )
        
        return {
            "success": True,
            "message": f"Test streak warning sent to {len(push_tokens)} devices"
        }
        
    except Exception as e:
        print(f"Error sending test streak warning: {e}")
        return {"success": False, "message": str(e)}

# Premium Subscription Endpoints

class PremiumPurchaseRequest(BaseModel):
    product_id: str  # premium_monthly, premium_yearly
    payment_method: str = "test"  # test, stripe, etc.

class PremiumStatusResponse(BaseModel):
    is_premium: bool
    subscription_type: str
    expires_at: Optional[datetime]
    days_remaining: Optional[int]
    features: List[str]

# Community Models
class CommunityPostCreate(BaseModel):
    title: str
    content: str
    skill_name: Optional[str] = None
    post_type: str = "question"

class CommunityPostResponse(BaseModel):
    id: int
    title: str
    content: str
    skill_name: Optional[str]
    post_type: str
    likes_count: int
    replies_count: int
    is_expert_post: bool
    author_name: str
    author_id: int
    is_liked: bool = False
    created_at: str
    
class CommunityReplyCreate(BaseModel):
    content: str

class CommunityReplyResponse(BaseModel):
    id: int
    content: str
    likes_count: int
    author_name: str
    author_id: int
    is_liked: bool = False
    created_at: str

class CommunityStatsResponse(BaseModel):
    total_posts: int
    total_replies: int
    active_users: int
    popular_skills: List[dict]

# Daily Tasks ve Gamification Modelleri
# Daily Task ve Study Session response modelleri kaldırıldı

class GamificationResponse(BaseModel):
    total_xp: int
    current_level: int
    daily_xp_today: int
    current_streak: int
    longest_streak: int
    level_name: str
    next_level_xp: int
    achievements_count: int

class AchievementResponse(BaseModel):
    id: int
    name: str
    description: str
    icon: str
    category: str
    earned_at: Optional[str]

class UserProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    created_at: str
    subscription_type: str
    gamification: GamificationResponse
    achievements: List[AchievementResponse]
    total_roadmaps: int
    completed_roadmaps: int
    total_study_hours: int
    is_own_profile: bool

# Premium subscription models - removed all complex models

# Premium subscription endpoints - simplified
@app.get("/api/premium/status")
async def get_premium_status(current_user: User = Depends(get_current_user)):
    """Get user's premium subscription status"""
    try:
        print(f"🔍 Checking premium status for user: {current_user.email}")
        
        is_premium = current_user.subscription_type == "premium"
        expires_at = current_user.subscription_expires.isoformat() if current_user.subscription_expires else None
        
        print(f"✅ Premium status: {is_premium}, expires: {expires_at}")
        
        return {
            "is_premium": is_premium,
            "subscription_type": current_user.subscription_type or "free",
            "expires_at": expires_at
        }
    except Exception as e:
        print(f"❌ Error checking premium status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check premium status")

@app.post("/api/premium/purchase")
async def purchase_premium(
    request: PremiumPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process premium subscription purchase"""
    try:
        print(f"🛒 Processing premium purchase for user: {current_user.email}")
        print(f"📦 Product ID: {request.product_id}")
        
        # Determine subscription duration
        if "yearly" in request.product_id.lower():
            # 1 yıl süre
            expires_at = datetime.now(timezone.utc) + timedelta(days=365)
            subscription_type = "premium"
            print(f"📅 Yearly subscription expires at: {expires_at}")
        elif "monthly" in request.product_id.lower():
            # 1 ay süre
            expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            subscription_type = "premium"
            print(f"📅 Monthly subscription expires at: {expires_at}")
        else:
            # Test satın alma için 1 yıl ver
            expires_at = datetime.now(timezone.utc) + timedelta(days=365)
            subscription_type = "premium"
            print(f"📅 Test subscription expires at: {expires_at}")
        
        # User'ı güncelle
        current_user.subscription_type = subscription_type
        current_user.subscription_expires = expires_at
        current_user.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        
        print(f"✅ Premium subscription activated for user: {current_user.email}")
        
        return {
            "success": True,
            "message": "Premium abonelik başarıyla aktifleştirildi!",
            "subscription_type": subscription_type,
            "expires_at": expires_at.isoformat(),
            "product_id": request.product_id
        }
        
    except Exception as e:
        print(f"❌ Premium purchase failed: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Premium satın alma başarısız")

@app.post("/api/premium/test-upgrade")
async def test_upgrade_premium(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test için premium'a upgrade et"""
    try:
        # Kullanıcıyı premium'a upgrade et
        current_user.subscription_type = "premium"
        current_user.subscription_expires = datetime.now(timezone.utc) + timedelta(days=30)
        
        db.commit()
        db.refresh(current_user)
        
        return {
            "success": True,
            "message": "Premium upgrade başarılı!",
            "subscription_type": current_user.subscription_type,
            "expires_at": current_user.subscription_expires
        }
    except Exception as e:
        db.rollback()
        print(f"Premium upgrade error: {e}")
        raise HTTPException(status_code=500, detail="Premium upgrade başarısız")

# Debug endpoint - Kullanıcıları listele
@app.get("/api/debug/users")
async def list_users(db: Session = Depends(get_db)):
    """Debug amaçlı - Tüm kullanıcıları listele"""
    try:
        users = db.query(User).all()
        user_list = []
        for user in users:
            user_list.append({
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "subscription_type": user.subscription_type,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None
            })
        return {"users": user_list, "total": len(user_list)}
    except Exception as e:
        print(f"List users error: {e}")
        raise HTTPException(status_code=500, detail="Kullanıcılar listelenemedi")

# Debug endpoint - Test kullanıcısı oluştur
@app.post("/api/debug/create-test-user")
async def create_test_user(db: Session = Depends(get_db)):
    """Debug amaçlı - Test kullanıcısı oluştur"""
    try:
        # Mevcut kullanıcı kontrolü
        existing_user = get_user_by_email(db, "premium@premium.com")
        if existing_user:
            return {"message": "Test kullanıcısı zaten mevcut", "user_id": existing_user.id}
        
        # Test kullanıcısı oluştur
        test_user_data = UserCreate(
            name="Premium User",
            email="premium@premium.com",
            password="premium"
        )
        
        new_user = create_user(db, test_user_data)
        
        # Premium yap
        new_user.subscription_type = "premium"
        new_user.subscription_expires = datetime.now(timezone.utc) + timedelta(days=365)
        db.commit()
        db.refresh(new_user)
        
        return {
            "message": "Test kullanıcısı oluşturuldu",
            "user_id": new_user.id,
            "email": new_user.email,
            "subscription_type": new_user.subscription_type
        }
    except Exception as e:
        db.rollback()
        print(f"Create test user error: {e}")
        raise HTTPException(status_code=500, detail="Test kullanıcısı oluşturulamadı")

# Debug endpoint - Bildirim sistemi test
@app.post("/api/debug/test-notifications")
async def test_notification_system(db: Session = Depends(get_db)):
    """Debug amaçlı - Bildirim sistemini test et"""
    try:
        # Tüm notification preferences'ları listele
        preferences = db.query(NotificationPreference).all()
        
        # Push token'ları listele
        push_tokens = db.query(PushToken).filter(PushToken.is_active == 1).all()
        
        # Şu anki saat
        current_time = datetime.now().strftime("%H:%M")
        
        return {
            "current_time": current_time,
            "total_preferences": len(preferences),
            "preferences": [
                {
                    "user_id": pref.user_id,
                    "daily_reminder_enabled": pref.daily_reminder_enabled,
                    "daily_reminder_time": pref.daily_reminder_time
                } for pref in preferences
            ],
            "total_push_tokens": len(push_tokens),
            "push_tokens": [
                {
                    "user_id": token.user_id,
                    "token_preview": token.push_token[:20] + "..." if token.push_token else None,
                    "is_active": token.is_active
                } for token in push_tokens
            ]
        }
    except Exception as e:
        print(f"Test notification system error: {e}")
        raise HTTPException(status_code=500, detail="Bildirim sistemi test edilemedi")

# Debug endpoint - Manuel bildirim gönder
@app.post("/api/debug/send-test-notification")
async def send_test_notification_debug(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Debug amaçlı - Belirli kullanıcıya test bildirimi gönder"""
    try:
        # Kullanıcının push token'ını al
        push_token = db.query(PushToken).filter(
            PushToken.user_id == user_id,
            PushToken.is_active == 1
        ).order_by(PushToken.updated_at.desc()).first()
        
        if not push_token:
            return {"success": False, "message": f"User {user_id} için push token bulunamadı"}
        
        # Test bildirimi gönder
        result = push_service.send_push_notification(
            push_token=push_token.push_token,
            title="Test Bildirimi",
            message="Bu bir test bildirimidir!",
            data={"type": "test"}
        )
        
        return {
            "success": True,
            "message": "Test bildirimi gönderildi",
            "user_id": user_id,
            "push_result": result
        }
    except Exception as e:
        print(f"Send test notification error: {e}")
        raise HTTPException(status_code=500, detail="Test bildirimi gönderilemedi")

# Debug endpoint - Şifre test
@app.post("/api/debug/test-password")
async def test_password(
    email: str,
    password: str,
    db: Session = Depends(get_db)
):
    """Debug amaçlı - Şifre doğrulamasını test et"""
    try:
        user = get_user_by_email(db, email)
        if not user:
            return {"success": False, "message": "Kullanıcı bulunamadı"}
        
        # Şifre doğrulaması
        is_valid = verify_password(password, user.hashed_password)
        
        return {
            "success": True,
            "email": email,
            "user_id": user.id,
            "password_valid": is_valid,
            "hashed_password_preview": user.hashed_password[:50] + "..." if user.hashed_password else None
        }
    except Exception as e:
        print(f"Test password error: {e}")
        raise HTTPException(status_code=500, detail="Şifre test edilemedi")

# Debug endpoint - Kullanıcı şifresini sıfırla
@app.post("/api/debug/reset-user-password")
async def reset_user_password(
    email: str,
    new_password: str,
    db: Session = Depends(get_db)
):
    """Debug amaçlı - Kullanıcının şifresini sıfırla"""
    try:
        user = get_user_by_email(db, email)
        if not user:
            return {"success": False, "message": "Kullanıcı bulunamadı"}
        
        # Yeni şifreyi hash'le ve kaydet
        user.hashed_password = get_password_hash(new_password)
        db.commit()
        db.refresh(user)
        
        return {
            "success": True,
            "message": "Şifre başarıyla sıfırlandı",
            "email": email,
            "user_id": user.id
        }
    except Exception as e:
        db.rollback()
        print(f"Reset password error: {e}")
        raise HTTPException(status_code=500, detail="Şifre sıfırlanamadı")

# Community API Endpoints
@app.get("/api/community/stats", response_model=CommunityStatsResponse)
async def get_community_stats(db: Session = Depends(get_db)):
    """Get community statistics"""
    try:
        total_posts = db.query(CommunityPost).filter(CommunityPost.is_active == 1).count()
        total_replies = db.query(CommunityReply).filter(CommunityReply.is_active == 1).count()
        active_users = db.query(User).filter(User.is_active == 1).count()
        
        # Get popular skills from posts
        popular_skills_query = db.execute(text("""
            SELECT skill_name, COUNT(*) as post_count, COUNT(DISTINCT user_id) as learner_count
            FROM community_posts 
            WHERE skill_name IS NOT NULL AND is_active = 1
            GROUP BY skill_name 
            ORDER BY post_count DESC 
            LIMIT 10
        """))
        
        popular_skills = []
        for row in popular_skills_query:
            popular_skills.append({
                "name": row[0],
                "post_count": row[1],
                "learner_count": row[2]
            })
        
        return CommunityStatsResponse(
            total_posts=total_posts,
            total_replies=total_replies,
            active_users=active_users,
            popular_skills=popular_skills
        )
        
    except Exception as e:
        print(f"❌ Community stats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/community/posts", response_model=List[CommunityPostResponse])
async def get_community_posts(
    filter_type: str = "all",  # all, my, trending, popular, recent, expert
    skill_name: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get community posts with filtering"""
    try:
        query = db.query(CommunityPost).filter(CommunityPost.is_active == 1)
        
        # Apply filters
        if filter_type == "my":
            query = query.filter(CommunityPost.user_id == current_user.id)
        elif filter_type == "expert":
            query = query.filter(CommunityPost.is_expert_post == 1)
        elif skill_name:
            query = query.filter(CommunityPost.skill_name == skill_name)
            
        # Apply sorting
        if filter_type == "trending":
            query = query.order_by(CommunityPost.likes_count.desc(), CommunityPost.created_at.desc())
        elif filter_type == "popular":
            query = query.order_by(CommunityPost.replies_count.desc(), CommunityPost.likes_count.desc())
        elif filter_type == "recent":
            query = query.order_by(CommunityPost.created_at.desc())
        else:  # all or default
            query = query.order_by(CommunityPost.created_at.desc())
            
        posts = query.offset(offset).limit(limit).all()
        
        # Get user likes for these posts
        post_ids = [post.id for post in posts]
        user_likes = db.query(CommunityLike).filter(
            CommunityLike.user_id == current_user.id,
            CommunityLike.post_id.in_(post_ids)
        ).all()
        liked_post_ids = {like.post_id for like in user_likes}
        
        # Get author names
        user_ids = [post.user_id for post in posts]
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_names = {user.id: user.full_name or user.username for user in users}
        
        result = []
        for post in posts:
            result.append(CommunityPostResponse(
                id=post.id,
                title=post.title,
                content=post.content,
                skill_name=post.skill_name,
                post_type=post.post_type,
                likes_count=post.likes_count,
                replies_count=post.replies_count,
                is_expert_post=bool(post.is_expert_post),
                author_name=user_names.get(post.user_id, "Anonim"),
                author_id=post.user_id,
                is_liked=post.id in liked_post_ids,
                created_at=post.created_at.isoformat()
            ))
            
        return result
        
    except Exception as e:
        print(f"❌ Get posts error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/community/posts", response_model=CommunityPostResponse)
async def create_community_post(
    post_data: CommunityPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new community post"""
    try:
        # Check if user is premium for unlimited posts
        now = datetime.now(timezone.utc)
        is_premium = (current_user.subscription_type == "premium" and 
                     current_user.subscription_expires and 
                     current_user.subscription_expires.replace(tzinfo=timezone.utc) > now)
        
        if not is_premium:
            # Check daily post limit for free users (3 posts per day)
            today = now.date()
            today_posts = db.query(CommunityPost).filter(
                CommunityPost.user_id == current_user.id,
                func.date(CommunityPost.created_at) == today
            ).count()
            
            if today_posts >= 3:
                raise HTTPException(
                    status_code=403, 
                    detail="Günlük post limitiniz doldu. Premium üyelik ile sınırsız post atabilirsiniz."
                )
        
        # Create post
        new_post = CommunityPost(
            user_id=current_user.id,
            title=post_data.title,
            content=post_data.content,
            skill_name=post_data.skill_name,
            post_type=post_data.post_type,
            is_expert_post=1 if current_user.subscription_type == "premium" else 0
        )
        
        db.add(new_post)
        db.commit()
        db.refresh(new_post)
        
        # Achievement kontrolü yap
        check_and_award_achievements(db, current_user.id, "community_post", new_post.id)
        
        return CommunityPostResponse(
            id=new_post.id,
            title=new_post.title,
            content=new_post.content,
            skill_name=new_post.skill_name,
            post_type=new_post.post_type,
            likes_count=0,
            replies_count=0,
            is_expert_post=bool(new_post.is_expert_post),
            author_name=current_user.full_name or current_user.username,
            author_id=current_user.id,
            is_liked=False,
            created_at=new_post.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Create post error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/community/posts/{post_id}/like")
async def toggle_post_like(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle like on a community post"""
    try:
        # Check if post exists
        post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post bulunamadı")
        
        # Check if user already liked this post
        existing_like = db.query(CommunityLike).filter(
            CommunityLike.user_id == current_user.id,
            CommunityLike.post_id == post_id
        ).first()
        
        if existing_like:
            # Unlike
            db.delete(existing_like)
            post.likes_count = max(0, post.likes_count - 1)
            is_liked = False
        else:
            # Like
            new_like = CommunityLike(
                user_id=current_user.id,
                post_id=post_id
            )
            db.add(new_like)
            post.likes_count += 1
            is_liked = True
        
        db.commit()
        
        return {
            "success": True,
            "is_liked": is_liked,
            "likes_count": post.likes_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Toggle like error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/community/posts/{post_id}/replies", response_model=List[CommunityReplyResponse])
async def get_post_replies(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get replies for a specific post"""
    try:
        replies = db.query(CommunityReply).filter(
            CommunityReply.post_id == post_id,
            CommunityReply.is_active == 1
        ).order_by(CommunityReply.created_at.asc()).all()
        
        # Get user likes for these replies
        reply_ids = [reply.id for reply in replies]
        user_likes = db.query(CommunityLike).filter(
            CommunityLike.user_id == current_user.id,
            CommunityLike.reply_id.in_(reply_ids)
        ).all()
        liked_reply_ids = {like.reply_id for like in user_likes}
        
        # Get author names
        user_ids = [reply.user_id for reply in replies]
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_names = {user.id: user.full_name or user.username for user in users}
        
        result = []
        for reply in replies:
            result.append(CommunityReplyResponse(
                id=reply.id,
                content=reply.content,
                likes_count=reply.likes_count,
                author_name=user_names.get(reply.user_id, "Anonim"),
                author_id=reply.user_id,
                is_liked=reply.id in liked_reply_ids,
                created_at=reply.created_at.isoformat()
            ))
            
        return result
        
    except Exception as e:
        print(f"❌ Get replies error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/community/posts/{post_id}/replies", response_model=CommunityReplyResponse)
async def create_reply(
    post_id: int,
    reply_data: CommunityReplyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a reply to a community post"""
    try:
        # Check if post exists
        post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post bulunamadı")
        
        # Create reply
        new_reply = CommunityReply(
            post_id=post_id,
            user_id=current_user.id,
            content=reply_data.content
        )
        
        db.add(new_reply)
        
        # Update post reply count
        post.replies_count += 1
        
        db.commit()
        db.refresh(new_reply)
        
        # Achievement kontrolü yap
        check_and_award_achievements(db, current_user.id, "community_reply", new_reply.id)
        
        return CommunityReplyResponse(
            id=new_reply.id,
            content=new_reply.content,
            likes_count=0,
            author_name=current_user.full_name or current_user.username,
            author_id=current_user.id,
            is_liked=False,
            created_at=new_reply.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Create reply error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/community/replies/{reply_id}/like")
async def toggle_reply_like(
    reply_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle like on a community reply"""
    try:
        # Check if reply exists
        reply = db.query(CommunityReply).filter(CommunityReply.id == reply_id).first()
        if not reply:
            raise HTTPException(status_code=404, detail="Yorum bulunamadı")
        
        # Check if user already liked this reply
        existing_like = db.query(CommunityLike).filter(
            CommunityLike.user_id == current_user.id,
            CommunityLike.reply_id == reply_id
        ).first()
        
        if existing_like:
            # Unlike
            db.delete(existing_like)
            reply.likes_count = max(0, reply.likes_count - 1)
            is_liked = False
        else:
            # Like
            new_like = CommunityLike(
                user_id=current_user.id,
                reply_id=reply_id
            )
            db.add(new_like)
            reply.likes_count += 1
            is_liked = True
        
        db.commit()
        
        return {
            "success": True,
            "is_liked": is_liked,
            "likes_count": reply.likes_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Toggle reply like error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Removed all other premium endpoints (purchase, cancel, features, webhook)

# ================================
# GAMİFİCATION API'LERİ (Daily task kaldırıldı)
# ================================

# Daily task fonksiyonları kaldırıldı

@app.get("/api/user/gamification", response_model=GamificationResponse)
async def get_user_gamification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının gamification bilgilerini getir"""
    
    # Gamification bilgilerini getir veya oluştur
    user_game = db.query(UserGamification).filter(
        UserGamification.user_id == current_user.id
    ).first()
    
    if not user_game:
        user_game = UserGamification(user_id=current_user.id)
        db.add(user_game)
        db.commit()
    
    # Seviye isimlerini hesapla
    level_names = {1: "Beginner", 2: "Intermediate", 3: "Advanced", 4: "Expert"}
    level_xp_requirements = {1: 500, 2: 2000, 3: 5000, 4: 10000}
    
    current_level_name = level_names.get(user_game.current_level, "Master")
    next_level_xp = level_xp_requirements.get(user_game.current_level + 1, 0)
    
    # Kullanıcının rozetlerini say
    achievements_count = db.query(UserAchievement).filter(
        UserAchievement.user_id == current_user.id
    ).count()
    
    return GamificationResponse(
        total_xp=user_game.total_xp,
        current_level=user_game.current_level,
        daily_xp_today=user_game.daily_xp_today,
        current_streak=user_game.current_streak,
        longest_streak=user_game.longest_streak,
        level_name=current_level_name,
        next_level_xp=next_level_xp,
        achievements_count=achievements_count
    )

@app.get("/api/user/achievements", response_model=List[AchievementResponse])
async def get_user_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının rozetlerini getir"""
    
    # Kullanıcının kazandığı rozetler
    user_achievements = db.query(UserAchievement, Achievement).join(
        Achievement, UserAchievement.achievement_id == Achievement.id
    ).filter(
        UserAchievement.user_id == current_user.id
    ).all()
    
    result = []
    for user_achievement, achievement in user_achievements:
        result.append(AchievementResponse(
            id=achievement.id,
            name=achievement.name,
            description=achievement.description or "",
            icon=achievement.icon or "🏆",
            category=achievement.category or "general",
            earned_at=user_achievement.earned_at.isoformat()
        ))
    
    return result

@app.get("/api/user/profile/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcı profilini getir (kendi veya başkasının)"""
    
    # Profil sahibi kullanıcıyı bul
    profile_user = db.query(User).filter(User.id == user_id).first()
    if not profile_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Gamification verilerini getir
    user_game = db.query(UserGamification).filter(
        UserGamification.user_id == user_id
    ).first()
    
    if not user_game:
        # Eğer gamification verisi yoksa default oluştur
        user_game = UserGamification(user_id=user_id)
        db.add(user_game)
        db.commit()
    
    # Seviye isimlerini hesapla
    level_names = {1: "Beginner", 2: "Intermediate", 3: "Advanced", 4: "Expert"}
    level_xp_requirements = {1: 500, 2: 2000, 3: 5000, 4: 10000}
    
    current_level_name = level_names.get(user_game.current_level, "Master")
    next_level_xp = level_xp_requirements.get(user_game.current_level + 1, 0)
    
    # Achievement'ları getir
    user_achievements = db.query(UserAchievement, Achievement).join(
        Achievement, UserAchievement.achievement_id == Achievement.id
    ).filter(
        UserAchievement.user_id == user_id
    ).all()
    
    achievements = []
    for user_achievement, achievement in user_achievements:
        achievements.append(AchievementResponse(
            id=achievement.id,
            name=achievement.name,
            description=achievement.description or "",
            icon=achievement.icon or "🏆",
            category=achievement.category or "general",
            earned_at=user_achievement.earned_at.isoformat()
        ))
    
    # Roadmap istatistikleri
    total_roadmaps = db.query(Roadmap).filter(Roadmap.user_id == user_id).count()
    
    # Tamamlanan roadmap sayısı
    completed_roadmaps = 0
    roadmaps = db.query(Roadmap).filter(Roadmap.user_id == user_id).all()
    
    total_study_hours = 0
    for roadmap in roadmaps:
        steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap.id).all()
        completed_steps = sum(1 for step in steps if step.is_completed)
        total_steps = len(steps)
        
        if total_steps > 0 and completed_steps == total_steps:
            completed_roadmaps += 1
            
        # Çalışma saatleri hesapla
        for step in steps:
            if step.is_completed and step.estimated_hours:
                total_study_hours += step.estimated_hours
    
    # Gamification response oluştur
    gamification = GamificationResponse(
        total_xp=user_game.total_xp,
        current_level=user_game.current_level,
        daily_xp_today=user_game.daily_xp_today,
        current_streak=user_game.current_streak,
        longest_streak=user_game.longest_streak,
        level_name=current_level_name,
        next_level_xp=next_level_xp,
        achievements_count=len(achievements)
    )
    
    return UserProfileResponse(
        id=profile_user.id,
        name=profile_user.full_name or profile_user.username,
        email=profile_user.email if user_id == current_user.id else "",  # Sadece kendi email'ini görsün
        created_at=profile_user.created_at.isoformat(),
        subscription_type=profile_user.subscription_type or "free",
        gamification=gamification,
        achievements=achievements,
        total_roadmaps=total_roadmaps,
        completed_roadmaps=completed_roadmaps,
        total_study_hours=total_study_hours,
        is_own_profile=(user_id == current_user.id)
    )

@app.get("/api/user/profile", response_model=UserProfileResponse)
async def get_own_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kendi profilini getir"""
    return await get_user_profile(current_user.id, current_user, db)

# Daily task endpoint'i kaldırıldı

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 