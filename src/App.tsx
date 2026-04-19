import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tv, 
  Play, 
  RefreshCw, 
  Search, 
  User,
  Lock,
  LogOut,
  MonitorPlay,
  Film,
  Clapperboard,
  X,
  Zap,
  ZapOff,
  Link as LinkIcon
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
  const [m3uInput, setM3uInput] = useState("");
  const [loginMode, setLoginMode] = useState<"xtream" | "m3u">("xtream");
  const [xtreamForm, setXtreamForm] = useState({ server: "", username: "", password: "" });
  const [activeSection, setActiveSection] = useState<"live" | "movies" | "series">("live");
  const [layoutType, setLayoutType] = useState<"modern" | "classic" | "iptv">("modern");
  const [currentView, setCurrentView] = useState<"dashboard" | "content" | "settings">("dashboard");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [visibleCount, setVisibleCount] = useState(40);
  const [isParsing, setIsParsing] = useState(false);
  const [playerEngine, setPlayerEngine] = useState<"hls" | "native" | "proxy">("hls");

  const [isSearching, setIsSearching] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("iptv_session_v3");
    const savedFavs = localStorage.getItem("iptv_favorites_v3");
    
    if (savedFavs) setFavorites(JSON.parse(savedFavs) as string[]);
    
    if (saved) {
      const data = JSON.parse(saved) as UserData;
      setUserData(data);
      setIsLoggedIn(true);
      fetchChannels(data.m3uUrl);
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(40);
  }, [searchQuery, activeSection, selectedGroup, activeTab]);

  const toggleFavorite = (url: string) => {
    const newFavs = favorites.includes(url) 
      ? favorites.filter(f => f !== url) 
      : [...favorites, url];
    setFavorites(newFavs);
    localStorage.setItem("iptv_favorites_v3", JSON.stringify(newFavs));
  };

  const categorizeChannel = (channel: Channel): "live" | "movies" | "series" => {
    const group = channel.group ? channel.group.toUpperCase() : "";
    const name = channel.name ? channel.name.toUpperCase() : "";
    const url = (channel.url || "").toLowerCase();
    
    // Series detection - very common patterns in IPTV lists
    if (
      group.includes("SERIE") || 
      group.includes("SÉRIE") || 
      group.includes("SERIES") || 
      group.includes("SEASON") ||
      group.includes("TEMPORADA") ||
      group.includes("NETFLIX") ||
      group.includes("DISNEY+") ||
      group.includes("HBO") ||
      group.includes("SÉRIES") ||
      url.includes("/series/") ||
      url.includes("/xmltv.php?type=series")
    ) return "series";
    
    // Movies detection
    if (
      group.includes("FILME") || 
      group.includes("MOVIE") || 
      group.includes("MOVIES") || 
      group.includes("VOD") ||
      group.includes("FILMES") ||
      group.includes("V.O.D") ||
      group.includes("CINEMA") ||
      group.includes("Lançamento") ||
      url.includes("/movie/") ||
      url.includes("/xmltv.php?type=movie")
    ) return "movies";
    
    // If it's anything else, it's likely a Live channel
    return "live";
  };

  const parseM3U = (data: string): Channel[] => {
    if (!data || typeof data !== 'string') return [];
    
    // Check if it's JSON (sometimes Xtream returns JSON even when M3U is requested)
    if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
      console.warn("Server returned JSON instead of M3U.");
      return [];
    }

    const lines = data.replace(/^\uFEFF/, "").split(/\r?\n/);
    const result: Channel[] = [];
    let currentChannel: Partial<Channel> = { group: "Geral" };
    let channelCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("#EXTINF:")) {
        // Extract group, logo and name using more robust matching
        const groupMatch = line.match(/group-title="(.*?)"/i);
        const logoMatch = line.match(/tvg-logo="(.*?)"/i);
        const nameMatch = line.match(/,(.*)$/);
        
        if (groupMatch) currentChannel.group = groupMatch[1];
        if (logoMatch) currentChannel.logo = logoMatch[1];
        if (nameMatch) currentChannel.name = nameMatch[1].trim();
      } 
      else if (line.startsWith("#EXTGRP:")) {
        // Support for older/different M3U formats
        const group = line.replace("#EXTGRP:", "").trim();
        if (group) currentChannel.group = group;
      }
      else if (line.startsWith("http")) {
        currentChannel.url = line;
        
        // Final fallback for missing name (use URL filename)
        if (!currentChannel.name || currentChannel.name.includes("#EXTINF")) {
          const parts = line.split("/");
          const lastPart = parts[parts.length - 1];
          currentChannel.name = lastPart.split(".")[0] || "Canal " + channelCounter;
        }

        const channel = {
          name: currentChannel.name || "Canal",
          group: currentChannel.group || "Geral",
          logo: currentChannel.logo,
          url: currentChannel.url,
          category: "live",
          number: 0
        } as Channel;

        channel.category = categorizeChannel(channel);
        if (channel.category === "live") channel.number = channelCounter++;
        
        result.push(channel);
        currentChannel = { group: "Geral" }; // Reset with default group
      }
    }
    return result;
  };

  const fetchChannels = async (url: string) => {
    setLoading(true);
    setError(null);
    setIsParsing(true);
    
    try {
      const proxyUrl = `/api/proxy-m3u?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Falha ao carregar a lista. Verifique a URL.");
      
      const text = await response.text();
      const parsed = parseM3U(text);
      setChannels(parsed);
      
      const last = localStorage.getItem("last_channel_v3");
      if (last) {
        const parsedLast = JSON.parse(last) as Channel;
        const found = parsed.find(c => c.url === parsedLast.url);
        if (found) setSelectedChannel(found);
      }
    } catch (err) {
      setError("Erro ao processar a lista. Verifique se a URL é válida.");
    } finally {
      setIsParsing(false);
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    let finalM3uUrl = "";
    
    if (loginMode === "m3u") {
      if (!m3uInput.trim()) {
        setLoading(false);
        return;
      }
      finalM3uUrl = m3uInput.trim();
    } else {
      const { server, username, password } = xtreamForm;
      if (!server || !username || !password) {
        setError("Preencha todos os campos do Xtream Codes.");
        setLoading(false);
        return;
      }
      
      let serverUrl = server.trim();
      if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
        serverUrl = `http://${serverUrl}`;
      }
      if (serverUrl.endsWith("/")) {
        serverUrl = serverUrl.slice(0, -1);
      }
      
      try {
        // Pre-validate with Xtream API
        const authUrl = `/api/proxy-m3u?url=${encodeURIComponent(`${serverUrl}/player_api.php?username=${username.trim()}&password=${password.trim()}`)}`;
        const authRes = await fetch(authUrl);
        const authData = await authRes.json();
        
        if (authData.user_info && authData.user_info.auth === 0) {
          throw new Error("Usuário ou senha inválidos no Xtream Codes.");
        }
        
        if (!authData.user_info) {
          console.warn("Server didn't return standard Xtream JSON, trying M3U download directly...");
        }

        // Standard Xtream get.php URL - Using ts output for better M3U generation compatibility
        finalM3uUrl = `${serverUrl}/get.php?username=${username.trim()}&password=${password.trim()}&type=m3u_plus&output=ts`;
      } catch (err: any) {
        setError(err.message || "Erro ao conectar com o servidor Xtream.");
        setLoading(false);
        return;
      }
    }
    
    const user: UserData = { m3uUrl: finalM3uUrl };
    localStorage.setItem("iptv_session_v3", JSON.stringify(user));
    setUserData(user);
    setIsLoggedIn(true);
    await fetchChannels(user.m3uUrl);
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem("iptv_session_v3");
    setIsLoggedIn(false);
    setUserData(null);
    setChannels([]);
    setSelectedChannel(null);
  };

  useEffect(() => {
    if (selectedChannel && videoRef.current) {
      const video = videoRef.current;
      localStorage.setItem("last_channel_v3", JSON.stringify(selectedChannel));
      
      let streamUrl = selectedChannel.url;
      if (playerEngine === "proxy" || (window.location.protocol === "https:" && streamUrl.startsWith("http:"))) {
        streamUrl = `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported() && (streamUrl.includes(".m3u8") || playerEngine === "hls")) {
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(console.error));
      } else {
        video.src = streamUrl;
        video.play().catch(console.error);
      }
    }
  }, [selectedChannel, playerEngine]);

  const { groups } = React.useMemo(() => {
    const groupSet = new Set<string>();
    for (const c of channels) {
      if (c.category === activeSection) groupSet.add(c.group);
    }
    return { groups: ["Todos", ...Array.from(groupSet).sort()] };
  }, [channels, activeSection]);

  const filteredChannels = React.useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return channels.filter(c => {
        if (c.category !== activeSection) return false;
        if (activeTab === "favorites" && !favorites.includes(c.url)) return false;
        if (selectedGroup !== "Todos" && c.group !== selectedGroup) return false;
        return true;
      });
    }

    // When searching, we do a global search across all categories/groups
    return channels.filter(c => {
      const matchName = c.name.toLowerCase().includes(query);
      const matchGroup = c.group.toLowerCase().includes(query);
      
      // Filter by favorites if on favorites tab, otherwise global
      if (activeTab === "favorites" && !favorites.includes(c.url)) return false;
      
      return matchName || matchGroup;
    }).sort((a, b) => {
      // Prioritize current section matches
      if (a.category === activeSection && b.category !== activeSection) return -1;
      if (a.category !== activeSection && b.category === activeSection) return 1;
      return 0;
    });
  }, [channels, activeSection, searchQuery, selectedGroup, activeTab, favorites]);

  // Loading Screen Component
  const LoadingScreen = () => (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white z-50 p-6 overflow-hidden">
      {/* Animated Background Layers */}
      <div className="absolute inset-0 z-0 opacity-10">
        <img 
          src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueXp4bmZ6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z6Z3Z/3o7TKMGpxx6fGfXfG/giphy.gif" 
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
        <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-6">
          {isParsing ? "Processando Lista" : "Sincronizando"}
        </h2>
        <p className="text-slate-400 text-xl md:text-3xl font-medium italic">
          Estou atualizando seus conteúdos, já continuamos
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

  if (loading) return <LoadingScreen />;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img 
            src="https://picsum.photos/seed/iptv/1920/1080?blur=10" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer"
            alt=""
          />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-slate-900/80 backdrop-blur-xl p-8 md:p-12 rounded-[3rem] border border-white/10 shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-orange-500/20">
              <Tv className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">D7 Web Player</h1>
            <p className="text-slate-400 mt-2 font-medium">Sua experiência premium de IPTV</p>
          </div>

          <div className="flex bg-slate-950/50 p-1.5 rounded-2xl mb-8 border border-white/5">
            <button 
              onClick={() => setLoginMode("xtream")}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                loginMode === "xtream" ? "bg-orange-500 text-white shadow-lg" : "text-slate-500 hover:text-white"
              }`}
            >
              Xtream Codes
            </button>
            <button 
              onClick={() => setLoginMode("m3u")}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                loginMode === "m3u" ? "bg-orange-500 text-white shadow-lg" : "text-slate-500 hover:text-white"
              }`}
            >
              Link M3U
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <AnimatePresence mode="wait">
              {loginMode === "xtream" ? (
                <motion.div 
                  key="xtream"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">URL do Servidor</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MonitorPlay className="h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        required
                        className="block w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all font-medium"
                        placeholder="http://exemplo.com:80"
                        value={xtreamForm.server}
                        onChange={(e) => setXtreamForm({...xtreamForm, server: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Usuário</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-600 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          required
                          className="block w-full pl-10 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all font-medium text-base md:text-sm"
                          placeholder="Seu usuário"
                          value={xtreamForm.username}
                          onChange={(e) => setXtreamForm({...xtreamForm, username: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Senha</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Lock className="h-4 w-4 text-slate-600 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                        <input
                          type="password"
                          required
                          className="block w-full pl-10 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all font-medium text-base md:text-sm"
                          placeholder="••••••••"
                          value={xtreamForm.password}
                          onChange={(e) => setXtreamForm({...xtreamForm, password: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="m3u"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-2"
                >
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Link Completo da Lista M3U</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <LinkIcon className="h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors" />
                    </div>
                    <input
                      type="url"
                      required
                      className="block w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/5 rounded-2xl text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all font-medium text-base md:text-sm"
                      placeholder="http://exemplo.com/lista.m3u"
                      value={m3uInput}
                      onChange={(e) => setM3uInput(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-bold flex items-center gap-3"
              >
                <ZapOff className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 bg-orange-500 hover:bg-orange-600 text-white font-black text-lg uppercase tracking-widest rounded-3xl shadow-xl shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4 group ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
              )}
              {loading ? "VERIFICANDO..." : "ENTRAR NO PLAYER"}
            </button>
          </form>

          <div className="mt-12 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="h-px bg-white/5 flex-1" />
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-none">Acesso Rápido</span>
              <div className="h-px bg-white/5 flex-1" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  setLoginMode("xtream");
                  setXtreamForm({
                    server: "five-stars.site:80",
                    username: "031705796",
                    password: "325182736"
                  });
                }}
                disabled={loading}
                className="py-3 px-4 bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5 flex items-center justify-center gap-2"
              >
                Preencher Demo
              </button>
              <button 
                onClick={() => {
                  // Simply toggle a test loading state to see the nice TV animation
                  setLoading(true);
                  setTimeout(() => setLoading(false), 3000);
                }}
                disabled={loading}
                className="py-3 px-4 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500/60 hover:text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-orange-500/10 flex items-center justify-center gap-2"
              >
                Testar Loading
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 md:h-20 bg-slate-900/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
        <div className="flex items-center gap-3 md: gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 rounded-lg md:rounded-xl flex items-center justify-center">
            <Tv className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tighter uppercase">D7 Web Player</h1>
            <div className="flex items-center gap-2">
              <p className="text-[8px] md:text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase">{activeSection}</p>
              <div className="w-1 h-1 rounded-full bg-slate-700" />
              <p className="text-[8px] md:text-[10px] text-orange-500 font-bold tracking-[0.1em] uppercase">
                {channels.length} Itens Carregados
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-4 md:mx-12 hidden md:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
            <input 
              type="text"
              placeholder="Buscar conteúdos em toda a lista..."
              className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-3 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{currentTime.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })}</p>
          </div>
          <button 
            onClick={() => setIsSearching(!isSearching)} 
            className="md:hidden p-2.5 bg-slate-800 rounded-xl"
          >
            {isSearching ? <X className="w-5 h-5 text-orange-500" /> : <Search className="w-5 h-5 text-slate-400" />}
          </button>
          <button onClick={logout} className="p-2.5 md:p-3 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 rounded-xl transition-all">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-slate-900 border-b border-white/5 overflow-hidden"
          >
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Pesquisar global..."
                  className="w-full bg-slate-950/50 border border-white/5 rounded-xl py-3 pl-12 pr-12 outline-none focus:ring-2 focus:ring-orange-500/50 text-white text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden pb-20 md:pb-0">
        {/* Sidebar - Desktop Only */}
        <aside className="hidden md:flex w-72 bg-slate-900/30 border-r border-white/5 flex-col p-4 gap-2">
          {[
            { id: "live", icon: MonitorPlay, label: "Canais Ao Vivo" },
            { id: "movies", icon: Film, label: "Filmes" },
            { id: "series", icon: Clapperboard, label: "Séries" }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id as any);
                setSelectedGroup("Todos");
              }}
              className={`flex items-center gap-4 p-4 rounded-2xl transition-all group ${
                activeSection === item.id ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "hover:bg-white/5 text-slate-400"
              }`}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              <span className="font-bold text-sm hidden md:block">{item.label}</span>
            </button>
          ))}
          
          <div className="mt-auto pt-4 border-t border-white/5">
            <button 
              onClick={() => setActiveTab(activeTab === "all" ? "favorites" : "all")}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                activeTab === "favorites" ? "bg-red-500/20 text-red-500" : "hover:bg-white/5 text-slate-400"
              }`}
            >
              <Zap className="w-6 h-6 flex-shrink-0" />
              <span className="font-bold text-sm hidden md:block">Favoritos</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/50">
          {/* Header para Mobile em vez de sidebar */}
          <div className="md:hidden flex items-center gap-2 p-4 pb-0 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "Todos Conteúdos" },
              { id: "favorites", label: "Apenas Favoritos", icon: Zap }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border flex items-center gap-2 ${
                  activeTab === item.id 
                    ? "bg-orange-500 border-orange-500 text-white shadow-lg mx-2 scale-105" 
                    : "bg-slate-900 border-white/5 text-slate-500"
                }`}
              >
                {item.id === "favorites" && <Zap className="w-3 h-3" />}
                {item.label}
              </button>
            ))}
          </div>

          {/* Group Filter */}
          <div className="p-4 md:p-6 overflow-x-auto flex gap-2 md:gap-3 no-scrollbar scroll-smooth">
            {groups.map(group => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
                  selectedGroup === group ? "bg-white text-slate-950" : "bg-slate-900 text-slate-500 hover:text-white"
                }`}
              >
                {group}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6 pb-24 md:pb-6">
            <AnimatePresence mode="popLayout">
              {filteredChannels.length > 0 ? (
                filteredChannels.slice(0, visibleCount).map((channel, idx) => (
                  <motion.div
                    key={channel.url + idx}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -5 }}
                    onClick={() => setSelectedChannel(channel)}
                    className={`group relative aspect-[2/3] rounded-3xl overflow-hidden cursor-pointer border-2 transition-all ${
                      selectedChannel?.url === channel.url ? "border-orange-500 shadow-2xl shadow-orange-500/20" : "border-transparent hover:border-white/20"
                    }`}
                  >
                    <img 
                      src={channel.logo || `https://picsum.photos/seed/${channel.name}/300/450`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      alt={channel.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-xs font-bold text-orange-500 mb-1 uppercase tracking-wider truncate">{channel.group}</p>
                      <h3 className="font-black text-sm leading-tight line-clamp-2">{channel.name}</h3>
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(channel.url);
                      }}
                      className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md transition-all ${
                        favorites.includes(channel.url) ? "bg-red-500 text-white" : "bg-black/40 text-white/50 hover:text-white"
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-700">
                  <ZapOff className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-xl font-black uppercase tracking-widest opacity-30">Nenhum conteúdo nesta aba</p>
                  <p className="text-sm font-medium mt-2 text-center max-w-xs">
                    {channels.length > 0 
                      ? `Encontramos ${channels.length} itens no total, mas nenhum na categoria "${activeSection.toUpperCase()}". Tente as abas FILMES ou SÉRIES abaixo.`
                      : "Sua lista parece estar vazia ou o servidor não enviou os dados. Verifique sua conta."}
                  </p>
                </div>
              )}
            </AnimatePresence>
            
            {filteredChannels.length > visibleCount && (
              <button 
                onClick={() => setVisibleCount(prev => prev + 40)}
                className="col-span-full py-8 text-slate-500 font-bold hover:text-white transition-colors"
              >
                Carregar mais conteúdos...
              </button>
            )}
          </div>
        </main>
      </div>

      {/* Player Modal */}
      <AnimatePresence>
        {selectedChannel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          >
            <video 
              ref={videoRef}
              className="w-full h-full object-contain"
              controls
              autoPlay
            />
            
            <div className="absolute top-8 left-8 flex items-center gap-4 z-10 pointer-events-none">
              <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-2xl">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter uppercase drop-shadow-lg">{selectedChannel.name}</h2>
                <p className="text-sm text-orange-500 font-bold uppercase tracking-widest drop-shadow-lg">{selectedChannel.group}</p>
              </div>
            </div>

            <button 
              onClick={() => setSelectedChannel(null)}
              className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl text-white transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around px-2 z-[60]">
        {[
          { id: "live", icon: MonitorPlay, label: "Live" },
          { id: "movies", icon: Film, label: "Filmes" },
          { id: "series", icon: Clapperboard, label: "Séries" }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => {
              setActiveSection(item.id as any);
              setSelectedGroup("Todos");
            }}
            className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-all ${
              activeSection === item.id ? "text-orange-500" : "text-slate-500"
            }`}
          >
            <item.icon className={`w-6 h-6 ${activeSection === item.id ? "scale-110" : ""}`} />
            <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
            {activeSection === item.id && (
              <motion.div layoutId="activeTabDot" className="w-1 h-1 bg-orange-500 rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
