from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
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
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/skillpath")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=True)
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

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours instead of 30 minutes

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
        print(f"Received token: {credentials.credentials[:50]}...")
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"JWT payload: {payload}")
        email: str = payload.get("sub")
        print(f"Email from token: {email}")
        if email is None:
            print("Email is None in token payload")
            raise credentials_exception
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise credentials_exception
    
    user = get_user_by_email(db, email=email)
    if user is None:
        print(f"User not found for email: {email}")
        raise credentials_exception
    print(f"User found: {user.email}")
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
                    latest_token_log = db.query(NotificationLog).filter(
                        NotificationLog.user_id == pref.user_id,
                        NotificationLog.notification_type == "push_token_registration",
                        NotificationLog.push_token.isnot(None)
                    ).order_by(NotificationLog.sent_at.desc()).first()
                    
                    if not latest_token_log:
                        print(f"No push token found for user {pref.user_id}")
                        continue
                    
                    push_token = latest_token_log.push_token
                    
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
        
        scheduler.start()
        print("Scheduler started successfully")
        
        # Uygulama kapanırken scheduler'ı durdur
        atexit.register(lambda: scheduler.shutdown())
        
    except Exception as e:
        print(f"Scheduler setup failed: {e}")

# Initialize database with sample data
@app.on_event("startup")
async def startup_event():
    """Initialize database"""
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
    db: Session = Depends(get_db)
):
    """Kullanıcının genel istatistiklerini getir"""
    try:
        # Test için user_id = 2 kullan
        user_id = 2
        
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
        
        # Streak hesaplama (şimdilik basit implementation)
        current_streak = 0  # TODO: Implement streak logic
        longest_streak = 0  # TODO: Implement streak logic
        
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
    db: Session = Depends(get_db)
):
    """Kullanıcının tüm roadmap'lerini getir"""
    try:
        # Test için user_id = 2 kullan
        user_id = 2
        
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
        db.commit()
        
        # Progress bilgilerini hesapla
        steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap_id).all()
        total_steps = len(steps)
        completed_steps = sum(1 for s in steps if s.is_completed)
        completion_percentage = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
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
        raise HTTPException(status_code=500, detail="Adım tamamlanamadı")

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
        # POST body'den değerleri al
        skill_name = request.skill_name
        target_weeks = request.target_weeks
        current_level = request.current_level
        daily_hours = request.daily_hours
        
        if not openai_client:
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
        
        # Veritabanına kaydet
        new_roadmap = Roadmap(
            user_id=current_user.id,
            skill_id=0,  # Dinamik skill için 0
            title=roadmap_data["title"],
            description=f"{skill_name} için kişiselleştirilmiş öğrenme yolu",
            total_weeks=target_weeks,
            difficulty_level=current_level,
            roadmap_data=json.dumps(roadmap_data),
            is_active=1
        )
        
        db.add(new_roadmap)
        db.commit()
        db.refresh(new_roadmap)
        
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
        
        return RoadmapResponse(
            success=True,
            roadmap_id=new_roadmap.id,
            roadmap=roadmap_data,
            message="Kişiselleştirilmiş roadmap başarıyla oluşturuldu!"
        )
            
    except Exception as e:
        print(f"Roadmap generation failed: {e}")
        raise HTTPException(status_code=500, detail="Roadmap oluşturulamadı")

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
    """Test push bildirimi gönder"""
    try:
        # Get user's push token
        push_token_record = db.execute(
            text("SELECT push_token FROM push_tokens WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1"),
            {"user_id": current_user.id}
        ).fetchone()
        
        if not push_token_record:
            return {"success": False, "message": "Push token bulunamadı"}
        
        push_token = push_token_record.push_token
        
        # Send test notification
        push_service = PushNotificationService()
        title = "Test Bildirimi 🧪"
        message = f"Merhaba {current_user.full_name or 'Kullanıcı'}! Bu bir test bildirimidir."
        
        result = push_service.send_push_notification(
            push_token=push_token,
            title=title,
            message=message,
            data={"type": "test", "user_id": current_user.id}
        )
        
        if result["success"]:
            # Log the notification
            NotificationService.log_notification(
                db=db,
                user_id=current_user.id,
                notification_type="test_push",
                title=title,
                message=message,
                push_token=push_token
            )
            db.commit()
            
            return {"success": True, "message": "Test bildirimi gönderildi"}
        else:
            return {"success": False, "message": f"Bildirim gönderilemedi: {result.get('error', 'Bilinmeyen hata')}"}
    
    except Exception as e:
        print(f"Test push notification error: {e}")
        return {"success": False, "message": f"Hata: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info") 