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
  X,
  Zap,
  ZapOff,
  Hash,
  Keyboard,
  Mic,
  MicOff,
  Maximize,
  Minimize
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"pc" | "android">(() => {
    return (localStorage.getItem("iptv_device_mode") as "pc" | "android") || "pc";
  });
  const [lowPerformanceMode, setLowPerformanceMode] = useState(false);
  const [dialedNumber, setDialedNumber] = useState("");
  const [customChannelNumbers, setCustomChannelNumbers] = useState<Record<string, number>>({});
  const [isDialing, setIsDialing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenOverlay, setShowFullscreenOverlay] = useState(false);
  const [editingChannelForNumber, setEditingChannelForNumber] = useState<Channel | null>(null);
  const dialTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript.toLowerCase();
      console.log("Voz reconhecida:", speechToText);
      
      const numberMap: Record<string, string> = {
        "um": "1", "dois": "2", "três": "3", "quatro": "4", "cinco": "5",
        "seis": "6", "sete": "7", "oito": "8", "nove": "9", "dez": "10"
      };

      let num = "";
      const numberMatch = speechToText.match(/\d+/);
      
      if (numberMatch) {
        num = numberMatch[0];
      } else {
        // Check for spoken words
        for (const [word, digit] of Object.entries(numberMap)) {
          if (speechToText.includes(word)) {
            num = digit;
            break;
          }
        }
      }

      if (num) {
        jumpToChannel(num);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Erro no reconhecimento de voz:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    // Check if we should show the overlay (only if not already in fullscreen and not in standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (!document.fullscreenElement && !isStandalone) {
      setShowFullscreenOverlay(true);
    }

    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.toLowerCase() === "v") {
        startVoiceRecognition();
        return;
      }

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

  useEffect(() => {
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
    };
  }, []);

  // TV Box: Scroll focused navigation buttons into view
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('nav')) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    };
    window.addEventListener('focusin', handleFocus);
    return () => window.removeEventListener('focusin', handleFocus);
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
      if (group.includes("24/7") || name.includes("24/7") || group.includes("KIDS")) {
        if (!name.match(/S\d+E\d+/)) return "live";
      }
      return "series";
    }
    
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
      if (group.includes("24/7") || name.includes("24/7")) {
        return "live";
      }
      return "movies";
    }
    
    return "live";
  };

  const { groups, groupCounts } = React.useMemo(() => {
    const sectionChannels = channels.filter(c => c.category === activeSection);
    const counts: Record<string, number> = { "Todos": sectionChannels.length };
    const groupSet = new Set<string>();
    
    for (const c of channels) {
      if (c.category === activeSection) {
        groupSet.add(c.group);
        counts[c.group] = (counts[c.group] || 0) + 1;
      }
    }
    
    return {
      groups: ["Todos", ...Array.from(groupSet).sort()],
      groupCounts: counts
    };
  }, [channels, activeSection]);

  const getGroupCount = React.useCallback((group: string) => {
    return groupCounts[group] || 0;
  }, [groupCounts]);

  const filteredChannels = React.useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!channels.length) return [];
    
    return channels.filter(c => {
      if (c.category !== activeSection) return false;
      if (activeTab === "favorites" && !favorites.includes(c.url)) return false;
      // Se houver busca, ignorar o filtro de grupo para encontrar em qualquer lugar da categoria
      if (query === "" && selectedGroup !== "Todos" && c.group !== selectedGroup) return false;
      if (query !== "" && !c.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [channels, activeSection, searchQuery, selectedGroup, activeTab, favorites]);

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

  const enterDemoMode = () => {
    setLoading(true);
    const demoUser: UserData = {
      name: "Usuário Demo",
      server: "demo.server.com",
      username: "demo",
      m3uUrl: "demo"
    };
    
    // Mock channels for layout testing
    const mockChannels: Channel[] = [];
    
    // Live Channels
    for (let i = 1; i <= 50; i++) {
      mockChannels.push({
        name: `Canal Demo ${i}`,
        url: `demo-live-${i}`,
        group: i <= 25 ? "ESPORTES" : "NOTÍCIAS",
        category: "live",
        number: i,
        logo: `https://picsum.photos/seed/live-${i}/200/200`
      });
    }
    
    // Movies
    for (let i = 1; i <= 30; i++) {
      mockChannels.push({
        name: `Filme Demo ${i}`,
        url: `demo-movie-${i}`,
        group: i <= 15 ? "AÇÃO" : "COMÉDIA",
        category: "movies",
        logo: `https://picsum.photos/seed/movie-${i}/300/450`
      });
    }
    
    // Series
    for (let i = 1; i <= 20; i++) {
      mockChannels.push({
        name: `Série Demo ${i}`,
        url: `demo-series-${i}`,
        group: "SÉRIES ORIGINAIS",
        category: "series",
        logo: `https://picsum.photos/seed/series-${i}/300/450`
      });
    }

    setTimeout(() => {
      setChannels(mockChannels);
      setUserData(demoUser);
      setIsLoggedIn(true);
      setLoading(false);
    }, 1000);
  };

  const fetchChannels = React.useCallback(async (url: string) => {
    if (isParsing || url === "demo") return;
    setLoading(true);
    setError(null);
    try {
      const isBlob = url.startsWith('blob:');
      const fetchUrl = isBlob ? url : `/api/proxy-m3u?url=${encodeURIComponent(url)}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`Erro do servidor: ${response.status}`);
      
      const text = await response.text();
      if (!text || text.length < 10) throw new Error("Lista vazia ou inválida.");
      
      setIsParsing(true);
      setTimeout(() => {
        try {
          const parsed = parseM3U(text);
          setChannels(parsed);
          
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
        channel.category = categorizeChannel(channel);
        
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
      
      if (playerEngine === "proxy" || (window.location.protocol === "https:" && streamUrl.startsWith("http:"))) {
        streamUrl = `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

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
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                hlsRef.current = null;
                video.src = streamUrl;
                video.play().catch(e => console.error("Native fallback error:", e));
                break;
            }
          }
        });
      } else {
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

      const optimizedChannels = channels.map(channel => {
        let newCategory = channel.category;
        let newGroup = channel.group;

        if (result.groupFixes && result.groupFixes[channel.group]) {
          newGroup = result.groupFixes[channel.group];
        }

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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
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

              <div className="pt-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-px bg-white/10 flex-1" />
                  <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Ou use para testes</span>
                  <div className="h-px bg-white/10 flex-1" />
                </div>
                
                <button 
                  type="button"
                  onClick={enterDemoMode}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-orange-500 font-bold text-lg rounded-[1.5rem] transition-all border border-white/10 flex items-center justify-center gap-3 group"
                >
                  <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                  MODO DEMO (TESTAR LAYOUT)
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white z-50 p-6 overflow-hidden">
        {/* Animated Background Layers */}
        <div className="absolute inset-0 z-0 opacity-10">
          <img 
            src="https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueXp4bmZ6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z/3o7TKMGpxx6fGfXfG/giphy.gif" 
            className="w-full h-full object-cover grayscale"
            alt=""
          />
        </div>

        {/* Animated Geometric Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * 100 + "%", 
                y: Math.random() * 100 + "%",
                rotate: 0,
                opacity: 0.1
              }}
              animate={{ 
                x: [null, Math.random() * 100 + "%"],
                y: [null, Math.random() * 100 + "%"],
                rotate: [0, 360],
                opacity: [0.1, 0.3, 0.1]
              }}
              transition={{ 
                duration: 15 + Math.random() * 20, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="absolute w-40 h-40 border-2 border-orange-500/20 rounded-3xl"
              style={{
                borderRadius: i % 2 === 0 ? "30% 70% 70% 30% / 30% 30% 70% 70%" : "50%",
              }}
            />
          ))}
        </div>

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center relative z-20"
        >
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, 1, -1, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-40 h-40 bg-orange-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-12 shadow-[0_0_80px_rgba(249,115,22,0.4)]"
          >
            <Tv className="w-20 h-20 text-white" />
          </motion.div>
          <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-6 text-shadow-xl">
            {isParsing ? "Processando Lista" : "Sincronizando"}
          </h2>
          <p className="text-slate-400 text-xl md:text-3xl font-medium italic">
            {isParsing 
              ? "Isso pode levar alguns segundos para listas grandes..." 
              : "\"Estou atualizando seus conteúdos, já continuamos\""}
          </p>
          <div className="mt-16 h-4 w-80 bg-slate-900 rounded-full mx-auto overflow-hidden border border-white/10 shadow-inner">
            <motion.div 
              animate={{ x: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="h-full w-1/2 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.6)]"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col overflow-hidden">
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
              />
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={`fixed left-0 top-0 bottom-0 ${deviceMode === "android" ? "w-72 md:w-96" : "w-64 md:w-80"} bg-slate-900 border-r border-white/10 z-[101] shadow-2xl flex flex-col`}
              >
                <div className="p-8 flex items-center justify-between border-b border-white/5">
                  <h2 className={`text-2xl font-black text-orange-500 ${deviceMode === "android" ? "text-3xl" : ""}`}>D7 PLAYER</h2>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
                  <button 
                    onClick={() => { setCurrentView("dashboard"); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${currentView === "dashboard" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    <LayoutGrid className="w-6 h-6" />
                    <span>HOME</span>
                  </button>
                  <div className="h-px bg-white/5 my-4" />
                  <button 
                    onClick={() => { setActiveSection("live"); setActiveTab("all"); setCurrentView("content"); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${activeSection === "live" && currentView === "content" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    <Tv className="w-6 h-6" />
                    <span>TV AO VIVO</span>
                  </button>
                  <button 
                    onClick={() => { setActiveSection("movies"); setActiveTab("all"); setCurrentView("content"); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${activeSection === "movies" && currentView === "content" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    <Film className="w-6 h-6" />
                    <span>FILMES</span>
                  </button>
                  <button 
                    onClick={() => { setActiveSection("series"); setActiveTab("all"); setCurrentView("content"); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${activeSection === "series" && currentView === "content" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    <Clapperboard className="w-6 h-6" />
                    <span>SÉRIES</span>
                  </button>
                  <div className="h-px bg-white/5 my-4" />
                  <button 
                    onClick={() => { setActiveTab("favorites"); setCurrentView("content"); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${activeTab === "favorites" && currentView === "content" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    <List className="w-6 h-6" />
                    <span>FAVORITOS</span>
                  </button>
                  <button 
                    onClick={() => { setCurrentView("settings"); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all font-bold ${currentView === "settings" ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-400 hover:bg-white/5"}`}
                  >
                    <Settings className="w-6 h-6" />
                    <span>CONFIGURAÇÕES</span>
                  </button>
                </nav>
                <div className="p-6 border-t border-white/5">
                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-all font-bold"
                  >
                    <LogOut className="w-6 h-6" />
                    <span>SAIR DA CONTA</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}

          {isListening && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md"
            >
              <div className="text-center space-y-12">
                <div className="relative">
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-orange-500 rounded-full blur-3xl"
                  />
                  <div className="relative w-48 h-48 bg-orange-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_100px_rgba(249,115,22,0.5)]">
                    <Mic className="w-24 h-24 text-white animate-pulse" />
                  </div>
                </div>
                <div>
                  <h2 className="text-6xl font-black uppercase tracking-tighter mb-4">Ouvindo...</h2>
                  <p className="text-slate-400 text-2xl font-medium italic">"Fale o número do canal que deseja assistir"</p>
                </div>
                <button 
                  onClick={() => setIsListening(false)}
                  className="px-12 py-6 bg-white/10 hover:bg-white/20 rounded-full text-xl font-black uppercase tracking-widest border border-white/10 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}

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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="p-4 md:p-8 flex items-center justify-between bg-gradient-to-b from-slate-900 to-transparent">
          <div className="flex items-center gap-4 md:gap-6">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
            >
              <Menu className="w-6 h-6 text-slate-400" />
            </button>
            <h2 className="text-xl md:text-3xl font-black tracking-tight truncate max-w-[150px] md:max-w-none">D7 Player</h2>
            <div className="flex items-center gap-3">
              <div className="px-4 py-1.5 rounded-full bg-orange-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-orange-500/20">
                Premium
              </div>
              <div className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-widest border border-emerald-500/30 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                CONNECTED
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-6 flex-1 justify-end">
            <div className="relative flex-1 md:flex-none max-w-xs md:max-w-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input 
                ref={searchInputRef}
                type="text"
                placeholder="O que vamos assistir?"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-900 border-2 border-white/10 rounded-xl py-3 pl-12 pr-4 w-full md:w-64 lg:w-96 text-base outline-none focus:border-orange-500 transition-all placeholder:text-slate-600"
              />
            </div>
            <button 
              onClick={() => setIsDialing(true)}
              className="p-3 md:p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-orange-500 transition-all"
            >
              <Hash className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center">
              <button 
                onClick={toggleFullscreen}
                className="p-3 md:p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-orange-500 transition-all"
                title="Tela Cheia"
              >
                {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </button>
              <span className="text-[8px] uppercase font-black text-slate-600 mt-1 hidden md:block">Tela</span>
            </div>
            <div className="flex flex-col items-center">
              <button 
                onClick={startVoiceRecognition}
                className={`p-3 md:p-4 rounded-xl border transition-all ${isListening ? "bg-orange-500 text-white border-orange-400 animate-pulse" : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-orange-500"}`}
                title="Comando de Voz (Atalho: V)"
              >
                <Mic className="w-6 h-6" />
              </button>
              <span className="text-[8px] uppercase font-black text-slate-600 mt-1 hidden md:block">Voz</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {currentView === "dashboard" ? (
            <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto h-full flex flex-col justify-center"
              >
                <div className="grid grid-cols-3 gap-4 md:gap-12">
                  {[
                    { id: "live", title: "TV", icon: Tv, color: "from-orange-500 to-orange-600", action: () => { setActiveSection("live"); setCurrentView("content"); } },
                    { id: "movies", title: "Filmes", icon: Film, color: "from-blue-500 to-blue-600", action: () => { setActiveSection("movies"); setCurrentView("content"); } },
                    { id: "series", title: "Séries", icon: Clapperboard, color: "from-purple-500 to-purple-600", action: () => { setActiveSection("series"); setCurrentView("content"); } }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className={`group relative aspect-[4/5] sm:aspect-square md:aspect-[16/14] bg-slate-900 rounded-[1.5rem] sm:rounded-[3rem] md:rounded-[4rem] border-2 border-white/5 hover:border-orange-500 transition-all shadow-2xl flex flex-col items-center justify-center p-4 sm:p-6 md:p-10 ${deviceMode === "android" ? "scale-105" : ""}`}
                    >
                      <div className={`w-14 h-14 sm:w-24 sm:h-24 md:w-36 md:h-36 bg-gradient-to-br ${item.color} rounded-[1.25rem] sm:rounded-[2rem] md:rounded-[3rem] flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500 shrink-0`}>
                        <item.icon className="w-7 h-7 sm:w-12 sm:h-12 md:w-20 md:h-20 text-white" />
                      </div>
                      <h3 className={`font-black tracking-tight uppercase mt-4 sm:mt-6 md:mt-10 leading-none text-center ${deviceMode === "android" ? "text-lg sm:text-3xl md:text-5xl" : "text-sm sm:text-2xl md:text-4xl"}`}>{item.title}</h3>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : currentView === "settings" ? (
            <div className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-12"
              >
                <h2 className="text-4xl md:text-5xl font-black mb-12">Configurações</h2>
                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <MonitorPlay className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Modo de Dispositivo</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: "pc", label: "PC / Desktop", icon: MonitorPlay },
                        { id: "android", label: "Android / TV", icon: Tv }
                      ].map(mode => (
                        <button 
                          key={mode.id}
                          onClick={() => { setDeviceMode(mode.id as any); localStorage.setItem("iptv_device_mode", mode.id); }}
                          className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${deviceMode === mode.id ? "border-orange-500 bg-orange-500/10" : "border-white/5 bg-white/5"}`}
                        >
                          <mode.icon className={`w-8 h-8 ${deviceMode === mode.id ? "text-orange-500" : "text-slate-400"}`} />
                          <span className="text-sm font-bold uppercase">{mode.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-slate-400 text-xs">O modo Android otimiza a interface para navegação com controle remoto.</p>
                  </div>

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
                    <p className="text-slate-400">Modo leve reduz animações para melhor performance.</p>
                  </div>
                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <LayoutGrid className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Estilo de Layout</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {["modern", "classic", "iptv"].map(type => (
                        <button 
                          key={type}
                          onClick={() => { setLayoutType(type as any); localStorage.setItem("iptv_layout", type); }}
                          className={`p-4 rounded-xl border-2 transition-all text-xs font-bold uppercase ${layoutType === type ? "border-orange-500 bg-orange-500/10" : "border-white/5 bg-white/5"}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <User className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Minha Conta</h3>
                    </div>
                    <div className="space-y-2">
                      <p className="text-slate-400 text-sm">Status: <span className="text-green-500 font-bold">Ativo</span></p>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <Lock className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Controle Parental</h3>
                    </div>
                    <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all border border-white/5">
                      ALTERAR SENHA PIN
                    </button>
                    <p className="text-slate-400 text-xs">Bloqueie categorias de conteúdo adulto.</p>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <MonitorPlay className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Player Externo</h3>
                    </div>
                    <div className="flex gap-2">
                      {["Nativo", "VLC", "MX"].map(p => (
                        <button key={p} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${p === "Nativo" ? "bg-orange-500 border-orange-400" : "bg-white/5 border-white/5"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                    <p className="text-slate-400 text-xs">Escolha como reproduzir seus vídeos.</p>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <RefreshCw className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">Manutenção</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Ações do Sistema</p>
                      </div>
                      <button 
                        onClick={() => { localStorage.clear(); window.location.reload(); }}
                        className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold border border-red-500/20 transition-all"
                      >
                        LIMPAR CACHE
                      </button>
                      <button 
                        onClick={() => {
                          if (userData?.m3uUrl) {
                            fetchChannels(userData.m3uUrl);
                          } else {
                            window.location.reload();
                          }
                        }}
                        className="py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 rounded-xl text-xs font-bold border border-orange-500/20 transition-all"
                      >
                        RECARREGAR LISTA
                      </button>
                      <div className="col-span-2 mt-2">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Conta e Preferências</p>
                      </div>
                      <button 
                        onClick={logout}
                        className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-white/5 transition-all"
                      >
                        SAIR DA CONTA
                      </button>
                      <button 
                        onClick={() => {
                          const custom = prompt("Limpar todos os números customizados? Digite 'SIM' para confirmar.");
                          if (custom === "SIM") {
                            localStorage.removeItem("iptv_custom_numbers");
                            window.location.reload();
                          }
                        }}
                        className="py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-white/5 transition-all"
                      >
                        RESETAR NÚMEROS
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="flex items-center gap-4 text-orange-500">
                      <Hash className="w-8 h-8" />
                      <h3 className="text-2xl font-bold">TV</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm font-bold">Numeração Automática</span>
                        <button 
                          onClick={() => {
                            const newVal = !localStorage.getItem("iptv_auto_number");
                            localStorage.setItem("iptv_auto_number", newVal ? "true" : "");
                            window.location.reload();
                          }}
                          className={`w-12 h-6 rounded-full transition-all relative ${localStorage.getItem("iptv_auto_number") ? "bg-orange-500" : "bg-slate-800"}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localStorage.getItem("iptv_auto_number") ? "left-7" : "left-1"}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-sm font-bold">Mostrar Números na Grade</span>
                        <button 
                          onClick={() => {
                            const newVal = !localStorage.getItem("iptv_show_numbers");
                            localStorage.setItem("iptv_show_numbers", newVal ? "true" : "");
                            window.location.reload();
                          }}
                          className={`w-12 h-6 rounded-full transition-all relative ${localStorage.getItem("iptv_show_numbers") ? "bg-orange-500" : "bg-slate-800"}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localStorage.getItem("iptv_show_numbers") ? "left-7" : "left-1"}`} />
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          localStorage.removeItem("iptv_custom_numbers");
                          window.location.reload();
                        }}
                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold border border-red-500/20 transition-all"
                      >
                        RESETAR NÚMEROS CUSTOMIZADOS
                      </button>
                    </div>
                    <p className="text-slate-400 text-xs">Ajuste como os números dos canais são exibidos.</p>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : layoutType === "iptv" ? (
            <div className="flex-1 flex flex-col bg-[#001b35] relative overflow-hidden">
              <div className="h-20 md:h-28 border-b border-white/10 flex items-center justify-between px-6 md:px-12 z-10 bg-slate-950/40 backdrop-blur-md">
                <div className="flex flex-col">
                  <span className="text-2xl md:text-4xl font-black tracking-tighter">
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className="absolute left-1/2 -translate-x-1/2 text-center">
                  <p className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter">
                    {activeSection === "live" ? "TV" : activeSection === "movies" ? "Filmes" : "Séries"} | <span className="text-blue-400">{selectedGroup}</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.5em] text-slate-500 font-black hidden md:block">Navegação</p>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => searchInputRef.current?.focus()}
                    className="p-3 hover:bg-white/10 rounded-2xl transition-all border border-white/5"
                  >
                    <Search className="w-6 h-6 text-slate-300" />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="h-16 md:h-24 border-b border-white/10 overflow-x-auto flex items-center bg-slate-950/60 no-scrollbar px-4 gap-4">
                  {groups.map((group, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedGroup(group)}
                      className={`px-6 py-2 md:px-8 md:py-3 rounded-xl transition-all whitespace-nowrap flex items-center gap-3 group relative ${selectedGroup === group ? "bg-blue-600/20 border border-blue-500/30" : "hover:bg-white/5 border border-transparent"}`}
                    >
                      <span className={`text-sm md:text-xl font-black uppercase tracking-tight ${selectedGroup === group ? "text-white" : "text-slate-500"}`}>
                        {group}
                      </span>
                      <span className={`text-[10px] md:text-sm font-black ${selectedGroup === group ? "text-blue-400" : "text-slate-700"}`}>
                        ({getGroupCount(group)})
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar bg-black/20">
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                    {filteredChannels.slice(0, visibleCount).map((channel, idx) => (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: 1.03 }}
                        onClick={() => setSelectedChannel(channel)}
                        className={`group relative flex flex-col bg-slate-900/40 border-2 rounded-2xl overflow-hidden transition-all ${selectedChannel?.url === channel.url ? "border-blue-500 shadow-lg" : "border-white/5 hover:border-white/20"}`}
                      >
                        <div className="aspect-video bg-slate-950/80 flex items-center justify-center p-2 md:p-4 relative">
                          {localStorage.getItem("iptv_show_numbers") && channel.number && (
                            <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-lg z-10 shadow-lg">
                              #{channel.number}
                            </div>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newNum = prompt(`Editar número para: ${channel.name}`, channel.number?.toString());
                              if (newNum !== null) {
                                const num = parseInt(newNum);
                                if (!isNaN(num)) {
                                  const custom = JSON.parse(localStorage.getItem("iptv_custom_numbers") || "{}");
                                  custom[channel.name] = num;
                                  localStorage.setItem("iptv_custom_numbers", JSON.stringify(custom));
                                  window.location.reload();
                                }
                              }
                            }}
                            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-orange-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                          >
                            <Hash className="w-3 h-3" />
                          </button>
                          {channel.logo ? (
                            <img src={channel.logo} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" loading="lazy" />
                          ) : (
                            <Tv className="w-12 h-12 text-slate-800" />
                          )}
                        </div>
                        <div className="p-2 md:p-3 bg-slate-900/90 border-t border-white/5 min-h-[40px] md:min-h-[60px] flex items-center justify-center">
                          <p className="text-[10px] md:text-xs font-black text-center uppercase tracking-tighter line-clamp-2 leading-tight">{channel.name}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 md:p-8 space-y-10 overflow-y-auto custom-scrollbar">
              <section className="relative aspect-video bg-black rounded-[2rem] md:rounded-[3rem] overflow-hidden border-4 border-white/5 shadow-2xl group">
                {selectedChannel ? (
                  selectedChannel.url.startsWith("demo") ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                      <img 
                        src={selectedChannel.logo} 
                        className="w-full h-full object-cover opacity-20 absolute inset-0" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="relative z-10 text-center p-8">
                        <Play className="w-20 h-20 text-orange-500 mx-auto mb-4 animate-pulse" />
                        <h3 className="text-3xl font-black">{selectedChannel.name}</h3>
                        <p className="text-slate-400 mt-2">Modo Demo: Reprodução simulada</p>
                      </div>
                    </div>
                  ) : (
                    <video ref={videoRef} className="w-full h-full object-contain" controls autoPlay playsInline />
                  )
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                    <MonitorPlay className="w-20 h-20 md:w-32 md:h-32 mb-6 opacity-20" />
                    <p className="text-xl md:text-2xl font-bold">Selecione um canal</p>
                  </div>
                )}
              </section>

              <section className="space-y-8">
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                  {groups.map((group, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedGroup(group)}
                      className={`px-6 py-3 md:px-8 md:py-4 rounded-2xl text-base md:text-lg font-black whitespace-nowrap transition-all border-2 ${selectedGroup === group ? "bg-orange-500 border-orange-400 text-white shadow-lg" : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"}`}
                    >
                      {group} ({getGroupCount(group)})
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8">
                  {filteredChannels.slice(0, visibleCount).map((channel, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.05, y: -5 }}
                      onClick={() => setSelectedChannel(channel)}
                      className={`relative aspect-video rounded-2xl md:rounded-[2rem] overflow-hidden border-2 md:border-4 transition-all ${selectedChannel?.url === channel.url ? "border-orange-500 shadow-2xl" : "border-white/5 hover:border-white/20"}`}
                    >
                      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center relative">
                        {localStorage.getItem("iptv_show_numbers") && channel.number && (
                          <div className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-black px-3 py-1 rounded-xl z-10 shadow-xl">
                            #{channel.number}
                          </div>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newNum = prompt(`Editar número para: ${channel.name}`, channel.number?.toString());
                            if (newNum !== null) {
                              const num = parseInt(newNum);
                              if (!isNaN(num)) {
                                const custom = JSON.parse(localStorage.getItem("iptv_custom_numbers") || "{}");
                                custom[channel.name] = num;
                                localStorage.setItem("iptv_custom_numbers", JSON.stringify(custom));
                                window.location.reload();
                              }
                            }
                          }}
                          className="absolute top-3 right-3 p-3 bg-black/60 hover:bg-orange-500 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all z-10"
                        >
                          <Hash className="w-4 h-4" />
                        </button>
                        {channel.logo ? (
                          <img src={channel.logo} alt="" className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" loading="lazy" />
                        ) : (
                          <Tv className="w-12 h-12 text-slate-800" />
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                      <div className="absolute bottom-3 md:bottom-6 left-3 md:left-6 right-3 md:right-6">
                        <p className="text-sm md:text-lg font-black truncate text-white leading-tight">{channel.name}</p>
                        <p className="text-[10px] md:text-xs text-orange-400 uppercase font-black truncate mt-1">{channel.group}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {isAiOptimizing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="max-w-md w-full bg-slate-900 border-2 border-orange-500/30 rounded-[3rem] p-10 shadow-2xl text-center space-y-6">
              <RefreshCw className="w-16 h-16 text-orange-500 animate-spin mx-auto" />
              <h3 className="text-3xl font-black uppercase">Otimizador IA</h3>
              <div className="text-left bg-black/40 p-6 rounded-2xl border border-white/5 font-mono text-sm space-y-2">
                {aiLog.map((log, i) => <p key={i} className="text-slate-500">› {log}</p>)}
              </div>
            </div>
          </motion.div>
        )}
        {showFullscreenOverlay && !isFullscreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <div className="max-w-md w-full text-center space-y-8">
              <div className="w-24 h-24 bg-orange-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/30">
                <Maximize className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter">Modo Tela Cheia</h2>
              <p className="text-slate-400 text-xl font-medium">
                Para uma melhor experiência no D7 Player, recomendamos o uso em tela cheia.
              </p>
              <button 
                onClick={() => {
                  toggleFullscreen();
                  setShowFullscreenOverlay(false);
                }}
                className="w-full py-6 bg-orange-500 hover:bg-orange-600 text-white font-black text-2xl rounded-[1.5rem] transition-all shadow-2xl shadow-orange-500/40 active:scale-95"
              >
                ENTRAR EM TELA CHEIA
              </button>
              <button 
                onClick={() => setShowFullscreenOverlay(false)}
                className="text-slate-600 hover:text-slate-400 font-bold uppercase tracking-widest text-sm transition-colors"
              >
                Agora não
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
