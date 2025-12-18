
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Feedback, RubricItem, Problem, Answer, DetailedFeedbackItem, SimilarityCheckResult, Question } from '@/types';

// Initialize with a fallback to avoid build-time errors. 
// The SDK will throw a runtime error if called without a valid key, which is expected behavior.
// Prioritize GEMINI_API_KEY as per user configuration.
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "BUILD_TIME_PLACEHOLDER";
const ai = new GoogleGenAI({ apiKey });

const checkApiKey = () => {
    if (apiKey === "BUILD_TIME_PLACEHOLDER" || !apiKey) {
        throw new Error("API Key chưa được cấu hình trên server. Vui lòng kiểm tra biến môi trường GEMINI_API_KEY.");
    }
};

/**
 * Helper to retry an async operation with exponential backoff.
 * Useful for handling 503 Service Unavailable / Overloaded errors from the API.
 */
async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3, initialDelay: number = 2000): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            // Check for common overload/availability error codes or messages
            const isOverloaded = 
                error.status === 503 || 
                error.code === 503 || 
                (error.message && (error.message.includes('overloaded') || error.message.includes('UNAVAILABLE')));
            
            if (isOverloaded && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff: 2s, 4s, 8s
                console.warn(`Gemini API overloaded (Attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            throw error; // If not retryable or max retries reached
        }
    }
    throw lastError;
}

/**
 * Extracts the first valid JSON object or array from a string.
 */
function extractJson(text: string | undefined): string | null {
    if (!text) return null;

    // First, try to find JSON within markdown code fences as it's the most reliable format.
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        return markdownMatch[1].trim();
    }

    // If no markdown fence is found, locate the first opening brace or bracket.
    let firstOpenIndex = -1;
    let openChar = '';
    let closeChar = '';

    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        firstOpenIndex = firstBrace;
        openChar = '{';
        closeChar = '}';
    } else if (firstBracket !== -1) {
        firstOpenIndex = firstBracket;
        openChar = '[';
        closeChar = ']';
    } else {
        return null; // No JSON structure found
    }

    // Traverse the string to find the matching closing character.
    let depth = 0;
    let inString = false;
    for (let i = firstOpenIndex; i < text.length; i++) {
        const char = text[i];

        if (char === '"' && text[i - 1] !== '\\') {
            inString = !inString;
        }

        if (inString) continue;

        if (char === openChar) {
            depth++;
        } else if (char === closeChar) {
            depth--;
        }

        if (depth === 0) {
            // Once the depth returns to 0, we've found the end of the first JSON object/array.
            const potentialJson = text.substring(firstOpenIndex, i + 1);
            try {
                // Final validation to ensure the extracted string is valid JSON.
                JSON.parse(potentialJson);
                return potentialJson;
            } catch {
                // If parsing fails, the structure is invalid, so we continue searching.
            }
        }
    }

    return null; // No matching closing bracket was found.
}

// --- CONNECTION TEST ---
export async function testConnectionOnServer(): Promise<{ success: boolean; message: string; latency: number }> {
    const start = Date.now();
    try {
        checkApiKey();
        await retryOperation(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Ping",
        }), 1, 1000); // 1 retry for ping
        const latency = Date.now() - start;
        return { success: true, message: "Kết nối đến Google Gemini ổn định.", latency };
    } catch (error) {
        console.error("Gemini connection test failed:", error);
        return { 
            success: false, 
            message: error instanceof Error ? error.message : "Không thể kết nối đến Google Gemini.", 
            latency: Date.now() - start 
        };
    }
}

// --- ESSAY GRADING ---
const gradingResponseSchema = {
  type: Type.OBJECT,
  properties: {
    detailedFeedback: {
      type: Type.ARRAY,
      description: "Một mảng các nhận xét chi tiết cho từng tiêu chí trong biểu điểm. Nếu không có biểu điểm, mảng này có thể chứa các nhận xét chung.",
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING, description: "Tên của tiêu chí được đánh giá." },
          score: { type: Type.NUMBER, description: "Điểm số cho tiêu chí này." },
          feedback: { type: Type.STRING, description: "Nhận xét chi tiết về hiệu suất của bài văn đối với tiêu chí này." },
        },
        required: ["criterion", "score", "feedback"],
      },
    },
    totalScore: {
      type: Type.NUMBER,
      description: "Tổng điểm của bài văn. Nếu có biểu điểm, đây là tổng điểm của các tiêu chí.",
    },
    maxScore: {
      type: Type.NUMBER,
      description: "Tổng điểm tối đa có thể đạt được. Nếu có biểu điểm, đây là tổng điểm các tiêu chí. Nếu không, đây là thang điểm được yêu cầu.",
    },
    generalSuggestions: {
      type: Type.ARRAY,
      description: "Các gợi ý chung, mang tính bao quát để cải thiện toàn bộ bài văn.",
      items: { type: Type.STRING },
    },
  },
  required: ["detailedFeedback", "totalScore", "maxScore", "generalSuggestions"],
};

const gradingSystemInstruction = `Bạn là một giáo viên dạy văn có kinh nghiệm và công tâm ở Việt Nam.
Nhiệm vụ của bạn là đọc kỹ đề bài, bài làm và hướng dẫn chấm được cung cấp, sau đó đưa ra nhận xét chi tiết và cho điểm.

- **Tuân thủ Hướng dẫn chấm**: Luôn tuân thủ nghiêm ngặt hướng dẫn chấm và biểu điểm được cung cấp. Phân tích bài làm dựa trên từng luận điểm, yêu cầu và thang điểm đã cho.
- **Tham khảo ví dụ**: Nếu một bài làm mẫu và cách chấm điểm được cung cấp, hãy sử dụng nó như một tài liệu tham khảo chất lượng cao để đảm bảo sự nhất quán trong phong cách chấm điểm của bạn.
- **Quy đổi điểm**: Sau khi chấm, hãy đảm bảo tổng điểm cuối cùng được quy đổi chính xác về thang điểm yêu cầu trong phần "QUAN TRỌNG" của đề bài.
- **Phản hồi xây dựng**: Phản hồi của bạn phải mang tính xây dựng, giúp học sinh hiểu rõ điểm mạnh, điểm yếu và cách cải thiện bài viết.
- **Định dạng JSON**: Luôn trả về kết quả dưới dạng JSON theo schema đã định sẵn. Không thêm bất kỳ văn bản giải thích nào bên ngoài đối tượng JSON.`;


export async function gradeEssayOnServer(
    prompt: string, 
    essay: string, 
    rubric: RubricItem[], 
    rawRubric: string, 
    customMaxScore: string,
    exampleSubmission?: { essay: string; feedback: Feedback }
): Promise<Feedback> {
  checkApiKey();
  const maxScoreNum = Number(customMaxScore) || 10;
  let rubricContent = '';

  if (rawRubric && rawRubric.trim().length > 0) {
    rubricContent = 'Dưới đây là HƯỚNG DẪN CHẤM CHI TIẾT mà bạn BẮT BUỘC phải tuân theo một cách tuyệt đối:\n' +
      `"""${rawRubric.trim()}"""\n\n` +
      `QUAN TRỌNG: Sau khi chấm theo hướng dẫn trên, hãy đảm bảo TỔNG ĐIỂM CUỐI CÙNG được quy đổi về thang điểm ${maxScoreNum} và trường maxScore trong JSON phải là ${maxScoreNum}.`;
  } else if (rubric && rubric.length > 0) {
     const rubricTotal = rubric.reduce((sum, item) => sum + item.maxScore, 0);
     rubricContent = 'Dưới đây là biểu điểm bạn BẮT BUỘC phải tuân theo để chấm bài:\n' +
       rubric.map(item => `- Tiêu chí: "${item.criterion}", Điểm tối đa: ${item.maxScore}`).join('\n') +
       `\n(Tổng điểm biểu điểm: ${rubricTotal})\n\n` +
       `QUAN TRỌNG: Sau khi chấm theo từng tiêu chí, hãy đảm bảo TỔNG ĐIỂM CUỐI CÙNG được quy đổi về thang điểm ${maxScoreNum} và trường maxScore trong JSON phải là ${maxScoreNum}.`;
  } else {
    rubricContent = `Vui lòng chấm bài trên thang điểm ${maxScoreNum}.`;
  }

  let exampleContent = '';
  if (exampleSubmission) {
      exampleContent = `
      ---
      BÀI LÀM MẪU VÀ KẾT QUẢ CHẤM THAM KHẢO
      Đây là một ví dụ về một bài làm tốt đã được chấm điểm. Hãy tham khảo phong cách chấm và cho điểm này để đảm bảo tính nhất quán.

      Bài làm mẫu:
      """
      ${exampleSubmission.essay}
      """

      Kết quả chấm mẫu:
      ${JSON.stringify(exampleSubmission.feedback, null, 2)}
      ---
      `;
  }

  const content = `
    ${prompt ? `Đề bài: """${prompt}"""` : ''}
    
    ${rubricContent}

    ${exampleContent}

    Bây giờ, hãy chấm "Bài làm" dưới đây:
    Bài làm: """${essay}"""
  `.trim();

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: content,
      config: {
        systemInstruction: gradingSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: gradingResponseSchema,
        temperature: 0,
      },
    }));

    const jsonText = extractJson(response.text);
    if (!jsonText) {
      throw new Error("AI response was empty or did not contain valid JSON.");
    }
    const parsedResponse: Feedback = JSON.parse(jsonText);
    
    if (
      !parsedResponse || 
      !Array.isArray(parsedResponse.detailedFeedback) ||
      typeof parsedResponse.totalScore !== 'number' ||
      typeof parsedResponse.maxScore !== 'number'
    ) {
        throw new Error("Invalid response format from AI.");
    }

    return parsedResponse;
}

// --- RUBRIC PARSING ---
const rubricParsingSchema = {
    type: Type.ARRAY,
    description: "Một mảng các tiêu chí chấm điểm được trích xuất từ văn bản.",
    items: {
        type: Type.OBJECT,
        properties: {
            criterion: {
                type: Type.STRING,
                description: "Nội dung/tên của tiêu chí (Luận điểm). Phải rõ ràng, cụ thể. Nếu một ý lớn có nhiều ý nhỏ, hãy tách thành các tiêu chí riêng biệt.",
            },
            maxScore: {
                type: Type.NUMBER,
                description: "Điểm thành phần tối đa cho tiêu chí này.",
            },
        },
        required: ["criterion", "maxScore"],
    },
};

const rubricParsingSystemInstruction = `Bạn là một chuyên gia khảo thí giáo dục. Nhiệm vụ của bạn là đọc kỹ Hướng dẫn chấm bài dưới đây, sau đó phân tích và trích xuất TOÀN BỘ các tiêu chí chấm điểm và điểm số tương ứng một cách chi tiết và có cấu trúc.
QUAN TRỌNG:
- Tách các ý lớn thành các tiêu chí nhỏ, riêng biệt nếu có thể. Ví dụ: "Mở bài (0.5đ): Giới thiệu tác giả (0.25đ), tác phẩm (0.25đ)" phải được tách thành hai tiêu chí riêng.
- Chỉ trích xuất các tiêu chí có điểm số rõ ràng. Bỏ qua các yêu cầu chung không có điểm.
- Đảm bảo lấy được tất cả các tiêu chí.
- Trả về kết quả dưới dạng một mảng JSON, mỗi phần tử gồm "criterion" (Luận điểm) và "maxScore" (Điểm thành phần).`;

export async function parseRubricOnServer(rawRubricText: string): Promise<Omit<RubricItem, 'id'>[]> {
  checkApiKey();
  const content = `Vui lòng phân tích và trích xuất biểu điểm từ Hướng dẫn chấm sau:\n\n"""${rawRubricText}"""`;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: content,
      config: {
        systemInstruction: rubricParsingSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: rubricParsingSchema,
        temperature: 0,
      },
    }));

    const jsonText = extractJson(response.text);
    if (!jsonText) {
      throw new Error("AI rubric parsing response was empty or invalid.");
    }
    const parsedResponse: Omit<RubricItem, 'id'>[] = JSON.parse(jsonText);
    
    if (!Array.isArray(parsedResponse)) {
        throw new Error("Invalid response format from AI: expected an array.");
    }

    return parsedResponse;
}

// --- READING COMPREHENSION GRADING ---
const readingCompGradingSchema = {
    type: Type.ARRAY,
    description: "Một mảng kết quả chấm điểm cho từng câu hỏi tự luận.",
    items: {
        type: Type.OBJECT,
        properties: {
            questionId: { type: Type.STRING, description: "ID của câu hỏi được chấm." },
            score: { type: Type.NUMBER, description: "Điểm cho câu trả lời, không được vượt quá điểm tối đa của câu hỏi." },
            feedback: { type: Type.STRING, description: "Giải thích ngắn gọn tại sao cho điểm số đó và nhận xét về câu trả lời." }
        },
        required: ["questionId", "score", "feedback"]
    }
};

const readingCompSystemInstruction = `Bạn là một giáo viên dạy văn có kinh nghiệm, công tâm và chấm bài rất chi tiết. Nhiệm vụ của bạn là đọc kỹ đoạn văn, sau đó chấm điểm và đưa ra nhận xét cho một loạt câu trả lời của học sinh.
- Đọc kỹ đoạn văn chung.
- Với mỗi câu hỏi trong danh sách, hãy:
  1. Đọc kỹ câu hỏi, tiêu chí chấm điểm và điểm tối đa.
  2. Đọc câu trả lời của học sinh.
  3. So sánh câu trả lời với tiêu chí và nội dung trong đoạn văn.
  4. Cho điểm một cách chính xác, không được cho điểm cao hơn điểm tối đa của câu hỏi.
  5. Viết một nhận xét ngắn gọn, mang tính xây dựng, chỉ ra điểm đúng, điểm sai và cách cải thiện.
- Trả về kết quả dưới dạng một mảng JSON theo schema đã cho, không chứa bất kỳ văn bản nào khác.`;

export async function gradeReadingComprehensionOnServer(problem: Problem, answers: Answer[]): Promise<Feedback> {
    checkApiKey();
    const questions = problem.questions || [];
    const passage = problem.passage || "";
    const detailedFeedback: DetailedFeedbackItem[] = [];
    let totalScore = 0;

    const shortAnswerQuestions = questions.filter(q => q.questionType === 'short_answer');
    const multipleChoiceQuestions = questions.filter(q => q.questionType === 'multiple_choice');

    // 1. Grade multiple choice questions deterministically
    const mcResults: { [key: string]: DetailedFeedbackItem } = {};
    for (const question of multipleChoiceQuestions) {
        const studentAnswer = answers.find(a => a.questionId === question.id);
        const isCorrect = studentAnswer?.selectedOptionId === question.correctOptionId;
        const score = isCorrect ? (question.maxScore ?? 1) : 0;
        const correctOptionText = question.options?.find(o => o.id === question.correctOptionId)?.text;
        const feedback = isCorrect 
            ? "Bạn đã trả lời đúng." 
            : `Bạn đã trả lời sai. Đáp án đúng là: "${correctOptionText}"`;
        mcResults[question.id] = { criterion: question.questionText, score, feedback, questionId: question.id };
    }

    // 2. Grade short answer questions in a single batch API call
    const saResults: { [key: string]: DetailedFeedbackItem } = {};
    if (shortAnswerQuestions.length > 0) {
        const questionsToGrade = shortAnswerQuestions.map(q => {
            const studentAnswer = answers.find(a => a.questionId === q.id);
            return {
                questionId: q.id,
                questionText: q.questionText,
                maxScore: q.maxScore || 1,
                gradingCriteria: q.gradingCriteria || "Chấm điểm dựa trên sự chính xác và đầy đủ của câu trả lời.",
                studentAnswer: studentAnswer?.writtenAnswer || ""
            };
        });

        const content = `
            Đoạn văn: """${passage}"""

            Danh sách câu hỏi và câu trả lời của học sinh:
            ${JSON.stringify(questionsToGrade, null, 2)}

            Hãy chấm điểm và đưa ra nhận xét cho từng câu hỏi.
        `;
        
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: content,
            config: {
                systemInstruction: readingCompSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: readingCompGradingSchema,
                temperature: 0,
            },
        }));

        const jsonText = extractJson(response.text);
        if (jsonText) {
             const parsed: any[] = JSON.parse(jsonText);
            for (const item of parsed) {
                saResults[item.questionId] = {
                    questionId: item.questionId,
                    criterion: shortAnswerQuestions.find(q => q.id === item.questionId)?.questionText || "Câu hỏi",
                    score: item.score,
                    feedback: item.feedback
                };
            }
        }
    }

    // Combine results
    questions.forEach(q => {
        if (q.questionType === 'multiple_choice') {
            if (mcResults[q.id]) detailedFeedback.push(mcResults[q.id]);
        } else {
            if (saResults[q.id]) detailedFeedback.push(saResults[q.id]);
             // Handle case where AI didn't return result for a question (shouldn't happen but safety net)
            else if (!detailedFeedback.find(df => df.questionId === q.id)) {
                 detailedFeedback.push({
                    questionId: q.id,
                    criterion: q.questionText,
                    score: 0,
                    feedback: "Không thể chấm điểm câu này do lỗi hệ thống hoặc câu trả lời trống."
                 });
            }
        }
    });

    totalScore = detailedFeedback.reduce((sum, item) => sum + item.score, 0);
    const maxScore = questions.reduce((sum, q) => sum + (q.maxScore || 1), 0);

    return {
        detailedFeedback,
        totalScore,
        maxScore,
        generalSuggestions: []
    };
}

export async function imageToTextOnServer(base64Image: string): Promise<string> {
    checkApiKey();
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: "image/jpeg", 
                            data: base64Image
                        }
                    },
                    {
                        text: "Trích xuất toàn bộ văn bản viết tay hoặc in từ hình ảnh này. Chỉ trả về văn bản, giữ nguyên bố cục dòng nếu có thể."
                    }
                ]
            }
        }));
        return response.text || "";
    } catch (e) {
        console.error("Error extracting text from image:", e);
        throw new Error("Failed to extract text from image.");
    }
}

const similarityCheckSchema = {
    type: Type.OBJECT,
    properties: {
        similarityPercentage: { type: Type.NUMBER, description: "Phần trăm tương đồng giữa 0 và 100." },
        explanation: { type: Type.STRING, description: "Giải thích tại sao văn bản được coi là tương tự hoặc độc nhất." },
        mostSimilarEssayIndex: { type: Type.INTEGER, description: "Chỉ số của bài văn giống nhất trong danh sách, hoặc -1 nếu không có." }
    },
    required: ["similarityPercentage", "explanation", "mostSimilarEssayIndex"]
};

export async function checkSimilarityOnServer(currentEssay: string, existingEssays: string[]): Promise<SimilarityCheckResult> {
    if (existingEssays.length === 0) {
        return { similarityPercentage: 0, explanation: "Chưa có bài nộp nào khác để so sánh.", mostSimilarEssayIndex: -1 };
    }

    // Limit existing essays to avoid huge payload, take last 10 for example
    const essaysToCheck = existingEssays.slice(-10);

    const content = `
        Bài làm hiện tại:
        """${currentEssay}"""

        Danh sách các bài làm đã có trong hệ thống (chỉ số bắt đầu từ 0):
        ${JSON.stringify(essaysToCheck)}

        Hãy so sánh "Bài làm hiện tại" với danh sách các bài làm đã có để kiểm tra đạo văn hoặc sự trùng lặp ý tưởng đáng kể.
        Trả về kết quả dạng JSON bao gồm phần trăm tương đồng, giải thích và chỉ số của bài giống nhất (theo danh sách cung cấp).
    `;

    try {
        checkApiKey();
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: content,
            config: {
                responseMimeType: "application/json",
                responseSchema: similarityCheckSchema,
                temperature: 0,
            }
        }));

        const jsonText = extractJson(response.text);
        if (!jsonText) return { similarityPercentage: 0, explanation: "Lỗi phân tích kết quả từ AI.", mostSimilarEssayIndex: -1 };
        return JSON.parse(jsonText);
    } catch (e) {
         console.error("Error checking similarity:", e);
         return { similarityPercentage: 0, explanation: "Không thể kiểm tra độ tương đồng do lỗi hệ thống.", mostSimilarEssayIndex: -1 };
    }
}

// --- READING COMPREHENSION EXTRACTION ---
const extractionResponseSchema = {
    type: Type.OBJECT,
    properties: {
        passage: { type: Type.STRING, description: "Phần văn bản đọc hiểu (đoạn văn/văn bản chính)." },
        questions: {
            type: Type.ARRAY,
            description: "Mảng các câu hỏi được trích xuất.",
            items: {
                type: Type.OBJECT,
                properties: {
                    questionText: { type: Type.STRING, description: "Nội dung câu hỏi." },
                    questionType: { type: Type.STRING, enum: ["multiple_choice", "short_answer"], description: "Loại câu hỏi." },
                    maxScore: { type: Type.NUMBER, description: "Điểm số cho câu hỏi này." },
                    options: {
                        type: Type.ARRAY,
                        description: "Danh sách các lựa chọn nếu là trắc nghiệm.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING, description: "Nội dung lựa chọn." },
                                isCorrect: { type: Type.BOOLEAN, description: "Lựa chọn này có phải là đáp án đúng không?" }
                            },
                            required: ["text", "isCorrect"]
                        }
                    },
                    gradingCriteria: { type: Type.STRING, description: "Đáp án mẫu hoặc tiêu chí chấm cho câu hỏi tự luận ngắn." }
                },
                required: ["questionText", "questionType", "maxScore"]
            }
        }
    },
    required: ["passage", "questions"]
};

const extractionSystemInstruction = `Bạn là một chuyên gia soạn đề thi Ngữ văn. Nhiệm vụ của bạn là nhận một khối văn bản thô (gồm đoạn văn đọc hiểu và các câu hỏi kèm đáp án/biểu điểm) và cấu trúc lại chúng thành định dạng JSON sạch.

QUY TẮC:
1. **Phân tách**: Xác định đâu là đoạn văn bản chính (passage) và đâu là các câu hỏi.
2. **Loại câu hỏi**: Phân biệt câu hỏi trắc nghiệm (có các phương án A, B, C, D) và câu hỏi tự luận ngắn (yêu cầu trả lời trực tiếp).
3. **Đáp án**:
   - Với trắc nghiệm: Tìm phương án đúng (thường được đánh dấu bằng dấu sao, in đậm, hoặc ghi chú riêng) và đánh dấu 'isCorrect: true'.
   - Với tự luận: Tìm đáp án mẫu hoặc tiêu chí chấm điểm tương ứng để điền vào 'gradingCriteria'.
4. **Điểm số**: Trích xuất điểm số cho mỗi câu nếu có. Nếu không ghi, mặc định là 1.0.
5. **Định dạng**: Trả về duy nhất đối tượng JSON theo schema. Không thêm lời dẫn giải.`;

export async function extractReadingComprehensionOnServer(rawContent: string): Promise<{ passage: string; questions: Omit<Question, 'id'>[] }> {
    checkApiKey();
    const content = `Vui lòng trích xuất dữ liệu từ văn bản sau:\n\n"""${rawContent}"""`;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: content,
        config: {
            systemInstruction: extractionSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: extractionResponseSchema,
            temperature: 0,
        },
    }));

    const jsonText = extractJson(response.text);
    if (!jsonText) {
        throw new Error("Không thể trích xuất dữ liệu từ văn bản đã cung cấp.");
    }
    
    return JSON.parse(jsonText);
}
