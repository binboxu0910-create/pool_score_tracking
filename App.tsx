
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, ScoreState, ScoreItem } from './types';
import { SCORING_RULES } from './constants';

const STORAGE_KEY = 'billiards_p2p_transfer_v4';
const TIMER_KEY = 'billiards_timer_seconds_v4';
const PLAYER_COLORS = [
  'bg-blue-600', 'bg-rose-600', 'bg-emerald-600', 
  'bg-amber-500', 'bg-purple-600', 'bg-indigo-600',
  'bg-pink-600', 'bg-slate-700'
];

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

interface PendingAction {
  giver: Player;     // 付分者 (点击按钮的人)
  label: string;
  points: number;    // 绝对分值
  isTransferIn: boolean; // 是否是拿回分数 (如果是false，代表付分给别人)
  type?: string;     // 得分类型 (WIN, GOLD_9, etc.)
}

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_started');
    return saved === 'true';
  });

  const [state, setState] = useState<ScoreState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("解析存档失败", e);
      }
    }
    return { players: [], history: [] };
  });

  const [seconds, setSeconds] = useState<number>(() => {
    const saved = localStorage.getItem(TIMER_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [setupCount, setSetupCount] = useState(2);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmHome, setConfirmHome] = useState(false);
  
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const resetTimerRef = useRef<number | null>(null);
  const homeTimerRef = useRef<number | null>(null);
  const clockIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY + '_started', String(gameStarted));
    localStorage.setItem(TIMER_KEY, seconds.toString());
  }, [state, gameStarted, seconds]);

  useEffect(() => {
    if (gameStarted) {
      clockIntervalRef.current = window.setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    }
    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, [gameStarted]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${hrs > 0 ? hrs + ':' : ''}${pad(mins)}:${pad(secs)}`;
  };

  const startGame = useCallback((count: number) => {
    const initialPlayers: Player[] = Array.from({ length: count }, (_, i) => ({
      id: generateId(),
      name: `玩家 ${i + 1}`,
      score: 0,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      stats: {
        WIN: 0,
        GOLD_9: 0,
        SMALL_GOLD: 0,
        BIG_GOLD: 0
      }
    }));
    setState({ players: initialPlayers, history: [] });
    setSeconds(0);
    setGameStarted(true);
  }, []);

  const executeTransfer = (receiverId: string) => {
    if (!pendingAction) return;
    const { giver, label, points, isTransferIn, type } = pendingAction;
    
    setState(prev => {
      const newPlayers = prev.players.map(p => {
        // 付分者逻辑 (如果是转入分数，giver 分数增加)
        if (p.id === giver.id) {
            return { ...p, score: p.score + (isTransferIn ? points : -points) };
        }
        // 接收者逻辑 (如果是转入分数，receiver 分数减少)
        if (p.id === receiverId) {
            const updatedReceiver = { ...p, score: p.score + (isTransferIn ? -points : points) };
            
            // 如果是正常的赢分操作（非拿回分，且是获胜类型），增加接收者的统计
            if (!isTransferIn && type && type !== 'FOUL' && type in updatedReceiver.stats) {
                const key = type as keyof typeof updatedReceiver.stats;
                updatedReceiver.stats = { ...updatedReceiver.stats, [key]: updatedReceiver.stats[key] + 1 };
            }
            return updatedReceiver;
        }
        return p;
      });

      const receiver = prev.players.find(p => p.id === receiverId);
      const newHistoryItem: ScoreItem = {
        id: generateId(),
        playerId: giver.id,
        playerName: giver.name,
        label: isTransferIn 
            ? `${giver.name} 从 ${receiver?.name} 拿回 ${points}分 (${label})`
            : `${giver.name} 转给 ${receiver?.name} ${points}分 (${label})`,
        points: isTransferIn ? points : -points,
        timestamp: Date.now(),
        type: !isTransferIn ? type : undefined
      };
      (newHistoryItem as any).targetId = receiverId;

      return { ...prev, players: newPlayers, history: [newHistoryItem, ...prev.history].slice(0, 100) };
    });
    setPendingAction(null);
  };

  const undoLast = useCallback(() => {
    setState(prev => {
      if (prev.history.length === 0) return prev;
      const [lastItem, ...remainingHistory] = prev.history;
      const targetId = (lastItem as any).targetId;
      const giverChange = lastItem.points; 
      const type = lastItem.type;

      const restoredPlayers = prev.players.map(p => {
        if (p.id === lastItem.playerId) return { ...p, score: p.score - giverChange };
        if (p.id === targetId) {
            const restoredTarget = { ...p, score: p.score + giverChange };
            // 撤销时，如果之前增加了统计，现在要减去
            if (type && type !== 'FOUL' && type in restoredTarget.stats) {
                const key = type as keyof typeof restoredTarget.stats;
                restoredTarget.stats = { ...restoredTarget.stats, [key]: Math.max(0, restoredTarget.stats[key] - 1) };
            }
            return restoredTarget;
        }
        return p;
      });
      return { ...prev, players: restoredPlayers, history: remainingHistory };
    });
  }, []);

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => ({ 
        ...p, 
        score: 0,
        stats: { WIN: 0, GOLD_9: 0, SMALL_GOLD: 0, BIG_GOLD: 0 } 
      })),
      history: []
    }));
    setConfirmReset(false);
  };

  const handleBackHome = () => {
    if (!confirmHome) {
      setConfirmHome(true);
      if (homeTimerRef.current) window.clearTimeout(homeTimerRef.current);
      homeTimerRef.current = window.setTimeout(() => setConfirmHome(false), 3000);
      return;
    }
    setGameStarted(false);
    setConfirmHome(false);
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100">
        <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" fill="black" opacity="0.2"/></svg>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">台球转分计分器</h1>
            <p className="text-slate-500 text-sm font-medium">点对点转账模式 · 获胜实时统计</p>
          </div>

          <div className="space-y-4">
            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">选择玩家人数</p>
            <div className="grid grid-cols-4 gap-3">
              {[2, 3, 4, 5, 6, 7, 8].map(n => (
                <button
                  key={n}
                  onClick={() => setSetupCount(n)}
                  className={`py-3 rounded-xl font-bold transition-all border-2 ${
                    setupCount === n ? 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-md' : 'bg-white text-slate-600 border-slate-100'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="pt-4 space-y-3">
              <button onClick={() => startGame(setupCount)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">新建游戏</button>
              {state.players.length > 0 && (
                <button onClick={() => setGameStarted(true)} className="w-full py-3 text-slate-600 rounded-2xl font-bold text-sm bg-slate-100">继续上次进度</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto bg-white shadow-2xl animate-in fade-in duration-500 relative">
      <header className="p-4 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-30 shadow-lg h-[64px]">
        <button onClick={handleBackHome} className={`p-2 rounded-lg transition-all flex items-center space-x-1 ${confirmHome ? 'bg-amber-500 animate-pulse' : 'bg-slate-800'}`}>
          <HomeIcon />
          {confirmHome && <span className="text-[10px] font-bold ml-1">退出?</span>}
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-base font-mono font-black tabular-nums tracking-wider text-emerald-400">
              {formatTime(seconds)}
            </span>
          </div>
        </div>

        <div className="flex space-x-2">
          <button onClick={() => setIsEditMode(!isEditMode)} className={`px-3 py-1.5 rounded text-sm font-medium ${isEditMode ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-200'}`}>
            {isEditMode ? '完成' : '编辑'}
          </button>
          <button onClick={handleReset} className={`px-3 py-1.5 rounded text-sm font-bold shadow-md ${confirmReset ? 'bg-orange-500 animate-pulse' : 'bg-red-600'}`}>
            {confirmReset ? '确认?' : '重置'}
          </button>
        </div>
      </header>

      {/* 计分板区域 (玩家卡片) */}
      <div className={`grid gap-px bg-slate-200 border-b border-slate-200 sticky top-[64px] z-20 transition-all ${
        state.players.length > 4 ? 'grid-cols-4' : state.players.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
      }`}>
        {state.players.map(player => (
          <div key={player.id} className={`${player.color} p-3 text-white text-center flex flex-col items-center justify-center min-h-[140px] relative transition-all group overflow-hidden`}>
            {isEditMode ? (
              <div className="flex flex-col items-center space-y-2 w-full z-10 p-2">
                <input 
                  className="bg-white/20 text-white text-center rounded px-2 py-1.5 text-xs w-full outline-none focus:ring-2 ring-white font-bold"
                  value={player.name}
                  onChange={(e) => setState(prev => ({ ...prev, players: prev.players.map(p => p.id === player.id ? {...p, name: e.target.value} : p) }))}
                />
                <button onClick={() => setState(prev => ({ ...prev, players: prev.players.filter(p => p.id !== player.id) }))} className="bg-white/30 p-2 rounded-full hover:bg-white/40 transition-colors"><TrashIcon /></button>
              </div>
            ) : (
              <>
                <span className="text-[10px] font-black opacity-80 truncate w-full px-2 uppercase tracking-widest mb-1 drop-shadow-sm">{player.name}</span>
                <span className={`text-4xl font-black tracking-tighter tabular-nums drop-shadow-lg mb-2 ${player.score > 0 ? 'text-emerald-50' : player.score < 0 ? 'text-rose-100' : 'text-white'}`}>
                    {player.score > 0 ? `+${player.score}` : player.score}
                </span>
                
                {/* 获胜统计区域 */}
                <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 mt-1 px-1 bg-black/10 py-1 rounded-lg border border-white/5 w-full">
                  <div className="flex items-center space-x-0.5">
                    <span className="text-[8px] font-bold opacity-60">普</span>
                    <span className="text-[10px] font-black">{player.stats.WIN}</span>
                  </div>
                  <div className="flex items-center space-x-0.5">
                    <span className="text-[8px] font-bold opacity-60">9</span>
                    <span className="text-[10px] font-black">{player.stats.GOLD_9}</span>
                  </div>
                  <div className="flex items-center space-x-0.5">
                    <span className="text-[8px] font-bold opacity-60">小</span>
                    <span className="text-[10px] font-black">{player.stats.SMALL_GOLD}</span>
                  </div>
                  <div className="flex items-center space-x-0.5">
                    <span className="text-[8px] font-bold opacity-60">大</span>
                    <span className="text-[10px] font-black">{player.stats.BIG_GOLD}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <main className="flex-1 p-4 space-y-6 overflow-y-auto bg-slate-50/50">
        <div className="grid grid-cols-1 gap-4">
          {state.players.map(player => (
            <div key={player.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                    <h2 className="text-sm font-black flex items-center text-slate-800">
                        <span className={`w-3 h-3 rounded-full mr-2 ${player.color} shadow-sm`}></span>
                        {player.name}
                    </h2>
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">该玩家支付分数</span>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setPendingAction({ giver: player, label: '微调', points: 1, isTransferIn: true })}
                    className="w-10 h-10 flex items-center justify-center bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 font-bold active:bg-emerald-100 transition-colors"
                    title="从他人处拿回1分"
                  >
                    -1
                  </button>
                  <button 
                    onClick={() => setPendingAction({ giver: player, label: '微调', points: 1, isTransferIn: false })}
                    className="w-10 h-10 flex items-center justify-center bg-rose-50 border border-rose-100 rounded-xl text-rose-600 font-bold active:bg-rose-100 transition-colors"
                    title="付给他人1分"
                  >
                    +1
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
                {Object.entries(SCORING_RULES).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setPendingAction({ 
                        giver: player, 
                        label: config.label, 
                        points: config.points, 
                        isTransferIn: false,
                        type: key
                    })}
                    className="flex flex-col items-center justify-center py-2 bg-white rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-all h-16 group hover:border-slate-300"
                  >
                    <span className="text-[10px] text-slate-400 font-bold mb-0.5">{config.label}</span>
                    <span className="text-lg font-black text-slate-800 tabular-nums">
                        {config.points}
                    </span>
                    <span className="text-[8px] text-rose-500 font-bold opacity-0 group-active:opacity-100 transition-opacity">支付给...</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <button onClick={undoLast} disabled={state.history.length === 0} className={`flex items-center space-x-3 px-12 py-4 rounded-2xl shadow-xl transition-all active:scale-95 ${state.history.length === 0 ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white font-black'}`}>
            <UndoIcon />
            <span>撤销转账</span>
          </button>
        </div>

        <div className="space-y-4 pb-20">
          <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest px-2">转账流水</h3>
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm divide-y divide-slate-50">
            {state.history.length === 0 ? (
              <div className="p-10 text-center text-slate-300 italic text-xs">暂无流水记录</div>
            ) : (
              state.history.slice(0, 15).map((item) => (
                <div key={item.id} className="p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800 truncate pr-4">{item.label}</span>
                    <span className="text-[9px] font-bold text-slate-300 whitespace-nowrap">
                        {new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`text-[10px] font-black uppercase ${item.points > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {item.points > 0 ? `+${item.points}` : item.points} 分
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* 接收者选择弹窗 */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center border-b border-slate-50 pb-4">
              <div>
                <h4 className="text-lg font-black text-slate-800">
                    {pendingAction.isTransferIn ? '谁付钱给你？' : '这分付给谁？'}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                    金额：<span className="font-bold text-slate-700">{pendingAction.points}</span> 分 ({pendingAction.label})
                </p>
              </div>
              <button onClick={() => setPendingAction(null)} className="p-2 bg-slate-100 rounded-full text-slate-400 active:scale-90"><CloseIcon /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {state.players
                .filter(p => p.id !== pendingAction.giver.id)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => executeTransfer(p.id)}
                    className={`${p.color} p-4 rounded-2xl text-white font-bold text-center active:scale-95 transition-all shadow-lg flex flex-col items-center hover:opacity-90`}
                  >
                    <span className="text-[10px] opacity-70 mb-1 uppercase tracking-widest">确认目标</span>
                    <span className="truncate w-full text-lg">{p.name}</span>
                  </button>
                ))}
            </div>
            
            <button onClick={() => setPendingAction(null)} className="w-full py-4 text-slate-400 font-black text-sm bg-slate-50 rounded-2xl active:bg-slate-100 transition-colors">取消操作</button>
          </div>
        </div>
      )}
    </div>
  );
};

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

const UndoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
  </svg>
);

export default App;
