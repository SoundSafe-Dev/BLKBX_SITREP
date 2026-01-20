export interface MarketItem {
  symbol: string;
  name: string;
  price: string;
  change: string; // e.g. "+1.2%" or "-0.5%"
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
}

export interface StockItem {
  symbol: string;
  price: string;
  change: string;
}

export interface PolymarketItem {
  question: string;
  odds: string; // e.g. "Trump 52%"
  volume: string;
  url: string; // Link to the market
}

export interface RSSItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  content?: string; // Optional snippet
}

export interface NewsAnalysis {
  summary: string;
  bullets: string[];
  source_meta: string; // e.g. "Bloomberg / Tech Desk"
  correlations: string[]; // Connections to other headlines
}

export interface GlobalUpdate {
  category: 'KINETIC' | 'CYBER' | 'GEO' | 'INTEL';
  text: string;
}

export interface GlobalIntelState {
  defcon: {
    level: number;
    reasoning: string;
  };
  sitrep: {
    global_updates: GlobalUpdate[]; // Unified list for better display
    ai_race_news: string[];
  };
  strategic_market: {
    resources: StockItem[]; // Lithium, Rare Earths
    ai_compute: StockItem[]; // Nvidia, Palantir
    defense: StockItem[]; // Primes
  };
  polymarket: PolymarketItem[];
  hotspots: {
    name: string;
    lat: number;
    lng: number;
    severity: 'HIGH' | 'CRITICAL' | 'WARN';
    summary: string;
  }[];
  market: {
    summary: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export type ThreatType = 'military' | 'cyber' | 'geopolitical' | 'economic' | 'intelligence' | 'natural' | 'infrastructure';

export interface ThreatData {
  id: string;
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  coordinates: [number, number]; // [lat, lng]
  title: string;
  description: string;
  timestamp: Date;
  source: string;
  event?: string;
  area?: string;
  urgency?: string;
  magnitude?: number;
  depth?: number;
  url?: string;
}

export enum TerminalView {
  DASHBOARD = 'DASHBOARD',
  MAP = 'MAP',
  INTEL = 'INTEL',
  MARKET = 'MARKET'
}