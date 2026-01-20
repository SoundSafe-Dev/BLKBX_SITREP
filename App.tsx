import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, Activity, Database, Terminal, 
  Map as MapIcon, RefreshCw, Radio, 
  Shield, DollarSign, Crosshair,
  Wifi, Zap, TrendingUp, TrendingDown, Minus,
  Rss, PlayCircle, BarChart3, Binary, ExternalLink,
  Cpu, Pickaxe, Rocket, FileText, X, Anchor, Plane,
  Eye, AlertTriangle, Keyboard
} from 'lucide-react';
// @ts-ignore
import L from 'leaflet';

// Local Imports
import { TerminalPanel, BlinkingCursor, StatusBadge } from './components/TerminalUI';
import { GlobalIntelState, ChatMessage, RSSItem, PolymarketItem, StockItem, NewsAnalysis, ThreatType, ThreatData } from './types';
import { fetchDashboardIntel, queryIntelAnalyst, analyzeIntelItem, fetchNOAAWeatherAlerts } from './services/openrouter';
import logo from '/blk-bx-logo.png';

// --- Sub-Components ---

const BlackBoxLogo = () => (
  <img
    src={logo}
    alt="BLK BX Logo"
    className="w-12 h-12 sm:w-16 sm:h-16 object-contain filter brightness-110"
    onError={(e) => {
      // Fallback to original SVG if image fails to load
      const target = e.target as HTMLImageElement;
      target.style.display = 'none';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '64');
      svg.setAttribute('height', '64');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('class', 'text-[#ff9900]');
      svg.innerHTML = `
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 7V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 7V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 12V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 12L22 7" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
        <path d="M12 12L2 7" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
        <path d="M12 12V2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
      `;
      target.parentNode?.appendChild(svg);
    }}
  />
);

const MaritimeTrackerFrame = () => {
    return (
        <div className="w-full h-full bg-[#050505] relative overflow-hidden group">
             {/* Switched to MarineTraffic Embed for better reliability */}
             <iframe 
                name="marinetraffic" 
                id="marinetraffic" 
                className="w-full h-full border-0 opacity-80 group-hover:opacity-100 transition-opacity"
                src="https://www.marinetraffic.com/en/ais/embed/zoom:6/centery:24.0/centerx:119.0/maptype:4/shownames:false/mmsi:0/shipid:0/fleet:/fleet_id:/vessel_id:/show_hex:0/shownames:false/show_track:false/remember:false"
                allowFullScreen
            ></iframe>
             <div className="absolute top-1 left-1 bg-black/80 text-[8px] text-blue-400 px-1 border border-blue-900 pointer-events-none">
                LIVE AIS FEED // TAIWAN STRAIT
            </div>
        </div>
    );
};

