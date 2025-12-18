
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
    gradeEssayOnServer, 
    gradeReadingComprehensionOnServer, 
    checkSimilarityOnServer,
    testConnectionOnServer,
    extractReadingComprehensionOnServer,
    smartExtractProblemOnServer,
    distributeReadingAnswersOnServer,
    parseRubricOnServer,
    imageToTextOnServer
} from '@/lib/gemini';
import type { Submission } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    console.log(`[AI_API] Executing action: ${action}`);

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
      }
      
      const examplePayload = bestExample ? { essay: bestExample.essay!, feedback: bestExample.feedback as any } : undefined;
      
      const [feedback, similarityCheck] = await Promise.all([
        gradeEssayOnServer(prompt, essay, rubric, rawRubric, customMaxScore, examplePayload),
        checkSimilarityOnServer(essay, existingEssays)
      ]);
      
      return NextResponse.json({ feedback, similarityCheck });
    }
    
    if (action === 'regrade_all' || action === 'regrade_selected') {
        const { problemId, submissionIds } = payload;
        const problem = (await db.all.problems).find(p => p.id === problemId);
        if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

        const allSubmissions = await db.all.submissions;
        let problemSubmissions = allSubmissions.filter(s => s.problemId === problemId);
        
        // If specific IDs are provided, filter by them
        if (action === 'regrade_selected' && Array.isArray(submissionIds)) {
            problemSubmissions = problemSubmissions.filter(s => submissionIds.includes(s.id));
        }

        const existingEssays = (await db.all.submissions)
            .filter(s => s.problemId === problemId)
            .map(s => s.essay)
            .filter(Boolean) as string[];

        // Find reference example once for the whole batch
        let bestExample: Submission | null = null;
        const teacherEditedSubmissions = (await db.all.submissions)
            .filter(s => s.problemId === problemId && s.lastEditedByTeacherAt);
            
        if (teacherEditedSubmissions.length > 0) {
            bestExample = teacherEditedSubmissions.reduce((prev, current) => 
                (new Date(prev.lastEditedByTeacherAt!) > new Date(current.lastEditedByTeacherAt!)) ? prev : current
            );
        }
        const examplePayload = bestExample ? { essay: bestExample.essay!, feedback: bestExample.feedback as any } : undefined;

        const results = [];
        for (const sub of problemSubmissions) {
            try {
                let updatedFeedback;
                let updatedSimilarity;

                if (problem.type === 'essay' && sub.essay) {
                    [updatedFeedback, updatedSimilarity] = await Promise.all([
                        gradeEssayOnServer(
                            problem.prompt!, 
                            sub.essay, 
                            problem.rubricItems || [], 
                            problem.rawRubric || '', 
                            String(problem.customMaxScore || 10),
                            examplePayload
                        ),
                        checkSimilarityOnServer(sub.essay, existingEssays)
                    ]);
                } else if (problem.type === 'reading_comprehension' && sub.answers) {
                    updatedFeedback = await gradeReadingComprehensionOnServer(problem, sub.answers);
                }

                if (updatedFeedback) {
                    const updatedSub = await db.submissions.update(sub.id, {
                        feedback: updatedFeedback,
                        similarityCheck: updatedSimilarity,
                        lastEditedByTeacherAt: undefined
                    });
                    results.push(updatedSub);
                }
            } catch (err) {
                console.error(`Failed to regrade ${sub.id}:`, err);
            }
        }
        return NextResponse.json({ success: true, updatedCount: results.length });
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
        if (!base64Image) {
            return NextResponse.json({ error: "No image data provided" }, { status: 400 });
        }
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
    console.error("[AI_API_ERROR]", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to process AI request.", details: errorMessage }, { status: 500 });
  }
}
