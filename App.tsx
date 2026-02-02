
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, ScoreState, ScoreItem } from './types';
import { SCORING_RULES } from './constants';

const STORAGE_KEY = 'billiards_multi_score_state_v4';
const PLAYER_COLORS = [
  'bg-blue-600', 'bg-rose-600', 'bg-emerald-600', 
  'bg-amber-500', 'bg-purple-600', 'bg-indigo-600',
  'bg-pink-600', 'bg-slate-700'
];

// 兼容性 ID 生成器
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const App: React.FC = () => {
  // --- 状态定义 ---
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

  const [isEditMode, setIsEditMode] = useState(false);
  const [setupCount, setSetupCount] = useState(2);
  
  // 用于二次确认的状态
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmHome, setConfirmHome] = useState(false);
  const resetTimer = useRef<number | null>(null);
  const homeTimer = useRef<number | null>(null);

  // --- 持久化 ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY + '_started', String(gameStarted));
  }, [state, gameStarted]);

  // --- 核心逻辑 ---
  const startGame = useCallback((count: number) => {
    const initialPlayers: Player[] = Array.from({ length: count }, (_, i) => ({
      id: generateId(),
      name: `玩家 ${i + 1}`,
      score: 0,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length]
    }));

    setState({
      players: initialPlayers,
      history: []
    });
    setGameStarted(true);
  }, []);

  const addPlayer = useCallback(() => {
    setState(prev => {
      if (prev.players.length >= PLAYER_COLORS.length) {
        alert('最多支持 8 位玩家');
        return prev;
      }
      const colorIndex = prev.players.length % PLAYER_COLORS.length;
      const newPlayer: Player = {
        id: generateId(),
        name: `玩家 ${prev.players.length + 1}`,
        score: 0,
        color: PLAYER_COLORS[colorIndex]
      };
      return {
        ...prev,
        players: [...prev.players, newPlayer]
      };
    });
  }, []);

  const removePlayer = useCallback((id: string) => {
    if (state.players.length <= 1) return;
    setState(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== id),
      history: prev.history.filter(h => h.playerId !== id)
    }));
  }, [state.players.length]);

  const updatePlayerName = useCallback((id: string, name: string) => {
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, name } : p)
    }));
  }, []);

  const addScore = useCallback((playerId: string, label: string, points: number) => {
    setState(prev => {
      const player = prev.players.find(p => p.id === playerId);
      if (!player) return prev;

      const newScore = Math.max(0, player.score + points);
      const newHistoryItem: ScoreItem = {
        id: generateId(),
        playerId,
        playerName: player.name,
        label,
        points,
        timestamp: Date.now()
      };

      return {
        ...prev,
        players: prev.players.map(p => p.id === playerId ? { ...p, score: newScore } : p),
        history: [newHistoryItem, ...prev.history].slice(0, 100)
      };
    });
  }, []);

  const undoLast = useCallback(() => {
    setState(prev => {
      if (prev.history.length === 0) return prev;
      const [lastItem, ...remainingHistory] = prev.history;
      
      return {
        ...prev,
        players: prev.players.map(p => 
          p.id === lastItem.playerId 
            ? { ...p, score: Math.max(0, p.score - lastItem.points) } 
            : p
        ),
        history: remainingHistory
      };
    });
  }, []);

  // --- 导航与重置逻辑 ---
  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    // 第二次点击：仅重置分数和历史，不返回首页
    setState(prev => ({
      ...prev,
      players: prev.players.map(p => ({ ...p, score: 0 })),
      history: []
    }));
    setConfirmReset(false);
  };

  const handleBackHome = () => {
    if (!confirmHome) {
      setConfirmHome(true);
      if (homeTimer.current) window.clearTimeout(homeTimer.current);
      homeTimer.current = window.setTimeout(() => setConfirmHome(false), 3000);
      return;
    }
    // 第二次点击：返回首页
    setGameStarted(false);
    setConfirmHome(false);
  };

  // --- 初始界面渲染 ---
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity=".4"/>
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">台球追分计分</h1>
            <p className="text-slate-500 text-sm">选择玩家数量开始游戏</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[2, 3, 4, 5, 6, 7, 8].map(n => (
                <button
                  key={n}
                  onClick={() => setSetupCount(n)}
                  className={`py-3 rounded-xl font-bold transition-all border-2 ${
                    setupCount === n 
                    ? 'bg-emerald-500 text-white border-emerald-500 scale-105 shadow-md shadow-emerald-100' 
                    : 'bg-white text-slate-600 border-slate-100 hover:border-emerald-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="pt-4 space-y-3">
              <button
                onClick={() => startGame(setupCount)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl active:scale-[0.98] transition-all"
              >
                新建游戏
              </button>
              {state.players.length > 0 && (
                <button
                  onClick={() => setGameStarted(true)}
                  className="w-full py-3 text-slate-600 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  继续上次进度 ({state.players.length}人)
                </button>
              )}
            </div>
          </div>
          
          <p className="text-center text-[10px] text-slate-400">
            支持 2-8 人追分模式 · 实时云存储 · 撤销记录
          </p>
        </div>
      </div>
    );
  }

  // --- 计分界面渲染 ---
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto bg-white shadow-2xl animate-in fade-in duration-500">
      {/* Header */}
      <header className="p-4 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-30 shadow-lg h-[64px]">
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleBackHome}
            className={`p-2 rounded-lg transition-all flex items-center space-x-1 ${confirmHome ? 'bg-amber-500 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <HomeIcon />
            {confirmHome && <span className="text-[10px] font-bold">确认返回?</span>}
          </button>
          <h1 className="text-base font-bold hidden xs:block">计分器</h1>
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3 py-1.5 rounded text-sm transition-colors font-medium ${isEditMode ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-200'}`}
          >
            {isEditMode ? '完成' : '编辑'}
          </button>
          <button 
            onClick={handleReset}
            className={`px-4 py-1.5 rounded text-sm font-bold transition-all shadow-md ${confirmReset ? 'bg-orange-500 scale-105 animate-pulse' : 'bg-red-600 active:bg-red-500'}`}
          >
            {confirmReset ? '确认清零?' : '重置分数'}
          </button>
        </div>
      </header>

      {/* 计分板 */}
      <div className={`grid gap-px bg-slate-200 border-b border-slate-200 sticky top-[64px] z-20 transition-all ${
        state.players.length > 4 ? 'grid-cols-4' : 
        state.players.length === 3 ? 'grid-cols-3' : 
        state.players.length === 2 ? 'grid-cols-2' : 'grid-cols-2'
      }`}>
        {state.players.map(player => (
          <div key={player.id} className={`${player.color} p-4 text-white text-center flex flex-col items-center justify-center min-h-[110px] transition-all relative overflow-hidden`}>
            {isEditMode ? (
              <div className="flex flex-col items-center space-y-2 w-full z-10">
                <input 
                  className="bg-white/20 text-white text-center rounded px-1 py-1 text-xs w-full outline-none focus:ring-2 ring-white placeholder-white/50"
                  value={player.name}
                  onChange={(e) => updatePlayerName(player.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); removePlayer(player.id); }}
                  className="bg-white/30 p-1 rounded-full hover:bg-red-500 transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>
            ) : (
              <span className="text-xs font-bold opacity-80 truncate w-full px-2 z-10 uppercase tracking-widest mb-1">{player.name}</span>
            )}
            <span className="text-4xl font-black tracking-tighter tabular-nums drop-shadow-md z-10">{player.score}</span>
            <div className="absolute inset-0 bg-black/5 opacity-0 active:opacity-100 transition-opacity"></div>
          </div>
        ))}
        {isEditMode && state.players.length < PLAYER_COLORS.length && (
          <button 
            onClick={addPlayer}
            className="bg-slate-100 p-4 text-slate-400 flex flex-col items-center justify-center border-dashed border-2 border-slate-300 m-1 rounded-xl active:bg-slate-200"
          >
            <PlusIcon />
            <span className="text-[10px] mt-1 font-bold">增员</span>
          </button>
        )}
      </div>

      {/* 操作区域 */}
      <main className="flex-1 p-4 space-y-6 overflow-y-auto bg-slate-50/50">
        <div className="grid grid-cols-1 gap-4">
          {state.players.map(player => (
            <div key={player.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black flex items-center text-slate-800">
                  <span className={`w-3 h-3 rounded-full mr-2.5 ${player.color} ring-4 ring-offset-2 ring-opacity-20 ${player.color.replace('bg-', 'ring-')}`}></span>
                  {player.name}
                </h2>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => addScore(player.id, '微调', -1)}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 font-bold active:bg-slate-200 transition-all"
                  >
                    -1
                  </button>
                  <button 
                    onClick={() => addScore(player.id, '微调', 1)}
                    className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 font-bold active:bg-slate-200 transition-all"
                  >
                    +1
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
                {Object.entries(SCORING_RULES).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => addScore(player.id, config.label, config.points)}
                    className="flex flex-col items-center justify-center py-2 bg-white rounded-2xl shadow-sm border border-slate-100 active:bg-slate-50 active:scale-95 transition-all h-14"
                  >
                    <span className="text-[10px] text-slate-400 font-bold mb-0.5">{config.label}</span>
                    <span className={`text-lg font-black ${player.color.replace('bg-', 'text-')}`}>+{config.points}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <button 
            onClick={undoLast}
            disabled={state.history.length === 0}
            className={`flex items-center space-x-3 px-12 py-4 rounded-2xl shadow-xl transition-all active:scale-95 ${
              state.history.length === 0 
              ? 'bg-slate-100 text-slate-300' 
              : 'bg-slate-900 text-white font-black hover:bg-slate-800'
            }`}
          >
            <UndoIcon />
            <span>撤销最后一步</span>
          </button>
        </div>

        {/* 流水记录 */}
        <div className="space-y-4 pb-10">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">最近流水</h3>
          </div>
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm divide-y divide-slate-50">
            {state.history.length === 0 ? (
              <div className="p-10 text-center text-slate-300 italic text-xs uppercase tracking-widest">No Records</div>
            ) : (
              state.history.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white">
                  <div className="flex items-center space-x-4">
                    <div className={`w-1.5 h-6 rounded-full ${state.players.find(p => p.id === item.playerId)?.color || 'bg-slate-200'}`}></div>
                    <div>
                      <div className="text-xs font-black text-slate-800">{item.playerName}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-base font-black ${item.points >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {item.points >= 0 ? `+${item.points}` : item.points}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// --- 图标组件 ---
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

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const UndoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
  </svg>
);

export default App;
