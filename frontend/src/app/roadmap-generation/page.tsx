'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface RoadmapStep {
  step_order: number;
  title: string;
  description: string;
  estimated_hours: number;
  resources: string[];
  projects: string[];
}

interface RoadmapData {
  title: string;
  total_weeks: number;
  steps: RoadmapStep[];
}

interface RoadmapResponse {
  success: boolean;
  roadmap_id: number;
  roadmap: RoadmapData;
  message: string;
}

export default function RoadmapGenerationPage() {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [skillName, setSkillName] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [targetWeeks, setTargetWeeks] = useState(12);
  const [dailyHours, setDailyHours] = useState(2);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const skill = searchParams.get('skill');
    const level = searchParams.get('level');
    const weeks = searchParams.get('weeks');
    const hours = searchParams.get('hours');

    if (skill && level && weeks && hours) {
      setSkillName(skill);
      setCurrentLevel(level);
      setTargetWeeks(parseInt(weeks));
      setDailyHours(parseInt(hours));
      generateRoadmap(skill, level, parseInt(weeks), parseInt(hours));
    } else {
      router.push('/skill-input');
    }
  }, [searchParams, router]);

  const generateRoadmap = async (skill: string, level: string, weeks: number, hours: number) => {
    setLoading(true);
    setError('');

    try {
      // Giriş token'ı al (eğer kullanıcı giriş yapmışsa)
      const token = localStorage.getItem('access_token');
      
      const requestBody = {
        skill_name: skill,
        target_weeks: weeks,
        current_level: level,
        daily_hours: hours
      };

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:8000/api/roadmap/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data: RoadmapResponse = await response.json();
        setRoadmap(data.roadmap);
      } else if (response.status === 401) {
        // Giriş yapmamış kullanıcı için basit roadmap göster
        const fallbackRoadmap: RoadmapData = {
          title: `${skill} Öğrenme Yolu`,
          total_weeks: weeks,
          steps: [
            {
              step_order: 1,
              title: `${skill} Temelleri`,
              description: 'Temel kavramları ve terminolojiyi öğrenin',
              estimated_hours: Math.floor(weeks * hours * 0.3),
              resources: ['Online kurslar', 'Temel kitaplar', 'Video eğitimler'],
              projects: ['Basit uygulama projesi']
            },
            {
              step_order: 2,
              title: 'Uygulamalı Çalışma',
              description: 'Öğrendiklerinizi pratikte uygulayın',
              estimated_hours: Math.floor(weeks * hours * 0.5),
              resources: ['Pratik egzersizler', 'Kod örnekleri', 'Topluluk forumları'],
              projects: ['Orta seviye proje', 'Portfolio projesi']
            },
            {
              step_order: 3,
              title: 'İleri Seviye Konular',
              description: 'Derinlemesine öğrenme ve uzmanlaşma',
              estimated_hours: Math.floor(weeks * hours * 0.2),
              resources: ['İleri seviye kitaplar', 'Uzman blog yazıları', 'Konferans videoları'],
              projects: ['Kapsamlı proje', 'Açık kaynak katkısı']
            }
          ]
        };
        setRoadmap(fallbackRoadmap);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || 'Roadmap oluşturulamadı');
      }
    } catch (err) {
      setError('Bağlantı hatası');
      console.error('Roadmap generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartLearning = () => {
    // Giriş yapmamış kullanıcıyı login sayfasına yönlendir
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/?message=Öğrenme yolculuğunuza başlamak için giriş yapın');
    } else {
      // Dashboard'a yönlendir (henüz oluşturulmadı)
      alert('Dashboard sayfası henüz hazırlanıyor!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">AI ile kişiselleştirilmiş roadmap oluşturuluyor...</p>
          <p className="text-sm text-gray-500 mt-2">Bu işlem 10-30 saniye sürebilir</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Bir Hata Oluştu</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/assessment')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  if (!roadmap) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              🎯 {roadmap.title}
            </h1>
            <div className="flex justify-center items-center gap-6 text-gray-600">
              <span className="flex items-center gap-2">
                <span className="font-semibold">Skill:</span> {skillName}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">Seviye:</span> {currentLevel}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">Süre:</span> {targetWeeks} hafta
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">Günlük:</span> {dailyHours} saat
              </span>
            </div>
          </div>

          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2">📈 Öğrenme Yolculuğunuz</h2>
              <p className="opacity-90">
                Bu roadmap, sizin mevcut seviyeniz ve hedefleriniz doğrultusunda özel olarak tasarlandı. 
                Her adımı tamamladıkça bir sonrakine geçebilirsiniz.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {roadmap.steps.map((step, index) => (
              <div key={step.step_order} className="relative">
                {/* Bağlantı çizgisi */}
                {index < roadmap.steps.length - 1 && (
                  <div className="absolute left-6 top-16 w-0.5 h-16 bg-blue-200"></div>
                )}
                
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {step.step_order}
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-gray-50 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">{step.title}</h3>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        {step.estimated_hours} saat
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-4">{step.description}</p>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-2">📚 Önerilen Kaynaklar</h4>
                        <ul className="space-y-1">
                          {step.resources.map((resource, idx) => (
                            <li key={idx} className="text-gray-600 text-sm">• {resource}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-2">🛠️ Projeler</h4>
                        <ul className="space-y-1">
                          {step.projects.map((project, idx) => (
                            <li key={idx} className="text-gray-600 text-sm">• {project}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-green-800 mb-2">
                🚀 Öğrenme Yolculuğunuza Başlayın!
              </h3>
              <p className="text-green-700 mb-4">
                Roadmap'iniz hazır! Şimdi öğrenme sürecini takip etmek ve ilerlemek için giriş yapın.
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleStartLearning}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                >
                  Öğrenmeye Başla
                </button>
                <button
                  onClick={() => router.push('/assessment')}
                  className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Yeni Roadmap Oluştur
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 