
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Feedback, RubricItem, Problem, Answer, DetailedFeedbackItem, SimilarityCheckResult, Question } from '@/types';

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const checkApiKey = () => {
    if (!process.env.API_KEY) {
        throw new Error("API Key chưa được cấu hình trên server. Vui lòng kiểm tra biến môi trường API_KEY.");
    }
};

async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3, initialDelay: number = 2000): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const isOverloaded = error.status === 503 || error.code === 503 || (error.message && (error.message.includes('overloaded') || error.message.includes('UNAVAILABLE')));
            if (isOverloaded && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

function extractJson(text: string | undefined): string | null {
    if (!text) return null;
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) return markdownMatch[1].trim();
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let firstOpenIndex = -1;
    let openChar = '';
    let closeChar = '';
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        firstOpenIndex = firstBrace; openChar = '{'; closeChar = '}';
    } else if (firstBracket !== -1) {
        firstOpenIndex = firstBracket; openChar = '['; closeChar = ']';
    } else return null;
    let depth = 0;
    let inString = false;
    for (let i = firstOpenIndex; i < text.length; i++) {
        const char = text[i];
        if (char === '"' && text[i - 1] !== '\\') inString = !inString;
        if (inString) continue;
        if (char === openChar) depth++;
        else if (char === closeChar) depth--;
        if (depth === 0) {
            const potentialJson = text.substring(firstOpenIndex, i + 1);
            try { JSON.parse(potentialJson); return potentialJson; } catch { }
        }
    }
    return null;
}

export async function testConnectionOnServer(): Promise<{ success: boolean; message: string; latency: number }> {
    const start = Date.now();
    try {
        checkApiKey();
        await retryOperation(() => ai.models.generateContent({ model: "gemini-3-flash-preview", contents: "Ping" }), 1, 1000);
        const latency = Date.now() - start;
        return { success: true, message: "Kết nối đến Google Gemini ổn định.", latency };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Không thể kết nối đến Google Gemini.", latency: Date.now() - start };
    }
}

// --- SMART PROBLEM EXTRACTION ---
const smartExtractSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, enum: ["essay", "reading_comprehension"], description: "Xác định đây là bài văn nghị luận hay bài đọc hiểu." },
        title: { type: Type.STRING, description: "Tiêu đề phù hợp for bài tập." },
        essayData: {
            type: Type.OBJECT,
            properties: {
                prompt: { type: Type.STRING, description: "Đề bài nghị luận." },
                rawRubric: { type: Type.STRING, description: "Toàn bộ văn bản hướng dẫn chấm." },
                rubricItems: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            criterion: { type: Type.STRING },
                            maxScore: { type: Type.NUMBER }
                        },
                        required: ["criterion", "maxScore"]
                    }
                },
                customMaxScore: { type: Type.NUMBER }
            }
        },
        readingCompData: {
            type: Type.OBJECT,
            properties: {
                passage: { type: Type.STRING, description: "Đoạn văn bản đọc hiểu chính." },
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            questionText: { type: Type.STRING },
                            questionType: { type: Type.STRING, enum: ["multiple_choice", "short_answer"] },
                            maxScore: { type: Type.NUMBER },
                            options: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        text: { type: Type.STRING },
                                        isCorrect: { type: Type.BOOLEAN }
                                    },
                                    required: ["text", "isCorrect"]
                                }
                            },
                            gradingCriteria: { type: Type.STRING }
                        },
                        required: ["questionText", "questionType", "maxScore"]
                    }
                }
            }
        }
    },
    required: ["type", "title"]
};

export async function smartExtractProblemOnServer(rawContent: string) {
    checkApiKey();
    const systemInstruction = `Bạn là một chuyên gia khảo thí và soạn thảo đề thi Ngữ văn hàng đầu.
Nhiệm vụ của bạn là nhận một khối văn bản hỗn hợp và cấu trúc lại chúng một cách thông minh.`;
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Hãy phân tích và cấu trúc lại khối văn bản sau:\n\n"""${rawContent}"""`,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: smartExtractSchema,
            temperature: 0.1,
        },
    }));
    const jsonText = extractJson(response.text);
    if (!jsonText) throw new Error("Không thể phân tích dữ liệu.");
    return JSON.parse(jsonText);
}

// --- BATCH ANSWER DISTRIBUTION ---
export async function distributeReadingAnswersOnServer(rawText: string, questions: Question[]) {
    checkApiKey();
    const systemInstruction = `Bạn là trợ lý học tập. Nhiệm vụ của bạn là nhận một khối văn bản chứa câu trả lời của học sinh cho nhiều câu hỏi khác nhau.
Bạn cần phân tách văn bản đó và gán từng câu trả lời vào đúng Question ID tương ứng. Trả về JSON mapping { [questionId: string]: { selectedOptionId?: string, writtenAnswer?: string } }.`;

    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Văn bản học sinh:\n"""${rawText}"""\n\nDanh sách câu hỏi:\n${JSON.stringify(questions)}`,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.1,
        },
    }));
    const jsonText = extractJson(response.text);
    if (!jsonText) throw new Error("Không thể phân bổ câu trả lời.");
    return JSON.parse(jsonText);
}

// --- GRADING METHODS ---

const gradingResponseSchema = {
    type: Type.OBJECT,
    properties: {
        detailedFeedback: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    criterion: { type: Type.STRING },
                    score: { type: Type.NUMBER },
                    feedback: { type: Type.STRING },
                    questionId: { type: Type.STRING }
                },
                required: ["criterion", "score", "feedback"],
            },
        },
        totalScore: { type: Type.NUMBER },
        maxScore: { type: Type.NUMBER },
        generalSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["detailedFeedback", "totalScore", "maxScore", "generalSuggestions"],
};

