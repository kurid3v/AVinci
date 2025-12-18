
'use client';
import React from 'react';
import LightBulbIcon from '@/components/icons/LightBulbIcon';
import ShieldCheckIcon from '@/components/icons/ShieldCheckIcon';
import UsersIcon from '@/components/icons/UsersIcon';

export default function StatisticsPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Thông tin dự án</h1>
            <p className="text-slate-600 mb-8">AVinci là giải pháp AI hỗ trợ dạy và học Văn học hiệu quả.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-red-100 rounded-full text-red-600 mb-4">
                        <UsersIcon className="h-8 w-8" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Giảm tải</h3>
                    <p className="text-slate-600 text-sm">Hỗ trợ giáo viên chấm bài nhanh chóng.</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-yellow-100 rounded-full text-yellow-600 mb-4">
                        <ShieldCheckIcon />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Khách quan</h3>
                    <p className="text-slate-600 text-sm">Đánh giá dựa trên tiêu chí khoa học.</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600 mb-4">
                        <LightBulbIcon />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Phản hồi</h3>
                    <p className="text-slate-600 text-sm">Học sinh nhận kết quả tức thì.</p>
                </div>
            </div>
        </div>
    );
}
