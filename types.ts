
export interface User {
  id: string;
  username: string; // for login
  displayName: string; // for display
  role: 'teacher' | 'student' | 'admin';
  password: string;
  avatar?: string; // Base64 encoded image
}

export interface Classroom {
  id: string;
  name: string;
  teacherId: string;
  studentIds: string[];
  joinCode: string;
  isPublic?: boolean; // New field for public/private status
}

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  questionText: string;
  questionType: 'multiple_choice' | 'short_answer';
  maxScore?: number; // Score for this question for both types, defaults to 1
  
  // Multiple choice fields
  options?: Option[];
  correctOptionId?: string;
  
  // Short answer fields
  gradingCriteria?: string; // Model answer or criteria for AI
}

export interface Problem {
  id: string;
  title: string;
  createdBy: string; // userId of teacher
  createdAt: number;
  examId?: string; // ID of the exam this problem belongs to
  customMaxScore?: number;
  classroomIds?: string[]; // IDs of classrooms this problem is assigned to
  disablePaste?: boolean; // New: Prevent pasting into input fields

  type: 'essay' | 'reading_comprehension';

  // Essay-specific fields
  prompt?: string;
  rawRubric?: string;
  rubricItems?: RubricItem[];
  isRubricHidden?: boolean;

  // Reading comprehension-specific fields
  passage?: string;
  questions?: Question[];
}

export interface Answer {
  questionId: string;
  selectedOptionId?: string; // For multiple choice
  writtenAnswer?: string;   // For short answer
}


export interface Submission {
  id: string;
  problemId: string;
  submitterId: string;
  feedback: Feedback;
  submittedAt: number;
  examId?: string; // ID of the exam this submission belongs to
  lastEditedByTeacherAt?: number; // Timestamp for when a teacher last edited this
  
  // Fields for different submission types
  essay?: string; // For 'essay' type
  answers?: Answer[]; // For 'reading_comprehension' type
  similarityCheck?: SimilarityCheckResult;
}

export interface Exam {
  id:string;
  title: string;
  description: string;
  startTime: number; // Timestamp for when the exam starts
  endTime: number; // Timestamp for when the exam ends
  password?: string; // Optional password
  createdBy: string; // userId of teacher
  createdAt: number;
  classroomIds?: string[]; // IDs of classrooms this exam is assigned to
  isPractice?: boolean; // New: true for "Practice Set", false for "Strict Exam"
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  startedAt: number;
  submittedAt?: number;
  fullscreenExits: number[]; // Array of timestamps when user exited fullscreen
  // Add a new field to track when the user navigates away from the tab
  visibilityStateChanges: { timestamp: number, state: 'visible' | 'hidden' }[];
  submissionIds: string[];
}


// --- Existing Types ---
export interface RubricItem {
  id: string;
  criterion: string;
  maxScore: number;
}

export interface DetailedFeedbackItem {
  criterion: string; // For essays, the criterion name. For reading comp, the question text.
  score: number; // For essays, the score. For reading comp, 1 for correct, 0 for incorrect.
  feedback: string; // For essays, detailed feedback. For reading comp, explanation of the correct answer.
  questionId?: string;
}

export interface Feedback {
  detailedFeedback: DetailedFeedbackItem[];
  totalScore: number;
  maxScore: number;
  generalSuggestions: string[];
}
// FIX: Added the SimilarityCheckResult type to be used across the application for consistency.
export interface SimilarityCheckResult {
  similarityPercentage: number;
  explanation: string;
  mostSimilarEssayIndex: number;
}
