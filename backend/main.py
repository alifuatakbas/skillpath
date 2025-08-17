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
import requests
import asyncio
import threading
import time

# Load environment variables
load_dotenv()

# Expo Push API Configuration
EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"

# Global scheduler flag
notification_scheduler_running = False

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
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:LuFLwdfAtpfkyMMqyyPXKwRgDRWtDFpV@switchyard.proxy.rlwy.net:14684/railway")

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
    subscription_type = Column(String(20), default="free")  # free, premium, trial
    subscription_expires = Column(DateTime(timezone=True), nullable=True)
    trial_start_date = Column(DateTime(timezone=True), nullable=True)  # Trial başlangıç tarihi
    trial_end_date = Column(DateTime(timezone=True), nullable=True)  # Trial bitiş tarihi
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
    skill_name = Column(String(255), nullable=True)  # Skill adını sakla
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

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    instructor = Column(String(255))
    duration = Column(String(100))
    level = Column(String(50))
    price = Column(Float)
    image_url = Column(String(500))
    created_at = Column(DateTime, default=func.now())

# Community Tables
class CommunityPost(Base):
    __tablename__ = "community_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    title = Column(String(300), nullable=False)  # varchar(300)
    content = Column(Text, nullable=False)
    skill_name = Column(String(100), nullable=True)  # varchar(100)
    post_type = Column(String(20), nullable=True)  # varchar(20)
    likes_count = Column(Integer, nullable=True, default=0)  # likes_count
    replies_count = Column(Integer, nullable=True, default=0)  # replies_count
    views_count = Column(Integer, nullable=True, default=0)  # views_count
    is_expert_post = Column(Integer, nullable=True, default=0)  # int
    is_active = Column(Integer, nullable=True, default=1)  # int
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class CommunityComment(Base):
    __tablename__ = "community_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, nullable=False)
    user_id = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    parent_comment_id = Column(Integer, nullable=True)  # For nested replies
    likes = Column(Integer, default=0)
    is_accepted = Column(Integer, default=0)  # For accepted answers
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class PostLike(Base):
    __tablename__ = "post_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    post_id = Column(Integer, nullable=True)
    comment_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=func.now())

# Notification Models
class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True, nullable=False)
    daily_reminder_enabled = Column(Integer, default=1) # tinyint(1)
    daily_reminder_time = Column(String(5), nullable=False) # HH:MM
    step_completion_enabled = Column(Integer, default=1) # tinyint(1)
    streak_warning_enabled = Column(Integer, default=1) # tinyint(1)
    weekly_progress_enabled = Column(Integer, default=1) # tinyint(1)
    do_not_disturb_start = Column(String(5), nullable=False) # HH:MM
    do_not_disturb_end = Column(String(5), nullable=False) # HH:MM
    timezone = Column(String(50), nullable=False)
    device_timezone = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PushToken(Base):
    __tablename__ = "push_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True, nullable=False)
    push_token = Column(String(255), nullable=False)
    device_type = Column(String(50), nullable=False) # e.g., "android", "ios"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False) # e.g., "daily_reminder", "new_post", "comment_reply"
    sent_at = Column(DateTime(timezone=True), nullable=False)
    roadmap_title = Column(String(300), nullable=True)
    step_title = Column(String(300), nullable=True)
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

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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
class CourseResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    instructor: str
    duration: Optional[str] = None
    level: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: str  # Mobile app "name" bekliyor
    username: str
    email: str
    is_active: bool

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict  # Mobile app User interface ile uyumlu

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

# Community Models
class CommunityPostCreate(BaseModel):
    title: str
    content: str
    skill_name: Optional[str] = None
    post_type: Optional[str] = "question"  # question, discussion, tip

class CommunityPostResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    title: str
    content: str
    skill_name: Optional[str] = None
    post_type: Optional[str] = None
    likes_count: int = 0
    replies_count: int = 0  # comment_count yerine replies_count
    views_count: int = 0  # views_count eklendi
    is_expert_post: int = 0
    is_active: int = 1
    created_at: str
    updated_at: str

class CommunityCommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[int] = None

class CommunityCommentResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    user_name: str
    content: str
    parent_comment_id: Optional[int] = None
    likes: int
    is_accepted: bool
    created_at: str
    updated_at: str

class PostLikeRequest(BaseModel):
    post_id: Optional[int] = None
    comment_id: Optional[int] = None

# Notification Models
class NotificationPreferenceRequest(BaseModel):
    daily_reminder_enabled: bool
    daily_reminder_time: str
    step_completion_enabled: bool
    streak_warning_enabled: bool
    weekly_progress_enabled: bool
    do_not_disturb_start: str
    do_not_disturb_end: str
    timezone: str
    device_timezone: str

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
    timezone: str
    device_timezone: str

class PushTokenRequest(BaseModel):
    push_token: str
    device_type: str

class TrialStatusResponse(BaseModel):
    days_left: int
    expiry_date: Optional[str] = None
    is_active: bool

class PremiumPurchaseRequest(BaseModel):
    product_id: str
    transaction_id: Optional[str] = None
    receipt: Optional[str] = None
    platform: Optional[str] = None

class StartTrialRequest(BaseModel):
    product_id: str
    transaction_id: str
    receipt: str

class PremiumPurchaseResponse(BaseModel):
    success: bool
    message: str
    expires_at: Optional[str] = None

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
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user

# Initialize sample courses
def init_sample_courses(db: Session):
    """Örnek kursları veritabanına ekle"""
    if db.query(Course).count() == 0:
        sample_courses = [
            Course(
                title="React ile Modern Web Geliştirme",
                description="React, hooks ve modern JavaScript ile profesyonel web uygulamaları geliştirmeyi öğrenin.",
                instructor="Ahmet Yılmaz",
                duration="12 saat",
                level="Orta",
                price=299.99,
                image_url="https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400"
            ),
            Course(
                title="Python ile Veri Bilimi",
                description="Pandas, NumPy ve Matplotlib kullanarak veri analizi ve görselleştirme teknikleri.",
                instructor="Dr. Elif Kaya",
                duration="16 saat",
                level="Başlangıç",
                price=399.99,
                image_url="https://images.unsplash.com/photo-1526379879527-8559ecfcaec0?w=400"
            ),
            Course(
                title="UI/UX Tasarım Temelleri",
                description="Kullanıcı deneyimi ve arayüz tasarımı prensiplerini Figma ile uygulamalı öğrenin.",
                instructor="Zeynep Özkan",
                duration="10 saat",
                level="Başlangıç",
                price=249.99,
                image_url="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400"
            )
        ]
        
        for course in sample_courses:
            db.add(course)
        db.commit()



# Initialize database with sample data
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        init_sample_courses(db)
        print("✅ Örnek kurslar yüklendi")
        
        # Bildirim scheduler'ını başlat (eğer fonksiyon varsa)
        try:
            start_notification_scheduler()
            print("✅ Bildirim scheduler başlatıldı")
        except Exception as e:
            print(f"❌ Bildirim scheduler hatası: {e}")
        
    finally:
        db.close()

# API Endpoints
@app.get("/")
async def root():
    return {"message": "SkillPath API'sine Hoş Geldiniz!", "version": "1.0.0"}

