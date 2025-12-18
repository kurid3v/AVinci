
import type { Feedback, RubricItem, Problem, Answer, SimilarityCheckResult, Question } from '@/types';

export interface SmartExtractResult {
    type: 'essay' | 'reading_comprehension';
    title: string;
    essayData?: {
        prompt: string;
        rawRubric: string;
        rubricItems: Omit<RubricItem, 'id'>[];
        customMaxScore: number;
    };
    readingCompData?: {
        passage: string;
        questions: Omit<Question, 'id'>[];
    };
}

async function callApi<T>(action: string, payload: unknown): Promise<T> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    let errorMessage = `AI service failed with status ${response.status}`;
    try {
        const errorData = await response.json();
        if (errorData.details) {
            errorMessage = errorData.details;
        } else if (errorData.error) {
            errorMessage = errorData.error;
        }
    } catch (e) {
        const textBody = await response.text();
        if (textBody) errorMessage = textBody;
    }
    console.error("API call failed:", errorMessage);
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function testConnection(): Promise<{ success: boolean; message: string; latency: number }> {
  try {
    return await callApi<{ success: boolean; message: string; latency: number }>('test_connection', {});
  } catch (error) {
    console.error("Error in testConnection service:", error);
    return { success: false, message: error instanceof Error ? error.message : "Lỗi gọi API nội bộ.", latency: 0 };
  }
}

export async function gradeEssay(problemId: string, prompt: string, essay: string, rubric: RubricItem[], rawRubric: string, customMaxScore: string): Promise<{ feedback: Feedback, similarityCheck: SimilarityCheckResult }> {
  try {
    return await callApi<{ feedback: Feedback, similarityCheck: SimilarityCheckResult }>('grade', { problemId, prompt, essay, rubric, rawRubric, customMaxScore });
  } catch (error) {
    console.error("Error in gradeEssay service:", error);
    throw error;
  }
}

export async function regradeAllProblemSubmissions(problemId: string): Promise<{ success: boolean; updatedCount: number }> {
    try {
        return await callApi<{ success: boolean; updatedCount: number }>('regrade_all', { problemId });
    } catch (error) {
        console.error("Error in regradeAllProblemSubmissions service:", error);
        throw error;
    }
}

export async function regradeSelectedSubmissions(problemId: string, submissionIds: string[]): Promise<{ success: boolean; updatedCount: number }> {
    try {
        return await callApi<{ success: boolean; updatedCount: number }>('regrade_selected', { problemId, submissionIds });
    } catch (error) {
        console.error("Error in regradeSelectedSubmissions service:", error);
        throw error;
    }
}

export async function gradeReadingComprehension(problem: Problem, answers: Answer[]): Promise<Feedback> {
  try {
    return await callApi<Feedback>('grade_reading_comprehension', { problem, answers });
  } catch (error) {
    console.error("Error in gradeReadingComprehension service:", error);
    throw error;
  }
}

export async function parseRubric(rawRubricText: string): Promise<Omit<RubricItem, 'id'>[]> {
  try {
    return await callApi<Omit<RubricItem, 'id'>[]>('parseRubric', { rawRubricText });
  } catch (error) {
    console.error("Error in parseRubric service:", error);
    throw error;
  }
}

export async function getTextFromImage(base64Image: string): Promise<string> {
  try {
    return await callApi<string>('image_to_text', { base64Image });
  } catch (error) {
    console.error("Error in getTextFromImage service:", error);
    throw error;
  }
}

export async function smartExtractProblem(rawContent: string): Promise<SmartExtractResult> {
    try {
        return await callApi<SmartExtractResult>('smart_extract', { rawContent });
    } catch (error) {
        console.error("Error in smartExtractProblem service:", error);
        throw error;
    }
}

export async function extractReadingComprehension(rawContent: string): Promise<{ passage: string; questions: Omit<Question, 'id'>[] }> {
    try {
        return await callApi<{ passage: string; questions: Omit<Question, 'id'>[] }>('extract_reading_comp', { rawContent });
    } catch (error) {
        console.error("Error in extractReadingComprehension service:", error);
        throw error;
    }
}

export async function distributeReadingAnswers(rawText: string, questions: Question[]): Promise<{ [questionId: string]: { selectedOptionId?: string, writtenAnswer?: string } }> {
    try {
        return await callApi<{ [questionId: string]: { selectedOptionId?: string, writtenAnswer?: string } }>('distribute_answers', { rawText, questions });
    } catch (error) {
        console.error("Error in distributeReadingAnswers service:", error);
        throw error;
    }
}
