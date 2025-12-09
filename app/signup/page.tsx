
'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/context/SessionContext';
import EyeIcon from '@/components/icons/EyeIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';
import UserCircleIcon from '@/components/icons/UserCircleIcon';

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarData, setAvatarData] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { signUp } = useSession();
  const router = useRouter();
  
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/gi, '') // remove non-alphanumeric
        .toLowerCase();
    setUsername(value);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result as string;
        setAvatarPreview(result);
        setAvatarData(result); // The full base64 data URL
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) {
      setError('Họ và tên không được để trống.');
      return;
    }
    if (!username.trim()) {
      setError('Tên đăng nhập không được để trống.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    
    const result = await signUp(username, displayName, role, password, avatarData || undefined);
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.message || 'Đăng ký không thành công. Vui lòng thử lại.');
    }
  };
  
  const inputClasses = "block w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/50";

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-card shadow-card rounded-xl border border-border p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Tạo tài khoản</h1>
            <p className="text-muted-foreground mt-1">Tham gia AVinci ngay hôm nay</p>
          </div>
          
          {error && <p className="text-destructive bg-destructive/10 p-3 rounded-md text-center text-sm font-medium">{error}</p>}
          
          <div className="flex flex-col items-center gap-4">
            {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="w-24 h-24 rounded-full object-cover" />
            ) : (
                <UserCircleIcon className="w-24 h-24 text-slate-300" />
            )}
            <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} accept="image/*" hidden />
            <button type="button" onClick={() => avatarInputRef.current?.click()} className="text-sm font-semibold text-primary hover:underline">
                Tải ảnh đại diện (tùy chọn)
            </button>
          </div>

          <div>
            <label htmlFor="displayName-input" className="block text-foreground text-sm font-semibold mb-2">
              Họ và tên
            </label>
            <input
              id="displayName-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="username-input" className="block text-foreground text-sm font-semibold mb-2">
              Tên đăng nhập
            </label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="viết liền, không dấu, không viết hoa"
              className={inputClasses}
            />
             <p className="text-xs text-muted-foreground mt-1">Dùng để đăng nhập. Ví dụ: nguyenvan_a sẽ trở thành nguyenvana</p>
          </div>

          <div>
            <label className="block text-foreground text-sm font-semibold mb-2">
              Bạn là
            </label>
            <div className="flex rounded-md border border-border p-1 bg-background">
                <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-colors ${role === 'student' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                >
                    Học sinh
                </button>
                <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-colors ${role === 'teacher' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                >
                    Giáo viên
                </button>
            </div>
          </div>
          
          <div>
            <label htmlFor="password-input" className="block text-foreground text-sm font-semibold mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                className={`${inputClasses} pr-10`}
              />
              <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                  {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password-input" className="block text-foreground text-sm font-semibold mb-2">
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <input
                id="confirm-password-input"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                className={`${inputClasses} pr-10`}
              />
              <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                  {showConfirmPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              className="w-full btn-primary font-bold py-3 px-4 disabled:cursor-not-allowed"
              disabled={!displayName || !username || !password || !confirmPassword}
            >
              Đăng ký
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-block align-baseline font-semibold text-sm text-primary hover:text-primary/90"
            >
              &larr; Quay lại Đăng nhập
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
