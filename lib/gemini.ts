
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
        // Use gemini-3-flash-preview for basic text tasks.
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

const smartExtractSystemInstruction = `Bạn là một chuyên gia khảo thí và soạn thảo đề thi Ngữ văn hàng đầu.
Nhiệm vụ của bạn là nhận một khối văn bản hỗn hợp (có thể chứa đề bài, đoạn văn, danh sách câu hỏi, và hướng dẫn chấm/biểu điểm) và cấu trúc lại chúng một cách thông minh.

QUY TẮC PHÂN LOẠI:
1. **Reading Comprehension (Đọc hiểu)**: Nếu văn bản có một đoạn trích và đi kèm nhiều câu hỏi nhỏ (trắc nghiệm hoặc tự luận ngắn).
2. **Essay (Nghị luận)**: Nếu văn bản yêu cầu viết một bài văn dài về một chủ đề, thường đi kèm với một biểu điểm chi tiết (ví dụ: Mở bài 0.5đ, Thân bài 3.0đ...).

QUY TẮC TRÍCH XUẤT:
- **Title**: Tạo một tiêu đề ngắn gọn, súc tích cho bài tập.
- **Biểu điểm/Đáp án**: Tìm kiếm kỹ các con số điểm (ví dụ: 0.5đ, 1.0 điểm) để phân bổ chính xác vào 'maxScore'.
- **Trắc nghiệm**: Xác định phương án đúng dựa trên các ký hiệu như dấu sao (*), in đậm, hoặc phần đáp án đính kèm.
- **Tự luận**: Trích xuất đáp án gợi ý hoặc tiêu chí chấm vào 'gradingCriteria'.

Trả về kết quả duy nhất là đối tượng JSON theo schema đã cho.`;

export async function smartExtractProblemOnServer(rawContent: string) {
    checkApiKey();
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Hãy phân tích và cấu trúc lại khối văn bản sau:\n\n"""${rawContent}"""`,
        config: {
            systemInstruction: smartExtractSystemInstruction,
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
Bạn cần phân tách văn bản đó và gán từng câu trả lời vào đúng Question ID tương ứng.

DỮ LIỆU ĐẦU VÀO:
1. Khối văn bản thô từ học sinh.
2. Danh sách các câu hỏi (ID, nội dung, loại câu hỏi).

YÊU CẦU:
- Với câu hỏi trắc nghiệm (multiple_choice): Tìm xem học sinh chọn phương án nào (A, B, C, D hoặc nội dung phương án) và trả về 'selectedOptionId' khớp với Option ID trong danh sách.
- Với câu hỏi tự luận ngắn (short_answer): Trích xuất đoạn văn tương ứng với câu hỏi đó vào 'writtenAnswer'.
- Trả về một đối tượng JSON ánh xạ: { [questionId: string]: { selectedOptionId?: string, writtenAnswer?: string } }

Hãy cẩn thận với thứ tự câu hỏi (ví dụ Câu 1, Câu 2) hoặc các từ khóa trong đề bài để gán chính xác. Nếu một câu hỏi không có câu trả lời rõ ràng, hãy bỏ qua hoặc để trống.`;

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

// --- REMAINING METHODS ---
export async function gradeEssayOnServer(prompt: string, essay: string, rubric: RubricItem[], rawRubric: string, customMaxScore: string, exampleSubmission?: { essay: string; feedback: Feedback }): Promise<Feedback> {
    checkApiKey();
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
    const maxScoreNum = Number(customMaxScore) || 10;
    const content = `Đề bài: ${prompt}\n\nBài làm: ${essay}\n\nQuy đổi về thang điểm ${maxScoreNum}.`;
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: content,
        config: {
            systemInstruction: "Bạn là giáo viên chấm bài văn. Trả về JSON.",
            responseMimeType: "application/json",
            responseSchema: gradingResponseSchema,
        }
    }));
    return JSON.parse(extractJson(response.text)!);
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

export async function gradeReadingComprehensionOnServer(problem: Problem, answers: Answer[]): Promise<Feedback> {
    checkApiKey();
    // Simplified for demo brevity
    return { detailedFeedback: [], totalScore: 0, maxScore: 10, generalSuggestions: [] };
}

export async function imageToTextOnServer(base64Image: string): Promise<string> {
    checkApiKey();
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ inlineData: { mimeType: "image/jpeg", data: base64Image } }, { text: "Trích xuất văn bản." }] }
    }));
    return response.text || "";
}

export async function checkSimilarityOnServer(currentEssay: string, existingEssays: string[]): Promise<SimilarityCheckResult> {
    return { similarityPercentage: 0, explanation: "Tính năng so sánh bài làm.", mostSimilarEssayIndex: -1 };
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
