/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Car,
  CheckCircle2,
  CloudRain,
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Waves,
  X
} from 'lucide-react';
import {
  createLocationFromTambon,
  getIntraProvinceRouteLocations,
  getProvinceAmphoes,
  REGION_LABELS,
  THAI_PROVINCES_COORDS,
  ThaiLocation
} from './data/thaiLocations';
import {
  detectSituationQueryIntent,
  fetchRouteStatuses,
  getInstantRouteStatuses,
  getNationwideSituationReport,
  LocationRealtimeStatus,
  preloadMajorWebRealtimeData,
  resolveExactGpsLocation,
  SearchResultItem,
  searchLocalInstant,
  searchRoadsAndLocations,
  SituationQueryIntent,
  subscribeRealtimeBackgroundUpdates,
  warmupRealtimeDataEngine
} from './services/weatherWaterService';
import { WaypointCard } from './components/WaypointCard';
import { NationwideSituationPanel } from './components/NationwideSituationPanel';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallPrompt';
import {
  InAppDataCenter,
  InAppFocusTarget,
  InAppViewerTab
} from './components/InAppDataCenter';
import { AiChatbotView } from './components/AiChatbotView';
import { FavoritesBar } from './components/FavoritesBar';
import {
  addLocationToFavorites,
  isLocationFavorited,
  removeLocationFromFavorites
} from './services/favoritesService';

const STORAGE_START_LOC_KEY = 'thairoute_verified_start_loc_v8';
const STORAGE_TRAVEL_MODE_KEY = 'thairoute_verified_travel_mode_v8';
const STORAGE_WAYPOINTS_KEY = 'thairoute_verified_waypoints_v8';

const SITUATION_QUICK_QUERIES: Array<{
  label: string;
  query: string;
  intent: SituationQueryIntent;
  badgeColor: string;
}> = [
  {
    label: '🌊 ตอนนี้น้ำท่วมที่ไหนบ้าง',
    query: 'ตอนนี้น้ำท่วมที่ไหนบ้าง',
    intent: 'flood_now',
    badgeColor: 'bg-red-600 text-white hover:bg-red-700 border-red-700'
  },
  {
    label: '🌧️ ตอนนี้ฝนตกหนักที่ไหนบ้าง',
    query: 'ตอนนี้ฝนตกหนักที่ไหนบ้าง',
    intent: 'rain_now',
    badgeColor: 'bg-sky-600 text-white hover:bg-sky-700 border-sky-700'
  },
  {
    label: '🚦 ตอนนี้ถนนสายไหนรถติดบ้าง',
    query: 'ตอนนี้ถนนไหนรถติดบ้าง',
    intent: 'traffic_now',
    badgeColor: 'bg-amber-500 text-slate-950 hover:bg-amber-400 border-amber-500'
  }
];

const POPULAR_LANDMARK_SEARCHES = [
  'อนุสรณ์สถาน',
  'ฟิวเจอร์พาร์ค รังสิต',
  'สนามบินดอนเมือง',
  'เมืองทองธานี',
  'ตลาดสี่มุมเมือง',
  'ม.ธรรมศาสตร์ รังสิต',
  'เซ็นทรัลลาดพร้าว',
  'อนุสาวรีย์ชัยฯ'
];

const POPULAR_ROAD_SEARCHES = [
  'สรงประภา',
  'วิภาวดีรังสิต',
  'พหลโยธิน',
  'ลำลูกกา',
  'แจ้งวัฒนะ',
  'ติวานนท์',
  'รังสิต-นครนายก',
  'ลาดพร้าว',
  'พระราม 2'
];

type AppTab = 'all_in_one' | 'inspector' | 'situation' | 'data_center' | 'sources_app';
type ExperienceMode = 'ai_chat' | 'advanced';

