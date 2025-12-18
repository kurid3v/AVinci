
'use client';
import React, { useState, useTransition } from 'react';
import type { Problem, User, Answer, Submission } from '@/types';
import { gradeReadingComprehension, splitStudentAnswers } from '@/services/geminiService';
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
  const [questionIdToScan, setQuestionIdToScan] = useState<string | null>(null);

  // Smart splitting state
  const [rawWorkInput, setRawWorkInput] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);

  const isLoading = isGrading || isPending || isSplitting;
  const questions = problem.questions || [];

  const handleOptionChange = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { selectedOptionId: optionId } }));
  };

  const handleTextChange = (questionId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], writtenAnswer: text } }));
  };

  const handleScanClick = (questionId: string) => {
      setQuestionIdToScan(questionId);
      setIsScannerOpen(true);
  };

  const handleTextExtracted = (text: string) => {
    if (questionIdToScan) {
      const currentAnswer = answers[questionIdToScan]?.writtenAnswer || '';
      const newAnswer = currentAnswer ? `${currentAnswer}\n\n${text}` : text;
      handleTextChange(questionIdToScan, newAnswer);
    }
  };

  const handleSmartSplit = async () => {
      if (!rawWorkInput.trim()) return;
      setIsSplitting(true);
      setError(null);
      try {
          const structuredAnswers = await splitStudentAnswers(problem, rawWorkInput);
          const newAnswersState: { [key: string]: { selectedOptionId?: string, writtenAnswer?: string } } = {};
          
          structuredAnswers.forEach(ans => {
              newAnswersState[ans.questionId] = {
                  selectedOptionId: ans.selectedOptionId,
                  writtenAnswer: ans.writtenAnswer
              };
          });

          setAnswers(prev => ({ ...prev, ...newAnswersState }));
          setRawWorkInput('');
          alert("AI đã tự động phân tách và điền đáp án cho bạn!");
      } catch (err) {
          setError(err instanceof Error ? err.message : "Lỗi khi phân tách bài làm.");
      } finally {
          setIsSplitting(false);
      }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      setError('Vui lòng trả lời tất cả các câu hỏi.');
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
        {/* Smart Split Section */}
        <div className="bg-gradient-to-br from-primary/10 to-background p-6 rounded-xl border-2 border-primary/20 shadow-sm">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2 mb-2">
                <SparklesIcon className="h-5 w-5" />
                Nhập nhanh bài làm bằng AI
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
                Nếu bạn đã soạn sẵn câu trả lời bên ngoài (ví dụ: "1A, 2. Nội dung là..."), hãy dán toàn bộ vào đây. AI sẽ tự động phân tách và điền vào các ô bên dưới.
            </p>
            <textarea 
                value={rawWorkInput}
                onChange={e => setRawWorkInput(e.target.value)}
                placeholder="Dán toàn bộ bài làm của bạn vào đây..."
                className="w-full p-3 bg-background border border-primary/30 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary min-h-[120px]"
                disabled={isLoading}
            />
            <button 
                type="button" 
                onClick={handleSmartSplit}
                disabled={isLoading || !rawWorkInput.trim()}
                className="mt-3 btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50 shadow-md"
            >
                {isSplitting ? (
                    <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Đang phân tách...
                    </>
                ) : (
                    <>
                        <SparklesIcon className="h-4 w-4" />
                        Tự động phân tách ngay
                    </>
                )}
            </button>
        </div>

        <div className="bg-card p-6 sm:p-8 rounded-xl shadow-sm border border-border">
            <div className="space-y-6">
            {questions.map((q, index) => (
                <div key={q.id} className="border-b border-border pb-6 last:border-b-0">
                <p className="font-semibold text-foreground mb-3 text-lg">
                    Câu {index + 1}: {q.questionText}
                </p>
                {q.questionType === 'multiple_choice' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options?.map(opt => (
                        <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary border border-border transition-all">
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
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Câu trả lời của bạn</label>
                            <button
                                type="button"
                                onClick={() => handleScanClick(q.id)}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground font-semibold rounded-md hover:bg-muted disabled:opacity-50"
                            >
                                <CameraIcon className="h-4 w-4" />
                                Quét chữ viết
                            </button>
                        </div>
                        <textarea
                            value={answers[q.id]?.writtenAnswer || ''}
                            onChange={(e) => handleTextChange(q.id, e.target.value)}
                            onPaste={problem.disablePaste ? (e) => e.preventDefault() : undefined}
                            title={problem.disablePaste ? "Dán văn bản đã bị vô hiệu hóa cho bài tập này." : ""}
                            placeholder="Nhập câu trả lời chi tiết của bạn tại đây..."
                            className="w-full p-4 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-y disabled:bg-muted disabled:cursor-not-allowed text-lg"
                            rows={4}
                            disabled={isLoading}
                        />
                    </div>
                )}
                </div>
            ))}
            </div>

            <div className="mt-8">
            {isLoading ? <LoadingSpinner /> : (
                error && <ErrorMessage message={error} />
            )}
            </div>

            <button
            onClick={handleSubmit}
            disabled={isLoading || Object.keys(answers).length !== questions.length}
            className="w-full mt-6 px-6 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
            >
            {isGrading ? 'Hệ thống đang chấm bài...' : 'Nộp bài ngay'}
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