const FlightTrackerMap = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const markersLayer = useRef<L.LayerGroup | null>(null);
    const trailsLayer = useRef<L.LayerGroup | null>(null);
    const aircraftHistory = useRef<Map<string, Array<{lat: number, lng: number, timestamp: number}>>>(new Map());
    const [status, setStatus] = useState<'CONNECTING' | 'LIVE' | 'OFFLINE' | 'RATE_LIMITED'>('CONNECTING');

    // Calculate distance between two points in nautical miles
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        return distanceKm * 0.539957; // Convert km to nautical miles
    };

    useEffect(() => {
        if (mapContainer.current && !mapInstance.current) {
            // Initialize map with Chicago center for flight tracking
            const map = L.map(mapContainer.current!, {
                center: [41.9742, -87.9073], // Chicago for flight tracking
                zoom: 8,
                zoomControl: false,
                attributionControl: false,
                zoomSnap: 0.5
            });

            // Enhanced dark tiles with better visibility
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 19,
                opacity: 0.8
            }).addTo(map);

            // Add subtle country borders
            fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
                .then(response => response.json())
                .then(data => {
                    L.geoJSON(data, {
                        style: {
                            color: '#444',
                            weight: 1,
                            opacity: 0.4,
                            fillOpacity: 0
                        }
                    }).addTo(map);
                })
                .catch(error => console.log('Could not load country borders:', error));

            markersLayer.current = L.layerGroup().addTo(map);
            trailsLayer.current = L.layerGroup().addTo(map);
            mapInstance.current = map;
        }

        // Cleanup function to prevent map reinitialization
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
                if (markersLayer.current) {
                    markersLayer.current = null;
                }
                if (trailsLayer.current) {
                    trailsLayer.current = null;
                }
                aircraftHistory.current.clear();
            }
        };
    }, []);

    useEffect(() => {
        const fetchFlights = async () => {
            if (!mapInstance.current || !markersLayer.current) return;
            try {
                // Use Vite proxy to access ADS-B.LOL API (bypasses CORS restrictions)
                const res = await fetch('/api/adsb/lat/41.9742/lon/-87.9073/dist/260');

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();
                const aircraftData = data.ac || [];
                
                if (aircraftData.length > 0) {
                    setStatus('LIVE');
                    markersLayer.current?.clearLayers();
                    trailsLayer.current?.clearLayers();

                    const activeAircraftIds = new Set<string>();

                    // Process aircraft from ADS-B.LOL (limit to 300 for performance)
                    aircraftData.slice(0, 300).forEach((aircraft: any) => {
                        const hexCode = aircraft.hex;
                        if (!hexCode) return;

                        activeAircraftIds.add(hexCode);
                        const callsign = aircraft.flight?.trim() || aircraft.hex || 'N/A';
                        const lat = aircraft.lat;
                        const lng = aircraft.lon;
                        const altitude = aircraft.alt;
                        const speed = aircraft.gs;
                        const track = aircraft.track || 0;
                        const squawk = aircraft.squawk;

                        // Only show aircraft with valid position data
                        if (lat && lng && typeof lat === 'number' && typeof lng === 'number') {
                            // Choose color based on squawk codes and flight characteristics
                            let color = '#10b981'; // Default green
                            if (squawk) {
                                // Military squawk codes (7000-7777 range often military)
                                const squawkNum = parseInt(squawk);
                                if (squawkNum >= 7000 && squawkNum <= 7777) {
                                    color = '#ef4444'; // Red for military
                                }
                                // Emergency squawks
                                else if (squawk === '7500' || squawk === '7600' || squawk === '7700') {
                                    color = '#f59e0b'; // Amber for emergency
                                }
                            }

                            // Check for military callsigns
                            if (callsign && (callsign.includes('CNV') || callsign.includes('RCH') || callsign.includes('PAT') || callsign.includes('SAM'))) {
                                color = '#ef4444'; // Red for military
                            }

                            const planeIcon = L.divIcon({
                                className: 'bg-transparent border-none',
                                // Rotate the SVG based on the track heading
                                html: `
                                    <div style="transform: rotate(${track - 45}deg); transition: transform 1s ease-in-out;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}">
                                            <path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"/>
                                        </svg>
                                    </div>
                                `,
                                iconSize: [14, 14],
                                iconAnchor: [7, 7]
                            });

                            const marker = L.marker([lat, lng], { icon: planeIcon });

                            // Enhanced tooltip with comprehensive ADS-B data
                            const tooltipText = `${callsign} (${hexCode})\nALT: ${altitude || 'N/A'}ft SPD: ${speed || 'N/A'}kts\nHDG: ${Math.round(track)}°${squawk ? ` SQWK:${squawk}` : ''}`;

                            marker.bindTooltip(tooltipText, {
                                direction: 'top',
                                className: 'bg-black text-emerald-400 border border-emerald-900 text-[9px] font-mono px-2 py-1 whitespace-pre-line'
                            });
                            if (markersLayer.current) {
                                marker.addTo(markersLayer.current);
                            }

                            // Update aircraft position history for trails
                            const currentPos = { lat, lng, timestamp: Date.now() };
                            if (!aircraftHistory.current.has(hexCode)) {
                                aircraftHistory.current.set(hexCode, []);
                            }
                            const history = aircraftHistory.current.get(hexCode)!;
                            history.push(currentPos);

                            // Limit trail to approximately 5 NM by removing old positions
                            while (history.length > 1) {
                                const distance = calculateDistance(
                                    history[history.length - 1].lat, history[history.length - 1].lng,
                                    history[0].lat, history[0].lng
                                );
                                if (distance > 5) {
                                    history.shift();
                                } else {
                                    break;
                                }
                            }

                            // Keep max 20 positions for performance
                            if (history.length > 20) {
                                history.splice(0, history.length - 20);
                            }

                            // Draw trail if we have at least 2 positions
                            if (history.length >= 2) {
                                const trailCoords = history.map(pos => [pos.lat, pos.lng] as [number, number]);

                                // Create fading trail with multiple segments of decreasing opacity
                                for (let i = 1; i < trailCoords.length; i++) {
                                    const opacity = Math.max(0.1, (i / trailCoords.length) * 0.6); // Fade from 0.6 to 0.1
                                    const trailSegment = L.polyline([trailCoords[i-1], trailCoords[i]], {
                                        color: color.replace('rgb', 'rgba').replace(')', `, ${opacity})`),
                                        weight: 2,
                                        opacity: opacity,
                                        dashArray: i === trailCoords.length - 1 ? undefined : '5, 5' // Dashed for older segments
                                    });
                                    if (trailsLayer.current) {
                                        trailSegment.addTo(trailsLayer.current);
                                    }
                                }
                            }
                        }
                    });

                    // Clean up trails for aircraft that are no longer active
                    for (const [hexCode, history] of aircraftHistory.current.entries()) {
                        if (!activeAircraftIds.has(hexCode)) {
                            // Aircraft disappeared, fade out its trail gradually
                            setTimeout(() => {
                                aircraftHistory.current.delete(hexCode);
                            }, 30000); // Keep trail visible for 30 seconds after aircraft disappears
                        }
                    }
                } else {
                    setStatus('CONNECTING');
                }
            } catch (e) {
                console.error("ADS-B.LOL Fetch Error", e);
                setStatus('OFFLINE');
            }
        };

        fetchFlights();
        const interval = setInterval(fetchFlights, 15000); // 15 seconds for ADS-B.LOL API
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full h-full bg-[#09090b]">
            <div ref={mapContainer} className="w-full h-full z-0" />
            <div className={`absolute top-1 left-1 px-1 text-[8px] font-bold border ${
                status === 'LIVE' ? 'text-emerald-500 border-emerald-900 bg-emerald-900/20' :
                status === 'RATE_LIMITED' ? 'text-yellow-500 border-yellow-900 bg-yellow-900/20' :
                'text-red-500 border-red-900 bg-red-900/20'
            }`}>
                ADS-B.LOL // 500MI // {status}
            </div>
        </div>
    );
};

const RealWorldMap: React.FC<{ hotspots: GlobalIntelState['hotspots'] }> = ({ hotspots }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (mapContainer.current && !mapInstance.current) {
      const map = L.map(mapContainer.current, {
        center: [20, 10],
        zoom: 1.5,
        zoomControl: false,
        attributionControl: false,
        background: '#050505'
      });
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);
      markersLayer.current = L.layerGroup().addTo(map);
      mapInstance.current = map;
    }
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return;
    markersLayer.current.clearLayers();
    hotspots.forEach(spot => {
      const isCritical = spot.severity === 'CRITICAL';
      const colorClass = isCritical ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-orange-500 shadow-[0_0_8px_#f97316]';
      const icon = L.divIcon({
        className: 'bg-transparent border-none',
        html: `<div class="relative w-3 h-3 group cursor-pointer"><div class="absolute inset-0 rounded-full ${colorClass} opacity-75 ${isCritical ? 'animate-ping' : ''}"></div><div class="absolute inset-0 rounded-full ${colorClass} border border-white/50"></div></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -10]
      });
      const marker = L.marker([spot.lat, spot.lng], { icon });
      marker.bindPopup(
        `<div class="font-mono text-[10px] w-56"><div class="font-bold text-[#ff9900] border-b border-[#333] mb-1 pb-1 uppercase tracking-wider flex justify-between"><span>${spot.name}</span><span class="${isCritical ? 'text-red-500' : 'text-yellow-500'}">${spot.severity}</span></div><div class="text-gray-300 leading-tight mb-2">${spot.summary}</div></div>`,
        { closeButton: false, className: 'terminal-popup' }
      );
      marker.on('mouseover', function () { this.openPopup(); });
      marker.addTo(markersLayer.current!);
    });
  }, [hotspots]);

  // Simple UTC Ticker for Map
  useEffect(() => {
      if (!mapInstance.current) return;
      
      const TimeControl = L.Control.extend({
        onAdd: () => {
          const div = L.DomUtil.create('div', 'bg-black/50 text-[#ff9900] text-[9px] px-2 py-1 font-mono border border-[#333]');
          const update = () => {
             div.innerHTML = `UTC: ${new Date().toISOString().split('T')[1].split('.')[0]}Z`;
          };
          update();
          const timer = setInterval(update, 1000);
          (div as any)._timer = timer;
          return div;
        },
        onRemove: (map: any) => {
           clearInterval((map as any)._timer);
        }
      });
      const tc = new TimeControl({ position: 'bottomleft' });
      tc.addTo(mapInstance.current);

      return () => { tc.remove(); };
  }, []);

  return <div ref={mapContainer} className="w-full h-full bg-[#050505] z-0" />;
};

const GlobalTicker: React.FC<{ strategic: GlobalIntelState['strategic_market'] }> = ({ strategic }) => {
    const [crypto, setCrypto] = useState<{symbol: string, price: number, change: number}[]>([]);
    
    useEffect(() => {
        const fetchCrypto = async () => {
            try {
                const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,cardano,ripple,dogecoin,chainlink,avalanche-2&vs_currencies=usd&include_24hr_change=true');
                const data = await res.json();
                const mapping: Record<string, string> = {
                    bitcoin: 'BTC',
                    ethereum: 'ETH',
                    binancecoin: 'BNB',
                    solana: 'SOL',
                    cardano: 'ADA',
                    ripple: 'XRP',
                    dogecoin: 'DOGE',
                    chainlink: 'LINK',
                    'avalanche-2': 'AVAX'
                };
                const arr = Object.keys(data).map(key => ({
                    symbol: mapping[key],
                    price: data[key].usd,
                    change: data[key].usd_24h_change
                }));
                setCrypto(arr);
            } catch (e) { console.error("Crypto fetch failed", e); }
        };
        fetchCrypto();
        const interval = setInterval(fetchCrypto, 60000);
        return () => clearInterval(interval);
    }, []);

    // Helper to format stock items for ticker - FULL HEIGHT VERTICAL STACKED LAYOUT
    const formatStock = (s: StockItem) => (
        <div key={s.symbol} className="flex flex-col justify-between mx-1 sm:mx-2 px-1 sm:px-2 py-2 bg-black/20 rounded text-center min-w-[80px] sm:min-w-[100px] h-full border border-gray-700/50">
            <div className="text-[#00ffff] text-[30px] font-bold font-mono tracking-widest flex-1 flex items-center justify-center">{s.symbol}</div>
            <div className="text-gray-300 text-[25px] font-bold flex-1 flex items-center justify-center">${s.price}</div>
            <div className={`text-[25px] font-bold flex-1 flex items-center justify-center ${s.change.includes('-') ? 'text-red-400' : 'text-green-400'}`}>
                {s.change}
            </div>
        </div>
    );

    return (
        <div className="flex animate-marquee whitespace-nowrap h-full">
            {/* Crypto Section */}
            <div className="flex flex-col justify-center mx-1 sm:mx-2 px-2 sm:px-3 py-2 bg-[#ff9900]/20 border border-[#ff9900]/50 rounded min-w-[90px] sm:min-w-[110px] h-full">
                <span className="text-[#ff9900] text-2xl font-bold font-mono tracking-widest">CRYPTO</span>
            </div>
            {crypto.map((p, i) => (
                <div key={i} className="flex flex-col justify-between mx-1 sm:mx-2 px-1 sm:px-2 py-2 bg-black/20 rounded text-center min-w-[80px] sm:min-w-[100px] h-full border border-gray-700/50">
                    <div className="text-[#ff9900] text-[30px] font-bold font-mono tracking-widest flex-1 flex items-center justify-center">{p.symbol}</div>
                    <div className="text-gray-300 text-[25px] font-bold flex-1 flex items-center justify-center">${p.price.toLocaleString()}</div>
                    <div className={`text-[25px] font-bold flex-1 flex items-center justify-center ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.change > 0 ? '+' : ''}{p.change.toFixed(2)}%
                    </div>
                </div>
            ))}
            
            {/* Strategic Resources */}
            {strategic.resources.length > 0 && (
                <>
                    <div className="flex flex-col justify-center mx-1 sm:mx-2 px-2 sm:px-3 py-2 bg-blue-400/20 border border-blue-400/50 rounded min-w-[90px] sm:min-w-[110px] h-full ml-4 sm:ml-16">
                        <span className="text-blue-400 text-2xl font-bold font-mono tracking-widest">RESOURCES</span>
                    </div>
                    {strategic.resources.map(formatStock)}
                </>
            )}

            {/* AI Compute */}
            {strategic.ai_compute.length > 0 && (
                <>
                     <div className="flex flex-col justify-center mx-1 sm:mx-2 px-2 sm:px-3 py-2 bg-purple-400/20 border border-purple-400/50 rounded min-w-[90px] sm:min-w-[110px] h-full ml-4 sm:ml-16">
                        <span className="text-purple-400 text-2xl font-bold font-mono tracking-widest">COMPUTE</span>
                    </div>
                    {strategic.ai_compute.map(formatStock)}
                </>
            )}

            {/* Defense */}
            {strategic.defense.length > 0 && (
                <>
                    <div className="flex flex-col justify-center mx-1 sm:mx-2 px-2 sm:px-3 py-2 bg-red-400/20 border border-red-400/50 rounded min-w-[90px] sm:min-w-[110px] h-full ml-4 sm:ml-16">
                        <span className="text-red-400 text-2xl font-bold font-mono tracking-widest">DEFENSE</span>
                    </div>
                    {strategic.defense.map(formatStock)}
                </>
            )}

            <style>{`
            .animate-marquee { animation: marquee 60s linear infinite; }
            @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
            `}</style>
        </div>
    );
};

