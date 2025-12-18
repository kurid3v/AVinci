
'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useDataContext } from '@/context/DataContext';
import { createProblem } from '@/app/actions';
import { parseRubric, extractReadingComprehension } from '@/services/geminiService';
import type { Problem, RubricItem, Question, Option } from '@/types';
import TrashIcon from '@/components/icons/TrashIcon';
import SparklesIcon from '@/components/icons/SparklesIcon';

// A sub-component to manage individual questions for reading comprehension
const QuestionEditor: React.FC<{
    question: Question;
    index: number;
    onUpdate: (index: number, updatedQuestion: Question) => void;
    onRemove: (index: number) => void;
}> = ({ question, index, onUpdate, onRemove }) => {

    const handleOptionChange = (optIndex: number, text: string) => {
        const newOptions = [...(question.options || [])];
        newOptions[optIndex] = { ...newOptions[optIndex], text };
        onUpdate(index, { ...question, options: newOptions });
    };

    const handleAddOption = () => {
        const newOptions = [...(question.options || []), { id: crypto.randomUUID(), text: '' }];
        onUpdate(index, { ...question, options: newOptions });
    };

    const handleRemoveOption = (optIndex: number) => {
        const newOptions = [...(question.options || [])];
        const removedOption = newOptions.splice(optIndex, 1)[0];
        const newQuestion = { ...question, options: newOptions };
        // If the removed option was the correct one, reset correctOptionId
        if (question.correctOptionId === removedOption.id) {
            newQuestion.correctOptionId = undefined;
        }
        onUpdate(index, newQuestion);
    };

    return (
        <div className="bg-secondary/50 p-4 rounded-lg border border-border">
            <div className="flex justify-between items-center mb-3">
                <p className="font-semibold text-foreground">Câu hỏi {index + 1}</p>
                <button type="button" onClick={() => onRemove(index)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full">
                    <TrashIcon />
                </button>
            </div>
            <div className="space-y-4">
                <textarea
                    value={question.questionText}
                    onChange={e => onUpdate(index, { ...question, questionText: e.target.value })}
                    placeholder="Nội dung câu hỏi"
                    className="w-full p-2 border border-border rounded-md bg-background"
                    rows={2}
                />
                 <div className="flex items-center gap-4">
                    <select
                        value={question.questionType}
                        onChange={e => onUpdate(index, { ...question, questionType: e.target.value as 'multiple_choice' | 'short_answer' })}
                        className="p-2 border border-border rounded-md bg-background"
                    >
                        <option value="multiple_choice">Trắc nghiệm</option>
                        <option value="short_answer">Tự luận</option>
                    </select>
                    <div className="flex items-center gap-2">
                         <label className="text-sm font-medium">Điểm:</label>
                        <input
                            type="number"
                            value={question.maxScore || 1}
                            onChange={e => onUpdate(index, { ...question, maxScore: Number(e.target.value) || 1 })}
                            className="w-20 p-2 border border-border rounded-md bg-background"
                            min="0.25"
                            step="0.25"
                        />
                    </div>
                </div>

                {question.questionType === 'multiple_choice' && (
                    <div className="pl-4 border-l-2 border-border space-y-2">
                        {question.options?.map((opt, optIndex) => (
                            <div key={opt.id} className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name={`correct-option-${question.id}`}
                                    checked={question.correctOptionId === opt.id}
                                    onChange={() => onUpdate(index, { ...question, correctOptionId: opt.id })}
                                    className="form-radio text-primary focus:ring-primary"
                                />
                                <input
                                    type="text"
                                    value={opt.text}
                                    onChange={e => handleOptionChange(optIndex, e.target.value)}
                                    placeholder={`Lựa chọn ${optIndex + 1}`}
                                    className="flex-grow p-2 border border-border rounded-md bg-background"
                                />
                                <button type="button" onClick={() => handleRemoveOption(optIndex)} className="text-muted-foreground hover:text-destructive p-1">
                                    &times;
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={handleAddOption} className="text-sm font-semibold text-primary hover:underline">
                            + Thêm lựa chọn
                        </button>
                    </div>
                )}
                {question.questionType === 'short_answer' && (
                    <textarea
                        value={question.gradingCriteria}
                        onChange={e => onUpdate(index, { ...question, gradingCriteria: e.target.value })}
                        placeholder="Đáp án mẫu hoặc tiêu chí chấm..."
                        className="w-full p-2 border border-border rounded-md bg-background"
                        rows={2}
                    />
                )}
            </div>
        </div>
    );
};

export default function CreateProblemPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const examId = searchParams?.get('examId');
    const { currentUser, classrooms, refetchData } = useDataContext();

    const [problemType, setProblemType] = useState<'essay' | 'reading_comprehension'>('essay');
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');
    const [disablePaste, setDisablePaste] = useState(false);
    const [selectedClassroomIds, setSelectedClassroomIds] = useState<string[]>([]);

    // Essay state
    const [prompt, setPrompt] = useState('');
    const [rawRubric, setRawRubric] = useState('');
    const [rubricItems, setRubricItems] = useState<Omit<RubricItem, 'id'>[]>([]);
    const [customMaxScore, setCustomMaxScore] = useState(10);
    const [isRubricHidden, setIsRubricHidden] = useState(false);
    const [isParsingRubric, setIsParsingRubric] = useState(false);

    // Reading comprehension state
    const [passage, setPassage] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isExtractingReadingComp, setIsExtractingReadingComp] = useState(false);
    const [rawReadingCompInput, setRawReadingCompInput] = useState('');

    const [isPending, startTransition] = useTransition();

    const teacherClassrooms = useMemo(() => 
        currentUser ? classrooms.filter(c => c.teacherId === currentUser.id) : [],
        [classrooms, currentUser]
    );

    const handleParseRubric = async () => {
        if (!rawRubric.trim()) return;
        setIsParsingRubric(true);
        setError('');
        try {
            const parsedItems = await parseRubric(rawRubric);
            setRubricItems(parsedItems);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Không thể phân tích biểu điểm.");
        } finally {
            setIsParsingRubric(false);
        }
    };

    const handleExtractReadingComp = async () => {
        if (!rawReadingCompInput.trim()) return;
        setIsExtractingReadingComp(true);
        setError('');
        try {
            const result = await extractReadingComprehension(rawReadingCompInput);
            setPassage(result.passage);
            
            const structuredQuestions: Question[] = result.questions.map(q => {
                const id = crypto.randomUUID();
                const options = q.options?.map(o => ({
                    id: crypto.randomUUID(),
                    text: o.text,
                    isCorrect: (o as any).isCorrect // Use temporary property for mapping
                }));
                
                // @ts-ignore
                const correctOptionId = options?.find(o => o.isCorrect)?.id;

                return {
                    id,
                    questionText: q.questionText,
                    questionType: q.questionType,
                    maxScore: q.maxScore,
                    options: options?.map(({ isCorrect, ...rest }) => rest), // Clean up temporary property
                    correctOptionId,
                    gradingCriteria: q.gradingCriteria
                };
            });
            
            setQuestions(structuredQuestions);
            setRawReadingCompInput(''); // Clear input after successful extraction
        } catch (err) {
            setError(err instanceof Error ? err.message : "Lỗi khi trích xuất dữ liệu đọc hiểu.");
        } finally {
            setIsExtractingReadingComp(false);
        }
    };

    const handleRubricChange = (index: number, field: 'criterion' | 'maxScore', value: string | number) => {
        const newItems = [...rubricItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setRubricItems(newItems);
    };

    const handleDeleteRubricItem = (index: number) => {
        const newItems = rubricItems.filter((_, i) => i !== index);
        setRubricItems(newItems);
    };

    const handleAddRubricItem = () => {
        setRubricItems([...rubricItems, { criterion: '', maxScore: 0 }]);
    };

    const handleAddQuestion = () => {
        const newQuestion: Question = {
            id: crypto.randomUUID(),
            questionText: '',
            questionType: 'multiple_choice',
            options: [{ id: crypto.randomUUID(), text: '' }],
            maxScore: 1,
        };
        setQuestions([...questions, newQuestion]);
    };

    const handleUpdateQuestion = (index: number, updatedQuestion: Question) => {
        const newQuestions = [...questions];
        newQuestions[index] = updatedQuestion;
        setQuestions(newQuestions);
    };

    const handleRemoveQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setError('');

        const problemData: any = {
            title: title.trim(),
            createdBy: currentUser.id,
            type: problemType,
            examId: examId || undefined,
            disablePaste,
            classroomIds: selectedClassroomIds,
        };

        if (problemType === 'essay') {
            problemData.prompt = prompt.trim();
            problemData.rawRubric = rawRubric.trim();
            problemData.rubricItems = rubricItems;
            problemData.customMaxScore = customMaxScore;
            problemData.isRubricHidden = isRubricHidden;
        } else {
            problemData.passage = passage.trim();
            problemData.questions = questions;
        }

        startTransition(async () => {
            try {
                await createProblem(problemData);
                await refetchData();
                const backPath = examId ? `/exams/${examId}` : '/dashboard';
                router.push(backPath);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tạo bài tập.");
            }
        });
    };

    const handleClassroomToggle = (classId: string) => {
        setSelectedClassroomIds(prev => 
            prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
        );
    };

    const inputClass = "w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/50";
    const labelClass = "text-lg font-semibold text-foreground";

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Link href={examId ? `/exams/${examId}`: '/dashboard'} className="mb-6 text-primary font-semibold hover:underline inline-block">
                &larr; {examId ? 'Quay lại đề thi' : 'Quay lại trang chính'}
            </Link>
            <h1 className="text-3xl font-bold text-foreground mb-6">
                {examId ? 'Thêm câu hỏi mới' : 'Tạo bài tập mới'}
            </h1>
            <form onSubmit={handleSubmit} className="bg-card p-8 rounded-xl shadow-card border border-border space-y-8">
                {error && <p className="text-destructive bg-destructive/10 p-3 rounded-md text-center font-medium">{error}</p>}
                
                {/* Problem Type Selector */}
                <div>
                    <label className={labelClass}>Loại bài tập</label>
                    <div className="mt-2 flex rounded-md border border-border p-1 bg-background max-w-md">
                        <button type="button" onClick={() => setProblemType('essay')} className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${problemType === 'essay' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`}>
                            Tự luận (Essay)
                        </button>
                        <button type="button" onClick={() => setProblemType('reading_comprehension')} className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${problemType === 'reading_comprehension' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`}>
                            Đọc hiểu
                        </button>
                    </div>
                </div>

                {/* Common Fields */}
                <div>
                    <label htmlFor="problem-title" className={labelClass}>Tiêu đề {problemType === 'essay' ? 'bài tập' : 'bài đọc hiểu'}</label>
                    <input id="problem-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={`mt-2 ${inputClass}`} required />
                </div>

                {/* Type-specific Fields */}
                {problemType === 'essay' ? (
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="problem-prompt" className={labelClass}>Đề bài</label>
                            <textarea id="problem-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} className={`mt-2 h-32 ${inputClass}`} />
                        </div>
                        <div>
                            <label htmlFor="problem-rubric" className={labelClass}>Hướng dẫn chấm (Biểu điểm)</label>
                            <textarea id="problem-rubric" value={rawRubric} onChange={e => setRawRubric(e.target.value)} className={`mt-2 h-40 ${inputClass}`} placeholder="Dán biểu điểm chi tiết vào đây..." />
                            <button type="button" onClick={handleParseRubric} disabled={isParsingRubric} className="mt-2 btn-secondary px-4 py-2 text-sm disabled:opacity-50">
                                {isParsingRubric ? 'Đang phân tích...' : 'Phân tích biểu điểm bằng AI'}
                            </button>
                            
                            {/* Editable Rubric Table */}
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="font-semibold text-foreground">Chi tiết tiêu chí chấm điểm:</p>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Tổng: <span className="text-primary font-bold">{rubricItems.reduce((sum, item) => sum + (Number(item.maxScore) || 0), 0)}</span> điểm
                                    </p>
                                </div>
                                <div className="border border-border rounded-lg overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-secondary text-foreground font-semibold border-b border-border">
                                            <tr>
                                                <th className="p-3 text-left">Luận điểm</th>
                                                <th className="p-3 text-right w-36">Điểm thành phần</th>
                                                <th className="p-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-card">
                                            {rubricItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="p-4 text-center text-muted-foreground italic">
                                                        Chưa có tiêu chí nào. Nhấn "Thêm tiêu chí mới" hoặc dùng AI để tạo.
                                                    </td>
                                                </tr>
                                            )}
                                            {rubricItems.map((item, index) => (
                                                <tr key={index} className="border-b border-border last:border-b-0 group">
                                                    <td className="p-2">
                                                        <input
                                                            type="text"
                                                            value={item.criterion}
                                                            onChange={(e) => handleRubricChange(index, 'criterion', e.target.value)}
                                                            className="w-full p-2 bg-transparent border border-transparent hover:border-border focus:border-primary rounded outline-none transition-colors"
                                                            placeholder="Nhập luận điểm..."
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            value={item.maxScore}
                                                            onChange={(e) => handleRubricChange(index, 'maxScore', Number(e.target.value))}
                                                            className="w-full p-2 bg-transparent border border-transparent hover:border-border focus:border-primary rounded outline-none text-right transition-colors font-medium"
                                                            step="0.25"
                                                            min="0"
                                                            placeholder="Điểm"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteRubricItem(index)}
                                                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Xóa tiêu chí"
                                                        >
                                                            <TrashIcon />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <button
                                        type="button"
                                        onClick={handleAddRubricItem}
                                        className="w-full p-3 text-primary font-semibold bg-secondary/30 hover:bg-secondary transition-colors text-center text-sm border-t border-border"
                                    >
                                        + Thêm tiêu chí mới
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="problem-max-score" className={labelClass}>Thang điểm</label>
                                <input id="problem-max-score" type="number" value={customMaxScore} onChange={e => setCustomMaxScore(Number(e.target.value))} className={`mt-2 ${inputClass}`} min="1" step="0.5" />
                            </div>
                            <div className="flex items-center gap-3 pt-8">
                                <input id="problem-hide-rubric" type="checkbox" checked={isRubricHidden} onChange={e => setIsRubricHidden(e.target.checked)} className="h-5 w-5 rounded form-checkbox text-primary focus:ring-primary"/>
                                <label htmlFor="problem-hide-rubric" className="font-medium">Ẩn hướng dẫn chấm với học sinh</label>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                         {/* Smart Extraction Block */}
                         <div className="bg-primary/5 p-6 rounded-xl border border-primary/20">
                            <h3 className="text-lg font-bold text-primary flex items-center gap-2 mb-2">
                                <SparklesIcon className="h-5 w-5" />
                                Trích xuất câu hỏi thông minh (AI)
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Dán nội dung bao gồm cả đoạn văn và các câu hỏi (kèm đáp án/biểu điểm) vào đây. AI sẽ tự động phân tách và điền vào các ô bên dưới.
                            </p>
                            <textarea 
                                value={rawReadingCompInput}
                                onChange={e => setRawReadingCompInput(e.target.value)}
                                placeholder="Dán toàn bộ nội dung đề bài và biểu điểm đọc hiểu vào đây..."
                                className={`h-40 ${inputClass}`}
                            />
                            <button 
                                type="button" 
                                onClick={handleExtractReadingComp}
                                disabled={isExtractingReadingComp || !rawReadingCompInput.trim()}
                                className="mt-3 btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                {isExtractingReadingComp ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Đang trích xuất...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="h-4 w-4" />
                                        Bắt đầu trích xuất bằng AI
                                    </>
                                )}
                            </button>
                        </div>

                        <div>
                            <label htmlFor="problem-passage" className={labelClass}>Đoạn văn</label>
                            <textarea id="problem-passage" value={passage} onChange={e => setPassage(e.target.value)} className={`mt-2 h-48 ${inputClass}`} />
                        </div>
                        <div>
                            <label className={labelClass}>Câu hỏi</label>
                            <div className="mt-2 space-y-4">
                                {questions.map((q, i) => <QuestionEditor key={q.id} question={q} index={i} onUpdate={handleUpdateQuestion} onRemove={handleRemoveQuestion} />)}
                            </div>
                            <button type="button" onClick={handleAddQuestion} className="mt-4 btn-secondary px-4 py-2 text-sm">+ Thêm câu hỏi thủ công</button>
                        </div>
                    </div>
                )}

                 {/* Advanced Options */}
                {!examId && (
                     <div>
                        <label className={labelClass}>Giao cho lớp học (tùy chọn)</label>
                        <p className="text-sm text-muted-foreground mt-1 mb-2">Nếu không chọn lớp nào, bài tập sẽ được hiển thị cho tất cả học sinh.</p>
                        {teacherClassrooms.length > 0 ? (
                            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto p-3 bg-secondary/50 rounded-lg border">
                                {teacherClassrooms.map(c => (
                                    <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer has-[:checked]:bg-primary/10">
                                        <input type="checkbox" checked={selectedClassroomIds.includes(c.id)} onChange={() => handleClassroomToggle(c.id)} className="form-checkbox h-4 w-4 text-primary focus:ring-primary" />
                                        <span className="font-medium text-foreground">{c.name}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground p-3 bg-secondary/50 rounded-lg">Bạn chưa tạo lớp học nào. <Link href="/classrooms" className="text-primary font-semibold underline">Tạo lớp học mới</Link>.</p>
                        )}
                    </div>
                )}

                 <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <input id="problem-disable-paste" type="checkbox" checked={disablePaste} onChange={e => setDisablePaste(e.target.checked)} className="h-5 w-5 rounded form-checkbox text-primary focus:ring-primary"/>
                    <label htmlFor="problem-disable-paste" className="font-medium">Vô hiệu hóa tính năng dán (paste) văn bản</label>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-border">
                    <button type="button" onClick={() => router.back()} className="btn-secondary px-6 py-3">Hủy</button>
                    <button type="submit" disabled={isPending} className="btn-primary px-6 py-3 disabled:opacity-50">
                        {isPending ? 'Đang tạo...' : 'Tạo bài tập'}
                    </button>
                </div>
            </form>
        </div>
    );
}
