'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SkillSuggestion {
  normalized_name: string;
  category: string;
  difficulty: string;
  estimated_weeks: number;
  similar_skills: string[];
  confidence: number;
  suggestions: string[];
}

export default function SkillInputPage() {
  const [skillInput, setSkillInput] = useState('');
  const [suggestions, setSuggestions] = useState<SkillSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSkillSuggestion = async () => {
    if (!skillInput.trim()) {
      setError('Lütfen bir skill girin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/skills/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_input: skillInput,
          language: 'tr'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      } else {
        setError('Skill önerisi alınamadı');
      }
    } catch (err) {
      setError('Bağlantı hatası');
      console.error('Skill suggestion error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkillSelect = (skillName: string) => {
    // Assessment sayfasına yönlendir
    router.push(`/assessment?skill=${encodeURIComponent(skillName)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
            Hangi Skill'i Öğrenmek İstiyorsunuz?
          </h1>

          <div className="mb-6">
            <div className="flex gap-4">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Örn: React, Python, Grafik Tasarım, İngilizce..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSkillSuggestion()}
              />
              <button
                onClick={handleSkillSuggestion}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Analiz Ediliyor...' : 'Analiz Et'}
              </button>
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          {suggestions && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-green-800 mb-4">
                  🎯 Önerilen Skill
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">
                      {suggestions.normalized_name}
                    </h3>
                    <p className="text-gray-600">Kategori: {suggestions.category}</p>
                    <p className="text-gray-600">Zorluk: {suggestions.difficulty}</p>
                    <p className="text-gray-600">Tahmini süre: {suggestions.estimated_weeks} hafta</p>
                    <p className="text-gray-600">Güven oranı: {Math.round(suggestions.confidence * 100)}%</p>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => handleSkillSelect(suggestions.normalized_name)}
                      className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Bu Skill'i Seç
                    </button>
                  </div>
                </div>
              </div>

              {suggestions.similar_skills.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-blue-800 mb-4">
                    🔗 Benzer Skill'ler
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.similar_skills.map((skill, index) => (
                      <button
                        key={index}
                        onClick={() => handleSkillSelect(skill)}
                        className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 transition-colors"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.suggestions.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-yellow-800 mb-4">
                    💡 Diğer Öneriler
                  </h2>
                  <div className="space-y-2">
                    {suggestions.suggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <span className="text-gray-700">{suggestion}</span>
                        <button
                          onClick={() => handleSkillSelect(suggestion)}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          Seç
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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