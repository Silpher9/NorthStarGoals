import React, { useMemo, useState } from 'react';
import { Todo } from '../types';
import { Activity, Calendar, Award, BarChart3 } from 'lucide-react';
import { 
  TIER_MULTIPLIERS, 
  TIER_COLORS, 
  getTierFromTodo, 
  calculateTodoPoints,
  type Tier 
} from '../utils/pointCalculations';

const StatsView: React.FC<StatsViewProps> = ({ todos }) => {
  const [period, setPeriod] = useState<Period>('week');

  // 1. Calculate General Stats
  const stats = useMemo(() => {
    let totalScore = 0;
    let completedCount = 0;
    let failedCount = 0;

    todos.forEach(t => {
      // Calculate buyback deductions for ANY task (active, completed, or failed)
      if (t.buybackHistory && t.buybackHistory.length > 0) {
          t.buybackHistory.forEach(event => {
              totalScore -= event.cost;
          });
      }

      if (!t.completed && t.status !== 'graveyard') return;

      const points = calculateTodoPoints(t, todos);

      if (t.completed) {
        totalScore += points;
        completedCount++;
      } else if (t.status === 'graveyard') {
        // Failed tasks deduct points with 3x Multiplier
        totalScore -= (points * 3);
        failedCount++;
      }
    });

    return { totalScore, completedCount, failedCount };
  }, [todos]);

  // 2. Generate Graph Data based on Period
  const graphData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    let labels: string[] = [];
    let buckets = 0;
    let getBucketIndex: (date: Date) => number = () => 0;

    if (period === 'week') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        monday.setHours(0,0,0,0);
        
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        buckets = 7;
        
        getBucketIndex = (date) => {
            const d = new Date(date);
            d.setHours(0,0,0,0);
            const timeDiff = d.getTime() - monday.getTime();
            const dayDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
            return (dayDiff >= 0 && dayDiff < 7) ? dayDiff : -1;
        };
    } else if (period === 'month') {
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        labels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
        buckets = daysInMonth;

        getBucketIndex = (date) => {
            if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
                return date.getDate() - 1;
            }
            return -1;
        };
    } else if (period === 'year') {
        labels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
        buckets = 12;

        getBucketIndex = (date) => {
            if (date.getFullYear() === currentYear) {
                return date.getMonth();
            }
            return -1;
        };
    }

    const rawData: Record<string, number[]> = {
      gold: new Array(buckets).fill(0),
      silver: new Array(buckets).fill(0),
      bronze: new Array(buckets).fill(0),
      normal: new Array(buckets).fill(0)
    };

    todos.forEach(t => {
      const tier = getTierFromTodo(t, todos);
      
      // Handle Buyback Events (Negative points at timestamp)
      if (t.buybackHistory) {
          t.buybackHistory.forEach(event => {
              const bDate = new Date(event.timestamp);
              const idx = getBucketIndex(bDate);
              if (idx !== -1) {
                  rawData[tier][idx] -= event.cost;
              }
          });
      }

      if (!t.resolvedAt) return;
      const rDate = new Date(t.resolvedAt);
      
      const idx = getBucketIndex(rDate);
      if (idx === -1) return;

      const points = calculateTodoPoints(t, todos);

      // Failed Penalty 3x
      const val = t.completed ? points : (t.status === 'graveyard' ? -(points * 3) : 0);

      rawData[tier][idx] += val;
    });

    const accumulate = (arr: number[]) => {
        let sum = 0;
        return arr.map(val => {
            sum += val;
            return sum;
        });
    };

    const accumulatedData = {
        gold: accumulate(rawData.gold),
        silver: accumulate(rawData.silver),
        bronze: accumulate(rawData.bronze),
        normal: accumulate(rawData.normal)
    };

    return { labels, dataPoints: accumulatedData };
  }, [todos, period]);

  // Helper for Graph Scaling
  const { yMin, yRange } = useMemo(() => {
      const allValues = [
          ...graphData.dataPoints.gold,
          ...graphData.dataPoints.silver,
          ...graphData.dataPoints.bronze,
          ...graphData.dataPoints.normal
      ];
      
      let min = Math.min(0, ...allValues); 
      let max = Math.max(50, ...allValues); 
      
      const padding = (max - min) * 0.1 || 10;
      min -= padding;
      max += padding;
      
      return { yMin: min, yRange: max - min };
  }, [graphData]);

  const getYPerc = (val: number) => {
      if (yRange === 0) return 50;
      const perc = 100 - ((val - yMin) / yRange) * 100;
      return isNaN(perc) ? 100 : perc;
  };

  const getPointsString = (data: number[]) => {
      const count = data.length;
      if (count === 0) return "";
      
      return data.map((val, i) => {
          const x = count > 1 ? (i / (count - 1)) * 100 : 50; 
          const y = getYPerc(val); 
          return `${x},${y}`;
      }).join(' ');
  };

  const gridLines = useMemo(() => {
      const hLines = [];
      const vLines = [];

      const step = Math.ceil(yRange / 5 / 10) * 10 || 10;
      const start = Math.floor(yMin / step) * step;
      const end = Math.ceil((yMin + yRange) / step) * step;
      
      for (let val = start; val <= end; val += step) {
          const yPerc = getYPerc(val);
          if (yPerc >= -5 && yPerc <= 105) {
              hLines.push({ val, yPerc });
          }
      }

      const count = graphData.labels.length;
      if (count > 1) {
          for(let i=0; i<count; i++) {
               const xPerc = (i / (count - 1)) * 100;
               vLines.push(xPerc);
          }
      }

      return { hLines, vLines };
  }, [yMin, yRange, graphData.labels.length]);

  const aggregateData = useMemo(() => {
     const currentYear = new Date().getFullYear();
     const currentMonth = new Date().getMonth();
     
     const monthStats = { gold: 0, silver: 0, bronze: 0, normal: 0, total: 0 };
     const yearStats = { gold: 0, silver: 0, bronze: 0, normal: 0, total: 0 };

     todos.forEach(t => {
        // Calculate Buyback costs for aggregation
        let buybackDeductionMonth = 0;
        let buybackDeductionYear = 0;

        if (t.buybackHistory) {
            t.buybackHistory.forEach(e => {
                const d = new Date(e.timestamp);
                if (d.getFullYear() === currentYear) {
                    buybackDeductionYear += e.cost;
                    if (d.getMonth() === currentMonth) {
                        buybackDeductionMonth += e.cost;
                    }
                }
            });
        }
        
        const tier = getTierFromTodo(t, todos);
        
        // Subtract buybacks first
        if (buybackDeductionMonth > 0) {
            monthStats[tier] -= buybackDeductionMonth;
            monthStats.total -= buybackDeductionMonth;
        }
        if (buybackDeductionYear > 0) {
            yearStats[tier] -= buybackDeductionYear;
            yearStats.total -= buybackDeductionYear;
        }

        if (!t.resolvedAt) return;
        const d = new Date(t.resolvedAt);
        const isYear = d.getFullYear() === currentYear;
        const isMonth = isYear && d.getMonth() === currentMonth;

        if (!isYear) return;

        const points = calculateTodoPoints(t, todos);
        
        // Failed Penalty 3x
        const val = t.completed ? points : (t.status === 'graveyard' ? -(points * 3) : 0);

        if (isMonth) {
            monthStats[tier] += val;
            monthStats.total += val;
        }
        yearStats[tier] += val;
        yearStats.total += val;
     });

     return { monthStats, yearStats };
  }, [todos]);

  const lastValues = useMemo(() => {
      const d = graphData.dataPoints;
      const len = d.gold.length;
      if (len === 0) return { gold: 0, silver: 0, bronze: 0, normal: 0 };
      return {
          gold: d.gold[len - 1],
          silver: d.silver[len - 1],
          bronze: d.bronze[len - 1],
          normal: d.normal[len - 1]
      };
  }, [graphData]);

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto space-y-8">
        <div className="text-center relative">
            <h2 className="text-2xl font-light tracking-[0.2em] text-white">INTELLIGENCE</h2>
            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Performance Analytics</p>
            
            <div className="mt-6 flex justify-center gap-4">
                <div className="bg-slate-900/95 md:bg-slate-800/50 md:backdrop-blur-sm border border-slate-700 p-4 rounded-2xl flex flex-col items-center w-32 shadow-lg">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Total Score</span>
                    <span className={`text-3xl font-black ${stats.totalScore >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {stats.totalScore > 0 ? '+' : ''}{Math.round(stats.totalScore)}
                    </span>
                </div>
                <div className="bg-slate-900/95 md:bg-slate-800/50 md:backdrop-blur-sm border border-slate-700 p-4 rounded-2xl flex flex-col items-center w-32 shadow-lg">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Completion</span>
                    <span className="text-3xl font-black text-blue-400">
                        {stats.completedCount + stats.failedCount > 0 
                            ? Math.round((stats.completedCount / (stats.completedCount + stats.failedCount)) * 100) 
                            : 0}%
                    </span>
                </div>
            </div>
        </div>

        <div className="bg-slate-900/95 md:bg-slate-900/50 md:backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl relative">
             <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                 <div className="flex items-center gap-2">
                     <Activity size={16} className="text-indigo-400" />
                     <h3 className="text-sm font-bold uppercase tracking-widest text-slate-300">Trajectory (Cumulative)</h3>
                 </div>
                 
                 <div className="flex bg-slate-800 rounded-lg p-1">
                     {(['week', 'month', 'year'] as const).map((p) => (
                         <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`
                                px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all
                                ${period === p ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}
                            `}
                         >
                             {p}
                         </button>
                     ))}
                 </div>
             </div>
             
             <div className="h-64 relative mt-2 mr-12">
                 <svg className="w-full h-full overflow-visible absolute top-0 left-0 z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                     <g className="opacity-30">
                        {gridLines.vLines.map((x, i) => (
                            <line 
                                key={`v-${i}`} x1={x} y1="0" x2={x} y2="100" 
                                stroke="#475569" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" 
                            />
                        ))}
                        {gridLines.hLines.map((line, i) => (
                             <line 
                                key={`h-${i}`} x1="0" y1={line.yPerc} x2="100" y2={line.yPerc} 
                                stroke={line.val === 0 ? "#94a3b8" : "#475569"} 
                                strokeWidth={line.val === 0 ? "2" : "1"} 
                                vectorEffect="non-scaling-stroke" 
                                strokeDasharray={line.val === 0 ? "" : "3 3"} 
                                opacity={line.val === 0 ? 0.5 : 1}
                             />
                        ))}
                     </g>

                     <g className="drop-shadow-md">
                        <polyline points={getPointsString(graphData.dataPoints.gold)} fill="none" stroke={TIER_COLORS.gold} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" />
                        <polyline points={getPointsString(graphData.dataPoints.silver)} fill="none" stroke={TIER_COLORS.silver} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" />
                        <polyline points={getPointsString(graphData.dataPoints.bronze)} fill="none" stroke={TIER_COLORS.bronze} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" />
                        <polyline points={getPointsString(graphData.dataPoints.normal)} fill="none" stroke={TIER_COLORS.normal} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="opacity-90" />
                     </g>
                 </svg>

                 <div className="absolute inset-0 pointer-events-none z-20">
                      <LabelOverlay val={Math.round(lastValues.gold)} yPerc={getYPerc(lastValues.gold)} color={TIER_COLORS.gold} />
                      <LabelOverlay val={Math.round(lastValues.silver)} yPerc={getYPerc(lastValues.silver)} color={TIER_COLORS.silver} />
                      <LabelOverlay val={Math.round(lastValues.bronze)} yPerc={getYPerc(lastValues.bronze)} color={TIER_COLORS.bronze} />
                      <LabelOverlay val={Math.round(lastValues.normal)} yPerc={getYPerc(lastValues.normal)} color={TIER_COLORS.normal} />
                      
                      {gridLines.hLines.map((g, i) => (
                           g.val !== 0 && (i % 2 === 0) && (
                             <div key={`l-${i}`} className="absolute left-0 text-[9px] text-slate-600 font-mono -translate-y-1/2 pl-1" style={{ top: `${g.yPerc}%` }}>
                                {g.val}
                             </div>
                           )
                      ))}
                 </div>

                 <div className="absolute top-full left-0 w-full flex justify-between mt-2 text-[9px] font-mono text-slate-500 uppercase z-20">
                     {period === 'month' 
                        ? graphData.labels.filter((_, i) => i % 5 === 0).map(d => <span key={d}>{d}</span>) 
                        : graphData.labels.map(d => <span key={d}>{d}</span>)
                     }
                 </div>
             </div>

             <div className="flex justify-center gap-4 mt-8 text-[10px] font-bold uppercase">
                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500" /> Gold</div>
                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-300" /> Silver</div>
                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /> Bronze</div>
                 <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500" /> Normal</div>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
            <div className="bg-slate-900/95 md:bg-slate-900/50 md:backdrop-blur-sm border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                    <Calendar size={14} className="text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">This Month</h3>
                </div>
                <div className="space-y-3">
                    <Row label="Gold Goal Tasks" value={aggregateData.monthStats.gold} color="text-yellow-500" />
                    <Row label="Silver Goal Tasks" value={aggregateData.monthStats.silver} color="text-slate-300" />
                    <Row label="Bronze Goal Tasks" value={aggregateData.monthStats.bronze} color="text-orange-500" />
                    <Row label="Normal Tasks" value={aggregateData.monthStats.normal} color="text-purple-500" />
                    <div className="pt-2 mt-2 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-300 uppercase">Net Total</span>
                        <span className={`text-sm font-black ${aggregateData.monthStats.total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                             {aggregateData.monthStats.total > 0 ? '+' : ''}{Math.round(aggregateData.monthStats.total)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900/95 md:bg-slate-900/50 md:backdrop-blur-sm border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                    <Award size={14} className="text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">This Year</h3>
                </div>
                 <div className="space-y-3">
                    <Row label="Gold Goal Tasks" value={aggregateData.yearStats.gold} color="text-yellow-500" />
                    <Row label="Silver Goal Tasks" value={aggregateData.yearStats.silver} color="text-slate-300" />
                    <Row label="Bronze Goal Tasks" value={aggregateData.yearStats.bronze} color="text-orange-500" />
                    <Row label="Normal Tasks" value={aggregateData.yearStats.normal} color="text-purple-500" />
                    <div className="pt-2 mt-2 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-300 uppercase">Net Total</span>
                         <span className={`text-sm font-black ${aggregateData.yearStats.total >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                             {aggregateData.yearStats.total > 0 ? '+' : ''}{Math.round(aggregateData.yearStats.total)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

const Row = ({ label, value, color }: { label: string, value: number, color: string }) => (
    <div className="flex justify-between items-center">
        <span className={`text-xs ${color} opacity-80`}>{label}</span>
        <span className="text-xs font-mono font-bold text-slate-500">{value > 0 ? '+' : ''}{Math.round(value)}</span>
    </div>
);

const LabelOverlay = ({ val, yPerc, color }: { val: number, yPerc: number, color: string }) => (
    <div 
        className="absolute right-[-35px] text-[10px] font-bold font-mono transition-all duration-500 text-right w-[35px]"
        style={{ 
            top: `${yPerc}%`, 
            transform: 'translateY(-50%)',
            color: color
        }}
    >
        {val > 0 ? '+' : ''}{val}
    </div>
);

export default StatsView;