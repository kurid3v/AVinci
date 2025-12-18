'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import type { User } from '../types';
import UserCircleIcon from './icons/UserCircleIcon';
import BookOpenIcon from './icons/BookOpenIcon';

interface HeaderProps {
  user: Omit<User, 'password'>;
}

const Header: React.FC<HeaderProps> = ({ user }) => {
  const { logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    router.push('/login');
  }

  const roleTextMap = {
    teacher: 'Giáo viên',
    student: 'Học sinh',
    admin: 'Quản trị viên'
  };

  const roleText = roleTextMap[user.role] || 'Không xác định';
  
  const NavLink: React.FC<{ href: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ href, children, icon }) => {
    const isActive = pathname?.startsWith(href);
    return (
        <Link href={href} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
            isActive 
            ? 'text-primary bg-primary/10' 
            : 'text-muted-foreground hover:text-foreground'
        }`}>
            {icon}
            {children}
        </Link>
    );
  };
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 max-w-7xl flex justify-between items-center">
        <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold text-foreground">
                AVinci
            </Link>
            <nav className="hidden md:flex items-center gap-2">
                <NavLink href="/dashboard">Bài tập</NavLink>
                <NavLink href="/exams">Đề thi</NavLink>
                <NavLink href="/classrooms">Lớp học</NavLink>
                <NavLink href="/submissions/all">Bài nộp</NavLink>
                {user.role === 'admin' && (
                    <NavLink href="/admin">Quản trị</NavLink>
                )}
            </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-muted max-w-[200px]"
            >
              <div className="text-right hidden sm:block min-w-0">
                <span className="font-semibold text-sm text-foreground block truncate" title={user.displayName}>{user.displayName}</span>
                <span className={`block text-xs text-muted-foreground`}>
                  {roleText}
                </span>
              </div>
               {user.avatar ? (
                <img src={user.avatar} alt="User avatar" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <UserCircleIcon className="w-9 h-9 text-slate-500 shrink-0" />
              )}
            </button>
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                <div className="sm:hidden px-4 py-2 border-b">
                    <span className="font-semibold text-sm text-foreground block truncate">{user.displayName}</span>
                    <span className={`block text-xs text-muted-foreground`}>
                      {roleText}
                    </span>
                </div>
                <Link href="/profile" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-2 text-sm text-foreground hover:bg-muted">
                  Hồ sơ của tôi
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;