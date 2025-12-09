
'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/context/SessionContext';
import EyeIcon from '@/components/icons/EyeIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useSession();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
        setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
        return;
    }
    const success = await login(username, password);
    if (success) {
      router.push('/dashboard');
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
  };

  const inputClasses = "block w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/50";

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground">AVinci</h1>
            <p className="text-muted-foreground mt-2">Nền tảng học tập Văn học với AI</p>
        </div>
        <form onSubmit={handleLogin} className="bg-card shadow-card rounded-xl border border-border p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Chào mừng trở lại</h2>
            <p className="text-muted-foreground mt-1">Vui lòng đăng nhập để tiếp tục</p>
          </div>

          {error && <p className="text-destructive bg-destructive/10 p-3 rounded-md text-center text-sm font-medium">{error}</p>}
          
          <div>
            <label htmlFor="username-input" className="block text-foreground text-sm font-semibold mb-2">
              Tên đăng nhập
            </label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tài khoản admin: adminuser"
              className={inputClasses}
              required
            />
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
                placeholder="admin"
                className={`${inputClasses} pr-10`}
                required
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
            <button
              type="submit"
              disabled={!username || !password}
              className="w-full btn-primary font-bold py-3 px-4 disabled:cursor-not-allowed"
            >
              Đăng nhập
            </button>
          </div>
           <div className="text-center">
            <Link
              href="/signup"
              className="inline-block align-baseline font-semibold text-sm text-primary hover:text-primary/90"
            >
              Chưa có tài khoản? Đăng ký ngay
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