@app.get("/support")
async def support():
    return {
        "app_name": "SkillPath",
        "version": "1.1.0",
        "support_email": "akbasalifuat@gmail.com",
        "website": "https://skillpath.com",
        "description": "SkillPath - Modern learning platform. Create roadmaps, work with Pomodoro technique and learn with the community.",
        "features": [
            "Personalized learning roadmaps",
            "Pomodoro timer",
            "Community support",
            "Progress tracking",
            "Premium features"
        ],
        "contact": {
            "email": "akbasalifuat@gmail.com",
            "response_time": "24 hours"
        }
    }

@app.get("/privacy")
async def privacy():
    return {
        "app_name": "SkillPath",
        "privacy_policy": "Last updated: December 2024",
        "data_collection": "We collect minimal data necessary for app functionality",
        "data_usage": "Data is used only for app features and user experience",
        "data_sharing": "We do not sell or share personal data with third parties",
        "user_rights": "Users can request data deletion at any time",
        "contact": {
            "email": "akbasalifuat@gmail.com",
            "purpose": "Privacy policy questions"
        },
        "full_policy": "This is a simplified privacy policy. For detailed information, contact us."
    }

@app.get("/api/courses", response_model=List[CourseResponse])
async def get_courses(db: Session = Depends(get_db)):
    """Tüm kursları getir"""
    courses = db.query(Course).all()
    return courses

@app.get("/api/courses/featured", response_model=List[CourseResponse])
async def get_featured_courses(db: Session = Depends(get_db)):
    """Öne çıkan kursları getir"""
    courses = db.query(Course).limit(3).all()
    return courses

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Mevcut kullanıcının profilini getir"""
    return UserResponse(
        id=current_user.id,
        name=current_user.full_name,
        username=current_user.username,
        email=current_user.email,
        is_active=bool(current_user.is_active)
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

@app.post("/api/courses/{course_id}/enroll")
async def enroll_course(course_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Kursa kayıt ol (Authentication gerekli)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Kurs bulunamadı")
    
    if course_id in current_user.enrolled_courses:
        raise HTTPException(status_code=400, detail="Bu kursa zaten kayıtlısınız")
    
    # Kullanıcının enrolled_courses listesini güncelle
    current_user.enrolled_courses.append(course_id)
    
    return {
        "success": True,
        "message": f"{course.title} kursuna başarıyla kaydoldunuz",
        "course_id": course_id,
        "user_id": current_user.id
    }

@app.get("/api/health")
async def health_check():
    """API sağlık kontrolü"""
    return {"status": "healthy", "service": "SkillPath API"}

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
            
            Detaylı bir öğrenme yol haritası oluştur. Her adım için:
            - Başlık
            - Açıklama
            - Tahmini süre (hafta)
            - Önerilen kaynaklar
            - Yapılacak projeler
            
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
                estimated_hours=step_data["estimated_hours"],
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
        print(f"Getting roadmap {roadmap_id} for user {current_user.id}")
        
        # Roadmap'i kullanıcıya ait olup olmadığını kontrol et
        roadmap = db.query(Roadmap).filter(
            Roadmap.id == roadmap_id,
            Roadmap.user_id == current_user.id
        ).first()
        
        print(f"Roadmap found: {roadmap is not None}")
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap bulunamadı")
        
        # Roadmap adımlarını getir
        steps = db.query(RoadmapStep).filter(
            RoadmapStep.roadmap_id == roadmap_id
        ).order_by(RoadmapStep.step_order).all()
        
        # Response formatını düzenle
        steps_data = []
        for step in steps:
            step_resources = json.loads(step.resources) if step.resources else []
            step_prerequisites = json.loads(step.prerequisites) if step.prerequisites else []
            
            steps_data.append({
                "id": step.id,
                "step_order": step.step_order,
                "title": step.title,
                "description": step.description,
                "estimated_hours": step.estimated_hours or 0,
                "resources": step_resources,
                "projects": step_prerequisites,  # Prerequisites'ı projeler olarak kullan
                "is_completed": bool(step.is_completed)
            })
        
        return {
            "roadmap": {
                "id": roadmap.id,
                "title": roadmap.title,
                "description": roadmap.description or "",
                "total_weeks": roadmap.total_weeks or 12,
                "difficulty_level": roadmap.difficulty_level or "beginner",
                "steps": steps_data,
                "created_at": roadmap.created_at.isoformat() if roadmap.created_at else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get roadmap failed: {e}")
        raise HTTPException(status_code=500, detail="Roadmap getirilemedi")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

# Dashboard & Analytics Endpoints
@app.get("/api/user/dashboard")
async def get_dashboard_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Kullanıcının dashboard istatistiklerini döndür"""
    try:
        user_id = current_user.id  # .id kullan
        
        # Kullanıcının roadmap sayısı
        total_roadmaps = db.query(Roadmap).filter(Roadmap.user_id == user_id).count()
        
        # Aktif roadmap sayısı (en az 1 step tamamlanmamış)
        active_roadmaps = db.query(Roadmap).filter(
            Roadmap.user_id == user_id
        ).count()  # Basit yaklaşım: tüm roadmap'ler aktif
        
        # Tamamlanan roadmap sayısı (tüm step'leri tamamlanmış)
        completed_roadmaps = 0  # Şimdilik 0, karmaşık sorgu gerekiyor
        
        # Toplam step sayısı
        total_steps = db.query(RoadmapStep).join(Roadmap, RoadmapStep.roadmap_id == Roadmap.id).filter(
            Roadmap.user_id == user_id
        ).count()
        
        # Tamamlanan step sayısı
        completed_steps = db.query(UserProgress).filter(
            UserProgress.user_id == user_id,
            UserProgress.status == "completed"
        ).count()
        
        # Tamamlanma yüzdesi
        completion_percentage = int((completed_steps / max(total_steps, 1)) * 100) if total_steps > 0 else 0
        
        # Öğrenme saatleri (basit hesaplama)
        total_learning_hours = completed_steps * 2  # Her step 2 saat varsayımı
        
        # Streak hesaplama (şimdilik basit)
        current_streak = 5  # Mock data
        longest_streak = 12  # Mock data
        
        return {
            "total_roadmaps": total_roadmaps,
            "active_roadmaps": active_roadmaps,
            "completed_roadmaps": completed_roadmaps,
            "total_steps": total_steps,
            "completed_steps": completed_steps,
            "completion_percentage": completion_percentage,
            "total_learning_hours": total_learning_hours,
            "current_streak": current_streak,
            "longest_streak": longest_streak
        }
        
    except Exception as e:
        print(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=f"Dashboard error: {str(e)}")

