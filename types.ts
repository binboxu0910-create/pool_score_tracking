
export interface Player {
  id: string;
  name: string;
  score: number;
  color: string;
  stats: {
    WIN: number;
    GOLD_9: number;
    SMALL_GOLD: number;
    BIG_GOLD: number;
  };
}

export interface ScoreItem {
  id: string;
  playerId: string;
  playerName: string;
  label: string;
  points: number;
  timestamp: number;
  type?: string; // 记录得分类型
}

export interface ScoreState {
  players: Player[];
  history: ScoreItem[];
}

export interface ScoreConfig {
  label: string;
  points: number;
  colorClass: string;
}
