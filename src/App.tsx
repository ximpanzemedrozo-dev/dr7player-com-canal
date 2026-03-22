/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tv, 
  Play, 
  Settings, 
  RefreshCw, 
  ChevronRight, 
  Search, 
  User,
  Lock,
  LogOut,
  LayoutGrid,
  List,
  MonitorPlay,
  Info,
  ChevronLeft,
  Film,
  Clapperboard,
  Check,
  Menu,
  Zap,
  ZapOff,
  Hash,
  Keyboard
} from "lucide-react";
import Hls from "hls.js";

// Types
interface Channel {
  name: string;
  url: string;
  group: string;
  logo?: string;
  category: "live" | "movies" | "series";
  number?: number;
}

interface UserData {
  name: string;
  server: string;
  username: string;
  m3uUrl: string;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const [selectedGroup, setSelectedGroup] = useState<string>("Todos");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loginForm, setLoginForm] = useState({ server: "", username: "", password: "" });
  const [activeSection, setActiveSection] = useState<"live" | "movies" | "series">("live");
  const [layoutType, setLayoutType] = useState<"modern" | "classic" | "iptv">("modern");
  const [currentView, setCurrentView] = useState<"dashboard" | "content" | "settings">("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [visibleCount, setVisibleCount] = useState(40);
  const [isParsing, setIsParsing] = useState(false);
  const [playerEngine, setPlayerEngine] = useState<"hls" | "native" | "proxy">("hls");
  const [isAiOptimizing, setIsAiOptimizing] = useState(false);
  const [aiLog, setAiLog] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [lowPerformanceMode, setLowPerformanceMode] = useState(false);
  const [dialedNumber, setDialedNumber] = useState("");
  const [customChannelNumbers, setCustomChannelNumbers] = useState<Record<string, number>>({});
  const [isDialing, setIsDialing] = useState(false);
  const [editingChannelForNumber, setEditingChannelForNumber] = useState<Channel | null>(null);
  const dialTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const jumpToChannel = (num: string) => {
    const n = parseInt(num);
    if (isNaN(n)) return;
    
    const found = channels.find(c => c.category === "live" && c.number === n);
    if (found) {
      setSelectedChannel(found);
      setActiveSection(found.category);
      setCurrentView("content");
    }
    setDialedNumber("");
    setIsDialing(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= "0" && e.key <= "9") {
        setIsDialing(true);
        setDialedNumber(prev => {
          const next = prev + e.key;
          
          if (dialTimeoutRef.current) clearTimeout(dialTimeoutRef.current);
          dialTimeoutRef.current = setTimeout(() => {
            jumpToChannel(next);
          }, 2000);
          
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [channels]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Check for saved session and favorites
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    
    const saved = localStorage.getItem("iptv_session");
    const savedFavs = localStorage.getItem("iptv_favorites");
    const savedLayout = localStorage.getItem("iptv_layout");
    const savedLowPerf = localStorage.getItem("iptv_low_perf");
    const savedCustomNumbers = localStorage.getItem("iptv_custom_numbers");
    
    if (savedFavs) setFavorites(JSON.parse(savedFavs) as string[]);
    if (savedLayout) setLayoutType(savedLayout as "modern" | "classic" | "iptv");
    if (savedLowPerf) setLowPerformanceMode(savedLowPerf === "true");
    if (savedCustomNumbers) setCustomChannelNumbers(JSON.parse(savedCustomNumbers));
    
    if (saved) {
      const data = JSON.parse(saved) as UserData;
      setUserData(data);
      setIsLoggedIn(true);
      fetchChannels(data.m3uUrl);
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const toggleFavorite = (url: string) => {
    const newFavs = favorites.includes(url) 
      ? favorites.filter(f => f !== url) 
      : [...favorites, url];
    setFavorites(newFavs);
    localStorage.setItem("iptv_favorites", JSON.stringify(newFavs));
  };

  const categorizeChannel = (channel: Channel): "live" | "movies" | "series" => {
    const group = channel.group.toUpperCase();
    const name = channel.name.toUpperCase();
    const url = channel.url.toLowerCase();
    
    // Series patterns
    if (
      group.includes("SERIE") || 
      group.includes("EPISODIO") || 
      group.includes("SEASON") || 
      group.includes("TEMPORADA") ||
      group.includes("SÉRIE") ||
      name.match(/S\d+E\d+/) || 
      name.match(/S\d+\sE\d+/) ||
      url.includes("/series/")
    ) {
      // Exclude 24/7 channels that might be in series groups
      if (group.includes("24/7") || name.includes("24/7") || group.includes("KIDS")) {
        if (!name.match(/S\d+E\d+/)) return "live";
      }
      return "series";
    }
    
    // Movie patterns
    if (
      group.includes("FILME") || 
      group.includes("MOVIE") || 
      group.includes("VOD") || 
      group.includes("CINEMA") ||
      group.includes("LEGENDADO") ||
      group.includes("DUBLADO") ||
      group.includes("LANÇAMENTO") ||
      group.includes("PRE-ESTREIA") ||
      url.includes("/movie/") ||
      url.endsWith(".mp4") ||
      url.endsWith(".mkv") ||
      url.endsWith(".avi")
    ) {
      // Exclude 24/7 channels
      if (group.includes("24/7") || name.includes("24/7")) {
        return "live";
      }
      return "movies";
    }
    
    // Default to live for everything else
    return "live";
  };

  const { groups, groupCounts, movieCount, seriesCount } = React.useMemo(() => {
    const sectionChannels = channels.filter(c => c.category === activeSection);
    const counts: Record<string, number> = { "Todos": sectionChannels.length };
    const groupSet = new Set<string>();
    
    let movieCount = 0;
    let seriesCount = 0;
    
    for (const c of channels) {
      if (c.category === "movies") movieCount++;
      if (c.category === "series") seriesCount++;
      
      if (c.category === activeSection) {
        groupSet.add(c.group);
        counts[c.group] = (counts[c.group] || 0) + 1;
      }
    }
    
    return {
      groups: ["Todos", ...Array.from(groupSet).sort()],
      groupCounts: counts,
      movieCount,
      seriesCount
    };
  }, [channels, activeSection]);

  const getGroupCount = React.useCallback((group: string) => {
    return groupCounts[group] || 0;
  }, [groupCounts]);

  const filteredChannels = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    // Optimization: avoid filtering if not needed
    if (!channels.length) return [];
    
    return channels.filter(c => {
      if (c.category !== activeSection) return false;
      if (activeTab === "favorites" && !favorites.includes(c.url)) return false;
      if (selectedGroup !== "Todos" && c.group !== selectedGroup) return false;
      if (query !== "" && !c.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [channels, activeSection, searchQuery, selectedGroup, activeTab, favorites]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(lowPerformanceMode ? 20 : 40);
  }, [activeSection, searchQuery, selectedGroup, activeTab, lowPerformanceMode]);

  const toggleLowPerf = () => {
    const newVal = !lowPerformanceMode;
    setLowPerformanceMode(newVal);
    localStorage.setItem("iptv_low_perf", String(newVal));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Construct M3U URL from Server, Username and Password
    // Format: {server}/get.php?username={username}&password={password}&type=m3u_plus&output=mpegts
    let serverUrl = loginForm.server.trim();
    if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
      serverUrl = `http://${serverUrl}`;
    }
    if (serverUrl.endsWith("/")) {
      serverUrl = serverUrl.slice(0, -1);
    }
    
    const m3uUrl = `${serverUrl}/get.php?username=${loginForm.username.trim()}&password=${loginForm.password.trim()}&type=m3u_plus&output=m3u8`;
    
    const user: UserData = {
      name: loginForm.username,
      server: serverUrl,
      username: loginForm.username,
      m3uUrl: m3uUrl
    };

    try {
      // Use proxy to avoid CORS and Mixed Content issues
      const proxyUrl = `/api/proxy-m3u?url=${encodeURIComponent(m3uUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error("Falha ao acessar o servidor. Verifique os dados.");
      }
      
      setUserData(user);
      setIsLoggedIn(true);
      localStorage.setItem("iptv_session", JSON.stringify(user));
      fetchChannels(m3uUrl);
    } catch (err) {
      setError("Erro ao conectar. Verifique o servidor, usuário e senha.");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = React.useCallback(async (url: string) => {
    if (isParsing) return;
    setLoading(true);
    setError(null);
    try {
      const proxyUrl = `/api/proxy-m3u?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Erro do servidor: ${response.status}`);
      
      const text = await response.text();
      if (!text || text.length < 10) throw new Error("Lista vazia ou inválida.");
      
      setIsParsing(true);
      // Use a small timeout to allow UI to update before heavy parsing
      setTimeout(() => {
        try {
          const parsed = parseM3U(text);
          console.log(`Parsed ${parsed.length} channels.`);
          setChannels(parsed);
          
          // Resume last channel
          const last = localStorage.getItem("last_channel_v2");
          if (last) {
            const parsedLast = JSON.parse(last) as Channel;
            const found = parsed.find(c => c.url === parsedLast.url);
            if (found) setSelectedChannel(found);
          }
        } catch (e) {
          console.error("Parsing error:", e);
          setError("Erro ao processar a lista de canais.");
        } finally {
          setIsParsing(false);
          setLoading(false);
        }
      }, 100);
    } catch (err) {
      console.error("Fetch channels error:", err);
      setError("Falha ao carregar canais. Verifique sua conexão ou a URL da lista.");
      setLoading(false);
    }
  }, [isParsing]);

  const parseM3U = (data: string): Channel[] => {
    const lines = data.split("\n");
    const result: Channel[] = [];
    let currentChannel: Partial<Channel> = {};
    let channelCounter = 1;

    // Pre-compile regex for performance
    const nameRegex = /,(.*)$/;
    const groupRegex = /group-title="(.*?)"/;
    const logoRegex = /tvg-logo="(.*?)"/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("#EXTINF:")) {
        const nameMatch = line.match(nameRegex);
        const groupMatch = line.match(groupRegex);
        const logoMatch = line.match(logoRegex);
        
        currentChannel.name = nameMatch ? nameMatch[1].trim() : "Canal";
        currentChannel.group = groupMatch ? groupMatch[1] : "Geral";
        currentChannel.logo = logoMatch ? logoMatch[1] : undefined;
      } else if (line.startsWith("http")) {
        currentChannel.url = line;
        const channel = currentChannel as Channel;
        // Optimization: Categorize only once
        channel.category = categorizeChannel(channel);
        
        // Assign number (check custom mapping first) - ONLY for live channels
        if (channel.category === "live") {
          const customNum = customChannelNumbers[channel.url];
          channel.number = customNum || channelCounter++;
        }
        
        result.push(channel);
        currentChannel = {};
      }
    }
    return result;
  };

  useEffect(() => {
    if (selectedChannel && videoRef.current) {
      const video = videoRef.current;
      localStorage.setItem("last_channel_v2", JSON.stringify(selectedChannel));
      
      let streamUrl = selectedChannel.url;
      const isHls = streamUrl.includes(".m3u8") || streamUrl.includes("manifest") || streamUrl.includes("m3u8");
      const isDirectFile = streamUrl.endsWith(".mp4") || streamUrl.endsWith(".mkv") || streamUrl.endsWith(".avi");
      
      // If using proxy or if it's an insecure stream on a secure site
      if (playerEngine === "proxy" || (window.location.protocol === "https:" && streamUrl.startsWith("http:"))) {
        streamUrl = `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;
      }

      // Cleanup previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Try HLS.js for anything that looks like a stream or if HLS is selected
      if (playerEngine === "hls" && Hls.isSupported() && (isHls || !isDirectFile)) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingMaxRetry: 5,
          levelLoadingMaxRetry: 5,
          xhrSetup: (xhr, url) => {
            // Force all HLS requests through the proxy to bypass CORS
            if (url.startsWith('http') && !url.includes(window.location.host)) {
              const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(url)}`;
              xhr.open('GET', proxyUrl, true);
            }
          }
        });
        
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.error("HLS play error:", e));
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("HLS Network error, retrying...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("HLS Media error, trying recovery...");
                hls.recoverMediaError();
                break;
              default:
                console.warn("HLS fatal error, trying native fallback...");
                hls.destroy();
                hlsRef.current = null;
                video.src = streamUrl;
                video.play().catch(e => console.error("Native fallback error:", e));
                break;
            }
          }
        });
      } else {
        // Native playback for direct streams (.ts, .mp4, etc)
        video.src = streamUrl;
        video.play().catch(e => {
          console.error("Native play error:", e);
          if (e.name === "NotSupportedError" || e.message.includes("no supported source")) {
            setError("Formato não suportado nativamente. Tente mudar o 'Motor de Reprodução' para Proxy ou HLS nas configurações.");
          }
        });
      }
    }
  }, [selectedChannel, playerEngine]);

  const optimizeWithAi = async () => {
    if (channels.length === 0) return;
    setIsAiOptimizing(true);
    setAiLog(["Iniciando otimização inteligente...", "Analisando padrões de canais..."]);
    
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      // Take a sample of channels to analyze (e.g., 50 from each category)
      const sample = [
        ...channels.filter(c => c.category === "live").slice(0, 30),
        ...channels.filter(c => c.category === "movies").slice(0, 30),
        ...channels.filter(c => c.category === "series").slice(0, 30)
      ];

      const prompt = `Você é um especialista em IPTV. Analise esta lista de canais e sugira regras de categorização melhores.
      Muitos canais estão misturados (filmes em séries, etc).
      Aqui está uma amostra dos dados atuais:
      ${JSON.stringify(sample.map(c => ({ name: c.name, group: c.group, category: c.category })))}
      
      Responda APENAS com um objeto JSON contendo:
      1. "keywords": { "movies": [], "series": [], "live": [] } - Palavras-chave extras para cada categoria.
      2. "groupFixes": { "oldGroupName": "newGroupName" } - Sugestões de renomeação de grupos para organizar melhor.
      `;

      setAiLog(prev => [...prev, "Consultando IA para melhores regras de organização..."]);
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text);
      setAiLog(prev => [...prev, "IA processou os dados. Aplicando melhorias..."]);

      // Apply improvements to all channels
      const optimizedChannels = channels.map(channel => {
        let newCategory = channel.category;
        let newGroup = channel.group;

        // Apply group fixes
        if (result.groupFixes && result.groupFixes[channel.group]) {
          newGroup = result.groupFixes[channel.group];
        }

        // Apply extra keyword matching
        const name = channel.name.toUpperCase();
        const group = channel.group.toUpperCase();

        if (result.keywords) {
          for (const kw of result.keywords.series || []) {
            if (name.includes(kw.toUpperCase()) || group.includes(kw.toUpperCase())) newCategory = "series";
          }
          for (const kw of result.keywords.movies || []) {
            if (name.includes(kw.toUpperCase()) || group.includes(kw.toUpperCase())) newCategory = "movies";
          }
          for (const kw of result.keywords.live || []) {
            if (name.includes(kw.toUpperCase()) || group.includes(kw.toUpperCase())) newCategory = "live";
          }
        }

        return { ...channel, category: newCategory, group: newGroup };
      });

      setChannels(optimizedChannels);
      setAiLog(prev => [...prev, "Otimização concluída com sucesso!", `${optimizedChannels.length} canais reorganizados.`]);
      
      setTimeout(() => {
        setIsAiOptimizing(false);
        setAiLog([]);
      }, 3000);

    } catch (err) {
      console.error("AI Optimization error:", err);
      setAiLog(prev => [...prev, "Erro na otimização: " + (err instanceof Error ? err.message : "Erro desconhecido")]);
      setTimeout(() => setIsAiOptimizing(false), 3000);
    }
  };

  const logout = () => {
    localStorage.removeItem("iptv_session");
    setIsLoggedIn(false);
    setUserData(null);
    setChannels([]);
    setSelectedChannel(null);
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Cinematic Background */}
        <div className="absolute inset-0 opacity-40">
          <img 
            src="https://picsum.photos/seed/cinema/1920/1080?blur=10" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="bg-slate-900/90 backdrop-blur-3xl p-12 rounded-[3rem] border-2 border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-orange-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/30">
                <Tv className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter">D7 PLAYER</h1>
              <p className="text-slate-400 mt-3 text-xl font-medium">Sua TV, do seu jeito.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-8">
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Servidor</label>
                <div className="relative">
                  <MonitorPlay className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
                  <input 
                    type="text"
                    required
                    value={loginForm.server}
                    onChange={e => setLoginForm({...loginForm, server: e.target.value})}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-[1.5rem] py-6 pl-14 pr-6 text-white text-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-700"
                    placeholder="http://exemplo.com:80"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Usuário</label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
                  <input 
                    type="text"
                    required
                    value={loginForm.username}
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-[1.5rem] py-6 pl-14 pr-6 text-white text-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-700"
                    placeholder="Seu usuário"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
                  <input 
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-[1.5rem] py-6 pl-14 pr-6 text-white text-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-700"
                    placeholder="Sua senha"
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-red-500/10 border-2 border-red-500/20 rounded-2xl text-red-400 text-lg font-bold flex items-center gap-4"
                >
                  <Info className="w-6 h-6" />
                  {error}
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-6 bg-orange-500 hover:bg-orange-600 text-white font-black text-2xl rounded-[1.5rem] transition-all shadow-2xl shadow-orange-500/40 active:scale-95 disabled:opacity-50"
              >
                {loading ? "Entrando..." : "ENTRAR AGORA"}
              </button>
            </form>

            <div className="mt-10 pt-10 border-t border-white/5 text-center">
              <p className="text-slate-500 text-base font-medium">
                ID do Dispositivo: <span className="text-orange-500 font-mono font-bold">00:1A:2B:3C:4D:5E</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading Screen (Updating)
  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white z-50 p-6 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[url('https://media.giphy.com/media/oEI9uWUqnW9Fe/giphy.gif')] bg-cover" />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-40 h-40 bg-orange-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-12 shadow-[0_0_80px_rgba(249,115,22,0.3)]">
            <Tv className="w-20 h-20 text-white" />
          </div>
          <h2 className="text-6xl font-black uppercase tracking-tighter mb-6">
            {isParsing ? "Processando Lista" : "Sincronizando"}
          </h2>
          <p className="text-slate-400 text-3xl font-medium italic">
            {isParsing 
              ? "Isso pode levar alguns segundos para listas grandes..." 
              : "\"Estou atualizando seus conteúdos, já continuamos\""}
          </p>
          <div className="mt-16 h-3 w-80 bg-slate-900 rounded-full mx-auto overflow-hidden border border-white/5">
            <motion.div 
              animate={{ x: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="h-full w-1/2 bg-orange-500 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.5)]"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // Main App UI (Netflix Style)
  return (
    <div className={`h-[100dvh] bg-slate-950 text-white font-sans flex ${isMobile ? "flex-col" : "flex-row"} overflow-hidden safe-top safe-bottom`}>
      {/* Sidebar Navigation - Collapsible (Hidden on Mobile/Landscape) */}
      {!isMobile && (
        <div className={`${isSidebarOpen ? "w-24" : "w-0 overflow-hidden"} bg-slate-900 border-r border-white/10 flex flex-col items-center py-8 gap-8 z-40 transition-all duration-300 relative`}>
        <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
          <Tv className="w-8 h-8 text-white" />
        </div>
        <nav className="flex-1 flex flex-col gap-4">
          <button 
            onClick={() => setCurrentView("dashboard")}
            className={`p-5 rounded-2xl transition-all flex flex-col items-center gap-1 ${currentView === "dashboard" ? "bg-orange-500/20 text-orange-500 border border-orange-500/30" : "text-slate-400 hover:bg-white/5"}`}
            title="Início"
          >
            <LayoutGrid className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">Home</span>
          </button>
          <div className="h-px bg-white/5 mx-4" />
          <button 
            onClick={() => { setActiveSection("live"); setActiveTab("all"); setCurrentView("content"); }}
            className={`p-5 rounded-2xl transition-all flex flex-col items-center gap-1 ${activeSection === "live" && currentView === "content" ? "bg-orange-500/20 text-orange-500 border border-orange-500/30" : "text-slate-400 hover:bg-white/5"}`}
            title="Canais ao Vivo"
          >
            <Tv className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">TV</span>
          </button>
          <button 
            onClick={() => { setActiveSection("movies"); setActiveTab("all"); setCurrentView("content"); }}
            className={`p-5 rounded-2xl transition-all flex flex-col items-center gap-1 ${activeSection === "movies" && currentView === "content" ? "bg-orange-500/20 text-orange-500 border border-orange-500/30" : "text-slate-400 hover:bg-white/5"}`}
            title="Filmes"
          >
            <Film className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">Filmes</span>
          </button>
          <button 
            onClick={() => { setActiveSection("series"); setActiveTab("all"); setCurrentView("content"); }}
            className={`p-5 rounded-2xl transition-all flex flex-col items-center gap-1 ${activeSection === "series" && currentView === "content" ? "bg-orange-500/20 text-orange-500 border border-orange-500/30" : "text-slate-400 hover:bg-white/5"}`}
            title="Séries"
          >
            <Clapperboard className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">Séries</span>
          </button>
          <div className="h-px bg-white/5 mx-4" />
          <button 
            onClick={() => { setActiveTab("favorites"); setCurrentView("content"); }}
            className={`p-5 rounded-2xl transition-all flex flex-col items-center gap-1 ${activeTab === "favorites" && currentView === "content" ? "bg-orange-500/20 text-orange-500 border border-orange-500/30" : "text-slate-400 hover:bg-white/5"}`}
            title="Favoritos"
          >
            <List className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">Favs</span>
          </button>
          <button 
            onClick={() => setCurrentView("settings")}
            className={`p-5 rounded-2xl transition-all flex flex-col items-center gap-1 ${currentView === "settings" ? "bg-orange-500/20 text-orange-500 border border-orange-500/30" : "text-slate-400 hover:bg-white/5"}`}
            title="Configurações"
          >
            <Settings className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase">Config</span>
          </button>
        </nav>
        <button 
          onClick={logout}
          className="p-5 rounded-2xl text-slate-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-8 h-8" />
        </button>
      </div>
    )}

      {/* Bottom Navigation for Mobile/Landscape */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 flex justify-around items-center py-3 z-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button 
            onClick={() => setCurrentView("dashboard")}
            className={`flex flex-col items-center gap-1 ${currentView === "dashboard" ? "text-orange-500" : "text-slate-400"}`}
          >
            <LayoutGrid className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Home</span>
          </button>
          <button 
            onClick={() => { setActiveSection("live"); setActiveTab("all"); setCurrentView("content"); }}
            className={`flex flex-col items-center gap-1 ${activeSection === "live" && currentView === "content" ? "text-orange-500" : "text-slate-400"}`}
          >
            <Tv className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">TV</span>
          </button>
          <button 
            onClick={() => { setActiveSection("movies"); setActiveTab("all"); setCurrentView("content"); }}
            className={`flex flex-col items-center gap-1 ${activeSection === "movies" && currentView === "content" ? "text-orange-500" : "text-slate-400"}`}
          >
            <Film className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Filmes</span>
          </button>
          <button 
            onClick={() => { setActiveSection("series"); setActiveTab("all"); setCurrentView("content"); }}
            className={`flex flex-col items-center gap-1 ${activeSection === "series" && currentView === "content" ? "text-orange-500" : "text-slate-400"}`}
          >
            <Clapperboard className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Séries</span>
          </button>
          <button 
            onClick={() => setCurrentView("settings")}
            className={`flex flex-col items-center gap-1 ${currentView === "settings" ? "text-orange-500" : "text-slate-400"}`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Ajustes</span>
          </button>
        </div>
      )}

      <main className={`flex-1 flex flex-col h-full overflow-hidden relative ${isMobile ? "pb-20" : ""}`}>
        {/* Dialing Overlay */}
        <AnimatePresence>
          {isDialing && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setIsDialing(false)}
            >
              <div 
                className="bg-slate-900 border-2 border-orange-500 rounded-[3rem] p-12 text-center space-y-8 shadow-2xl shadow-orange-500/20"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-24 h-24 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Hash className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-black">Digitar Canal</h2>
                <div className="text-7xl font-black text-orange-500 tracking-widest min-h-[80px]">
                  {dialedNumber || "---"}
                </div>
                <p className="text-slate-400">Use o controle ou teclado para digitar</p>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  {[1,2,3,4,5,6,7,8,9,"C",0,"OK"].map(n => (
                    <button
                      key={n}
                      onClick={() => {
                        if (n === "C") setDialedNumber("");
                        else if (n === "OK") jumpToChannel(dialedNumber);
                        else {
                          setDialedNumber(prev => prev + n);
                          if (dialTimeoutRef.current) clearTimeout(dialTimeoutRef.current);
                          dialTimeoutRef.current = setTimeout(() => jumpToChannel(dialedNumber + n), 2000);
                        }
                      }}
                      className="w-20 h-20 bg-white/5 hover:bg-orange-500 rounded-2xl text-2xl font-black transition-all border border-white/10"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Channel Number Edit Modal */}
        <AnimatePresence>
          {editingChannelForNumber && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-6"
              onClick={() => setEditingChannelForNumber(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border-2 border-white/10 rounded-[3rem] p-8 md:p-12 w-full max-w-2xl shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4 text-orange-500">
                    <Hash className="w-10 h-10" />
                    <h2 className="text-3xl font-black">Editar Número</h2>
                  </div>
                  <button 
                    onClick={() => setEditingChannelForNumber(null)}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col items-center gap-6">
                    {editingChannelForNumber.logo ? (
                      <img 
                        src={editingChannelForNumber.logo} 
                        alt="" 
                        className="w-32 h-32 object-contain drop-shadow-2xl"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Tv className="w-32 h-32 text-slate-700" />
                    )}
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-white mb-2">{editingChannelForNumber.name}</h3>
                      <p className="text-orange-500 font-bold uppercase tracking-widest text-sm">{editingChannelForNumber.group}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-slate-400 font-bold uppercase tracking-widest text-sm ml-2">Novo Número do Canal</label>
                    <input 
                      type="number"
                      autoFocus
                      defaultValue={customChannelNumbers[editingChannelForNumber.url] || editingChannelForNumber.number}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (!isNaN(val)) {
                            const next = { ...customChannelNumbers, [editingChannelForNumber.url]: val };
                            setCustomChannelNumbers(next);
                            localStorage.setItem("iptv_custom_numbers", JSON.stringify(next));
                            setChannels(prev => prev.map(ch => ch.url === editingChannelForNumber.url ? { ...ch, number: val } : ch));
                            setEditingChannelForNumber(null);
                          }
                        }
                      }}
                      className="w-full bg-slate-800 border-2 border-white/10 rounded-2xl py-6 px-8 text-4xl font-black text-center text-orange-500 outline-none focus:border-orange-500 transition-all"
                    />
                    <p className="text-slate-500 text-center text-sm">Pressione ENTER para salvar ou clique fora para cancelar.</p>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setEditingChannelForNumber(null)}
                      className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => {
                        const input = document.querySelector('input[type="number"]') as HTMLInputElement;
                        const val = parseInt(input.value);
                        if (!isNaN(val)) {
                          const next = { ...customChannelNumbers, [editingChannelForNumber.url]: val };
                          setCustomChannelNumbers(next);
                          localStorage.setItem("iptv_custom_numbers", JSON.stringify(next));
                          setChannels(prev => prev.map(ch => ch.url === editingChannelForNumber.url ? { ...ch, number: val } : ch));
                          setEditingChannelForNumber(null);
                        }
                      }}
                      className="flex-1 py-5 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20"
                    >
                      Salvar Alteração
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Bar */}
        <header className={`p-4 md:p-8 flex items-center justify-between bg-gradient-to-b from-slate-900 to-transparent ${isMobile ? "py-3" : ""} pt-[calc(1rem+env(safe-area-inset-top))]`}>
          <div className="flex items-center gap-3 md:gap-6">
            {!isMobile && (
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
              >
                <Menu className="w-6 h-6 text-slate-400" />
              </button>
            )}
            <h2 className={`font-black tracking-tight truncate ${isMobile ? "text-xl" : "text-3xl"} max-w-[120px] md:max-w-none`}>D7 Player</h2>
            {!isMobile && (
              <div className="flex items-center gap-3">
                <div className="px-4 py-1.5 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-500/20">
                  Premium
                </div>
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-widest border border-emerald-500/30 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  CONNECTED
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3">
              {/* Desktop Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                <input 
                  type="text"
                  placeholder="O que vamos assistir?"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border-2 border-white/10 rounded-2xl py-4 pl-14 pr-8 w-64 lg:w-96 text-lg outline-none focus:border-orange-500 transition-all placeholder:text-slate-600"
                />
              </div>
              {/* Mobile Search Button */}
              {isMobile && (
                <button 
                  onClick={() => { setCurrentView("content"); setActiveTab("all"); }}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-orange-500 transition-all"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={() => setIsDialing(true)}
                className="p-3 md:p-4 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl border border-white/10 text-slate-400 hover:text-orange-500 transition-all"
                title="Digitar número do canal"
              >
                <Hash className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
            {lowPerformanceMode ? (
              <button 
                onClick={toggleLowPerf}
                className="px-2 py-1 md:px-3 md:py-1 bg-orange-500 text-white text-[8px] md:text-[10px] font-black rounded-lg border border-orange-400 shadow-lg shadow-orange-500/20 flex items-center gap-1 md:gap-2"
              >
                <Zap className="w-2 h-2 md:w-3 md:h-3 fill-current" />
                LITE ON
              </button>
            ) : (
              <button 
                onClick={toggleLowPerf}
                className="px-2 py-1 md:px-3 md:py-1 bg-white/5 text-slate-400 text-[8px] md:text-[10px] font-black rounded-lg border border-white/10 hover:bg-white/10 transition-all flex items-center gap-1 md:gap-2"
              >
                <ZapOff className="w-2 h-2 md:w-3 md:h-3" />
                LITE OFF
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {currentView === "dashboard" ? (
            <div className={`flex-1 ${isMobile ? "p-4" : "p-12"} overflow-y-auto flex flex-col justify-center`}>
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-6xl mx-auto w-full space-y-8 md:space-y-12"
              >
                {/* Hero section for mobile to fill space */}
                {isMobile && (
                  <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-3xl p-8 shadow-2xl shadow-orange-500/20 relative overflow-hidden">
                    <div className="relative z-10">
                      <h1 className="text-3xl font-black mb-2">Bem-vindo!</h1>
                      <p className="text-white/80 font-medium">Escolha uma categoria abaixo para começar a assistir.</p>
                    </div>
                    {/* Reduced opacity and adjusted position to avoid overlap confusion */}
                    <Tv className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5 rotate-12 pointer-events-none" />
                  </div>
                )}

                <div className={`grid ${isMobile && !isLandscape ? "grid-cols-1" : "grid-cols-3"} gap-4 md:gap-6`}>
                  {[
                    { id: "live", title: "Canais", icon: Tv, color: "from-orange-500 to-orange-600" },
                    { id: "movies", title: "Filmes", icon: Film, color: "from-blue-500 to-blue-600" },
                    { id: "series", title: "Séries", icon: Clapperboard, color: "from-purple-500 to-purple-600" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveSection(item.id as any); setCurrentView("content"); }}
                      className={`group relative ${isMobile && !isLandscape ? "h-40" : isMobile && isLandscape ? "aspect-video" : "aspect-[4/5]"} bg-slate-900 rounded-3xl md:rounded-[3.5rem] overflow-hidden border-2 border-white/5 hover:border-orange-500 transition-all shadow-2xl flex ${isMobile && !isLandscape ? "flex-row px-8" : "flex-col"} items-center justify-center gap-4 md:gap-8`}
                    >
                      <div className={`${isMobile ? "w-16 h-16 rounded-2xl" : "w-32 h-32 rounded-[2.5rem]"} bg-gradient-to-br ${item.color} flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500 shrink-0`}>
                        <item.icon className={`${isMobile ? "w-8 h-8" : "w-16 h-16"} text-white`} />
                      </div>
                      <h3 className={`${isMobile ? "text-2xl" : "text-4xl"} font-black tracking-tight`}>{item.title}</h3>
                      <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : currentView === "settings" ? (
            <div className={`flex-1 ${isMobile ? "p-4" : "p-12"} overflow-y-auto`}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-8 md:space-y-12"
              >
                <h2 className={`${isMobile ? "text-3xl" : "text-5xl"} font-black mb-6 md:mb-12`}>Configurações</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-orange-500">
                        <Zap className="w-8 h-8" />
                        <h3 className="text-2xl font-black">Desempenho</h3>
                      </div>
                      <button 
                        onClick={toggleLowPerf}
                        className={`w-16 h-8 rounded-full transition-all relative ${lowPerformanceMode ? "bg-orange-500" : "bg-slate-800"}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${lowPerformanceMode ? "left-9" : "left-1"}`} />
                      </button>
                    </div>
                    <p className="text-slate-400 text-lg">
                      {lowPerformanceMode 
                        ? "Modo leve ativado. Animações e efeitos visuais reduzidos para melhor performance em dispositivos antigos." 
                        : "Modo visual completo ativado. Desative se o app estiver lento."}
                    </p>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <User className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Perfil do Usuário</h3>
                    </div>
                    <div className="space-y-4">
                      <p className="text-slate-400 text-lg">Usuário: <span className="text-white font-bold">{userData?.username}</span></p>
                      <p className="text-slate-400 text-lg">Status: <span className="text-emerald-500 font-bold">Premium Ativo</span></p>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <Hash className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Numeração de Canais</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <p className="text-slate-400 text-lg">Personalize os números dos seus canais favoritos para acesso rápido.</p>
                        <div className="relative w-full md:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            type="text"
                            placeholder="Buscar canal..."
                            className="w-full bg-slate-800 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-orange-500 transition-all"
                            onChange={(e) => {
                              const val = e.target.value.toLowerCase();
                              const list = document.getElementById('numbering-list');
                              if (list) {
                                const items = list.getElementsByClassName('numbering-item');
                                for (let i = 0; i < items.length; i++) {
                                  const item = items[i] as HTMLElement;
                                  const name = item.getAttribute('data-name')?.toLowerCase() || "";
                                  item.style.display = name.includes(val) ? "flex" : "none";
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                      
                      <div id="numbering-list" className="max-h-80 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {channels
                          .filter(c => {
                            if (c.category !== "live") return false;
                            const n = (c.name + " " + c.group).toUpperCase();
                            // Filter out adult content
                            if (n.includes("+18") || n.includes("XXX") || n.includes("ADULTO") || 
                                n.includes("SEX") || n.includes("HOT") || n.includes("PORNO") || 
                                n.includes("PRIVE") || n.includes("PLAYBOY") || n.includes("VENUS") || 
                                n.includes("SEXY")) return false;
                            return true;
                          })
                          .map(c => (
                            <div 
                              key={c.url} 
                              data-name={c.name}
                              title={c.name}
                              className="numbering-item group flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                              onClick={() => setEditingChannelForNumber(c)}
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-orange-500 font-black shrink-0">
                                  {customChannelNumbers[c.url] || c.number}
                                </div>
                                <span className="truncate font-medium text-slate-200 group-hover:whitespace-normal group-hover:overflow-visible">{c.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-500 ml-4">
                                <span className="text-[10px] font-bold uppercase">Editar</span>
                                <ChevronRight className="w-4 h-4" />
                              </div>
                            </div>
                          ))}
                      </div>
                      <p className="text-xs text-slate-500 text-center pt-2 italic">
                        Canais adultos (+18) foram ocultados desta lista por segurança.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <MonitorPlay className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Informações do Dispositivo</h3>
                    </div>
                    <div className="space-y-4">
                      <p className="text-slate-400 text-lg">MAC Address: <span className="text-white font-mono font-bold">00:1A:2B:3C:4D:5E</span></p>
                      <p className="text-slate-400 text-lg">Status de Ativação: <span className="text-orange-500 font-bold">DISPOSITIVO VINCULADO</span></p>
                      <p className="text-slate-400 text-lg">Versão do App: <span className="text-white font-bold">v2.1.0-PRO</span></p>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <LayoutGrid className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Estilo de Layout</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <button 
                        onClick={() => { setLayoutType("modern"); localStorage.setItem("iptv_layout", "modern"); }}
                        className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${layoutType === "modern" ? "border-orange-500 bg-orange-500/10 text-white" : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20"}`}
                      >
                        <LayoutGrid className="w-8 h-8" />
                        <span className="font-bold">Moderno</span>
                        {layoutType === "modern" && <Check className="w-5 h-5 text-orange-500" />}
                      </button>
                      <button 
                        onClick={() => { setLayoutType("classic"); localStorage.setItem("iptv_layout", "classic"); }}
                        className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${layoutType === "classic" ? "border-orange-500 bg-orange-500/10 text-white" : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20"}`}
                      >
                        <List className="w-8 h-8" />
                        <span className="font-bold">Clássico</span>
                        {layoutType === "classic" && <Check className="w-5 h-5 text-orange-500" />}
                      </button>
                      <button 
                        onClick={() => { setLayoutType("iptv"); localStorage.setItem("iptv_layout", "iptv"); }}
                        className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${layoutType === "iptv" ? "border-orange-500 bg-orange-500/10 text-white" : "border-white/5 bg-white/5 text-slate-400 hover:border-white/20"}`}
                      >
                        <Tv className="w-8 h-8" />
                        <span className="font-bold">IPTV</span>
                        {layoutType === "iptv" && <Check className="w-5 h-5 text-orange-500" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <RefreshCw className={`w-8 h-8 ${isAiOptimizing ? "animate-spin" : ""}`} />
                      <h3 className="text-2xl font-bold">Otimização Inteligente (IA)</h3>
                    </div>
                    <p className="text-slate-400">Nossa IA analisa sua lista para organizar filmes, séries e canais corretamente.</p>
                    <button 
                      onClick={optimizeWithAi}
                      disabled={isAiOptimizing || channels.length === 0}
                      className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-orange-500/20"
                    >
                      {isAiOptimizing ? "Otimizando..." : "Iniciar Otimização IA"}
                    </button>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <Play className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Motor de Reprodução</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { id: "hls", name: "HLS.js (Padrão)", desc: "Melhor para m3u8" },
                        { id: "native", name: "Nativo (Direto)", desc: "Para links .ts ou .mp4" },
                        { id: "proxy", name: "Proxy (Seguro)", desc: "Resolve erro de reprodução HTTP" }
                      ].map(engine => (
                        <button
                          key={engine.id}
                          onClick={() => setPlayerEngine(engine.id as any)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${playerEngine === engine.id ? "border-orange-500 bg-orange-500/10" : "border-white/5 hover:border-white/10"}`}
                        >
                          <p className="font-bold">{engine.name}</p>
                          <p className="text-xs text-slate-500">{engine.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5">
                  <h3 className="text-2xl font-bold mb-6 flex items-center gap-4">
                    <RefreshCw className="w-8 h-8 text-orange-500" />
                    Manutenção
                  </h3>
                  <button 
                    onClick={() => fetchChannels(userData?.m3uUrl || "")}
                    className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xl font-bold transition-all border border-white/10"
                  >
                    Sincronizar Lista Manualmente
                  </button>
                </div>
              </motion.div>
            </div>
          ) : layoutType === "iptv" ? (
            <div className="flex-1 flex flex-col bg-[#001b35] relative overflow-hidden">
              {/* Background Glows */}
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full pointer-events-none" />
              
              {/* IPTV Top Bar */}
              <div className={`${isMobile ? "h-20 px-4" : "h-28 px-12"} border-b border-white/10 grid grid-cols-3 items-center z-10 bg-slate-950/40 backdrop-blur-md pt-[env(safe-area-inset-top)]`}>
                <div className="flex flex-col">
                  <span className={`${isMobile ? "text-xl" : "text-4xl"} font-black tracking-tighter`}>
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`${isMobile ? "text-[10px]" : "text-sm"} text-slate-400 font-bold capitalize`}>
                    {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-2 text-blue-400 font-black uppercase tracking-widest text-[10px] md:text-sm mb-1">
                    <span>{activeSection === "live" ? "Canais" : activeSection === "movies" ? "Filmes" : "Séries"}</span>
                    <span className="text-white/30">/</span>
                    <span className="text-white">{selectedGroup}</span>
                  </div>
                  <h3 className={`${isMobile ? "text-lg" : "text-3xl"} font-black uppercase tracking-tighter text-white truncate max-w-[200px] md:max-w-md`}>
                    {selectedGroup}
                  </h3>
                </div>

                <div className="flex items-center justify-end gap-2 md:gap-10">
                  <div className="flex items-center gap-2 md:gap-4">
                    <button className="p-2 md:p-3 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group">
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-[10px] md:text-xs font-black group-hover:text-blue-400">A</span>
                        <div className="h-[1px] md:h-[2px] w-3 md:w-4 bg-white/20 my-0.5 md:my-1" />
                        <span className="text-[10px] md:text-xs font-black group-hover:text-blue-400">Z</span>
                      </div>
                    </button>
                    <button className="p-2 md:p-4 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5">
                      <Search className={`${isMobile ? "w-5 h-5" : "w-8 h-8"} text-slate-300`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* IPTV Main Content */}
              <div className={`flex-1 flex overflow-hidden ${isMobile ? "flex-col" : "flex-row"}`}>
                {/* Left Sidebar - Categories */}
                <div className={`${isMobile ? "h-16 w-full shrink-0" : "w-[450px]"} border-r border-white/10 overflow-y-auto custom-scrollbar bg-slate-950/60`}>
                  <div className={`${isMobile ? "flex flex-row overflow-x-auto h-full items-center px-2" : "flex flex-col"}`}>
                    {groups.map((group, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedGroup(group)}
                        className={`${isMobile ? "px-4 py-2 h-10 whitespace-nowrap border rounded-full mx-1" : "w-full p-8 text-left border-b"} transition-all border-white/5 flex items-center justify-between group relative ${
                          selectedGroup === group 
                          ? "bg-blue-600/20 border-blue-500/50" 
                          : "hover:bg-white/5 border-transparent"
                        }`}
                      >
                        {selectedGroup === group && !isMobile && (
                          <motion.div 
                            layoutId="active-bar"
                            className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                          />
                        )}
                        <span className={`${isMobile ? "text-xs" : "text-2xl"} font-black uppercase tracking-tight transition-colors ${selectedGroup === group ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>
                          {isMobile ? group : `CANAIS | ${group}`}
                        </span>
                        {!isMobile && (
                          <span className={`text-lg font-black ${selectedGroup === group ? "text-blue-400" : "text-slate-700"}`}>
                            ({getGroupCount(group)})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Grid - Channels */}
                <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar bg-black/20">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
                    {filteredChannels
                      .slice(0, visibleCount)
                      .map((channel, idx) => (
                        <motion.button
                          key={idx}
                          whileHover={lowPerformanceMode ? {} : { scale: 1.03, y: -5 }}
                          whileTap={lowPerformanceMode ? {} : { scale: 0.97 }}
                          onClick={() => setSelectedChannel(channel)}
                          className={`group relative flex flex-col bg-slate-900/40 border-2 rounded-2xl overflow-hidden transition-all ${
                            selectedChannel?.url === channel.url 
                            ? "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]" 
                            : "border-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="aspect-square bg-slate-950/80 flex items-center justify-center p-4 md:p-6 relative">
                            {channel.number && (
                              <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black text-orange-500 border border-white/10 z-10">
                                #{channel.number}
                              </div>
                            )}
                            {channel.logo ? (
                              <img 
                                src={channel.logo} 
                                alt="" 
                                className="w-full h-full object-contain drop-shadow-2xl" 
                                referrerPolicy="no-referrer" 
                                loading="lazy"
                              />
                            ) : (
                              <Tv className="w-12 md:w-16 h-12 md:h-16 text-slate-800" />
                            )}
                            {!lowPerformanceMode && <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </div>
                          <div className="p-3 md:p-4 bg-slate-900/90 border-t border-white/5 flex flex-col items-center justify-center min-h-[60px] md:min-h-[80px]">
                            <p className="text-xs md:text-sm font-black text-center uppercase tracking-tighter leading-tight line-clamp-2">{channel.name}</p>
                            <p className="text-[8px] md:text-[10px] text-blue-400 font-black mt-1 opacity-60">FULL HD</p>
                          </div>
                          
                          {/* Play Icon on Hover */}
                          {!lowPerformanceMode && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/20 backdrop-blur-[2px]">
                              <div className="w-12 md:w-16 h-12 md:h-16 bg-white rounded-full flex items-center justify-center shadow-2xl">
                                <Play className="w-6 md:w-8 h-6 md:h-8 text-blue-600 fill-blue-600 ml-1" />
                              </div>
                            </div>
                          )}

                          {favorites.includes(channel.url) && (
                            <div className="absolute top-3 right-3 p-1.5 bg-orange-500 rounded-lg shadow-lg">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </motion.button>
                      ))}
                  </div>
                  
                  {visibleCount < filteredChannels.length && (
                    <div className="mt-12 flex justify-center">
                      <button 
                        onClick={() => setVisibleCount(prev => prev + 100)}
                        className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-4"
                      >
                        <RefreshCw className="w-6 h-6" />
                        Carregar Mais Canais ({filteredChannels.length - visibleCount} restantes)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* IPTV Fullscreen Player Overlay */}
              <AnimatePresence>
                {selectedChannel && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black flex flex-col"
                  >
                    <div className="absolute top-0 left-0 right-0 p-8 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10 opacity-0 hover:opacity-100 transition-opacity duration-500">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => setSelectedChannel(null)}
                          className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl backdrop-blur-xl transition-all border border-white/10"
                        >
                          <ChevronLeft className="w-8 h-8" />
                        </button>
                        <div>
                          <h3 className="text-3xl font-black">
                            {selectedChannel.number && <span className="text-orange-500 mr-3">#{selectedChannel.number}</span>}
                            {selectedChannel.name}
                          </h3>
                          <p className="text-blue-400 font-bold uppercase tracking-widest">{selectedChannel.group}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleFavorite(selectedChannel.url)}
                          className={`p-4 rounded-2xl border border-white/10 backdrop-blur-xl transition-all ${favorites.includes(selectedChannel.url) ? "bg-orange-500 text-white" : "bg-white/10 text-white"}`}
                        >
                          <List className="w-8 h-8" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 relative">
                      <video 
                        ref={videoRef}
                        className="w-full h-full object-contain"
                        autoPlay
                        controls
                        playsInline
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : layoutType === "classic" ? (
            <div className="flex-1 flex overflow-hidden">
              {/* XCIptv Classic 3-Column Layout */}
              <div className="w-72 bg-slate-900/80 border-r border-white/10 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h3 className="text-xl font-black uppercase tracking-widest text-orange-500">Categorias</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                  {groups.map((group, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedGroup(group)}
                      className={`w-full p-4 rounded-xl text-left font-bold transition-all flex items-center justify-between ${
                        selectedGroup === group 
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                        : "text-slate-400 hover:bg-white/5"
                      }`}
                    >
                      <span className="truncate">{group}</span>
                      <span className={`text-[10px] px-2 py-1 rounded-md ${selectedGroup === group ? "bg-white/20" : "bg-white/5"}`}>
                        {getGroupCount(group)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-96 bg-slate-950/50 border-r border-white/10 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <h3 className="text-xl font-black uppercase tracking-widest text-orange-500">Canais</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                  {filteredChannels
                    .slice(0, visibleCount)
                    .map((channel, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedChannel(channel)}
                        className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-4 border-2 ${
                          selectedChannel?.url === channel.url 
                          ? "bg-orange-500/10 border-orange-500 text-white" 
                          : "bg-slate-900/50 border-transparent text-slate-400 hover:border-white/10"
                        }`}
                      >
                        <div className="w-12 h-12 bg-black/40 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {channel.logo ? (
                            <img src={channel.logo} alt="" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                          ) : (
                            <Tv className="w-6 h-6 opacity-40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate text-lg">{channel.name}</p>
                        </div>
                        {favorites.includes(channel.url) && <List className="w-4 h-4 fill-current text-orange-500" />}
                      </button>
                    ))}
                  
                  {visibleCount < filteredChannels.length && (
                    <button 
                      onClick={() => setVisibleCount(prev => prev + 100)}
                      className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all border border-white/5 text-slate-400"
                    >
                      Carregar Mais ({filteredChannels.length - visibleCount})
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                <div className="flex-1 p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                  <section className="relative aspect-video bg-black rounded-[2.5rem] overflow-hidden border-4 border-white/5 shadow-2xl group">
                    {selectedChannel ? (
                      <video 
                        ref={videoRef}
                        className="w-full h-full object-contain"
                        controls
                        playsInline
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                        <MonitorPlay className="w-32 h-32 mb-6 opacity-20" />
                        <p className="text-2xl font-bold">Selecione um canal</p>
                      </div>
                    )}
                  </section>

                  {selectedChannel && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-4xl font-black">{selectedChannel.name}</h2>
                          <p className="text-orange-500 font-bold uppercase tracking-widest mt-2">{selectedChannel.group}</p>
                        </div>
                        <button 
                          onClick={() => toggleFavorite(selectedChannel.url)}
                          className={`p-6 rounded-full border-2 transition-all ${favorites.includes(selectedChannel.url) ? "bg-orange-500 border-orange-400 text-white" : "bg-white/5 border-white/10 text-white hover:border-orange-500"}`}
                        >
                          <List className={`w-8 h-8 ${favorites.includes(selectedChannel.url) ? "fill-white" : ""}`} />
                        </button>
                      </div>
                      <div className="h-px bg-white/5" />
                      <div className="grid grid-cols-3 gap-6">
                        <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                          <p className="text-slate-500 text-sm font-bold uppercase mb-2">Qualidade</p>
                          <p className="text-xl font-bold">Full HD / 4K</p>
                        </div>
                        <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                          <p className="text-slate-500 text-sm font-bold uppercase mb-2">Status</p>
                          <p className="text-xl font-bold text-emerald-500">Online</p>
                        </div>
                        <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                          <p className="text-slate-500 text-sm font-bold uppercase mb-2">Idioma</p>
                          <p className="text-xl font-bold">Português (BR)</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-[3] p-8 space-y-10 overflow-y-auto custom-scrollbar">
              {/* Featured / Player */}
              <section className="relative aspect-video bg-black rounded-[3rem] overflow-hidden border-4 border-white/5 shadow-2xl group">
                {selectedChannel ? (
                  <video 
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                    <MonitorPlay className="w-32 h-32 mb-6 opacity-20" />
                    <p className="text-2xl font-bold">Selecione um canal para reproduzir</p>
                  </div>
                )}
                
                {selectedChannel && (
                  <div className="absolute top-8 left-8 right-8 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/80 backdrop-blur-2xl p-6 rounded-3xl border-2 border-orange-500/30">
                      <h3 className="text-2xl font-black text-white">{selectedChannel.name}</h3>
                      <p className="text-sm text-orange-400 font-black uppercase tracking-widest mt-1">{selectedChannel.group}</p>
                    </div>
                    <button 
                      onClick={() => toggleFavorite(selectedChannel.url)}
                      className={`p-6 rounded-full backdrop-blur-2xl border-2 transition-all ${favorites.includes(selectedChannel.url) ? "bg-orange-500 border-orange-400 text-white" : "bg-black/80 border-white/10 text-white hover:border-orange-500"}`}
                    >
                      <List className={`w-8 h-8 ${favorites.includes(selectedChannel.url) ? "fill-white" : ""}`} />
                    </button>
                  </div>
                )}
              </section>

              {/* Channel Grid (Netflix Style) */}
              <section className="space-y-8">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-3xl font-black text-white">
                      {activeTab === "favorites" ? "Meus Favoritos" : activeSection === "live" ? "Canais ao Vivo" : activeSection === "movies" ? "Filmes" : "Séries"}
                    </h3>
                  </div>
                  
                  {/* Categories Row */}
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-h">
                    {groups.map((group, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedGroup(group)}
                        className={`px-8 py-4 rounded-2xl text-lg font-black whitespace-nowrap transition-all border-2 flex items-center gap-3 ${
                          selectedGroup === group 
                          ? "bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20" 
                          : "bg-slate-900 border-white/5 text-slate-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        {group}
                        <span className={`text-xs px-2 py-1 rounded-lg ${selectedGroup === group ? "bg-white/20 text-white" : "bg-white/5 text-slate-500"}`}>
                          {getGroupCount(group)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {layoutType === "modern" ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8">
                    {filteredChannels
                      .slice(0, visibleCount)
                      .map((channel, idx) => (
                        <motion.button
                          key={idx}
                          whileHover={lowPerformanceMode ? {} : { scale: 1.05, y: -8 }}
                          onClick={() => setSelectedChannel(channel)}
                          className={`relative aspect-[3/4] rounded-2xl md:rounded-[2rem] overflow-hidden border-2 md:border-4 transition-all ${
                            selectedChannel?.url === channel.url 
                            ? "border-orange-500 shadow-2xl shadow-orange-500/40" 
                            : "border-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                            {channel.logo ? (
                              <img 
                                src={channel.logo} 
                                alt="" 
                                className="w-full h-full object-contain p-4 md:p-6" 
                                referrerPolicy="no-referrer" 
                                loading="lazy"
                              />
                            ) : (
                              <Tv className="w-12 md:w-16 h-12 md:h-16 text-slate-800" />
                            )}
                          </div>
                          {!lowPerformanceMode && <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />}
                          
                          {/* Favorite Badge */}
                          {favorites.includes(channel.url) && (
                            <div className="absolute top-2 md:top-4 right-2 md:right-4 p-1.5 md:p-2 bg-orange-500 rounded-full shadow-lg">
                              <List className="w-3 md:w-4 h-3 md:h-4 text-white fill-white" />
                            </div>
                          )}

                          <div className="absolute bottom-3 md:bottom-6 left-3 md:left-6 right-3 md:right-6">
                            <p className="text-sm md:text-lg font-black truncate text-white leading-tight">{channel.name}</p>
                            <p className="text-[10px] md:text-xs text-orange-400 uppercase font-black truncate mt-1 tracking-wider">{channel.group}</p>
                          </div>
                        </motion.button>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredChannels
                      .slice(0, visibleCount)
                      .map((channel, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedChannel(channel)}
                          className={`flex items-center gap-4 md:gap-6 p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all ${
                            selectedChannel?.url === channel.url 
                            ? "bg-orange-500 border-orange-400 text-white" 
                            : "bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800 hover:border-white/10"
                          }`}
                        >
                          <div className="w-12 h-12 md:w-16 md:h-16 bg-black/40 rounded-lg md:rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                            {channel.logo ? (
                              <img 
                                src={channel.logo} 
                                alt="" 
                                className="w-full h-full object-contain p-1 md:p-2" 
                                referrerPolicy="no-referrer" 
                                loading="lazy"
                              />
                            ) : (
                              <Tv className="w-6 md:w-8 h-6 md:h-8 opacity-40" />
                            )}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <h4 className="text-base md:text-xl font-black truncate">{channel.name}</h4>
                            <p className={`text-[10px] md:text-sm font-bold uppercase tracking-widest truncate ${selectedChannel?.url === channel.url ? "text-white/60" : "text-orange-500"}`}>{channel.group}</p>
                          </div>
                          {favorites.includes(channel.url) && <List className="w-4 md:w-5 h-4 md:h-5 fill-current" />}
                          <ChevronRight className="w-5 md:w-6 h-5 md:h-6 opacity-40" />
                        </button>
                      ))}
                  </div>
                )}

                {visibleCount < filteredChannels.length && (
                  <div className="flex justify-center pb-12">
                    <button 
                      onClick={() => setVisibleCount(prev => prev + 100)}
                      className="px-12 py-5 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-500/20 flex items-center gap-4"
                    >
                      <RefreshCw className="w-6 h-6" />
                      Carregar Mais ({filteredChannels.length - visibleCount} restantes)
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>


      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar-h::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar-h::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-h::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>
      <AnimatePresence>
        {isAiOptimizing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="max-w-md w-full bg-slate-900 border-2 border-orange-500/30 rounded-[3rem] p-10 shadow-2xl">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-24 h-24 bg-orange-500 rounded-3xl flex items-center justify-center animate-pulse shadow-2xl shadow-orange-500/40">
                  <RefreshCw className="w-12 h-12 text-white animate-spin" />
                </div>
                <h3 className="text-3xl font-black uppercase tracking-tighter">Otimizador IA</h3>
                <div className="w-full space-y-3 text-left bg-black/40 p-6 rounded-2xl border border-white/5 font-mono text-sm">
                  {aiLog.map((log, i) => (
                    <motion.p 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={i} 
                      className={i === aiLog.length - 1 ? "text-orange-500" : "text-slate-500"}
                    >
                      <span className="text-orange-500/50 mr-2">›</span> {log}
                    </motion.p>
                  ))}
                </div>
                <p className="text-slate-400 text-sm italic">"Organizando sua diversão, aguarde um instante..."</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
