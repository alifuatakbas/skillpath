# SkillPath - AI Destekli Kişiselleştirilmiş Öğrenme Platformu

SkillPath, yapay zeka destekli kişiselleştirilmiş öğrenme yol haritaları oluşturan modern bir platformdur. Kullanıcılar beceri seviyelerini değerlendirip, kendilerine özel roadmap'ler alabilirler.

## 🚀 Özellikler

- **AI Destekli Skill Önerileri**: Girilen metne göre akıllı beceri önerileri
- **Kişiselleştirilmiş Assessment**: Her beceri için özel değerlendirme soruları
- **Dinamik Roadmap Oluşturma**: OpenAI entegrasyonu ile detaylı öğrenme yol haritaları
- **Cross-Platform**: Web ve mobil (React Native/Expo) desteği
- **Modern UI/UX**: Responsive tasarım ve kullanıcı dostu arayüz
- **JWT Authentication**: Güvenli kullanıcı kimlik doğrulama

## 🏗️ Proje Yapısı

```
SkillPath/
├── backend/          # FastAPI Backend
├── mobile/           # React Native (Expo) Mobil Uygulama
├── frontend/         # React Web Uygulaması
└── shared/           # Ortak kaynaklar
```

## 🛠️ Teknolojiler

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM
- **SQLite** - Veritabanı
- **OpenAI API** - AI entegrasyonu
- **JWT** - Authentication
- **Pydantic** - Data validation

### Mobile (React Native/Expo)
- **React Native** - Mobil uygulama framework
- **Expo** - Development platform
- **TypeScript** - Type safety
- **React Navigation** - Navigation
- **Expo Linear Gradient** - UI components

### Frontend (Web)
- **React** - Web framework
- **TypeScript** - Type safety
- **Modern CSS** - Styling

## 🚀 Kurulum ve Çalıştırma

### Backend Kurulumu

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Çevre değişkenlerini ayarlayın
cp .env.example .env
# .env dosyasında OPENAI_API_KEY'i ekleyin

# Veritabanını başlatın
python main.py
```

Backend http://localhost:8000 adresinde çalışacaktır.

### Mobil Uygulama Kurulumu

```bash
cd mobile
npm install

# Expo ile başlatın
npx expo start
```

Expo Go uygulaması ile QR kodu tarayarak test edebilirsiniz.

### Web Frontend Kurulumu

```bash
cd frontend
npm install
npm start
```

## 📱 Mobil Uygulama Kullanımı

1. **Kayıt/Giriş**: Uygulamaya kayıt olun veya giriş yapın
2. **Skill Girişi**: Öğrenmek istediğiniz beceriyi girin
3. **Assessment**: Seviye belirleme sorularını cevaplayın
4. **Roadmap**: Kişiselleştirilmiş öğrenme yol haritanızı görüntüleyin

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Kullanıcı girişi

### Skills
- `POST /api/skills/suggest` - Skill önerileri
- `POST /api/skills/assessment` - Assessment soruları

### Roadmap
- `POST /api/roadmap/generate` - Roadmap oluşturma
- `GET /api/roadmap/{roadmap_id}` - Roadmap detayları

### Utility
- `GET /api/health` - Sistem durumu
- `GET /api/courses/featured` - Öne çıkan kurslar

## 🔑 Çevre Değişkenleri

Backend `.env` dosyası:
```
OPENAI_API_KEY=your_openai_api_key_here
SECRET_KEY=your_jwt_secret_key_here
DATABASE_URL=sqlite:///./skillpath.db
```

## 🧪 Test

### Backend Test
```bash
cd backend
curl -X GET "http://localhost:8000/api/health"
```

### Mobil Test
1. Expo Go uygulamasını indirin
2. QR kodu tarayın
3. Uygulamayı test edin

## 📋 Geliştirme Notları

- Backend'de OpenAI API key'i yoksa fallback roadmap oluşturulur
- Mobil uygulama Expo Go ile test edilebilir
- TypeScript strict mode aktif
- SQLite veritabanı otomatik oluşturulur

## 🤝 Katkıda Bulunma

1. Projeyi fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 İletişim

Proje Sahibi: [@powderpinkk](https://github.com/powderpinkk)

Proje Linki: [https://github.com/powderpinkk/skillpath](https://github.com/powderpinkk/skillpath) 