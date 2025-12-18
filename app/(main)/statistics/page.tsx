
'use client';
import React from 'react';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import LightBulbIcon from '@/components/icons/LightBulbIcon';
import ShieldCheckIcon from '@/components/icons/ShieldCheckIcon';
import UsersIcon from '@/components/icons/UsersIcon';

export default function StatisticsPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold text-slate-900">Thống kê & Cơ sở thực tiễn</h1>
                <p className="text-slate-600 mt-3 text-lg max-w-3xl mx-auto">
                    Dữ liệu phân tích và cơ sở khoa học đằng sau sự ra đời của AVinci - 
                    Giải pháp AI hỗ trợ dạy và học Văn học hiệu quả.
                </p>
            </header>

            {/* Problem Statement Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-red-100 rounded-full text-red-600 mb-4">
                        <UsersIcon className="h-8 w-8" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Quá tải công việc</h3>
                    <p className="text-slate-600 text-sm">
                        Giáo viên mất trung bình 15-20 phút để chấm kỹ một bài văn. Với sĩ số lớn, việc trả bài nhanh và chi tiết là bất khả thi.
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-yellow-100 rounded-full text-yellow-600 mb-4">
                        <ShieldCheckIcon />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Đánh giá chủ quan</h3>
                    <p className="text-slate-600 text-sm">
                        Việc chấm văn thường phụ thuộc vào cảm xúc và sự mệt mỏi của người chấm, dẫn đến thiếu nhất quán trong điểm số.
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex flex-col items-center text-center">
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600 mb-4">
                        <LightBulbIcon />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 mb-2">Học sinh thụ động</h3>
                    <p className="text-slate-600 text-sm">
                        Học sinh thường chỉ nhận được điểm số mà không có lời giải thích chi tiết về lỗi sai hay cách cải thiện cụ thể.
                    </p>
                </div>
            </div>

            {/* Charts Section */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold text-slate-800 mb-6 border-l-4 border-primary pl-4">Dữ liệu phân tích</h2>
                <AnalyticsCharts />
            </section>

            {/* Solution Summary */}
            <section className="bg-primary/5 p-8 rounded-2xl border border-primary/20">
                <h2 className="text-2xl font-bold text-primary mb-4">Giải pháp AVinci mang lại</h2>
                <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</span>
                        <p className="text-slate-800"><span className="font-bold">Phản hồi tức thì (Real-time Feedback):</span> Chấm điểm và nhận xét chi tiết chỉ trong vài giây.</p>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">2</span>
                        <p className="text-slate-800"><span className="font-bold">Cá nhân hóa (Personalization):</span> Gợi ý sửa lỗi dựa trên năng lực cụ thể của từng học sinh.</p>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">3</span>
                        <p className="text-slate-800"><span className="font-bold">Khách quan & Nhất quán:</span> Loại bỏ yếu tố cảm xúc trong quá trình đánh giá.</p>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">4</span>
                        <p className="text-slate-800"><span className="font-bold">Tiết kiệm thời gian:</span> Giảm tải 90% công việc hành chính cho giáo viên.</p>
                    </li>
                </ul>
            </section>
        </div>
    );
}
