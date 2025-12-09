
'use client';
import React, { useState, useMemo, useTransition } from 'react';
import { useDataContext } from '@/context/DataContext';
import { useSession } from '@/context/SessionContext';
import type { Classroom, User } from '@/types';
import { createClassroom, joinClassroom, joinPublicClassroom, leaveClassroom, deleteClassroom, removeStudentFromClass } from '@/app/actions';
import ConfirmationModal from '@/components/ConfirmationModal';
import UsersIcon from '@/components/icons/UsersIcon';
import TrashIcon from '@/components/icons/TrashIcon';
import Link from 'next/link';
import QuestionMarkCircleIcon from '@/components/icons/QuestionMarkCircleIcon';

// Teacher's view for creating a new class
const CreateClassModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { currentUser } = useSession();
    const [name, setName] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const { refetchData } = useDataContext();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !currentUser) return;
        setError('');
        startTransition(async () => {
            try {
                await createClassroom(name, currentUser.id, isPublic);
                await refetchData();
                onClose();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Lỗi không xác định');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-card rounded-xl shadow-lg p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4">Tạo lớp học mới</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <p className="text-destructive mb-4">{error}</p>}
                    <div>
                        <label htmlFor="class-name" className="font-semibold mb-2 block">Tên lớp học</label>
                        <input
                            id="class-name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ví dụ: Văn 12A1"
                            className="w-full px-4 py-2 border border-border rounded-md"
                            required
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <input 
                            id="is-public"
                            type="checkbox"
                            checked={isPublic}
                            onChange={e => setIsPublic(e.target.checked)}
                            className="h-5 w-5 rounded form-checkbox text-primary focus:ring-primary"
                        />
                        <label htmlFor="is-public" className="text-foreground">
                            Công khai lớp học này?
                            <span className="block text-xs text-muted-foreground">Học sinh có thể thấy và tham gia không cần mã.</span>
                        </label>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="btn-secondary px-6 py-2">Hủy</button>
                        <button type="submit" disabled={isPending || !name.trim()} className="btn-primary px-6 py-2 disabled:opacity-50">
                            {isPending ? 'Đang tạo...' : 'Tạo lớp'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Student's view for joining a class
const JoinClassForm: React.FC = () => {
    const { currentUser } = useSession();
    const [joinCode, setJoinCode] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { refetchData } = useDataContext();

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim() || !currentUser) return;
        setError('');
        setSuccess('');
        startTransition(async () => {
            try {
                await joinClassroom(joinCode, currentUser.id);
                await refetchData();
                setSuccess('Tham gia lớp học thành công!');
                setJoinCode('');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Lỗi không xác định');
            }
        });
    };

    return (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
            <h2 className="text-xl font-bold mb-4">Tham gia bằng mã</h2>
            <form onSubmit={handleJoin} className="flex items-start gap-2">
                <div className="flex-grow">
                    <input
                        type="text"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value)}
                        placeholder="Nhập mã lớp..."
                        className="w-full px-4 py-2 border border-border rounded-md"
                        required
                    />
                    {error && <p className="text-destructive text-sm mt-1">{error}</p>}
                    {success && <p className="text-green-600 text-sm mt-1">{success}</p>}
                </div>
                <button type="submit" disabled={isPending || !joinCode.trim()} className="btn-primary px-6 py-2 disabled:opacity-50">
                    {isPending ? '...' : 'Tham gia'}
                </button>
            </form>
        </div>
    );
};


