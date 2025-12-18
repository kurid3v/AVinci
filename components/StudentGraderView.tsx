
'use client';
import React, { useState, useTransition } from 'react';
import type { Submission, Problem, User } from '@/types';
import { gradeEssay } from '@/services/geminiService';
import EssayInput from './EssayInput';
import FeedbackDisplay from './FeedbackDisplay';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import EssayScanner from './EssayScanner';

interface StudentGraderViewProps {
  problem: Problem;
  user: Omit<User, 'password'>;
  onSubmissionComplete: (submissionData: Omit<Submission, 'id' | 'submittedAt'>) => Promise<void>;
}

const StudentGraderView: React.FC<StudentGraderViewProps> = ({ problem, user, onSubmissionComplete }) => {
  const [essay, setEssay] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const isLoading = isPending || isGrading;

  const handleGradeEssay = async () => {
    if (!essay.trim()) {
      setError('Vui lòng nhập nội dung bài văn.');
      return;
    }

    setIsGrading(true);
    setError(null);

    try {
      const result = await gradeEssay(
          problem.id,
          problem.prompt!, 
          essay, 
          problem.rubricItems || [], 
          problem.rawRubric || '', 
          String(problem.customMaxScore || '10')
      );
      
      const newSubmissionData: Omit<Submission, 'id' | 'submittedAt'> = {
        problemId: problem.id,
        submitterId: user.id,
        essay: essay,
        feedback: result.feedback,
        similarityCheck: result.similarityCheck,
        examId: problem.examId,
      };

      // Use a transition to call the server action, preventing UI blocking
      startTransition(async () => {
        await onSubmissionComplete(newSubmissionData);
        // After submission, clear the essay field for the next attempt
        setEssay(''); 
        setIsGrading(false);
      });

    } catch (e) {
      console.error(e);
      setError('Đã xảy ra lỗi khi chấm bài. Vui lòng thử lại.');
      setIsGrading(false);
    }
  };

  const handleTextExtracted = (text: string) => {
    setEssay(prev => prev ? `${prev}\n\n${text}` : text);
    // Smoothly scroll to the textarea after extraction
    const textarea = document.getElementById('essay-input');
    textarea?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      <div className="bg-card p-6 sm:p-8 rounded-xl shadow-sm border border-border">
        <EssayInput
          essay={essay}
          setEssay={setEssay}
          onSubmit={handleGradeEssay}
          isLoading={isLoading}
          onScanClick={() => setIsScannerOpen(true)}
          disablePaste={problem.disablePaste}
        />

        <div className="mt-8">
          {isLoading && <LoadingSpinner />}
          {error && !isLoading && <ErrorMessage message={error} />}
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

export default StudentGraderView;
