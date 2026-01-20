import { GlobalIntelState, RSSItem, NewsAnalysis } from "../types";

const OPENROUTER_API_KEY = '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';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter API call function
async function callOpenRouter(
  messages: Array<{role: string, content: string}>,
  model: string = 'anthropic/claude-3.5-sonnet',
  temperature: number = 0.7
) {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'BLK BX SitRep OS'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    throw error;
  }
}

const INTEL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    defcon: {
      type: Type.OBJECT,
      properties: {
        level: { type: Type.INTEGER, description: "The REAL current DEFCON level index (1-5) from OSINT sources." },
        reasoning: { type: Type.STRING, description: "Specific real-world reason for this level (e.g. 'Russia Nuclear Posture' or 'Middle East Escalation')." }
      }
    },
    sitrep: {
      type: Type.OBJECT,
      properties: {
        global_updates: {
          type: Type.ARRAY,
          description: "A comprehensive list of 10-12 major global intelligence updates. Cover Kinetic conflicts, Cyber attacks, Geopolitical moves, and Espionage/Intel.",
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, enum: ['KINETIC', 'CYBER', 'GEO', 'INTEL'] },
              text: { type: Type.STRING, description: "Concise headline (e.g. 'IDF strikes Hezbollah command center in Beirut')" }
            }
          }
        },
        ai_race_news: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of at least 6 updates on AGI, Compute, Model Releases (OpenAI, Anthropic, Google)." }
      }
    },
    strategic_market: {
      type: Type.OBJECT,
      properties: {
        resources: { 
          type: Type.ARRAY, 
          items: { type: Type.OBJECT, properties: { symbol: { type: Type.STRING }, price: { type: Type.STRING }, change: { type: Type.STRING } } },
          description: "Key strategic resources stocks (e.g., ALB, MP)."
        },
        ai_compute: { 
          type: Type.ARRAY, 
          items: { type: Type.OBJECT, properties: { symbol: { type: Type.STRING }, price: { type: Type.STRING }, change: { type: Type.STRING } } },
          description: "Key AI/Compute stocks (e.g., NVDA, PLTR, AMD)."
        },
        defense: { 
          type: Type.ARRAY, 
          items: { type: Type.OBJECT, properties: { symbol: { type: Type.STRING }, price: { type: Type.STRING }, change: { type: Type.STRING } } },
          description: "Key Defense Primes (e.g., LMT, RTX, NOC)."
        }
      }
    },
    polymarket: {
      type: Type.ARRAY,
      description: "Top 5 trending prediction pools on Polymarket (Geopolitics/Election/Economy).",
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          odds: { type: Type.STRING, description: "Current top outcome probability (e.g. 'Yes 65%')" },
          volume: { type: Type.STRING, description: "Approximate volume if known, else 'High'" },
          url: { type: Type.STRING, description: "A valid full URL to the polymarket event (e.g. https://polymarket.com/event/...)" }
        }
      }
    },
    hotspots: {
      type: Type.ARRAY,
      description: "List of 15-20 global tension coordinates. MUST include US (Cyber/Policy), China (SCS/Tech), Russia, Middle East, Africa, South America.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
          severity: { type: Type.STRING, enum: ["HIGH", "CRITICAL", "WARN"] },
          summary: { type: Type.STRING }
        }
      }
    },
    market: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING }
      }
    }
  }
};

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "A concise strategic summary of the event (max 50 words)." },
    bullets: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 detailed bullet points on implications." },
    source_meta: { type: Type.STRING, description: "Author/Source and Date/Time formatting (e.g. 'Reuters // 14:00Z')." },
    correlations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 2-3 specific connections to other provided headlines in the context." }
  }
};

// Weather Intelligence Integration
export async function fetchNOAAWeatherAlerts(): Promise<any[]> {
  try {
    const response = await fetch('https://api.weather.gov/alerts/active');
    const data = await response.json();

    return data.features?.map((alert: any) => ({
      id: alert.properties.id,
      type: 'natural',
      severity: getWeatherSeverity(alert.properties.severity),
      coordinates: alert.geometry?.coordinates?.[0]?.[0] || [alert.properties.geocode?.coordinates?.[0] || 0, alert.properties.geocode?.coordinates?.[1] || 0],
      title: alert.properties.headline || alert.properties.event,
      description: alert.properties.description?.substring(0, 200) + '...',
      timestamp: new Date(alert.properties.sent),
      source: 'NOAA',
      event: alert.properties.event,
      area: alert.properties.areaDesc,
      urgency: alert.properties.urgency
    })) || [];
  } catch (error) {
    console.error('NOAA Weather fetch failed:', error);
    return [];
  }
}

function getWeatherSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
  switch (severity?.toLowerCase()) {
    case 'extreme': return 'critical';
    case 'severe': return 'high';
    case 'moderate': return 'medium';
    default: return 'low';
  }
}

// Cross-Platform Intelligence Correlation Engine
export interface IntelligenceItem {
  id: string;
  type: 'news' | 'social' | 'threat' | 'market';
  title: string;
  content: string;
  timestamp: Date;
  location?: [number, number];
  entities?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  urgency?: 'critical' | 'high' | 'medium' | 'low';
}

// Note: Correlation analysis temporarily disabled - requires advanced AI features
export async function analyzeIntelligenceCorrelations(
  newsItems: IntelligenceItem[],
  socialItems: IntelligenceItem[],
  threatItems: IntelligenceItem[],
  marketItems: IntelligenceItem[]
): Promise<{
  correlations: Array<{
    primary: IntelligenceItem;
    related: IntelligenceItem[];
    correlationType: 'geographic' | 'entity' | 'temporal' | 'thematic';
    strength: number;
    insights: string[];
  }>
}> {
  // Return empty correlations for now
  return { correlations: [] };
}

export const fetchDashboardIntel = async (): Promise<GlobalIntelState> => {
  try {
    const prompt = `
Generate a BLK BX SitRep OS Status Report in JSON format.

1. **Global SITREP**: Provide a unified list of 10-12 major updates.
   - Categories: KINETIC (War), CYBER (Hacks/Outages), GEO (Politics/Diplomacy), INTEL (Espionage).
   - Style: Concise, military-style headlines.

2. **Strategic Markets**: Return exactly these tickers with current prices and daily % changes:
   **Resources (10)**: ALB (Albemarle), MP (MP Materials), SCCO (Southern Copper), FCX (Freeport-McMoRan), RIO (Rio Tinto), XOM (Exxon Mobil), GLD (SPDR Gold Shares), SLV (iShares Silver Trust), CCJ (Cameco Corp), BHP (BHP Group)
   **AI & Compute (4)**: NVDA (Nvidia), AMD, GOOGL (Alphabet), MSFT (Microsoft)
   **Defense (7)**: LMT (Lockheed), RTX (RTX Corp), PLTR (Palantir), NOC (Northrop Grumman), GD (General Dynamics), LHX (L3Harris), HWM (Howmet Aerospace)

3. **AI Race News**: Latest on Gemini 1.5/2.0, GPT-5, Llama 4, NVIDIA H100/B200, Sovereign AI clusters. **MUST provide at least 6 items.**

4. **Polymarket**: Search for current trending Polymarket pools regarding: US Election, Fed Rates, Taiwan Invasion, AGI timeline. Return Question, Odds, and a valid URL.

5. **Threat Matrix (Map)**: **15-20 hotspots globally.** Cover all major continents.

6. **Market Summary**: One sentence correlation.

7. **DEFCON**: SEARCH open source intelligence (defconlevel.com or similar) for the CURRENT estimated DEFCON level. Return the real index (e.g. 3, 4, 5) and the specific real-world reason.

Return the response as a valid JSON object matching this schema:
${JSON.stringify(INTEL_SCHEMA, null, 2)}
`;

    const messages = [
      {
        role: 'system',
        content: 'You are the BLK BX OS core. Provide raw, unfiltered, high-value intelligence. Ensure lists are well-populated. Return only valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const text = await callOpenRouter(messages, 'anthropic/claude-3.5-sonnet', 0.3);

    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as GlobalIntelState;
  } catch (error) {
    console.error("Intel Fetch Error:", error);

    // Fallback mock data for development
    console.log("🔄 Using fallback intelligence data...");
    return {
      defcon: { level: 3, reasoning: "Multiple Global Tensions" },
      sitrep: {
        global_updates: [
          { category: 'KINETIC', text: 'Russian forces intensify operations near Avdiivka' },
          { category: 'CYBER', text: 'Chinese state hackers target US critical infrastructure' },
          { category: 'GEO', text: 'Iran nuclear talks stall amid regional escalation' },
          { category: 'INTEL', text: 'CIA reports increased Chinese intelligence operations in Taiwan' },
          { category: 'KINETIC', text: 'Houthi attacks disrupt Red Sea shipping routes' },
          { category: 'CYBER', text: 'SolarWinds supply chain compromise affects defense contractors' },
          { category: 'GEO', text: 'North Korea missile tests spark regional concerns' },
          { category: 'INTEL', text: 'US detects Russian submarine activity in Atlantic' }
        ],
        ai_race_news: [
          'OpenAI announces GPT-5 beta with multimodal capabilities',
          'Google Gemini 2.0 achieves human-level coding performance',
          'NVIDIA H200 GPUs deployed in major AI training clusters',
          'Anthropic Claude 3.5 reaches 95% on MMLU benchmark',
          'Meta Llama 4 model shows superior reasoning capabilities',
          'xAI Grok demonstrates improved real-time knowledge integration',
          'Microsoft invests $10B in sovereign AI infrastructure',
          'Tencent launches 1M H800 GPU cluster for AGI development'
        ]
      },
      strategic_market: {
        resources: [
          { symbol: 'ALB', price: '112.45', change: '+2.3%' },
          { symbol: 'MP', price: '18.92', change: '-1.1%' },
          { symbol: 'SCCO', price: '89.23', change: '+1.7%' },
          { symbol: 'FCX', price: '34.56', change: '-0.8%' },
          { symbol: 'RIO', price: '67.89', change: '+2.1%' },
          { symbol: 'XOM', price: '118.45', change: '+1.8%' },
          { symbol: 'GLD', price: '185.23', change: '+0.9%' },
          { symbol: 'SLV', price: '23.67', change: '+2.1%' },
          { symbol: 'CCJ', price: '41.89', change: '+3.2%' },
          { symbol: 'BHP', price: '68.45', change: '+1.4%' }
        ],
        ai_compute: [
          { symbol: 'NVDA', price: '875.28', change: '+5.7%' },
          { symbol: 'AMD', price: '142.67', change: '+3.9%' },
          { symbol: 'GOOGL', price: '134.56', change: '+1.2%' },
          { symbol: 'MSFT', price: '378.90', change: '+2.4%' }
        ],
        defense: [
          { symbol: 'LMT', price: '528.67', change: '+1.8%' },
          { symbol: 'RTX', price: '98.34', change: '-0.5%' },
          { symbol: 'PLTR', price: '21.45', change: '+3.2%' },
          { symbol: 'NOC', price: '445.23', change: '+1.1%' },
          { symbol: 'GD', price: '287.45', change: '+0.9%' },
          { symbol: 'LHX', price: '198.76', change: '+2.3%' },
          { symbol: 'HWM', price: '67.89', change: '+1.4%' }
        ]
      },
      polymarket: [
        { question: 'Will Trump win 2024 election?', odds: 'Yes 52%', volume: 'High', url: 'https://polymarket.com/event/will-donald-trump-win-the-2024-us-presidential-election' },
        { question: 'Fed rate cut in 2024?', odds: 'Yes 78%', volume: 'High', url: 'https://polymarket.com/event/will-the-fed-cut-rates-in-2024' },
        { question: 'Taiwan invasion by 2026?', odds: 'No 67%', volume: 'Medium', url: 'https://polymarket.com/event/will-china-invade-taiwan-by-2026' },
        { question: 'AGI by 2028?', odds: 'Yes 34%', volume: 'High', url: 'https://polymarket.com/event/will-agi-be-achieved-by-2028' },
        { question: 'Major cyber attack on US in 2024?', odds: 'Yes 23%', volume: 'Medium', url: 'https://polymarket.com/event/will-there-be-a-major-cyber-attack-on-us-infrastructure-in-2024' }
      ],
      hotspots: [
        { name: 'Ukraine-Russia Border', lat: 50.5, lng: 30.5, severity: 'CRITICAL', summary: 'Active kinetic conflict zone' },
        { name: 'Taiwan Strait', lat: 24.0, lng: 119.0, severity: 'HIGH', summary: 'Escalating geopolitical tension' },
        { name: 'South China Sea', lat: 12.0, lng: 113.0, severity: 'HIGH', summary: 'Territorial disputes ongoing' },
        { name: 'Middle East', lat: 33.0, lng: 35.0, severity: 'CRITICAL', summary: 'Multiple conflict actors active' },
        { name: 'North Korea DMZ', lat: 38.0, lng: 126.7, severity: 'WARN', summary: 'Nuclear posture concerns' },
        { name: 'Eastern Mediterranean', lat: 35.0, lng: 30.0, severity: 'HIGH', summary: 'Energy corridor instability' },
        { name: 'Arctic Region', lat: 75.0, lng: 0.0, severity: 'WARN', summary: 'Climate change enabling new routes' },
        { name: 'Horn of Africa', lat: 8.0, lng: 45.0, severity: 'HIGH', summary: 'Terrorism and piracy concerns' },
        { name: 'Balkans', lat: 44.0, lng: 20.0, severity: 'WARN', summary: 'Ethnic tensions monitored' },
        { name: 'Cyber Domain', lat: 0, lng: 0, severity: 'CRITICAL', summary: 'Global cyber operations ongoing' }
      ],
      market: { summary: "Tech sector leads gains amid AI optimism" }
    };
  }
};

export const analyzeXItem = async (target: any, context: any[]): Promise<NewsAnalysis> => {
    try {
        const otherSignals = context.filter(i => i.title !== target.title).map(i => i.title).join("; ");

        const prompt = `
Analyze this X (Twitter) intelligence signal and correlate it with other intelligence sources.

**Target Signal**:
Content: ${target.title}
Source: ${target.author}
Category: ${target.category || 'Intelligence'}
Time: ${target.pubDate}

**Context (Other Intelligence Signals)**:
${otherSignals}

Provide a strategic breakdown. For 'correlations', look for:
- Signal confirmation across platforms
- Emerging threat patterns
- Market intelligence connections
- Social sentiment analysis

Return the response as a valid JSON object matching this schema:
${JSON.stringify(ANALYSIS_SCHEMA, null, 2)}
`;

        const messages = [
            {
                role: 'system',
                content: 'You are a Senior Intelligence Analyst monitoring social intelligence signals. Output concise, high-impact assessment. Return only valid JSON.'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        const text = await callOpenRouter(messages, 'anthropic/claude-3.5-sonnet', 0.3);

        if (!text) throw new Error("No analysis generated");
        return JSON.parse(text) as NewsAnalysis;
    } catch (error) {
        console.error("X analysis error:", error);
        return {
            summary: "Signal analysis unavailable - intelligence networks temporarily offline.",
            bullets: ["Signal requires further verification", "Cross-reference with traditional sources recommended", "Monitor for confirmation signals"],
            source_meta: `${target.author} // SOCIAL_INTELLIGENCE`,
            correlations: ["Signal correlation pending", "Cross-platform verification needed"]
        };
    }
};

export const analyzeIntelItem = async (target: RSSItem, context: RSSItem[]): Promise<NewsAnalysis> => {
    try {
        const otherHeadlines = context.filter(i => i.link !== target.link).map(i => i.title).join("; ");

        const prompt = `
Analyze this intelligence item from news feeds and correlate it with both traditional news sources and X (Twitter) intelligence signals.

**Target Item**:
Title: ${target.title}
Source: ${target.source}
Time: ${target.pubDate}

**Context (News Headlines + X Intelligence Signals)**:
${otherHeadlines}

Provide a strategic breakdown. For 'correlations', look for thematic links between news and social intelligence:
- News ↔ X correlations (e.g., breaking news confirmed by social signals)
- Cross-domain connections (cyber news + social monitoring)
- Emerging patterns across traditional and social media

Return the response as a valid JSON object matching this schema:
${JSON.stringify(ANALYSIS_SCHEMA, null, 2)}
`;

        const messages = [
            {
                role: 'system',
                content: 'You are a Senior Intelligence Analyst for a Defense Tech terminal. Output concise, high-impact assessment. Return only valid JSON.'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        const text = await callOpenRouter(messages, 'anthropic/claude-3.5-sonnet', 0.3);

        if (!text) throw new Error("No analysis generated");
        return JSON.parse(text) as NewsAnalysis;

    } catch (e) {
        console.error("Analysis Error", e);
        return {
            summary: "Decryption failed. Source data may be corrupted or inaccessible.",
            bullets: ["Unable to verify source.", "Network timeout.", "Retry uplink."],
            source_meta: `${target.source} // UNKNOWN`,
            correlations: ["None detected."]
        };
    }
}

export const queryIntelAnalyst = async (
  query: string,
  history: {role: string, parts: {text: string}[]}[]
) => {
  try {
    // Convert Gemini history format to OpenAI format
    const messages = history.flatMap(h => h.parts.map(part => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: part.text
    })));

    // Add system message
    messages.unshift({
      role: 'system',
      content: "You are 'BLK BX'. Be concise, cynical, and data-driven. Focus on markets, war, and code."
    });

    // Add current query
    messages.push({
      role: 'user',
      content: query
    });

    const response = await callOpenRouter(messages, 'anthropic/claude-3.5-sonnet', 0.7);

    // Return a stream-like object for compatibility
    return {
      async *[Symbol.asyncIterator]() {
        yield { text: response };
      }
    };
  } catch (error) {
    console.error("OpenRouter Chat Error:", error);
    throw error;
  }
};