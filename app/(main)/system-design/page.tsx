
'use client';
import React from 'react';
import SystemDiagram from '@/components/SystemDiagram';

export default function SystemDesignPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <header className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-slate-900">Thiết kế hệ thống</h1>
                <p className="text-slate-600 mt-2">
                    Sơ đồ cấu tạo và nguyên lý hoạt động của hệ thống phần cứng.
                </p>
            </header>
            <SystemDiagram />
        </div>
    );
}
