import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Bot,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Copy,
  Database,
  Droplets,
  History,
  LocateFixed,
  MapPin,
  Menu,
  Mic,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  User,
  Volume2,
  X
} from 'lucide-react';
import { ThaiLocation } from '../data/thaiLocations';
import {
  addLocationToFavorites,
  FavoriteItem,
  getFavoriteLocations,
  isLocationFavorited,
  removeLocationFromFavorites,
  subscribeFavorites
} from '../services/favoritesService';
import {
  LocationRealtimeStatus,
  preloadMajorWebRealtimeData,
  subscribeRealtimeBackgroundUpdates,
  TrafficColorCode,
  WaterSafetyTier
} from '../services/weatherWaterService';
import {
  AiChatMessage,
  AiSimplePlaceCard,
  askSmartWeatherTrafficAi,
  buildRainPredictionForStatus,
  detectQuestionTopicFocus,
  getInstantAiAnswerFromPreloadedWebData,
  getLiveSmartTypingSuggestions,
  getPreloadedCategorizedWebData,
  statusToSimplePlaceCard
} from '../services/aiAssistantService';
import {
  buildAiMessageSpeechScript,
  speakAiDirectSummaryAutomatically,
  stopAllSpeech,
  subscribeAiVoiceState
} from './SpeechSummaryButton';
import { FavoritesBar } from './FavoritesBar';

interface AiChatbotViewProps {
  statuses: LocationRealtimeStatus[];
  selectedLocations: ThaiLocation[];
  isLocatingGps: boolean;
  onUseCurrentLocation: () => void;
  onSwitchToAdvancedMode: (focusLocation?: ThaiLocation) => void;
  onApplyRouteToAdvancedMode?: (locations: ThaiLocation[]) => void;
  onSelectFavoriteLocation?: (location: ThaiLocation) => void;
  gpsStatusBanner?: { text: string; type: 'success' | 'error' | 'info' } | null;
  onClearGpsBanner?: () => void;
  onRefreshData?: () => void;
  isRefreshingData?: boolean;
}

type PreloadedCategoryTab = 'rain_ranked' | 'traffic_ranked' | 'flood_ranked' | 'popular_routes';

function getTrafficEasyBadge(color: TrafficColorCode) {
  if (color === 'red') {
    return {
      dot: 'bg-red-500 ring-4 ring-red-500/20',
      bg: 'bg-red-50 text-red-900 border-red-200',
      label: 'สีแดง • รถติดขัด'
    };
  }
  if (color === 'yellow') {
    return {
      dot: 'bg-amber-400 ring-4 ring-amber-400/20',
      bg: 'bg-amber-50 text-amber-950 border-amber-200',
      label: 'สีเหลือง • ชะลอตัว'
    };
  }
  return {
    dot: 'bg-emerald-500 ring-4 ring-emerald-500/20',
    bg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    label: 'สีเขียว • คล่องตัว'
  };
}

function getWaterEasyBadge(tier: WaterSafetyTier) {
  if (tier === 'critical') {
    return {
      bg: 'bg-red-600 text-white',
      lightBg: 'bg-red-50 text-red-900 border-red-200',
      label: 'น้ำท่วมสูง ห้ามผ่าน'
    };
  }
  if (tier === 'danger') {
    return {
      bg: 'bg-orange-600 text-white',
      lightBg: 'bg-orange-50 text-orange-950 border-orange-200',
      label: 'มีน้ำท่วมขัง รถเล็กควรเลี่ยง'
    };
  }
  if (tier === 'watch') {
    return {
      bg: 'bg-amber-500 text-slate-950',
      lightBg: 'bg-amber-50 text-amber-950 border-amber-200',
      label: 'ถนนหลักแห้ง (เฝ้าระวังน้ำรอระบาย)'
    };
  }
  return {
    bg: 'bg-emerald-600 text-white',
    lightBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    label: 'ถนนแห้ง ไม่มีน้ำท่วม'
  };
}

function formatSimpleMarkdownText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={lineIdx} className="h-1" />;
    }

    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={lineIdx} className="text-sm sm:text-base text-slate-800 leading-relaxed">
        {parts.map((part, partIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={partIdx} className="font-black text-slate-950">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
      </p>
    );
  });
}

