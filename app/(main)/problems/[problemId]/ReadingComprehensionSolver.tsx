

'use client';
import React, { useState, useTransition } from 'react';
import type { Problem, User, Answer, Submission } from '@/types';
import { gradeReadingComprehension } from '@/services/geminiService';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import EssayScanner from '@/components/EssayScanner';
import CameraIcon from '@/components/icons/CameraIcon';

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

  const isLoading = isGrading || isPending;
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

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      setError('Vui lòng trả lời tất cả các câu hỏi.');
      return;
    }
    setError(null);
    setIsGrading(true);

    try {
      // FIX: Explicitly cast the 'answerValue' from Object.entries to its expected type. This resolves a TypeScript inference issue where the value was being treated as 'unknown', causing property access errors.
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
      <div className="bg-card p-6 sm:p-8 rounded-xl shadow-sm border border-border">
        <div className="space-y-6">
          {questions.map((q, index) => (
            <div key={q.id} className="border-b border-border pb-6 last:border-b-0">
              <p className="font-semibold text-foreground mb-3">
                Câu {index + 1}: {q.questionText}
              </p>
              {q.questionType === 'multiple_choice' ? (
                  <div className="space-y-2">
                  {q.options?.map(opt => (
                      <label key={opt.id} className="flex items-center gap-3 p-3 rounded-md hover:bg-muted cursor-pointer has-[:checked]:bg-primary/10 has-[:checked]:border-primary border border-transparent">
                      <input
                          type="radio"
                          name={q.id}
                          value={opt.id}
                          checked={answers[q.id]?.selectedOptionId === opt.id}
                          onChange={() => handleOptionChange(q.id, opt.id)}
                          className="form-radio h-4 w-4 text-primary focus:ring-primary disabled:opacity-50"
                          disabled={isLoading}
                      />
                      <span className="text-foreground">{opt.text}</span>
                      </label>
                  ))}
                  </div>
              ) : (
                  <div>
                      <div className="flex justify-between items-center mb-1">
                          <label className="text-sm font-medium text-muted-foreground">Câu trả lời của bạn</label>
                          <button
                              type="button"
                              onClick={() => handleScanClick(q.id)}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground font-semibold rounded-md hover:bg-muted disabled:opacity-50"
                          >
                              <CameraIcon className="h-4 w-4" />
                              Quét câu trả lời
                          </button>
                      </div>
                      <textarea
                          value={answers[q.id]?.writtenAnswer || ''}
                          onChange={(e) => handleTextChange(q.id, e.target.value)}
                          onPaste={problem.disablePaste ? (e) => e.preventDefault() : undefined}
                          title={problem.disablePaste ? "Dán văn bản đã bị vô hiệu hóa cho bài tập này." : ""}
                          placeholder="Nhập câu trả lời của bạn..."
                          className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-primary resize-y disabled:bg-muted disabled:cursor-not-allowed"
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
          className="w-full mt-6 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg shadow-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Đang chấm bài...' : 'Nộp bài'}
        </button>
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