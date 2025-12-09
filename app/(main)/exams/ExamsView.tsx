
'use client';
import React, { useState, useTransition, useOptimistic, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { removeExam } from '@/app/actions';
import type { Exam, Problem, User, Classroom } from '@/types';
import ClockIcon from '@/components/icons/ClockIcon';
import LockClosedIcon from '@/components/icons/LockClosedIcon';
import TrashIcon from '@/components/icons/TrashIcon';
import ConfirmationModal from '@/components/ConfirmationModal';
import ClipboardListIcon from '@/components/icons/ClipboardListIcon';
import QuestionMarkCircleIcon from '@/components/icons/QuestionMarkCircleIcon';

interface ExamsViewProps {
    initialExams: Exam[];
    problems: Problem[];
    currentUser: Omit<User, 'password'>;
    classrooms: Classroom[];
}

export default function ExamsView({ initialExams, problems, currentUser, classrooms }: ExamsViewProps) {
  const router = useRouter();
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  // Optimistic UI for deletions
  const [optimisticExams, setOptimisticExams] = useOptimistic(
    initialExams,
    (state, examId: string) => state.filter(e => e.id !== examId)
  );
  
  const [isPending, startTransition] = useTransition();

  const filteredExams = useMemo(() => {
    if (currentUser.role === 'student') {
        const studentClassroomIds = classrooms
            .filter(c => c.studentIds.includes(currentUser.id))
            .map(c => c.id);
        
        return optimisticExams.filter(e => 
            !e.classroomIds || e.classroomIds.length === 0 || e.classroomIds.some(cid => studentClassroomIds.includes(cid))
        );
    }
    return optimisticExams;
  }, [optimisticExams, currentUser, classrooms]);

  const handleDeleteClick = (e: React.MouseEvent, exam: Exam) => {
    e.stopPropagation();
    setExamToDelete(exam);
  };
  
  const confirmDelete = () => {
    if (examToDelete) {
      startTransition(async () => {
        setOptimisticExams(examToDelete.id); // Optimistically remove from UI
        await removeExam(examToDelete.id); // Call server action
      });
      setExamToDelete(null);
    }
  };

  const getProblemCountForExam = (examId: string) => {
    return problems.filter(p => p.examId === examId).length;
  };
  
  const getExamStatus = (startTime: number, endTime: number): { text: string; color: string } => {
    const now = Date.now();
    if (now < startTime) {
      return { text: 'Sắp diễn ra', color: 'bg-blue-100 text-blue-800' };
    } else if (now >= startTime && now <= endTime) {
      return { text: 'Đang diễn ra', color: 'bg-green-100 text-green-800' };
    } else {
      return { text: 'Đã kết thúc', color: 'bg-slate-100 text-slate-800' };
    }
  };

  const ExamCard: React.FC<{ exam: Exam }> = ({ exam }) => {
    const problemCount = getProblemCountForExam(exam.id);
    const status = getExamStatus(exam.startTime, exam.endTime);
    return (
        <div 
            className="bg-card p-6 rounded-xl shadow-card hover:shadow-card-hover border border-border flex flex-col cursor-pointer relative group transition-all duration-200"
            onClick={() => router.push(`/exams/${exam.id}`)}
        >
            {(currentUser.role === 'teacher' || currentUser.role === 'admin') && (
              <button
                onClick={(e) => handleDeleteClick(e, exam)}
                className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Xóa đề thi ${exam.title}`}
                title="Xóa đề thi"
              >
                <TrashIcon />
              </button>
            )}
            <div className="flex-grow">
                <div className="flex justify-between items-start gap-4">
                    <h3 className="font-bold text-foreground flex-1 pr-8">{exam.title}</h3>
                     <span className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap ${status.color}`}>
                        {status.text}
                    </span>
                </div>
                <p className="text-muted-foreground mt-2 text-sm h-10 overflow-hidden text-ellipsis">{exam.description || 'Không có mô tả.'}</p>
            </div>
            <div className="mt-4 border-t border-border/80 pt-4 flex justify-between items-center text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5" title={`${problemCount} câu hỏi`}>
                        <ClipboardListIcon className="h-4 w-4" />
                        <span className="font-semibold">{problemCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title={`Bắt đầu lúc: ${new Date(exam.startTime).toLocaleString('vi-VN')}`}>
                        <ClockIcon />
                        <span>{new Date(exam.startTime).toLocaleDateString('vi-VN')}</span>
                    </div>
                </div>
                {exam.password && (
                    <div className="flex items-center gap-1.5" title="Có mật khẩu">
                        <LockClosedIcon className="h-4 w-4"/>
                    </div>
                )}
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
                        Danh sách đề thi
                    </h1>
                    <button 
                        onClick={() => setShowGuide(true)} 
                        className="text-muted-foreground hover:text-primary transition-colors" 
                        title="Hướng dẫn"
                    >
                        <QuestionMarkCircleIcon className="h-6 w-6" />
                    </button>
              </div>
              {(currentUser.role === 'teacher' || currentUser.role === 'admin') && (
                  <button
                      onClick={() => router.push('/exams/create')}
                      className="btn-primary px-5 py-2.5"
                  >
                      + Tạo đề thi mới
                  </button>
              )}
          </div>

          
          {filteredExams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExams.map(exam => (
                  <ExamCard key={exam.id} exam={exam} />
              ))}
            </div>
          ) : (
               <div className="text-center py-20 bg-card rounded-xl border-2 border-dashed">
                     <h3 className="text-xl font-semibold text-foreground">Không có đề thi nào</h3>
                     <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                        {currentUser.role === 'student' 
                          ? 'Hiện tại chưa có kỳ thi nào được tổ chức.'
                          : 'Bạn chưa tạo đề thi nào. Nhấn nút "Tạo đề thi mới" để bắt đầu.'
                        }
                    </p>
                    {(currentUser.role === 'teacher' || currentUser.role === 'admin') && (
                      <button
                        onClick={() => router.push('/exams/create')}
                        className="mt-6 btn-primary px-5 py-2.5"
                      >
                        Tạo đề thi đầu tiên
                      </button>
                    )}
              </div>
          )}
      </div>
      <ConfirmationModal
          isOpen={!!examToDelete}
          onClose={() => setExamToDelete(null)}
          onConfirm={confirmDelete}
          title="Xác nhận xóa đề thi"
          message={`Bạn có chắc chắn muốn xóa đề thi "${examToDelete?.title}" không? Hành động này không thể hoàn tác và sẽ xóa vĩnh viễn tất cả các câu hỏi liên quan.`}
      />
      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowGuide(false)}>
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <QuestionMarkCircleIcon className="text-blue-600" />
                    Hướng dẫn: Đề thi
                </h3>
                <div className="space-y-3 text-slate-600">
                    <p>Đề thi khác với bài tập ở chỗ có giới hạn thời gian nghiêm ngặt và tính năng giám sát.</p>
                    {currentUser.role === 'student' ? (
                        <ul className="list-disc list-inside space-y-1">
                            <li>Chỉ có thể làm bài trong khung giờ "Đang diễn ra".</li>
                            <li>Hệ thống yêu cầu bật chế độ <strong>Toàn màn hình</strong> trong suốt quá trình làm bài.</li>
                            <li>Mọi hành động thoát màn hình hoặc chuyển tab đều sẽ được ghi lại và báo cáo cho giáo viên.</li>
                        </ul>
                    ) : (
                        <ul className="list-disc list-inside space-y-1">
                            <li>Thiết lập thời gian bắt đầu và kết thúc cụ thể.</li>
                            <li>Có thể đặt <strong>Mật khẩu</strong> để bảo vệ đề thi.</li>
                            <li>Sau khi thi, bạn có thể xem <strong>Báo cáo giám sát</strong> để biết học sinh nào đã vi phạm quy chế (rời màn hình, mất tập trung).</li>
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
  );
};