export async function gradeEssayOnServer(
    prompt: string, 
    essay: string, 
    rubric: RubricItem[], 
    rawRubric: string, 
    customMaxScore: string,
    example?: { essay: string; feedback: Feedback }
): Promise<Feedback> {
    checkApiKey();
    const maxScoreNum = Number(customMaxScore) || 10;
    
    let promptContent = `Đề bài: ${prompt}\n\nBài làm: ${essay}\n\nBiểu điểm: ${rawRubric || JSON.stringify(rubric)}\n\nQuy đổi về thang điểm ${maxScoreNum}.`;
    
    if (example) {
        promptContent = `Dưới đây là một ví dụ về bài làm đã được giáo viên chấm điểm trước đó để làm tiêu chuẩn tham khảo về phong cách chấm:
Ví dụ bài làm:
"""
${example.essay}
"""

Ví dụ kết quả chấm (JSON):
${JSON.stringify(example.feedback)}

---
Dựa trên phong cách của ví dụ trên, nhưng PHẢI TUÂN THỦ NGHIÊM NGẶT BIỂU ĐIỂM, hãy chấm bài làm sau đây:
${promptContent}

Lưu ý: Không được tự ý nâng điểm nếu bài làm thực tế không xứng đáng dựa trên tiêu chí, kể cả khi ví dụ mẫu có điểm cao.`;
    }

    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: promptContent,
        config: {
            systemInstruction: "Bạn là giáo viên chấm bài văn khách quan và khắt khe. Phân tích dựa trên biểu điểm và trả về JSON chi tiết. Nếu có bài ví dụ đi kèm, chỉ sử dụng nó để tham khảo mức độ chi tiết của nhận xét, không được dùng để thay đổi tiêu chuẩn chấm điểm.",
            responseMimeType: "application/json",
            responseSchema: gradingResponseSchema,
            temperature: 0.2,
        }
    }));
    const json = extractJson(response.text);
    if (!json) throw new Error("AI không trả về kết quả chấm điểm hợp lệ.");
    return JSON.parse(json);
}

export async function gradeReadingComprehensionOnServer(problem: Problem, answers: Answer[]): Promise<Feedback> {
    checkApiKey();
    
    const context = {
        passage: problem.passage,
        questions: problem.questions,
        studentAnswers: answers
    };

    const systemInstruction = `Bạn là giáo viên chấm bài Đọc hiểu Ngữ văn.
Nhiệm vụ:
1. Đối với câu trắc nghiệm: Kiểm tra 'selectedOptionId' của học sinh có khớp với 'correctOptionId' của câu hỏi không. Đúng thì cho tối đa điểm câu đó, sai cho 0đ.
2. Đối với câu tự luận ngắn: So sánh 'writtenAnswer' của học sinh với 'gradingCriteria' (tiêu chí chấm). Cho điểm từ 0 đến maxScore tùy mức độ hoàn thiện.
3. Cung cấp phản hồi ngắn gọn tại sao được/không được điểm cho mỗi câu.
4. Tính tổng điểm và trả về JSON theo schema.`;

    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Dữ liệu bài làm:\n${JSON.stringify(context)}`,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: gradingResponseSchema,
            temperature: 0.1
        }
    }));

    const json = extractJson(response.text);
    if (!json) throw new Error("AI không thể chấm bài đọc hiểu này.");
    return JSON.parse(json);
}

export async function parseRubricOnServer(rawRubricText: string): Promise<Omit<RubricItem, 'id'>[]> {
    checkApiKey();
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: { criterion: { type: Type.STRING }, maxScore: { type: Type.NUMBER } },
            required: ["criterion", "maxScore"]
        }
    };
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: rawRubricText,
        config: {
            systemInstruction: "Trích xuất biểu điểm thành mảng JSON.",
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    }));
    return JSON.parse(extractJson(response.text)!);
}

export async function imageToTextOnServer(base64Image: string): Promise<string> {
    checkApiKey();
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ inlineData: { mimeType: "image/jpeg", data: base64Image } }, { text: "Trích xuất văn bản từ hình ảnh này, giữ nguyên định dạng." }] }
    }));
    return response.text || "";
}

export async function checkSimilarityOnServer(currentEssay: string, existingEssays: string[]): Promise<SimilarityCheckResult> {
    if (existingEssays.length === 0) return { similarityPercentage: 0, explanation: "Không có bài làm nào khác để so sánh.", mostSimilarEssayIndex: -1 };
    
    // Simple implementation for demo
    return { similarityPercentage: 0, explanation: "Tính năng kiểm tra đạo văn đang được tối ưu hóa.", mostSimilarEssayIndex: -1 };
}

export async function extractReadingComprehensionOnServer(rawContent: string): Promise<{ passage: string; questions: Omit<Question, 'id'>[] }> {
    checkApiKey();
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: rawContent,
        config: {
            systemInstruction: "Trích xuất bài đọc hiểu JSON.",
            responseMimeType: "application/json",
            responseSchema: { type: Type.OBJECT, properties: { passage: { type: Type.STRING }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { questionText: { type: Type.STRING }, questionType: { type: Type.STRING }, maxScore: { type: Type.NUMBER } } } } } }
        }
    }));
    return JSON.parse(extractJson(response.text)!);
}
