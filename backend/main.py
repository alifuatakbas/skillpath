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

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    instructor = Column(String(100), nullable=False)
    duration = Column(String(50))
    level = Column(String(20))
    price = Column(Float)
    image_url = Column(String(500))
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
    db = SessionLocal()
    try:
        init_sample_courses(db)
    finally:
        db.close()

# API Endpoints
@app.get("/")
async def root():
    return {"message": "SkillPath API'sine Hoş Geldiniz!", "version": "1.0.0"}

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 