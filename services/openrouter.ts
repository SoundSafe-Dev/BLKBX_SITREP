import { GlobalIntelState, RSSItem, NewsAnalysis } from "../types";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

// Available LLM models (free tier)
const AVAILABLE_MODELS = {
  'openai/gpt-oss-120b:free': 'OpenAI GPT-OSS-120B (Free)',
  'google/gemma-3n-e2b-it:free': 'Google Gemma 3N E2B (Free)',
  'xiaomi/mimo-v2-flash:free': 'Xiaomi MIMO v2 Flash (Free)'
};

// Use Google Gemma 3N E2B as primary model (more reliable availability)
const OPENROUTER_MODEL = 'google/gemma-3n-e2b-it:free';

// Function to get available models
export const getAvailableModels = () => AVAILABLE_MODELS;

// Function to switch models (for future use)
export const setModel = (modelKey: string) => {
  if (AVAILABLE_MODELS[modelKey]) {
    // Note: This would require a more complex state management for runtime switching
    console.log(`Model switched to: ${AVAILABLE_MODELS[modelKey]}`);
    return modelKey;
  }
  console.warn(`Model ${modelKey} not available`);
  return OPENROUTER_MODEL;
};
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenRouter API call function
async function callOpenRouter(
  messages: Array<{role: string, content: string}>,
  model: string = OPENROUTER_MODEL,
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
  type: "object",
  properties: {
    defcon: {
      type: "object",
      properties: {
        level: { type: "integer", description: "The REAL current DEFCON level index (1-5) from OSINT sources." },
        reasoning: { type: "string", description: "Specific real-world reason for this level (e.g. 'Russia Nuclear Posture' or 'Middle East Escalation')." }
      }
    },
    sitrep: {
      type: "object",
      properties: {
        global_updates: {
          type: "array",
          description: "A comprehensive list of 10-12 major global intelligence updates. Cover Kinetic conflicts, Cyber attacks, Geopolitical moves, and Espionage/Intel.",
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: ['KINETIC', 'CYBER', 'GEO', 'INTEL'] },
              text: { type: "string", description: "Concise headline (e.g. 'IDF strikes Hezbollah command center in Beirut')" }
            }
          }
        },
        ai_race_news: { type: "array", items: { type: "string" }, description: "List of at least 6 updates on AGI, Compute, Model Releases (OpenAI, Anthropic, Google)." }
      }
    },
    strategic_market: {
      type: "object",
      properties: {
        resources: {
          type: "array",
          items: { type: "object", properties: { symbol: { type: "string" }, price: { type: "string" }, change: { type: "string" } } },
          description: "Key strategic resources stocks (e.g., ALB, MP)."
        },
        ai_compute: {
          type: "array",
          items: { type: "object", properties: { symbol: { type: "string" }, price: { type: "string" }, change: { type: "string" } } },
          description: "Key AI/Compute stocks (e.g., NVDA, PLTR, AMD)."
        },
        defense: {
          type: "array",
          items: { type: "object", properties: { symbol: { type: "string" }, price: { type: "string" }, change: { type: "string" } } },
          description: "Key Defense Primes (e.g., LMT, RTX, NOC)."
        }
      }
    },
    polymarket: {
      type: "array",
      description: "Top 5 trending prediction pools on Polymarket (Geopolitics/Election/Economy).",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          odds: { type: "string", description: "Current top outcome probability (e.g. 'Yes 65%')" },
          volume: { type: "string", description: "Approximate volume if known, else 'High'" },
          url: { type: "string", description: "A valid full URL to the polymarket event (e.g. https://polymarket.com/event/...)" }
        }
      }
    },
    hotspots: {
      type: "array",
      description: "List of 15-20 global tension coordinates. MUST include US (Cyber/Policy), China (SCS/Tech), Russia, Middle East, Africa, South America.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          severity: { type: "string", enum: ["HIGH", "CRITICAL", "WARN"] },
          summary: { type: "string" }
        }
      }
    },
    market: {
      type: "object",
      properties: {
        summary: { type: "string" }
      }
    }
  }
};

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "A concise strategic summary of the event (max 50 words)." },
    bullets: { type: "array", items: { type: "string" }, description: "3 detailed bullet points on implications." },
    source_meta: { type: "string", description: "Author/Source and Date/Time formatting (e.g. 'Reuters // 14:00Z')." },
    correlations: { type: "array", items: { type: "string" }, description: "List of 2-3 specific connections to other provided headlines in the context." }
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

    const text = await callOpenRouter(messages, OPENROUTER_MODEL, 0.3);

    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as GlobalIntelState;
  } catch (error) {
    console.error("Intel Fetch Error:", error);
    throw error; // No fallbacks - let the error propagate
  }
};

// Simplified X analysis - no longer needed for basic trending topics
export const analyzeXItem = async (target: any, context: any[]): Promise<NewsAnalysis> => {
    return {
        summary: "Trending topic analysis - intelligence correlation available on demand.",
        bullets: ["Topic trending in social intelligence networks", "Monitor for emerging patterns", "Cross-reference with traditional media"],
        source_meta: `${target.author} // TRENDING_TOPIC`,
        correlations: ["Social sentiment indicator", "Potential intelligence signal"]
    };
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

        const text = await callOpenRouter(messages, OPENROUTER_MODEL, 0.3);

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
    // Convert history format to OpenAI format
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

    const response = await callOpenRouter(messages, OPENROUTER_MODEL, 0.7);

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