@app.get("/api/user/roadmaps")
async def get_user_roadmaps(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Kullanıcının roadmap'lerini döndür"""
    try:
        user_id = current_user.id  # .id kullan
        
        print(f"Getting roadmaps for user_id: {user_id}")
        # Get roadmaps without join first
        roadmaps = db.query(Roadmap).filter(Roadmap.user_id == user_id).all()
        print(f"Found {len(roadmaps)} roadmaps for user {user_id}")
        
        result = []
        
        for roadmap in roadmaps:
            # Try to get skill name from Skill table
            skill_name = None
            try:
                skill = db.query(Skill).filter(Skill.id == roadmap.skill_id).first()
                skill_name = skill.name if skill else None
                print(f"Roadmap {roadmap.id}: skill_id={roadmap.skill_id}, skill_name={skill_name}")
            except Exception as e:
                print(f"Error getting skill name for roadmap {roadmap.id}: {e}")
                skill_name = None
            # Bu roadmap'in step'lerini say
            total_steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap.id).count()
            
            # Tamamlanan step'leri say
            completed_steps = db.query(UserProgress).filter(
                UserProgress.user_id == user_id,
                UserProgress.roadmap_id == roadmap.id,
                UserProgress.status == "completed"
            ).count()
            
            progress = (completed_steps / max(total_steps, 1)) * 100 if total_steps > 0 else 0
            
            result.append({
                "id": roadmap.id,
                "title": roadmap.title,
                "description": roadmap.description or "",
                "skill_name": skill_name,
                "total_weeks": roadmap.total_weeks or 12,
                "difficulty_level": roadmap.difficulty_level or "beginner",
                "total_steps": total_steps,
                "completed_steps": completed_steps,
                "completion_percentage": int(progress),
                "created_at": roadmap.created_at.isoformat() if roadmap.created_at else None,
                "last_activity": roadmap.updated_at.isoformat() if roadmap.updated_at else None
            })
            
        return result
        
    except Exception as e:
        print(f"User roadmaps error: {e}")
        raise HTTPException(status_code=500, detail=f"User roadmaps error: {str(e)}")

