
import React from 'react';

const SystemDiagram: React.FC = () => {
  // Styles for the blue blocks
  const blockClass = "bg-blue-600 text-white font-bold p-4 rounded-lg text-center shadow-lg flex items-center justify-center min-h-[80px] z-10 relative";
  const labelClass = "font-bold text-slate-700 text-center mb-2";

  return (
    <div className="w-full max-w-6xl mx-auto p-8">
      {/* Main Frame */}
      <div className="border-4 border-blue-500 rounded-3xl p-8 relative bg-white shadow-2xl">
        
        {/* Main Title Badge */}
        <div className="absolute -top-7 left-1/2 transform -translate-x-1/2">
          <div className="bg-blue-600 text-white text-2xl font-bold py-2 px-12 rounded-xl shadow-md uppercase">
            Cấu tạo
          </div>
        </div>

        {/* Upper Section (Main Logic Flow) */}
        <div className="grid grid-cols-12 gap-4 mt-8 relative">
          
          {/* Connecting Lines (SVG Layer) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
            {/* Arrow: Laptop -> Sleep Warning */}
            <path d="M250 120 C 300 120, 320 120, 380 120" fill="none" stroke="#f97316" strokeWidth="3" markerEnd="url(#arrow)" />
            
            {/* Arrow: Sleep Warning -> Middle Block (Anti-misstep) */}
            <path d="M480 160 Q 480 200, 480 230" fill="none" stroke="#f97316" strokeWidth="3" markerEnd="url(#arrow)" />
            
            {/* Arrow: Circuit Diagram -> Arduino */}
            <path d="M750 160 Q 750 200, 800 250" fill="none" stroke="#f97316" strokeWidth="3" markerEnd="url(#arrow)" />
            
            {/* Arrow: Middle Block -> Right Model */}
            <path d="M650 280 C 700 280, 750 280, 820 280" fill="none" stroke="#f97316" strokeWidth="3" markerEnd="url(#arrow)" />

            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#f97316" />
              </marker>
            </defs>
          </svg>

          {/* Left Column: Inputs (Laptop/Camera) */}
          <div className="col-span-12 md:col-span-4 flex flex-col gap-6 items-center">
            <div className="bg-slate-800 rounded-lg p-2 w-full max-w-xs shadow-md border-4 border-slate-600">
               {/* Laptop Mockup */}
               <div className="bg-slate-900 h-32 w-full mb-1 rounded flex items-center justify-center text-slate-500 text-xs">
                  (Màn hình Laptop)
               </div>
               <div className="bg-slate-700 h-2 w-full"></div>
            </div>
            
            <div className="bg-slate-100 border border-slate-300 w-full max-w-xs p-2 rounded relative">
                {/* Camera/Face Detection Mockup */}
                <div className="aspect-video bg-black rounded overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="border-2 border-green-500 w-24 h-32 relative">
                            <span className="absolute -top-5 left-0 text-green-500 text-xs bg-black px-1">Face Detected</span>
                        </div>
                    </div>
                    <div className="absolute top-2 left-2 text-green-500 text-[10px] font-mono">
                        Tracking: ON<br/>
                        Eyes: OPEN
                    </div>
                </div>
            </div>
          </div>

          {/* Center Column: Logical Blocks */}
          <div className="col-span-12 md:col-span-4 flex flex-col gap-12 items-center justify-start py-4">
             <div className="flex gap-4 w-full">
                <div className={`${blockClass} flex-1`}>
                    Hệ thống<br/>cảnh báo<br/>ngủ gật
                </div>
                <div className={`${blockClass} flex-1`}>
                    Sơ đồ<br/>mạch<br/>điện
                </div>
             </div>

             <div className={`${blockClass} w-full mt-4 !bg-blue-600/90 py-8`}>
                Hệ thống<br/>chống đạp<br/>nhầm chân ga<br/>và cảnh báo<br/>nồng độ cồn
             </div>
          </div>

          {/* Right Column: Hardware Implementation */}
          <div className="col-span-12 md:col-span-4 flex flex-col gap-6 items-center">
             {/* Circuit Diagram Mockup */}
             <div className="border border-slate-300 bg-white p-2 rounded w-full h-48 relative overflow-hidden">
                <div className="absolute top-2 left-2 w-16 h-20 border border-blue-500 bg-blue-100 flex items-center justify-center text-xs">Arduino</div>
                <div className="absolute top-2 right-2 w-12 h-12 bg-red-100 border border-red-500 rounded-full flex items-center justify-center text-[10px] text-center">Còi</div>
                <div className="absolute bottom-2 left-10 w-8 h-8 bg-yellow-100 border border-yellow-500 rounded-full"></div>
                {/* Wires */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <line x1="50" y1="50" x2="150" y2="50" stroke="black" strokeWidth="1"/>
                    <line x1="60" y1="80" x2="60" y2="120" stroke="red" strokeWidth="1"/>
                    <line x1="80" y1="80" x2="200" y2="30" stroke="green" strokeWidth="1"/>
                </svg>
             </div>

             {/* Physical Model Mockup */}
             <div className="border border-slate-300 bg-amber-100 p-2 rounded w-full h-40 flex items-center justify-center shadow-inner">
                <div className="text-center">
                    <div className="w-16 h-16 bg-yellow-400 rounded-full mx-auto mb-2 border-4 border-black animate-spin-slow"></div>
                    <span className="text-xs font-semibold text-amber-800">Mô hình thực tế</span>
                </div>
             </div>
          </div>
        </div>

        {/* Bottom Section (Components) */}
        <div className="mt-12 pt-8 border-t-2 border-slate-200 relative">
            <div className="absolute -top-4 left-8 bg-teal-600 text-white px-4 py-1 rounded-full font-bold shadow">
                Một số linh kiện chính
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="flex flex-col items-center">
                    <div className="w-20 h-16 bg-blue-700 rounded-md shadow mb-2 flex items-center justify-center text-white text-xs">UNO</div>
                    <span className="font-semibold text-sm">Arduino</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-green-500 rounded-full shadow mb-2 border-4 border-gray-300"></div>
                    <span className="font-semibold text-sm text-center">Cảm biến<br/>nồng độ cồn</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-300 rounded-full shadow mb-2 border-b-4 border-gray-400"></div>
                    <span className="font-semibold text-sm">Biến trở</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-16 h-12 bg-black rounded shadow mb-2 relative">
                        <div className="absolute -right-2 top-2 w-4 h-8 bg-white border border-black"></div>
                    </div>
                    <span className="font-semibold text-sm">Servo</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-20 h-14 bg-slate-800 rounded-md shadow mb-2 border-b-4 border-slate-900"></div>
                    <span className="font-semibold text-sm">Máy tính</span>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default SystemDiagram;
