export interface ThreatData {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: string;
  timestamp: string;
  coordinates?: [number, number];
}

export interface GlobalIntelState {
  threats: ThreatData[];
  timestamp: string;
  source: string;
}

export interface RSSItem {
  id: string;
  title: string;
  description?: string;
  content?: string;
  link: string;
  pubDate: string;
  source: string;
  category?: string;
}

export interface NewsAnalysis {
  itemId: string;
  threatLevel: string;
  summary: string;
  insights: string[];
  recommendations: string[];
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface PolymarketItem {
  id: string;
  title: string;
  description: string;
  probability: number;
  volume: number;
  endDate: string;
  category: string;
}

export interface StockItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
}

export type ThreatType = 'cyber' | 'geopolitical' | 'military' | 'intelligence' | 'economic';