@app.get("/api/roadmap/{roadmap_id}/progress")
async def get_roadmap_progress(
    roadmap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Roadmap'in detaylı progress bilgilerini döndür"""
    try:
        user_id = current_user.id
        
        # Roadmap'i kullanıcıya ait olup olmadığını kontrol et
        roadmap = db.query(Roadmap).filter(
            Roadmap.id == roadmap_id,
            Roadmap.user_id == user_id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap bulunamadı")
        
        # Roadmap step'lerini getir
        steps = db.query(RoadmapStep).filter(
            RoadmapStep.roadmap_id == roadmap_id
        ).order_by(RoadmapStep.step_order).all()
        
        # Her step için progress bilgisini getir
        steps_progress = []
        completed_steps = 0
        next_step = None
        
        for i, step in enumerate(steps):
            # UserProgress tablosundan step durumunu kontrol et
            progress = db.query(UserProgress).filter(
                UserProgress.user_id == user_id,
                UserProgress.roadmap_id == roadmap_id,
                UserProgress.step_id == step.id
            ).first()
            
            is_completed = progress and progress.status == "completed"
            if is_completed:
                completed_steps += 1
            elif next_step is None:
                next_step = {
                    "step_id": step.id,
                    "title": step.title
                }
            
            # Resources ve projects'ı parse et
            resources = json.loads(step.resources) if step.resources else []
            projects = json.loads(step.prerequisites) if step.prerequisites else []
            
            steps_progress.append({
                "step_id": step.id,
                "step_order": step.step_order,
                "title": step.title,
                "description": step.description or "",
                "estimated_hours": step.estimated_hours or 0,
                "is_completed": is_completed,
                "completed_at": progress.completed_at.isoformat() if progress and progress.completed_at else None,
                "resources": resources,
                "projects": projects
            })
        
        total_steps = len(steps)
        completion_percentage = (completed_steps / max(total_steps, 1)) * 100 if total_steps > 0 else 0
        
        return {
            "roadmap_id": roadmap.id,
            "title": roadmap.title,
            "total_steps": total_steps,
            "completed_steps": completed_steps,
            "completion_percentage": int(completion_percentage),
            "steps": steps_progress,
            "next_step": next_step
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Roadmap progress error: {e}")
        raise HTTPException(status_code=500, detail=f"Roadmap progress error: {str(e)}")

@app.put("/api/roadmap/{roadmap_id}/step/{step_id}/complete")
async def complete_step(
    roadmap_id: int,
    step_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Step'i tamamlandı olarak işaretle"""
    try:
        user_id = current_user.id
        
        # Roadmap'in kullanıcıya ait olduğunu kontrol et
        roadmap = db.query(Roadmap).filter(
            Roadmap.id == roadmap_id,
            Roadmap.user_id == user_id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap bulunamadı")
        
        # Step'in roadmap'e ait olduğunu kontrol et
        step = db.query(RoadmapStep).filter(
            RoadmapStep.id == step_id,
            RoadmapStep.roadmap_id == roadmap_id
        ).first()
        
        if not step:
            raise HTTPException(status_code=404, detail="Step bulunamadı")
        
        # UserProgress kaydını güncelle veya oluştur
        progress = db.query(UserProgress).filter(
            UserProgress.user_id == user_id,
            UserProgress.roadmap_id == roadmap_id,
            UserProgress.step_id == step_id
        ).first()
        
        if progress:
            progress.status = "completed"
            progress.completion_percentage = 100
            progress.completed_at = datetime.now()
        else:
            progress = UserProgress(
                user_id=user_id,
                roadmap_id=roadmap_id,
                step_id=step_id,
                status="completed",
                completion_percentage=100,
                completed_at=datetime.now()
            )
            db.add(progress)
        
        db.commit()
        
        # Step completion bildirimi gönder
        try:
            # Kullanıcının bildirim tercihlerini kontrol et
            prefs = db.query(NotificationPreference).filter(
                NotificationPreference.user_id == user_id
            ).first()
            
            if prefs and prefs.step_completion_enabled:
                # Bildirim kaydı oluştur
                notification = Notification(
                    user_id=user_id,
                    title="🎉 Adım Tamamlandı!",
                    message=f"'{step.title}' adımını başarıyla tamamladınız!",
                    notification_type="step_completion",
                    roadmap_title=roadmap.title,
                    step_title=step.title,
                    sent_at=datetime.now()
                )
                db.add(notification)
                db.commit()
                
                # Push notification gönder
                await send_push_notification(
                    user_id, 
                    "🎉 Adım Tamamlandı!", 
                    f"'{step.title}' adımını başarıyla tamamladınız!",
                    db
                )
        except Exception as e:
            print(f"Step completion notification error: {e}")
        
        # Güncel progress bilgilerini hesapla
        total_steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap_id).count()
        completed_steps = db.query(UserProgress).filter(
            UserProgress.user_id == user_id,
            UserProgress.roadmap_id == roadmap_id,
            UserProgress.status == "completed"
        ).count()
        
        completion_percentage = (completed_steps / max(total_steps, 1)) * 100 if total_steps > 0 else 0
        
        return {
            "success": True,
            "message": "Step başarıyla tamamlandı",
            "step_id": step_id,
            "completed_steps": completed_steps,
            "total_steps": total_steps,
            "completion_percentage": int(completion_percentage)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Complete step error: {e}")
        raise HTTPException(status_code=500, detail=f"Complete step error: {str(e)}")

@app.put("/api/roadmap/{roadmap_id}/step/{step_id}/uncomplete")
async def uncomplete_step(
    roadmap_id: int,
    step_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Step'i tamamlanmamış olarak işaretle"""
    try:
        user_id = current_user.id
        
        # Roadmap'in kullanıcıya ait olduğunu kontrol et
        roadmap = db.query(Roadmap).filter(
            Roadmap.id == roadmap_id,
            Roadmap.user_id == user_id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap bulunamadı")
        
        # Step'in roadmap'e ait olduğunu kontrol et
        step = db.query(RoadmapStep).filter(
            RoadmapStep.id == step_id,
            RoadmapStep.roadmap_id == roadmap_id
        ).first()
        
        if not step:
            raise HTTPException(status_code=404, detail="Step bulunamadı")
        
        # UserProgress kaydını güncelle
        progress = db.query(UserProgress).filter(
            UserProgress.user_id == user_id,
            UserProgress.roadmap_id == roadmap_id,
            UserProgress.step_id == step_id
        ).first()
        
        if progress:
            progress.status = "not_started"
            progress.completion_percentage = 0
            progress.completed_at = None
            db.commit()
        
        # Güncel progress bilgilerini hesapla
        total_steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap_id).count()
        completed_steps = db.query(UserProgress).filter(
            UserProgress.user_id == user_id,
            UserProgress.roadmap_id == roadmap_id,
            UserProgress.status == "completed"
        ).count()
        
        completion_percentage = (completed_steps / max(total_steps, 1)) * 100 if total_steps > 0 else 0
        
        return {
            "success": True,
            "message": "Step tamamlanmamış olarak işaretlendi",
            "step_id": step_id,
            "completed_steps": completed_steps,
            "total_steps": total_steps,
            "completion_percentage": int(completion_percentage)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Uncomplete step error: {e}")
        raise HTTPException(status_code=500, detail=f"Uncomplete step error: {str(e)}")

@app.get("/api/community/stats")
async def get_community_stats(db: Session = Depends(get_db)):
    """Topluluk istatistiklerini döndür"""
    try:
        # Toplam kullanıcı sayısı
        total_members = db.query(User).count()
        
        # Bugün aktif olan kullanıcılar (bugün progress kaydı olanlar)
        from datetime import datetime
        today = datetime.now().date()
        active_today = db.query(UserProgress).filter(
            func.date(UserProgress.updated_at) == today
        ).distinct(UserProgress.user_id).count()
        
        # Toplam roadmap sayısı
        total_roadmaps = db.query(Roadmap).count()
        
        # En popüler skill'ler - Roadmap title'larından çek
        popular_roadmaps = db.query(
            Roadmap.title,
            func.count(Roadmap.id).label('count')
        ).group_by(Roadmap.title).order_by(
            func.count(Roadmap.id).desc()
        ).limit(5).all()
        
        top_skills = [
            {"name": roadmap.title.split()[0], "learners": roadmap.count}
            for roadmap in popular_roadmaps
        ]
        
        return {
            "totalMembers": total_members,
            "activeToday": active_today,
            "totalRoadmaps": total_roadmaps,
            "topSkills": top_skills
        }
        
    except Exception as e:
        print(f"Community stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Community stats error: {str(e)}")

@app.get("/api/community/members")
async def get_community_members(db: Session = Depends(get_db)):
    """Aktif topluluk üyelerini döndür"""
    try:
        # En aktif kullanıcıları getir (en çok tamamlanan step'e sahip olanlar)
        members = db.query(
            User.id,
            User.full_name,
            User.email,
            func.count(UserProgress.id).label('completed_steps')
        ).join(UserProgress, User.id == UserProgress.user_id, isouter=True).group_by(
            User.id
        ).order_by(
            func.count(UserProgress.id).desc()
        ).limit(10).all()
        
        result = []
        for member in members:
            # Level belirleme
            completed = member.completed_steps or 0
            if completed >= 50:
                level = "Advanced"
            elif completed >= 20:
                level = "Intermediate"
            else:
                level = "Beginner"
                
            result.append({
                "id": member.id,
                "name": member.full_name,
                "level": level,
                "points": completed * 10  # Her step 10 puan
            })
            
        return {"members": result}
        
    except Exception as e:
        print(f"Community members error: {e}")
        raise HTTPException(status_code=500, detail=f"Community members error: {str(e)}")

# Community Posts API
@app.get("/api/community/posts", response_model=List[CommunityPostResponse])
async def get_community_posts(
    limit: int = 20,
    offset: int = 0,
    post_type: Optional[str] = None,
    filter_type: Optional[str] = "latest",  # latest, popular, trending, my_topics, my_questions
    skill_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get community posts with pagination and filtering"""
    try:
        # Join posts with users to get user names
        query = db.query(CommunityPost, User.full_name.label('user_name')).join(
            User, CommunityPost.user_id == User.id
        ).filter(CommunityPost.is_active == 1)
        
        # Filter by post type if provided
        if post_type and post_type != 'all':
            query = query.filter(CommunityPost.post_type == post_type)
        
        # Filter by skill name if provided
        if skill_name:
            print(f"Filtering posts by skill_name: {skill_name}")
            query = query.filter(CommunityPost.skill_name == skill_name)
        
        # Apply filtering and sorting based on filter type
        if filter_type == "my_topics":
            # Get user's active roadmap skills
            user_roadmaps = db.query(Roadmap).filter(
                Roadmap.user_id == current_user.id,
                Roadmap.is_active == 1
            ).all()
            
            if user_roadmaps:
                # Extract skill names from roadmap titles (first word)
                skill_names = []
                for roadmap in user_roadmaps:
                    if roadmap.title:
                        skill_name = roadmap.title.split()[0] if roadmap.title.split() else ""
                        if skill_name:
                            skill_names.append(skill_name)
                
                if skill_names:
                    # Filter posts that match user's skills
                    query = query.filter(CommunityPost.skill_name.in_(skill_names))
                else:
                    # If no skill names found, return empty result
                    return []
            else:
                # If no roadmaps found, return empty result
                return []
            
            query = query.order_by(CommunityPost.created_at.desc())
            
        elif filter_type == "my_questions":
            # Show only posts created by current user
            query = query.filter(CommunityPost.user_id == current_user.id)
            query = query.order_by(CommunityPost.created_at.desc())
            
        elif filter_type == "popular":
            # Sort by creation date (descending) - en yeni gönderiler
            query = query.order_by(CommunityPost.created_at.desc())
        elif filter_type == "trending":
            # Sort by replies count (descending) - en çok yorum alan gönderiler
            # MySQL'de nullslast() desteklenmiyor, COALESCE kullanıyoruz
            from sqlalchemy import func
            query = query.order_by(func.coalesce(CommunityPost.replies_count, 0).desc(), CommunityPost.created_at.desc())
        else:
            # Default: latest posts
            query = query.order_by(CommunityPost.created_at.desc())
            
        posts = query.offset(offset).limit(limit).all()
        
        result = []
        for post, user_name in posts:
            # Increment view count for each post viewed
            post.views_count = (post.views_count or 0) + 1
            
            result.append(CommunityPostResponse(
                id=post.id,
                user_id=post.user_id,
                user_name=user_name,
                title=post.title,
                content=post.content,
                skill_name=post.skill_name,
                post_type=post.post_type,
                likes_count=post.likes_count or 0,
                replies_count=post.replies_count or 0,
                views_count=post.views_count or 0,
                is_expert_post=post.is_expert_post or 0,
                is_active=post.is_active or 1,
                created_at=post.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                updated_at=post.updated_at.strftime("%Y-%m-%d %H:%M:%S")
            ))
        
        # Commit view count updates
        db.commit()
            
        return result
        
    except Exception as e:
        print(f"Community posts error: {e}")
        raise HTTPException(status_code=500, detail=f"Posts error: {str(e)}")

@app.post("/api/community/posts", response_model=CommunityPostResponse)
async def create_community_post(
    post_data: CommunityPostCreate,
    current_user: User = Depends(get_current_user),  # dict -> User
    db: Session = Depends(get_db)
):
    """Create a new community post"""
    try:
        user_id = current_user.id  # .id kullan
        
        # Create new post
        new_post = CommunityPost(
            user_id=user_id,
            title=post_data.title,
            content=post_data.content,
            skill_name=post_data.skill_name,
            post_type=post_data.post_type or "question",
            likes_count=0,
            replies_count=0,
            is_expert_post=0,
            is_active=1
        )
        
        db.add(new_post)
        db.commit()
        db.refresh(new_post)
        
        return CommunityPostResponse(
            id=new_post.id,
            user_id=new_post.user_id,
            user_name=current_user.full_name,  # current_user.full_name kullan
            title=new_post.title,
            content=new_post.content,
            skill_name=new_post.skill_name,
            post_type=new_post.post_type,
            likes_count=new_post.likes_count or 0,
            replies_count=new_post.replies_count or 0,
            is_expert_post=new_post.is_expert_post or 0,
            is_active=new_post.is_active or 1,
            created_at=new_post.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=new_post.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        )
        
    except Exception as e:
        print(f"Create post error: {e}")
        raise HTTPException(status_code=500, detail=f"Create post error: {str(e)}")

@app.get("/api/community/posts/{post_id}/comments", response_model=List[CommunityCommentResponse])
async def get_post_comments(post_id: int, db: Session = Depends(get_db)):
    """Bir gönderinin yorumlarını getir"""
    try:
        comments = db.query(CommunityComment, User.full_name.label('user_name')).join(
            User, CommunityComment.user_id == User.id
        ).filter(
            CommunityComment.post_id == post_id
        ).order_by(CommunityComment.created_at.asc()).all()
        
        result = []
        for comment, user_name in comments:
            result.append(CommunityCommentResponse(
                id=comment.id,
                post_id=comment.post_id,
                user_id=comment.user_id,
                user_name=user_name,
                content=comment.content,
                parent_comment_id=comment.parent_comment_id,
                likes=comment.likes,
                is_accepted=bool(comment.is_accepted),
                created_at=comment.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                updated_at=comment.updated_at.strftime("%Y-%m-%d %H:%M:%S")
            ))
            
        return result
        
    except Exception as e:
        print(f"Get comments error: {e}")
        raise HTTPException(status_code=500, detail=f"Comments error: {str(e)}")

@app.post("/api/community/posts/{post_id}/comments", response_model=CommunityCommentResponse)
async def create_comment(
    post_id: int,
    comment_data: CommunityCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Gönderiye yorum ekle"""
    try:
        user_id = current_user.id
        
        # Check if post exists
        post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        new_comment = CommunityComment(
            post_id=post_id,
            user_id=user_id,
            content=comment_data.content,
            parent_comment_id=comment_data.parent_comment_id
        )
        
        db.add(new_comment)
        
        # Increase replies count
        post.replies_count = (post.replies_count or 0) + 1
        
        db.commit()
        db.refresh(new_comment)
        
        return CommunityCommentResponse(
            id=new_comment.id,
            post_id=new_comment.post_id,
            user_id=new_comment.user_id,
            user_name=current_user.full_name,
            content=new_comment.content,
            parent_comment_id=new_comment.parent_comment_id,
            likes=new_comment.likes,
            is_accepted=bool(new_comment.is_accepted),
            created_at=new_comment.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            updated_at=new_comment.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        )
        
    except Exception as e:
        print(f"Create comment error: {e}")
        raise HTTPException(status_code=500, detail=f"Create comment error: {str(e)}")

@app.post("/api/community/posts/{post_id}/like")
async def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Like/unlike a community post"""
    try:
        user_id = current_user.id
        
        # Check if post exists
        post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Check if user already liked this post
        existing_like = db.query(PostLike).filter(
            PostLike.user_id == user_id,
            PostLike.post_id == post_id
        ).first()
        
        if existing_like:
            # Unlike - remove the like
            db.delete(existing_like)
            liked = False
            # Decrease likes count
            post.likes_count = max(0, (post.likes_count or 0) - 1)
        else:
            # Like - add new like
            new_like = PostLike(user_id=user_id, post_id=post_id)
            db.add(new_like)
            liked = True
            # Increase likes count
            post.likes_count = (post.likes_count or 0) + 1
        
        db.commit()
        
        return {
            "liked": liked,
            "total_likes": post.likes_count or 0
        }
        
    except Exception as e:
        print(f"Like post error: {e}")
        raise HTTPException(status_code=500, detail=f"Like error: {str(e)}") 

# Notification API
@app.post("/api/notifications/preferences", response_model=NotificationPreferenceResponse)
async def update_notification_preferences(
    preferences: NotificationPreferenceRequest,
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
            # Mevcut tercihleri güncelle
            existing_prefs.daily_reminder_enabled = preferences.daily_reminder_enabled
            existing_prefs.daily_reminder_time = preferences.daily_reminder_time
            existing_prefs.step_completion_enabled = preferences.step_completion_enabled
            existing_prefs.streak_warning_enabled = preferences.streak_warning_enabled
            existing_prefs.weekly_progress_enabled = preferences.weekly_progress_enabled
            existing_prefs.do_not_disturb_start = preferences.do_not_disturb_start
            existing_prefs.do_not_disturb_end = preferences.do_not_disturb_end
            existing_prefs.timezone = preferences.timezone
            existing_prefs.device_timezone = preferences.device_timezone
            existing_prefs.updated_at = datetime.now()
        else:
            # Yeni tercihler oluştur
            new_prefs = NotificationPreference(
                user_id=current_user.id,
                daily_reminder_enabled=preferences.daily_reminder_enabled,
                daily_reminder_time=preferences.daily_reminder_time,
                step_completion_enabled=preferences.step_completion_enabled,
                streak_warning_enabled=preferences.streak_warning_enabled,
                weekly_progress_enabled=preferences.weekly_progress_enabled,
                do_not_disturb_start=preferences.do_not_disturb_start,
                do_not_disturb_end=preferences.do_not_disturb_end,
                timezone=preferences.timezone,
                device_timezone=preferences.device_timezone
            )
            db.add(new_prefs)
        
        db.commit()
        
        # Güncel tercihleri döndür
        updated_prefs = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == current_user.id
        ).first()
        
        return NotificationPreferenceResponse(
            id=updated_prefs.id,
            user_id=updated_prefs.user_id,
            daily_reminder_enabled=updated_prefs.daily_reminder_enabled,
            daily_reminder_time=updated_prefs.daily_reminder_time,
            step_completion_enabled=updated_prefs.step_completion_enabled,
            streak_warning_enabled=updated_prefs.streak_warning_enabled,
            weekly_progress_enabled=updated_prefs.weekly_progress_enabled,
            do_not_disturb_start=updated_prefs.do_not_disturb_start,
            do_not_disturb_end=updated_prefs.do_not_disturb_end,
            timezone=updated_prefs.timezone,
            device_timezone=updated_prefs.device_timezone
        )
        
    except Exception as e:
        print(f"Update notification preferences error: {e}")
        raise HTTPException(status_code=500, detail=f"Notification preferences error: {str(e)}")

@app.get("/api/notifications/preferences", response_model=NotificationPreferenceResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının bildirim tercihlerini getir"""
    try:
        prefs = db.query(NotificationPreference).filter(
            NotificationPreference.user_id == current_user.id
        ).first()
        
        if not prefs:
            # Varsayılan tercihler oluştur
            prefs = NotificationPreference(
                user_id=current_user.id,
                daily_reminder_enabled=True,
                daily_reminder_time="09:00",
                step_completion_enabled=True,
                streak_warning_enabled=True,
                weekly_progress_enabled=True,
                do_not_disturb_start="22:00",
                do_not_disturb_end="08:00",
                timezone="Europe/Istanbul",
                device_timezone="Europe/Istanbul"
            )
            db.add(prefs)
            db.commit()
        
        return NotificationPreferenceResponse(
            id=prefs.id,
            user_id=prefs.user_id,
            daily_reminder_enabled=prefs.daily_reminder_enabled,
            daily_reminder_time=prefs.daily_reminder_time,
            step_completion_enabled=prefs.step_completion_enabled,
            streak_warning_enabled=prefs.streak_warning_enabled,
            weekly_progress_enabled=prefs.weekly_progress_enabled,
            do_not_disturb_start=prefs.do_not_disturb_start,
            do_not_disturb_end=prefs.do_not_disturb_end,
            timezone=prefs.timezone,
            device_timezone=prefs.device_timezone
        )
        
    except Exception as e:
        print(f"Get notification preferences error: {e}")
        raise HTTPException(status_code=500, detail=f"Get notification preferences error: {str(e)}")

@app.get("/api/notifications/daily-reminder")
async def get_daily_reminder(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Günlük motivasyonel hatırlatma oluştur"""
    try:
        # Kullanıcının aktif roadmap'lerini getir
        active_roadmaps = db.query(Roadmap).filter(
            Roadmap.user_id == current_user.id,
            Roadmap.is_active == 1
        ).all()
        
        if not active_roadmaps:
            return {
                "success": True,
                "message": "Günlük hatırlatma oluşturulamadı - aktif roadmap yok",
                "reminder_data": {
                    "title": "Yeni Bir Yolculuk Başlatın! 🚀",
                    "message": "Henüz bir öğrenme yolculuğuna başlamadınız. Bugün yeni bir skill öğrenmeye başlayın!"
                }
            }
        
        # En aktif roadmap'i seç
        roadmap = active_roadmaps[0]
        
        # Tamamlanan ve toplam step sayısını hesapla
        total_steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap.id).count()
        completed_steps = db.query(UserProgress).filter(
            UserProgress.user_id == current_user.id,
            UserProgress.roadmap_id == roadmap.id,
            UserProgress.status == "completed"
        ).count()
        
        # Motivasyonel mesajlar
        motivational_messages = [
            f"🎯 Bugün {roadmap.title} yolculuğunuzda bir adım daha atın!",
            f"💪 {roadmap.title} konusunda {completed_steps}/{total_steps} adımı tamamladınız. Devam edin!",
            f"🌟 {roadmap.title} öğrenme yolculuğunuzda harika ilerliyorsunuz!",
            f"🚀 {roadmap.title} hedefinize bir adım daha yaklaşın!",
            f"✨ Bugün {roadmap.title} konusunda yeni bir şey öğrenin!",
            f"🔥 {roadmap.title} yolculuğunuzda tutkunuzu koruyun!",
            f"📚 {roadmap.title} konusunda bilginizi genişletin!",
            f"🎉 {roadmap.title} öğrenme serüveninizde başarılarınızı kutlayın!"
        ]
        
        import random
        selected_message = random.choice(motivational_messages)
        
        # Progress yüzdesi
        progress_percentage = (completed_steps / max(total_steps, 1)) * 100
        
        # Progress durumuna göre ek mesaj
        if progress_percentage >= 80:
            additional_message = "🎊 Neredeyse tamamladınız! Son düzlükte devam edin!"
        elif progress_percentage >= 50:
            additional_message = "🎯 Yarı yoldasınız! Bu harika bir başarı!"
        elif progress_percentage >= 25:
            additional_message = "🌟 Güzel bir başlangıç yaptınız! Devam edin!"
        else:
            additional_message = "🚀 Yeni başladınız! Her gün bir adım atın!"
        
        return {
            "success": True,
            "message": "Günlük hatırlatma oluşturuldu",
            "reminder_data": {
                "title": f"Günlük Öğrenme Hatırlatması 📚",
                "message": f"{selected_message}\n\n{additional_message}\n\nİlerleme: %{int(progress_percentage)}",
                "roadmap_title": roadmap.title,
                "progress_percentage": int(progress_percentage)
            }
        }
        
    except Exception as e:
        print(f"Daily reminder error: {e}")
        raise HTTPException(status_code=500, detail=f"Daily reminder error: {str(e)}")

@app.post("/api/notifications/push-token")
async def register_push_token(
    request: PushTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Push notification token'ını kaydet"""
    try:
        # Mevcut token'ı kontrol et
        existing_token = db.query(PushToken).filter(
            PushToken.user_id == current_user.id,
            PushToken.device_type == request.device_type
        ).first()
        
        if existing_token:
            # Token'ı güncelle
            existing_token.push_token = request.push_token
            existing_token.updated_at = datetime.now()
        else:
            # Yeni token oluştur
            new_token = PushToken(
                user_id=current_user.id,
                push_token=request.push_token,
                device_type=request.device_type
            )
            db.add(new_token)
        
        db.commit()
        
        return {"success": True, "message": "Push token başarıyla kaydedildi"}
        
    except Exception as e:
        print(f"Register push token error: {e}")
        raise HTTPException(status_code=500, detail=f"Register push token error: {str(e)}")

@app.get("/api/notifications/history")
async def get_notification_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Kullanıcının bildirim geçmişini getir"""
    try:
        notifications = db.query(Notification).filter(
            Notification.user_id == current_user.id
        ).order_by(Notification.sent_at.desc()).limit(limit).all()
        
        result = []
        for notification in notifications:
            result.append(NotificationResponse(
                id=notification.id,
                title=notification.title,
                message=notification.message,
                notification_type=notification.notification_type,
                sent_at=notification.sent_at.isoformat(),
                roadmap_title=notification.roadmap_title,
                step_title=notification.step_title
            ))
        
        return result
        
    except Exception as e:
        print(f"Get notification history error: {e}")
        raise HTTPException(status_code=500, detail=f"Get notification history error: {str(e)}")

@app.post("/api/notifications/send-daily")
async def send_daily_notifications(
    db: Session = Depends(get_db)
):
    """Günlük bildirimleri gönder (cron job için)"""
    try:
        # Günlük hatırlatma aktif olan kullanıcıları getir
        users_with_reminders = db.query(User, NotificationPreference).join(
            NotificationPreference, User.id == NotificationPreference.user_id
        ).filter(
            NotificationPreference.daily_reminder_enabled == True
        ).all()
        
        sent_count = 0
        
        for user, prefs in users_with_reminders:
            try:
                # Günlük hatırlatma oluştur
                reminder_response = await get_daily_reminder_internal(user, db)
                
                if reminder_response["success"]:
                    # Bildirim kaydı oluştur
                    notification = Notification(
                        user_id=user.id,
                        title=reminder_response["reminder_data"]["title"],
                        message=reminder_response["reminder_data"]["message"],
                        notification_type="daily_reminder",
                        roadmap_title=reminder_response["reminder_data"].get("roadmap_title"),
                        sent_at=datetime.now()
                    )
                    db.add(notification)
                    
                    # Push notification gönder (gerçek implementasyon için Expo Push API kullanılabilir)
                    await send_push_notification(user.id, reminder_response["reminder_data"]["title"], reminder_response["reminder_data"]["message"], db)
                    
                    sent_count += 1
                    
            except Exception as e:
                print(f"Error sending daily reminder to user {user.id}: {e}")
                continue
        
        db.commit()
        
        return {
            "success": True,
            "message": f"{sent_count} günlük bildirim gönderildi",
            "sent_count": sent_count
        }
        
    except Exception as e:
        print(f"Send daily notifications error: {e}")
        raise HTTPException(status_code=500, detail=f"Send daily notifications error: {str(e)}")

async def get_daily_reminder_internal(user: User, db: Session):
    """Günlük hatırlatma oluştur (internal kullanım için)"""
    # Kullanıcının aktif roadmap'lerini getir
    active_roadmaps = db.query(Roadmap).filter(
        Roadmap.user_id == user.id,
        Roadmap.is_active == 1
    ).all()
    
    if not active_roadmaps:
        return {
            "success": True,
            "message": "Günlük hatırlatma oluşturulamadı - aktif roadmap yok",
            "reminder_data": {
                "title": "Yeni Bir Yolculuk Başlatın! 🚀",
                "message": "Henüz bir öğrenme yolculuğuna başlamadınız. Bugün yeni bir skill öğrenmeye başlayın!"
            }
        }
    
    # En aktif roadmap'i seç
    roadmap = active_roadmaps[0]
    
    # Tamamlanan ve toplam step sayısını hesapla
    total_steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap.id).count()
    completed_steps = db.query(UserProgress).filter(
        UserProgress.user_id == user.id,
        UserProgress.roadmap_id == roadmap.id,
        UserProgress.status == "completed"
    ).count()
    
    # Motivasyonel mesajlar
    motivational_messages = [
        f"🎯 Bugün {roadmap.title} yolculuğunuzda bir adım daha atın!",
        f"💪 {roadmap.title} konusunda {completed_steps}/{total_steps} adımı tamamladınız. Devam edin!",
        f"🌟 {roadmap.title} öğrenme yolculuğunuzda harika ilerliyorsunuz!",
        f"🚀 {roadmap.title} hedefinize bir adım daha yaklaşın!",
        f"✨ Bugün {roadmap.title} konusunda yeni bir şey öğrenin!",
        f"🔥 {roadmap.title} yolculuğunuzda tutkunuzu koruyun!",
        f"📚 {roadmap.title} konusunda bilginizi genişletin!",
        f"🎉 {roadmap.title} öğrenme serüveninizde başarılarınızı kutlayın!"
    ]
    
    import random
    selected_message = random.choice(motivational_messages)
    
    # Progress yüzdesi
    progress_percentage = (completed_steps / max(total_steps, 1)) * 100
    
    # Progress durumuna göre ek mesaj
    if progress_percentage >= 80:
        additional_message = "🎊 Neredeyse tamamladınız! Son düzlükte devam edin!"
    elif progress_percentage >= 50:
        additional_message = "🎯 Yarı yoldasınız! Bu harika bir başarı!"
    elif progress_percentage >= 25:
        additional_message = "🌟 Güzel bir başlangıç yaptınız! Devam edin!"
    else:
        additional_message = "🚀 Yeni başladınız! Her gün bir adım atın!"
    
    return {
        "success": True,
        "message": "Günlük hatırlatma oluşturuldu",
        "reminder_data": {
            "title": f"Günlük Öğrenme Hatırlatması 📚",
            "message": f"{selected_message}\n\n{additional_message}\n\nİlerleme: %{int(progress_percentage)}",
            "roadmap_title": roadmap.title,
            "progress_percentage": int(progress_percentage)
        }
    }

async def send_push_notification(user_id: int, title: str, message: str, db: Session):
    """Push notification gönder - Expo Push API kullanarak"""
    try:
        # Kullanıcının push token'larını getir
        tokens = db.query(PushToken).filter(PushToken.user_id == user_id).all()
        
        if not tokens:
            print(f"No push tokens found for user {user_id}")
            return
        
        # Expo Push API için mesaj hazırla
        push_messages = []
        for token in tokens:
            push_message = {
                "to": token.push_token,
                "title": title,
                "body": message,
                "sound": "default",
                "priority": "high",
                "data": {
                    "type": "notification",
                    "user_id": user_id
                }
            }
            push_messages.append(push_message)
        
        # Expo Push API'ye gönder
        headers = {
            "Accept": "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            EXPO_PUSH_API_URL,
            headers=headers,
            data=json.dumps(push_messages)
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"Push notification sent successfully to user {user_id}")
            print(f"Expo response: {result}")
        else:
            print(f"Failed to send push notification to user {user_id}")
            print(f"Response status: {response.status_code}")
            print(f"Response text: {response.text}")
            
    except Exception as e:
        print(f"Send push notification error: {e}") 

def start_notification_scheduler():
    """Bildirim scheduler'ını başlat"""
    global notification_scheduler_running
    
    if notification_scheduler_running:
        return
    
    notification_scheduler_running = True
    
    def run_scheduler():
        while notification_scheduler_running:
            try:
                # Her dakika kontrol et
                time.sleep(60)
                
                # Şu anki saati al
                now = datetime.now()
                current_time = now.strftime("%H:%M")
                
                print(f"🕐 Scheduler kontrol: {current_time}")
                
                # Bildirim gönderme zamanı gelen kullanıcıları bul
                db = next(get_db())
                users_to_notify = db.query(User, NotificationPreference).join(
                    NotificationPreference, User.id == NotificationPreference.user_id
                ).filter(
                    NotificationPreference.daily_reminder_enabled == True,
                    NotificationPreference.daily_reminder_time == current_time
                ).all()
                
                print(f"📱 {len(users_to_notify)} kullanıcıya bildirim gönderilecek")
                
                for user, prefs in users_to_notify:
                    try:
                        # Rahatsız etme saatlerini kontrol et
                        if is_in_do_not_disturb(current_time, prefs.do_not_disturb_start, prefs.do_not_disturb_end):
                            print(f"🔇 Kullanıcı {user.id} rahatsız etme saatlerinde, bildirim gönderilmedi")
                            continue
                        
                        # Günlük hatırlatma oluştur ve gönder
                        asyncio.run(send_daily_notification_to_user(user, db))
                        print(f"✅ Kullanıcı {user.id} için bildirim gönderildi")
                        
                    except Exception as e:
                        print(f"❌ Kullanıcı {user.id} için bildirim hatası: {e}")
                        continue
                
            except Exception as e:
                print(f"❌ Scheduler hatası: {e}")
                time.sleep(60)  # Hata durumunda 1 dakika bekle
    
    # Scheduler'ı ayrı thread'de çalıştır
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    print("🔄 Bildirim scheduler thread başlatıldı")

def is_in_do_not_disturb(current_time: str, dnd_start: str, dnd_end: str) -> bool:
    """Şu anki zaman rahatsız etme saatlerinde mi kontrol et"""
    try:
        current_hour, current_minute = map(int, current_time.split(':'))
        start_hour, start_minute = map(int, dnd_start.split(':'))
        end_hour, end_minute = map(int, dnd_end.split(':'))
        
        current_minutes = current_hour * 60 + current_minute
        start_minutes = start_hour * 60 + start_minute
        end_minutes = end_hour * 60 + end_minute
        
        # Gece yarısını geçen rahatsız etme saatleri için
        if start_minutes > end_minutes:
            return current_minutes >= start_minutes or current_minutes <= end_minutes
        else:
            return start_minutes <= current_minutes <= end_minutes
            
    except Exception as e:
        print(f"Rahatsız etme saati kontrol hatası: {e}")
        return False

async def send_daily_notification_to_user(user: User, db: Session):
    """Kullanıcıya günlük bildirim gönder"""
    try:
        # Günlük hatırlatma oluştur
        reminder_response = await get_daily_reminder_internal(user, db)
        
        if reminder_response["success"]:
            # Bildirim kaydı oluştur
            notification = Notification(
                user_id=user.id,
                title=reminder_response["reminder_data"]["title"],
                message=reminder_response["reminder_data"]["message"],
                notification_type="daily_reminder",
                roadmap_title=reminder_response["reminder_data"].get("roadmap_title"),
                sent_at=datetime.now()
            )
            db.add(notification)
            db.commit()
            
            # Push notification gönder
            await send_push_notification(
                user.id, 
                reminder_response["reminder_data"]["title"], 
                reminder_response["reminder_data"]["message"], 
                db
            )
            
            print(f"📨 Günlük bildirim gönderildi: {user.id}")
            
    except Exception as e:
        print(f"Error sending daily notification: {e}")
        return False

# Premium endpoints
@app.get("/api/premium/trial-status", response_model=TrialStatusResponse)
async def get_trial_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Kullanıcının trial durumunu kontrol et"""
    try:
        now = datetime.utcnow()
        
        # Trial başlatılmışsa kontrol et
        if current_user.trial_start_date and current_user.trial_end_date:
            trial_end = current_user.trial_end_date
            if now < trial_end:
                days_left = (trial_end - now).days
                is_active = True
            else:
                days_left = 0
                is_active = False
                # Trial süresi dolmuşsa otomatik abonelik başlat
                if current_user.subscription_type == "trial":
                    current_user.subscription_type = "premium"
                    current_user.subscription_expires = now + timedelta(days=30)
                    db.commit()
                    print(f"Trial ended for user {current_user.id}, auto-subscription started")
        else:
            # Trial başlatılmamış
            days_left = 0
            is_active = False
        
        return TrialStatusResponse(
            days_left=days_left,
            expiry_date=current_user.trial_end_date.isoformat() if current_user.trial_end_date else None,
            is_active=is_active
        )
    except Exception as e:
        print(f"Error getting trial status: {e}")
        raise HTTPException(status_code=500, detail="Trial status check failed")

@app.post("/api/premium/start-trial", response_model=PremiumPurchaseResponse)
async def start_trial(
    request: StartTrialRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """3 günlük trial başlat - Apple receipt doğrulaması ile"""
    try:
        # Apple receipt doğrulaması (basit kontrol)
        if not request.transaction_id or not request.receipt:
            raise HTTPException(status_code=400, detail="Apple transaction ID and receipt required")
        
        # Receipt doğrulaması burada yapılabilir
        # Şimdilik basit kontrol yapıyoruz
        print(f"Apple receipt validation: transaction_id={request.transaction_id}")
        
        # Trial başlat
        trial_start = datetime.utcnow()
        trial_end = trial_start + timedelta(days=3)
        
        current_user.trial_start_date = trial_start
        current_user.trial_end_date = trial_end
        current_user.subscription_type = "trial"
        
        db.commit()
        
        return PremiumPurchaseResponse(
            success=True,
            message="3 günlük trial başlatıldı",
            expires_at=trial_end.isoformat()
        )
    except Exception as e:
        print(f"Error starting trial: {e}")
        raise HTTPException(status_code=500, detail="Trial start failed")

@app.post("/api/premium/purchase", response_model=PremiumPurchaseResponse)
async def purchase_premium(
    request: PremiumPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Premium abonelik satın al"""
    try:
        # Product ID'ye göre süre hesapla
        if "monthly" in request.product_id:
            expires_at = datetime.utcnow() + timedelta(days=30)
        elif "yearly" in request.product_id:
            expires_at = datetime.utcnow() + timedelta(days=365)
        else:
            raise HTTPException(status_code=400, detail="Invalid product ID")
        
        # Kullanıcıyı premium yap
        current_user.subscription_type = "premium"
        current_user.subscription_expires = expires_at
        
        # Trial bilgilerini temizle
        current_user.trial_start_date = None
        current_user.trial_end_date = None
        
        db.commit()
        
        return PremiumPurchaseResponse(
            success=True,
            message="Premium subscription activated successfully",
            expires_at=expires_at.isoformat()
        )
    except Exception as e:
        print(f"Error processing premium purchase: {e}")
        raise HTTPException(status_code=500, detail="Premium purchase failed")

@app.get("/api/premium/status")
async def get_premium_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Kullanıcının premium durumunu kontrol et"""
    try:
        now = datetime.utcnow()
        is_premium = False
        
        # Trial kontrolü
        if current_user.subscription_type == "trial" and current_user.trial_end_date:
            if now < current_user.trial_end_date:
                is_premium = True
            else:
                # Trial süresi dolmuş - otomatik abonelik başlat
                # Apple'dan otomatik para çekme başlayacak
                current_user.subscription_type = "premium"
                # Varsayılan olarak aylık abonelik (30 gün)
                current_user.subscription_expires = now + timedelta(days=30)
                db.commit()
                is_premium = True
                print(f"Trial ended for user {current_user.id}, auto-subscription started")
        
        # Premium kontrolü
        elif current_user.subscription_type == "premium" and current_user.subscription_expires:
            if now < current_user.subscription_expires:
                is_premium = True
            else:
                # Süresi dolmuşsa free yap
                current_user.subscription_type = "free"
                current_user.subscription_expires = None
                db.commit()
        
        return {
            "is_premium": is_premium,
            "subscription_type": current_user.subscription_type,
            "expires_at": current_user.subscription_expires.isoformat() if current_user.subscription_expires else None
        }
    except Exception as e:
        print(f"Error getting premium status: {e}")
        raise HTTPException(status_code=500, detail="Premium status check failed")
    """Kullanıcıya günlük bildirim gönder"""
    try:
        # Günlük hatırlatma oluştur
        reminder_response = await get_daily_reminder_internal(user, db)
        
        if reminder_response["success"]:
            # Bildirim kaydı oluştur
            notification = Notification(
                user_id=user.id,
                title=reminder_response["reminder_data"]["title"],
                message=reminder_response["reminder_data"]["message"],
                notification_type="daily_reminder",
                roadmap_title=reminder_response["reminder_data"].get("roadmap_title"),
                sent_at=datetime.now()
            )
            db.add(notification)
            db.commit()
            
            # Push notification gönder
            await send_push_notification(
                user.id, 
                reminder_response["reminder_data"]["title"], 
                reminder_response["reminder_data"]["message"], 
                db
            )
            
            print(f"📨 Günlük bildirim gönderildi: {user.id}")
            
    except Exception as e:
        print(f"Günlük bildirim gönderme hatası: {e}")
        db.rollback()