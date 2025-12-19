
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Problem, Submission, User, Answer } from '@/types';
import Leaderboard from '@/components/Leaderboard';
import StudentGraderView from '@/components/StudentGraderView';
import ReadingComprehensionSolver from './ReadingComprehensionSolver'; // New component
import { useDataContext } from '@/context/DataContext';
import { deleteProblem } from '@/app/actions';
import { regradeAllProblemSubmissions, regradeSelectedSubmissions } from '@/services/geminiService';
import TrashIcon from '@/components/icons/TrashIcon';
import ConfirmationModal from '@/components/ConfirmationModal';
import PencilIcon from '@/components/icons/PencilIcon';
import ArrowPathIcon from '@/components/icons/ArrowPathIcon';

interface ProblemDetailViewProps {
    problem: Problem;
    problemSubmissions: Submission[];
    users: Omit<User, 'password'>[];
    currentUser: Omit<User, 'password'> | null;
    teacherName: string;
}

// Teacher/Admin view of submissions for this problem
const TeacherSubmissionsView: React.FC<{ 
    problem: Problem, 
    submissions: Submission[], 
    users: Omit<User, 'password'>[],
    onRegradeAll: () => void,
    onRegradeSelected: (selectedIds: string[]) => void,
    isRegrading: boolean,
}> = ({ problem, submissions, users, onRegradeAll, onRegradeSelected, isRegrading }) => {
    const router = useRouter();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    if (submissions.length === 0) {
        return (
            <div className="bg-card p-6 rounded-lg border border-dashed text-center">
                <p className="text-muted-foreground">Chưa có học sinh nào nộp bài.</p>
            </div>
        );
    }

    const toggleSelect = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !==