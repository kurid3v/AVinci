
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
    gradeEssayOnServer, 
    parseRubricOnServer, 
    gradeReadingComprehensionOnServer, 
    imageToTextOnServer,
    checkSimilarityOnServer,
    testConnectionOnServer,
    extractReadingComprehensionOnServer,
    smartExtractProblemOnServer,
    splitStudentAnswersOnServer
} from '@/lib/gemini';
import type { Submission } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    if (action === 'test_connection') {
        const result = await testConnectionOnServer();
        return NextResponse.json(result);
    }

    if (action === 'grade') {
      const { problemId, prompt, essay, rubric, rawRubric, customMaxScore } = payload;
      const allSubmissions = await db.all.submissions;
      const existingSubmissions = allSubmissions.filter(s => s.problemId === problemId && s.essay);
      const existingEssays = existingSubmissions.map(s => s.essay).filter(Boolean) as string[];
      let bestExample: Submission | null = null;
      const teacherEditedSubmissions = existingSubmissions.filter(s => s.lastEditedByTeacherAt);
      if (teacherEditedSubmissions.length > 0) {
          bestExample = teacherEditedSubmissions.reduce((prev, current) => 
              (new Date(prev.lastEditedByTeacherAt!) > new Date(current.lastEditedByTeacherAt!)) ? prev : current
          );
      } else if (existingSubmissions.length > 0) {
          bestExample = existingSubmissions.reduce((prev, current) => 
              ( (prev.feedback as any).totalScore > (current.feedback as any).totalScore) ? prev : current
          );
      }
      const examplePayload = bestExample ? { essay: bestExample.essay!, feedback: bestExample.feedback as any } : undefined;
      const [feedback, similarityCheck] = await Promise.all([
        gradeEssayOnServer(prompt, essay, rubric, rawRubric, customMaxScore, examplePayload),
        checkSimilarityOnServer(essay, existingEssays)
      ]);
      return NextResponse.json({ feedback, similarityCheck });
    }
    
    if (action === 'grade_reading_comprehension') {
        const { problem, answers } = payload;
        const feedback = await gradeReadingComprehensionOnServer(problem, answers);
        return NextResponse.json(feedback);
    }

    if (action === 'parseRubric') {
      const { rawRubricText } = payload;
      const parsedRubric = await parseRubricOnServer(rawRubricText);
      return NextResponse.json(parsedRubric);
    }

    if (action === 'image_to_text') {
        const { base64Image } = payload;
        const text = await imageToTextOnServer(base64Image);
        return NextResponse.json(text);
    }

    if (action === 'extract_reading_comp') {
        const { rawContent } = payload;
        const result = await extractReadingComprehensionOnServer(rawContent);
        return NextResponse.json(result);
    }

    if (action === 'smart_extract') {
        const { rawContent } = payload;
        const result = await smartExtractProblemOnServer(rawContent);
        return NextResponse.json(result);
    }

    if (action === 'split_answers') {
        const { problem, rawWork } = payload;
        const result = await splitStudentAnswersOnServer(problem, rawWork);
        return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Error in Gemini API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to process AI request.", details: errorMessage }, { status: 500 });
  }
}