export default function ClassroomsPage() {
    const { currentUser } = useSession();
    const { classrooms, users, isLoading, refetchData } = useDataContext();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [classToLeave, setClassToLeave] = useState<Classroom | null>(null);
    const [classToDelete, setClassToDelete] = useState<Classroom | null>(null);
    const [studentToRemove, setStudentToRemove] = useState<{classId: string, student: User} | null>(null);
    const [isPending, startTransition] = useTransition();
    const [showGuide, setShowGuide] = useState(false);

    const userClassrooms = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === 'teacher') {
            return classrooms.filter(c => c.teacherId === currentUser.id);
        }
        if (currentUser.role === 'student') {
            return classrooms.filter(c => c.studentIds.includes(currentUser.id));
        }
        return classrooms; // Admin sees all
    }, [classrooms, currentUser]);

    const publicClassrooms = useMemo(() => {
        if (!currentUser || currentUser.role !== 'student') return [];
        // Show public classrooms that the student hasn't joined yet
        return classrooms.filter(c => c.isPublic && !c.studentIds.includes(currentUser.id));
    }, [classrooms, currentUser]);

    const handleLeaveClass = () => {
        if (!classToLeave || !currentUser) return;
        startTransition(async () => {
            await leaveClassroom(classToLeave.id, currentUser.id);
            await refetchData();
            setClassToLeave(null);
        });
    };

    const handleDeleteClass = () => {
        if (!classToDelete) return;
        startTransition(async () => {
            await deleteClassroom(classToDelete.id);
            await refetchData();
            setClassToDelete(null);
        });
    };
    
    const handleRemoveStudent = () => {
        if (!studentToRemove) return;
        startTransition(async () => {
            await removeStudentFromClass(studentToRemove.classId, studentToRemove.student.id);
            await refetchData();
            setStudentToRemove(null);
        });
    }

    const handleJoinPublic = (classId: string) => {
        if (!currentUser) return;
        startTransition(async () => {
            try {
                await joinPublicClassroom(classId, currentUser.id);
                await refetchData();
                alert("Đã tham gia lớp học!");
            } catch (err) {
                alert(err instanceof Error ? err.message : "Lỗi khi tham gia lớp học.");
            }
        });
    };

    if (isLoading) {
        return <div className="p-8 text-center">Đang tải...</div>
    }
    
    if (!currentUser) return null;

    const ClassroomCard: React.FC<{ classroom: Classroom, isAvailablePublic?: boolean }> = ({ classroom, isAvailablePublic }) => {
        const teacher = users.find(u => u.id === classroom.teacherId);
        
        const handleCopyCode = () => {
            navigator.clipboard.writeText(classroom.joinCode);
            // Optionally, show a toast notification
        };

        return (
            <div className="bg-card p-6 rounded-xl shadow-card border border-border flex flex-col justify-between h-full relative">
                {classroom.isPublic && (
                    <span className="absolute top-4 right-4 bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">
                        Công khai
                    </span>
                )}
                <div>
                    <div className="flex justify-between items-start pr-16">
                        <h3 className="text-xl font-bold text-foreground">{classroom.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                        <UsersIcon className="h-4 w-4" />
                        <span>{classroom.studentIds.length} học sinh</span>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        GV: {currentUser.role === 'teacher' ? currentUser.displayName : (teacher?.displayName || 'N/A')}
                    </p>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                    {currentUser.role !== 'student' && (
                        <div className="mb-4">
                            <label className="text-sm font-semibold text-muted-foreground">Mã tham gia</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input type="text" readOnly value={classroom.joinCode} className="flex-grow p-2 bg-secondary rounded-md font-mono tracking-widest" />
                                <button onClick={handleCopyCode} className="btn-secondary py-2 px-3">Sao chép</button>
                            </div>
                        </div>
                    )}
                     <div className="flex gap-2">
                        {isAvailablePublic ? (
                             <button onClick={() => handleJoinPublic(classroom.id)} disabled={isPending} className="w-full btn-primary py-2">
                                {isPending ? 'Đang tham gia...' : 'Tham gia ngay'}
                             </button>
                        ) : (
                            <>
                                {currentUser.role !== 'student' && (
                                   <Link href={`/classrooms/${classroom.id}`} className="flex-1 text-center btn-outline py-2">Quản lý</Link>
                                )}
                                {currentUser.role === 'student' && (
                                    <button onClick={() => setClassToLeave(classroom)} className="w-full btn-destructive py-2">Rời lớp</button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <div className="flex justify-between items-center mb-8">
                     <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-foreground">
                            Lớp học của tôi
                        </h1>
                        <button 
                            onClick={() => setShowGuide(true)} 
                            className="text-muted-foreground hover:text-primary transition-colors" 
                            title="Hướng dẫn"
                        >
                            <QuestionMarkCircleIcon className="h-6 w-6" />
                        </button>
                    </div>
                    {currentUser.role !== 'student' && (
                        <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary px-5 py-2.5">
                            + Tạo lớp học mới
                        </button>
                    )}
                </div>
                
                {currentUser.role === 'student' && <div className="mb-8"><JoinClassForm/></div>}
                
                {/* My Classrooms */}
                <h2 className="text-xl font-bold text-foreground mb-4">Danh sách lớp đã tham gia</h2>
                {userClassrooms.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                        {userClassrooms.map(c => <ClassroomCard key={c.id} classroom={c} />)}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-card rounded-xl border-2 border-dashed mb-10">
                        <h3 className="text-lg font-semibold text-foreground">Không có lớp học nào</h3>
                        <p className="text-muted-foreground mt-2">
                            {currentUser.role === 'student' ? 'Bạn chưa tham gia lớp học nào.' : 'Bạn chưa tạo lớp học nào. Hãy bắt đầu ngay!'}
                        </p>
                    </div>
                )}

                {/* Public Classrooms for Students */}
                {currentUser.role === 'student' && publicClassrooms.length > 0 && (
                    <>
                        <h2 className="text-xl font-bold text-foreground mb-4">Lớp học công khai gợi ý</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {publicClassrooms.map(c => <ClassroomCard key={c.id} classroom={c} isAvailablePublic={true} />)}
                        </div>
                    </>
                )}
            </div>
            {isCreateModalOpen && <CreateClassModal onClose={() => setIsCreateModalOpen(false)} />}
            <ConfirmationModal 
                isOpen={!!classToLeave}
                onClose={() => setClassToLeave(null)}
                onConfirm={handleLeaveClass}
                title="Xác nhận rời lớp"
                message={`Bạn có chắc chắn muốn rời khỏi lớp "${classToLeave?.name}"?`}
                confirmButtonText="Rời lớp"
                confirmButtonClass="bg-destructive hover:bg-destructive/90"
            />
             {/* Guide Modal */}
             {showGuide && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowGuide(false)}>
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <QuestionMarkCircleIcon className="text-blue-600" />
                            Hướng dẫn: Lớp học
                        </h3>
                        <div className="space-y-3 text-slate-600">
                            <p>Tính năng Lớp học giúp tổ chức việc giảng dạy và giao bài theo nhóm học sinh.</p>
                            {currentUser.role === 'student' ? (
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Nhập <strong>Mã tham gia</strong> (do giáo viên cung cấp) để vào lớp kín.</li>
                                    <li>Hoặc tìm và tham gia các <strong>Lớp học công khai</strong> có sẵn trong danh sách gợi ý.</li>
                                    <li>Khi vào lớp, bạn sẽ thấy các bài tập và đề thi dành riêng cho lớp đó.</li>
                                </ul>
                            ) : (
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Tạo lớp học mới và gửi <strong>Mã tham gia</strong> cho học sinh.</li>
                                    <li>Bạn có thể chọn "Công khai" để cho phép học sinh tự do tham gia mà không cần mã.</li>
                                    <li>Vào chi tiết lớp học để xem danh sách học sinh và quản lý thành viên (xóa học sinh nếu cần).</li>
                                </ul>
                            )}
                        </div>
                        <div className="mt-6 text-center">
                            <button onClick={() => setShowGuide(false)} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg">Đã hiểu</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
