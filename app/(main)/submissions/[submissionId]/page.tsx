
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, notFound } from 'next/navigation';
import { useDataContext } from '@/context/DataContext';
import FeedbackDisplay from '@/components/FeedbackDisplay';
import type { Question, Answer, User, Submission, Problem, DetailedFeedbackItem, Feedback } from '@/types';
import SimilarityCheckDisplay from '@/components/SimilarityCheckDisplay';
import PencilIcon from '@/components/icons/PencilIcon';
import ArrowPathIcon from '@/components/icons/ArrowPathIcon';
import SubmissionHistory from '@/components/SubmissionHistory';
import CheckIcon from '@/components/icons/CheckIcon';
import XCircleIcon from '@/components/icons/XCircleIcon';
import { regradeSelectedSubmissions } from '@/services/geminiService';

const EssayResult: React.FC<{
    submission: Submission,
    problem: Problem,
    currentUser: Omit<User, 'password'>,
    onUpdateSubmission: (submissionId: string, updatedData: Partial<Submission>) => Promise<void>;
}> = ({ submission, problem, currentUser, onUpdateSubmission }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedFeedback, setEditedFeedback] = useState<Feedback>(submission.feedback);
    const [isPending, startTransition] = useTransition();

    const handleDetailChange = (index: number, field: 'score' | 'feedback', value: string | number) => {
        const newDetails = [...editedFeedback.detailedFeedback];
        const item = { ...newDetails[index] };

        if (field === 'score') {
            const newScore = Number(value);
            const rubricItem = problem.rubricItems?.find(r => r.criterion === item.criterion);
            const maxScore = rubricItem?.maxScore ?? Infinity;
            // Clamp score between 0 and maxScore
            item.score = Math.max(0, Math.min(newScore, maxScore));
        } else if (field === 'feedback') {
            item.feedback = String(value);
        }
        
        newDetails[index] = item;

        // Recalculate total score based on rubric weights and then scale to custom max score
        const rubricTotal = problem.rubricItems?.reduce((sum, r) => sum + r.maxScore, 0) || editedFeedback.maxScore;
        const currentRawTotal = newDetails.reduce((acc, curr) => acc + curr.score, 0);
        
        const newTotalScore = (rubricTotal > 0) 
            ? (currentRawTotal / rubricTotal) * editedFeedback.maxScore 
            : currentRawTotal;

        setEditedFeedback(prev => ({ ...prev, detailedFeedback: newDetails, totalScore: newTotalScore }));
    };
    
    const handleGeneralSuggestionChange = (index: number, value: string) => {
        const newSuggestions = [...(editedFeedback.generalSuggestions || [])];
        newSuggestions[index] = value;
        setEditedFeedback(prev => ({ ...prev, generalSuggestions: newSuggestions }));
    }

    const handleSave = () => {
        startTransition(async () => {
            await onUpdateSubmission(submission.id, { 
                feedback: editedFeedback,
                lastEditedByTeacherAt: Date.now()
            });
            setIsEditing(false);
        });
    };

    const handleCancel = () => {
        setEditedFeedback(submission.feedback);
        setIsEditing(false);
    };

    const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';

    if (isEditing) {
        return (
            <div className="bg-card p-6 rounded-xl border border-primary/50 shadow-lg space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                 <div>
                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                        <PencilIcon className="text-primary" />
                        Chỉnh sửa Phân tích chi tiết
                    </h3>
                    <div className="space-y-4">
                    {editedFeedback.detailedFeedback.map((item, index) => {
                         const rubricItem = problem.rubricItems?.find(r => r.criterion === item.criterion);
                         const maxScore = rubricItem?.maxScore ?? item.score;
                        return(
                        <div key={index} className="bg-muted/30 p-4 rounded-lg border border-border">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-foreground">{item.criterion}</h4>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        value={item.score}
                                        onChange={e => handleDetailChange(index, 'score', e.target.value)}
                                        className="w-24 p-2 text-right font-black text-lg text-primary bg-background rounded-md border border-border focus:ring-2 focus:ring-primary/20"
                                        step="0.25"
                                        max={maxScore}
                                        min="0"
                                    />
                                    <span className="font-bold text-muted-foreground text-sm">/ {maxScore}đ</span>
                                </div>
                            </div>
                            <textarea
                                value={item.feedback}
                                onChange={e => handleDetailChange(index, 'feedback', e.target.value)}
                                className="w-full p-3 bg-background border border-border rounded-md resize-y text-sm focus:ring-2 focus:ring-primary/20"
                                rows={3}
                            />
                        </div>
                    )})}
                    </div>
                </div>
                 <div>
                    <h3 className="text-xl font-bold text-foreground mb-3">Chỉnh sửa Gợi ý chung</h3>
                    <div className="space-y-2">
                    {editedFeedback.generalSuggestions?.map((suggestion, index) => (
                         <textarea
                            key={index}
                            value={suggestion}
                            onChange={e => handleGeneralSuggestionChange(index, e.target.value)}
                            className="w-full p-3 bg-background border border-border rounded-md resize-y text-sm focus:ring-2 focus:ring-primary/20"
                            rows={2}
                        />
                    ))}
                    </div>
                </div>
                 <div className="flex justify-end gap-4 pt-4 border-t border-border">
                    <button onClick={handleCancel} disabled={isPending} className="btn-secondary px-8 py-2.5">Hủy</button>
                    <button onClick={handleSave} disabled={isPending} className="btn-primary px-8 py-2.5 shadow-md">
                        {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="relative">
            {isTeacherOrAdmin && (
                <button 
                    onClick={() => setIsEditing(true)}
                    className="absolute -top-14 right-0 btn-outline px-4 py-2 text-sm flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold"
                >
                    <PencilIcon className="h-4 w-4" />
                    Chỉnh sửa điểm & nhận xét
                </button>
            )}
            <FeedbackDisplay feedback={submission.feedback} problem={problem} />
        </div>
    );
};


const ReadingComprehensionResult: React.FC<{ 
    problem: Problem, 
    submission: Submission,
    currentUser: Omit<User, 'password'>,
    onUpdateSubmission: (submissionId: string, updatedData: Partial<Submission>) => Promise<void>;
}> = ({ problem, submission, currentUser, onUpdateSubmission }) => {
    const questions: Question[] = problem.questions || [];
    const [isEditing, setIsEditing] = useState(false);
    const [editedScores, setEditedScores] = useState<{ [questionId: string]: number }>({});
    const [editedFeedbacks, setEditedFeedbacks] = useState<{ [questionId: string]: string }>({});
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const initialScores: { [questionId: string]: number } = {};
        const initialFeedbacks: { [questionId: string]: string } = {};
        
        submission.feedback.detailedFeedback.forEach(item => {
            const qId = item.questionId || questions.find(q => q.questionText === item.criterion)?.id;
            if (qId) {
                initialScores[qId] = item.score;
                initialFeedbacks[qId] = item.feedback;
            }
        });
        setEditedScores(initialScores);
        setEditedFeedbacks(initialFeedbacks);
    }, [submission, questions]);
    
    const handleSave = () => {
        startTransition(async () => {
            const newDetailedFeedback: DetailedFeedbackItem[] = questions.map(q => {
                const score = editedScores[q.id] ?? 0;
                const feedback = editedFeedbacks[q.id] ?? '';
                const originalFeedback = submission.feedback.detailedFeedback.find(item => (item.questionId || questions.find(q_find => q_find.questionText === item.criterion)?.id) === q.id);
                return {
                    ...(originalFeedback || { criterion: q.questionText }),
                    questionId: q.id,
                    score,
                    feedback,
                };
            });

            const newTotalScore = newDetailedFeedback.reduce((acc, item) => acc + item.score, 0);
            const newMaxScore = questions.reduce((acc, q) => acc + (q.maxScore ?? 1), 0);

            const updatedFeedback: Feedback = {
                ...submission.feedback,
                detailedFeedback: newDetailedFeedback,
                totalScore: newTotalScore,
                maxScore: newMaxScore,
            };

            await onUpdateSubmission(submission.id, { 
                feedback: updatedFeedback,
                lastEditedByTeacherAt: Date.now() 
            });
            setIsEditing(false);
        });
    };

    const handleCancel = () => {
        const initialScores: { [questionId: string]: number } = {};
        const initialFeedbacks: { [questionId: string]: string } = {};
        submission.feedback.detailedFeedback.forEach(item => {
            const qId = item.questionId || questions.find(q => q.questionText === item.criterion)?.id;
            if (qId) {
                initialScores[qId] = item.score;
                initialFeedbacks[qId] = item.feedback;
            }
        });
        setEditedScores(initialScores);
        setEditedFeedbacks(initialFeedbacks);
        setIsEditing(false);
    };

    const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-foreground">Chi tiết câu trả lời</h2>
                {isTeacherOrAdmin && !isEditing && (
                    <button onClick={() => setIsEditing(true)} className="btn-outline px-4 py-2 text-sm flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5 font-bold">
                        <PencilIcon className="h-4 w-4" />
                        Chỉnh sửa điểm & nhận xét
                    </button>
                )}
            </div>

            {questions.map((q, index) => {
                const answer = submission.answers?.find(a => a.questionId === q.id);
                const feedbackItem = submission.feedback.detailedFeedback.find(item => (item.questionId || questions.find(q_find => q_find.questionText === item.criterion)?.id) === q.id);
                const isCorrect = feedbackItem ? feedbackItem.score === (q.maxScore ?? 1) : false;
                
                return (
                    <div key={q.id} className="bg-card p-6 rounded-xl border border-border shadow-sm">
                        <p className="font-bold text-foreground text-lg mb-4">Câu {index + 1}: {q.questionText}</p>
                        {q.questionType === 'multiple_choice' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                {q.options?.map(opt => {
                                    const isSelected = answer?.selectedOptionId === opt.id;
                                    const isCorrectAnswer = q.correctOptionId === opt.id;
                                    let stateClass = 'bg-background border-border opacity-70';
                                    if (isSelected && !isCorrectAnswer) stateClass = 'bg-red-50 border-red-200 ring-2 ring-red-500/20';
                                    if (isCorrectAnswer) stateClass = 'bg-green-50 border-green-200 ring-2 ring-green-500/20 font-bold opacity-100';

                                    return (
                                        <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${stateClass}`}>
                                            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-slate-300'}`}>
                                                {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                                            </div>
                                            <span className="text-sm">{opt.text}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mb-4">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Câu trả lời học sinh:</label>
                                <p className="p-4 bg-muted/30 rounded-xl whitespace-pre-wrap text-foreground italic border border-border">
                                    {answer?.writtenAnswer || <span className="text-muted-foreground italic">Không có câu trả lời</span>}
                                </p>
                            </div>
                        )}
                        <div className={`mt-4 pt-4 border-t border-dashed ${isCorrect ? 'border-green-300' : 'border-red-300'}`}>
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`p-1.5 rounded-full ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {isCorrect ? <CheckIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                                        </div>
                                        <h4 className="font-bold text-foreground text-sm">Nhận xét của AI:</h4>
                                    </div>
                                    {isEditing ? (
                                        <textarea 
                                            value={editedFeedbacks[q.id] || ''}
                                            onChange={e => setEditedFeedbacks(prev => ({...prev, [q.id]: e.target.value}))}
                                            className="w-full p-3 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
                                            rows={2}
                                            placeholder="Nhập nhận xét thủ công..."
                                        />
                                    ) : (
                                        <p className="text-muted-foreground text-sm pl-9 italic leading-relaxed">{feedbackItem?.feedback}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                     {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number"
                                                value={editedScores[q.id] ?? 0}
                                                onChange={e => setEditedScores(prev => ({...prev, [q.id]: Number(e.target.value)}))}
                                                className="w-16 p-2 text-right font-black text-base text-primary bg-background rounded-md border border-border focus:ring-2 focus:ring-primary/20"
                                                max={q.maxScore || 1}
                                                min={0}
                                                step="0.25"
                                            />
                                            <span className="text-xs font-bold text-muted-foreground">/{q.maxScore || 1}</span>
                                        </div>
                                     ) : (
                                        <div className="text-right">
                                            <span className={`font-black text-xl ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                                {feedbackItem?.score ?? 0}
                                            </span>
                                            <span className="text-xs font-bold text-muted-foreground">/{q.maxScore || 1}đ</span>
                                        </div>
                                     )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
             {isEditing && (
                <div className="flex justify-end gap-4 pt-4 border-t border-border sticky bottom-4 bg-background p-4 rounded-xl shadow-2xl z-20">
                    <button onClick={handleCancel} disabled={isPending} className="btn-secondary px-8 py-2.5">Hủy</button>
                    <button onClick={handleSave} disabled={isPending} className="btn-primary px-8 py-2.5 shadow-md">
                         {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            )}
        </div>
    );
};


export default function SubmissionResultPage({ params }: { params: { submissionId: string } }) {
    const { submissions, problems, users, currentUser, updateSubmission, isLoading, refetchData } = useDataContext();
    const router = useRouter();
    const [isRegrading, setIsRegrading] = useState(false);

    const submission = submissions.find(s => s.id === params.submissionId);

    if (isLoading) {
        return (
            <div className="container mx-auto p-20 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary mx-auto mb-4"></div>
                <p className="font-bold text-muted-foreground">Đang tải kết quả chấm bài...</p>
            </div>
        );
    }

    if (!submission || !currentUser) {
        notFound();
        return null;
    }
    
    // Authorization check
    if (currentUser.role !== 'admin' && currentUser.role !== 'teacher' && currentUser.id !== submission.submitterId) {
        router.replace('/dashboard');
        return null;
    }

    const problem = problems.find(p => p.id === submission.problemId);
    const submitter = users.find(u => u.id === submission.submitterId);
    const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';
    
    const historySubmissions = submissions
        .filter(s => s.problemId === submission.problemId && s.submitterId === submission.submitterId)
        .sort((a, b) => a.submittedAt - b.submittedAt);

    if (!problem || !submitter) {
        return <div className="container mx-auto p-8 text-center">Không thể tải dữ liệu bài nộp.</div>;
    }

    const handleSingleRegrade = async () => {
        if (!isTeacherOrAdmin || isRegrading) return;
        setIsRegrading(true);
        try {
            await regradeSelectedSubmissions(problem.id, [submission.id]);
            await refetchData();
        } catch (error) {
            alert("Lỗi khi chấm lại bài này. Vui lòng kiểm tra kết nối AI.");
        } finally {
            setIsRegrading(false);
            router.refresh();
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <Link href={`/problems/${problem.id}`} className="text-primary font-black flex items-center gap-2 hover:underline">
                    &larr; Quay lại bài tập "{problem.title}"
                </Link>
                
                {isTeacherOrAdmin && (
                    <button 
                        onClick={handleSingleRegrade}
                        disabled={isRegrading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-sm transition-all shadow-md active:scale-95 ${
                            isRegrading 
                            ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        title="Dùng AI chấm lại duy nhất bài này"
                    >
                        {isRegrading ? (
                            <>
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                Đang chấm lại...
                            </>
                        ) : (
                            <>
                                <ArrowPathIcon className="h-4 w-4" />
                                Chấm lại bài này
                            </>
                        )}
                    </button>
                )}
            </div>

            <header className="mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full mb-3">
                    Kết quả nộp bài
                </div>
                <h1 className="text-4xl font-black text-foreground mb-2">Báo cáo đánh giá</h1>
                <p className="text-muted-foreground font-medium">
                    Học sinh: <span className="text-foreground font-bold">{submitter.displayName}</span> • 
                    Nộp lúc {new Date(submission.submittedAt).toLocaleString('vi-VN')}
                </p>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {problem.type === 'essay' && (
                         <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
                            <h2 className="text-2xl font-black text-foreground mb-6 flex items-center gap-3">
                                <div className="h-8 w-1 bg-primary rounded-full"></div>
                                Bài làm của học sinh
                            </h2>
                            <div className="prose prose-slate max-w-none text-foreground/90 whitespace-pre-wrap leading-relaxed italic border-l-4 border-muted/50 pl-6 py-2">
                                {submission.essay}
                            </div>
                        </div>
                    )}
                    
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                        {problem.type === 'essay' ? (
                            <EssayResult 
                                submission={submission} 
                                problem={problem} 
                                currentUser={currentUser}
                                onUpdateSubmission={updateSubmission}
                            />
                        ) : (
                             <ReadingComprehensionResult 
                                problem={problem}
                                submission={submission}
                                currentUser={currentUser}
                                onUpdateSubmission={updateSubmission}
                            />
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-8">
                     {submission.similarityCheck && problem.type === 'essay' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-300">
                            <SimilarityCheckDisplay similarityCheck={submission.similarityCheck} />
                        </div>
                     )}
                     <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-400">
                        <SubmissionHistory 
                            submissions={historySubmissions} 
                            currentSubmissionId={submission.id}
                        />
                     </div>
                </div>
            </main>
        </div>
    );
}
