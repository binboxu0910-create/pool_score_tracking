
export interface Player {
  id: string;
  name: string;
  score: number;
  color: string;
}

export interface ScoreItem {
  id: string;
  playerId: string;
  playerName: string;
  label: string;
  points: number;
  timestamp: number;
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
