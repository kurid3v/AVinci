'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Problem, Submission, User } from '@/types';
import Leaderboard from '@/components/Leaderboard';
import StudentGraderView from '@/components/StudentGraderView';
import ReadingComprehensionSolver from './ReadingComprehensionSolver';
import { useDataContext } from '@/context/DataContext';
import { deleteProblem } from '@/app/actions';
import { regradeAllProblemSubmissions, regradeSelectedSubmissions } from '@/services/geminiService';
import TrashIcon from '@/components/icons/TrashIcon';
import ConfirmationModal from '@/components/ConfirmationModal';
import PencilIcon from '@/components/icons/PencilIcon';
import ArrowPathIcon from '@/components/icons/ArrowPathIcon';

interface ProblemDetailViewProps {
    problem: Problem;
    problemSubmissions: Submission[];
    users: Omit<User, 'password'>[];
    currentUser: Omit<User, 'password'> | null;
    teacherName: string;
}

const TeacherSubmissionsView: React.FC<{ 
    problem: Problem, 
    submissions: Submission[], 
    users: Omit<User, 'password'>[],
    onRegradeAll: () => void,
    onRegradeSelected: (selectedIds: string[]) => void,
    isRegrading: boolean,
}> = ({ problem, submissions, users, onRegradeAll, onRegradeSelected, isRegrading }) => {
    const router = useRouter();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    if (submissions.length === 0) {
        return (
            <div className="bg-card p-6 rounded-lg border border-dashed text-center">
                <p className="text-muted-foreground text-sm">Chưa có học sinh nào nộp bài.</p>
            </div>
        );
    }

    const toggleSelect = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(submissions.map(s => s.id));
        } else {
            setSelectedIds([]);
        }
    };

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="p-4 bg-muted/30 border-b border-border">
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-foreground text-sm">Danh sách bài nộp</h3>
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {submissions.length} bài
                        </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        {isRegrading ? (
                            <div className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-blue-600 animate-pulse bg-blue-50 rounded-lg border border-blue-100">
                                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                Đang chấm lại...
                            </div>
                        ) : (
                            <>
                                <button 
                                    onClick={onRegradeAll}
                                    className="flex-1 min-w-[100px] text-[10px] flex items-center justify-center gap-1.5 bg-white text-slate-700 border border-border hover:bg-slate-50 font-bold px-2 py-1.5 rounded-md transition-all shadow-sm"
                                >
                                    <ArrowPathIcon className="h-3 w-3" />
                                    Chấm lại tất cả
                                </button>
                                {selectedIds.length > 0 && (
                                    <button 
                                        onClick={() => onRegradeSelected(selectedIds)}
                                        className="flex-1 min-w-[100px] text-[10px] flex items-center justify-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 font-bold px-2 py-1.5 rounded-md transition-all shadow-md"
                                    >
                                        <ArrowPathIcon className="h-3 w-3" />
                                        Chấm {selectedIds.length} bài
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card z-10 border-b border-border">
                        <tr className="bg-muted/10">
                            <th className="p-3 text-left w-8">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.length === submissions.length && submissions.length > 0}
                                    onChange={toggleSelectAll}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                />
                            </th>
                            <th className="p-3 text-left font-bold text-muted-foreground uppercase text-[9px] tracking-wider">Học sinh</th>
                            <th className="p-3 text-right font-bold text-muted-foreground uppercase text-[9px] tracking-wider">Điểm</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {submissions.map(sub => {
                            const submitter = users.find(u => u.id === sub.submitterId);
                            const maxScore = sub.feedback.maxScore > 0 ? sub.feedback.maxScore : 1;
                            const displayScore = problem.type === 'reading_comprehension' 
                                ? `${sub.feedback.totalScore}/${maxScore}`
                                : sub.feedback.totalScore.toFixed(2);
                            const isSelected = selectedIds.includes(sub.id);
                            
                            return (
                                <tr 
                                    key={sub.id} 
                                    onClick={() => router.push(`/submissions/${sub.id}`)} 
                                    className={`group cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                                >
                                    <td className="p-3" onClick={(e) => toggleSelect(e, sub.id)}>
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            readOnly
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">{submitter?.displayName || 'Không rõ'}</div>
                                        <div className="text-[9px] text-muted-foreground">{new Date(sub.submittedAt).toLocaleDateString()}</div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <span className="font-black text-primary text-sm">{displayScore}</span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default function ProblemDetailView({ problem, problemSubmissions, users, currentUser, teacherName }: ProblemDetailViewProps) {
    const router = useRouter();
    const { addSubmissionAndSyncState, refetchData } = useDataContext();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [regradeType, setRegradeType] = useState<'all' | 'selected' | null>(null);
    const [selectedForRegrade, setSelectedForRegrade] = useState<string[]>([]);
    const [isRegrading, setIsRegrading] = useState(false);
    const [isPending, startTransition] = useTransition();

    if (!currentUser) return null;

    const userSubmissions = problemSubmissions.filter(s => s.submitterId === currentUser.id);

    const handleEssaySubmission = async (newSubmissionData: Omit<Submission, 'id' | 'submittedAt'>) => {
        try {
            const newSubmission = await addSubmissionAndSyncState(newSubmissionData);
            if (newSubmission && !newSubmission.examId) {
                router.push(`/submissions/${newSubmission.id}`);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleBatchRegrade = async () => {
        if (!regradeType) return;
        setIsRegrading(true);
        const currentType = regradeType;
        const currentSelected = [...selectedForRegrade];
        setRegradeType(null);
        setSelectedForRegrade([]);
        try {
            if (currentType === 'all') {
                await regradeAllProblemSubmissions(problem.id);
            } else {
                await regradeSelectedSubmissions(problem.id, currentSelected);
            }
            await refetchData();
        } catch (error) {
            console.error("Failed to batch regrade submissions:", error);
            alert("Đã xảy ra lỗi trong quá trình chấm lại.");
        } finally {
            setIsRegrading(false);
        }
    };

    const handleDeleteProblem = () => {
        startTransition(async () => {
            await deleteProblem(problem.id);
            await refetchData();
            router.push('/dashboard');
        });
    };

    const backPath = problem.examId ? `/exams/${problem.examId}` : '/dashboard';
    const backButtonText = problem.examId ? 'Quay lại đề thi' : 'Quay lại danh sách';
    
    const canEditOrDelete = currentUser.role === 'admin' || currentUser.id === problem.createdBy;

    return (
        <>
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <Link href={backPath} className="mb-6 text-primary font-bold flex items-center gap-2 hover:underline inline-flex">
                    &larr; {backButtonText}
                </Link>
                <header className="mb-10 p-6 bg-card rounded-xl shadow-sm border border-border relative">
                    {canEditOrDelete && (
                        <div className="absolute top-4 right-4 flex gap-2">
                            <button
                                onClick={() => router.push(`/problems/${problem.id}/edit`)}
                                className="px-4 py-2 text-sm bg-secondary text-secondary-foreground font-bold rounded-lg hover:bg-muted flex items-center gap-2 border border-border transition-colors"
                            >
                                <PencilIcon className="h-4 w-4" /> Sửa
                            </button>
                            <button
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="px-4 py-2 text-sm bg-destructive/10 text-destructive font-bold rounded-lg hover:bg-destructive/20 flex items-center gap-2"
                            >
                                <TrashIcon /> Xóa
                            </button>
                        </div>
                    )}
                    <h1 className="text-3xl font-black text-foreground pr-24 leading-tight">{problem.title}</h1>
                    <p className="text-muted-foreground mt-2 font-medium">Giao bởi: <span className="text-foreground">{teacherName}</span></p>
                    <div className="mt-4 text-foreground/90 whitespace-pre-wrap prose prose-slate max-w-none bg-muted/30 p-4 rounded-lg border border-border">
                        {problem.type === 'essay' ? problem.prompt : (
                            <div>
                                <h3 className="font-semibold text-lg mb-2 text-primary">Đoạn văn / Ngữ liệu:</h3>
                                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                                    {problem.passage}
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                <main>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            {problem.type === 'essay' && (currentUser.role !== 'student' || !problem.isRubricHidden) && (
                                <div>
                                    <h2 className="text-2xl font-black text-foreground mb-4">Hướng dẫn chấm</h2>
                                    <div className="p-6 bg-card rounded-xl border border-border space-y-4 shadow-sm">
                                        <h4 className="font-bold text-foreground">Thang điểm: {problem.customMaxScore || 10}</h4>
                                        <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">{problem.rawRubric || 'Sử dụng AI để tự động đánh giá dựa trên nội dung đề bài.'}</p>
                                    </div>
                                </div>
                            )}
                            <div>
                                <h2 className="text-2xl font-black text-foreground mb-4">
                                    {currentUser.role === 'student' ? 'Làm bài' : 'Chấm thử nghiệm'}
                                </h2>
                                {problem.type === 'essay' ? (
                                    <StudentGraderView problem={problem} user={currentUser} onSubmissionComplete={handleEssaySubmission} />
                                ) : (
                                    <ReadingComprehensionSolver problem={problem} user={currentUser} onSubmissionComplete={handleEssaySubmission} />
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-1 space-y-8">
                            {currentUser.role === 'student' && (
                                <div>
                                    <h2 className="text-xl font-black text-foreground mb-4">Lịch sử nộp bài</h2>
                                    {userSubmissions.length > 0 ? (
                                        <div className="space-y-3">
                                            {userSubmissions.map(sub => (
                                                <Link key={sub.id} href={`/submissions/${sub.id}`} className="block bg-card p-4 rounded-xl border border-border hover:bg-primary/5 transition-all">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-muted-foreground">{new Date(sub.submittedAt).toLocaleString()}</span>
                                                        <span className="font-black text-primary">{sub.feedback.totalScore.toFixed(2)}</span>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-sm">Chưa có bài nộp nào.</p>
                                    )}
                                </div>
                            )}
                            {(currentUser.role === 'teacher' || currentUser.role === 'admin') && (
                                <div>
                                    <h2 className="text-xl font-black text-foreground mb-4">Quản lý lớp</h2>
                                    <TeacherSubmissionsView 
                                        problem={problem} 
                                        submissions={problemSubmissions} 
                                        users={users} 
                                        onRegradeAll={() => setRegradeType('all')}
                                        onRegradeSelected={(ids) => {
                                            setSelectedForRegrade(ids);
                                            setRegradeType('selected');
                                        }}
                                        isRegrading={isRegrading}
                                    />
                                </div>
                            )}
                            <Leaderboard submissions={problemSubmissions} users={users} />
                        </div>
                    </div>
                </main>
            </div>
            
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteProblem}
                title="Xác nhận xóa bài tập"
                message="Bạn có chắc chắn muốn xóa bài tập này? Tất cả các bài nộp sẽ bị mất vĩnh viễn."
            />
            
            <ConfirmationModal
                isOpen={!!regradeType}
                onClose={() => setRegradeType(null)}
                onConfirm={handleBatchRegrade}
                title="Xác nhận chấm lại"
                message="Hệ thống sẽ chấm lại bài dựa trên biểu điểm hiện tại. Điểm số và nhận xét cũ sẽ bị ghi đè."
                confirmButtonText="Chấm lại ngay"
            />
        </>
    );
}