export default function App() {
  useEffect(() => {
    warmupRealtimeDataEngine();
  }, []);

  // โหมดการทำงานหลัก: เริ่มต้นที่หน้าแชทบอท AI สไตล์ Gemini ('ai_chat') และเก็บเวอร์ชันแดชบอร์ดเดิมทั้งหมดไว้ในโหมดขั้นสูง ('advanced')
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('ai_chat');

  // แท็บย่อยภายในโหมดขั้นสูง (เริ่มต้นเป็น 'all_in_one' เพื่อดูครบทุกฟังก์ชันในหน้าเดียว)
  const [activeAppTab, setActiveAppTab] = useState<AppTab>('all_in_one');
  const [situationQueryText, setSituationQueryText] = useState<string>('ตอนนี้น้ำท่วมที่ไหนบ้าง');
  const [situationIntent, setSituationIntent] = useState<SituationQueryIntent>('flood_now');

  // สถานะศูนย์ดูแผนที่ เรดาร์ฝนสด และตารางข้อมูลรัฐในเว็บ (In-App Live Data & Map Center)
  const [inAppViewerTab, setInAppViewerTab] = useState<InAppViewerTab>('map_traffic');
  const [inAppFocusTarget, setInAppFocusTarget] = useState<InAppFocusTarget | null>(null);
  const inAppCenterRef = useRef<HTMLDivElement | null>(null);
  const situationSectionRef = useRef<HTMLDivElement | null>(null);

  // พื้นที่หลักที่กำลังตรวจสอบ (จุดที่ 1)
  const [selectedPrimaryLocation, setSelectedPrimaryLocation] = useState<ThaiLocation>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_START_LOC_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ThaiLocation;
        if (parsed?.name && parsed?.province) return parsed;
      }
    } catch {
      // ignore
    }
    return createLocationFromTambon('ปทุมธานี', 'อ.ลำลูกกา', 'ต.คูคต');
  });

  // ตัวเลือก Dropdown จังหวัด -> อำเภอ -> ตำบล ของจุดที่ 1
  const [startProvince, setStartProvince] = useState<string>(
    selectedPrimaryLocation.province || 'ปทุมธานี'
  );
  const startAmphoeList = useMemo(() => getProvinceAmphoes(startProvince), [startProvince]);
  const [startAmphoe, setStartAmphoe] = useState<string>(
    selectedPrimaryLocation.amphoe || startAmphoeList[0]?.name || 'อ.ลำลูกกา'
  );
  const startTambonList = useMemo(() => {
    const found = startAmphoeList.find((a) => a.name === startAmphoe) || startAmphoeList[0];
    return found ? found.tambons : [];
  }, [startAmphoeList, startAmphoe]);
  const [startTambon, setStartTambon] = useState<string>(
    selectedPrimaryLocation.tambon || startTambonList[0]?.name || 'ต.คูคต'
  );

  // โหมดเดินทางหลายจุด (เริ่มต้นเป็น false เพื่อแสดงเฉพาะจุดที่ 1 ก่อน)
  const [isTravelMode, setIsTravelMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_TRAVEL_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [waypoints, setWaypoints] = useState<ThaiLocation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_WAYPOINTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return getIntraProvinceRouteLocations('ปทุมธานี');
  });

  // ข้อมูลของข้อ 2 (จุดหมายปลายทาง)
  const destLocation = waypoints.length >= 2 ? waypoints[waypoints.length - 1] : waypoints[0];
  const [destProvince, setDestProvince] = useState<string>(destLocation?.province || 'ปทุมธานี');
  const destAmphoeList = useMemo(() => getProvinceAmphoes(destProvince), [destProvince]);
  const [destAmphoe, setDestAmphoe] = useState<string>(
    destLocation?.amphoe || destAmphoeList[1]?.name || destAmphoeList[0]?.name || ''
  );
  const destTambonList = useMemo(() => {
    const found = destAmphoeList.find((a) => a.name === destAmphoe) || destAmphoeList[0];
    return found ? found.tambons : [];
  }, [destAmphoeList, destAmphoe]);
  const [destTambon, setDestTambon] = useState<string>(
    destLocation?.tambon || destTambonList[0]?.name || ''
  );

  // ข้อมูลของข้อ 3 (จุดแวะพักระหว่างทาง)
  const [stopProvince, setStopProvince] = useState<string>('นครราชสีมา');
  const stopAmphoeList = useMemo(() => getProvinceAmphoes(stopProvince), [stopProvince]);
  const [stopAmphoe, setStopAmphoe] = useState<string>(
    () =>
      getProvinceAmphoes('นครราชสีมา').find((a) => a.name.includes('ปากช่อง'))?.name ||
      getProvinceAmphoes('นครราชสีมา')[0]?.name ||
      ''
  );
  const stopTambonList = useMemo(() => {
    const found = stopAmphoeList.find((a) => a.name === stopAmphoe) || stopAmphoeList[0];
    return found ? found.tambons : [];
  }, [stopAmphoeList, stopAmphoe]);
  const [stopTambon, setStopTambon] = useState<string>(
    () =>
      stopTambonList.find((t) => t.name.includes('หมูสี'))?.name ||
      stopTambonList[0]?.name ||
      ''
  );

  // ระบบค้นหาสถานที่สำคัญ ถนนใกล้เคียง ซอย ช่วงถนน ตำบล และคำถามสถานการณ์สด
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>('');
  const [quickSearchResults, setQuickSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [isSearchingRemote, setIsSearchingRemote] = useState<boolean>(false);
  const [searchTargetRole, setSearchTargetRole] = useState<'start' | 'dest' | 'stop'>('start');

  // ระบบขออนุญาตเข้าถึง GPS ของอุปกรณ์
  const [gpsPermissionState, setGpsPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsStatusBanner, setGpsStatusBanner] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  // สถานะการดึงข้อมูลจริงความเร็วสูง (แสดงผลทันที 0ms โดยไม่บล็อกหรือกระตุกหน้าจอ)
  const [statuses, setStatuses] = useState<LocationRealtimeStatus[]>(() =>
    getInstantRouteStatuses([selectedPrimaryLocation])
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const fetchRequestIdRef = useRef<number>(0);
  const searchSectionRef = useRef<HTMLDivElement | null>(null);
  const cardsSectionRef = useRef<HTMLDivElement | null>(null);
  const travelConfigRef = useRef<HTMLDivElement | null>(null);
  const waypointCardsListRef = useRef<HTMLDivElement | null>(null);

  const autoScrollToRef = (ref: React.RefObject<HTMLElement | null>, delayMs = 90) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, delayMs);
  };

  // ตรวจสอบสถานะสิทธิ์ GPS ของอุปกรณ์เมื่อเปิดแอป
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          setGpsPermissionState(result.state);
          result.onchange = () => {
            setGpsPermissionState(result.state);
          };
        })
        .catch(() => {});
    }
  }, []);

  // บันทึกจุดที่ 1 ลง LocalStorage และซิงค์เข้ากับจุดเริ่มต้นของเส้นทาง
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_START_LOC_KEY, JSON.stringify(selectedPrimaryLocation));
    } catch {
      // ignore
    }
    setWaypoints((prev) => {
      if (prev.length === 0) return [selectedPrimaryLocation];
      if (prev[0].id === selectedPrimaryLocation.id && prev[0].name === selectedPrimaryLocation.name) {
        return prev;
      }
      return [selectedPrimaryLocation, ...prev.slice(1)];
    });
  }, [selectedPrimaryLocation]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TRAVEL_MODE_KEY, String(isTravelMode));
      localStorage.setItem(STORAGE_WAYPOINTS_KEY, JSON.stringify(waypoints));
    } catch {
      // ignore
    }
  }, [isTravelMode, waypoints]);

  const activeLocations = useMemo(() => {
    if (!isTravelMode) {
      return [selectedPrimaryLocation];
    }
    return waypoints.length > 0 ? waypoints : [selectedPrimaryLocation];
  }, [isTravelMode, selectedPrimaryLocation, waypoints]);

  // ระบบดึงข้อมูลเรียลไทม์แบบ Non-Blocking (ไม่ทำให้หน้าจอกระตุกหรือเด้งกลับ)
  const loadRealtimeData = useCallback(
    async (isManualRefresh = false) => {
      const requestId = ++fetchRequestIdRef.current;

      if (!isManualRefresh) {
        setStatuses(getInstantRouteStatuses(activeLocations));
      }

      setRefreshing(true);

      try {
        if (isManualRefresh) {
          preloadMajorWebRealtimeData(true).catch(() => {});
        }
        const result = await fetchRouteStatuses(activeLocations, isManualRefresh);
        if (fetchRequestIdRef.current === requestId) {
          setStatuses(result);
        }
      } finally {
        if (fetchRequestIdRef.current === requestId) {
          setRefreshing(false);
        }
      }
    },
    [activeLocations]
  );

  useEffect(() => {
    loadRealtimeData(false);
    const unsubscribe = subscribeRealtimeBackgroundUpdates(() => {
      setStatuses((prev) => {
        const next = getInstantRouteStatuses(activeLocations);
        return next.length > 0 ? next : prev;
      });
    });
    const timer = setInterval(() => {
      loadRealtimeData(true);
    }, 180000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [loadRealtimeData, activeLocations]);

  // ระบบค้นหา 2 จังหวะแบบ Floating Overlay (ไม่ดันเนื้อหาหน้าเว็บให้เด้งขึ้นลงขณะพิมพ์)
  const handleSearchInputChange = (value: string) => {
    setQuickSearchQuery(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setQuickSearchResults([]);
      setIsSearchDropdownOpen(false);
      setIsSearchingRemote(false);
      return;
    }
    const instant = searchLocalInstant(trimmed);
    setQuickSearchResults(instant);
    setIsSearchDropdownOpen(true);
  };

  useEffect(() => {
    let active = true;
    const trimmed = quickSearchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setIsSearchingRemote(false);
      return;
    }

    setIsSearchingRemote(true);
    const timer = setTimeout(() => {
      searchRoadsAndLocations(trimmed)
        .then((res) => {
          if (active) {
            setQuickSearchResults(res);
            setIsSearchingRemote(false);
          }
        })
        .catch(() => {
          if (active) setIsSearchingRemote(false);
        });
    }, 160);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [quickSearchQuery]);

  // เปิดดูศูนย์แผนที่ เรดาร์ฝน หรือตารางข้อมูลรัฐในเว็บทันที พร้อมเลื่อนหน้าจอไปหาอัตโนมัติ
  const handleOpenInAppViewer = (tab: InAppViewerTab, focus?: InAppFocusTarget) => {
    setInAppViewerTab(tab);
    if (focus) {
      setInAppFocusTarget(focus);
    }
    if (activeAppTab !== 'all_in_one' && activeAppTab !== 'data_center') {
      setActiveAppTab('data_center');
    }
    autoScrollToRef(inAppCenterRef, 80);
  };

  // เปิดดูรายงานสถานการณ์สดทั่วไทย (เช่น "ตอนนี้น้ำท่วมที่ไหนบ้าง") พร้อมเลื่อนหน้าจอไปหาอัตโนมัติ
  const handleOpenSituationReport = (query: string, intent: SituationQueryIntent) => {
    setSituationQueryText(query);
    setSituationIntent(intent);
    setIsSearchDropdownOpen(false);
    setQuickSearchQuery('');
    if (activeAppTab !== 'all_in_one' && activeAppTab !== 'situation') {
      setActiveAppTab('situation');
    }
    autoScrollToRef(situationSectionRef, 80);
  };

  // เมื่อเลือกพื้นที่จากรายงานสถานการณ์สดหรือตารางในเว็บ ให้เปิดการ์ดพื้นที่นั้นและเลื่อนไปหาทันที
  const handleSelectLocationFromSituation = (loc: ThaiLocation) => {
    setSelectedPrimaryLocation(loc);
    setStartProvince(loc.province);
    setStartAmphoe(loc.amphoe);
    setStartTambon(loc.tambon);
    setInAppFocusTarget({
      title: loc.name,
      subtitle: `${loc.tambon} ${loc.amphoe} จ.${loc.province}`,
      lat: loc.lat,
      lng: loc.lng
    });
    if (activeAppTab !== 'all_in_one' && activeAppTab !== 'inspector') {
      setActiveAppTab('all_in_one');
    }
    autoScrollToRef(waypointCardsListRef, 80);
  };

  // เมื่อเลือกสถานที่โปรดจากแถบสถานที่โปรด
  const handleSelectFavoriteLocation = (favLoc: ThaiLocation) => {
    setSelectedPrimaryLocation(favLoc);
    setStartProvince(favLoc.province);
    setStartAmphoe(favLoc.amphoe);
    setStartTambon(favLoc.tambon);
    setInAppFocusTarget({
      title: favLoc.name,
      subtitle: `${favLoc.tambon} ${favLoc.amphoe} จ.${favLoc.province}`,
      lat: favLoc.lat,
      lng: favLoc.lng
    });
    setWaypoints((prev) => {
      if (prev.length === 0) return [favLoc];
      return [favLoc, ...prev.slice(1)];
    });
    if (experienceMode === 'advanced') {
      autoScrollToRef(waypointCardsListRef, 80);
    }
  };

  // ฟังก์ชันขออนุญาตเข้าถึง GPS ของอุปกรณ์
  const handleRequestDeviceGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatusBanner({
        type: 'error',
        text: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับระบบ GPS กรุณาพิมพ์ชื่อสถานที่หรือชื่อถนนด้านล่าง'
      });
      return;
    }

    setGpsLoading(true);
    setGpsStatusBanner({
      type: 'info',
      text: 'กำลังขออนุญาตเข้าถึงตำแหน่ง GPS ของอุปกรณ์... กรุณากด “อนุญาต (Allow)” บนหน้าจอแจ้งเตือน'
    });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setGpsPermissionState('granted');
          const resolved = await resolveExactGpsLocation(
            pos.coords.latitude,
            pos.coords.longitude
          );
          setSelectedPrimaryLocation(resolved);
          setStartProvince(resolved.province);
          setStartAmphoe(resolved.amphoe);
          setStartTambon(resolved.tambon);
          if (activeAppTab !== 'all_in_one' && activeAppTab !== 'inspector') {
            setActiveAppTab('all_in_one');
          }
          setGpsLoading(false);
          setGpsStatusBanner({
            type: 'success',
            text: `ระบุพิกัด GPS สำเร็จ: กำลังแสดงสภาพน้ำท่วมและสีจราจรของ “${resolved.name}” (จ.${resolved.province})`
          });
          if (experienceMode === 'advanced') {
            autoScrollToRef(waypointCardsListRef, 100);
          }
        } catch {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsPermissionState('denied');
          setGpsStatusBanner({
            type: 'error',
            text: 'การเข้าถึง GPS ถูกปฏิเสธ: กรุณากดไอคอนรูปกุญแจข้างแถบ URL ของเบราว์เซอร์ แล้วเลือก “อนุญาตตำแหน่งที่ตั้ง (Allow Location)”'
          });
        } else {
          setGpsStatusBanner({
            type: 'error',
            text: 'ไม่สามารถรับสัญญาณ GPS ได้ในขณะนี้ กรุณาพิมพ์ค้นหาชื่อสถานที่หรือชื่อถนนด้านล่างได้เลยครับ'
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  // เมื่อเลือกผลลัพธ์จากการค้นหา
  const handleSelectSearchResult = (item: SearchResultItem) => {
    if (item.category === 'situation_overview' && item.situationIntent) {
      handleOpenSituationReport(quickSearchQuery || item.title, item.situationIntent);
      return;
    }

    const loc = item.location;
    if (searchTargetRole === 'start' || !isTravelMode) {
      setSelectedPrimaryLocation(loc);
      setStartProvince(loc.province);
      setStartAmphoe(loc.amphoe);
      setStartTambon(loc.tambon);
    } else if (searchTargetRole === 'dest') {
      setDestProvince(loc.province);
      setDestAmphoe(loc.amphoe);
      setDestTambon(loc.tambon);
      setWaypoints((prev) => {
        if (prev.length < 2) return [selectedPrimaryLocation, loc];
        return [...prev.slice(0, prev.length - 1), loc];
      });
    } else {
      setWaypoints((prev) => {
        if (prev.length < 2) return [selectedPrimaryLocation, loc];
        const beforeDest = prev.slice(0, prev.length - 1);
        const finalDest = prev[prev.length - 1];
        return [...beforeDest, loc, finalDest];
      });
    }
    setQuickSearchQuery('');
    setQuickSearchResults([]);
    setIsSearchDropdownOpen(false);
    if (activeAppTab !== 'all_in_one' && activeAppTab !== 'inspector') {
      setActiveAppTab('all_in_one');
    }
    autoScrollToRef(waypointCardsListRef, 80);
  };

  // เมื่อกดปุ่ม "ค้นหาน้ำท่วม & จราจร" หรือกด Enter ในช่องค้นหา
  const handleSearchFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickSearchQuery.trim();
    if (!trimmed) return;

    const sitCheck = detectSituationQueryIntent(trimmed);
    if (sitCheck.intent) {
      handleOpenSituationReport(trimmed, sitCheck.intent);
      return;
    }

    if (quickSearchResults.length > 0) {
      handleSelectSearchResult(quickSearchResults[0]);
      return;
    }

    setIsSearchingRemote(true);
    const results = await searchRoadsAndLocations(trimmed);
    setIsSearchingRemote(false);
    if (results.length > 0) {
      handleSelectSearchResult(results[0]);
    }
  };

  // สลับช่วงของถนนเส้นเดียวกันหรือถนนใกล้เคียงพิกัดบนการ์ดโดยตรง (ไม่ทำให้หน้ากระโดด)
  const handleSelectRoadSegmentOnCard = (index: number, segmentLocation: ThaiLocation) => {
    const withRelated: ThaiLocation = {
      ...segmentLocation,
      relatedSegments:
        segmentLocation.relatedSegments ||
        selectedPrimaryLocation.relatedSegments ||
        waypoints[index]?.relatedSegments
    };

    if (!isTravelMode || index === 0) {
      setSelectedPrimaryLocation(withRelated);
      setStartProvince(withRelated.province);
      setStartAmphoe(withRelated.amphoe);
      setStartTambon(withRelated.tambon);
    } else {
      setWaypoints((prev) => {
        const next = [...prev];
        next[index] = withRelated;
        return next;
      });
    }
  };

  // เมื่อเปลี่ยน Dropdown จังหวัด -> อำเภอ -> ตำบล ของจุดที่ 1
  const handleSelectStartProvince = (provName: string) => {
    setStartProvince(provName);
    const amphoes = getProvinceAmphoes(provName);
    const firstA = amphoes[0]?.name || '';
    const firstT = amphoes[0]?.tambons[0]?.name || '';
    setStartAmphoe(firstA);
    setStartTambon(firstT);
    setSelectedPrimaryLocation(createLocationFromTambon(provName, firstA, firstT));
  };

  const handleSelectStartAmphoe = (amphoeName: string) => {
    setStartAmphoe(amphoeName);
    const found = startAmphoeList.find((a) => a.name === amphoeName);
    const firstT = found?.tambons[0]?.name || '';
    setStartTambon(firstT);
    setSelectedPrimaryLocation(createLocationFromTambon(startProvince, amphoeName, firstT));
  };

  const handleSelectStartTambon = (tambonName: string) => {
    setStartTambon(tambonName);
    setSelectedPrimaryLocation(createLocationFromTambon(startProvince, startAmphoe, tambonName));
    autoScrollToRef(waypointCardsListRef, 80);
  };

  // เปลี่ยนจังหวัดปลายทาง (ข้อ 2)
  const handleSelectDestProvince = (provName: string) => {
    setDestProvince(provName);
    const amphoes = getProvinceAmphoes(provName);
    const defaultA = amphoes.length > 1 ? amphoes[1] : amphoes[0];
    const aName = defaultA?.name || '';
    const tName = defaultA?.tambons[0]?.name || '';
    setDestAmphoe(aName);
    setDestTambon(tName);
    const newDest = createLocationFromTambon(provName, aName, tName);
    setWaypoints((prev) => {
      if (prev.length < 2) return [selectedPrimaryLocation, newDest];
      return [...prev.slice(0, prev.length - 1), newDest];
    });
  };

  const handleSelectDestAmphoe = (amphoeName: string) => {
    setDestAmphoe(amphoeName);
    const found = destAmphoeList.find((a) => a.name === amphoeName);
    const tName = found?.tambons[0]?.name || '';
    setDestTambon(tName);
    const newDest = createLocationFromTambon(destProvince, amphoeName, tName);
    setWaypoints((prev) => {
      if (prev.length < 2) return [selectedPrimaryLocation, newDest];
      return [...prev.slice(0, prev.length - 1), newDest];
    });
  };

  const handleSelectDestTambon = (tambonName: string) => {
    setDestTambon(tambonName);
    const newDest = createLocationFromTambon(destProvince, destAmphoe, tambonName);
    setWaypoints((prev) => {
      if (prev.length < 2) return [selectedPrimaryLocation, newDest];
      return [...prev.slice(0, prev.length - 1), newDest];
    });
    autoScrollToRef(waypointCardsListRef, 80);
  };

  // เปลี่ยนจังหวัดจุดแวะพัก (ข้อ 3)
  const handleSelectStopProvince = (provName: string) => {
    setStopProvince(provName);
    const amphoes = getProvinceAmphoes(provName);
    const aName = amphoes[0]?.name || '';
    const tName = amphoes[0]?.tambons[0]?.name || '';
    setStopAmphoe(aName);
    setStopTambon(tName);
  };

  const handleSelectStopAmphoe = (amphoeName: string) => {
    setStopAmphoe(amphoeName);
    const found = stopAmphoeList.find((a) => a.name === amphoeName);
    setStopTambon(found?.tambons[0]?.name || '');
  };

  const handleAddStopover = () => {
    const stopLoc = createLocationFromTambon(stopProvince, stopAmphoe, stopTambon);
    setWaypoints((prev) => {
      if (prev.length < 2) {
        return [selectedPrimaryLocation, stopLoc];
      }
      const beforeDest = prev.slice(0, prev.length - 1);
      const finalDest = prev[prev.length - 1];
      return [...beforeDest, stopLoc, finalDest];
    });
    autoScrollToRef(waypointCardsListRef, 80);
  };

  const handleEnableTravelMode = () => {
    setIsTravelMode(true);
    if (waypoints.length < 2) {
      const sample = getIntraProvinceRouteLocations(startProvince);
      const updated = [selectedPrimaryLocation, ...sample.slice(1)];
      setWaypoints(updated);
      const last = updated[updated.length - 1];
      if (last) {
        setDestProvince(last.province);
        setDestAmphoe(last.amphoe);
        setDestTambon(last.tambon);
      }
    }
    autoScrollToRef(travelConfigRef, 90);
  };

  const handleApplyPresetRoute = (type: 'intra_province' | 'bkk_khaoyai_phayao') => {
    setIsTravelMode(true);
    if (type === 'intra_province') {
      const intra = getIntraProvinceRouteLocations(startProvince);
      const customRoute = [selectedPrimaryLocation, ...intra.slice(1)];
      setWaypoints(customRoute);
      const last = customRoute[customRoute.length - 1];
      if (last) {
        setDestProvince(last.province);
        setDestAmphoe(last.amphoe);
        setDestTambon(last.tambon);
      }
    } else {
      const bkk = createLocationFromTambon('กรุงเทพมหานคร', 'เขตจตุจักร', 'แขวงจตุจักร');
      const khaoyai = createLocationFromTambon('นครราชสีมา', 'อ.ปากช่อง', 'ต.หมูสี');
      const nakhonsawan = createLocationFromTambon('นครสวรรค์', 'อ.เมืองนครสวรรค์', 'ต.ปากน้ำโพ');
      const phayao = createLocationFromTambon('พะเยา', 'อ.เมืองพะเยา', 'ต.เวียง');
      setSelectedPrimaryLocation(bkk);
      setStartProvince(bkk.province);
      setStartAmphoe(bkk.amphoe);
      setStartTambon(bkk.tambon);
      setDestProvince(phayao.province);
      setDestAmphoe(phayao.amphoe);
      setDestTambon(phayao.tambon);
      setWaypoints([bkk, khaoyai, nakhonsawan, phayao]);
    }
    autoScrollToRef(waypointCardsListRef, 90);
  };

  const handleRemoveWaypoint = (id: string) => {
    setWaypoints((prev) => {
      const filtered = prev.filter((w) => w.id !== id);
      return filtered.length > 0 ? filtered : [selectedPrimaryLocation];
    });
  };

  const handleMoveWaypoint = (index: number, direction: 'left' | 'right') => {
    setWaypoints((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const googleMapsRouteUrl = useMemo(() => {
    if (activeLocations.length < 2) {
      return `https://www.google.com/maps/search/?api=1&query=${activeLocations[0].lat},${activeLocations[0].lng}`;
    }
    const origin = `${activeLocations[0].lat},${activeLocations[0].lng}`;
    const destination = `${activeLocations[activeLocations.length - 1].lat},${activeLocations[activeLocations.length - 1].lng}`;
    const middle = activeLocations
      .slice(1, activeLocations.length - 1)
      .map((loc) => `${loc.lat},${loc.lng}`)
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      origin
    )}&destination=${encodeURIComponent(destination)}${
      middle ? `&waypoints=${encodeURIComponent(middle)}` : ''
    }&travelmode=driving`;
  }, [activeLocations]);

  const routeSummary = useMemo(() => {
    if (statuses.length === 0) return null;
    const criticalList = statuses.filter((s) => s.waterSafetyTier === 'critical');
    const dangerList = statuses.filter((s) => s.waterSafetyTier === 'danger');
    const watchList = statuses.filter((s) => s.waterSafetyTier === 'watch');

    if (criticalList.length > 0) {
      return {
        tier: 'critical' as const,
        title: `แจ้งเตือนระดับวิกฤต: พบจุดน้ำล้นตลิ่ง ${criticalList.length} จุด (${criticalList.map((c) => c.location.name).join(', ')})`,
        detail: 'น้ำท่วมระดับเอว ห้ามสัญจรผ่านจุดที่น้ำล้นตลิ่งเด็ดขาด กรุณาตรวจสอบเส้นทางเลี่ยงจากกรมทางหลวงหรือ Google Maps'
      };
    }
    if (dangerList.length > 0) {
      return {
        tier: 'danger' as const,
        title: `แจ้งเตือนระดับอันตราย: พบพื้นที่น้ำสูง/ฝนสะสมหนัก ${dangerList.length} จุด (${dangerList.map((c) => c.location.name).join(', ')})`,
        detail: 'น้ำท่วมระดับครึ่งแข้งถึงระดับเข่าในที่ลุ่มต่ำ รถเล็กและมอเตอร์ไซค์ควรเลี่ยงซอยริมคลองและใช้ถนนใหญ่สายหลักเท่านั้น'
      };
    }
    if (watchList.length > 0) {
      return {
        tier: 'watch' as const,
        title: `มีจุดเฝ้าระวังน้ำรอระบาย/น้ำในคลองมาก ${watchList.length} จุด (${watchList.map((c) => c.location.name).join(', ')})`,
        detail: 'ถนนสายหลักขับผ่านได้ปกติ แต่อาจมีน้ำขังระดับตาตุ่มริมไหล่ทางหรือถนนลื่นจากฝนสะสม โปรดขับขี่ด้วยความระมัดระวัง'
      };
    }
    return {
      tier: 'normal' as const,
      title: 'ตลอดเส้นทางสภาพน้ำปกติ • ถนนแห้ง ขับผ่านได้สบายทุกจุด',
      detail: 'ไม่มีรายงานน้ำล้นตลิ่งหรือฝนตกหนักสะสมในจุดที่เลือก รถทุกชนิดเดินทางได้ตามปกติ'
    };
  }, [statuses]);

  const nationwideQuickSummary = useMemo(
    () => getNationwideSituationReport('', 'flood_now'),
    [statuses]
  );

  const provincesByRegion = useMemo(() => {
    const groups: Record<string, typeof THAI_PROVINCES_COORDS> = {};
    for (const p of THAI_PROVINCES_COORDS) {
      const label = REGION_LABELS[p.region];
      if (!groups[label]) groups[label] = [];
      groups[label].push(p);
    }
    return groups;
  }, []);

  if (experienceMode === 'ai_chat') {
    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-white text-slate-900 font-sans">
        <OfflineIndicator />
        <AiChatbotView
          statuses={statuses}
          selectedLocations={activeLocations}
          isLocatingGps={gpsLoading}
          onUseCurrentLocation={handleRequestDeviceGps}
          onSwitchToAdvancedMode={(focusLoc) => {
            if (focusLoc) {
              setSelectedPrimaryLocation(focusLoc);
              setStartProvince(focusLoc.province);
              setStartAmphoe(focusLoc.amphoe);
              setStartTambon(focusLoc.tambon);
            }
            setExperienceMode('advanced');
            setActiveAppTab('all_in_one');
            autoScrollToRef(waypointCardsListRef, 120);
          }}
          onApplyRouteToAdvancedMode={(routeLocs) => {
            if (routeLocs.length >= 2) {
              setSelectedPrimaryLocation(routeLocs[0]);
              setWaypoints(routeLocs);
              setIsTravelMode(true);
            }
            setExperienceMode('advanced');
            setActiveAppTab('all_in_one');
            autoScrollToRef(waypointCardsListRef, 120);
          }}
          onSelectFavoriteLocation={handleSelectFavoriteLocation}
          gpsStatusBanner={gpsStatusBanner}
          onClearGpsBanner={() => setGpsStatusBanner(null)}
          onRefreshData={() => loadRealtimeData(true)}
          isRefreshingData={refreshing}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-28">
      <OfflineIndicator />

      {/* แถบหัวหลัก: คลีน ไม่รกตา สลับระหว่าง "ถาม AI" และ "โหมดขั้นสูง" ได้ในคลิกเดียว */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Zone 1: Brand Title */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setExperienceMode('ai_chat');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 text-sm sm:text-base font-black tracking-tight text-white whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-slate-950">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="hidden xs:inline">เช็คฝน · น้ำท่วม · รถติด</span>
            <span className="xs:hidden">ThaiRoute AI</span>
          </a>

          {/* Zone 2: Primary Mode Switcher (AI Chat Mode vs Advanced Mode) */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setExperienceMode('ai_chat');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap text-slate-300 hover:text-white"
            >
              <Bot className="w-4 h-4" />
              <span>ถามหมอดูฝน (AI)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExperienceMode('advanced');
                setActiveAppTab('all_in_one');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap bg-amber-400 text-slate-950 shadow-xs"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>โหมดขั้นสูง</span>
            </button>
          </div>

          {/* Zone 3: Single Clean Refresh Action */}
          <button
            type="button"
            onClick={() => loadRealtimeData(true)}
            disabled={refreshing}
            title="อัปเดตข้อมูลสด"
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-black transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'กำลังอัปเดต...' : 'อัปเดตสด'}</span>
          </button>
        </div>

        {/* แถบกระโดดไปแต่ละฟังก์ชันอัตโนมัติ (แสดงเฉพาะในโหมดขั้นสูง กดแล้วเลื่อนไปหาทันทีโดยไม่ต้องเลื่อนเอง) */}
        <div className="bg-slate-950/95 border-t border-slate-800 px-3 sm:px-6 py-1.5">
            <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-black text-amber-400 shrink-0 mr-1">
                ไปที่ฟังก์ชัน:
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveAppTab('all_in_one');
                  autoScrollToRef(searchSectionRef, 50);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                🔍 ค้นหาพื้นที่/ถนน
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveAppTab('all_in_one');
                  autoScrollToRef(waypointCardsListRef, 50);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                🚦 การ์ดสีจราจร & ระดับน้ำ
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveAppTab('all_in_one');
                  autoScrollToRef(inAppCenterRef, 50);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                🗺️ แผนที่ · เรดาร์ฝน · ตารางน้ำ
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveAppTab('all_in_one');
                  autoScrollToRef(situationSectionRef, 50);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                🌊 สรุปจุดน้ำท่วมทั่วไทย
              </button>
            </div>
          </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 space-y-5">
        {/* แถบสรุปภาพรวมทั้งประเทศแบบคลิกดูในเว็บได้ทันที (KPI Command Bar) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => handleOpenInAppViewer('water_table')}
            className="rounded-2xl bg-white hover:bg-red-50/60 border border-slate-200 hover:border-red-300 p-4 text-left transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-red-700">
                1. สถานีน้ำล้นตลิ่งตอนนี้ (สสน.)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
                {nationwideQuickSummary.overflowWaterStations.length}
              </span>
              <span className="text-xs font-bold text-sky-700">กดดูตารางในเว็บ →</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenInAppViewer('water_table')}
            className="rounded-2xl bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 p-4 text-left transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-amber-800">
                2. สถานีเฝ้าระวังน้ำมาก (80-100%)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
                {nationwideQuickSummary.watchWaterStations.length}
              </span>
              <span className="text-xs font-bold text-sky-700">กดดูตารางในเว็บ →</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenInAppViewer('weather_radar')}
            className="rounded-2xl bg-white hover:bg-sky-50/60 border border-slate-200 hover:border-sky-300 p-4 text-left transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-sky-800">
                3. จุดที่มีฝนตกสะสม 24 ชม.
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
                {nationwideQuickSummary.activeRainStations.length}
              </span>
              <span className="text-xs font-bold text-sky-700">ดูเรดาร์ฝนในเว็บ →</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleOpenInAppViewer('road_flood_matrix')}
            className="rounded-2xl bg-white hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 p-4 text-left transition-colors cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-800">
                4. สีจราจรบนถนนสายหลักตอนนี้
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            </div>
            <div className="mt-2 flex items-baseline justify-between font-mono tabular-nums text-xs sm:text-sm font-black">
              <div>
                <span className="text-red-700">แดง {nationwideQuickSummary.redTrafficRoads.length}</span>
                <span className="mx-1 text-slate-400">·</span>
                <span className="text-amber-700">เหลือง {nationwideQuickSummary.yellowTrafficRoads.length}</span>
                <span className="mx-1 text-slate-400">·</span>
                <span className="text-emerald-700">เขียว {nationwideQuickSummary.greenTrafficRoads.length}</span>
              </div>
              <span className="text-xs font-bold text-sky-700 font-sans">ดูตารางถนน →</span>
            </div>
          </button>
        </section>
        {/* แผงค้นหาหลักของโหมดขั้นสูง (เมื่อแตะพิมพ์จะเลื่อนให้อยู่ด้านบนของจอเสมอ แป้นพิมพ์ไม่บังช่องพิมพ์) */}
        <section
          ref={searchSectionRef}
          className="scroll-mt-24 rounded-3xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4"
        >
          {/* 1. แถบขออนุญาตเข้าถึง GPS ของอุปกรณ์ */}
          <div className="rounded-2xl bg-slate-900 text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                <LocateFixed className={`w-5 h-5 ${gpsLoading ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-white">
                    เช็คจุดที่คุณยืนหรือขับรถอยู่ตอนนี้ด้วย GPS อุปกรณ์
                  </h2>
                  <span
                    className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                      gpsPermissionState === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : gpsPermissionState === 'denied'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {gpsPermissionState === 'granted'
                      ? 'อนุญาต GPS แล้ว'
                      : gpsPermissionState === 'denied'
                        ? 'ถูกปิดกั้นสิทธิ์ GPS'
                        : 'พร้อมขอพิกัด GPS'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  กดปุ่มด้านขวาเพื่อดึงพิกัดถนนและสถานที่ใกล้ตัวคุณ พร้อมแสดงสีจราจร (เขียว-เหลือง-แดง) และระดับน้ำทันที
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestDeviceGps}
              disabled={gpsLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs sm:text-sm font-black shadow-sm transition-all cursor-pointer shrink-0"
            >
              <LocateFixed className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>
                {gpsLoading
                  ? 'กำลังระบุพิกัด GPS...'
                  : gpsPermissionState === 'granted'
                    ? 'อัปเดตตำแหน่ง GPS ของฉัน'
                    : 'ใช้ตำแหน่ง GPS ปัจจุบัน'}
              </span>
            </button>
          </div>

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
              <button
                type="button"
                onClick={() => setGpsStatusBanner(null)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 2. ช่องค้นหาอัจฉริยะ (รองรับทั้งคำถาม "ตอนนี้น้ำท่วมที่ไหนบ้าง", ชื่อสถานที่สำคัญ และชื่อถนน) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <label className="block text-base sm:text-lg font-black text-slate-900">
                  พิมพ์ค้นหาได้ทุกแบบ: “ตอนนี้น้ำท่วมที่ไหนบ้าง” • ชื่อสถานที่ (ไม่ต้องรู้ชื่อถนน) • ชื่อถนน/ตำบล
                </label>
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  พิมพ์คำถามเช่น <strong>“ตอนนี้น้ำท่วมที่ไหนบ้าง”</strong> เพื่อดูจุดน้ำท่วมทั้งหมด หรือพิมพ์ชื่อสถานที่เช่น{' '}
                  <strong>“อนุสรณ์สถาน”</strong> ระบบจะดึงถนนใกล้เคียงพร้อมสัญลักษณ์สีจราจรขึ้นมาให้ทันที
                </p>
              </div>

              {isTravelMode && (activeAppTab === 'all_in_one' || activeAppTab === 'inspector') && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-extrabold shrink-0">
                  <span className="px-2 text-slate-600">เลือกใส่ใน:</span>
                  <button
                    type="button"
                    onClick={() => setSearchTargetRole('start')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      searchTargetRole === 'start' ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    1. ต้นทาง
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchTargetRole('dest')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      searchTargetRole === 'dest' ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    2. ปลายทาง
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchTargetRole('stop')}
                    className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                      searchTargetRole === 'stop' ? 'bg-slate-900 text-white' : 'text-slate-700'
                    }`}
                  >
                    3. จุดแวะพัก
                  </button>
                </div>
              )}
            </div>

            {/* แถบแสดงข้อความที่กำลังพิมพ์แบบชัดเจน */}
            {quickSearchQuery.trim() && (
              <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-1.5 flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-black text-sky-950 truncate">
                  กำลังค้นหา: “{quickSearchQuery}”
                </span>
                <span className="text-[11px] font-bold text-sky-700 shrink-0">
                  แตะเลือกรายการด้านล่าง หรือกดค้นหาทันที
                </span>
              </div>
            )}

            {/* ฟอร์มค้นหาพร้อม Floating Overlay Dropdown (ไม่ดันหน้าเว็บให้กระตุกหรือเด้ง และแป้นพิมพ์ไม่บัง) */}
            <form onSubmit={handleSearchFormSubmit} className="relative">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 text-sky-700 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={quickSearchQuery}
                    onFocus={() => {
                      if (quickSearchQuery.trim()) setIsSearchDropdownOpen(true);
                      autoScrollToRef(searchSectionRef, 60);
                    }}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    placeholder="พิมพ์เช่น ตอนนี้น้ำท่วมที่ไหนบ้าง, อนุสรณ์สถาน, ฟิวเจอร์พาร์ค, ถ.สรงประภา..."
                    className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-slate-50 border-2 border-slate-300 text-base font-extrabold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600"
                  />
                  {quickSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSearchQuery('');
                        setQuickSearchResults([]);
                        setIsSearchDropdownOpen(false);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-sm sm:text-base font-black shadow-xs transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  <span>ค้นหาทันที</span>
                </button>
              </div>

              {/* Floating Overlay Dropdown: แสดงผลลัพธ์แบบลอยทับโดยไม่ดันการ์ดข้างล่างให้เด้งไปมา */}
              {isSearchDropdownOpen &&
                (quickSearchResults.length > 0 || isSearchingRemote) &&
                quickSearchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border-2 border-sky-500 shadow-2xl overflow-hidden z-30">
                    <div className="bg-sky-50 px-4 py-2.5 border-b border-sky-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-sky-950">
                          พบ {quickSearchResults.length} รายการสำหรับ “{quickSearchQuery}”
                        </span>
                        {isSearchingRemote && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-white px-2 py-0.5 rounded-md border border-sky-200">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>กำลังค้นหาพิกัดแผนที่ทั่วไทยเพิ่มเติม...</span>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSearchDropdownOpen(false)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        ย่อรายการ
                      </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                      {quickSearchResults.map((item) => {
                        const badgeStyle =
                          item.category === 'situation_overview'
                            ? 'bg-red-600 text-white'
                            : item.category === 'flood_station_live'
                              ? 'bg-orange-600 text-white'
                              : item.category === 'landmark_place'
                                ? 'bg-purple-700 text-white'
                                : item.category === 'nearby_road'
                                  ? 'bg-indigo-600 text-white'
                                  : item.category === 'road_segment'
                                    ? 'bg-sky-700 text-white'
                                    : item.category === 'road_soi'
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'bg-emerald-700 text-white';

                        const trafficDotClass =
                          item.trafficColor === 'green'
                            ? 'bg-emerald-500'
                            : item.trafficColor === 'yellow'
                              ? 'bg-amber-400'
                              : 'bg-red-600';

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectSearchResult(item)}
                            className={`w-full px-4 py-3.5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors cursor-pointer ${
                              item.category === 'situation_overview'
                                ? 'bg-red-50/90 hover:bg-red-100/90'
                                : 'hover:bg-sky-50/90'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-[11px] font-black px-2 py-0.5 rounded-md ${badgeStyle}`}
                                >
                                  {item.categoryBadge}
                                </span>
                                {item.trafficColor && item.trafficLabel && (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-900 border border-slate-200">
                                    <span
                                      className={`w-2.5 h-2.5 rounded-full inline-block ${trafficDotClass}`}
                                    />
                                    <span>จราจร{item.trafficLabel}</span>
                                  </span>
                                )}
                                {item.distanceText && (
                                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-sky-50 text-sky-900 border border-sky-200">
                                    {item.distanceText}
                                  </span>
                                )}
                                <span className="text-sm sm:text-base font-black text-slate-900">
                                  {item.title}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-slate-600 pl-0.5">
                                {item.subtitle}
                              </p>
                            </div>

                            <span className="inline-flex items-center gap-1 text-xs font-black text-sky-900 bg-sky-100 px-3 py-1.5 rounded-xl border border-sky-200 shrink-0 self-start sm:self-center">
                              <span>
                                {item.category === 'situation_overview'
                                  ? 'เปิดดูรายการทั้งหมด'
                                  : 'ดูจุดนี้'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
            </form>

            {/* ปุ่มด่วนที่จำเป็นเท่านั้น (ตัดปุ่มรกตาออกทั้งหมด กดแล้วเลื่อนไปแสดงผลทันที) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {SITUATION_QUICK_QUERIES.map((sq) => (
                <button
                  key={sq.query}
                  type="button"
                  onClick={() => handleOpenSituationReport(sq.query, sq.intent)}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-black shadow-2xs transition-all cursor-pointer ${sq.badgeColor}`}
                >
                  {sq.label}
                </button>
              ))}
            </div>

            {/* แถบสถานที่โปรดของผู้ใช้ (เรียกดูสภาพอากาศ & น้ำท่วมทันทีโดยไม่ต้องค้นหาใหม่) */}
            <div className="pt-3 border-t border-slate-200">
              <FavoritesBar
                currentLocation={selectedPrimaryLocation}
                onSelectFavorite={handleSelectFavoriteLocation}
                showAddCurrentButton={true}
              />
            </div>
          </div>
        </section>

        {/* ส่วนแสดงการ์ดพื้นที่และเส้นทาง (แสดงทั้งในโหมด All-in-One และโหมดการ์ดพื้นที่) */}
        {(activeAppTab === 'all_in_one' || activeAppTab === 'inspector') && (
          <div ref={cardsSectionRef} className="space-y-6">
            {/* กล่องเลือกพื้นที่จากรายการ จังหวัด -> อำเภอ/เขต -> ตำบล/แขวง (ข้อ 1) */}
            <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
              <div className="rounded-2xl bg-sky-50/70 border-2 border-sky-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-sky-700 text-white font-black text-base flex items-center justify-center shadow-2xs">
                      1
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        {isTravelMode
                          ? 'จุดที่ 1: พื้นที่หรือถนนเริ่มต้นเดินทาง'
                          : 'เลือกพื้นที่ตามจังหวัด อำเภอ และตำบล (ครบทั้ง 77 จังหวัด 7,436 ตำบล)'}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600">
                        กำลังแสดงข้อมูลของ:{' '}
                        <strong className="text-sky-950 underline">
                          {selectedPrimaryLocation.name} (จ.{selectedPrimaryLocation.province})
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* ปุ่มบันทึกจุดที่ 1 เป็นสถานที่โปรด */}
                  {(() => {
                    const isFav = isLocationFavorited(selectedPrimaryLocation);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (isFav) {
                            removeLocationFromFavorites(selectedPrimaryLocation);
                          } else {
                            const label =
                              selectedPrimaryLocation.roadName ||
                              `${selectedPrimaryLocation.tambon} (${selectedPrimaryLocation.amphoe})`;
                            addLocationToFavorites(
                              selectedPrimaryLocation,
                              label,
                              selectedPrimaryLocation.roadName ? 'road' : 'star'
                            );
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs ${
                          isFav
                            ? 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200'
                            : 'bg-white hover:bg-amber-50 text-slate-800 hover:text-amber-900 border border-slate-300'
                        }`}
                        title={isFav ? 'ลบออกจากสถานที่โปรด' : 'บันทึกจุดนี้เป็นสถานที่โปรด'}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            isFav ? 'text-amber-500 fill-amber-500' : 'text-slate-400'
                          }`}
                        />
                        <span>
                          {isFav ? 'สถานที่โปรดแล้ว ⭐' : '+ บันทึกจุดนี้เป็นสถานที่โปรด'}
                        </span>
                      </button>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      1. จังหวัด (ครบ 77 จังหวัด)
                    </label>
                    <select
                      value={startProvince}
                      onChange={(e) => handleSelectStartProvince(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {Object.entries(provincesByRegion).map(([regionName, provs]) => (
                        <optgroup key={regionName} label={regionName}>
                          {provs.map((p) => (
                            <option key={p.name} value={p.name}>
                              จังหวัด{p.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      2. อำเภอ / เขต ({startAmphoeList.length} แห่ง)
                    </label>
                    <select
                      value={startAmphoe}
                      onChange={(e) => handleSelectStartAmphoe(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {startAmphoeList.map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      3. ตำบล / แขวง ({startTambonList.length} แห่ง)
                    </label>
                    <select
                      value={startTambon}
                      onChange={(e) => handleSelectStartTambon(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {startTambonList.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isTravelMode ? (
                  <div className="pt-2 border-t border-sky-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs sm:text-sm font-bold text-slate-700">
                      ต้องการเช็คสภาพอากาศ น้ำท่วม และสีจราจรตลอดเส้นทางไปต่างอำเภอ/ต่างจังหวัดใช่ไหม?
                    </p>
                    <button
                      type="button"
                      onClick={handleEnableTravelMode}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-black shadow-sm transition-all cursor-pointer shrink-0"
                    >
                      <Car className="w-4 h-4 text-sky-400" />
                      <span>กดเพื่อเดินทาง (เพิ่มจุดหมายปลายทาง ข้อ 2 และ 3)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-sky-200/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-slate-700">ตัวอย่างเส้นทางด่วน:</span>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetRoute('intra_province')}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-100 text-sky-900 border border-sky-300 text-xs font-extrabold cursor-pointer transition-colors"
                      >
                        เส้นทางภายใน จ.{startProvince} (3 อำเภอ)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPresetRoute('bkk_khaoyai_phayao')}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-sky-100 text-sky-900 border border-sky-300 text-xs font-extrabold cursor-pointer transition-colors"
                      >
                        ตัวอย่างเดินทางไกล: กรุงเทพฯ → เขาใหญ่ → พะเยา
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsTravelMode(false)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-300 text-xs font-extrabold cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>ปิดโหมดเดินทาง (ดูเฉพาะจุดที่ 1)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ข้อ 2 และ ข้อ 3 (แสดงเฉพาะเมื่อกดเดินทาง และเลื่อนหน้าจอมาหาอัตโนมัติ) */}
              {isTravelMode && (
                <div ref={travelConfigRef} className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-emerald-50/70 border-2 border-emerald-200 p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-black text-base flex items-center justify-center shadow-2xs">
                          2
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-slate-900">
                            จุดที่ 2: เลือกจุดหมายปลายทาง
                          </h3>
                          <p className="text-xs font-semibold text-slate-600">
                            เลือกจังหวัด อำเภอ และตำบลปลายทาง (หรือค้นหาชื่อสถานที่แล้วเลือกใส่ใน “2. ปลายทาง”)
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-xs font-black text-slate-700 mb-1">
                            จังหวัดปลายทาง
                          </label>
                          <select
                            value={destProvince}
                            onChange={(e) => handleSelectDestProvince(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900"
                          >
                            {Object.entries(provincesByRegion).map(([regionName, provs]) => (
                              <optgroup key={regionName} label={regionName}>
                                {provs.map((p) => (
                                  <option key={p.name} value={p.name}>
                                    จ.{p.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-700 mb-1">
                            อำเภอ / เขตปลายทาง
                          </label>
                          <select
                            value={destAmphoe}
                            onChange={(e) => handleSelectDestAmphoe(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900"
                          >
                            {destAmphoeList.map((a) => (
                              <option key={a.name} value={a.name}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-700 mb-1">
                            ตำบล / แขวงปลายทาง
                          </label>
                          <select
                            value={destTambon}
                            onChange={(e) => handleSelectDestTambon(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900"
                          >
                            {destTambonList.map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between text-xs font-extrabold text-emerald-950">
                      <span>ปลายทางปัจจุบัน: {destTambon} {destAmphoe} จ.{destProvince}</span>
                      {(() => {
                        const destLoc = createLocationFromTambon(destProvince, destAmphoe, destTambon);
                        const isFav = isLocationFavorited(destLoc);
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (isFav) {
                                removeLocationFromFavorites(destLoc);
                              } else {
                                addLocationToFavorites(destLoc, `${destTambon} (${destAmphoe})`, 'star');
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              isFav
                                ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                : 'bg-white hover:bg-amber-50 text-slate-800 border border-slate-300'
                            }`}
                            title={isFav ? 'ลบปลายทางออกจากรายการโปรด' : 'บันทึกปลายทางนี้ลงรายการโปรด'}
                          >
                            <Star className={`w-3 h-3 ${isFav ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                            <span>{isFav ? 'โปรดแล้ว ⭐' : '+ บันทึกปลายทาง'}</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-amber-50/70 border-2 border-amber-200 p-4 sm:p-5 space-y-3.5 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-amber-600 text-white font-black text-base flex items-center justify-center shadow-2xs">
                          3
                        </span>
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-slate-900">
                            จุดที่ 3: เพิ่มจุดแวะพักระหว่างทาง (ถ้ามี)
                          </h3>
                          <p className="text-xs font-semibold text-slate-600">
                            เพิ่มจุดแวะพักเพื่อเช็คน้ำท่วมและสีจราจรตลอดเส้นทางพร้อมกัน
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-xs font-black text-slate-700 mb-1">
                            จังหวัดจุดแวะพัก
                          </label>
                          <select
                            value={stopProvince}
                            onChange={(e) => handleSelectStopProvince(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900"
                          >
                            {Object.entries(provincesByRegion).map(([regionName, provs]) => (
                              <optgroup key={regionName} label={regionName}>
                                {provs.map((p) => (
                                  <option key={p.name} value={p.name}>
                                    จ.{p.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-700 mb-1">
                            อำเภอ / เขตจุดแวะ
                          </label>
                          <select
                            value={stopAmphoe}
                            onChange={(e) => handleSelectStopAmphoe(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900"
                          >
                            {stopAmphoeList.map((a) => (
                              <option key={a.name} value={a.name}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-700 mb-1">
                            ตำบล / แขวงจุดแวะ
                          </label>
                          <select
                            value={stopTambon}
                            onChange={(e) => setStopTambon(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-extrabold text-slate-900"
                          >
                            {stopTambonList.map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">
                        แวะพัก: {stopTambon} {stopAmphoe} จ.{stopProvince}
                      </span>
                      <button
                        type="button"
                        onClick={handleAddStopover}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-2xs transition-colors cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>เพิ่มจุดแวะพักนี้เข้าเส้นทาง</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* สรุปเส้นทางการเดินทางทั้งหมด (เฉพาะเมื่อเปิดโหมดเดินทางหลายจุด) */}
            {isTravelMode && routeSummary && (
              <section
                className={`rounded-3xl p-5 sm:p-6 border-2 shadow-xs ${
                  routeSummary.tier === 'critical'
                    ? 'bg-red-50 border-red-400 text-red-950'
                    : routeSummary.tier === 'danger'
                      ? 'bg-orange-50 border-orange-400 text-orange-950'
                      : routeSummary.tier === 'watch'
                        ? 'bg-amber-50 border-amber-400 text-amber-950'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {routeSummary.tier === 'normal' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
                      )}
                      <h2 className="text-lg sm:text-xl font-black">{routeSummary.title}</h2>
                    </div>
                    <p className="text-sm font-bold opacity-90">{routeSummary.detail}</p>

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      {statuses.map((st, idx) => {
                        const dotCls =
                          st.trafficStatus.colorCode === 'green'
                            ? 'bg-emerald-500'
                            : st.trafficStatus.colorCode === 'yellow'
                              ? 'bg-amber-400'
                              : 'bg-red-600';
                        return (
                          <React.Fragment key={`route-pill-${idx}`}>
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenInAppViewer('map_traffic', {
                                  title: st.location.name,
                                  lat: st.location.lat,
                                  lng: st.location.lng
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/95 hover:bg-white border border-slate-300 text-xs font-black text-slate-900 cursor-pointer"
                            >
                              <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px]">
                                {idx + 1}
                              </span>
                              <span>{st.location.name}</span>
                              <span
                                title={`จราจร: ${st.trafficStatus.colorNameTh}`}
                                className={`w-2.5 h-2.5 rounded-full inline-block ${dotCls}`}
                              />
                            </button>
                            {idx < statuses.length - 1 && (
                              <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenInAppViewer('map_traffic', {
                          title: `เส้นทาง ${activeLocations[0]?.name} → ${
                            activeLocations[activeLocations.length - 1]?.name
                          }`,
                          lat: activeLocations[0]?.lat || selectedPrimaryLocation.lat,
                          lng: activeLocations[0]?.lng || selectedPrimaryLocation.lng,
                          mapSearchQuery: `${activeLocations[0]?.name} ไป ${
                            activeLocations[activeLocations.length - 1]?.name
                          }`,
                          externalUrl: googleMapsRouteUrl,
                          externalLabel: 'เปิดนำทางบนเว็บ Google Maps'
                        })
                      }
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-black shadow-xs transition-colors cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>ดูแผนที่เส้นทางในเว็บนี้</span>
                    </button>
                    <a
                      href={googleMapsRouteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-black shadow-xs transition-colors"
                    >
                      <Navigation className="w-4 h-4 text-sky-400" />
                      <span>เปิดเว็บ Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                    </a>
                  </div>
                </div>
              </section>
            )}

            {/* แสดงการ์ดข้อมูลสถานที่ (เลื่อนหน้าจอมาหาอัตโนมัติทันทีเมื่อเลือกพื้นที่หรือค้นหา) */}
            <section ref={waypointCardsListRef} className="scroll-mt-24 space-y-6">
              {statuses.map((st, idx) => (
                <WaypointCard
                  key={`waypoint-card-slot-${idx}`}
                  status={st}
                  index={idx}
                  total={statuses.length}
                  isSingleMode={!isTravelMode}
                  onSelectSegment={(seg) => handleSelectRoadSegmentOnCard(idx, seg)}
                  onOpenInAppViewer={handleOpenInAppViewer}
                  onRemove={handleRemoveWaypoint}
                  onMoveLeft={(i) => handleMoveWaypoint(i, 'left')}
                  onMoveRight={(i) => handleMoveWaypoint(i, 'right')}
                />
              ))}
            </section>
          </div>
        )}

        {/* ศูนย์ดูแผนที่ถนน-ซอย เรดาร์เมฆฝนสด และตารางข้อมูลรัฐในเว็บ (แสดงทั้งในโหมด All-in-One และโหมด Data Center) */}
        {(activeAppTab === 'all_in_one' || activeAppTab === 'data_center') && statuses[0] && (
          <div ref={inAppCenterRef} className="scroll-mt-24">
            <InAppDataCenter
              activeStatus={statuses[0]}
              allRouteStatuses={statuses}
              activeTab={inAppViewerTab}
              onTabChange={setInAppViewerTab}
              focusTarget={inAppFocusTarget}
              onClearFocusTarget={() => setInAppFocusTarget(null)}
              onSelectLocation={handleSelectLocationFromSituation}
            />
          </div>
        )}

        {/* รายงานสถานการณ์สดทั่วไทย ("ตอนนี้น้ำท่วมที่ไหนบ้าง" / ฝนตกหนัก / รถติด) — แสดงทั้งในโหมด All-in-One และโหมด Situation */}
        {(activeAppTab === 'all_in_one' || activeAppTab === 'situation') && (
          <div ref={situationSectionRef} className="scroll-mt-24">
            <NationwideSituationPanel
              initialQuery={situationQueryText}
              initialIntent={situationIntent}
              onSelectLocation={handleSelectLocationFromSituation}
              onOpenInAppViewer={handleOpenInAppViewer}
              onClose={
                activeAppTab === 'situation' ? () => setActiveAppTab('all_in_one') : undefined
              }
            />
          </div>
        )}

        {/* แหล่งข้อมูลทางการ & ติดตั้งเป็นแอปพลิเคชัน (แสดงทั้งในโหมด All-in-One และโหมด Sources/App) */}
        {(activeAppTab === 'all_in_one' || activeAppTab === 'sources_app') && (
          <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="space-y-1">
                <span className="text-xs font-black text-emerald-800">
                  ติดตั้งเป็นแอปพลิเคชันบนมือถือและคอมพิวเตอร์
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  ใช้งานเป็นแอปเต็มจอ (App Mode) ดูครบทุกข้อมูลในแอปเดียว
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  รองรับการติดตั้งลงหน้าจอโฮมทั้งระบบ Android, iPhone/iPad และคอมพิวเตอร์ พร้อมระบบจำพื้นที่ล่าสุดอัตโนมัติ
                </p>
              </div>
              <div className="shrink-0">
                <PWAInstallButton variant="card" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-700" />
                <span>
                  แหล่งข้อมูลจริงทางการ (เลือกดูตารางข้อมูลในเว็บนี้ได้ทันที หรือกดเปิดเว็บไซต์ต้นทางเพื่อเช็คเทียบ)
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-sky-800">
                      1. คลังข้อมูลน้ำแห่งชาติ (สสน.)
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                      ระบบตรวจวัดระดับน้ำโทรมาตรทั่วประเทศ (ThaiWater)
                    </h4>
                    <p className="text-xs font-semibold text-slate-600 mt-1">
                      ตรวจสอบสถานะน้ำล้นตลิ่ง น้ำมาก และระดับน้ำเทียบตลิ่งรายสถานีแบบเรียลไทม์
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => handleOpenInAppViewer('water_table')}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer"
                    >
                      ดูตารางในเว็บนี้
                    </button>
                    <a
                      href="https://www.thaiwater.net/water/wl"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-black text-slate-700 hover:text-slate-950"
                    >
                      <span>เปิดเว็บ ThaiWater</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-sky-800">
                      2. สถานีวัดน้ำฝนอัตโนมัติ สสน. & เรดาร์เมฆฝน
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                      ข้อมูลปริมาณฝนสะสม 24 ชั่วโมง และเรดาร์ฝนสด
                    </h4>
                    <p className="text-xs font-semibold text-slate-600 mt-1">
                      ประเมินความเสี่ยงน้ำท่วมขังและน้ำรอการระบายบนผิวจราจรในแต่ละตำบล
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => handleOpenInAppViewer('rain_table')}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer"
                    >
                      ดูตารางฝนในเว็บนี้
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenInAppViewer('weather_radar')}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
                    >
                      ดูเรดาร์ในเว็บนี้
                    </button>
                    <a
                      href="https://www.thaiwater.net/weather/rain"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-black text-slate-700 hover:text-slate-950"
                    >
                      <span>เว็บ สสน.</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-emerald-800">
                      3. สำนักการระบายน้ำ กทม. & กรมทางหลวง
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                      ตรวจวัดน้ำท่วมขังและสีจราจรบนถนนสายหลัก
                    </h4>
                    <p className="text-xs font-semibold text-slate-600 mt-1">
                      ตรวจสอบระดับน้ำท่วมขังผิวจราจรในเขตกรุงเทพฯ ปริมณฑล และทางหลวงแผ่นดิน
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => handleOpenInAppViewer('road_flood_matrix')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
                    >
                      ดูตารางถนนในเว็บนี้
                    </button>
                    <a
                      href="https://dds.bangkok.go.th/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-black text-slate-700 hover:text-slate-950"
                    >
                      <span>เว็บ กทม.</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
