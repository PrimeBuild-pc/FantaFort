import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

interface TeamStatsProps {
  weeklyData: number[];
  monthlyData: number[];
  seasonData: number[];
}

export default function TeamStats({ weeklyData, monthlyData, seasonData }: TeamStatsProps) {
  const [activeTab, setActiveTab] = useState<'week' | 'month' | 'season'>('month');
  
  const displayData = activeTab === 'week' 
    ? weeklyData 
    : activeTab === 'month' 
      ? monthlyData 
      : seasonData;
      
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Find max value for scaling
  const maxValue = Math.max(...displayData);
  
  return (
    <Card className="mt-6 p-4">
      <CardHeader className="p-0 pb-4">
        <div className="flex justify-between items-center">
          <CardTitle>TEAM PERFORMANCE</CardTitle>
          <div className="flex space-x-2">
            <button 
              className={`text-xs ${activeTab === 'week' ? 'bg-[#2D0E75] bg-opacity-40 text-white' : 'bg-[#121212] text-gray-300 hover:text-white'} px-3 py-1 rounded-full`}
              onClick={() => setActiveTab('week')}
            >
              Week
            </button>
            <button 
              className={`text-xs ${activeTab === 'month' ? 'bg-[#1890FF] bg-opacity-40 text-white' : 'bg-[#121212] text-gray-300 hover:text-white'} px-3 py-1 rounded-full`}
              onClick={() => setActiveTab('month')}
            >
              Month
            </button>
            <button 
              className={`text-xs ${activeTab === 'season' ? 'bg-[#00F0B5] bg-opacity-40 text-white' : 'bg-[#121212] text-gray-300 hover:text-white'} px-3 py-1 rounded-full`}
              onClick={() => setActiveTab('season')}
            >
              Season
            </button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="h-60 relative">
          <div className="absolute inset-0 flex items-end">
            {displayData.map((value, index) => {
              // Calculate height percentage based on max value
              const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
              // Determine color based on value relative to max
              let color = '#2D0E75';
              if (value > maxValue * 0.75) color = '#00F0B5';
              else if (value > maxValue * 0.5) color = '#1890FF';
              
              return (
                <div 
                  key={index}
                  className="w-1/7 mx-1 rounded-t-sm relative overflow-hidden transition-all duration-500"
                  style={{ 
                    height: `${heightPercent}%`, 
                    backgroundColor: `${color}40`
                  }}
                >
                  <div className="absolute inset-0 opacity-50 bg-gradient-to-t stats-bar" 
                    style={{from: color, to: 'transparent'}}></div>
                </div>
              );
            })}
          </div>
          
          {/* Chart grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[500, 400, 300, 200, 100, 0].map((value) => (
              <div key={value} className="border-b border-gray-700 border-dashed h-0 relative">
                <span className="absolute -top-3 -left-10 text-xs text-gray-500">{value}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          {days.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
      </CardContent>

      <style jsx>{`
        .stats-bar {
          position: relative;
          overflow: hidden;
        }
        
        .stats-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 30px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: shine 2s infinite;
        }
        
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </Card>
  );
}
