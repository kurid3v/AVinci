import fs from 'fs';
import path from 'path';
import type { User, Problem, Submission, Exam, ExamAttempt, Classroom } from '@/types';

// Use a safe version of randomUUID
const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Define the data directory path
const DATA_DIR = path.join((process as any).cwd(), 'data');

// Helper to load data from JSON files
const loadData = <T>(fileName: string, fallback: T): T => {
  try {
    const filePath = path.join(DATA_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      if (!fileContent || !fileContent.trim()) return fallback;
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error(`Error loading data from ${fileName}:`, error);
  }
  return fallback;
};

// Helper to save data to JSON files
const saveData = (fileName: string, data: any) => {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const filePath = path.join(DATA_DIR, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error saving data to ${fileName}:`, error);
    }
};

// In-memory store class
class Store {
  users: User[];
  problems: Problem[];
  submissions: Submission[];
  exams: Exam[];
  examAttempts: ExamAttempt[];
  classrooms: Classroom[];

  constructor() {
    this.users = loadData<User[]>('users.json', []);
    this.problems = loadData<Problem[]>('problems.json', []);
    this.submissions = loadData<Submission[]>('submissions.json', []);
    this.exams = loadData<Exam[]>('exams.json', []);
    this.examAttempts = loadData<ExamAttempt[]>('examAttempts.json', []);
    this.classrooms = loadData<Classroom[]>('classrooms.json', []);

    if (this.users.length === 0) {
        this.users = [{ "id": "user_admin_1", "username": "adminuser", "displayName": "AdminUser", "role": "admin", "password": "admin" }];
        saveData('users.json', this.users);
    }
    
    if (this.problems.length === 0) {
         this.problems = [{
            "id": "problem_1",
            "title": "Nghị luận về \"Vùng an toàn\"",
            "type": "essay",
            "prompt": "Từ trải nghiệm cá nhân, hãy viết bài văn nghị luận (khoảng 500 chữ) trình bày suy nghĩ của bạn về việc thế hệ trẻ nên bước ra khỏi vùng an toàn của bản thân.",
            "createdBy": "user_teacher_1",
            "createdAt": 1672574400000
        }];
        saveData('problems.json', this.problems);
    }
  }
}

declare global {
  var storeGlobal: Store | undefined;
}

const store = globalThis.storeGlobal ?? new Store();

if (process.env.NODE_ENV !== 'production') {
  globalThis.storeGlobal = store;
}

export const db = {
    get all() {
        return {
            users: Promise.resolve([...store.users]),
            problems: Promise.resolve([...store.problems]),
            submissions: Promise.resolve([...store.submissions]),
            exams: Promise.resolve([...store.exams]),
            examAttempts: Promise.resolve([...store.examAttempts]),
            classrooms: Promise.resolve([...store.classrooms]),
        };
    },
    users: {
        find: async (predicate: (user: User) => boolean) => {
            return store.users.find(predicate);
        },
        some: async (predicate: (user: User) => boolean) => {
            return store.users.some(predicate);
        },
        create: async (data: Omit<User, 'id'>) => {
            const newUser = { ...data, id: getUUID() } as User;
            store.users.push(newUser);
            saveData('users.json', store.users);
            return newUser;
        },
        update: async (id: string, data: Partial<User>) => {
            const index = store.users.findIndex(u => u.id === id);
            if (index === -1) throw new Error("User not found");
            store.users[index] = { ...store.users[index], ...data };
            saveData('users.json', store.users);
            return store.users[index];
        },
        delete: async (id: string) => {
            const adminUser = store.users.find(u => u.role === 'admin');
            if (!adminUser) throw new Error("Admin user not found.");
            if (id === adminUser.id) throw new Error("Cannot delete admin.");

            store.problems.forEach(p => { if (p.createdBy === id) p.createdBy = adminUser.id; });
            saveData('problems.json', store.problems);
            
            store.exams.forEach(e => { if (e.createdBy === id) e.createdBy = adminUser.id; });
            saveData('exams.json', store.exams);

            store.submissions = store.submissions.filter(s => s.submitterId !== id);
            saveData('submissions.json', store.submissions);
            
            store.examAttempts = store.examAttempts.filter(a => a.studentId !== id);
            saveData('examAttempts.json', store.examAttempts);
            
            store.classrooms = store.classrooms.filter(c => c.teacherId !== id);
            store.classrooms.forEach(c => {
                c.studentIds = c.studentIds.filter(sid => sid !== id);
            });
            saveData('classrooms.json', store.classrooms);

            store.users = store.users.filter(u => u.id !== id);
            saveData('users.json', store.users);
            return true;
        }
    },
    problems: {
        create: async (data: Omit<Problem, 'id' | 'createdAt'>) => {
            const newProblem = {
                ...data,
                id: getUUID(),
                createdAt: Date.now(),
                classroomIds: data.classroomIds ?? [],
            } as Problem;
            store.problems.push(newProblem);
            saveData('problems.json', store.problems);
            return newProblem;
        },
        update: async (id: string, data: Partial<Problem>) => {
             const index = store.problems.findIndex(p => p.id === id);
             if (index === -1) throw new Error("Problem not found");
             store.problems[index] = { ...store.problems[index], ...data };
            saveData('problems.json', store.problems);
            return store.problems[index];
        },
        delete: async (id: string) => {
            store.problems = store.problems.filter(p => p.id !== id);
            saveData('problems.json', store.problems);
            return { id };
        }
    },
    submissions: {
         create: async (data: Omit<Submission, 'id' | 'submittedAt'>) => {
            const newSubmission = { 
                ...data,
                id: getUUID(),
                submittedAt: Date.now(),
            } as Submission;
            store.submissions.push(newSubmission);
            saveData('submissions.json', store.submissions);
            return newSubmission;
        },
        update: async (id: string, data: Partial<Submission>) => {
            const index = store.submissions.findIndex(s => s.id === id);
            if (index === -1) throw new Error("Submission not found");
            store.submissions[index] = { ...store.submissions[index], ...data };
            saveData('submissions.json', store.submissions);
            return store.submissions[index];
        },
    },
    exams: {
         create: async (data: Omit<Exam, 'id' | 'createdAt'>) => {
            const newExam = { 
                ...data,
                id: getUUID(),
                createdAt: Date.now(),
                classroomIds: data.classroomIds ?? [],
            } as Exam;
            store.exams.push(newExam);
            saveData('exams.json', store.exams);
            return newExam;
        },
        delete: async (id: string) => {
            store.exams = store.exams.filter(e => e.id !== id);
            saveData('exams.json', store.exams);
            return { id };
        }
    },
    examAttempts: {
        create: async (data: Omit<ExamAttempt, 'id' | 'startedAt' | 'fullscreenExits' | 'visibilityStateChanges' | 'submissionIds'>) => {
            const newAttempt = {
                ...data,
                id: getUUID(),
                startedAt: Date.now(),
                fullscreenExits: [],
                visibilityStateChanges: [],
                submissionIds: [],
            } as ExamAttempt;
            store.examAttempts.push(newAttempt);
            saveData('examAttempts.json', store.examAttempts);
            return newAttempt;
        },
        update: async (id: string, data: Partial<ExamAttempt>) => {
             const index = store.examAttempts.findIndex(a => a.id === id);
             if (index === -1) throw new Error("Exam attempt not found");
             store.examAttempts[index] = { ...store.examAttempts[index], ...data };
            saveData('examAttempts.json', store.examAttempts);
            return store.examAttempts[index];
        },
    },
    classrooms: {
        find: async (predicate: (classroom: Classroom) => boolean) => {
            return store.classrooms.find(predicate);
        },
        create: async (data: Omit<Classroom, 'id' | 'studentIds' | 'joinCode'>) => {
            const generateJoinCode = () => {
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                let code = '';
                for (let i = 0; i < 6; i++) {
                    code += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return code;
            };
            const newClassroom = {
                ...data,
                id: getUUID(),
                studentIds: [],
                joinCode: generateJoinCode(),
                isPublic: data.isPublic || false,
            } as Classroom;
            store.classrooms.push(newClassroom);
            saveData('classrooms.json', store.classrooms);
            return newClassroom;
        },
        update: async (id: string, data: Partial<Classroom>) => {
            const index = store.classrooms.findIndex(c => c.id === id);
            if (index === -1) throw new Error("Classroom not found");
            store.classrooms[index] = { ...store.classrooms[index], ...data };
            saveData('classrooms.json', store.classrooms);
            return store.classrooms[index];
        },
        delete: async (id: string) => {
            store.problems.forEach(p => {
                if (p.classroomIds) p.classroomIds = p.classroomIds.filter(cid => cid !== id);
            });
            saveData('problems.json', store.problems);
            store.exams.forEach(e => {
                if (e.classroomIds) e.classroomIds = e.classroomIds.filter(cid => cid !== id);
            });
            saveData('exams.json', store.exams);
            store.classrooms = store.classrooms.filter(c => c.id !== id);
            saveData('classrooms.json', store.classrooms);
            return true;
        }
    }
};
