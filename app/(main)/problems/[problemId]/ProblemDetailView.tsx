
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Problem, Submission, User, Answer } from '@/types';
import Leaderboard from '@/components/Leaderboard';
import StudentGraderView from '@/components/StudentGraderView';
import ReadingComprehensionSolver from './ReadingComprehensionSolver'; // New component
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

// Teacher/Admin view of submissions for this problem
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
                <p className="text-muted-foreground">Chưa có học sinh nào nộp bài.</p>
            </div>
        );
    }

    const toggleSelect = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === submissions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(submissions.map(s => s.id));
        }
    };

    return (
        <div className="bg-card p-4 rounded-xl shadow-sm border border-border">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h3 className="font-semibold text-foreground">Danh sách bài nộp</h3>
                <div className="flex items-center gap-2">
                    {isRegrading ? (
                        <span className="text-sm font-semibold text-blue-600 animate-pulse flex items-center gap-2">
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            Đang xử lý...
                        </span>
                    ) : (
                        <>
                            {selectedIds.length > 0 && (
                                <button 
                                    onClick={() => onRegradeSelected(selectedIds)}
                                    className="text-sm flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 font-semibold px-3 py-1.5 rounded-md transition-colors"
                                    title="Chấm lại các bài đã chọn"
                                >
                                    <ArrowPathIcon className="h-4 w-4" />
                                    Chấm lại đã chọn ({selectedIds.length})
                                </button>
                            )}
                            <button 
                                onClick={onRegradeAll}
                                className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold px-2 py-1.5 rounded hover:bg-blue-50 transition-colors"
                                title="Dùng AI chấm lại toàn bộ bài nộp theo cấu hình hiện tại"
                            >
                                <ArrowPathIcon className="h-4 w-4" />
                                Chấm lại tất cả
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="overflow-auto max-h-[500px]">
                <table className="w-full">
                    <thead className="sticky top-0 bg-card z-10 shadow-sm">
                        <tr className="border-b border-border">
                            <th className="p-3 text-left w-10">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.length === submissions.length && submissions.length > 0}
                                    onChange={toggleSelectAll}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                            </th>
                            <th className="p-3 text-left text-sm font-semibold text-muted-foreground">Học sinh</th>
                            <th className="p-3 text-left text-sm font-semibold text-muted-foreground">Ngày nộp</th>
                            <th className="p-3 text-right text-sm font-semibold text-muted-foreground">Điểm</th>
                        </tr>
                    </thead>
                    <tbody>
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
                                    className={`cursor-pointer border-b border-border last:border-b-0 transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                                >
                                    <td className="p-3" onClick={(e) => toggleSelect(e, sub.id)}>
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected}
                                            onChange={() => {}} // Handled by tr onClick
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                    </td>
                                    <td className="p-3 font-semibold text-foreground">{submitter?.displayName || 'Không rõ'}</td>
                                    <td className="p-3 text-muted-foreground text-sm">{new Date(sub.submittedAt).toLocaleString()}</td>
                                    <td className="p-3 font-bold text-primary text-right">{displayScore}</td>
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

    if (!currentUser) {
        return null;
    }

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
        setRegradeType(null);
        try {
            if (regradeType === 'all') {
                await regradeAllProblemSubmissions(problem.id);
            } else {
                await regradeSelectedSubmissions(problem.id, selectedForRegrade);
            }
            await refetchData();
            setSelectedForRegrade([]);
        } catch (error) {
            console.error("Failed to batch regrade submissions:", error);
            alert("Đã xảy ra lỗi trong quá trình chấm lại. Một số bài có thể chưa được cập nhật.");
        } finally {
            setIsRegrading(false);
            router.refresh();
        }
    };

    const handleDeleteProblem = () => {
        startTransition(async () => {
            await deleteProblem(problem.id);
            router.push('/dashboard');
        });
    };

    const backPath = problem.examId ? `/exams/${problem.examId}` : '/dashboard';
    const backButtonText = problem.examId ? 'Quay lại đề thi' : 'Quay lại danh sách';
    
    const renderProblemContent = () => {
        if (problem.type === 'reading_comprehension') {
            return (
                <div className="mt-4 text-foreground/90 whitespace-pre-wrap prose prose-slate max-w-none">
                    <h3 className="font-semibold text-lg mb-2">Đoạn văn:</h3>
                    <p>{problem.passage}</p>
                </div>
            );
        }
        return <div className="mt-4 text-foreground/90 whitespace-pre-wrap prose prose-slate max-w-none">{problem.prompt}</div>;
    };

    const canEditOrDelete = currentUser.role === 'admin' || currentUser.id === problem.createdBy;

    return (
        <>
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <Link href={backPath} className="mb-6 text-primary font-semibold hover:underline inline-block">
                    &larr; {backButtonText}
                </Link>
                <header className="mb-10 p-6 bg-card rounded-xl shadow-sm border border-border relative">
                    {canEditOrDelete && (
                        <div className="absolute top-4 right-4 flex gap-2">
                            <button
                                onClick={() => router.push(`/problems/${problem.id}/edit`)}
                                className="px-4 py-2 text-sm bg-secondary text-secondary-foreground font-semibold rounded-md hover:bg-muted flex items-center gap-2"
                                disabled={isPending}
                            >
                                <PencilIcon className="h-5 w-5" /> Sửa
                            </button>
                            <button
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="px-4 py-2 text-sm bg-destructive/10 text-destructive font-semibold rounded-md hover:bg-destructive/20 flex items-center gap-2 disabled:opacity-50"
                                disabled={isPending}
                            >
                                <TrashIcon /> Xóa
                            </button>
                        </div>
                    )}
                    <h1 className="text-3xl font-bold text-foreground pr-24">{problem.title}</h1>
                    <p className="text-muted-foreground mt-2">Giao bởi: {teacherName}</p>
                    {renderProblemContent()}
                </header>

                <main>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left/Main Column */}
                        <div className="lg:col-span-2 space-y-8">
                        {/* Rubric/Instructions for Essay */}
                        {problem.type === 'essay' && (currentUser.role !== 'student' || !problem.isRubricHidden) && (
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-4">Hướng dẫn chấm</h2>
                                    <div className="p-6 bg-card rounded-xl border border-border space-y-4">
                                        <div>
                                            <h4 className="font-semibold text-foreground">Thang điểm:</h4>
                                            <p className="text-muted-foreground">Bài làm sẽ được chấm và quy đổi về thang điểm <strong>{problem.customMaxScore || 10}</strong>.</p>
                                        </div>
                                        {(problem.rawRubric || (problem.rubricItems && problem.rubricItems.length > 0)) && (
                                            <div className="pt-4 border-t border-border">
                                                <h4 className="font-semibold text-foreground mb-2">Biểu điểm chi tiết:</h4>
                                                {problem.rawRubric && problem.rawRubric.trim() ? (
                                                    <p className="text-muted-foreground whitespace-pre-wrap">{problem.rawRubric}</p>
                                                ) : problem.rubricItems && problem.rubricItems.length > 0 ? (
                                                    <>
                                                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">{problem.rubricItems.map(item => (<li key={item.id}><strong>{item.criterion}:</strong> {item.maxScore} điểm</li>))}</ul>
                                                        <p className="text-right font-bold text-foreground mt-2">Tổng điểm biểu điểm: {problem.rubricItems.reduce((sum, item) => sum + item.maxScore, 0)}</p>
                                                    </>
                                                ) : null}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div>
                                <h2 className="text-2xl font-bold text-foreground mb-4">
                                    {currentUser.role === 'student' ? 'Làm bài' : 'Chấm thử nghiệm'}
                                </h2>
                                {problem.type === 'essay' ? (
                                    <StudentGraderView problem={problem} user={currentUser} onSubmissionComplete={handleEssaySubmission} />
                                ) : (
                                    <ReadingComprehensionSolver problem={problem} user={currentUser} onSubmissionComplete={handleEssaySubmission} />
                                )}
                            </div>
                        </div>

                        {/* Right Sidebar */}
                        <div className="lg:col-span-1 space-y-8">
                            {currentUser.role === 'student' && (
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-4">Lịch sử nộp bài</h2>
                                    {userSubmissions.length > 0 ? (
                                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                        {userSubmissions.map(sub => {
                                            const displayScore = problem.type === 'reading_comprehension'
                                                ? `${sub.feedback.totalScore}/${sub.feedback.maxScore}`
                                                : `${sub.feedback.totalScore.toFixed(2)} điểm`;
                                            return (
                                                <Link key={sub.id} href={`/submissions/${sub.id}`} className="w-full text-left block bg-card p-4 rounded-lg shadow-sm border border-border hover:bg-muted/50 hover:border-primary/50">
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-muted-foreground text-sm">{new Date(sub.submittedAt).toLocaleString()}</p>
                                                        <p className="font-bold text-lg text-primary">{displayScore}</p>
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                    ) : (
                                        <div className="bg-card p-6 rounded-lg border border-dashed text-center"><p className="text-muted-foreground">Bạn chưa nộp bài nào.</p></div>
                                    )}
                                </div>
                            )}
                            {(currentUser.role === 'teacher' || currentUser.role === 'admin') && (
                                <div>
                                    <h2 className="text-2xl font-bold text-foreground mb-4">Quản lý bài nộp</h2>
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
                            <div>
                            <h2 className="text-2xl font-bold text-foreground mb-4">Bảng xếp hạng</h2>
                            <Leaderboard submissions={problemSubmissions} users={users} />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteProblem}
                title="Xác nhận xóa bài tập"
                message={`Bạn có chắc chắn muốn xóa bài tập "${problem.title}" không? Hành động này sẽ xóa vĩnh viễn tất cả các bài nộp liên quan.`}
            />
            <ConfirmationModal
                isOpen={!!regradeType}
                onClose={() => {
                    setRegradeType(null);
                    setSelectedForRegrade([]);
                }}
                onConfirm={handleBatchRegrade}
                title={regradeType === 'all' ? "Xác nhận chấm lại toàn bộ" : `Xác nhận chấm lại ${selectedForRegrade.length} bài`}
                message={regradeType === 'all' 
                    ? "Hành động này sẽ gửi tất cả bài nộp của học sinh đến AI để chấm điểm lại dựa trên hướng dẫn chấm hiện tại. Điểm số cũ sẽ bị ghi đè." 
                    : `Bạn đã chọn ${selectedForRegrade.length} bài để chấm lại. Điểm số của các bài này sẽ được cập nhật dựa trên biểu điểm hiện tại.`}
                confirmButtonText="Chấm lại ngay"
                confirmButtonClass="bg-blue-600 hover:bg-blue-700"
            />
        </>
    );
}
