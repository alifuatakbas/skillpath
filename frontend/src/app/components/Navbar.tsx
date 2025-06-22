"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '../styles/Navbar.module.css';
import Image from 'next/image'

interface User {
  full_name: string;
  email: string;
  role?: string;
}

const ProtectedLink: React.FC<{
  href: string;
  children: React.ReactNode;
  adminOnly?: boolean;
  isAdmin?: boolean;
}> = ({ href, children, adminOnly, isAdmin }) => {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    if (!token) {
      router.push('/login');
      return;
    }

    if (adminOnly && !isAdmin) {
      alert('Bu sayfaya erişim yetkiniz yok');
      return;
    }

    router.push(href);
  };

  if (adminOnly && !isAdmin) {
    return null;
  }

  return (
    <Link href={href} onClick={handleClick} className={styles.examDropdownLink}>
      {children}
    </Link>
  );
};

const Navbar: React.FC = () => {
  const [isExamMenuOpen, setIsExamMenuOpen] = useState(false);
  const [isProgramMenuOpen, setIsProgramMenuOpen] = useState(false);
  const [isSinavMenuOpen, setIsSinavMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('currentUser');
      return token && savedUser ? JSON.parse(savedUser) : null;
    }
    return null;
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    const isDark = theme === 'dark';
    setIsDarkMode(isDark);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.target.nodeName === 'HTML') {
          const isDark = document.documentElement.classList.contains('dark-theme');
          setIsDarkMode(isDark);
          localStorage.setItem('theme', isDark ? 'dark' : 'light');
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const userData: User = await response.json();
            setCurrentUser(userData);
            localStorage.setItem('currentUser', JSON.stringify(userData));
            setIsAdmin(userData.role === 'admin');
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('currentUser');
          }
        } catch (error) {
          console.error('Kullanıcı bilgileri alınamadı:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
        }
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    setIsAdmin(false);
    setIsDropdownOpen(false);
    setIsMenuOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    setIsExamMenuOpen(false);
    setIsProgramMenuOpen(false);
    setIsSinavMenuOpen(false);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsExamMenuOpen(false);
    setIsProgramMenuOpen(false);
    setIsSinavMenuOpen(false);
    setIsDropdownOpen(false);
  };

  return (
    <>
      <nav className={`${styles.navbar} ${isDarkMode ? styles.darkMode : ''}`}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.logo}>
            <Image
              src="/logo.svg"
              alt="E-Olimpiyat Logo"
              width={200}
              height={80}
              priority
              style={{
                objectFit: 'contain',
                margin: '10px 0'
              }}
            />
          </Link>

          <div
            className={`${styles.hamburger} ${isMenuOpen ? styles.active : ''}`}
            onClick={toggleMenu}
          >
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className={`${styles.navLinks} ${isMenuOpen ? styles.active : ''}`}>
            <Link href="/" className={styles.navLink} onClick={closeMenu}>
              Ana Sayfa
            </Link>

            <div
              className={styles.navLink}
              onMouseEnter={() => window.innerWidth > 768 && setIsExamMenuOpen(true)}
              onMouseLeave={() => window.innerWidth > 768 && setIsExamMenuOpen(false)}
              onClick={() => window.innerWidth <= 768 && setIsExamMenuOpen(!isExamMenuOpen)}
            >
              Denemeler
              <div
                className={`${styles.examDropdownMenu} ${isExamMenuOpen ? styles.show : ''}`}
                onMouseEnter={() => window.innerWidth > 768 && setIsExamMenuOpen(true)}
                onMouseLeave={() => window.innerWidth > 768 && setIsExamMenuOpen(false)}
              >
                <ProtectedLink href="/sinav-olustur" adminOnly isAdmin={isAdmin}>
                  Sınav Oluştur
                </ProtectedLink>
                <ProtectedLink href="/soru-ekle" adminOnly isAdmin={isAdmin}>
                  Soru Ekle
                </ProtectedLink>
                <ProtectedLink href="/sinav-coz">
                  Sınav Çöz
                </ProtectedLink>
                <ProtectedLink href="/sinav-sonuclari">
                  Sınav Sonuçlarına Bak
                </ProtectedLink>
              </div>
            </div>

            <div
              className={styles.navLink}
              onMouseEnter={() => window.innerWidth > 768 && setIsSinavMenuOpen(true)}
              onMouseLeave={() => window.innerWidth > 768 && setIsSinavMenuOpen(false)}
              onClick={() => window.innerWidth <= 768 && setIsSinavMenuOpen(!isSinavMenuOpen)}
            >
              Sınavlar
              <div
                className={`${styles.examDropdownMenu} ${isSinavMenuOpen ? styles.show : ''}`}
                onMouseEnter={() => window.innerWidth > 768 && setIsSinavMenuOpen(true)}
                onMouseLeave={() => window.innerWidth > 768 && setIsSinavMenuOpen(false)}
              >
                <Link href="https://forms.gle/xXdMjTWbKrRUTAtY8" className={styles.examDropdownLink} onClick={closeMenu}>
                  2025 Kabul Sınavı
                </Link>
              </div>
            </div>

            <div
              className={styles.navLink}
              onMouseEnter={() => window.innerWidth > 768 && setIsProgramMenuOpen(true)}
              onMouseLeave={() => window.innerWidth > 768 && setIsProgramMenuOpen(false)}
              onClick={() => window.innerWidth <= 768 && setIsProgramMenuOpen(!isProgramMenuOpen)}
            >
              Programımız
              <div
                className={`${styles.examDropdownMenu} ${isProgramMenuOpen ? styles.show : ''}`}
                onMouseEnter={() => window.innerWidth > 768 && setIsProgramMenuOpen(true)}
                onMouseLeave={() => window.innerWidth > 768 && setIsProgramMenuOpen(false)}
              >
                <Link href="/program/2025-yaz" className={styles.examDropdownLink} onClick={closeMenu}>
                  2025 Yaz Dönemi
                </Link>
                <Link href="/program/2025-2026-egitim" className={styles.examDropdownLink} onClick={closeMenu}>
                  2025-2026 Eğitim Dönemi
                </Link>
              </div>
            </div>

            <Link href="/hakkimizda" className={styles.navLink} onClick={closeMenu}>
              Hakkımızda
            </Link>
            <Link href="/basvuru" className={styles.ctaButton} onClick={closeMenu}>
              Başvuru
            </Link>

            <div className={styles.authButtons}>
              {currentUser ? (
                <>
                  <span className={styles.userName} onClick={toggleDropdown}>
                    {currentUser.full_name} {isAdmin && '(Admin)'}
                  </span>
                  {isDropdownOpen && (
                    <div className={`${styles.userDropdownMenu} ${isDropdownOpen ? styles.show : ''}`}>
                      <Link href="/profil" className={styles.userDropdownLink} onClick={closeMenu}>
                        Profil
                      </Link>
                      {isAdmin && (
                        <Link href="/admin-panel" className={styles.userDropdownLink} onClick={closeMenu}>
                          Admin Panel
                        </Link>
                      )}
                      <button onClick={handleLogout} className={styles.logoutButton}>
                        Çıkış
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Link href="/login" className={styles.loginButton} onClick={closeMenu}>
                    Giriş
                  </Link>
                  <Link href="/register" className={styles.signupButton} onClick={closeMenu}>
                    Kaydol
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <div
        className={`${styles.overlay} ${isMenuOpen ? styles.active : ''}`}
        onClick={closeMenu}
      />
    </>
  );
}

export default Navbar; 