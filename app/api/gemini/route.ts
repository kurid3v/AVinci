
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
    distributeReadingAnswersOnServer
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
      
      // Get all existing submissions for this problem to find a reference example
      const allSubmissions = await db.all.submissions;
      const existingSubmissions = allSubmissions.filter(s => s.problemId === problemId && s.essay);
      const existingEssays = existingSubmissions.map(s => s.essay).filter(Boolean) as string[];

      // IMPORTANT: Only use teacher-edited submissions as examples to prevent "AI score inflation"
      // If we use AI's own high scores as reference, it creates a bias loop.
      let bestExample: Submission | null = null;
      const teacherEditedSubmissions = existingSubmissions.filter(s => s.lastEditedByTeacherAt);
      
      if (teacherEditedSubmissions.length > 0) {
          // Use the most recently edited teacher feedback as the gold standard
          bestExample = teacherEditedSubmissions.reduce((prev, current) => 
              (new Date(prev.lastEditedByTeacherAt!) > new Date(current.lastEditedByTeacherAt!)) ? prev : current
          );
      }
      
      // We explicitly skip using the highest AI score if no teacher has reviewed anything.
      // This ensures grading remains objective based on the rubric alone unless guided by a human.
      
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

    if (action === 'distribute_answers') {
        const { rawText, questions } = payload;
        const result = await distributeReadingAnswersOnServer(rawText, questions);
        return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Error in Gemini API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to process AI request.", details: errorMessage }, { status: 500 });
  }
}
