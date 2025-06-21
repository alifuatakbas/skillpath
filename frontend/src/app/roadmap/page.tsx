'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TokenManager } from '../../shared/api';

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

export default function Roadmap() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Check if user is logged in
    if (!TokenManager.isAuthenticated()) {
      router.push('/');
      return;
    }

    const roadmapId = searchParams.get('id');
    if (!roadmapId) {
      router.push('/');
      return;
    }

    loadRoadmap(roadmapId);
  }, [searchParams, router]);

  const loadRoadmap = async (roadmapId: string) => {
    try {
      setLoading(true);
      setError('');
      
      const token = TokenManager.getToken();
      const response = await fetch(`http://localhost:8000/api/roadmap/${roadmapId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRoadmapData(data.roadmap);
      } else {
        setError('Roadmap yüklenemedi');
      }
    } catch (error: any) {
      console.error('Roadmap loading failed:', error);
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  const toggleStepCompletion = (stepOrder: number) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepOrder)) {
        newSet.delete(stepOrder);
      } else {
        newSet.add(stepOrder);
      }
      return newSet;
    });
  };

  const calculateProgress = () => {
    if (!roadmapData) return 0;
    return Math.round((completedSteps.size / roadmapData.steps.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Roadmap yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Hata Oluştu</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!roadmapData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                ← SkillPath
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Öğrenme Yol Haritası
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Roadmap Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {roadmapData.title}
            </h1>
            <div className="flex justify-center items-center space-x-8 text-sm text-gray-600">
              <div className="flex items-center">
                <span className="font-semibold">Toplam Süre:</span>
                <span className="ml-2">{roadmapData.total_weeks} hafta</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold">Toplam Adım:</span>
                <span className="ml-2">{roadmapData.steps.length}</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold">İlerleme:</span>
                <span className="ml-2">{calculateProgress()}%</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-green-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${calculateProgress()}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Roadmap Steps */}
        <div className="space-y-6">
          {roadmapData.steps.map((step, index) => {
            const isCompleted = completedSteps.has(step.step_order);
            const isCurrentStep = !isCompleted && completedSteps.size === step.step_order - 1;
            
            return (
              <div
                key={step.step_order}
                className={`bg-white rounded-lg shadow-lg p-6 border-l-4 ${
                  isCompleted 
                    ? 'border-green-500 bg-green-50' 
                    : isCurrentStep 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-4 ${
                        isCompleted ? 'bg-green-500' : isCurrentStep ? 'bg-blue-500' : 'bg-gray-400'
                      }`}>
                        {isCompleted ? '✓' : step.step_order}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {step.title}
                      </h3>
                      <span className="ml-auto text-sm text-gray-500">
                        ~{step.estimated_hours} saat
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-4 ml-12">
                      {step.description}
                    </p>

                    {/* Resources */}
                    {step.resources && step.resources.length > 0 && (
                      <div className="ml-12 mb-4">
                        <h4 className="font-semibold text-gray-800 mb-2">📚 Kaynaklar:</h4>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                          {step.resources.map((resource, idx) => (
                            <li key={idx}>
                              {resource.startsWith('http') ? (
                                <a 
                                  href={resource} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  {resource}
                                </a>
                              ) : (
                                resource
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Projects */}
                    {step.projects && step.projects.length > 0 && (
                      <div className="ml-12 mb-4">
                        <h4 className="font-semibold text-gray-800 mb-2">🚀 Projeler:</h4>
                        <ul className="list-disc list-inside space-y-1 text-gray-600">
                          {step.projects.map((project, idx) => (
                            <li key={idx}>{project}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Completion Toggle */}
                  <div className="ml-4">
                    <button
                      onClick={() => toggleStepCompletion(step.step_order)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                        isCompleted
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {isCompleted ? 'Tamamlandı' : 'Tamamla'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Message */}
        {calculateProgress() === 100 && (
          <div className="bg-green-100 border border-green-200 rounded-lg p-6 mt-8 text-center">
            <div className="text-green-600 text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">
              Tebrikler! Roadmap'i Tamamladınız!
            </h2>
            <p className="text-green-700">
              Harika bir iş çıkardınız. Şimdi yeni bir skill öğrenmeye başlayabilirsiniz.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              Yeni Skill Öğren
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 