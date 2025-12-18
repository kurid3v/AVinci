
'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';

// Data 1: Thời gian chấm bài (Grading Time)
const timeData = [
  { name: 'Giáo viên chấm thủ công', time: 15, label: '15-20 phút' },
  { name: 'AVinci AI hỗ trợ', time: 0.5, label: '< 1 phút' },
];

// Data 2: Những khó khăn thường gặp (Difficulties)
const difficultyData = [
  { name: 'Thiếu phản hồi chi tiết', value: 45 },
  { name: 'Chấm cảm tính/chủ quan', value: 30 },
  { name: 'Áp lực thời gian', value: 15 },
  { name: 'Khác', value: 10 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// Data 3: Nhu cầu học sinh (Student Needs)
const studentNeedsData = [
  { subject: 'Biết điểm ngay', A: 90 },
  { subject: 'Sửa lỗi ngữ pháp', A: 85 },
  { subject: 'Gợi ý nâng cao', A: 70 },
  { subject: 'Học mọi lúc', A: 95 },
];

// Data 4: Radar Comparison (So sánh hiệu quả)
const radarData = [
  { subject: 'Tốc độ', A: 30, B: 95, fullMark: 100 },
  { subject: 'Tính khách quan', A: 60, B: 90, fullMark: 100 },
  { subject: 'Chi tiết phản hồi', A: 50, B: 95, fullMark: 100 },
  { subject: 'Tính sẵn sàng', A: 20, B: 100, fullMark: 100 },
  { subject: 'Tiết kiệm thời gian', A: 20, B: 90, fullMark: 100 },
];

const AnalyticsCharts = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Chart 1: Thời gian chấm */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Thời gian chấm trung bình 1 bài văn (phút)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={150} tick={{fontSize: 12}} />
              <Tooltip />
              <Legend />
              <Bar dataKey="time" name="Thời gian (phút)" fill="#8884d8">
                {timeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#ff8042' : '#00c49f'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-slate-500 mt-2 text-center italic">
            *AVinci giúp giảm hơn 95% thời gian chấm bài, cho phép giáo viên tập trung vào chuyên môn.
        </p>
      </div>

      {/* Chart 2: Radar Comparison */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">So sánh hiệu quả toàn diện</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{fontSize: 11}} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar name="Phương pháp truyền thống" dataKey="A" stroke="#ff8042" fill="#ff8042" fillOpacity={0.3} />
              <Radar name="AVinci AI" dataKey="B" stroke="#00c49f" fill="#00c49f" fillOpacity={0.5} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
         <p className="text-sm text-slate-500 mt-2 text-center italic">
            *AVinci vượt trội về tốc độ, tính sẵn sàng và độ chi tiết của phản hồi.
        </p>
      </div>

      {/* Chart 3: Khó khăn (Pie) */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Thách thức trong dạy & học Văn hiện nay</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={difficultyData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {difficultyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 4: Nhu cầu học sinh (Bar) */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Khảo sát: Mong muốn của học sinh</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={studentNeedsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" tick={{fontSize: 12}} />
              <YAxis unit="%" />
              <Tooltip />
              <Bar dataKey="A" name="Tỉ lệ đồng ý" fill="#0088FE" radius={[4, 4, 0, 0]} label={{ position: 'top', formatter: (v: number) => `${v}%` }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
         <p className="text-sm text-slate-500 mt-2 text-center italic">
            *Hơn 85% học sinh mong muốn nhận được kết quả và sửa lỗi ngay lập tức.
        </p>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
