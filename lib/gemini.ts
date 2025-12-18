
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Feedback, RubricItem, Problem, Answer, DetailedFeedbackItem, SimilarityCheckResult, Question } from '@/types';

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

// --- STUDENT ANSWERS SPLITTING ---
const splitAnswersSchema = {
    type: Type.ARRAY,
    description: "Mảng các câu trả lời đã được phân tách từ khối văn bản của học sinh.",
    items: {
        type: Type.OBJECT,
        properties: {
            questionId: { type: Type.STRING, description: "ID của câu hỏi tương ứng." },
            selectedOptionId: { type: Type.STRING, description: "ID của lựa chọn được chọn (nếu là trắc nghiệm)." },
            writtenAnswer: { type: Type.STRING, description: "Nội dung câu trả lời tự luận." }
        },
        required: ["questionId"]
    }
};

const splitAnswersSystemInstruction = `Bạn là một trợ lý ảo hỗ trợ học tập.
Nhiệm vụ của bạn là nhận vào:
1. Danh sách câu hỏi của một đề thi Đọc hiểu (bao gồm ID, nội dung, và các lựa chọn nếu có).
2. Một khối văn bản bài làm hỗn hợp của học sinh (thường bao gồm các số thứ tự câu và đáp án đi kèm).

HÃY PHÂN TÍCH:
- Xác định xem phần nào trong văn bản học sinh ứng với câu hỏi nào dựa trên số thứ tự hoặc từ khóa.
- Với câu hỏi TRẮC NGHIỆM: Tìm phương án học sinh đã chọn (A, B, C, D) và ánh xạ nó sang 'selectedOptionId' phù hợp từ danh sách câu hỏi.
- Với câu hỏi TỰ LUẬN: Trích xuất toàn bộ đoạn văn bản học sinh đã viết cho câu đó vào 'writtenAnswer'.
- Trả về mảng JSON theo schema đã cho. Nếu học sinh không làm một câu nào đó, vẫn trả về ID đó với các trường giá trị trống.`;

export async function splitStudentAnswersOnServer(problem: Problem, rawWork: string): Promise<Answer[]> {
    checkApiKey();
    const content = `
    DANH SÁCH CÂU HỎI TRONG ĐỀ BÀI:
    ${JSON.stringify(problem.questions, null, 2)}

    BÀI LÀM CỦA HỌC SINH:
    """
    ${rawWork}
    """
    `.trim();

    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: content,
        config: {
            systemInstruction: splitAnswersSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: splitAnswersSchema,
            temperature: 0.1,
        },
    }));

    const jsonText = extractJson(response.text);
    if (!jsonText) throw new Error("Không thể phân tách bài làm.");
    return JSON.parse(jsonText);
}

// --- REMAINING METHODS ---
export async function smartExtractProblemOnServer(rawContent: string) {
    checkApiKey();
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Hãy phân tích và cấu trúc lại khối văn bản sau:\n\n"""${rawContent}"""`,
        config: {
            systemInstruction: "Bạn là chuyên gia soạn đề. Trả về JSON.",
            responseMimeType: "application/json",
            responseSchema: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, title: { type: Type.STRING } }, required: ["type", "title"] },
        },
    }));
    return JSON.parse(extractJson(response.text)!);
}

export async function gradeEssayOnServer(prompt: string, essay: string, rubric: RubricItem[], rawRubric: string, customMaxScore: string, exampleSubmission?: { essay: string; feedback: Feedback }): Promise<Feedback> {
    checkApiKey();
    const gradingResponseSchema = {
        type: Type.OBJECT,
        properties: {
            detailedFeedback: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: { criterion: { type: Type.STRING }, score: { type: Type.NUMBER }, feedback: { type: Type.STRING } },
                    required: ["criterion", "score", "feedback"],
                },
            },
            totalScore: { type: Type.NUMBER },
            maxScore: { type: Type.NUMBER },
            generalSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["detailedFeedback", "totalScore", "maxScore", "generalSuggestions"],
    };
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Chấm bài văn. Đề: ${prompt}\n\nBài làm: ${essay}`,
        config: {
            systemInstruction: "Bạn là giáo viên. Trả về JSON.",
            responseMimeType: "application/json",
            responseSchema: gradingResponseSchema,
        }
    }));
    return JSON.parse(extractJson(response.text)!);
}

export async function parseRubricOnServer(rawRubricText: string): Promise<Omit<RubricItem, 'id'>[]> {
    checkApiKey();
    const response: GenerateContentResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: rawRubricText,
        config: {
            systemInstruction: "Trích xuất biểu điểm thành mảng JSON.",
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { criterion: { type: Type.STRING }, maxScore: { type: Type.NUMBER } }, required: ["criterion", "maxScore"] } },
        }
    }));
    return JSON.parse(extractJson(response.text)!);
}

export async function gradeReadingComprehensionOnServer(problem: Problem, answers: Answer[]): Promise<Feedback> {
    checkApiKey();
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
