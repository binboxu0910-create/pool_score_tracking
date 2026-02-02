
import { ScoreConfig } from './types';

export const SCORING_RULES: Record<string, ScoreConfig> = {
  FOUL: { label: '犯规', points: 1, colorClass: 'bg-orange-100 text-orange-700' },
  WIN: { label: '普胜', points: 4, colorClass: 'bg-green-100 text-green-700' },
  GOLD_9: { label: '黄金9', points: 4, colorClass: 'bg-yellow-100 text-yellow-700' },
  SMALL_GOLD: { label: '小金', points: 7, colorClass: 'bg-purple-100 text-purple-700' },
  BIG_GOLD: { label: '大金', points: 10, colorClass: 'bg-red-100 text-red-700' },
};

export const MANUAL_ADJUST = {
  PLUS: { label: '+1', points: 1 },
  MINUS: { label: '-1', points: -1 },
};
