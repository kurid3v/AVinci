'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getTextFromImage } from '@/services/geminiService';
import CameraIcon from './icons/CameraIcon';
import UploadIcon from './icons/UploadIcon';
// Added missing import for SparklesIcon
import SparklesIcon from './icons/SparklesIcon';

interface EssayScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onTextExtracted: (text: string) => void;
}

type ScannerMode = 'chooser' | 'camera' | 'preview' | 'loading' | 'error';

const EssayScanner: React.FC<EssayScannerProps> = ({ isOpen, onClose, onTextExtracted }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ScannerMode>('chooser');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const resetState = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setMode('chooser');
    setError(null);
    setProgress('');
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);
  
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setMode('camera');
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Không thể truy cập camera. Vui lòng cấp quyền trong cài đặt trình duyệt của bạn.");
      setMode('error');
    }
  }, []);

  useEffect(() => {
    if (isOpen && mode === 'camera' && !stream) {
      startCamera();
    } else if (mode !== 'camera' && stream) {
      stopCamera();
    }
  }, [isOpen, mode, stream, startCamera, stopCamera]);


  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        setMode('preview');
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
        // Single file behavior: show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
                setCapturedImage(result);
                setMode('preview');
            }
        };
        reader.readAsDataURL(files[0]);
    } else {
        // Multiple files behavior: start batch OCR immediately
        setMode('loading');
        setError(null);
        const results: string[] = [];
        const fileArray = Array.from(files);

        try {
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                setProgress(`Đang đọc ảnh ${i + 1}/${fileArray.length}...`);
                
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(file);
                });

                const text = await getTextFromImage(base64);
                results.push(text);
            }

            onTextExtracted(results.join('\n\n---\n\n'));
            onClose();
        } catch (err) {
            console.error("Batch OCR failed:", err);
            setError("Lỗi khi xử lý danh sách ảnh. Vui lòng thử lại.");
            setMode('error');
        }
    }
  };

  const handleUseImage = async () => {
    if (!capturedImage) return;
    setMode('loading');
    setProgress('Đang đọc chữ viết...');
    setError(null);
    try {
      const base64Image = capturedImage.split(',')[1];
      const text = await getTextFromImage(base64Image);
      onTextExtracted(text);
      onClose();
    } catch (err) {
      console.error("OCR failed:", err);
      setError("Không thể nhận dạng chữ viết. Vui lòng thử lại với ảnh rõ nét hơn.");
      setMode('error');
    }
  };

  if (!isOpen) return null;

  const renderContent = () => {
    switch (mode) {
      case 'chooser':
        return (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
            <div className="p-4 bg-blue-500/10 rounded-full">
                <UploadIcon className="h-12 w-12 text-blue-400" />
            </div>
            <div className="text-center">
                <h2 className="text-2xl font-black text-white">Quét bài làm giấy</h2>
                <p className="text-slate-400 mt-2">Chọn một phương thức để AI hỗ trợ đọc bài viết.</p>
            </div>
            <div className="w-full max-w-sm space-y-3">
              <button onClick={startCamera} className="w-full flex items-center justify-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95">
                <CameraIcon className="h-6 w-6" />
                Chụp ảnh bài làm
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 p-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95">
                <UploadIcon className="h-6 w-6" />
                Tải ảnh từ máy (Có thể chọn nhiều)
              </button>
            </div>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Hỗ trợ JPG, PNG, WEBP</p>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" multiple className="hidden" />
          </div>
        );
      case 'camera':
        return (
          <div className="w-full h-full relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                <div className="w-full h-full border-4 border-dashed border-white/40 rounded-3xl" />
            </div>
            <div className="absolute bottom-6 left-0 right-0 text-center">
                <p className="bg-black/60 backdrop-blur-md text-white text-xs font-bold py-2 px-4 rounded-full inline-block border border-white/20">Căn chỉnh văn bản vào khung hình</p>
            </div>
          </div>
        );
      case 'preview':
        return (
            <div className="p-4 flex items-center justify-center w-full h-full bg-black/40">
                {capturedImage && <img src={capturedImage} alt="Captured essay" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10" />}
            </div>
        );
      case 'loading':
        return (
          <div className="text-center text-white flex flex-col items-center justify-center h-full p-8">
            <div className="relative">
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-700 border-t-primary shadow-2xl"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <SparklesIcon className="h-8 w-8 text-primary animate-pulse" />
                </div>
            </div>
            <h3 className="mt-8 text-xl font-bold">AI Đang Làm Việc</h3>
            <p className="mt-2 text-slate-400 font-medium">{progress || 'Đang trích xuất văn bản từ hình ảnh...'}</p>
          </div>
        );
       case 'error':
        return (
          <div className="text-center text-white p-8 flex flex-col items-center justify-center h-full">
            <div className="bg-red-500/20 p-4 rounded-full mb-6">
                <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <p className="text-red-400 font-black text-xl">Đã xảy ra lỗi</p>
            <p className="mt-2 text-slate-400 max-w-xs mx-auto">{error}</p>
          </div>
        );
    }
  };
  
  const renderControls = () => {
      switch (mode) {
        case 'camera':
          return (
            <div className="flex items-center gap-12">
                <button onClick={resetState} className="text-white font-bold text-sm hover:text-slate-300">Hủy</button>
                <button onClick={handleCapture} disabled={!stream} className="w-20 h-20 bg-white rounded-full border-[6px] border-slate-700 hover:scale-105 active:scale-90 transition-all shadow-xl disabled:opacity-50" aria-label="Chụp ảnh"></button>
                <div className="w-10"></div> {/* Spacer */}
            </div>
          );
        case 'preview':
            return (
                <div className="flex gap-4 w-full max-w-md px-4">
                    <button onClick={resetState} className="flex-1 px-6 py-4 bg-slate-700 text-white font-bold rounded-2xl hover:bg-slate-600 transition-colors">Chụp lại</button>
                    <button onClick={handleUseImage} className="flex-2 px-8 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary/90 shadow-lg transition-all active:scale-95">Sử dụng ảnh này</button>
                </div>
            );
        case 'error':
            return <button onClick={resetState} className="px-8 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg hover:bg-primary/90 transition-all active:scale-95">Thử lại ngay</button>;
        default:
            return null;
      }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 sm:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="relative w-full h-full max-w-4xl max-h-[85vh] bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-grow relative flex items-center justify-center">
          {renderContent()}
        </div>
        
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex-shrink-0 p-6 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center">
          {renderControls()}
        </div>
        
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors" aria-label="Đóng">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default EssayScanner;
