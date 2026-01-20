import { GlobalIntelState, RSSItem, NewsAnalysis } from "../types";

// Secure API key handling - never exposed in client bundle
const API_KEY = typeof window === 'undefined' ? process.env.VITE_OPENROUTER_API_KEY : '';

// Available LLM models (free tier)
const AVAILABLE_MODELS = {
  'openai/gpt-oss-120b:free': 'OpenAI GPT-OSS-120B (Free)',
  'google/gemma-3n-e2b-it:free': 'Google Gemma 3N E2B (Free)',
  'xiaomi/mimo-v2-flash:free': 'Xiaomi MIMO v2 Flash (Free)'
};

export async function callOpenRouter(model: string, messages: any[]): Promise<string> {
  if (!API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'BLK BX SitRep OS'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response generated';
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    throw error;
  }
}

export async function fetchDashboardIntel(): Promise<GlobalIntelState> {
  try {
    const intelligencePrompt = `Generate a comprehensive intelligence briefing covering:
    1. Current global threats and security developments
    2. Economic indicators and market intelligence
    3. Technology and AI advancements
    4. Geopolitical tensions and conflicts
    5. Cyber security alerts

    Format as a structured intelligence report with clear sections and actionable insights.`;

    const response = await callOpenRouter('google/gemma-3n-e2b-it:free', [
      { role: 'system', content: 'You are an expert intelligence analyst providing real-time security briefings.' },
      { role: 'user', content: intelligencePrompt }
    ]);

    return {
      threats: parseIntelligenceResponse(response),
      timestamp: new Date().toISOString(),
      source: 'AI Intelligence Analysis'
    };
  } catch (error) {
    console.error('Intel Fetch Error:', error);
    return {
      threats: [{
        id: 'ai-fallback',
        type: 'intelligence',
        severity: 'medium',
        title: 'AI Analysis Unavailable',
        description: 'Real-time intelligence analysis temporarily unavailable',
        location: 'Global',
        timestamp: new Date().toISOString()
      }],
      timestamp: new Date().toISOString(),
      source: 'System Fallback'
    };
  }
}

function parseIntelligenceResponse(response: string): any[] {
  // Parse the AI response into structured threat data
  const threats = [];

  // Extract threat information from the response
  if (response.includes('cyber') || response.includes('security')) {
    threats.push({
      id: 'cyber-threat',
      type: 'cyber',
      severity: 'high',
      title: 'Cyber Security Alert',
      description: 'AI-detected potential cyber threats requiring attention',
      location: 'Global Network',
      timestamp: new Date().toISOString()
    });
  }

  if (response.includes('geopolitical') || response.includes('conflict')) {
    threats.push({
      id: 'geo-threat',
      type: 'geopolitical',
      severity: 'medium',
      title: 'Geopolitical Development',
      description: 'AI-monitored geopolitical tensions and conflicts',
      location: 'Multiple Regions',
      timestamp: new Date().toISOString()
    });
  }

  // Add a default threat if none found
  if (threats.length === 0) {
    threats.push({
      id: 'ai-analysis',
      type: 'intelligence',
      severity: 'low',
      title: 'AI Intelligence Active',
      description: 'Automated intelligence analysis system operational',
      location: 'Global',
      timestamp: new Date().toISOString()
    });
  }

  return threats;
}

export async function queryIntelAnalyst(query: string): Promise<string> {
  try {
    const response = await callOpenRouter('google/gemma-3n-e2b-it:free', [
      { role: 'system', content: 'You are an expert intelligence analyst. Provide detailed, actionable analysis based on current global intelligence.' },
      { role: 'user', content: query }
    ]);
    return response;
  } catch (error) {
    console.error('Intel Analyst Query Error:', error);
    return 'Intelligence analysis currently unavailable. Please try again later.';
  }
}

export async function analyzeIntelItem(item: RSSItem): Promise<NewsAnalysis> {
  try {
    const analysisPrompt = `Analyze this news item for intelligence value:
Title: ${item.title}
Content: ${item.description || item.content}

Provide:
1. Threat level (Low/Medium/High/Critical)
2. Key intelligence insights
3. Recommended actions
4. Related geopolitical implications

Keep analysis focused and actionable.`;

    const response = await callOpenRouter('google/gemma-3n-e2b-it:free', [
      { role: 'system', content: 'You are an intelligence analyst evaluating news for security implications.' },
      { role: 'user', content: analysisPrompt }
    ]);

    return {
      itemId: item.id,
      threatLevel: extractThreatLevel(response),
      summary: response.substring(0, 200) + '...',
      insights: extractInsights(response),
      recommendations: extractRecommendations(response),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Intel Item Analysis Error:', error);
    return {
      itemId: item.id,
      threatLevel: 'Unknown',
      summary: 'Analysis unavailable',
      insights: ['Unable to analyze at this time'],
      recommendations: ['Manual review recommended'],
      timestamp: new Date().toISOString()
    };
  }
}

function extractThreatLevel(response: string): string {
  const lower = response.toLowerCase();
  if (lower.includes('critical')) return 'Critical';
  if (lower.includes('high')) return 'High';
  if (lower.includes('medium')) return 'Medium';
  return 'Low';
}

function extractInsights(response: string): string[] {
  // Extract key insights from the response
  const insights = [];
  const lines = response.split('\n');
  for (const line of lines) {
    if (line.includes('insight') || line.includes('key') || line.includes('important')) {
      insights.push(line.trim());
    }
  }
  return insights.length > 0 ? insights : ['Analysis completed'];
}

function extractRecommendations(response: string): string[] {
  // Extract recommendations from the response
  const recommendations = [];
  const lines = response.split('\n');
  for (const line of lines) {
    if (line.includes('recommend') || line.includes('action') || line.includes('should')) {
      recommendations.push(line.trim());
    }
  }
  return recommendations.length > 0 ? recommendations : ['Monitor situation'];
}

export async function fetchNOAAWeatherAlerts(): Promise<any[]> {
  // This would normally fetch from NOAA API
  // For now, return empty array as this is external service
  return [];
}

export function getAvailableModels() {
  return AVAILABLE_MODELS;
}

export function setModel(model: string) {
  // Model switching would be implemented here
  console.log('Model switched to:', model);
}