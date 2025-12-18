
'use client';

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import type { User, Problem, Submission, Exam, ExamAttempt, Classroom } from '@/types';
import { useSession } from './SessionContext';

type UserSession = Omit<User, 'password'>;

interface DataContextType {
    currentUser: UserSession | null;
    users: UserSession[];
    problems: Problem[];
    submissions: Submission[];
    exams: Exam[];
    examAttempts: ExamAttempt[];
    classrooms: Classroom[];
    isLoading: boolean;
    updateUserRole: (userId: string, role: 'student' | 'teacher' | 'admin') => Promise<void>;
    updateProblem: (updatedProblem: Problem) => Promise<void>;
    addExam: (title: string, description: string, startTime: number, endTime: number, password?: string, classroomIds?: string[], isPractice?: boolean) => Promise<Exam | null>;
    addSubmissionAndSyncState: (submissionData: Omit<Submission, 'id' | 'submittedAt'>) => Promise<Submission | null>;
    updateSubmission: (submissionId: string, updatedData: Partial<Submission>) => Promise<void>;
    startExamAttempt: (examId: string) => Promise<ExamAttempt | null>;
    finishExamAttempt: (attempt: ExamAttempt, newSubmissions: Submission[]) => Promise<void>;
    recordFullscreenExit: (attemptId: string) => Promise<void>;
    recordVisibilityChange: (attemptId: string) => Promise<void>;
    // Classroom actions
    refetchData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useSession();

    const [users, setUsers] = useState<UserSession[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/bootstrap', { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to bootstrap data');
            const data = await response.json();
            setUsers(data.users);
            setProblems(data.problems);
            setSubmissions(data.submissions);
            setExams(data.exams);
            setExamAttempts(data.examAttempts);
            setClassrooms(data.classrooms);
        } catch (error) {
            console.error("Error fetching initial data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addSubmissionAndSyncState = async (submissionData: Omit<Submission, 'id' | 'submittedAt'>): Promise<Submission | null> => {
        try {
            const response = await fetch('/api/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submissionData),
            });
             if (!response.ok) throw new Error('Failed to create submission on server');
            const newSubmission = await response.json();
            setSubmissions(prev => [newSubmission, ...prev]);
            return newSubmission;
        } catch (error) {
            console.error("Error adding submission and syncing state:", error);
            return null;
        }
    };

    const updateSubmission = async (submissionId: string, updatedData: Partial<Submission>) => {
        try {
            const response = await fetch(`/api/submissions/${submissionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData),
            });
            if (!response.ok) throw new Error('Failed to update submission');
            const updatedSub = await response.json();
            setSubmissions(prev => prev.map(s => s.id === submissionId ? updatedSub : s));
        } catch (error) {
            console.error("Error updating submission:", error);
        }
    };

    const updateUserRole = async (userId: string, role: 'student' | 'teacher' | 'admin') => {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            });
            if (!response.ok) throw new Error('Failed to update user role');
            const updatedUser = await response.json();
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: updatedUser.role } : u));
        } catch (error) {
            console.error("Error updating user role:", error);
        }
    };
    
    const updateProblem = async (updatedProblemData: Problem) => {
        try {
            const response = await fetch(`/api/problems/${updatedProblemData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProblemData),
            });
            if (!response.ok) throw new Error('Failed to update problem');
            const updatedProblem = await response.json();
            setProblems(prev => prev.map(p => p.id === updatedProblem.id ? updatedProblem : p));
        } catch (error) {
            console.error("Error updating problem:", error);
        }
    };

    const addExam = async (title: string, description: string, startTime: number, endTime: number, password?: string, classroomIds?: string[], isPractice?: boolean): Promise<Exam | null> => {
        if (!currentUser) return null;
        try {
            const response = await fetch('/api/exams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description, startTime, endTime, password, createdBy: currentUser.id, classroomIds, isPractice }),
            });
            if (!response.ok) throw new Error('Failed to create exam');
            const newExam = await response.json();
            setExams(prev => [...prev, newExam]);
            return newExam;
        } catch (error) {
            console.error("Error creating exam:", error);
            return null;
        }
    };

    const startExamAttempt = async (examId: string): Promise<ExamAttempt | null> => {
        if (!currentUser) return null;
        try {
            const response = await fetch('/api/exam-attempts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examId, studentId: currentUser.id }),
            });
            if (!response.ok) throw new Error('Failed to start exam attempt');
            const newAttempt = await response.json();
            setExamAttempts(prev => [...prev, newAttempt]);
            return newAttempt;
        } catch (error) {
            console.error("Error starting exam attempt:", error);
            return null;
        }
    };

    const finishExamAttempt = async (attempt: ExamAttempt, newSubmissions: Submission[]) => {
        try {
            const finalAttempt: Partial<ExamAttempt> = {
                submittedAt: Date.now(),
                submissionIds: newSubmissions.map(s => s.id),
            };

            const response = await fetch(`/api/exam-attempts/${attempt.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...finalAttempt, newSubmissions }),
            });
            if (!response.ok) throw new Error('Failed to finish exam attempt');
            
            await fetchData();
        } catch (error) {
            console.error("Error finishing exam attempt:", error);
        }
    };

    const recordFullscreenExit = async (attemptId: string) => {
        const attempt = examAttempts.find(a => a.id === attemptId);
        if (!attempt) return;
        const updatedAttempt = {
            ...attempt,
            fullscreenExits: [...attempt.fullscreenExits, Date.now()],
        };
        setExamAttempts(prev => prev.map(a => a.id === attemptId ? updatedAttempt : a));
        try {
            await fetch(`/api/exam-attempts/${attemptId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullscreenExits: updatedAttempt.fullscreenExits }),
            });
        } catch (error) {
            console.error("Error recording fullscreen exit:", error);
        }
    };

    const recordVisibilityChange = async (attemptId: string) => {
        const attempt = examAttempts.find(a => a.id === attemptId);
        if (!attempt) return;
        const updatedAttempt = {
            ...attempt,
            visibilityStateChanges: [
                ...(attempt.visibilityStateChanges || []), 
                { timestamp: Date.now(), state: 'hidden' as const }
            ],
        };
        setExamAttempts(prev => prev.map(a => a.id === attemptId ? updatedAttempt : a));
        try {
            await fetch(`/api/exam-attempts/${attemptId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visibilityStateChanges: updatedAttempt.visibilityStateChanges }),
            });
        } catch (error) {
            console.error("Error recording visibility change:", error);
        }
    };

    const value = {
        currentUser,
        users,
        problems,
        submissions,
        exams,
        examAttempts,
        classrooms,
        isLoading,
        updateUserRole,
        updateProblem,
        addExam,
        addSubmissionAndSyncState,
        updateSubmission,
        startExamAttempt,
        finishExamAttempt,
        recordFullscreenExit,
        recordVisibilityChange,
        refetchData: fetchData,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useDataContext = (): DataContextType => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useDataContext must be used within a DataProvider');
    }
    return context;
};