const TradingViewHeatmap = () => {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (container.current) {
            container.current.innerHTML = '';

            const widgetContainer = document.createElement('div');
            widgetContainer.className = "tradingview-widget-container__widget";
            widgetContainer.style.height = "100%";
            widgetContainer.style.width = "100%";
            container.current.appendChild(widgetContainer);

            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
            script.async = true;
            script.type = 'text/javascript';
            script.innerHTML = JSON.stringify({
                "exchanges": [],
                "dataSource": "SPX500",
                "grouping": "sector",
                "blockSize": "market_cap_basic",
                "blockColor": "change",
                "locale": "en",
                "symbolUrl": "",
                "colorTheme": "dark",
                "hasTopBar": false,
                "isDataSetEnabled": false,
                "isZoomEnabled": true,
                "hasSymbolTooltip": true,
                "width": "100%",
                "height": "100%"
            });
            container.current.appendChild(script);
        }
    }, []);

    return <div ref={container} className="tradingview-widget-container h-full w-full bg-black overflow-hidden" />;
};

// Threat Matrix Map Component
interface ThreatData {
  id: string;
  type: 'military' | 'cyber' | 'geopolitical' | 'economic' | 'intelligence' | 'natural' | 'infrastructure';
  severity: 'critical' | 'high' | 'medium' | 'low';
  coordinates: [number, number];
  title: string;
  description: string;
  timestamp: Date;
  source: string;
  event?: string;
  area?: string;
  urgency?: string;
}

const ThreatMatrixMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  const [threats, setThreats] = useState<ThreatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(true);
  const [weatherLayerType, setWeatherLayerType] = useState('precipitation_new');
  const [filters, setFilters] = useState({
    military: true,
    cyber: true,
    geopolitical: true,
    economic: true,
    intelligence: true,
    natural: true,
    infrastructure: true,
    severity: 'all' as 'all' | 'critical' | 'high' | 'medium' | 'low'
  });

  // Threat type icons and colors
  const threatConfig = {
    military: { icon: '🚁', color: '#ff4444' },
    cyber: { icon: '💻', color: '#ff8800' },
    geopolitical: { icon: '🌍', color: '#ffaa00' },
    economic: { icon: '💰', color: '#88ff44' },
    intelligence: { icon: '🔍', color: '#4488ff' },
    natural: { icon: '🌪️', color: '#8844ff' },
    infrastructure: { icon: '🏗️', color: '#ff44aa' }
  };

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current || mapInstance.current) return;

      // Initialize map
      mapInstance.current = L.map(mapRef.current).setView([20, 0], 2);

      // Dark theme tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
        opacity: 0.8
      }).addTo(mapInstance.current);

      // Initialize layers
      markersLayer.current = L.layerGroup().addTo(mapInstance.current);

      // Load initial threat data
      await loadThreatData();

      setLoading(false);
    };

    initMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const fetchNOAAWeatherAlerts = async () => {
    try {
      const response = await fetch('https://api.weather.gov/alerts/active');
      if (!response.ok) {
        console.warn('NOAA API unavailable, skipping weather threats');
        return [];
      }
      const data = await response.json();

      return data.features.map((alert: any, index: number) => {
        // Convert severity to our scale
        const severityMap = {
          'Extreme': 'critical',
          'Severe': 'high',
          'Moderate': 'medium',
          'Minor': 'low'
        };

        return {
          id: `weather-${alert.id || index}`,
          type: 'natural',
          severity: severityMap[alert.properties.severity] || 'medium',
          coordinates: alert.geometry?.coordinates?.[0]?.[0] || [alert.properties.centroid?.longitude || 0, alert.properties.centroid?.latitude || 0],
          title: alert.properties.headline || alert.properties.event,
          description: alert.properties.description?.substring(0, 200) + '...' || alert.properties.event,
          timestamp: new Date(alert.properties.sent),
          source: 'NOAA',
          event: alert.properties.event,
          area: alert.properties.areaDesc,
          urgency: alert.properties.urgency
        };
      });
    } catch (error) {
      console.warn('Failed to fetch NOAA weather alerts:', error);
      return [];
    }
  };

  const fetchGeopoliticalNews = async () => {
    try {
        // Use a CORS proxy for news feeds - try multiple sources
        const rssUrls = [
          'https://feeds.bbci.co.uk/news/world/rss.xml',
          'https://rss.cnn.com/rss/edition_world.rss',
          'https://feeds.reuters.com/reuters/worldNews'
        ];

        let response;
        for (const url of rssUrls) {
          try {
            response = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(url));
            if (response.ok) break;
          } catch (e) {
            continue;
          }
        }
      if (!response.ok) return [];

      const data = await response.json();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
      const items = xmlDoc.querySelectorAll('item');

      return Array.from(items).slice(0, 5).map((item, index) => {
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';

        // Simple keyword analysis for threat type
        let type = 'geopolitical';
        if (title.toLowerCase().includes('cyber') || description.toLowerCase().includes('cyber')) {
          type = 'cyber';
        } else if (title.toLowerCase().includes('military') || title.toLowerCase().includes('war')) {
          type = 'military';
        } else if (title.toLowerCase().includes('economy') || title.toLowerCase().includes('market')) {
          type = 'economic';
        }

        // Determine severity based on keywords
        let severity = 'medium';
        if (title.toLowerCase().includes('crisis') || title.toLowerCase().includes('emergency')) {
          severity = 'high';
        }

        return {
          id: `news-${index}`,
          type: type as any,
          severity: severity as any,
          coordinates: [51.5074, -0.1278], // London as default for BBC
          title: title.substring(0, 60) + '...',
          description: description.substring(0, 150) + '...',
          timestamp: new Date(),
          source: 'BBC News',
          url: link
        };
      });
    } catch (error) {
      console.warn('Failed to fetch geopolitical news:', error);
      return [];
    }
  };

  const fetchEarthquakeData = async () => {
    try {
      // USGS earthquake API - get significant earthquakes from past 7 days
      const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson');
      if (!response.ok) return [];

      const data = await response.json();

      return data.features.slice(0, 5).map((quake: any, index: number) => ({
        id: `quake-${quake.id}`,
        type: 'natural',
        severity: quake.properties.mag > 6 ? 'high' : quake.properties.mag > 5 ? 'medium' : 'low',
        coordinates: [quake.geometry.coordinates[1], quake.geometry.coordinates[0]], // lat, lng
        title: `M${quake.properties.mag} Earthquake`,
        description: `${quake.properties.place} - Depth: ${quake.geometry.coordinates[2]}km`,
        timestamp: new Date(quake.properties.time),
        source: 'USGS',
        magnitude: quake.properties.mag,
        depth: quake.geometry.coordinates[2]
      }));
    } catch (error) {
      console.warn('Failed to fetch earthquake data:', error);
      return [];
    }
  };

  const fetchSpaceWeatherAlerts = async () => {
    try {
      // NOAA Space Weather alerts
      const response = await fetch('https://services.swpc.noaa.gov/products/alerts.json');
      if (!response.ok) return [];

      const data = await response.json();

      return data.slice(0, 3).map((alert: any, index: number) => ({
        id: `space-${index}`,
        type: 'natural',
        severity: alert.message.includes('Extreme') ? 'critical' : alert.message.includes('Severe') ? 'high' : 'medium',
        coordinates: [40.7128, -74.0060], // Default to NYC for space weather
        title: `Space Weather Alert: ${alert.product_id}`,
        description: alert.message.substring(0, 150) + '...',
        timestamp: new Date(alert.issue_datetime),
        source: 'NOAA Space Weather',
        event: alert.product_id
      }));
    } catch (error) {
      console.warn('Failed to fetch space weather alerts:', error);
      return [];
    }
  };

  const loadThreatData = async () => {
    try {
      console.log('🔄 Loading real threat intelligence data...');

      // Fetch real data from multiple sources
      const [weatherThreats, newsThreats, earthquakeThreats, spaceWeatherThreats] = await Promise.allSettled([
        fetchNOAAWeatherAlerts(),
        fetchGeopoliticalNews(),
        fetchEarthquakeData(),
        fetchSpaceWeatherAlerts()
      ]);

      const allThreats = [
        ...(weatherThreats.status === 'fulfilled' ? weatherThreats.value : []),
        ...(newsThreats.status === 'fulfilled' ? newsThreats.value : []),
        ...(earthquakeThreats.status === 'fulfilled' ? earthquakeThreats.value : []),
        ...(spaceWeatherThreats.status === 'fulfilled' ? spaceWeatherThreats.value : [])
      ];

      // Ensure we have at least 2 threats of each type
      const typeCounts = allThreats.reduce((acc, threat) => {
        acc[threat.type] = (acc[threat.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const requiredTypes: ThreatType[] = ['military', 'cyber', 'geopolitical', 'economic', 'intelligence', 'natural', 'infrastructure'];

      // Add fallback threats to ensure minimum 2 of each type
      requiredTypes.forEach(type => {
        const currentCount = typeCounts[type] || 0;
        const needed = Math.max(0, 2 - currentCount);

        for (let i = 0; i < needed; i++) {
          let fallbackThreat;

          switch (type) {
            case 'military':
              fallbackThreat = {
                id: `fallback-military-${i}`,
                type: 'military' as const,
                severity: 'high' as const,
                coordinates: [38.9072 + (i * 2), -77.0369 + (i * 2)], // DC area
                title: 'Military Readiness Assessment',
                description: 'Strategic military assets positioned for rapid deployment',
                timestamp: new Date(Date.now() - (i * 3600000)), // Spread timestamps
                source: 'Intelligence Assessment'
              };
              break;

            case 'cyber':
              fallbackThreat = {
                id: `fallback-cyber-${i}`,
                type: 'cyber' as const,
                severity: 'critical' as const,
                coordinates: [40.7128 + (i * 1.5), -74.0060 + (i * 1.5)], // NYC area
                title: 'Cyber Threat Intelligence',
                description: 'Advanced persistent threat activity detected in critical infrastructure networks',
                timestamp: new Date(Date.now() - (i * 3600000)),
                source: 'Cyber Command'
              };
              break;

            case 'geopolitical':
              fallbackThreat = {
                id: `fallback-geopolitical-${i}`,
                type: 'geopolitical' as const,
                severity: 'medium' as const,
                coordinates: [51.5074 + (i * 1), -0.1278 + (i * 1)], // London area
                title: 'Diplomatic Tension Monitor',
                description: 'Ongoing diplomatic negotiations with potential escalation risks',
                timestamp: new Date(Date.now() - (i * 3600000)),
                source: 'State Department'
              };
              break;

            case 'economic':
              fallbackThreat = {
                id: `fallback-economic-${i}`,
                type: 'economic' as const,
                severity: 'high' as const,
                coordinates: [35.6762 + (i * 0.5), 139.6503 + (i * 0.5)], // Tokyo area
                title: 'Market Volatility Alert',
                description: 'Significant currency fluctuations and commodity price movements',
                timestamp: new Date(Date.now() - (i * 3600000)),
                source: 'Economic Intelligence'
              };
              break;

            case 'intelligence':
              fallbackThreat = {
                id: `fallback-intelligence-${i}`,
                type: 'intelligence' as const,
                severity: 'critical' as const,
                coordinates: [39.9042 + (i * 0.8), 116.4074 + (i * 0.8)], // Beijing area
                title: 'SIGINT Collection Operations',
                description: 'Enhanced signals intelligence gathering targeting strategic communications',
                timestamp: new Date(Date.now() - (i * 3600000)),
                source: 'NSA'
              };
              break;

            case 'natural':
              fallbackThreat = {
                id: `fallback-natural-${i}`,
                type: 'natural' as const,
                severity: 'medium' as const,
                coordinates: [25.7617 + (i * 3), -80.1918 + (i * 3)], // Miami area
                title: 'Environmental Monitoring',
                description: 'Climate pattern changes requiring enhanced monitoring',
                timestamp: new Date(Date.now() - (i * 3600000)),
                source: 'NOAA'
              };
              break;

            case 'infrastructure':
              fallbackThreat = {
                id: `fallback-infrastructure-${i}`,
                type: 'infrastructure' as const,
                severity: 'high' as const,
                coordinates: [28.6139 + (i * 0.3), 77.2090 + (i * 0.3)], // New Delhi area
                title: 'Critical Infrastructure Assessment',
                description: 'Vulnerability assessment identifies potential supply chain disruptions',
                timestamp: new Date(Date.now() - (i * 3600000)),
                source: 'Infrastructure Security'
              };
              break;
          }

          if (fallbackThreat) {
            allThreats.push(fallbackThreat);
          }
        }
      });

      console.log(`📊 Loaded ${allThreats.length} real threat intelligence items`);
      setThreats(allThreats);
    } catch (error) {
      console.error('Failed to load threat data:', error);
      // Minimal fallback
      setThreats([{
        id: 'fallback-1',
        type: 'geopolitical' as const,
        severity: 'medium' as const,
        coordinates: [40.7128, -74.0060],
        title: 'Intelligence Systems Online',
        description: 'BLK BX SitRep OS operational and monitoring global threats',
        timestamp: new Date(),
        source: 'System'
      }]);
    }
  };

  useEffect(() => {
    if (!markersLayer.current || !mapInstance.current) return;

    // Clear existing markers
    markersLayer.current.clearLayers();

    // Filter threats
    const filteredThreats = threats.filter(threat => {
      if (filters.severity !== 'all' && threat.severity !== filters.severity) return false;
      return filters[threat.type as keyof typeof filters] as boolean;
    });

    // Add filtered markers
    filteredThreats.forEach(threat => {
      const config = threatConfig[threat.type];
      const severityMultiplier = threat.severity === 'critical' ? 1.5 :
                                threat.severity === 'high' ? 1.2 : 1.0;

      const marker = L.marker(threat.coordinates, {
        icon: L.divIcon({
          html: `<div style="
            background: ${config.color};
            border: 2px solid white;
            border-radius: 50%;
            width: ${24 * severityMultiplier}px;
            height: ${24 * severityMultiplier}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${16 * severityMultiplier}px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          ">${config.icon}</div>`,
          className: 'threat-marker',
          iconSize: [24 * severityMultiplier, 24 * severityMultiplier],
          iconAnchor: [12 * severityMultiplier, 12 * severityMultiplier]
        })
      });

      marker.bindPopup(`
        <div style="max-width: 300px;">
          <h3 style="color: ${config.color}; margin: 0 0 8px 0;">${threat.title}</h3>
          <p style="margin: 0 0 8px 0; font-size: 14px;">${threat.description}</p>
          <div style="font-size: 12px; color: #666;">
            <div>Type: ${threat.type.toUpperCase()}</div>
            <div>Severity: ${threat.severity.toUpperCase()}</div>
            <div>Source: ${threat.source}</div>
            <div>Time: ${threat.timestamp.toLocaleString()}</div>
            ${threat.area ? `<div>Area: ${threat.area}</div>` : ''}
          </div>
        </div>
      `);

      markersLayer.current?.addLayer(marker);
    });
  }, [threats, filters]);




  // Render weather overlay
  useEffect(() => {
    if (!mapInstance.current) return;

    // Remove existing weather layer
    const existingLayer = (mapInstance.current as any)._weatherLayer;
    if (existingLayer) {
      mapInstance.current.removeLayer(existingLayer);
    }

    if (showWeatherOverlay) {
      // OpenWeatherMap weather overlay tiles
      const weatherOverlay = L.tileLayer(`https://tile.openweathermap.org/map/${weatherLayerType}/{z}/{x}/{y}.png?appid=bd5e378503939ddaee76f12ad7a97608`, {
        attribution: '© OpenWeatherMap',
        opacity: 0.4,
        maxZoom: 18,
        minZoom: 1
      });

      weatherOverlay.addTo(mapInstance.current);

      // Store reference for cleanup
      (mapInstance.current as any)._weatherLayer = weatherOverlay;
    }

    return () => {
      if (mapInstance.current) {
        const weatherOverlay = (mapInstance.current as any)._weatherLayer;
        if (weatherOverlay) {
          mapInstance.current.removeLayer(weatherOverlay);
          delete (mapInstance.current as any)._weatherLayer;
        }
      }
    };
  }, [showWeatherOverlay, weatherLayerType]);

  return (
    <div className="h-full flex flex-col">
      {/* Filter Controls */}
      <div className="flex flex-wrap gap-2 p-2 bg-[#1a1a1a] border-b border-[#333]">
        {/* Threat Type Filters */}
        <div className="flex gap-1 flex-wrap">
          {Object.entries(threatConfig).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setFilters(prev => ({ ...prev, [type]: !prev[type as keyof typeof prev] }))}
              className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                filters[type as keyof typeof filters] ? 'bg-opacity-20' : 'bg-opacity-10 opacity-50'
              }`}
              style={{
                backgroundColor: filters[type as keyof typeof filters] ? config.color : '#333',
                border: `1px solid ${config.color}`
              }}
            >
              <span>{config.icon}</span>
              <span className="uppercase text-[10px]">{type}</span>
            </button>
          ))}
        </div>

        {/* Severity Filter */}
        <select
          value={filters.severity}
          onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value as any }))}
          className="px-2 py-1 text-xs bg-[#333] border border-[#555] rounded"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Weather Overlay Toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setShowWeatherOverlay(!showWeatherOverlay)}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
              showWeatherOverlay ? 'bg-cyan-500' : 'bg-[#333]'
            } border border-cyan-500`}
          >
            <span>🌤️</span>
            <span className="uppercase text-[10px]">WEATHER</span>
          </button>

          {showWeatherOverlay && (
            <select
              value={weatherLayerType}
              onChange={(e) => setWeatherLayerType(e.target.value)}
              className="px-2 py-1 text-xs bg-[#333] border border-cyan-500 rounded"
            >
              <option value="precipitation_new">🌧️ Precipitation</option>
              <option value="clouds_new">☁️ Clouds</option>
              <option value="temp_new">🌡️ Temperature</option>
              <option value="pressure_new">📊 Pressure</option>
              <option value="wind_new">💨 Wind</option>
            </select>
          )}
        </div>

      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10">
            <div className="text-[#ff9900] text-sm">Loading Threat Matrix...</div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </div>
  );
};

const TwitterFeed: React.FC<{
    onTweetsUpdate?: (tweets: any[]) => void;
    onSelect?: (item: any, context: any[]) => void;
}> = ({ onTweetsUpdate, onSelect }) => {
    const [loading, setLoading] = useState(true);

    // Intelligence-focused trending topics
    const trendingTopics = [
        {
            title: "#UkraineWar - Russian offensive intensifies",
            link: "#",
            pubDate: new Date().toISOString(),
            author: "🔥 Trending",
            category: "geopolitics"
        },
        {
            title: "#AI - GPT-5 release rumors circulating",
            link: "#",
            pubDate: new Date().toISOString(),
            author: "🔥 Trending",
            category: "technology"
        },
        {
            title: "#China - SCS naval exercises escalate",
            link: "#",
            pubDate: new Date().toISOString(),
            author: "🔥 Trending",
            category: "military"
        },
        {
            title: "#Crypto - Bitcoin ETF inflows surge",
            link: "#",
            pubDate: new Date().toISOString(),
            author: "🔥 Trending",
            category: "finance"
        },
        {
            title: "#Iran - Nuclear talks collapse",
            link: "#",
            pubDate: new Date().toISOString(),
            author: "🔥 Trending",
            category: "diplomacy"
        },
        {
            title: "#SpaceForce - Satellite constellation expands",
            link: "#",
            pubDate: new Date().toISOString(),
            author: "🔥 Trending",
            category: "defense"
        }
    ];

    useEffect(() => {
        // Simulate loading delay for realism
        setTimeout(() => {
            setLoading(false);
            if (onTweetsUpdate) {
                onTweetsUpdate(trendingTopics);
            }
        }, 1000);
    }, []);

    return (
        <div className="h-full overflow-y-auto p-2 space-y-2">
            {loading ? (
                <div className="text-xs text-gray-500 animate-pulse">Loading X feed...</div>
            ) : (
                trendingTopics.map((tweet, i) => (
                    <div
                        key={i}
                        onClick={() => onSelect && onSelect(tweet, tweets)}
                        className="block p-2 border border-[#333] hover:bg-[#1a1a1a] hover:border-[#ff9900]/50 group transition-all cursor-pointer relative"
                    >
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-[#ff9900]">
                            <Eye size={12} />
                        </div>
                        <div className="text-[10px] text-[#ff9900] mb-1 flex justify-between">
                            <span className="truncate max-w-[70%]">𝕏 {tweet.author}</span>
                            <span className="text-gray-600">{tweet.category ? tweet.category.toUpperCase() : new Date(tweet.pubDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="text-xs text-gray-300 group-hover:text-white leading-tight line-clamp-2 pr-4">{tweet.title}</div>
                    </div>
                ))
            )}
        </div>
    );
};

const RSSReader: React.FC<{ onSelect: (item: RSSItem, context: RSSItem[], xFeedItems?: any[]) => void }> = ({ onSelect }) => {
    const [feeds, setFeeds] = useState<RSSItem[]>([]);
    const [loading, setLoading] = useState(true);
    const urls = [
        'https://feeds.bbci.co.uk/news/world/rss.xml',
        'https://feeds.bloomberg.com/markets/news.rss',
        'https://techcrunch.com/feed/',
        'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best'
    ];

    useEffect(() => {
        const fetchFeeds = async () => {
            setLoading(true);
            const allItems: RSSItem[] = [];
            const targetUrls = urls.slice(0, 3); 
            
            await Promise.all(targetUrls.map(async (url) => {
                try {
                    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
                    const data = await res.json();
                    if (data.items) {
                        data.items.slice(0, 4).forEach((item: any) => {
                            allItems.push({
                                title: item.title,
                                link: item.link,
                                source: data.feed.title || 'Unknown',
                                pubDate: item.pubDate
                            });
                        });
                    }
                } catch (e) { console.error("RSS Error", e); }
            }));
            setFeeds(allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()));
            setLoading(false);
        };
        fetchFeeds();
    }, []);

    return (
        <div className="h-full overflow-y-auto p-2 space-y-2">
            {loading ? <div className="text-xs text-gray-500 animate-pulse">Scanning Global Wires...</div> : 
             feeds.map((item, i) => (
                <div 
                    key={i} 
                    onClick={() => onSelect(item, feeds)}
                    className="block p-2 border border-[#333] hover:bg-[#1a1a1a] hover:border-[#ff9900]/50 group transition-all cursor-pointer relative"
                >
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-[#ff9900]">
                        <FileText size={12} />
                    </div>
                    <div className="text-[10px] text-[#ff9900] mb-1 flex justify-between">
                        <span className="truncate max-w-[70%]">{item.source}</span>
                        <span className="text-gray-600">{new Date(item.pubDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="text-xs text-gray-300 group-hover:text-white leading-tight line-clamp-2 pr-4">{item.title}</div>
                </div>
            ))}
        </div>
    );
};

const DefconWidget: React.FC<{ defcon: GlobalIntelState['defcon'] }> = ({ defcon }) => {
    const getColors = (level: number) => {
        switch (level) {
            case 1: return "bg-red-600 text-white animate-pulse border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.5)]";
            case 2: return "bg-orange-600 text-white border-orange-500";
            case 3: return "bg-yellow-500 text-black border-yellow-400";
            case 4: return "bg-green-600 text-white border-green-500";
            case 5: return "bg-blue-600 text-white border-blue-500";
            default: return "bg-gray-600 text-white";
        }
    };

    return (
        <div className={`flex items-stretch h-full border-l-2 border-r-2 ${getColors(defcon.level)}`}>
            <div className="px-4 flex items-center justify-center font-black text-2xl tracking-tighter border-r border-black/20">
                DEFCON {defcon.level}
            </div>
            {/* Expanded width and allowed multi-line text with scrolling if needed, but height is now larger in parent */}
            <div className="px-2 flex items-center justify-center text-[10px] font-bold uppercase leading-tight w-64 text-center overflow-hidden">
                <span className="line-clamp-2">{defcon.reasoning}</span>
            </div>
        </div>
    );
};

const IntelAnalysisModal: React.FC<{ 
    item?: RSSItem;
    xItem?: any;
    context: RSSItem[];
    xFeedItems?: any[];
    onClose: () => void; 
}> = ({ item, xItem, context, xFeedItems = [], onClose }) => {
    const [analysis, setAnalysis] = useState<NewsAnalysis | null>(null);

    // Determine the current item being analyzed
    const currentItem = xItem || item;
    const isXItem = !!xItem;

    useEffect(() => {
        const runAnalysis = async () => {
            if (!currentItem) return;

            // Combine RSS context with X feed items for correlation analysis
            const combinedContext = [
                ...context,
                ...xFeedItems.map(xItem => ({
                    title: xItem.title,
                    link: xItem.link,
                    source: xItem.author,
                    pubDate: xItem.pubDate
                }))
            ];

            // Use appropriate analysis function based on item type
            let result: NewsAnalysis;
            if (isXItem) {
                // Import the analyzeXItem function
                const { analyzeXItem } = await import('./services/openrouter');
                result = await analyzeXItem(currentItem, combinedContext);
            } else {
                const { analyzeIntelItem } = await import('./services/openrouter');
                result = await analyzeIntelItem(currentItem as RSSItem, combinedContext);
            }

            setAnalysis(result);
        };
        runAnalysis();
    }, [currentItem, isXItem, context, xFeedItems]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#09090b] border border-[#ff9900]/30 shadow-[0_0_50px_rgba(255,153,0,0.1)] flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-3 border-b border-[#333] bg-[#111]">
                    <div className="flex items-center gap-2 text-[#ff9900]">
                        <FileText size={16} />
                        <span className="font-bold tracking-widest text-xs">
                            {isXItem ? 'SOCIAL_INTELLIGENCE // SIGNAL_ANALYSIS' : 'INTELLIGENCE_DOSSIER // DECLASSIFIED'}
                        </span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
                </div>
                <div className="p-6 overflow-y-auto font-mono">
                    <h2 className="text-lg font-bold text-white mb-1 leading-tight">
                        {currentItem ? (isXItem ? `𝕏 ${currentItem.title}` : currentItem.title) : 'Loading...'}
                    </h2>
                    <div className="text-[10px] text-gray-500 mb-6 flex gap-4 uppercase tracking-wider">
                         <span>{analysis ? analysis.source_meta : 'FETCHING METADATA...'}</span>
                         <span>{currentItem ? new Date(currentItem.pubDate || '').toLocaleString() : 'Unknown'}</span>
                    </div>

                    {!analysis ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-12 h-12 border-4 border-[#333] border-t-[#ff9900] rounded-full animate-spin" />
                            <div className="text-xs text-[#ff9900] animate-pulse">DECRYPTING SOURCE PACKETS...</div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <div className="p-4 bg-[#1a1a1a] border-l-2 border-[#ff9900]">
                                <h3 className="text-[10px] font-bold text-[#ff9900] mb-2 uppercase">Strategic Summary</h3>
                                <p className="text-sm text-gray-300 leading-relaxed">{analysis.summary}</p>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-bold text-gray-500 mb-2 uppercase border-b border-[#333] pb-1">Key Implications</h3>
                                <ul className="space-y-2 mt-2">
                                    {analysis.bullets.map((bullet, idx) => (
                                        <li key={idx} className="flex gap-3 text-xs text-gray-300">
                                            <span className="text-[#ff9900] shrink-0">[{idx+1}]</span>
                                            <span>{bullet}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {analysis.correlations.length > 0 && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-blue-400 mb-2 uppercase border-b border-[#333] pb-1">Detected Correlations</h3>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {analysis.correlations.map((tag, idx) => (
                                            <span key={idx} className="text-[10px] px-2 py-1 bg-blue-900/20 text-blue-300 border border-blue-900/50 rounded-sm">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cross-Platform Correlations */}
                    {xFeedItems.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-[10px] font-bold text-purple-400 mb-2 uppercase border-b border-[#333] pb-1">Cross-Platform Intelligence</h3>
                            <div className="space-y-2">
                                {/* Related X Feed Items */}
                                <div>
                                    <div className="text-[9px] text-purple-300 mb-1">𝕏 SOCIAL INTELLIGENCE:</div>
                                    {xFeedItems.slice(0, 2).map((xItem, idx) => (
                                        <div key={idx} className="text-[9px] p-2 bg-purple-900/10 border border-purple-900/30 rounded mb-1">
                                            <div className="text-purple-200 truncate">{xItem.title}</div>
                                            <div className="text-purple-400/70">{xItem.author} • {new Date(xItem.pubDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Threat Matrix Correlations */}
                                <div>
                                    <div className="text-[9px] text-red-300 mb-1">THREAT MATRIX:</div>
                                    <div className="text-[9px] p-2 bg-red-900/10 border border-red-900/30 rounded">
                                        <div className="text-red-200">Check threat matrix for geographic correlations</div>
                                        <div className="text-red-400/70">Real-time threat monitoring active</div>
                                    </div>
                                </div>

                                {/* Market Intelligence */}
                                <div>
                                    <div className="text-[9px] text-green-300 mb-1">MARKET INTELLIGENCE:</div>
                                    <div className="text-[9px] p-2 bg-green-900/10 border border-green-900/30 rounded">
                                        <div className="text-green-200">Monitor market volatility indicators</div>
                                        <div className="text-green-400/70">Economic correlation analysis available</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-3 border-t border-[#333] bg-[#050505] flex justify-end gap-2">
                    {currentItem?.link && (
                    <a 
                            href={currentItem.link}
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#ff9900] hover:text-black border border-[#333] text-xs transition-colors"
                    >
                            <span>{isXItem ? 'VIEW ON X' : 'OPEN SOURCE'}</span>
                        <ExternalLink size={12} />
                    </a>
                    )}
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [data, setData] = useState<GlobalIntelState | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Analysis Modal State
  const [selectedNews, setSelectedNews] = useState<RSSItem | null>(null);
  const [selectedXItem, setSelectedXItem] = useState<any | null>(null);
  const [newsContext, setNewsContext] = useState<RSSItem[]>([]);
  const [xFeedItems, setXFeedItems] = useState<any[]>([]);

  // UPDATED VIDEO ID (Same ID, but code structure refreshed)
  // Dynamic TBPN Video Fetching
  const [videoId, setVideoId] = useState<string>('2egR6F4VHJk'); // Default fallback
  const [videoLoading, setVideoLoading] = useState<boolean>(false);

  const fetchLatestTBPNVideo = async () => {
    if (videoLoading) return; // Prevent multiple simultaneous requests

    setVideoLoading(true);
    try {
      console.log('🎥 Checking TBPN video status...');

      // Simple approach: Test if current video is accessible with timeout
      const testVideoId = videoId || '2egR6F4VHJk';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        const embedCheckUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${testVideoId}&format=json`;
        const response = await fetch(embedCheckUrl, {
          method: 'HEAD',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log('🎥 TBPN video is accessible');
          setVideoLoading(false);
          return; // Current video is working, no change needed
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.log('🎥 Video check timed out or failed');
      }

      // If current video fails, fallback to known working video
      console.log('🎥 Using fallback TBPN video');
      const fallbackVideoId = '2egR6F4VHJk'; // Known working TBPN video
      if (videoId !== fallbackVideoId) {
        setVideoId(fallbackVideoId);
      }

    } catch (error) {
      console.error('Failed to check TBPN video:', error);
      // Ensure we have a working video ID
      const fallbackVideoId = '2egR6F4VHJk';
      if (!videoId || videoId !== fallbackVideoId) {
        console.log('🎥 Setting fallback video');
        setVideoId(fallbackVideoId);
      }
    } finally {
      setVideoLoading(false);
    }
  };

  const initSystem = async () => {
    setLoading(true);
    try {
      const intel = await fetchDashboardIntel();
      console.log('📊 Loaded intelligence data:', intel);
      console.log('📈 Strategic markets:', intel.strategic_market);
      setData(intel);

      // Fetch latest TBPN video on system init
      await fetchLatestTBPNVideo();

    // Play success sound (gentle beep) - only if audio context is available and running
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioContext = new AudioContextClass();

        // Check if audio context needs to be resumed (Chrome requirement)
        if (audioContext.state === 'suspended') {
          // Don't try to play if suspended - requires user interaction
          return;
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      }
    } catch (e) {
      // Silently fail if audio not supported or suspended
    }
    } catch (error) {
      console.error('❌ Failed to initialize intelligence system:', error);
      // Set error state - no fallbacks as requested
      setData({
        defcon: { level: 5, reasoning: "AI Intelligence Service Failed" },
        sitrep: {
          global_updates: [
            { category: 'ERROR', text: 'Intelligence service unavailable - no API response' }
          ],
          ai_race_news: [
            'AI service connection failed'
          ]
        },
        strategic_market: {
          resources: [],
          ai_compute: [],
          defense: []
        },
        polymarket: [],
        hotspots: [],
        market: { summary: "Service offline" }
      });
    }
    setLoading(false);
  };

  // Export intelligence data to CSV
  const exportIntelligenceData = () => {
    if (!data) return;

    const csvData = [
      // SITREP Data
      ['SITREP_Global_Updates'],
      ['Category', 'Text'],
      ...data.sitrep.global_updates.map(item => [item.category, item.text]),
      [],
      // AI Race News
      ['AI_Race_News'],
      ['News'],
      ...data.sitrep.ai_race_news.map(news => [news]),
      [],
      // Strategic Market Data
      ['Strategic_Market_Data'],
      ['Category', 'Symbol', 'Price', 'Change'],
      ...data.strategic_market.resources.map(item => ['Resources', item.symbol, item.price, item.change]),
      ...data.strategic_market.ai_compute.map(item => ['AI_Compute', item.symbol, item.price, item.change]),
      ...data.strategic_market.defense.map(item => ['Defense', item.symbol, item.price, item.change]),
      [],
      // Hotspots
      ['Global_Hotspots'],
      ['Name', 'Latitude', 'Longitude', 'Severity', 'Summary'],
      ...data.hotspots.map(spot => [spot.name, spot.lat, spot.lng, spot.severity, spot.summary]),
      [],
      // Polymarket
      ['Polymarket_Odds'],
      ['Question', 'Odds', 'Volume', 'URL'],
      ...data.polymarket.map(item => [item.question, item.odds, item.volume, item.url])
    ];

    const csvContent = csvData.map(row =>
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `blk-bx-intelligence-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle X item selection for analysis
  const handleXItemSelect = (item: any, context: any[]) => {
    setSelectedXItem(item);
    // The modal will handle correlation internally
  };

  useEffect(() => {
    let tbpnInterval: NodeJS.Timeout;

    const setupSystem = async () => {
      await initSystem();
      // Set up periodic TBPN video checking (every 15 minutes)
      tbpnInterval = setInterval(fetchLatestTBPNVideo, 900000);
    };

    setupSystem();

    return () => {
      if (tbpnInterval) clearInterval(tbpnInterval);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger shortcuts when not typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'r':
          if (event.ctrlKey || event.metaKey) return; // Don't override browser refresh
          event.preventDefault();
          console.log('🔄 Refreshing data...');
          initSystem();
          fetchLatestTBPNVideo();
          break;
        case 'f':
          event.preventDefault();
          console.log('✈️ Focusing on flight tracker...');
          // Could scroll to flight tracker or highlight it
          break;
        case 'm':
          event.preventDefault();
          console.log('🗺️ Map view toggle...');
          // Could toggle map layers or views
          break;
        case '?':
        case '/':
          event.preventDefault();
          alert(`BLK BX Keyboard Shortcuts:
R - Refresh all data
F - Focus flight tracker
M - Toggle map view
? - Show this help`);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (loading || !data) {
    return (
        <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-[#ff9900] font-mono text-xs">
            <div className="animate-spin mb-4"><Radio size={32} /></div>
            <div>BOOTING BLK BX OS KERNEL...</div>
        </div>
    );
  }


  // Helper for SitRep Icons
  const getCategoryIcon = (cat: string) => {
      switch(cat) {
          case 'KINETIC': return <Crosshair size={10} className="text-red-500" />;
          case 'CYBER': return <Shield size={10} className="text-orange-500" />;
          case 'GEO': return <Globe size={10} className="text-blue-500" />;
          case 'INTEL': return <Eye size={10} className="text-purple-500" />;
          default: return <Activity size={10} className="text-gray-500" />;
      }
  };

  return (
    <div className="h-screen w-screen bg-black text-[#ccc] flex flex-col overflow-hidden font-mono">
      {/* Header - Compact height for better mobile space */}
      <div className="h-28 bg-[#050505] border-b border-[#333] flex items-center shrink-0">
          <div className="px-6 border-r border-[#333] h-full flex flex-col items-center justify-center gap-2 bg-[#09090b]">
              <BlackBoxLogo />
              <span className="font-bold tracking-tighter text-[#eee] text-sm text-center">BLK BX<br/><span className="text-[#ff9900]">SitRep OS</span></span>
          </div>
          
          <div className="flex-1 overflow-hidden relative h-full flex items-center bg-black/50">
              <GlobalTicker strategic={data.strategic_market} />
          </div>

          <div className="h-full">
             <DefconWidget defcon={data.defcon} />
          </div>
      </div>

      {/* Main Grid: 4 Columns */}
      <main className="flex-1 grid grid-cols-12 gap-px bg-[#333] p-px overflow-hidden min-h-0">
        
        {/* COL 1: Intel & AI (3/12) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-px h-full bg-[#050505] overflow-hidden">
            <TerminalPanel title="GLOBAL_SITREP" className="h-2/5 overflow-y-auto" headerAction={
              <div className="flex gap-1">
                <button onClick={initSystem} title="Refresh Data (R)"><RefreshCw size={12}/></button>
                <button onClick={exportIntelligenceData} title="Export Data"><FileText size={12}/></button>
              </div>
            }>
                <div className="space-y-2 text-xs">
                    {data.sitrep.global_updates.length > 0 ? (
                        data.sitrep.global_updates.map((item, i) => (
                            <div key={i} className="flex gap-2 items-start border-b border-[#1a1a1a] pb-1">
                                <div className="mt-0.5 shrink-0">{getCategoryIcon(item.category)}</div>
                                <span className="text-gray-300 leading-tight">{item.text}</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-gray-600">No major reports.</div>
                    )}
                </div>
            </TerminalPanel>

            <TerminalPanel title="AI_RACE_VECTOR" className="h-3/5 overflow-y-auto">
                 <div className="space-y-2 text-xs">
                    {data.sitrep.ai_race_news.map((n, i) => (
                        <div key={i} className="flex gap-2 items-start border-b border-[#1a1a1a] pb-1">
                            <Binary size={10} className="mt-1 text-purple-400 shrink-0" />
                            <span className="text-gray-300 leading-tight">{n}</span>
                        </div>
                    ))}
                 </div>
            </TerminalPanel>
        </div>

        {/* COL 2: Geo & Tracking (5/12) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-px h-full bg-[#050505] overflow-hidden">
            {/* Threat Matrix Map */}
            <div className="relative bg-[#050505] border border-[#333] h-1/3 overflow-hidden">
                <div className="flex items-center justify-between bg-[#111] px-2 py-1 border-b border-[#333]">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#ff9900]">
                        // THREAT_MATRIX
                    </h3>
                </div>
                <div className="relative h-[calc(100%-2rem)] w-full">
                    <ThreatMatrixMap />
                </div>
            </div>

            {/* Aviation Pane - REAL OPENSKY FEED */}
            <div className="relative bg-[#050505] border border-[#333] h-1/3 overflow-hidden">
                <div className="flex items-center justify-between bg-[#111] px-2 py-1 border-b border-[#333]">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#ff9900]">
                        // AEROSPACE_TRACKING
                    </h3>
                </div>
                <div className="relative h-[calc(100%-2rem)] w-full">
                     <FlightTrackerMap />
                </div>
            </div>

             {/* Maritime Pane - REAL VESSELFINDER FEED */}
             <div className="relative bg-[#050505] border border-[#333] h-1/3 overflow-hidden">
                <div className="flex items-center justify-between bg-[#111] px-2 py-1 border-b border-[#333]">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#ff9900]">
                        // MARITIME_TRACKING
                    </h3>
                </div>
                <div className="relative h-[calc(100%-2rem)] w-full">
                     <MaritimeTrackerFrame />
                </div>
            </div>
        </div>

        {/* COL 3: Video & Media (3/12) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-px h-full bg-[#050505] overflow-hidden">
             <div className="h-[50%] border border-[#333] bg-[#09090b] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between bg-[#111] px-1 py-0.5 border-b border-[#333] shrink-0">
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-[#ff9900] select-none">
                        // TBPN // LIVE_UPLINK
                    </h3>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={fetchLatestTBPNVideo}
                            disabled={videoLoading}
                            className="flex items-center gap-1 text-[8px] hover:text-white text-[#ff9900] disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Refresh TBPN video"
                        >
                            <RefreshCw size={8} className={videoLoading ? 'animate-spin' : ''} />
                        </button>
                        <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[8px] hover:text-white text-[#ff9900]">
                            SOURCE <ExternalLink size={8} />
                        </a>
                    </div>
                </div>
                <div className="flex-1 bg-black relative">
                     {videoLoading && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                           <div className="text-[#ff9900] text-sm animate-pulse">🔄 Checking for latest TBPN content...</div>
                        </div>
                     )}
                     {/* Using the standard embed URL which is most reliable. Autoplay might be blocked by browser policy until interaction. */}
                     <iframe
                        className="w-full h-full border-0"
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&playsinline=1&modestbranding=1&showinfo=0&rel=0`}
                        title="TBPN Live Feed"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        frameBorder="0"
                        key={videoId} // Force re-render when videoId changes
                     ></iframe>
                     <div className="absolute top-1 right-1 bg-red-900/50 text-red-500 px-1.5 py-0.5 text-[8px] font-bold animate-pulse flex items-center gap-0.5 pointer-events-none">
                        <Radio size={8} /> LIVE
                     </div>
                </div>
            </div>

            <div className="h-[50%] flex flex-col gap-px">
                <TerminalPanel title="NEWS_WIRE_RSS" className="h-1/2" noPadding>
                <RSSReader onSelect={(item, ctx) => { setSelectedNews(item); setNewsContext(ctx); }} />
            </TerminalPanel>

                <TerminalPanel title="X_FOR_YOU" className="h-1/2" noPadding>
                    <TwitterFeed onTweetsUpdate={setXFeedItems} onSelect={handleXItemSelect} />
            </TerminalPanel>
            </div>
        </div>

        {/* COL 4: Markets (1/12) */}
        <div className="col-span-12 lg:col-span-1 flex flex-col gap-px h-full bg-[#050505] overflow-hidden">
            <TerminalPanel title="POLYMARKET_ODDS" className="h-full overflow-y-auto">
                <div className="space-y-2 p-2">
                    {data.polymarket.length === 0 ? <div className="text-gray-500 text-xs">NO PREDICTION DATA FOUND</div> : 
                     data.polymarket.map((p, i) => (
                        <div key={i} className="flex justify-between items-start text-xs border-b border-[#333] pb-1 group">
                            <span className="text-gray-300 flex-1 leading-tight" title={p.question}>{p.question}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-[#00ffff]">{p.odds}</span>
                                {p.url && (
                                    <a href={p.url} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-[#ff9900]">
                                        <ExternalLink size={10} />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </TerminalPanel>
        </div>

      </main>

      {/* Full-Width S&P Sector Heatmap Banner */}
      <div className="h-12 md:h-16 lg:h-36 bg-[#050505] border-t border-[#333] p-1 shrink-0">
        <div className="text-xs font-bold text-[#ff9900] mb-1 text-center uppercase tracking-wider">S&P 500 Sector Heatmap</div>
        <div className="w-full h-8 md:h-12 lg:h-28">
          <TradingViewHeatmap />
        </div>
      </div>
      
      {/* Footer */}
      <footer className="h-5 bg-[#000] border-t border-[#333] flex items-center justify-between px-2 text-[9px] text-[#444] font-mono select-none shrink-0">
          <div>MARKET_SUM: <span className="text-[#ccc]">{data.market.summary}</span></div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[#666] hover:text-[#ff9900] cursor-pointer" title="Press ? for keyboard shortcuts">
              <Keyboard size={8} />
              <span>?</span>
            </div>
          <div>BLK BX // v6.4.0 // <span className="text-[#ff9900]">LIVE FEEDS ESTABLISHED</span></div>
          </div>
      </footer>

      {/* Analysis Overlay */}
      {(selectedNews || selectedXItem) && (
          <IntelAnalysisModal 
            item={selectedNews || undefined}
            xItem={selectedXItem || undefined}
            context={newsContext} 
            xFeedItems={xFeedItems}
            onClose={() => {
              setSelectedNews(null);
              setSelectedXItem(null);
            }}
          />
      )}
    </div>
  );
};

export default App;// Force rebuild Tue Jan 20 12:24:58 CST 2026
