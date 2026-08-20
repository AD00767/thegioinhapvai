import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { 
  Users, UserCheck, Sparkles, AlertTriangle, 
  BarChart3, TrendingUp, ArrowUpRight, ArrowDownRight,
  Activity, RefreshCw, AlertCircle, Play, CheckCircle2, Terminal
} from 'lucide-react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generateUniqueId } from '../../lib/generateId';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, BarChart, Bar 
} from 'recharts';
import toast from 'react-hot-toast';

interface ChartDataPoint {
  name: string;
  users: number;
  chars: number;
  prompts: number;
}

export default function DashboardStats() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCreators: 0,
    totalCharacters: 0,
    totalPrompts: 0,
    pendingReports: 0,
    pendingCreatorRequests: 0,
    userTrend: 0,
    creatorTrend: 0,
    charTrend: 0,
    promptTrend: 0,
  });
  
  const [migrationStats, setMigrationStats] = useState({
    unmigratedUsers: 0,
    unmigratedChars: 0,
    unmigratedPrompts: 0
  });
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatsAndData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const charsSnap = await getDocs(collection(db, 'characters'));
        const promptsSnap = await getDocs(collection(db, 'prompts'));
        const reportsSnap = await getDocs(query(collection(db, 'reports'), where('status', '==', 'PENDING')));
        const requestsSnap = await getDocs(query(collection(db, 'creator_requests'), where('status', '==', 'PENDING')));

        const allUsers = usersSnap.docs.map(d => d.data());
        const allChars = charsSnap.docs.map(d => d.data());
        const allPrompts = promptsSnap.docs.map(d => d.data());
        
        const totalUsers = allUsers.length;
        const totalCreators = allUsers.filter(u => u.creatorStatus === true).length;
        const totalCharacters = allChars.length;
        const totalPrompts = allPrompts.length;

        const unmigratedUsers = usersSnap.docs.filter(d => !d.data().numericId).length;
        const unmigratedChars = charsSnap.docs.filter(d => !d.data().numericId).length;
        const unmigratedPrompts = promptsSnap.docs.filter(d => !d.data().numericId).length;

        setMigrationStats({
          unmigratedUsers,
          unmigratedChars,
          unmigratedPrompts
        });

        // Determine date logic for last 7 days
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const dates: Date[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          dates.push(d);
        }

        const formattedChartData: ChartDataPoint[] = dates.map(date => {
          const startOfDay = new Date(date);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);

          const isWithinDay = (itemDate: string | any) => {
            if (!itemDate) return false;
            let d: Date;
            if (typeof itemDate === 'string') {
              d = new Date(itemDate);
            } else if (itemDate.toDate) {
              d = itemDate.toDate(); // Firestore timestamp
            } else {
              return false;
            }
            return d >= startOfDay && d <= endOfDay;
          };

          return {
            name: `${date.getDate()}/${date.getMonth() + 1}`,
            users: allUsers.filter(u => isWithinDay(u.createdAt)).length,
            chars: allChars.filter(c => isWithinDay(c.createdAt)).length,
            prompts: allPrompts.filter(p => isWithinDay(p.createdAt)).length,
          };
        });

        setChartData(formattedChartData);

        // Trend calculation (last 7 days vs previous 7 days if possible, or just new in last 7 days / total)
        // Since we don't have enough data for 14 days, we can calculate % of total created in last 7 days
        // Or we can just calculate if there are any new items today vs yesterday
        const todayData = formattedChartData[6];
        const yesterdayData = formattedChartData[5];

        const calcTrend = (todayVal: number, yesterdayVal: number) => {
          if (yesterdayVal === 0 && todayVal > 0) return 100;
          if (yesterdayVal === 0 && todayVal === 0) return 0;
          return Math.round(((todayVal - yesterdayVal) / yesterdayVal) * 100);
        };

        setStats({
          totalUsers,
          totalCreators,
          totalCharacters,
          totalPrompts,
          pendingReports: reportsSnap.size,
          pendingCreatorRequests: requestsSnap.size,
          userTrend: calcTrend(todayData.users, yesterdayData.users),
          creatorTrend: calcTrend(
            allUsers.filter(u => u.creatorStatus && new Date(u.createdAt) >= dates[6]).length,
            allUsers.filter(u => u.creatorStatus && new Date(u.createdAt) >= dates[5] && new Date(u.createdAt) < dates[6]).length
          ),
          charTrend: calcTrend(todayData.chars, yesterdayData.chars),
          promptTrend: calcTrend(todayData.prompts, yesterdayData.prompts),
        });

      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatsAndData();
  }, []);

  const runIdMigration = async () => {
    if (migrating) return;
    setMigrating(true);
    setMigrationProgress(0);
    setMigrationLogs(["Khởi động tiến trình di trú ID...", "Bắt đầu tải danh sách dữ liệu..."]);

    const addLog = (msg: string) => {
      setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      // 1. Migrate Users
      addLog("Đang quét danh sách người dùng...");
      const usersSnap = await getDocs(collection(db, 'users'));
      const unmigratedUsers = usersSnap.docs.filter(d => !d.data().numericId);
      addLog(`Tìm thấy ${unmigratedUsers.length} người dùng chưa có ID.`);

      // Prepare characters/prompts unmigrated size
      const charsSnap = await getDocs(collection(db, 'characters'));
      const unmigratedChars = charsSnap.docs.filter(d => !d.data().numericId);
      
      const promptsSnap = await getDocs(collection(db, 'prompts'));
      const unmigratedPrompts = promptsSnap.docs.filter(d => !d.data().numericId);

      const totalToMigrate = unmigratedUsers.length + unmigratedChars.length + unmigratedPrompts.length;

      if (totalToMigrate === 0) {
        addLog("Tất cả tài liệu đã có Numeric ID. Không cần di trú.");
        setMigrationProgress(100);
        setMigrating(false);
        return;
      }

      let processed = 0;

      for (const userDoc of unmigratedUsers) {
        try {
          addLog(`Đang di trú User: ${userDoc.data().displayName || userDoc.id}...`);
          const nid = await generateUniqueId(db, 'user', userDoc.id);
          await updateDoc(doc(db, 'users', userDoc.id), { numericId: nid });
          processed++;
          setMigrationProgress(Math.round((processed / totalToMigrate) * 100));
        } catch (e: any) {
          addLog(`Lỗi khi di trú User ${userDoc.id}: ${e.message}`);
        }
      }

      // 2. Migrate Characters
      addLog("Đang quét danh sách characters...");
      addLog(`Tìm thấy ${unmigratedChars.length} characters chưa có ID.`);

      for (const charDoc of unmigratedChars) {
        try {
          addLog(`Đang di trú Character: ${charDoc.data().name || charDoc.id}...`);
          const nid = await generateUniqueId(db, 'character', charDoc.id);
          await updateDoc(doc(db, 'characters', charDoc.id), { numericId: nid });
          processed++;
          setMigrationProgress(Math.round((processed / totalToMigrate) * 100));
        } catch (e: any) {
          addLog(`Lỗi khi di trú Character ${charDoc.id}: ${e.message}`);
        }
      }

      // 3. Migrate Prompts
      addLog("Đang quét danh sách prompts...");
      addLog(`Tìm thấy ${unmigratedPrompts.length} prompts chưa có ID.`);

      for (const promptDoc of unmigratedPrompts) {
        try {
          addLog(`Đang di trú Prompt: ${promptDoc.data().title || promptDoc.data().name || promptDoc.id}...`);
          const nid = await generateUniqueId(db, 'prompt', promptDoc.id);
          await updateDoc(doc(db, 'prompts', promptDoc.id), { numericId: nid });
          processed++;
          setMigrationProgress(Math.round((processed / totalToMigrate) * 100));
        } catch (e: any) {
          addLog(`Lỗi khi di trú Prompt ${promptDoc.id}: ${e.message}`);
        }
      }

      addLog("Chúc mừng! Tiến trình di trú hoàn tất thành công.");
      toast.success("Di trú ID hoàn tất thành công!");
      
      // Refresh Stats
      const usersSnapUpdated = await getDocs(collection(db, 'users'));
      const charsSnapUpdated = await getDocs(collection(db, 'characters'));
      const promptsSnapUpdated = await getDocs(collection(db, 'prompts'));
      
      setMigrationStats({
        unmigratedUsers: usersSnapUpdated.docs.filter(d => !d.data().numericId).length,
        unmigratedChars: charsSnapUpdated.docs.filter(d => !d.data().numericId).length,
        unmigratedPrompts: promptsSnapUpdated.docs.filter(d => !d.data().numericId).length
      });

    } catch (err: any) {
      addLog(`Lỗi nghiêm trọng: ${err.message}`);
      toast.error("Di trú thất bại.");
    } finally {
      setMigrating(false);
    }
  };

  const StatCard = ({ label, value, icon, color, trend }: any) => (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-2xl ${color} bg-opacity-10`}>
          {React.cloneElement(icon, { className: `w-6 h-6 ${color.replace('bg-', 'text-')}` })}
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{label}</p>
        <h3 className="text-3xl font-black tracking-tighter mt-1">{loading ? '...' : value}</h3>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-10 animate-in fade-in duration-700">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase">Thống Kê Quản Trị</h1>
          <p className="text-neutral-500 max-w-2xl font-medium">Theo dõi các chỉ số thực tế của hệ thống. Tất cả dữ liệu hiển thị đều được trích xuất từ cơ sở dữ liệu thực.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <StatCard label="Thành Viên" value={stats.totalUsers} icon={<Users />} color="bg-blue-500" trend={stats.userTrend} />
          <StatCard label="Creator" value={stats.totalCreators} icon={<UserCheck />} color="bg-amber-500" trend={stats.creatorTrend} />
          <StatCard label="Character" value={stats.totalCharacters} icon={<Sparkles />} color="bg-emerald-500" trend={stats.charTrend} />
          <StatCard label="Prompt" value={stats.totalPrompts} icon={<BarChart3 />} color="bg-purple-500" trend={stats.promptTrend} />
          <StatCard label="Báo Cáo" value={stats.pendingReports} icon={<AlertTriangle />} color="bg-red-500" />
          <StatCard label="Yêu Cầu Creator" value={stats.pendingCreatorRequests} icon={<TrendingUp />} color="bg-indigo-500" />
        </div>

        {!loading && chartData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl"><Activity className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-xl font-black tracking-tight uppercase">Tăng trưởng (7 ngày)</h3>
                  <p className="text-xs text-neutral-500 font-bold tracking-widest uppercase mt-1">Người Dùng & Character mới</p>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorChars" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                    <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                    <YAxis fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tw-bg-opacity, white)', color: '#000' }}
                    />
                    <Area type="monotone" name="Người dùng mới" dataKey="users" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={3} />
                    <Area type="monotone" name="Character mới" dataKey="chars" stroke="#10b981" fillOpacity={1} fill="url(#colorChars)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl"><BarChart3 className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-xl font-black tracking-tight uppercase">Hoạt động đăng tải (7 ngày)</h3>
                  <p className="text-xs text-neutral-500 font-bold tracking-widest uppercase mt-1">Số lượng Prompt được đăng tải</p>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                    <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                    <YAxis fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                    <Tooltip 
                      cursor={{fill: 'rgba(168, 85, 247, 0.05)'}}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar name="Prompt mới" dataKey="prompts" fill="#a855f7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-80 flex items-center justify-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl">
            <span className="text-neutral-500 font-medium">Đang tính toán dữ liệu thống kê...</span>
          </div>
        )}

        {/* Numeric ID Migration Section */}
        <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                <RefreshCw className={`w-6 h-6 ${migrating ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight uppercase">Hệ Thống Di Trú Numeric ID</h3>
                <p className="text-xs text-neutral-500 font-bold tracking-widest uppercase mt-1">Cấp mã số ID 9 chữ số duy nhất cho dữ liệu cũ</p>
              </div>
            </div>
            
            <button 
              onClick={runIdMigration}
              disabled={migrating || (migrationStats.unmigratedUsers === 0 && migrationStats.unmigratedChars === 0 && migrationStats.unmigratedPrompts === 0)}
              className={`flex items-center gap-2 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all cursor-pointer ${
                migrating 
                  ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed shadow-none' 
                  : (migrationStats.unmigratedUsers === 0 && migrationStats.unmigratedChars === 0 && migrationStats.unmigratedPrompts === 0)
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed shadow-none'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/15'
              }`}
            >
              <Play className="w-4 h-4" /> Bắt đầu di trú ID
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-neutral-50 dark:bg-neutral-800/30 rounded-3xl border border-neutral-100 dark:border-neutral-800/50 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Thành viên chưa có ID</span>
                <h4 className="text-3xl font-black tracking-tighter mt-1">{migrationStats.unmigratedUsers}</h4>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {migrationStats.unmigratedUsers === 0 ? (
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Hoàn hảo</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Cần di trú</span>
                )}
              </div>
            </div>

            <div className="p-6 bg-neutral-50 dark:bg-neutral-800/30 rounded-3xl border border-neutral-100 dark:border-neutral-800/50 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Characters chưa có ID</span>
                <h4 className="text-3xl font-black tracking-tighter mt-1">{migrationStats.unmigratedChars}</h4>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {migrationStats.unmigratedChars === 0 ? (
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Hoàn hảo</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Cần di trú</span>
                )}
              </div>
            </div>

            <div className="p-6 bg-neutral-50 dark:bg-neutral-800/30 rounded-3xl border border-neutral-100 dark:border-neutral-800/50 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Prompts chưa có ID</span>
                <h4 className="text-3xl font-black tracking-tighter mt-1">{migrationStats.unmigratedPrompts}</h4>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {migrationStats.unmigratedPrompts === 0 ? (
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Hoàn hảo</span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Cần di trú</span>
                )}
              </div>
            </div>
          </div>

          {migrating && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-500">
                <span>Tiến trình hoàn thành</span>
                <span>{migrationProgress}%</span>
              </div>
              <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${migrationProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {migrationLogs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-500">
                <Terminal className="w-4 h-4" /> Nhật ký di trú
              </div>
              <div className="p-4 bg-neutral-900 text-neutral-300 font-mono text-[11px] rounded-2xl border border-neutral-800 h-60 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-neutral-800">
                {migrationLogs.map((log, index) => (
                  <div key={index} className={log.includes("Lỗi") ? "text-red-400" : log.includes("Chúc mừng") ? "text-emerald-400 font-bold" : ""}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
