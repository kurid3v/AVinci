
'use client';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDataContext } from '@/context/DataContext';
import CalendarIcon from '@/components/icons/CalendarIcon';
import LockClosedIcon from '@/components/icons/LockClosedIcon';
import PasswordModal from '@/components/PasswordModal';
import EyeOffIcon from '@/components/icons/EyeOffIcon';
import ExclamationIcon from '@/components/icons/ExclamationIcon';
import ChartBarIcon from '@/components/icons/ChartBarIcon';
import type { Problem, ExamAttempt, Submission, User } from '@/types';


export default function ExamDetailPage({ params }: { params: { examId: string } }) {
  const router = useRouter();
  const { exams, problems, currentUser, users, examAttempts, submissions, startExamAttempt } = useDataContext();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [activeTab, setActiveTab] = useState<'questions' | 'monitoring' | 'leaderboard'>('questions');
  
  if (!currentUser) return null;

  const exam = exams.find(e => e.id === params.examId);
  if (!exam) return <p className="p-8">Lỗi: Không tìm thấy đề thi.</p>;

  const examProblems = problems.filter(p => p.examId === exam.id);
  const now = Date.now();
  const isExamOngoing = now >= exam.startTime && now <= exam.endTime;
  
  const userAttemptForThisExam = examAttempts.find(att => att.examId === exam.id && att.studentId === currentUser.id);
  const ongoingGlobalAttempt = examAttempts.find(att => att.studentId === currentUser.id && !att.submittedAt);
  const otherOngoingExam = ongoingGlobalAttempt && ongoingGlobalAttempt.examId !== exam.id 
    ? exams.find(e => e.id === ongoingGlobalAttempt.examId) 
    : null;

  const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';

  const proceedToExam = async () => {
    if (userAttemptForThisExam) {
      router.push(`/exams/${exam.id}/take/${userAttemptForThisExam.id}`);
    } else {
      const newAttempt = await startExamAttempt(exam.id);
      if (newAttempt) {
        router.push(`/exams/${exam.id}/take/${newAttempt.id}`);
      }
    }
  };

  const handleStartExamClick = () => {
    if (exam.password) {
      setIsPasswordModalOpen(true);
    } else {
      proceedToExam();
    }
  };

  const handlePasswordSubmit = (password: string) => {
    if (password === exam.password) {
      setPasswordError('');
      setIsPasswordModalOpen(false);
      proceedToExam();
    } else {
      setPasswordError('Mật khẩu không chính xác.');
    }
  };

  const studentAttempts = examAttempts.filter(att => att.examId === exam.id);

  const ProblemRow: React.FC<{ problem: Problem; index: number }> = ({ problem, index }) => (
    <tr 
        className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer"
        onClick={() => router.push(`/problems/${problem.id}`)}
    >
        <td className="p-3 text-center font-semibold text-slate-600">{index + 1}</td>
        <td className="p-3 font-semibold text-slate-800">{problem.title}</td>
        <td className="p-3 text-slate-600 truncate max-w-sm">{problem.prompt || problem.passage}</td>
        <td className="p-3 text-right font-bold text-blue-600">{problem.customMaxScore || 10}</td>
    </tr>
  );

  const LeaderboardTab: React.FC = () => {
    const examSubmissions = submissions.filter(s => s.examId === exam.id);
    
    const ranking = useMemo(() => {
        const scoresMap = new Map<string, { total: number, count: number }>();
        
        examSubmissions.forEach(sub => {
            const current = scoresMap.get(sub.submitterId) || { total: 0, count: 0 };
            scoresMap.set(sub.submitterId, {
                total: current.total + sub.feedback.totalScore,
                count: current.count + 1
            });
        });

        return Array.from(scoresMap.entries())
            .map(([userId, data]) => ({
                user: users.find(u => u.id === userId),
                ...data
            }))
            .filter(item => item.user)
            .sort((a, b) => b.total - a.total);
    }, [examSubmissions, users]);

    const maxPossibleScore = examProblems.reduce((sum, p) => sum + (p.customMaxScore || 10), 0);

    if (ranking.length === 0) {
        return (
            <div className="bg-white p-12 rounded-xl shadow-lg border border-slate-200 text-center">
                <ChartBarIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Chưa có dữ liệu xếp hạng cho đề thi này.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-200">
                <h3 className="text-xl font-bold text-slate-800">Bảng thứ hạng học sinh</h3>
                <p className="text-sm text-slate-500 mt-1">Xếp hạng dựa trên tổng điểm của tất cả các câu hỏi trong đề thi.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-200">
                            <th className="p-4 font-bold text-slate-600 w-20 text-center">Hạng</th>
                            <th className="p-4 font-bold text-slate-600">Học sinh</th>
                            <th className="p-4 font-bold text-slate-600 text-center">Số câu nộp</th>
                            <th className="p-4 font-bold text-slate-600 text-right">Tổng điểm</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ranking.map((item, index) => {
                            const isTop3 = index < 3;
                            const rankColors = ['text-amber-500', 'text-slate-400', 'text-orange-600'];
                            return (
                                <tr key={item.user!.id} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${item.user!.id === currentUser.id ? 'bg-blue-50' : ''}`}>
                                    <td className="p-4 text-center">
                                        {isTop3 ? (
                                            <span className={`text-2xl font-black ${rankColors[index]}`}>
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                            </span>
                                        ) : (
                                            <span className="font-bold text-slate-500">{index + 1}</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            {item.user?.avatar ? (
                                                <img src={item.user.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                                    {item.user?.displayName.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-slate-800">
                                                    {item.user?.displayName}
                                                    {item.user?.id === currentUser.id && <span className="ml-2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase">Bạn</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center text-slate-600 font-medium">
                                        {item.count} / {examProblems.length}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xl font-black text-blue-600">{item.total.toFixed(2).replace(/\.00$/, '')}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">trên {maxPossibleScore}</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const MonitoringTab: React.FC = () => {
    const [monitoringView, setMonitoringView] = useState<'student' | 'time'>('student');

    const allViolations = useMemo(() => {
        const events: {
            timestamp: number;
            studentName: string;
            type: 'Thoát toàn màn hình' | 'Mất tập trung';
        }[] = [];

        studentAttempts.forEach(attempt => {
            const student = users.find(u => u.id === attempt.studentId);
            if (!student) return;

            attempt.fullscreenExits.forEach(timestamp => {
                events.push({
                    timestamp,
                    studentName: student.displayName,
                    type: 'Thoát toàn màn hình'
                });
            });

            (attempt.visibilityStateChanges || [])
                .filter(change => change.state === 'hidden')
                .forEach(change => {
                    events.push({
                        timestamp: change.timestamp,
                        studentName: student.displayName,
                        type: 'Mất tập trung'
                    });
                });
        });

        return events.sort((a, b) => b.timestamp - a.timestamp);
    }, [studentAttempts, users]);

    const ViewToggle = () => (
        <div className="flex justify-end mb-4">
            <div className="inline-flex rounded-md shadow-sm bg-slate-100 p-1" role="group">
                <button
                    onClick={() => setMonitoringView('student')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md ${
                        monitoringView === 'student' ? 'bg-white text-blue-600 shadow' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    Theo học sinh
                </button>
                <button
                    onClick={() => setMonitoringView('time')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md ${
                        monitoringView === 'time' ? 'bg-white text-blue-600 shadow' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    Theo thời gian
                </button>
            </div>
        </div>
    );
    
    if (studentAttempts.length === 0) {
        return (
            <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
                <p className="text-center py-8 text-slate-500">Chưa có học sinh nào làm bài thi này.</p>
            </div>
        );
    }
    
    return (
     <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
        <ViewToggle />
        <div className="overflow-x-auto">
            {monitoringView === 'student' ? (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b-2 border-slate-200">
                            <th className="p-3 font-bold text-slate-600">Học sinh</th>
                            <th className="p-3 font-bold text-slate-600">Bắt đầu lúc</th>
                            <th className="p-3 font-bold text-slate-600">Nộp lúc</th>
                            <th className="p-3 text-center font-bold text-slate-600">Thoát toàn màn hình</th>
                            <th className="p-3 text-center font-bold text-slate-600">Mất tập trung</th>
                        </tr>
                    </thead>
                    <tbody>
                        {studentAttempts.map(attempt => {
                            const student = users.find(u => u.id === attempt.studentId);
                            const hiddenEvents = attempt.visibilityStateChanges?.filter(c => c.state === 'hidden') || [];
                            const hiddenCount = hiddenEvents.length;
                            return (
                                <tr key={attempt.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="p-3 font-semibold text-slate-800 align-top">{student?.displayName || 'Không rõ'}</td>
                                    <td className="p-3 text-slate-600 align-top">{new Date(attempt.startedAt).toLocaleString('vi-VN')}</td>
                                    <td className="p-3 text-slate-600 align-top">{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('vi-VN') : 'Chưa nộp'}</td>
                                    <td className="p-3 text-center align-top">
                                        <div className="flex items-center justify-center gap-1 font-bold text-orange-600 mb-1">
                                            <EyeOffIcon />
                                            <span>{attempt.fullscreenExits.length}</span>
                                        </div>
                                        {attempt.fullscreenExits.length > 0 && (
                                            <div className="text-xs text-slate-500 space-y-0.5">
                                                {attempt.fullscreenExits.map((ts, index) => (
                                                    <p key={`fs-${index}`}>{new Date(ts).toLocaleTimeString('vi-VN')}</p>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-center align-top">
                                        <div className={`flex items-center justify-center gap-1 font-bold mb-1 ${hiddenCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                            <ExclamationIcon />
                                            <span>{hiddenCount}</span>
                                        </div>
                                        {hiddenCount > 0 && (
                                            <div className="text-xs text-slate-500 space-y-0.5">
                                                {hiddenEvents.map((event, index) => (
                                                    <p key={`vis-${index}`}>{new Date(event.timestamp).toLocaleTimeString('vi-VN')}</p>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b-2 border-slate-200">
                            <th className="p-3 font-bold text-slate-600">Thời gian</th>
                            <th className="p-3 font-bold text-slate-600">Học sinh</th>
                            <th className="p-3 font-bold text-slate-600">Loại vi phạm</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allViolations.map((violation, index) => (
                            <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                                <td className="p-3 text-slate-600">{new Date(violation.timestamp).toLocaleString('vi-VN')}</td>
                                <td className="p-3 font-semibold text-slate-800">{violation.studentName}</td>
                                <td className={`p-3 font-semibold ${violation.type === 'Mất tập trung' ? 'text-red-600' : 'text-orange-600'}`}>
                                    {violation.type}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
        {monitoringView === 'time' && allViolations.length === 0 && <p className="text-center py-8 text-slate-500">Không có vi phạm nào được ghi nhận.</p>}
     </div>
    );
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
          <button onClick={() => router.push('/exams')} className="mb-6 text-blue-600 font-semibold hover:underline">
              &larr; Quay lại danh sách đề thi
          </button>

          <header className="mb-10 p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex-grow">
                      <h1 className="text-4xl font-bold text-slate-900">{exam.title}</h1>
                      <p className="mt-4 text-slate-700 whitespace-pre-wrap">{exam.description || 'Không có mô tả.'}</p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-2 text-slate-600 flex-shrink-0">
                      <div className="flex items-center gap-2" title="Thời gian bắt đầu">
                          <CalendarIcon />
                          <span className="font-semibold">Bắt đầu: {new Date(exam.startTime).toLocaleString('vi-VN')}</span>
                      </div>
                      <div className="flex items-center gap-2" title="Thời gian kết thúc">
                          <CalendarIcon />
                          <span className="font-semibold">Kết thúc: {new Date(exam.endTime).toLocaleString('vi-VN')}</span>
                      </div>
                      {exam.password && (
                          <div className="flex items-center gap-2 mt-2" title="Có mật khẩu">
                              <LockClosedIcon />
                              <span className="font-semibold">Đã khóa</span>
                          </div>
                      )}
                  </div>
              </div>
               {currentUser.role === 'student' && (
                  <div className="mt-6 pt-6 border-t border-slate-200">
                      {(() => {
                          if (userAttemptForThisExam) {
                              if (userAttemptForThisExam.submittedAt) {
                                  return <div className="text-center p-4 bg-green-50 text-green-800 rounded-lg font-semibold">Bạn đã hoàn thành bài thi này.</div>;
                              }
                              if (isExamOngoing) {
                                  return (
                                      <button
                                          onClick={handleStartExamClick}
                                          className="w-full px-6 py-4 bg-yellow-500 text-white font-bold text-lg rounded-lg shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                                      >
                                          Tiếp tục làm bài
                                      </button>
                                  );
                              }
                              return <div className="text-center p-4 bg-slate-100 text-slate-600 rounded-lg font-semibold">Kỳ thi đã kết thúc. Bạn đã không nộp bài kịp thời.</div>;
                          }
                          
                          if (otherOngoingExam) {
                              return (
                                <div className="text-center p-4 bg-orange-50 text-orange-800 rounded-lg font-semibold">
                                  Bạn đang có một bài thi khác đang làm: "{otherOngoingExam.title}".
                                  <br/>
                                  Vui lòng hoàn thành hoặc thoát bài thi đó trước.
                                </div>
                              );
                          }
                          
                          if (isExamOngoing) {
                              return (
                                  <button
                                      onClick={handleStartExamClick}
                                      className="w-full px-6 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                  >
                                      Vào thi
                                  </button>
                              );
                          }

                          return (
                              <div className="text-center p-4 bg-slate-100 text-slate-600 rounded-lg font-semibold">
                                  {now < exam.startTime ? 'Kỳ thi chưa bắt đầu.' : 'Kỳ thi đã kết thúc.'}
                              </div>
                          );

                      })()}
                  </div>
              )}
          </header>

          <main>
              <div className="mb-6 border-b border-slate-200 flex gap-2 overflow-x-auto scrollbar-hide">
                  <button onClick={() => setActiveTab('questions')} className={`px-4 py-2 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'questions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Câu hỏi</button>
                  <button onClick={() => setActiveTab('leaderboard')} className={`px-4 py-2 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'leaderboard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Bảng xếp hạng</button>
                  {isTeacherOrAdmin && (
                    <button onClick={() => setActiveTab('monitoring')} className={`px-4 py-2 font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'monitoring' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Giám sát</button>
                  )}
              </div>
            
            {activeTab === 'questions' && (
                 <>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">
                            Chi tiết đề thi
                        </h2>
                        {(currentUser.role === 'teacher' || currentUser.role === 'admin') && (
                            <button
                                onClick={() => router.push(`/problems/create?examId=${exam.id}`)}
                                className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                + Thêm câu hỏi mới
                            </button>
                        )}
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
                        {examProblems.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b-2 border-slate-200">
                                            <th className="p-3 text-center font-bold text-slate-600 w-16">STT</th>
                                            <th className="p-3 font-bold text-slate-600">Tên câu hỏi</th>
                                            <th className="p-3 font-bold text-slate-600">Nội dung</th>
                                            <th className="p-3 text-right font-bold text-slate-600">Thang điểm</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {examProblems.map((problem, index) => (
                                            <ProblemRow key={problem.id} problem={problem} index={index} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-slate-500">Đề thi này chưa có câu hỏi nào.</p>
                                {(currentUser.role === 'teacher' || currentUser.role === 'admin') && 
                                    <p className="text-slate-500 mt-1">Nhấn "Thêm câu hỏi mới" để bắt đầu xây dựng đề thi.</p>
                                }
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'leaderboard' && <LeaderboardTab />}

            {activeTab === 'monitoring' && isTeacherOrAdmin && <MonitoringTab />}
             
          </main>
      </div>
      <PasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onSubmit={handlePasswordSubmit}
          error={passwordError}
      />
    </>
  );
};
