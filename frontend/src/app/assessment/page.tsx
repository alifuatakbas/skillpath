'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  generateAssessment, 
  generateRoadmap,
  type AssessmentResponse,
  type AssessmentQuestion,
  TokenManager 
} from '../../shared/api';

export default function Assessment() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [skillName, setSkillName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    // Check if user is logged in
    if (!TokenManager.isAuthenticated()) {
      router.push('/');
      return;
    }

    // Get skill name from URL parameters
    const skill = searchParams.get('skill');
    if (!skill) {
      router.push('/');
      return;
    }

    setSkillName(skill);
    loadAssessment(skill);
  }, [searchParams, router]);

  const loadAssessment = async (skill: string) => {
    try {
      setLoading(true);
      setError('');
      
      const response: AssessmentResponse = await generateAssessment({
        skill_name: skill,
        target_duration_weeks: 12,
        language: 'tr'
      });
      
      setQuestions(response.questions);
    } catch (error: any) {
      console.error('Assessment loading failed:', error);
      setError(error.message || 'Değerlendirme yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError('');

      // Determine user level based on answers
      const experienceAnswer = answers[0] || 'Hiç deneyimim yok';
      const hoursAnswer = answers[1] || '1 saat';
      
      let currentLevel = 'beginner';
      if (experienceAnswer.includes('İleri')) {
        currentLevel = 'advanced';
      } else if (experienceAnswer.includes('Orta')) {
        currentLevel = 'intermediate';
      }

      let dailyHours = 2;
      if (hoursAnswer.includes('1 saat')) dailyHours = 1;
      else if (hoursAnswer.includes('2-3')) dailyHours = 2;
      else if (hoursAnswer.includes('4-5')) dailyHours = 4;
      else if (hoursAnswer.includes('6+')) dailyHours = 6;

      // Generate roadmap based on assessment
      const roadmapResponse = await generateRoadmap(
        skillName,
        12,
        currentLevel,
        dailyHours
      );

      // Redirect to roadmap page
      router.push(`/roadmap?id=${roadmapResponse.roadmap_id}`);
      
    } catch (error: any) {
      console.error('Roadmap generation failed:', error);
      setError(error.message || 'Roadmap oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Değerlendirme hazırlanıyor...</p>
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

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const allQuestionsAnswered = questions.every((_, index) => answers[index]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
              {skillName} Değerlendirmesi
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Soru {currentQuestionIndex + 1} / {questions.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}% Tamamlandı
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {currentQuestion?.question}
          </h2>

          <div className="space-y-3">
            {currentQuestion?.options.map((option, optionIndex) => (
              <label
                key={optionIndex}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  answers[currentQuestionIndex] === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestionIndex}`}
                  value={option}
                  checked={answers[currentQuestionIndex] === option}
                  onChange={(e) => handleAnswerSelect(currentQuestionIndex, e.target.value)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                  answers[currentQuestionIndex] === option
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {answers[currentQuestionIndex] === option && (
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  )}
                </div>
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Önceki Soru
          </button>

          <div className="flex space-x-3">
            {!isLastQuestion ? (
              <button
                onClick={handleNext}
                disabled={!answers[currentQuestionIndex]}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sonraki Soru
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!allQuestionsAnswered || submitting}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Roadmap Oluşturuluyor...' : 'Değerlendirmeyi Tamamla'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
} 