
'use client';
import React, { useState, useTransition } from 'react';
import type { Problem, User, Answer, Submission } from '@/types';
import { gradeReadingComprehension, distributeReadingAnswers } from '@/services/geminiService';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import EssayScanner from '@/components/EssayScanner';
import CameraIcon from '@/components/icons/CameraIcon';
import SparklesIcon from '@/components/icons/SparklesIcon';

interface ReadingComprehensionSolverProps {
  problem: Problem;
  user: Omit<User, 'password'>;
  onSubmissionComplete: (submissionData: Omit<Submission, 'id' | 'submittedAt'>) => Promise<void>;
}

const ReadingComprehensionSolver: React.FC<ReadingComprehensionSolverProps> = ({ problem, user, onSubmissionComplete }) => {
  const [answers, setAnswers] = useState<{ [key: string]: { selectedOptionId?: string, writtenAnswer?: string } }>({});
  const [error, setError] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [questionIdToScan, setQuestionIdToScan] = useState<string | 'batch' | null>(null);

  // New state for batch answer distribution
  const [rawAnswersInput, setRawAnswersInput] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);

  const isLoading = isGrading || isPending || isDistributing;
  const questions = problem.questions || [];

  const handleOptionChange = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { selectedOptionId: optionId } }));
  };

  const handleTextChange = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], writtenAnswer: text } }));
  };

  const handleScanClick = (id: string | 'batch') => {
      setQuestionIdToScan(id);
      setIsScannerOpen(true);
  };

  const handleTextExtracted = (text: string) => {
    if (questionIdToScan === 'batch') {
      setRawAnswersInput(prev => prev ? `${prev}\n\n${text}` : text);
    } else if (questionIdToScan) {
      const currentAnswer = answers[questionIdToScan]?.writtenAnswer || '';
      const newAnswer = currentAnswer ? `${currentAnswer}\n\n${text}` : text;
      handleTextChange(questionIdToScan, newAnswer);
    }
  };

  const handleAutoDistribute = async () => {
    if (!rawAnswersInput.trim()) return;
    setIsDistributing(true);
    setError(null);
    try {
        const distributed = await distributeReadingAnswers(rawAnswersInput, questions);
        setAnswers(prev => ({ ...prev, ...distributed }));
        setRawAnswersInput(''); // Clear input after successful distribution
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi khi phân tách câu trả lời.');
    } finally {
        setIsDistributing(false);
    }
  };

  const handleSubmit = async () => {
    const unansweredCount = questions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
      setError(`Bạn còn ${unansweredCount} câu chưa trả lời. Vui lòng trả lời tất cả.`);
      return;
    }
    setError(null);
    setIsGrading(true);

    try {
      const formattedAnswers: Answer[] = Object.entries(answers).map(([questionId, answerValue]) => {
        const value = answerValue as { selectedOptionId?: string; writtenAnswer?: string };
        return {
            questionId,
            selectedOptionId: value.selectedOptionId,
            writtenAnswer: value.writtenAnswer,
        };
      });

      const feedback = await gradeReadingComprehension(problem, formattedAnswers);

      const submissionData: Omit<Submission, 'id' | 'submittedAt'> = {
        problemId: problem.id,
        submitterId: user.id,
        answers: formattedAnswers,
        feedback: feedback,
        examId: problem.examId,
      };

      startTransition(async () => {
        await onSubmissionComplete(submissionData);
        setAnswers({});
        setIsGrading(false);
      });

    } catch (e) {
      console.error(e);
      setError('Đã xảy ra lỗi khi chấm bài. Vui lòng thử lại.');
      setIsGrading(false);
    }
  };

  return (
    <>
      <div className="space-y-8">
        {/* Quick Submit AI Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2 mb-1">
                        <SparklesIcon className="h-5 w-5" />
                        Nộp nhanh bằng AI
                    </h3>
                    <p className="text-sm text-blue-700">
                        Quét ảnh hoặc dán toàn bộ câu trả lời để AI tự động điền vào các ô.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => handleScanClick('batch')}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 font-bold rounded-lg border border-blue-200 shadow-sm hover:bg-blue-50 transition-all disabled:opacity-50"
                >
                    <CameraIcon className="h-5 w-5" />
                    Quét toàn bộ bài
                </button>
            </div>
            
            <textarea
                value={rawAnswersInput}
                onChange={e => setRawAnswersInput(e.target.value)}
                placeholder="Nội dung đã quét hoặc dán vào đây (Ví dụ: 1.A, 2.B, Câu 3. Trả lời...)"
                className="w-full h-32 p-4 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-slate-800"
                disabled={isLoading}
            />
            <button
                type="button"
                onClick={handleAutoDistribute}
                disabled={isLoading || !rawAnswersInput.trim()}
                className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all disabled:opacity-50"
            >
                {isDistributing ? (
                    <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        Đang phân tách thông minh...
                    </>
                ) : (
                    <>
                        <SparklesIcon className="h-5 w-5" />
                        Tự động điền tất cả câu hỏi
                    </>
                )}
            </button>
        </div>

        <div className="bg-card p-6 sm:p-8 rounded-xl shadow-sm border border-border">
          <div className="space-y-10">
            {questions.map((q, index) => (
              <div key={q.id} className="border-b border-border pb-8 last:border-b-0">
                <div className="flex justify-between items-start mb-4">
                    <p className="font-bold text-lg text-foreground">
                        Câu {index + 1}: {q.questionText}
                    </p>
                    <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">
                        {q.maxScore || 1} điểm
                    </span>
                </div>
                
                {q.questionType === 'multiple_choice' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options?.map(opt => (
                        <label key={opt.id} className={`flex items-center gap-3 p-4 rounded-lg border transition-all cursor-pointer ${
                            answers[q.id]?.selectedOptionId === opt.id 
                            ? 'bg-primary/10 border-primary shadow-sm' 
                            : 'bg-background border-border hover:bg-muted'
                        }`}>
                        <input
                            type="radio"
                            name={q.id}
                            value={opt.id}
                            checked={answers[q.id]?.selectedOptionId === opt.id}
                            onChange={() => handleOptionChange(q.id, opt.id)}
                            className="form-radio h-5 w-5 text-primary focus:ring-primary disabled:opacity-50"
                            disabled={isLoading}
                        />
                        <span className="text-foreground font-medium">{opt.text}</span>
                        </label>
                    ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-muted-foreground">Bài làm của bạn:</label>
                            <button
                                type="button"
                                onClick={() => handleScanClick(q.id)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground font-semibold rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                            >
                                <CameraIcon className="h-4 w-4" />
                                Quét bài giấy
                            </button>
                        </div>
                        <textarea
                            value={answers[q.id]?.writtenAnswer || ''}
                            onChange={(e) => handleTextChange(q.id, e.target.value)}
                            onPaste={problem.disablePaste ? (e) => e.preventDefault() : undefined}
                            title={problem.disablePaste ? "Dán văn bản đã bị vô hiệu hóa cho bài tập này." : ""}
                            placeholder="Nhập nội dung câu trả lời..."
                            className="w-full p-4 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-y text-lg leading-relaxed disabled:bg-muted disabled:cursor-not-allowed"
                            rows={4}
                            disabled={isLoading}
                        />
                    </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8">
            {isGrading || isPending ? <LoadingSpinner /> : (
                error && <ErrorMessage message={error} />
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full mt-6 px-6 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-lg hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGrading ? 'Đang chấm bài...' : 'Nộp bài đọc hiểu'}
          </button>
        </div>
      </div>
      
      <EssayScanner 
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onTextExtracted={handleTextExtracted}
      />
    </>
  );
};

export default ReadingComprehensionSolver;
