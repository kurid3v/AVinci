
'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/context/SessionContext';
import EyeIcon from '@/components/icons/EyeIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';
import QuestionMarkCircleIcon from '@/components/icons/QuestionMarkCircleIcon';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  
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
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4 relative">
      {/* Help Button */}
      <button 
        onClick={() => setShowGuide(true)}
        className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white text-primary font-semibold rounded-full shadow-sm hover:bg-slate-50 transition-colors z-10"
      >
        <QuestionMarkCircleIcon className="h-5 w-5" />
        <span className="hidden sm:inline">Hướng dẫn đăng nhập</span>
      </button>

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

      {/* Guide Modal */}
      {showGuide && (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowGuide(false)}
        >
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <QuestionMarkCircleIcon className="text-blue-600" />
                    Hướng dẫn đăng nhập
                </h3>
                <div className="space-y-4 text-slate-600">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="font-semibold text-blue-800 mb-1">Tài khoản Quản trị (Demo)</p>
                        <p className="text-sm">Tên đăng nhập: <span className="font-mono font-bold">adminuser</span></p>
                        <p className="text-sm">Mật khẩu: <span className="font-mono font-bold">admin</span></p>
                    </div>
                    
                    <div>
                        <p className="font-semibold text-slate-800">Đối với Giáo viên:</p>
                        <ul className="list-disc list-inside text-sm mt-1 ml-1">
                            <li>Nếu chưa có tài khoản, vui lòng chọn "Đăng ký ngay".</li>
                            <li>Sử dụng tên đăng nhập đã đăng ký (viết liền không dấu).</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-800">Đối với Học sinh:</p>
                        <ul className="list-disc list-inside text-sm mt-1 ml-1">
                            <li>Sử dụng tài khoản do giáo viên cung cấp hoặc tự đăng ký mới.</li>
                            <li>Liên hệ giáo viên nếu quên mật khẩu.</li>
                        </ul>
                    </div>
                </div>
                <div className="mt-6 text-center">
                    <button 
                        onClick={() => setShowGuide(false)}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition-colors"
                    >
                        Đã hiểu
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
