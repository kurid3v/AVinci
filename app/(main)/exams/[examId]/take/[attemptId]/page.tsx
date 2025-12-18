
'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDataContext } from '@/context/DataContext';
import type { ExamAttempt, Submission, Problem, Answer } from '@/types';
import Timer from '@/components/Timer';
import { gradeEssay, gradeReadingComprehension, distributeReadingAnswers, getTextFromImage } from '@/services/geminiService';
import ConfirmationModal from '@/components/ConfirmationModal';
import CameraIcon from '@/components/icons/CameraIcon';
import SparklesIcon from '@/components/icons/SparklesIcon';
import UploadIcon from '@/components/icons/UploadIcon';
import EssayScanner from '@/components/EssayScanner';
import LockClosedIcon from '@/components/icons/LockClosedIcon';

type AnswersState = { [problemId: string]: string | { [key: string]: { selectedOptionId?: string, writtenAnswer?: string } } };

export default function ExamTakingPage({ params }: { params: { examId: string; attemptId: string } }) {
    const router = useRouter();
    const { 
        exams, 
        problems, 
        examAttempts, 
        currentUser, 
        recordFullscreenExit, 
        recordVisibilityChange, 
        finishExamAttempt 
    } = useDataContext();

    const attempt = examAttempts.find(a => a.id === params.attemptId);
    const exam = exams.find(e => e.id === params.examId);
    const examProblems = problems.filter(p => p.examId === params.examId);

    const isPractice = exam?.isPractice || false;
    const [isFullscreenActive, setIsFullscreenActive] = useState(true);
    
    const getInitialAnswers = useCallback((): AnswersState => {
      if (!attempt) return {};
      try {
        const saved = localStorage.getItem(`exam_answers_${attempt.id}`);
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }, [attempt]);
    
    const [activeProblemId, setActiveProblemId] = useState<string>(examProblems[0]?.id || '');
    const [answers, setAnswers] = useState<AnswersState>(getInitialAnswers);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const attemptRef = useRef(attempt);

    // OCR & Batch Scan States
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanContext, setScanContext] = useState<{ problemId: string, questionId?: string, isBatch?: boolean } | null>(null);
    const [isDistributing, setIsDistributing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if(attempt) attemptRef.current = attempt;
    }, [attempt]);

    useEffect(() => {
        if (attempt) {
            localStorage.setItem(`exam_answers_${attempt.id}`, JSON.stringify(answers));
        }
    }, [answers, attempt]);

    const handleFullscreenChange = useCallback(() => {
        if (isPractice) return; // Ignore in practice mode
        const isFullscreen = !!document.fullscreenElement;
        setIsFullscreenActive(isFullscreen);
        if (!isFullscreen && attemptRef.current) {
            recordFullscreenExit(attemptRef.current.id);
        }
    }, [recordFullscreenExit, isPractice]);

    const handleVisibilityChange = useCallback(() => {
        if (isPractice) return; // Ignore in practice mode
        if (document.visibilityState === 'hidden' && attemptRef.current) {
            recordVisibilityChange(attemptRef.current.id);
        }
    }, [recordVisibilityChange, isPractice]);
    
    useEffect(() => {
        if (isPractice) {
            setIsFullscreenActive(true);
            return;
        }

        if(!document.fullscreenElement) {
            setIsFullscreenActive(false);
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        };
    }, [handleFullscreenChange, handleVisibilityChange, isPractice]);

    const enterFullscreen = () => {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            alert("Không thể vào chế độ toàn màn hình. Vui lòng bật quyền này trong cài đặt trình duyệt của bạn.");
        });
    };

    const handleExit = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        router.replace(`/exams/${params.examId}`);
    };

    // --- LOGIC NHẬP LIỆU ---
    const handleEssayChange = (problemId: string, text: string) => {
        setAnswers(prev => ({ ...prev, [problemId]: text }));
    };

    const handleReadingOptionChange = (problemId: string, questionId: string, optionId: string) => {
        setAnswers(prev => {
            const currentProbAnswers = (prev[problemId] as any) || {};
            return {
                ...prev,
                [problemId]: {
                    ...currentProbAnswers,
                    [questionId]: { selectedOptionId: optionId }
                }
            };
        });
    };

    const handleReadingTextChange = (problemId: string, questionId: string, text: string) => {
        setAnswers(prev => {
            const currentProbAnswers = (prev[problemId] as any) || {};
            return {
                ...prev,
                [problemId]: {
                    ...currentProbAnswers,
                    [questionId]: { ...currentProbAnswers[questionId], writtenAnswer: text }
                }
            };
        });
    };

    // --- LOGIC OCR ---
    const openScanner = (problemId: string, questionId?: string, isBatch?: boolean) => {
        setScanContext({ problemId, questionId, isBatch });
        setIsScannerOpen(true);
    };

    const handleTextExtracted = async (text: string) => {
        if (!scanContext) return;
        const { problemId, questionId, isBatch } = scanContext;
        
        const problem = examProblems.find(p => p.id === problemId);
        if (!problem) return;

        if (problem.type === 'essay') {
            const currentText = (answers[problemId] as string) || '';
            handleEssayChange(problemId, currentText ? `${currentText}\n\n${text}` : text);
        } else if (problem.type === 'reading_comprehension') {
            if (isBatch) {
                // Batch OCR for reading comprehension
                setIsDistributing(true);
                try {
                    const distributed = await distributeReadingAnswers(text, problem.questions || []);
                    setAnswers(prev => {
                        const currentProbAnswers = (prev[problemId] as any) || {};
                        return { ...prev, [problemId]: { ...currentProbAnswers, ...distributed } };
                    });
                } catch (e) {
                    alert("Không thể tự động phân tách câu trả lời. Bạn có thể dán văn bản thủ công vào từng câu.");
                } finally {
                    setIsDistributing(false);
                }
            } else if (questionId) {
                const currentProbAnswers = (answers[problemId] as any) || {};
                const currentAns = currentProbAnswers[questionId]?.writtenAnswer || '';
                handleReadingTextChange(problemId, questionId, currentAns ? `${currentAns}\n\n${text}` : text);
            }
        }
    };

    const handleBatchFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, problemId: string) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        const problem = examProblems.find(p => p.id === problemId);
        if (!problem) return;

        setOcrProgress("Đang nhận diện...");
        const fileArray = Array.from(files) as File[];
        const results: string[] = [];
        
        try {
            // Process sequentially to respect AI rate limits
            for (let i = 0; i < fileArray.length; i++) {
                const file = fileArray[i];
                setOcrProgress(`Đang xử lý ảnh ${i + 1}/${fileArray.length}...`);
                
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(file);
                });

                const text = await getTextFromImage(base64);
                results.push(text);
            }

            const combinedText = results.join('\n\n---\n\n');
            if (problem.type === 'essay') {
                const current = (answers[problemId] as string) || '';
                handleEssayChange(problemId, current ? `${current}\n\n${combinedText}` : combinedText);
            } else {
                setIsDistributing(true);
                const distributed = await distributeReadingAnswers(combinedText, problem.questions || []);
                setAnswers(prev => {
                    const currentProbAnswers = (prev[problemId] as any) || {};
                    return { ...prev, [problemId]: { ...currentProbAnswers, ...distributed } };
                });
                setIsDistributing(false);
            }
        } catch (err) {
            alert("Lỗi khi nhận diện hình ảnh.");
        } finally {
            setOcrProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // --- LOGIC NỘP BÀI ---
    const handleSubmitExam = useCallback(async () => {
        if (isSubmitting || !attemptRef.current || !currentUser || !exam) return;
        setIsSubmitting(true);
        
        const newSubmissions: Submission[] = [];
        const submissionTime = Date.now();
        
        for (const problem of examProblems) {
            const rawAnswer = answers[problem.id];
            if (!rawAnswer) continue;

            try {
                let result;
                if (problem.type === 'essay' && typeof rawAnswer === 'string' && rawAnswer.trim()) {
                    result = await gradeEssay(
                        problem.id, problem.prompt!, rawAnswer, 
                        problem.rubricItems || [], problem.rawRubric || '', 
                        String(problem.customMaxScore || 10)
                    );
                    newSubmissions.push({
                        id: crypto.randomUUID(), problemId: problem.id, submitterId: currentUser.id,
                        essay: rawAnswer, feedback: result.feedback, similarityCheck: result.similarityCheck,
                        submittedAt: submissionTime, examId: exam.id,
                    });
                } else if (problem.type === 'reading_comprehension' && typeof rawAnswer === 'object') {
                    const formattedAnswers: Answer[] = Object.entries(rawAnswer).map(([qId, val]: [string, any]) => ({
                        questionId: qId,
                        selectedOptionId: val.selectedOptionId,
                        writtenAnswer: val.writtenAnswer
                    }));
                    const feedback = await gradeReadingComprehension(problem, formattedAnswers);
                    newSubmissions.push({
                        id: crypto.randomUUID(), problemId: problem.id, submitterId: currentUser.id,
                        answers: formattedAnswers, feedback: feedback,
                        submittedAt: submissionTime, examId: exam.id,
                    });
                }
            } catch (error) {
                console.error(`Failed to grade problem ${problem.id}:`, error);
            }
        }
        
        if (attempt) localStorage.removeItem(`exam_answers_${attempt.id}`);
        await finishExamAttempt(attemptRef.current, newSubmissions);
        router.replace(`/exams/${exam.id}`);

    }, [isSubmitting, examProblems, answers, currentUser, exam, finishExamAttempt, router, attempt]);
    
    if (!exam || !attempt || !currentUser) {
        return (
             <div className="fixed inset-0 bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
                <p className="ml-4 text-slate-600 text-lg font-bold">Đang tải phiên làm bài...</p>
            </div>
        )
    }

    if (!isFullscreenActive) {
        return (
            <div className="fixed inset-0 bg-slate-900 text-white flex flex-col items-center justify-center text-center p-4 z-50">
                <h1 className="text-4xl font-bold">Chế độ toàn màn hình là bắt buộc</h1>
                <p className="text-xl mt-4 max-w-2xl">Đây là kì thi chính thức. Để đảm bảo tính minh bạch, bạn phải làm bài ở chế độ toàn màn hình. Mọi hành vi thoát màn hình sẽ được ghi lại.</p>
                <button onClick={enterFullscreen} className="mt-8 px-8 py-4 bg-primary text-white font-bold text-lg rounded-xl shadow-lg hover:bg-primary/90">Vào toàn màn hình</button>
                <button onClick={handleExit} className="mt-4 px-6 py-2 text-slate-300 font-semibold hover:text-white">Thoát</button>
            </div>
        );
    }

    if (isSubmitting) {
        return (
            <div className="fixed inset-0 bg-white flex flex-col items-center justify-center text-center p-4">
                <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-primary mb-6"></div>
                <h1 className="text-3xl font-bold text-slate-800">Đang nộp bài...</h1>
                <p className="text-slate-600 mt-2 text-lg">AI đang chấm điểm bộ bài tập của bạn. Vui lòng không tắt trình duyệt.</p>
            </div>
        );
    }

    const activeProblem = examProblems.find(p => p.id === activeProblemId);

    return (
        <>
            <div className="fixed inset-0 bg-secondary flex flex-col p-4 sm:p-6 lg:p-8">
                <header className="flex-shrink-0 bg-card p-4 rounded-xl shadow-sm border border-border flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-lg ${isPractice ? 'bg-blue-100 text-blue-600' : 'bg-primary/10 text-primary'}`}>
                            {isPractice ? <SparklesIcon className="h-5 w-5" /> : <LockClosedIcon className="h-5 w-5" />}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">{exam.title}</h1>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{isPractice ? 'Chế độ luyện tập' : 'Kì thi chính thức'}</p>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-6">
                        <div className="hidden sm:block">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Học sinh</p>
                            <p className="font-bold text-foreground">{currentUser.displayName}</p>
                        </div>
                        <div className="bg-slate-50 px-4 py-1.5 rounded-lg border border-border">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Thời gian còn lại</p>
                            <Timer expiryTimestamp={exam.endTime} onExpire={handleSubmitExam} />
                        </div>
                    </div>
                </header>

                <div className="flex-grow flex gap-6 overflow-hidden">
                    <nav className="w-1/4 flex-shrink-0 bg-card rounded-xl shadow-sm border border-border p-4 overflow-y-auto">
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Danh sách câu hỏi</h2>
                        <ul className="space-y-2">
                            {examProblems.map((p, index) => (
                                <li key={p.id}>
                                    <button 
                                        onClick={() => setActiveProblemId(p.id)}
                                        className={`w-full text-left p-3 rounded-lg font-bold transition-all ${
                                            activeProblemId === p.id 
                                            ? 'bg-primary text-primary-foreground shadow-md' 
                                            : 'text-foreground hover:bg-muted'
                                        }`}
                                    >
                                    Câu {index + 1}: {p.title}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="w-3/4 flex-grow flex flex-col bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                        {activeProblem ? (
                            <div className="h-full flex flex-col overflow-hidden">
                                <div className="p-5 border-b border-border bg-muted/20">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-black text-xl text-foreground">{activeProblem.title}</h3>
                                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                                            {activeProblem.type === 'essay' ? 'Tự luận' : 'Đọc hiểu'}
                                        </span>
                                    </div>
                                    <p className="text-muted-foreground text-sm line-clamp-2">{activeProblem.prompt || activeProblem.passage}</p>
                                </div>

                                <div className="flex-grow overflow-y-auto p-6 space-y-8">
                                    {/* Nộp nhanh AI cho chế độ luyện tập */}
                                    {isPractice && (
                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 border-dashed flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                                            <div>
                                                <h4 className="font-bold text-blue-800 flex items-center gap-2">
                                                    <SparklesIcon className="h-4 w-4" />
                                                    Hỗ trợ nộp bài AI (OCR)
                                                </h4>
                                                <p className="text-xs text-blue-600 mt-0.5">Sử dụng camera hoặc tải ảnh bài làm giấy để AI tự động trích xuất chữ viết.</p>
                                            </div>
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <button onClick={() => openScanner(activeProblem.id, undefined, true)} className="flex-1 sm:flex-none btn-secondary bg-white text-blue-600 border-blue-200 hover:bg-blue-50 px-3 py-1.5 text-xs font-bold flex items-center gap-2">
                                                    <CameraIcon className="h-4 w-4" /> Chụp ảnh
                                                </button>
                                                <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none btn-secondary bg-white text-blue-600 border-blue-200 hover:bg-blue-50 px-3 py-1.5 text-xs font-bold flex items-center gap-2">
                                                    <UploadIcon className="h-4 w-4" /> Tải tệp
                                                </button>
                                                <input type="file" ref={fileInputRef} onChange={(e) => handleBatchFileUpload(e, activeProblem.id)} accept="image/*" multiple className="hidden" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Nội dung bài tập */}
                                    {activeProblem.type === 'essay' ? (
                                        <div className="h-full flex flex-col">
                                            <textarea
                                                value={(answers[activeProblemId] as string) || ''}
                                                onChange={(e) => handleEssayChange(activeProblemId, e.target.value)}
                                                onPaste={activeProblem.disablePaste ? (e) => e.preventDefault() : undefined}
                                                placeholder="Nhập bài làm của bạn vào đây..."
                                                className="w-full min-h-[400px] flex-grow p-0 resize-none border-0 focus:ring-0 text-lg leading-relaxed bg-transparent"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-10">
                                            <div className="prose prose-slate max-w-none bg-muted/30 p-6 rounded-2xl border border-border mb-8">
                                                <h4 className="font-bold text-primary mb-2">Đoạn văn / Ngữ liệu:</h4>
                                                <p className="whitespace-pre-wrap">{activeProblem.passage}</p>
                                            </div>
                                            {activeProblem.questions?.map((q, qIdx) => {
                                                const probAnswers = (answers[activeProblemId] as any) || {};
                                                const qAns = probAnswers[q.id] || {};
                                                return (
                                                    <div key={q.id} className="pb-8 border-b border-border last:border-0">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <p className="font-black text-lg text-foreground">Câu {qIdx + 1}: {q.questionText}</p>
                                                        </div>
                                                        {q.questionType === 'multiple_choice' ? (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {q.options?.map(opt => (
                                                                    <label key={opt.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${qAns.selectedOptionId === opt.id ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-border hover:bg-muted'}`}>
                                                                        <input type="radio" name={q.id} checked={qAns.selectedOptionId === opt.id} onChange={() => handleReadingOptionChange(activeProblemId, q.id, opt.id)} className="form-radio h-5 w-5 text-primary" />
                                                                        <span className="font-bold">{opt.text}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center">
                                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Câu trả lời:</label>
                                                                    {isPractice && (
                                                                        <button onClick={() => openScanner(activeProblemId, q.id)} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                                                            <CameraIcon className="h-3 w-3" /> Quét ảnh câu này
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <textarea 
                                                                    value={qAns.writtenAnswer || ''} 
                                                                    onChange={(e) => handleReadingTextChange(activeProblemId, q.id, e.target.value)}
                                                                    placeholder="Nhập nội dung..." 
                                                                    className="w-full p-4 bg-muted/30 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                                                                    rows={3} 
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground font-bold">Chọn một câu hỏi từ danh sách bên trái để bắt đầu làm bài.</p>
                            </div>
                        )}
                    </div>
                </div>
                
                <footer className="flex-shrink-0 mt-6 flex justify-between items-center">
                    <button onClick={() => setIsExitModalOpen(true)} className="px-6 py-3 bg-secondary text-secondary-foreground font-bold rounded-xl shadow-sm hover:bg-muted transition-all">Thoát & Lưu nháp</button>
                    <button onClick={() => setIsSubmitModalOpen(true)} className="px-10 py-4 bg-green-600 text-white font-black text-lg rounded-xl shadow-lg hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98] transition-all">Nộp bài ngay</button>
                </footer>
            </div>

            {/* Scanners & Modals */}
            <EssayScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onTextExtracted={handleTextExtracted} />
            
            {(isDistributing || ocrProgress) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full">
                        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
                        <p className="font-bold text-foreground text-center">{ocrProgress || 'Đang phân tách thông minh...'}</p>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={isExitModalOpen}
                onClose={() => setIsExitModalOpen(false)}
                onConfirm={handleExit}
                title="Xác nhận thoát"
                message="Hệ thống đã lưu nháp bài làm của bạn vào trình duyệt. Bạn có thể quay lại bất cứ lúc nào trước khi hết thời gian."
                confirmButtonText="Đồng ý thoát"
                confirmButtonClass="bg-yellow-600 hover:bg-yellow-700"
            />
            <ConfirmationModal
                isOpen={isSubmitModalOpen}
                onClose={() => setIsSubmitModalOpen(false)}
                onConfirm={handleSubmitExam}
                title="Xác nhận nộp bài"
                message="Hành động này sẽ gửi bài làm của bạn tới giáo viên và AI để chấm điểm. Bạn không thể sửa sau khi đã nộp."
                confirmButtonText="Xác nhận nộp"
                confirmButtonClass="bg-green-600 hover:bg-green-700"
            />
        </>
    );
};