export const AiChatbotView: React.FC<AiChatbotViewProps> = ({
  statuses,
  selectedLocations,
  isLocatingGps,
  onUseCurrentLocation,
  onSwitchToAdvancedMode,
  onApplyRouteToAdvancedMode,
  onSelectFavoriteLocation,
  gpsStatusBanner,
  onClearGpsBanner,
  onRefreshData,
  isRefreshingData
}) => {
  const primaryStatus = statuses[0] || null;

  // ติดตามการอัปเดตข้อมูลเรียลไทม์ที่โหลดไว้ในเว็บ
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [isRefreshingWebData, setIsRefreshingWebData] = useState(false);

  useEffect(() => {
    const unsub = subscribeRealtimeBackgroundUpdates(() => {
      setRealtimeTick((t) => t + 1);
    });
    return () => unsub();
  }, []);

  // ข้อมูลทั้งหมดที่โหลดเตรียมไว้ในเว็บล่วงหน้า จัดเรียงลำดับและแยกประเภทเรียบร้อย (ตอบคำถามได้ทันทีใน 0 วินาที)
  const preloadedData = useMemo(
    () => getPreloadedCategorizedWebData(selectedLocations),
    [selectedLocations, statuses, realtimeTick]
  );

  const initialWelcomeMessage = useMemo<AiChatMessage>(() => {
    if (!primaryStatus) {
      return {
        id: 'welcome-init',
        role: 'assistant',
        text: 'พิมพ์ถามได้เลยครับ เช่น "ดอนเมือง บ่าย 2 ฝนตกไหม" หรือ "จากดอนเมือง ไป ฟิวเจอร์รังสิต รถติดไหม น้ำท่วมไหม"',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      };
    }

    const rainPred = buildRainPredictionForStatus(primaryStatus);
    const simpleCard = statusToSimplePlaceCard(primaryStatus, 'พื้นที่ปัจจุบันของคุณ');
    const shortPlaceTitle = simpleCard.placeTitle.split('(')[0].trim();

    const trafficDot =
      simpleCard.trafficColor === 'red'
        ? '🔴 รถติดขัด'
        : simpleCard.trafficColor === 'yellow'
          ? '🟡 ชะลอตัว'
          : '🟢 คล่องตัว';

    return {
      id: 'welcome-init',
      role: 'assistant',
      targetScopeLabel: `พื้นที่ปัจจุบันของคุณ: ${shortPlaceTitle}`,
      text: `${simpleCard.waterEasyText} (${simpleCard.vehicleEasyAdvice})`,
      spokenAnswerText: `สรุปสถานการณ์บริเวณ ${shortPlaceTitle} ตอนนี้ ${simpleCard.waterEasyText} ${simpleCard.vehicleEasyAdvice} การจราจร${primaryStatus.trafficStatus.colorNameTh} และพยากรณ์ฝน ${rainPred.highlightLine} ครับ`,
      conversationContext: {
        userQuestion: `สถานการณ์บริเวณ ${shortPlaceTitle}`,
        shortContextTitle: shortPlaceTitle,
        resolvedTopicFocus: detectQuestionTopicFocus('ฝน รถติด น้ำท่วม', null),
        resolvedTargetHour: null,
        resolvedLocations: [primaryStatus.location],
        isRoute: false
      },
      detailedText: [
        `รายละเอียดเพิ่มเติมบริเวณ **${simpleCard.placeTitle}** (${simpleCard.areaSubtitle}):`,
        `• สภาพอากาศปัจจุบัน: ${simpleCard.currentWeatherEasy}`,
        `• พยากรณ์ฝนรายชั่วโมง: ${rainPred.highlightLine}`,
        `• การจราจร: ${trafficDot} (${simpleCard.trafficEasyText})`,
        `• ระดับน้ำและคำแนะนำ: ${simpleCard.waterEasyText} — ${simpleCard.vehicleEasyAdvice}`
      ].join('\n'),
      essentialHighlights: [
        {
          icon: 'rain',
          label: 'พยากรณ์ฝน',
          value: rainPred.highlightLine,
          tone: rainPred.probabilityPercent >= 60 ? 'caution' : 'safe'
        },
        {
          icon: 'traffic',
          label: 'สภาพจราจร',
          value: `${trafficDot} — ${simpleCard.trafficEasyText}`,
          tone:
            simpleCard.trafficColor === 'red'
              ? 'warning'
              : simpleCard.trafficColor === 'yellow'
                ? 'caution'
                : 'safe'
        },
        {
          icon: 'water',
          label: 'น้ำท่วมไหม',
          value: `${simpleCard.waterEasyText} (${simpleCard.vehicleEasyAdvice})`,
          tone:
            simpleCard.waterTier === 'critical' || simpleCard.waterTier === 'danger'
              ? 'warning'
              : simpleCard.waterTier === 'watch'
                ? 'caution'
                : 'safe'
        }
      ],
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      queryType: 'place_check',
      quickVerdict: {
        statusTone:
          simpleCard.waterTier === 'critical' || simpleCard.waterTier === 'danger'
            ? 'warning'
            : rainPred.probabilityPercent >= 65 || simpleCard.trafficColor === 'red'
              ? 'caution'
              : 'safe',
        headline: `${shortPlaceTitle}: ${simpleCard.waterEasyText} • ${trafficDot}`,
        subtext: `${rainPred.highlightLine}`
      },
      rainPredictions: [rainPred],
      placeCards: [simpleCard],
      followUpSuggestions: [
        `แถว ${shortPlaceTitle} ตอนนี้น้ำท่วมไหม รถเล็กผ่านได้ไหม?`,
        `แถว ${shortPlaceTitle} ตอนนี้รถติดไหม?`,
        `วันนี้แถว ${shortPlaceTitle} ฝนจะตกกี่โมง?`
      ]
    };
  }, [primaryStatus]);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);

  const [favoritesList, setFavoritesList] = useState<FavoriteItem[]>(() => getFavoriteLocations());
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [showDataHubModal, setShowDataHubModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubFav = subscribeFavorites((favs) => {
      setFavoritesList(favs);
    });
    return () => unsubFav();
  }, []);

  const handleClearChat = () => {
    setMessages([]);
    stopAllSpeech();
  };

  useEffect(() => {
    if (messages.length > 0 || isThinking) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, isThinking]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    const unsubVoice = subscribeAiVoiceState((state) => {
      setActiveSpeakingId(state.activeId);
    });
    return () => {
      unsubVoice();
      stopAllSpeech();
    };
  }, []);

  // ซ่อนรายละเอียดเยอะๆ ไว้เป็นค่าเริ่มต้น (ให้ผู้ใช้กดปุ่มขยายดูเองถ้าอยากรู้ เพื่อไม่ให้งง)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [showPastHistory, setShowPastHistory] = useState(false);

  // หมวดหมู่ข้อมูลที่โหลดเตรียมไว้ในเว็บและจัดเรียงเรียลไทม์แล้ว
  const [activeCategoryTab, setActiveCategoryTab] = useState<PreloadedCategoryTab>('rain_ranked');
  const [showAllCategoryRows, setShowAllCategoryRows] = useState(false);

  // ตัวช่วยกรอกจุดเริ่มต้น A -> ปลายทาง B แบบคล่องตัว
  const [showRouteBuilder, setShowRouteBuilder] = useState(false);
  const [routeOriginInput, setRouteOriginInput] = useState('');
  const [routeDestInput, setRouteDestInput] = useState('');

  const composerDockRef = useRef<HTMLDivElement | null>(null);
  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const routeOriginRef = useRef<HTMLInputElement | null>(null);
  const activeAnswerRef = useRef<HTMLDivElement | null>(null);
  const expandedDetailsRef = useRef<HTMLDivElement | null>(null);
  const preloadedHubRef = useRef<HTMLDivElement | null>(null);

  const latestAssistantMsg = useMemo<AiChatMessage>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return messages[i];
      }
    }
    return initialWelcomeMessage;
  }, [messages, initialWelcomeMessage]);

  const latestUserQuestion = useMemo<string | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].text;
      }
    }
    return null;
  }, [messages]);

  const olderAssistantMessages = useMemo(() => {
    const allAssistants = messages.filter((m) => m.role === 'assistant');
    if (allAssistants.length <= 1) return [];
    return allAssistants.slice(0, -1).reverse();
  }, [messages]);

  const liveTypingSuggestions = useMemo(
    () => getLiveSmartTypingSuggestions(inputText, selectedLocations),
    [inputText, selectedLocations]
  );

  // ปรับความสูงช่องพิมพ์อัตโนมัติตามข้อความที่กำลังพิมพ์ (ขนาดใหญ่สไตล์ Gemini)
  useEffect(() => {
    const el = mainTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const computedHeight = Math.max(56, Math.min(el.scrollHeight, 180));
    el.style.height = `${computedHeight}px`;
  }, [inputText]);

  const handleCopyMessageText = (msgId: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  const handleFeedback = (msgId: string, rating: 'up' | 'down') => {
    setFeedbackMap((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === rating ? (undefined as any) : rating
    }));
  };

  const handleSwapRoutePoints = () => {
    const temp = routeOriginInput;
    setRouteOriginInput(routeDestInput);
    setRouteDestInput(temp);
  };

  const ensureInputVisibleAboveKeyboard = (targetEl?: HTMLElement | null) => {
    setTimeout(() => {
      const dock = targetEl || composerDockRef.current;
      if (dock) {
        dock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  const scrollToActiveAnswer = () => {
    setTimeout(() => {
      activeAnswerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 60);
  };

  const handleSendQuestion = async (questionText: string) => {
    const clean = questionText.trim();
    if (!clean || isThinking) return;

    // ปิดแป้นพิมพ์มือถือและพับรายละเอียดเก่าลง เพื่อให้เห็นคำตอบสำคัญชัดเจนทันทีในหน้าเดียว
    mainTextareaRef.current?.blur();
    routeOriginRef.current?.blur();
    setIsInputFocused(false);
    setIsDetailsExpanded(false);

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: clean,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };

    const baseHistory = messages.length > 0 ? messages : [initialWelcomeMessage];
    // โฟกัสเฉพาะคำถามและคำตอบก่อนหน้าล่าสุดเหมือนเป็นเรื่องเดียวกัน (ตามความสามารถของ Gemini)
    const immediatePrevContext =
      messages.length >= 2 ? messages.slice(-2) : [initialWelcomeMessage];

    // 1. ตอบทันที (0ms) จากข้อมูลที่โหลดเตรียมไว้ในเว็บ พร้อมให้ AI ตอบด้วยเสียงสรุปตรงประเด็นอัตโนมัติทันที!
    const instantReply = getInstantAiAnswerFromPreloadedWebData(
      clean,
      selectedLocations,
      immediatePrevContext
    );
    if (instantReply) {
      const nextHistory = [...baseHistory, userMsg, instantReply];
      setMessages(nextHistory);
      setInputText('');
      scrollToActiveAnswer();

      // ให้ AI ตอบด้วยเสียงอัตโนมัติด้วยข้อความสรุปตรงประเด็นของผู้ใช้งานทันที (ไม่ต้องกดปุ่ม)
      speakAiDirectSummaryAutomatically(
        instantReply.id,
        buildAiMessageSpeechScript(instantReply)
      );

      // อัปเดตคำตอบเสริมจากเซิร์ฟเวอร์ Gemini ในพื้นหลังแบบไม่บล็อกหน้าจอ โดยส่งเฉพาะบริบทของคำถามก่อนหน้า
      askSmartWeatherTrafficAi(clean, selectedLocations, immediatePrevContext)
        .then((refinedReply) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === instantReply.id
                ? {
                    ...refinedReply,
                    id: instantReply.id,
                    conversationContext:
                      refinedReply.conversationContext || instantReply.conversationContext
                  }
                : m
            )
          );
        })
        .catch(() => {});
      return;
    }

    // 2. กรณีเป็นชื่อสถานที่เฉพาะนอกฐานข้อมูลหลัก (เช่น หมู่บ้าน/ซอยย่อย) ให้ค้นหาสดแล้วพูดสรุปทันทีที่ได้คำตอบ
    const currentHistory = [...baseHistory, userMsg];
    setMessages(currentHistory);
    setInputText('');
    setIsThinking(true);
    scrollToActiveAnswer();

    try {
      const aiReply = await askSmartWeatherTrafficAi(
        clean,
        selectedLocations,
        immediatePrevContext
      );
      setMessages((prev) => [...prev, aiReply]);
      scrollToActiveAnswer();

      speakAiDirectSummaryAutomatically(
        aiReply.id,
        buildAiMessageSpeechScript(aiReply)
      );
    } finally {
      setIsThinking(false);
    }
  };

  const handleToggleExpandDetails = () => {
    const next = !isDetailsExpanded;
    setIsDetailsExpanded(next);
    if (next) {
      setTimeout(() => {
        expandedDetailsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }, 80);
    } else {
      scrollToActiveAnswer();
    }
  };

  const handleToggleRouteBuilder = () => {
    const next = !showRouteBuilder;
    setShowRouteBuilder(next);
    if (next) {
      setTimeout(() => {
        composerDockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        routeOriginRef.current?.focus();
      }, 60);
    }
  };

  const handleRouteQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = routeOriginInput.trim() || 'ดอนเมือง';
    const b = routeDestInput.trim() || 'ฟิวเจอร์พาร์ค รังสิต';
    setShowRouteBuilder(false);
    handleSendQuestion(`เดินทางจาก ${a} ไป ${b} รถติดไหม มีน้ำท่วมไหม และฝนจะตกกี่โมง?`);
  };

  const handleManualRefreshPreloadedData = async () => {
    if (isRefreshingWebData) return;
    setIsRefreshingWebData(true);
    try {
      await preloadMajorWebRealtimeData(true);
      setRealtimeTick((t) => t + 1);
    } finally {
      setIsRefreshingWebData(false);
    }
  };

  const handleSelectCategoryTab = (tab: PreloadedCategoryTab) => {
    setActiveCategoryTab(tab);
    setShowAllCategoryRows(false);
    setTimeout(() => {
      preloadedHubRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const renderGeminiComposer = () => (
    <div
      ref={composerDockRef}
      className="w-full transition-all"
    >
      <div
        className={`rounded-[28px] sm:rounded-[32px] bg-[#f0f4f9] border border-slate-200/90 shadow-md p-3 sm:p-4 space-y-2.5 transition-all duration-200 ${
          isInputFocused
            ? 'bg-white border-blue-400 ring-4 ring-blue-500/15 shadow-xl'
            : 'hover:border-slate-300'
        }`}
      >
        {/* แถบแสดงบริบทการสนทนาเรื่องเดียวกันจากคำถามก่อนหน้า */}
        {latestUserQuestion && latestAssistantMsg.conversationContext && (
          <div className="rounded-2xl bg-indigo-50/90 border border-indigo-200/90 px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
              <span className="text-[11px] sm:text-xs font-black text-indigo-950 truncate">
                กำลังสนทนาต่อเนื่องเรื่อง: “{latestUserQuestion}” ({latestAssistantMsg.conversationContext.shortContextTitle})
              </span>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 shrink-0">
              ถามต่อได้ทันที เช่น “แล้วรถติดไหม”, “แล้วบ่าย 3 ล่ะ”, “รถเล็กผ่านได้ไหม”
            </span>
          </div>
        )}

        {/* แถบแสดงข้อความที่กำลังพิมพ์สดๆ + แนะนำสถานที่/คำถามด้วยพิกัดรัศมีอัตโนมัติ */}
        {isInputFocused && inputText.trim().length > 0 && (
          <div className="rounded-2xl bg-blue-50/80 border border-blue-200 px-3.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-black text-blue-950 truncate">
                กำลังพิมพ์: “{inputText}”
              </p>
              <span className="text-[11px] font-bold text-blue-700 shrink-0">
                กด Enter หรือปุ่มลูกศรเพื่อส่ง
              </span>
            </div>
            {liveTypingSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-blue-200/70">
                <span className="text-[10px] font-black text-blue-800">คำถามแนะนำ:</span>
                {liveTypingSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSendQuestion(sug);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-600 hover:text-white border border-blue-200 text-[11px] font-extrabold text-blue-950 transition-colors cursor-pointer shadow-2xs"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ช่องพิมพ์ข้อความขนาดใหญ่สไตล์ Gemini Textarea */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuestion(inputText);
          }}
          className="space-y-2"
        >
          <div className="relative px-1 pt-0.5">
            <textarea
              ref={mainTextareaRef}
              rows={2}
              value={inputText}
              onFocus={() => {
                setIsInputFocused(true);
                ensureInputVisibleAboveKeyboard(composerDockRef.current);
              }}
              onBlur={() => {
                setTimeout(() => setIsInputFocused(false), 150);
              }}
              onChange={(e) => {
                setInputText(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendQuestion(inputText);
                }
              }}
              placeholder='ถาม "หมอดูฝน" เกี่ยวกับฝนตก สภาพจราจร หรือน้ำท่วม... (เช่น "ดอนเมือง บ่าย 2 ฝนตกไหม", "จากสรงประภาไปรังสิต รถติดไหม")'
              className="w-full resize-none bg-transparent text-base sm:text-lg font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none leading-relaxed min-h-[52px] sm:min-h-[58px]"
            />
          </div>

          {/* แผงกรอก จุดเริ่มต้น A -> ปลายทาง B */}
          {showRouteBuilder && (
            <div className="rounded-2xl bg-white border border-blue-200/90 p-3 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-blue-600" />
                  <span>วางแผนเส้นทาง A ➔ B (วิเคราะห์รถติด • น้ำท่วม • พยากรณ์ฝนตลอดสาย)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowRouteBuilder(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="w-full sm:flex-1">
                  <input
                    ref={routeOriginRef}
                    type="text"
                    value={routeOriginInput}
                    onFocus={() => ensureInputVisibleAboveKeyboard(composerDockRef.current)}
                    onChange={(e) => setRouteOriginInput(e.target.value)}
                    placeholder="จุดเริ่มต้น (A) เช่น ดอนเมือง, สรงประภา"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-sm sm:text-base font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSwapRoutePoints}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  title="สลับจุดเริ่มต้นและปลายทาง"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>

                <div className="w-full sm:flex-1">
                  <input
                    type="text"
                    value={routeDestInput}
                    onFocus={() => ensureInputVisibleAboveKeyboard(composerDockRef.current)}
                    onChange={(e) => setRouteDestInput(e.target.value)}
                    placeholder="ปลายทาง (B) เช่น ฟิวเจอร์รังสิต, สยาม"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-sm sm:text-base font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRouteQuickSubmit}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  เช็คเส้นทาง
                </button>
              </div>
            </div>
          )}

          {/* แถบเครื่องมือด้านล่างกล่องแชท สไตล์ Gemini Bottom Bar */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
            {/* ฝั่งซ้าย: เครื่องมือด่วน (Gemini Tools Pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={handleToggleRouteBuilder}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  showRouteBuilder
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200/80 shadow-2xs'
                }`}
              >
                <Route className="w-3.5 h-3.5 text-blue-500" />
                <span>เส้นทาง A ➔ B</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUseCurrentLocation();
                  scrollToActiveAnswer();
                }}
                disabled={isLocatingGps}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-950 border border-slate-200/80 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs disabled:opacity-60"
              >
                {isLocatingGps ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <LocateFixed className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>พิกัดฉัน</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSendQuestion('วันนี้ฝนจะตกที่ไหน กี่โมงบ้าง และโอกาสเกิดกี่เปอร์เซ็นต์?')
                }
                disabled={isThinking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-950 border border-slate-200/80 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <CloudRain className="w-3.5 h-3.5 text-sky-500" />
                <span>เรดาร์ฝน</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSendQuestion('ตอนนี้น้ำท่วมหรือมีน้ำขังรอระบายที่ไหนบ้าง?')
                }
                disabled={isThinking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-950 border border-slate-200/80 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <Droplets className="w-3.5 h-3.5 text-amber-500" />
                <span>น้ำท่วม</span>
              </button>

              {favoritesList.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleSendQuestion('สรุปสภาพน้ำท่วม ฝนตก และการจราจรทุกสถานที่โปรดของฉัน')
                  }
                  disabled={isThinking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-950 border border-slate-200/80 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  <span>ที่โปรด</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDataHubModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-950 border border-slate-200/80 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>ข้อมูลสด</span>
              </button>
            </div>

            {/* ฝั่งขวา: ปุ่มล้างข้อความ + ปุ่มไมค์ + ปุ่มส่งกลมสไตล์ Gemini Send Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {inputText && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    mainTextareaRef.current?.focus();
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                  aria-label="ล้างข้อความ"
                  title="ล้างข้อความ"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  handleSendQuestion(
                    inputText.trim() ||
                      `สรุปสถานการณ์ฝน น้ำท่วม และจราจรบริเวณ ${primaryStatus?.location.name || 'พื้นที่ปัจจุบัน'} ตอนนี้`
                  );
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                title="สั่งงานด้วยเสียง / สอบถามทันที"
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() || isThinking}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                  inputText.trim() && !isThinking
                    ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-blue-500/30 hover:scale-105 active:scale-95 cursor-pointer'
                    : 'bg-slate-200/90 text-slate-400 cursor-not-allowed'
                }`}
                title="ส่งคำถาม (Enter)"
                aria-label="ส่งคำถาม"
              >
                <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5 ml-0.5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Gemini Disclaimer */}
      <p className="text-[11px] text-center text-slate-500 font-medium pt-1 px-2">
        หมอดูฝน AI • อาจแสดงข้อมูลคลาดเคลื่อนได้ กรุณาตรวจสอบข้อมูลร่วมกับการเตือนภัยจริงและเรดาร์สด
      </p>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-white text-slate-900 select-text">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Gemini Left Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-10 w-72 sm:w-80 bg-[#f0f4f9] border-r border-slate-200/80 flex flex-col h-full transition-all duration-300 ease-in-out shrink-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:-ml-72 md:lg:-ml-80'
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/60 shrink-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
            title="ปิดแถบข้าง"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              handleClearChat();
              if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarOpen(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#dfe3e7] hover:bg-[#d3d8de] text-slate-800 text-xs sm:text-sm font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>แชทใหม่</span>
          </button>
        </div>

        {/* Sidebar Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs font-semibold">
          {/* Quick Topics */}
          <div>
            <p className="px-3 py-1 text-[11px] font-black uppercase text-slate-500 tracking-wider">
              หัวข้อล่าสุด
            </p>
            <div className="mt-1 space-y-1">
              {[
                { label: '🌊 เช็คจุดน้ำท่วมและน้ำเอ่อล้นวันนี้', query: 'ตอนนี้น้ำท่วมหรือมีน้ำขังรอระบายที่ไหนบ้าง และรถติดไหม?' },
                { label: '🚗 สภาพจราจร ดอนเมือง - รังสิต', query: 'เดินทางจาก ดอนเมือง ไป ฟิวเจอร์พาร์ค รังสิต รถติดไหม มีน้ำท่วมไหม?' },
                { label: '🌧️ พยากรณ์เรดาร์ฝนสดวันนี้', query: 'วันนี้ฝนจะตกที่ไหน กี่โมงบ้าง และโอกาสเกิดกี่เปอร์เซ็นต์?' },
                { label: '📍 ตรวจสอบสภาพรอบตำแหน่งฉัน', query: `รายงานสภาพอากาศ ฝนตกไหม น้ำท่วมไหม และการจราจรบริเวณ ${primaryStatus?.location.name || 'พื้นที่ปัจจุบัน'} ตอนนี้` },
                { label: '⭐ สรุปทุกสถานที่โปรด', query: 'สรุปสภาพน้ำท่วม ฝนตก และการจราจรทุกสถานที่โปรดของฉัน' }
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    handleSendQuestion(item.query);
                    if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-200/70 text-slate-700 hover:text-slate-950 transition-colors flex items-center gap-2.5 cursor-pointer truncate"
                >
                  <Bot className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Favorites in Sidebar */}
          {favoritesList.length > 0 && (
            <div className="border-t border-slate-200/80 pt-3">
              <p className="px-3 py-1 text-[11px] font-black uppercase text-amber-700 tracking-wider flex items-center justify-between">
                <span>⭐ สถานที่โปรด</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-mono">{favoritesList.length}</span>
              </p>
              <div className="mt-1 space-y-1">
                {favoritesList.map((fav) => (
                  <button
                    key={fav.id}
                    type="button"
                    onClick={() => {
                      handleSendQuestion(`แถว ${fav.customLabel || fav.name} ตอนนี้น้ำท่วมไหม ฝนตกไหม รถติดไหม?`);
                      if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-100/60 text-slate-800 hover:text-amber-950 transition-colors flex items-center gap-2 cursor-pointer truncate"
                  >
                    <span>{fav.iconType === 'home' ? '🏠' : fav.iconType === 'work' ? '🏢' : '⭐'}</span>
                    <span className="truncate font-bold">{fav.customLabel || fav.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Data Shortcut Card */}
          <div className="border-t border-slate-200/80 pt-3 px-1">
            <button
              type="button"
              onClick={() => setShowDataHubModal(true)}
              className="w-full p-3 rounded-2xl bg-white hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 text-left transition-colors cursor-pointer space-y-1 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>คลังข้อมูลสดรัฐในเว็บ</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                น้ำ {preloadedData.totalWaterStations.toLocaleString()} จุด • ฝน {preloadedData.totalRainStations.toLocaleString()} จุด
              </p>
              <span className="inline-block text-[11px] font-bold text-emerald-700 pt-0.5">
                คลิกเปิดดูตารางสด →
              </span>
            </button>
          </div>
        </div>

        {/* Sidebar Bottom Footer */}
        <div className="p-3 border-t border-slate-200/80 bg-[#f0f4f9] space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => onSwitchToAdvancedMode()}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>โหมดแผนที่ & แดชบอร์ดเต็มจอ</span>
          </button>

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
            <span>อัปเดต {preloadedData.updatedAt} น.</span>
            <button
              type="button"
              onClick={handleManualRefreshPreloadedData}
              disabled={isRefreshingWebData}
              className="text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshingWebData ? 'animate-spin' : ''}`} />
              <span>รีเฟรช</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Gemini View */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-white relative">
        {/* Gemini Header */}
        <header className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-md sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                title="เปิดเมนูแถบข้าง"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Gemini Brand Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#4285f4] via-[#9b72cf] to-[#d96570] text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 font-sans">
                หมอดูฝน
              </span>
            </div>

            {/* Gemini Model Dropdown Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0f4f9] hover:bg-[#e4e9f0] border border-slate-200/80 text-xs font-bold text-slate-700 transition-colors cursor-pointer">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>หมอดูฝน AI</span>
              <span className="text-slate-400 font-normal">| เรดาร์ฝน & จราจร</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClearChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              title="เริ่มการสนทนาใหม่"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">แชทใหม่</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchToAdvancedMode()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-2xs"
              title="สลับไปโหมดแผนที่และตารางข้อมูล"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">โหมดแผนที่เต็มจอ</span>
              <span className="sm:hidden">แผนที่</span>
            </button>

            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                disabled={isRefreshingData}
                className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
                title="รีเฟรชข้อมูลสด"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshingData ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* User avatar circle */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center ring-2 ring-blue-100 shadow-2xs">
              P
            </div>
          </div>
        </header>

        {/* Scrollable Conversation Stream */}
        <div ref={activeAnswerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* GPS Banner if active */}
            {gpsStatusBanner && (
              <div
                className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 border ${
                  gpsStatusBanner.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : gpsStatusBanner.type === 'error'
                      ? 'bg-red-50 border-red-300 text-red-950'
                      : 'bg-sky-50 border-sky-300 text-sky-950'
                }`}
              >
                <span>{gpsStatusBanner.text}</span>
                {onClearGpsBanner && (
                  <button
                    type="button"
                    onClick={onClearGpsBanner}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* When Empty: Centered Gemini Hero Greeting + 4 Suggestion Cards */}
            {messages.length === 0 ? (
              <div className="py-8 sm:py-16 space-y-8 max-w-3xl mx-auto">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#4285f4] via-[#9b72cf] to-[#d96570] text-white flex items-center justify-center shadow-md">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-[#4285f4] via-[#9b72cf] to-[#d96570] bg-clip-text text-transparent tracking-tight">
                    สวัสดีครับ, หมอดูฝนยินดีช่วยคุณ
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 font-semibold leading-relaxed">
                    ผู้ช่วยเดินทางอัจฉริยะ รายงานสดระดับน้ำท่วมขัง เรดาร์ฝนตกรายชั่วโมง สีการจราจรติดขัด และวางแผนเส้นทางเชื่อมโยงข้อมูลจริงทั่วประเทศ
                  </p>
                </div>

                {/* 4 Gemini Suggestion Prompt Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSendQuestion('ตอนนี้น้ำท่วมหรือมีน้ำขังรอระบายที่ไหนบ้าง และรถติดไหม?')}
                    className="text-left p-4 rounded-2xl bg-white hover:bg-sky-50/70 border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group space-y-2"
                  >
                    <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                      <Droplets className="w-4.5 h-4.5 text-sky-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-sky-700 transition-colors">
                        น้ำท่วม & รถติดตอนนี้
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        สำรวจจุดน้ำท่วมขัง ถนนที่ควรเลี่ยง และสถานะจราจรสด
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendQuestion('เดินทางจาก ดอนเมือง ไป ฟิวเจอร์พาร์ค รังสิต รถติดไหม มีน้ำท่วมไหม?')}
                    className="text-left p-4 rounded-2xl bg-white hover:bg-indigo-50/70 border border-slate-200/90 hover:border-indigo-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group space-y-2"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                      <Route className="w-4.5 h-4.5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                        วางแผนเส้นทาง A ➔ B
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        เช็คเส้นทางเดินทางว่ารถติดไหม น้ำท่วมไหม ฝนตกกี่โมง
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendQuestion('วันนี้ฝนจะตกที่ไหน กี่โมงบ้าง และโอกาสเกิดกี่เปอร์เซ็นต์?')}
                    className="text-left p-4 rounded-2xl bg-white hover:bg-blue-50/70 border border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group space-y-2"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                      <CloudRain className="w-4.5 h-4.5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                        พยากรณ์เรดาร์ฝนสด
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        ฝนจะตกกี่โมง โอกาสเกิดกี่เปอร์เซ็นต์ มีกลุ่มเมฆฝนไหม
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendQuestion('สรุปสภาพน้ำท่วม ฝนตก และการจราจรทุกสถานที่โปรดของฉัน')}
                    className="text-left p-4 rounded-2xl bg-white hover:bg-amber-50/70 border border-slate-200/90 hover:border-amber-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group space-y-2"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                      <Star className="w-4.5 h-4.5 text-amber-500 fill-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-amber-700 transition-colors">
                        สรุปสถานที่โปรด
                      </h4>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        เช็คสถานการณ์แถวบ้าน ที่ทำงาน และจุดที่บันทึกไว้ทั้งหมด
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* Active Conversation Thread */
              <div className="space-y-4">
                {/* Thread Header with message count & clear */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-800">
                      บทสนทนาต่อเนื่อง
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      ({messages.length} ข้อความ)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>ล้างแชท</span>
                  </button>
                </div>

        {/* เธรดข้อความทั้งหมด (Scrollable Thread) */}
        <div className="space-y-4">
          {(messages.length > 0 ? messages : [initialWelcomeMessage]).map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end items-start gap-2.5 pl-6 sm:pl-16">
                  <div className="bg-[#f0f4f9] hover:bg-[#e9eef6] text-slate-900 border border-slate-200/90 rounded-[24px] rounded-tr-md px-4.5 py-3 shadow-2xs max-w-xl sm:max-w-2xl">
                    <p className="text-sm sm:text-base font-semibold whitespace-pre-wrap leading-relaxed text-slate-900">
                      {msg.text}
                    </p>
                    <span className="block text-[10px] text-slate-500 text-right mt-1 font-mono">
                      {msg.timestamp} น.
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              );
            }

            // Assistant Turn
            const isSpeakingThis = activeSpeakingId === msg.id;
            const isExpanded = expandedMessageIds.has(msg.id);

            return (
              <div
                key={msg.id}
                className="rounded-[28px] bg-white border border-slate-200/90 shadow-sm p-4.5 sm:p-5.5 space-y-4 transition-all"
              >
                {/* หัวการ์ดคำตอบ สไตล์ Gemini */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-black text-slate-950 truncate">
                          หมอดูฝน AI
                        </h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          พยากรณ์ฝน & น้ำท่วม
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500">
                        ข้อมูลสดในเว็บ • {msg.timestamp} น.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {/* ปุ่มฟังเสียงสรุป */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isSpeakingThis) {
                          stopAllSpeech();
                        } else {
                          speakAiDirectSummaryAutomatically(msg.id, buildAiMessageSpeechScript(msg));
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                        isSpeakingThis
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-sky-50 text-slate-800 hover:text-sky-950'
                      }`}
                      title={isSpeakingThis ? 'หยุดเสียง' : 'ฟังเสียงสรุป'}
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${isSpeakingThis ? 'animate-pulse' : ''}`} />
                      <span>{isSpeakingThis ? 'กำลังพูด...' : 'ฟังเสียง'}</span>
                    </button>

                    {/* ปุ่มบันทึกสถานที่โปรดของการ์ดนี้ */}
                    {msg.placeCards && msg.placeCards.length > 0 && (() => {
                      const targetLoc = msg.placeCards![0].location;
                      const isFav = isLocationFavorited(targetLoc);
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (isFav) {
                              removeLocationFromFavorites(targetLoc);
                            } else {
                              const label = targetLoc.roadName || `${targetLoc.tambon} (${targetLoc.amphoe})`;
                              addLocationToFavorites(targetLoc, label, targetLoc.roadName ? 'road' : 'star');
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black shrink-0 cursor-pointer transition-colors ${
                            isFav
                              ? 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200'
                              : 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-950 border border-slate-200'
                          }`}
                          title={isFav ? 'ลบออกจากสถานที่โปรด' : 'บันทึกจุดนี้เป็นสถานที่โปรด'}
                        >
                          <Star
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isFav ? 'text-amber-500 fill-amber-500' : 'text-slate-400'
                            }`}
                          />
                          <span>{isFav ? 'สถานที่โปรด ⭐' : 'บันทึกโปรด'}</span>
                        </button>
                      );
                    })()}

                    {/* ปุ่มดูแผนที่ */}
                    {msg.placeCards && msg.placeCards.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (msg.placeCards!.length > 1 && onApplyRouteToAdvancedMode) {
                            onApplyRouteToAdvancedMode(msg.placeCards!.map((c) => c.location));
                          } else {
                            onSwitchToAdvancedMode(msg.placeCards![0].location);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-sky-50 text-sky-800 text-xs font-black shrink-0 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>ดูแผนที่</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* แถบข้อความเสียงสรุป */}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 border flex items-start gap-2.5 transition-colors ${
                    isSpeakingThis
                      ? 'bg-sky-50 border-sky-400 text-sky-950 ring-2 ring-sky-400/20'
                      : 'bg-slate-50 border-slate-200/90 text-slate-800'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isSpeakingThis ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Volume2 className={`w-4 h-4 ${isSpeakingThis ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-black text-sky-900">
                        {isSpeakingThis ? 'AI กำลังพูดสรุปให้คุณฟัง:' : 'ข้อความเสียงสรุปตรงประเด็น:'}
                      </span>
                      {msg.isFollowUpContinuation && msg.previousQuestionRef && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900">
                          เชื่อมโยงจาก: “{msg.previousQuestionRef}”
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-relaxed">
                      “{buildAiMessageSpeechScript(msg)}”
                    </p>
                  </div>
                </div>

                {/* ฟันธงตรงประเด็น (Quick Verdict) */}
                {msg.quickVerdict ? (
                  <div
                    className={`rounded-2xl p-3.5 sm:p-4 border-2 flex items-start gap-3 ${
                      msg.quickVerdict.statusTone === 'warning'
                        ? 'bg-red-50/90 border-red-300 text-red-950'
                        : msg.quickVerdict.statusTone === 'caution'
                          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                          : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {msg.quickVerdict.statusTone === 'warning' ? (
                        <ShieldAlert className="w-6 h-6 text-red-600" />
                      ) : msg.quickVerdict.statusTone === 'caution' ? (
                        <CloudRain className="w-6 h-6 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      )}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      {msg.targetScopeLabel && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/80 border border-current/15 text-[11px] font-black">
                          🎯 {msg.targetScopeLabel}
                        </span>
                      )}
                      <p className="text-base sm:text-lg font-black leading-snug">
                        {msg.quickVerdict.headline}
                      </p>
                      <p className="text-xs sm:text-sm font-bold opacity-90 leading-relaxed">
                        {msg.quickVerdict.subtext}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-sky-50/60 border border-sky-200 px-3.5 py-3 space-y-1">
                    {formatSimpleMarkdownText(msg.text)}
                  </div>
                )}

                {/* Essential Highlights */}
                {msg.essentialHighlights && msg.essentialHighlights.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5">
                    {msg.essentialHighlights.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl bg-slate-50 border border-slate-200/90 px-3.5 py-2 flex items-start gap-2.5"
                      >
                        <span className="text-base leading-none mt-0.5 shrink-0">
                          {item.icon === 'rain'
                            ? '🌧️'
                            : item.icon === 'traffic'
                              ? '🚗'
                              : item.icon === 'water'
                                ? '🌊'
                                : '🛣️'}
                        </span>
                        <div className="text-xs sm:text-sm leading-snug min-w-0">
                          <span className="font-black text-slate-900 mr-1.5">{item.label}:</span>
                          <span className="font-bold text-slate-800">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ปุ่มขยายดูรายละเอียดเพิ่มเติม */}
                {((msg.rainPredictions && msg.rainPredictions.length > 0) ||
                  (msg.placeCards && msg.placeCards.length > 0) ||
                  msg.detailedText) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMessageIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(msg.id)) {
                            next.delete(msg.id);
                          } else {
                            next.add(msg.id);
                          }
                          return next;
                        });
                      }}
                      className={`w-full py-2.5 px-4 rounded-2xl border-2 font-black text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer ${
                        isExpanded
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white hover:bg-sky-50 text-sky-900 border-sky-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>
                          {isExpanded
                            ? 'ย่อรายละเอียดลง'
                            : `กดดูรายละเอียดเพิ่มเติม (พยากรณ์ฝน & สถานะรายจุด ${msg.placeCards?.length || 1} จุด)`}
                        </span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                    </button>
                  </div>
                )}

                {/* รายละเอียดเมื่อกดขยาย */}
                {isExpanded && (
                  <div className="space-y-4 pt-3 border-t-2 border-slate-100">
                    {msg.detailedText && (
                      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-1">
                        <p className="text-xs font-black text-slate-600 mb-1">ข้อมูลขยายความโดยละเอียด:</p>
                        {formatSimpleMarkdownText(msg.detailedText)}
                      </div>
                    )}

                    {/* ตารางเวลาฝนตกรายชั่วโมง */}
                    {msg.rainPredictions && msg.rainPredictions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                          <CloudRain className="w-4 h-4 text-sky-600" />
                          <span>พยากรณ์เวลาฝนตกรายชั่วโมง</span>
                        </h4>
                        <div className="grid grid-cols-1 gap-2.5">
                          {msg.rainPredictions.slice(0, 4).map((rp, rpIdx) => (
                            <div key={rpIdx} className="rounded-2xl p-3 border bg-sky-50/90 border-sky-300">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-black">
                                  {rp.shortPlaceName}
                                </span>
                                <span className="text-xs font-black text-slate-900">
                                  {rp.timeColloquial} • โอกาสฝน {rp.probabilityPercent}%
                                </span>
                              </div>
                              {rp.hourlyTimeline && (
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-2 border-t border-sky-200">
                                  {rp.hourlyTimeline.map((ht, hIdx) => (
                                    <div key={hIdx} className="rounded-xl p-1.5 text-center bg-white border border-slate-200">
                                      <span className="block text-[10px] font-bold text-slate-600">{ht.colloquial}</span>
                                      <span className="block text-xs font-black">{ht.prob}%</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* การ์ดสถานะรายจุด */}
                    {msg.placeCards && msg.placeCards.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                          <Car className="w-4 h-4 text-emerald-600" />
                          <span>รายละเอียดสีจราจรและระดับน้ำแต่ละจุด</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {msg.placeCards.map((card) => {
                            const tBadge = getTrafficEasyBadge(card.trafficColor);
                            const isCardFav = isLocationFavorited(card.location);
                            return (
                              <div key={card.id} className="rounded-2xl border border-slate-200 bg-white p-3 flex flex-col justify-between gap-2">
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="text-sm font-black text-slate-950">{card.placeTitle}</h5>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black border ${tBadge.bg}`}>
                                      <span className={`w-2 h-2 rounded-full ${tBadge.dot}`} />
                                      {card.status.trafficStatus.shortStatusLabel}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500">{card.areaSubtitle}</p>
                                  <div className="mt-2 text-xs font-bold text-slate-700 space-y-0.5 bg-slate-50 p-2 rounded-xl">
                                    <p>🚗 <strong>จราจร:</strong> {card.trafficEasyText}</p>
                                    <p>🌊 <strong>น้ำท่วม:</strong> {card.waterEasyText}</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isCardFav) {
                                        removeLocationFromFavorites(card.location);
                                      } else {
                                        const lbl = card.location.roadName || `${card.location.tambon} (${card.location.amphoe})`;
                                        addLocationToFavorites(card.location, lbl, card.location.roadName ? 'road' : 'star');
                                      }
                                    }}
                                    className={`inline-flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg cursor-pointer ${isCardFav ? 'bg-amber-100 text-amber-950' : 'text-slate-500 hover:text-amber-900'}`}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isCardFav ? 'text-amber-500 fill-amber-500' : ''}`} />
                                    <span>{isCardFav ? 'โปรด ⭐' : 'บันทึกโปรด'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onSwitchToAdvancedMode(card.location)}
                                    className="inline-flex items-center gap-1 text-xs font-black text-sky-700 hover:text-sky-950 cursor-pointer"
                                  >
                                    <span>ดูแผนที่</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* คำถามต่อเนื่อง (Follow-up suggestions) */}
                {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[11px] font-black text-slate-600 block">ถามต่อเนื่องในพื้นที่นี้:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {msg.followUpSuggestions.slice(0, 3).map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleSendQuestion(sug)}
                          disabled={isThinking}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 hover:text-sky-950 border border-slate-200 text-xs font-extrabold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3 text-sky-600 shrink-0" />
                          <span>{sug}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* แถบการทำงานและฟีดแบ็กสไตล์ Gemini (Gemini Action Bar) */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {/* ปุ่มคัดลอกคำตอบ */}
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyMessageText(msg.id, `${msg.text}\n\n${msg.detailedText || ''}`)
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="คัดลอกข้อความ"
                    >
                      {copiedMessageId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-extrabold">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>คัดลอก</span>
                        </>
                      )}
                    </button>

                    {/* ปุ่มฟังเสียง */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isSpeakingThis) {
                          stopAllSpeech();
                        } else {
                          speakAiDirectSummaryAutomatically(msg.id, buildAiMessageSpeechScript(msg));
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        isSpeakingThis
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      title={isSpeakingThis ? 'หยุดเสียง' : 'ฟังเสียงสรุป'}
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${isSpeakingThis ? 'animate-pulse' : ''}`} />
                      <span>{isSpeakingThis ? 'กำลังพูด' : 'ฟังเสียง'}</span>
                    </button>

                    {/* ปุ่มฟีดแบ็ก Thumbs up / down */}
                    <button
                      type="button"
                      onClick={() => handleFeedback(msg.id, 'up')}
                      className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                        feedbackMap[msg.id] === 'up'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title="คำตอบมีประโยชน์"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(msg.id, 'down')}
                      className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                        feedbackMap[msg.id] === 'down'
                          ? 'bg-red-100 text-red-700'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title="คำตอบไม่ตรงเป้าหมาย"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* ป้ายกำกับ หมอดูฝน */}
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    <span>หมอดูฝน AI</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* กล่องสถานะกำลังคิดของ AI สไตล์ Gemini Shimmering Pulse */}
          {isThinking && (
            <div className="rounded-[28px] bg-gradient-to-r from-blue-500/10 via-indigo-500/15 to-purple-500/10 border border-blue-200/90 shadow-sm p-4 sm:p-5 flex items-center gap-3.5 animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5 animate-spin" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>หมอดูฝน กำลังวิเคราะห์ข้อมูลสภาพอากาศและจราจร...</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                </p>
                {latestUserQuestion && (
                  <p className="text-xs font-semibold text-blue-700 truncate max-w-lg">
                    คำถาม: “{latestUserQuestion}”
                  </p>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
    )}

      {/* 4. ประวัติคำตอบก่อนหน้า (พับเก็บไว้เพื่อไม่ให้รกตา) */}
      {olderAssistantMessages.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-3.5">
          <button
            type="button"
            onClick={() => setShowPastHistory(!showPastHistory)}
            className="w-full flex items-center justify-between text-xs font-black text-slate-700 hover:text-slate-950 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              <span>ดูคำตอบก่อนหน้า ({olderAssistantMessages.length} รายการ)</span>
            </span>
            {showPastHistory ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showPastHistory && (
            <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
              {olderAssistantMessages.map((oldMsg) => (
                <div
                  key={oldMsg.id}
                  className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>คำตอบเมื่อ {oldMsg.timestamp} น.</span>
                  </div>
                  {oldMsg.quickVerdict && (
                    <p className="text-xs sm:text-sm font-black text-slate-900">
                      {oldMsg.quickVerdict.headline}
                    </p>
                  )}
                  <div className="text-xs text-slate-700 space-y-1">
                    {formatSimpleMarkdownText(oldMsg.text)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </div>

  {/* Floating Composer Docked at Bottom */}
  <footer className="shrink-0 w-full px-4 sm:px-6 pb-3 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent z-20">
    <div className="max-w-4xl mx-auto w-full">
      {renderGeminiComposer()}
    </div>
  </footer>
</div>

{/* Live Data Hub Modal / Drawer */}
{showDataHubModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
    <div
      ref={preloadedHubRef}
      className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
    >
      {/* Modal Header */}
      <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white">
                ข้อมูลสดในเว็บ (สสน. • กทม. • กรมทางหลวง)
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                พร้อมตอบ 0 วินาที
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              จัดเรียงจาก {preloadedData.totalPreloadedPlaces} โซนหลัก • สถานีน้ำ {preloadedData.totalWaterStations.toLocaleString()} แห่ง • สถานีฝน {preloadedData.totalRainStations.toLocaleString()} แห่ง (อัปเดต {preloadedData.updatedAt} น.)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDataHubModal(false)}
          className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Categories Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2.5 bg-slate-100 border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => handleSelectCategoryTab('rain_ranked')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeCategoryTab === 'rain_ranked'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <CloudRain className="w-3.5 h-3.5 shrink-0" />
          <span>1. อันดับโอกาสฝนตก</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectCategoryTab('traffic_ranked')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeCategoryTab === 'traffic_ranked'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Car className="w-3.5 h-3.5 shrink-0" />
          <span>2. อันดับสีจราจร</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectCategoryTab('flood_ranked')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeCategoryTab === 'flood_ranked'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Droplets className="w-3.5 h-3.5 shrink-0" />
          <span>3. อันดับน้ำท่วม</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectCategoryTab('popular_routes')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeCategoryTab === 'popular_routes'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Route className="w-3.5 h-3.5 shrink-0" />
          <span>4. เส้นทางฮิต A ➔ B</span>
        </button>
      </div>

      {/* Modal Scrollable Table Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
        {activeCategoryTab === 'rain_ranked' && (
          <>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1">
              <span>เรียงลำดับจากโอกาสเกิดฝนตกสูงสุด (%) ลงไปน้อยสุด (กดที่ชื่อเพื่อดูสรุปทันที)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {preloadedData.rainRanked
                .slice(0, showAllCategoryRows ? 14 : 6)
                .map((rp, idx) => (
                  <button
                    key={rp.location.id + idx}
                    type="button"
                    onClick={() => {
                      setShowDataHubModal(false);
                      handleSendQuestion(
                        `${rp.shortPlaceName} วันนี้ฝนจะตกกี่โมง และโอกาสเกิดกี่เปอร์เซ็นต์?`
                      );
                    }}
                    className="text-left rounded-2xl border border-slate-200 hover:border-sky-400 bg-slate-50/70 hover:bg-sky-50/60 p-3 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs sm:text-sm font-black text-slate-950 truncate">
                          {rp.shortPlaceName}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-600 mt-1 truncate">
                        {rp.timeColloquial} ({rp.timeClock}) • {rp.rainLabel}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-black tabular-nums shrink-0 ${
                        rp.probabilityPercent >= 60
                          ? 'bg-blue-600 text-white'
                          : rp.probabilityPercent >= 35
                            ? 'bg-sky-200 text-sky-950'
                            : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      ฝน {rp.probabilityPercent}%
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}

        {activeCategoryTab === 'traffic_ranked' && (
          <>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1">
              <span>เรียงลำดับจาก 🔴 รถติดขัด ➔ 🟡 ชะลอตัว ➔ 🟢 คล่องตัว (กดที่ชื่อเพื่อเช็คทันที)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {preloadedData.trafficRanked
                .slice(0, showAllCategoryRows ? 14 : 6)
                .map((card, idx) => {
                  const badge = getTrafficEasyBadge(card.trafficColor);
                  return (
                    <button
                      key={card.id + idx}
                      type="button"
                      onClick={() => {
                        setShowDataHubModal(false);
                        handleSendQuestion(
                          `แถว ${card.placeTitle.split('(')[0].trim()} ตอนนี้รถติดไหม?`
                        );
                      }}
                      className="text-left rounded-2xl border border-slate-200 hover:border-sky-400 bg-slate-50/70 hover:bg-sky-50/60 p-3 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-950 truncate">
                            {card.placeTitle.split('(')[0].trim()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-600 mt-1 truncate">
                          {card.trafficEasyText}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border shrink-0 ${badge.bg}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                        {card.status.trafficStatus.shortStatusLabel}
                      </span>
                    </button>
                  );
                })}
            </div>
          </>
        )}

        {activeCategoryTab === 'flood_ranked' && (
          <>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1">
              <span>เรียงลำดับตามความเสี่ยงน้ำท่วมขังและจุดน้ำล้นตลิ่ง สสน. ล่าสุด</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {preloadedData.floodRanked
                .slice(0, showAllCategoryRows ? 14 : 6)
                .map((card, idx) => {
                  const wBadge = getWaterEasyBadge(card.waterTier);
                  return (
                    <button
                      key={card.id + idx}
                      type="button"
                      onClick={() => {
                        setShowDataHubModal(false);
                        handleSendQuestion(
                          `แถว ${card.placeTitle.split('(')[0].trim()} ตอนนี้น้ำท่วมไหม รถเก๋งและมอเตอร์ไซค์ผ่านได้ไหม?`
                        );
                      }}
                      className="text-left rounded-2xl border border-slate-200 hover:border-sky-400 bg-slate-50/70 hover:bg-sky-50/60 p-3 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-950 truncate">
                            {card.placeTitle.split('(')[0].trim()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-600 mt-1 truncate">
                          {card.waterEasyText}
                        </p>
                      </div>

                      <span
                        className={`px-2 py-1 rounded-xl text-[11px] font-black border shrink-0 ${wBadge.lightBg}`}
                      >
                        {card.waterTier === 'normal' ? 'ถนนแห้ง' : 'เฝ้าระวัง'}
                      </span>
                    </button>
                  );
                })}
            </div>
          </>
        )}

        {activeCategoryTab === 'popular_routes' && (
          <>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1">
              <span>แตะเส้นทางที่ต้องการเพื่อดูสรุปทันทีว่า รถติดไหม น้ำท่วมไหม ฝนตกกี่โมง</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {preloadedData.popularRoutePresets.map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => {
                    setShowDataHubModal(false);
                    handleSendQuestion(rt.queryText);
                  }}
                  className="text-left rounded-2xl border border-slate-200 hover:border-sky-400 bg-slate-50/70 hover:bg-sky-50/60 p-3 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-950">
                      <span>{rt.originLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{rt.destLabel}</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                      กดเพื่อเช็คสีจราจร น้ำท่วม และพยากรณ์ฝนตลอดสาย
                    </p>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-800 shrink-0">
                    {rt.summaryBadge}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ปุ่มขยายดูรายการในหมวดหมู่นี้เพิ่ม */}
        {activeCategoryTab !== 'popular_routes' && (
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllCategoryRows(!showAllCategoryRows)}
              className="inline-flex items-center gap-1 text-xs font-black text-sky-700 hover:text-sky-950 py-1 px-3 rounded-xl hover:bg-sky-50 cursor-pointer"
            >
              <span>
                {showAllCategoryRows
                  ? 'ย่อรายการลง (แสดง 6 อันดับแรก)'
                  : `ดูเพิ่มอีก (${Math.min(14, preloadedData.totalPreloadedPlaces)} อันดับ)`}
              </span>
              {showAllCategoryRows ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={handleManualRefreshPreloadedData}
          disabled={isRefreshingWebData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingWebData ? 'animate-spin' : ''}`} />
          <span>อัปเดตข้อมูลสด</span>
        </button>
        <button
          type="button"
          onClick={() => setShowDataHubModal(false)}
          className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
        >
          ปิด
        </button>
      </div>
    </div>
  </div>
)}
</div>
);
};
