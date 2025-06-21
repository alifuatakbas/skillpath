'use client';

import { useState, useEffect } from 'react';
import { 
  login, 
  register, 
  TokenManager,
  suggestSkill,
  type UserLogin, 
  type UserCreate,
  type AuthResponse,
  type SkillSuggestionResponse
} from '../shared/api';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showSkillInput, setShowSkillInput] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string>("");
  
  // Form states
  const [loginForm, setLoginForm] = useState<UserLogin>({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<UserCreate>({ name: '', email: '', password: '' });
  
  // Skill input states
  const [skillInput, setSkillInput] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<SkillSuggestionResponse | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const token = TokenManager.getToken();
    if (token) {
      setIsLoggedIn(true);
      const userData = localStorage.getItem('skillpath_user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const response: AuthResponse = await login(loginForm);
      
      // Store token and user data
      localStorage.setItem('skillpath_user', JSON.stringify(response.user));
      
      setUser(response.user);
      setIsLoggedIn(true);
      setShowLoginModal(false);
      
      console.log('Login successful:', response);
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error.message || "Giriş işlemi başarısız oldu");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const response: AuthResponse = await register(registerForm);
      
      // Store token and user data
      localStorage.setItem('skillpath_user', JSON.stringify(response.user));
      
      setUser(response.user);
      setIsLoggedIn(true);
      setShowRegisterModal(false);
      
      console.log('Registration successful:', response);
    } catch (error: any) {
      console.error('Registration failed:', error);
      setError(error.message || "Kayıt işlemi başarısız oldu");
    } finally {
      setLoading(false);
    }
  };

  // Skill suggestion handler
  const handleSkillSuggestion = async () => {
    if (!skillInput.trim()) return;
    
    setSkillLoading(true);
    setError("");
    
    try {
      const suggestion = await suggestSkill({
        user_input: skillInput,
        language: "tr"
      });
      
      setSkillSuggestions(suggestion);
    } catch (error: any) {
      console.error('Skill suggestion failed:', error);
      setError(error.message || "Skill önerisi alınamadı");
    } finally {
      setSkillLoading(false);
    }
  };

  // Start learning process
  const handleStartLearning = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    setShowSkillInput(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">SkillPath</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-700">Hoş geldiniz, {user?.name}</span>
                  <button
                    onClick={() => {
                      TokenManager.removeToken();
                      localStorage.removeItem('skillpath_user');
                      setIsLoggedIn(false);
                      setUser(null);
                      setShowSkillInput(false);
                    }}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Çıkış Yap
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="text-gray-600 hover:text-gray-900 px-3 py-2"
                  >
                    Giriş Yap
                  </button>
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Kayıt Ol
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center py-20 px-4">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Yeteneklerinizi Geliştirin
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            AI destekli kişiselleştirilmiş öğrenme yol haritaları ile hedeflerinize ulaşın
          </p>
          
          {!showSkillInput ? (
            <button
              onClick={handleStartLearning}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Öğrenmeye Başla
            </button>
          ) : (
            <div className="max-w-md mx-auto space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  placeholder="Hangi beceriyi öğrenmek istiyorsunuz? (örn: React, Python, UI/UX)"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleSkillSuggestion()}
                />
                <button
                  onClick={handleSkillSuggestion}
                  disabled={skillLoading || !skillInput.trim()}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {skillLoading ? '...' : 'Ara'}
                </button>
              </div>
              
              {skillSuggestions && (
                <div className="bg-white p-6 rounded-lg shadow-lg border text-left">
                  <h3 className="font-semibold text-lg mb-3">AI Önerisi:</h3>
                  <div className="space-y-2">
                    <p><strong>Beceri:</strong> {skillSuggestions.normalized_name}</p>
                    <p><strong>Kategori:</strong> {skillSuggestions.category}</p>
                    <p><strong>Zorluk:</strong> {skillSuggestions.difficulty}</p>
                    <p><strong>Tahmini süre:</strong> {skillSuggestions.estimated_weeks} hafta</p>
                    {skillSuggestions.similar_skills.length > 0 && (
                      <p><strong>Benzer beceriler:</strong> {skillSuggestions.similar_skills.join(', ')}</p>
                    )}
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <button 
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      onClick={() => {
                        // Navigate to assessment page with skill parameter
                        const encodedSkill = encodeURIComponent(skillSuggestions.normalized_name);
                        window.location.href = `/assessment?skill=${encodedSkill}`;
                      }}
                    >
                      Değerlendirmeye Başla
                    </button>
                    <button 
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                      onClick={() => {
                        setSkillSuggestions(null);
                        setSkillInput('');
                      }}
                    >
                      Yeniden Ara
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Login/Register Modal */}
      {(showLoginModal || showRegisterModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {showRegisterModal ? 'Kayıt Ol' : 'Giriş Yap'}
              </h2>
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setShowRegisterModal(false);
                  setError('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {/* Tab Buttons */}
            <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
              <button
                onClick={() => {
                  setShowRegisterModal(false);
                  setShowLoginModal(true);
                }}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  showLoginModal ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Giriş Yap
              </button>
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setShowRegisterModal(true);
                }}
                className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                  showRegisterModal ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Kayıt Ol
              </button>
            </div>

            {/* Login Form */}
            {!showRegisterModal ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Şifre
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </button>
              </form>
            ) : (
              /* Register Form */
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    id="reg-email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Şifre
                  </label>
                  <input
                    type="password"
                    id="reg-password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
