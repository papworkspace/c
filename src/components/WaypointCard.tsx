import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  Droplets,
  ExternalLink,
  Home,
  MapPin,
  Navigation,
  Radio,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Shirt,
  Star,
  Sun,
  Trash2,
  Wind
} from 'lucide-react';
import { ThaiLocation } from '../data/thaiLocations';
import {
  addLocationToFavorites,
  isLocationFavorited,
  removeLocationFromFavorites,
  subscribeFavorites
} from '../services/favoritesService';
import {
  LocationRealtimeStatus,
  TrafficLevel,
  WaterSafetyTier
} from '../services/weatherWaterService';
import { WaterLevelGaugeGraphic, WeatherSceneGraphic } from './VisualGraphics';
import { InAppFocusTarget, InAppViewerTab } from './InAppDataCenter';

interface WaypointCardProps {
  status: LocationRealtimeStatus;
  index: number;
  total: number;
  isSingleMode?: boolean;
  onSelectSegment?: (segmentLocation: ThaiLocation) => void;
  onOpenInAppViewer?: (tab: InAppViewerTab, focus?: InAppFocusTarget) => void;
  onRemove?: (id: string) => void;
  onMoveLeft?: (index: number) => void;
  onMoveRight?: (index: number) => void;
}

const WATER_TIER_STYLES: Record<
  WaterSafetyTier,
  {
    badgeBg: string;
    badgeText: string;
    cardBorder: string;
    bannerBg: string;
    bannerBorder: string;
    headlineColor: string;
    tierShortLabel: string;
  }
> = {
  normal: {
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    cardBorder: 'border-emerald-300',
    bannerBg: 'bg-emerald-50/90',
    bannerBorder: 'border-emerald-200',
    headlineColor: 'text-emerald-950',
    tierShortLabel: 'น้ำปกติ • ถนนแห้งขับผ่านได้สบาย'
  },
  watch: {
    badgeBg: 'bg-amber-500',
    badgeText: 'text-slate-950',
    cardBorder: 'border-amber-400',
    bannerBg: 'bg-amber-50/95',
    bannerBorder: 'border-amber-300',
    headlineColor: 'text-amber-950',
    tierShortLabel: 'เฝ้าระวังน้ำขัง • ระวังถนนลื่น/น้ำรอระบาย'
  },
  danger: {
    badgeBg: 'bg-orange-600',
    badgeText: 'text-white',
    cardBorder: 'border-orange-500',
    bannerBg: 'bg-orange-50/95',
    bannerBorder: 'border-orange-300',
    headlineColor: 'text-orange-950',
    tierShortLabel: 'อันตราย • รถเล็ก/มอเตอร์ไซค์ควรเลี่ยงซอยต่ำ'
  },
  critical: {
    badgeBg: 'bg-red-600',
    badgeText: 'text-white',
    cardBorder: 'border-red-600',
    bannerBg: 'bg-red-50/95',
    bannerBorder: 'border-red-300',
    headlineColor: 'text-red-950',
    tierShortLabel: 'วิกฤต • น้ำล้นตลิ่ง ห้ามสัญจรจุดท่วม'
  }
};

const TRAFFIC_LEVEL_STYLES: Record<
  TrafficLevel,
  {
    badgeBg: string;
    badgeText: string;
    boxBg: string;
    boxBorder: string;
    titleColor: string;
    dotColor: string;
  }
> = {
  flowing: {
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    boxBg: 'bg-emerald-50/90',
    boxBorder: 'border-emerald-200',
    titleColor: 'text-emerald-950',
    dotColor: 'bg-emerald-500'
  },
  moderate: {
    badgeBg: 'bg-amber-500',
    badgeText: 'text-slate-950',
    boxBg: 'bg-amber-50/95',
    boxBorder: 'border-amber-300',
    titleColor: 'text-amber-950',
    dotColor: 'bg-amber-500'
  },
  congested: {
    badgeBg: 'bg-red-600',
    badgeText: 'text-white',
    boxBg: 'bg-red-50/95',
    boxBorder: 'border-red-300',
    titleColor: 'text-red-950',
    dotColor: 'bg-red-600'
  },
  severe: {
    badgeBg: 'bg-red-700',
    badgeText: 'text-white',
    boxBg: 'bg-red-50/95',
    boxBorder: 'border-red-400',
    titleColor: 'text-red-950',
    dotColor: 'bg-red-600'
  }
};

export const WaypointCard: React.FC<WaypointCardProps> = ({
  status,
  index,
  total,
  isSingleMode = false,
  onSelectSegment,
  onOpenInAppViewer,
  onRemove,
  onMoveLeft,
  onMoveRight
}) => {
  const [showLiveMapEmbed, setShowLiveMapEmbed] = useState(true);
  const [inlineViewerMode, setInlineViewerMode] = useState<'map' | 'radar'>('map');
  const [cardMapFocusQuery, setCardMapFocusQuery] = useState<string>('');
  const [cardMapFocusLabel, setCardMapFocusLabel] = useState<string>('');
  const [showInlineWeatherRadar, setShowInlineWeatherRadar] = useState(false);
  const [showInlineRawJson, setShowInlineRawJson] = useState(false);
  const [showMoreStations, setShowMoreStations] = useState(false);
  const [showLocalAreaDetails, setShowLocalAreaDetails] = useState(true);
  const [showVerificationPanel, setShowVerificationPanel] = useState(true);
  const [localSearchInput, setLocalSearchInput] = useState('');
  const [isFavorited, setIsFavorited] = useState<boolean>(() => isLocationFavorited(status.location));

  useEffect(() => {
    setIsFavorited(isLocationFavorited(status.location));
    const unsub = subscribeFavorites(() => {
      setIsFavorited(isLocationFavorited(status.location));
    });
    return () => unsub();
  }, [status.location]);

  const handleToggleFavorite = () => {
    if (isFavorited) {
      removeLocationFromFavorites(status.location);
    } else {
      const label = status.location.roadName || `${status.location.tambon} (${status.location.amphoe})`;
      const icon = status.location.roadName ? 'road' : 'star';
      addLocationToFavorites(status.location, label, icon);
    }
  };

  const {
    location,
    verificationLinks,
    primaryWaterStation,
    primaryRainStation,
    trafficStatus
  } = status;

  const tierStyle = WATER_TIER_STYLES[status.waterSafetyTier];
  const trafficStyle = TRAFFIC_LEVEL_STYLES[trafficStatus.level];

  const isStart = index === 0;
  const isEnd = index === total - 1 && total > 1;

  const roleText = isSingleMode
    ? location.roadName
      ? `ตรวจสอบถนนและช่วงเส้นทาง (${location.roadName})`
      : 'พื้นที่ที่กำลังตรวจสอบ'
    : isStart
      ? 'จุดเริ่มต้นเดินทาง'
      : isEnd
        ? 'จุดหมายปลายทาง'
        : `จุดแวะพักระหว่างทางที่ ${index}`;

  const customMapSearchUrl = localSearchInput.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${localSearchInput.trim()} ${location.tambon} ${location.amphoe} ${location.province}`
      )}`
    : verificationLinks.googleMapsLocationUrl;

  const customOsmSearchUrl = localSearchInput.trim()
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(
        `${localSearchInput.trim()} ${location.amphoe} ${location.province}`
      )}`
    : verificationLinks.openStreetMapUrl;

  const activeCardMapEmbedUrl = cardMapFocusQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(
        cardMapFocusQuery
      )}&t=m&z=16&output=embed&hl=th`
    : trafficStatus.googleMapsEmbedUrl;

  const activeCardWindyEmbedUrl = `https://embed.windy.com/embed2.html?lat=${location.lat.toFixed(
    4
  )}&lon=${location.lng.toFixed(4)}&detailLat=${location.lat.toFixed(
    4
  )}&detailLon=${location.lng.toFixed(
    4
  )}&width=700&height=360&zoom=10&level=surface&overlay=radar&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;

  const handleFocusInCardMap = (query: string, label: string) => {
    setCardMapFocusQuery(query);
    setCardMapFocusLabel(label);
    setInlineViewerMode('map');
    setShowLiveMapEmbed(true);
  };

  return (
    <article
      className={`rounded-3xl bg-white border-2 ${tierStyle.cardBorder} shadow-md overflow-hidden transition-all flex flex-col justify-between`}
    >
      {/* 1. ส่วนหัวการ์ด: ชื่อถนน/ช่วงถนน หรือชื่อตำบล/อำเภอ/จังหวัด */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/80 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!isSingleMode && (
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-base shadow-xs">
                {index + 1}
              </span>
            )}
            <span className="text-xs font-extrabold uppercase tracking-wider text-sky-900 bg-sky-100/90 px-2.5 py-1 rounded-md">
              {roleText}
            </span>
            <span className="text-xs font-bold text-slate-600">
              {location.tambon} • {location.amphoe} • จ.{location.province}
            </span>
          </div>

          {!isSingleMode && (
            <div className="flex items-center gap-1">
              {index > 0 && onMoveLeft && (
                <button
                  type="button"
                  onClick={() => onMoveLeft(index)}
                  title="เลื่อนขึ้น"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              {index < total - 1 && onMoveRight && (
                <button
                  type="button"
                  onClick={() => onMoveRight(index)}
                  title="เลื่อนลง"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {total > 1 && onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(location.id)}
                  title="ลบจุดนี้"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {location.name}
            </h3>
            {location.segmentSubtitle ? (
              <p className="text-sm font-bold text-sky-900 mt-1">{location.segmentSubtitle}</p>
            ) : (
              <p className="text-sm font-semibold text-slate-600 mt-1">
                {location.tambon} {location.amphoe} จังหวัด{location.province} (พิกัด GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)})
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* สัญลักษณ์ไฟจราจร 3 สีบนหัวการ์ด มองเห็นสถานะจราจรได้ทันที */}
            <div
              className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border-2 shadow-2xs ${
                trafficStatus.colorCode === 'green'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : trafficStatus.colorCode === 'yellow'
                    ? 'bg-amber-50 border-amber-400 text-amber-950'
                    : 'bg-red-50 border-red-400 text-red-950'
              }`}
            >
              <div className="inline-flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-full">
                <span
                  title="สีเขียว (คล่องตัว)"
                  className={`w-3 h-3 rounded-full transition-all ${
                    trafficStatus.colorCode === 'green'
                      ? 'bg-emerald-400 ring-2 ring-emerald-300 scale-110'
                      : 'bg-emerald-950/60 opacity-35'
                  }`}
                />
                <span
                  title="สีเหลือง (ชะลอตัว)"
                  className={`w-3 h-3 rounded-full transition-all ${
                    trafficStatus.colorCode === 'yellow'
                      ? 'bg-amber-400 ring-2 ring-amber-200 scale-110'
                      : 'bg-amber-950/60 opacity-35'
                  }`}
                />
                <span
                  title="สีแดง (รถติดขัด)"
                  className={`w-3 h-3 rounded-full transition-all ${
                    trafficStatus.colorCode === 'red'
                      ? 'bg-red-500 ring-2 ring-red-300 scale-110'
                      : 'bg-red-950/60 opacity-35'
                  }`}
                />
              </div>
              <span className="text-xs sm:text-sm font-black">
                จราจร: {trafficStatus.colorNameTh}
              </span>
            </div>

            {/* ปุ่มบันทึกเป็นสถานที่โปรด */}
            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black shadow-2xs transition-all cursor-pointer ${
                isFavorited
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-2 border-amber-400'
                  : 'bg-white hover:bg-amber-50 text-slate-800 border-2 border-slate-300 hover:border-amber-400'
              }`}
              title={isFavorited ? 'ลบออกจากสถานที่โปรด' : 'บันทึกจุดนี้เป็นสถานที่โปรด'}
            >
              <Star
                className={`w-3.5 h-3.5 shrink-0 ${
                  isFavorited ? 'text-amber-500 fill-amber-500' : 'text-slate-400'
                }`}
              />
              <span>{isFavorited ? 'สถานที่โปรด ⭐' : 'บันทึกเป็นสถานที่โปรด'}</span>
            </button>

            {onOpenInAppViewer && (
              <button
                type="button"
                onClick={() =>
                  onOpenInAppViewer('map_traffic', {
                    title: location.name,
                    subtitle: `${location.tambon} ${location.amphoe} จ.${location.province}`,
                    lat: location.lat,
                    lng: location.lng,
                    externalUrl: trafficStatus.googleTrafficLayerUrl,
                    externalLabel: 'เปิด Google Maps Traffic เว็บนอก'
                  })
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black shadow-2xs transition-colors cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>ดูแผนที่ใหญ่ในเว็บ</span>
              </button>
            )}

            <a
              href={trafficStatus.googleTrafficLayerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-2xs transition-colors"
            >
              <Car className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>เปิดเว็บ Google Traffic</span>
              <ExternalLink className="w-3 h-3 text-slate-300 shrink-0" />
            </a>
          </div>
        </div>

        {/* แถบจำแนกช่วงถนนเดียวกัน และถนนใกล้เคียงพิกัดที่ค้นหา (กดสลับดูแต่ละช่วงได้ทันที) */}
        {location.relatedSegments && location.relatedSegments.length > 1 && onSelectSegment && (
          <div className="pt-3 border-t border-slate-200/80">
            <p className="text-xs font-black text-slate-800 mb-2 flex items-center gap-1.5">
              <Route className="w-4 h-4 text-sky-700" />
              <span>
                ถนนเชื่อมโยง & ช่วงถนนใกล้เคียงพิกัด {location.roadName || location.name} (คลิกสลับดูน้ำท่วมและจราจรแต่ละจุดได้ทันที):
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {location.relatedSegments.map((seg) => {
                const isSelected = seg.id === location.id || seg.name === location.name;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => onSelectSegment(seg)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border text-left ${
                      isSelected
                        ? 'bg-sky-700 text-white border-sky-800 shadow-xs'
                        : 'bg-white hover:bg-sky-50 text-slate-800 border-slate-300'
                    }`}
                  >
                    {seg.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. สรุปคู่ขนานในการค้นหาเดียว: (ฝั่งซ้าย) น้ำท่วมขังและระดับน้ำ + (ฝั่งขวา) สภาพการจราจรตอนนี้ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-slate-200">
        {/* 2.1 สถานะน้ำท่วมขังและระดับน้ำ */}
        <div className={`p-5 sm:p-6 ${tierStyle.bannerBg} border-b lg:border-b-0 lg:border-r ${tierStyle.bannerBorder} flex flex-col justify-between space-y-4`}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black tracking-wide ${tierStyle.badgeBg} ${tierStyle.badgeText} shadow-xs`}
              >
                {status.waterSafetyTier === 'normal' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                1. สถานะน้ำท่วมขัง: {tierStyle.tierShortLabel}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {onOpenInAppViewer && (
                  <button
                    type="button"
                    onClick={() => onOpenInAppViewer('water_table')}
                    className="text-xs font-black text-sky-900 bg-white/90 hover:bg-white px-2.5 py-1 rounded-lg border border-sky-200 cursor-pointer"
                  >
                    ดูตารางน้ำในเว็บ
                  </button>
                )}
                <a
                  href={verificationLinks.thaiWaterLevelWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-sky-900 hover:underline"
                >
                  <span>เว็บ สสน.</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <p className={`text-xl sm:text-2xl font-black leading-snug ${tierStyle.headlineColor}`}>
              “{status.waterHeadline}”
            </p>

            <WaterLevelGaugeGraphic
              tier={status.waterSafetyTier}
              waterLevelCm={
                primaryWaterStation?.storagePercent
                  ? Math.max(0, Math.round((primaryWaterStation.storagePercent - 75) * 1.5))
                  : 0
              }
            />

            <div className="bg-white/90 rounded-xl p-3 border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
              <span className="font-black text-slate-950">ข้อมูลอ้างอิงจริง: </span>
              {status.waterConditionReason}
            </div>
          </div>

          {/* ตารางสรุปว่ารถแต่ละประเภทผ่านได้หรือไม่ */}
          <div className="pt-2">
            <p className="text-xs font-black text-slate-800 mb-2">
              ความพร้อมในการสัญจรแยกตามประเภทรถ:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {status.vehicleGuidances.map((vg) => {
                const badgeColor =
                  vg.canPass === 'yes'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : vg.canPass === 'caution'
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-red-50 border-red-300 text-red-950';
                const dotColor =
                  vg.canPass === 'yes'
                    ? 'bg-emerald-500'
                    : vg.canPass === 'caution'
                      ? 'bg-amber-500'
                      : 'bg-red-600';

                return (
                  <div
                    key={vg.type}
                    className={`rounded-xl p-2.5 border ${badgeColor} flex flex-col justify-between bg-white/90`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black">{vg.label}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    </div>
                    <p className="text-xs font-extrabold mt-0.5">{vg.statusText}</p>
                    <p className="text-[11px] opacity-85 mt-0.5 leading-snug">{vg.adviceText}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2.2 สถานะการจราจรควบคู่ผลกระทบจากน้ำ/ฝน (Traffic & Road Flow) */}
        <div className={`p-5 sm:p-6 ${trafficStyle.boxBg} flex flex-col justify-between space-y-4`}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black tracking-wide ${trafficStyle.badgeBg} ${trafficStyle.badgeText} shadow-xs`}
              >
                <Car className="w-4 h-4" />
                2. สภาพการจราจร: {trafficStatus.badgeLabel}
              </span>

              <a
                href={trafficStatus.googleTrafficLayerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-900 hover:underline"
              >
                <span>เปิด Google Maps Traffic</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className={`text-xl sm:text-2xl font-black leading-snug ${trafficStyle.titleColor}`}>
              “{trafficStatus.headline}”
            </p>

            {/* แถบสัญลักษณ์สีจราจร 3 ระดับที่เข้าใจง่ายในพริบตา: เขียว (คล่องตัว) / เหลือง (ชะลอตัว) / แดง (รถติดขัด) */}
            <div className="rounded-2xl bg-white/95 border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black text-slate-600">
                <span>สัญลักษณ์สีแสดงสภาพการจราจรตอนนี้:</span>
                <span>{trafficStatus.colorNameTh}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {/* สีเขียว */}
                <div
                  className={`rounded-xl p-2.5 border-2 flex flex-col justify-between transition-all ${
                    trafficStatus.colorCode === 'green'
                      ? 'bg-emerald-50 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
                      : 'bg-slate-50/70 border-slate-200 opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-950">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 inline-block shrink-0 shadow-2xs" />
                      <span>สีเขียว</span>
                    </span>
                    {trafficStatus.colorCode === 'green' && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                        ตอนนี้
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-extrabold text-emerald-900 mt-1">คล่องตัว</p>
                  <p className="text-[10px] font-bold text-slate-600">รถวิ่งได้สะดวก</p>
                </div>

                {/* สีเหลือง */}
                <div
                  className={`rounded-xl p-2.5 border-2 flex flex-col justify-between transition-all ${
                    trafficStatus.colorCode === 'yellow'
                      ? 'bg-amber-50 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                      : 'bg-slate-50/70 border-slate-200 opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-950">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-400 inline-block shrink-0 shadow-2xs" />
                      <span>สีเหลือง</span>
                    </span>
                    {trafficStatus.colorCode === 'yellow' && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                        ตอนนี้
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-extrabold text-amber-900 mt-1">ชะลอตัว</p>
                  <p className="text-[10px] font-bold text-slate-600">เคลื่อนตัวได้เรื่อยๆ</p>
                </div>

                {/* สีแดง */}
                <div
                  className={`rounded-xl p-2.5 border-2 flex flex-col justify-between transition-all ${
                    trafficStatus.colorCode === 'red'
                      ? 'bg-red-50 border-red-500 shadow-xs ring-2 ring-red-500/20'
                      : 'bg-slate-50/70 border-slate-200 opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-950">
                      <span className="w-3.5 h-3.5 rounded-full bg-red-600 inline-block shrink-0 shadow-2xs" />
                      <span>สีแดง</span>
                    </span>
                    {trafficStatus.colorCode === 'red' && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-600 text-white">
                        ตอนนี้
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-extrabold text-red-900 mt-1">รถติดขัด</p>
                  <p className="text-[10px] font-bold text-slate-600">ควรเผื่อเวลาเดินทาง</p>
                </div>
              </div>
            </div>

            {/* กล่องความเร็วและเวลาเดินทางโดยประมาณ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-white/90 border border-slate-200/90 p-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                  ความเร็วการเคลื่อนตัว
                </span>
                <p className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                  {trafficStatus.estimatedSpeedText}
                </p>
              </div>
              <div className="rounded-xl bg-white/90 border border-slate-200/90 p-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                  การเผื่อเวลาเดินทาง
                </span>
                <p className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                  {trafficStatus.delayEstimateText}
                </p>
              </div>
            </div>

            {/* รายละเอียดจุดชะลอตัวและผลกระทบจากน้ำบนผิวจราจร */}
            <div className="rounded-xl bg-white/90 border border-slate-200/90 p-3.5 space-y-2 text-xs sm:text-sm">
              <div>
                <span className="font-black text-slate-900">จุดชะลอตัวและแยกสำคัญบนเส้นทาง: </span>
                <span className="font-bold text-slate-700">{trafficStatus.hotspotDescription}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-100">
                <span className="font-black text-slate-900">ผลกระทบจากน้ำต่อช่องจราจร: </span>
                <span className="font-bold text-slate-700">{trafficStatus.waterTrafficImpact}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-100">
                <span className="font-black text-sky-900">คำแนะนำช่องทางวิ่ง: </span>
                <span className="font-extrabold text-sky-950">{trafficStatus.laneRecommendation}</span>
              </div>
            </div>
          </div>

          {/* แผนที่พิกัดถนนจริง & เรดาร์ฝนสดในเว็บแบบโต้ตอบได้ + ปุ่มเปิดดูเว็บนอก */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setInlineViewerMode('map');
                    setShowLiveMapEmbed(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                    showLiveMapEmbed && inlineViewerMode === 'map'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white/90 text-slate-800 border border-slate-300'
                  }`}
                >
                  แผนที่พิกัดจริงในเว็บ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlineViewerMode('radar');
                    setShowLiveMapEmbed(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                    showLiveMapEmbed && inlineViewerMode === 'radar'
                      ? 'bg-sky-700 text-white'
                      : 'bg-white/90 text-slate-800 border border-slate-300'
                  }`}
                >
                  เรดาร์เมฆฝนสดในเว็บ
                </button>
              </div>

              <div className="flex items-center gap-2">
                {cardMapFocusLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      setCardMapFocusQuery('');
                      setCardMapFocusLabel('');
                    }}
                    className="text-[11px] font-black text-sky-900 bg-sky-100 px-2 py-0.5 rounded-md cursor-pointer"
                  >
                    กำลังส่อง: {cardMapFocusLabel} (กดเพื่อรีเซ็ต)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowLiveMapEmbed(!showLiveMapEmbed)}
                  className="text-xs font-extrabold text-sky-900 hover:underline cursor-pointer"
                >
                  {showLiveMapEmbed ? 'ย่อแผนที่ในเว็บ' : 'แสดงแผนที่ในเว็บ'}
                </button>
              </div>
            </div>

            {showLiveMapEmbed && (
              <div className="rounded-2xl overflow-hidden border border-slate-300 bg-slate-100 h-56 sm:h-64 relative">
                {inlineViewerMode === 'map' ? (
                  <iframe
                    key={activeCardMapEmbedUrl}
                    title={`แผนที่ ${cardMapFocusLabel || location.name}`}
                    src={activeCardMapEmbedUrl}
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <iframe
                    key={activeCardWindyEmbedUrl}
                    title={`เรดาร์เมฆฝนสด ${location.name}`}
                    src={activeCardWindyEmbedUrl}
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {onOpenInAppViewer && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenInAppViewer('road_flood_matrix', {
                      title: location.name,
                      lat: location.lat,
                      lng: location.lng
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-colors cursor-pointer"
                >
                  <span>ดูตารางน้ำท่วมถนนและสีจราจรในเว็บ</span>
                </button>
              )}
              <a
                href={trafficStatus.googleTrafficLayerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-colors"
              >
                <Car className="w-3.5 h-3.5 text-emerald-400" />
                <span>เปิดเว็บ Google Maps Traffic</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={
                  location.province === 'กรุงเทพมหานคร'
                    ? verificationLinks.bmaFloodWebUrl
                    : verificationLinks.dohFloodWebUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-extrabold transition-colors"
              >
                <span>
                  {location.province === 'กรุงเทพมหานคร'
                    ? 'เว็บน้ำท่วม กทม.'
                    : 'เว็บทางหลวง DOH'}
                </span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ส่วนสภาพอากาศปัจจุบัน + พยากรณ์ล่วงหน้า */}
      <div className="p-5 sm:p-6 border-b border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500" />
            <h4 className="text-base sm:text-lg font-black text-slate-900">
              3. สภาพอากาศตอนนี้ และการเตรียมตัว
            </h4>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInlineWeatherRadar(!showInlineWeatherRadar)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer transition-colors"
            >
              <CloudRain className="w-3.5 h-3.5" />
              <span>{showInlineWeatherRadar ? 'ซ่อนเรดาร์ฝนสดในเว็บ' : 'ดูเรดาร์ฝนสดในเว็บนี้'}</span>
            </button>
            <a
              href={verificationLinks.windyRadarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-sky-700 hover:text-sky-950 underline underline-offset-2"
            >
              <span>เปิดเว็บ Windy</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={verificationLinks.tmdWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              <span>เว็บกรมอุตุฯ (TMD)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {showInlineWeatherRadar && (
          <div className="rounded-2xl overflow-hidden border-2 border-sky-400 bg-slate-900 h-72 sm:h-80 relative">
            <iframe
              title={`เรดาร์เมฆฝนในเว็บ ${location.name}`}
              src={activeCardWindyEmbedUrl}
              className="w-full h-full border-0"
              loading="lazy"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-sky-50/60 rounded-2xl p-4 border border-sky-100">
          <div className="sm:col-span-4 flex justify-center">
            <WeatherSceneGraphic kind={status.weatherKind} isDay={status.isDay} />
          </div>
          <div className="sm:col-span-8 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tabular-nums">
                {status.tempC}°C
              </span>
              <span className="text-sm sm:text-base font-extrabold text-orange-800 bg-orange-100/90 px-2.5 py-0.5 rounded-lg">
                {status.feelsLikeHeadline}
              </span>
            </div>
            <p className="text-xl font-black text-slate-900">{status.weatherHeadline}</p>
            <p className="text-sm font-medium text-slate-700 leading-relaxed">
              {status.weatherDescription}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200/80 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
            <Shirt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
              คำแนะนำการสวมเสื้อผ้าและเตรียมตัว
            </p>
            <p className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
              {status.clothingAdvice}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <CloudRain className="w-3.5 h-3.5 text-sky-600" />
              โอกาสเกิดฝน
            </span>
            <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
              {status.rainProbabilityPercent}%
            </p>
            <span className="text-[11px] font-semibold text-slate-600">
              {status.rainProbabilityPercent >= 60
                ? 'โอกาสฝนตกสูง ควรพกร่ม'
                : status.rainProbabilityPercent >= 35
                  ? 'อาจมีฝนบางช่วง'
                  : 'โอกาสฝนตกน้อย'}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-600" />
              ปริมาณฝนตอนนี้
            </span>
            <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
              {status.rainMmPerHour} มม./ชม.
            </p>
            <span className="text-[11px] font-semibold text-slate-600">
              {status.rainMmPerHour > 0 ? 'กำลังมีฝนตกในพื้นที่' : 'ตอนนี้ไม่มีฝนตก'}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-teal-600" />
              ความชื้นในอากาศ
            </span>
            <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
              {status.humidityPercent}%
            </p>
            <span className="text-[11px] font-semibold text-slate-600">
              {status.humidityPercent >= 75 ? 'อากาศชื้น/อบอ้าว' : 'ความชื้นปกติ'}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-slate-600" />
              ความเร็วลม
            </span>
            <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
              {status.windKmh} กม./ชม.
            </p>
            <span className="text-[11px] font-semibold text-slate-600">
              ลมกระโชกสูงสุด {status.windGustKmh} กม./ชม.
            </span>
          </div>
        </div>

        {status.hourlyForecast.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-sky-600" />
                พยากรณ์อากาศล่วงหน้า 12 ชั่วโมง (ทุก 2 ชม.)
              </p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {status.hourlyForecast.map((hf, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-center flex flex-col justify-between"
                >
                  <span className="text-xs font-black text-slate-700">{hf.timeLabel}</span>
                  <span className="text-base font-black text-slate-950 my-1 tabular-nums">
                    {hf.tempC}°C
                  </span>
                  <span className="text-[11px] font-bold text-slate-700 line-clamp-1">
                    {hf.weatherText}
                  </span>
                  <span
                    className={`text-[11px] font-extrabold mt-1 ${
                      hf.rainProbPercent >= 50 ? 'text-blue-700' : 'text-slate-500'
                    }`}
                  >
                    โอกาสฝน {hf.rainProbPercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. ข้อมูลสถานีวัดระดับน้ำและสถานีวัดน้ำฝนจริงของหน่วยงานรัฐ (สสน. / ThaiWater) */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-700" />
            <div>
              <h4 className="text-base sm:text-lg font-black text-slate-900">
                4. ข้อมูลจริงจากสถานีวัดน้ำและน้ำฝนของรัฐ (สสน. / ThaiWater)
              </h4>
              <p className="text-xs font-semibold text-slate-600">
                ดึงข้อมูลตรงจากระบบโทรมาตร คลังข้อมูลน้ำแห่งชาติ (สถาบันสารสนเทศทรัพยากรน้ำ)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenInAppViewer && (
              <button
                type="button"
                onClick={() => onOpenInAppViewer('water_table')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer transition-colors"
              >
                <span>ดูตารางสถานีวัดน้ำ-ฝนทั้งหมดในเว็บนี้</span>
              </button>
            )}
            <a
              href={verificationLinks.thaiWaterLevelWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-extrabold transition-colors"
            >
              <span>เปิดเว็บคลังข้อมูลน้ำแห่งชาติ (ThaiWater)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* สถานีวัดระดับน้ำจริง */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
            {primaryWaterStation ? (
              <>
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        สถานีวัดระดับน้ำใกล้ที่สุด (ห่าง {primaryWaterStation.distanceKm.toFixed(1)} กม.)
                      </span>
                      <h5 className="text-base font-black text-slate-900 mt-1.5">
                        สถานี{primaryWaterStation.name}{' '}
                        {primaryWaterStation.code !== '-' && (
                          <span className="text-xs font-bold text-slate-500">
                            (รหัส {primaryWaterStation.code})
                          </span>
                        )}
                      </h5>
                      <p className="text-xs font-semibold text-slate-600">
                        ต.{primaryWaterStation.tambon || '-'} อ.{primaryWaterStation.amphoe || '-'} จ.{primaryWaterStation.province} • {primaryWaterStation.basin}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                        primaryWaterStation.situationLevel === 5
                          ? 'bg-red-600 text-white'
                          : primaryWaterStation.situationLevel === 4
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {primaryWaterStation.situationLabel}
                    </span>
                  </div>

                  {primaryWaterStation.storagePercent !== null && (
                    <div className="my-3 bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                      <div className="flex items-baseline justify-between text-xs font-black mb-1.5">
                        <span className="text-slate-700">ปริมาณน้ำเทียบความจุตลิ่ง:</span>
                        <span className="text-base text-slate-950 tabular-nums">
                          {primaryWaterStation.storagePercent.toFixed(1)}% ของตลิ่ง
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            primaryWaterStation.storagePercent > 100
                              ? 'bg-red-600'
                              : primaryWaterStation.storagePercent > 85
                                ? 'bg-orange-500'
                                : primaryWaterStation.storagePercent > 70
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(8, primaryWaterStation.storagePercent))}%`
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2.5 text-xs">
                        <div>
                          <span className="text-slate-500 font-semibold">ระดับน้ำ (ม.รทก.): </span>
                          <strong className="text-slate-900 font-black tabular-nums">
                            {primaryWaterStation.waterLevelMsl ?? '-'} ม.
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold">
                            {primaryWaterStation.diffBankText}:{' '}
                          </span>
                          <strong className="text-slate-900 font-black tabular-nums">
                            {primaryWaterStation.diffBankM ?? '-'} ม.
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-slate-600 font-semibold">
                    <span>หน่วยงาน: {primaryWaterStation.agency}</span>
                    <span className="block text-[11px] text-slate-500">
                      เวลาตรวจวัดจริง: {primaryWaterStation.observedAt}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleFocusInCardMap(
                          `${primaryWaterStation.lat},${primaryWaterStation.lng}`,
                          `สถานีวัดน้ำ ${primaryWaterStation.name}`
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>ดูแผนที่ในเว็บ</span>
                    </button>
                    <a
                      href={primaryWaterStation.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold transition-colors"
                    >
                      <span>เว็บนอก</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-600 py-4">
                กำลังเชื่อมต่อข้อมูลสถานีวัดระดับน้ำจากคลังข้อมูลน้ำแห่งชาติ...
              </div>
            )}
          </div>

          {/* สถานีวัดน้ำฝนจริง */}
          <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
            {primaryRainStation ? (
              <>
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-sky-900 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">
                        สถานีวัดน้ำฝนใกล้ที่สุด (ห่าง {primaryRainStation.distanceKm.toFixed(1)} กม.)
                      </span>
                      <h5 className="text-base font-black text-slate-900 mt-1.5">
                        สถานี{primaryRainStation.name}
                      </h5>
                      <p className="text-xs font-semibold text-slate-600">
                        ต.{primaryRainStation.tambon || '-'} อ.{primaryRainStation.amphoe || '-'} จ.{primaryRainStation.province}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                        primaryRainStation.rain24hMm >= 60
                          ? 'bg-red-600 text-white'
                          : primaryRainStation.rain24hMm >= 30
                            ? 'bg-amber-500 text-slate-950'
                            : primaryRainStation.rain24hMm > 0
                              ? 'bg-sky-600 text-white'
                              : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {primaryRainStation.rain24hMm >= 60
                        ? 'ฝนสะสมหนักมาก'
                        : primaryRainStation.rain24hMm >= 30
                          ? 'ฝนสะสมปานกลาง-มาก'
                          : primaryRainStation.rain24hMm > 0
                            ? 'มีฝนตกในพื้นที่'
                            : 'ไม่มีฝนสะสม'}
                    </span>
                  </div>

                  <div className="my-3 bg-slate-50 rounded-xl p-3 border border-slate-200/80 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-600 block">
                        ปริมาณฝนสะสม 24 ชม.
                      </span>
                      <span className="text-2xl font-black text-slate-950 tabular-nums">
                        {primaryRainStation.rain24hMm} มม.
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-600 block">
                        ฝนสะสมสูงสุดในรัศมี 15 กม.
                      </span>
                      <span className="text-2xl font-black text-sky-900 tabular-nums">
                        {status.maxLocalRain24hMm.toFixed(1)} มม.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-slate-600 font-semibold">
                    <span>หน่วยงาน: {primaryRainStation.agency}</span>
                    <span className="block text-[11px] text-slate-500">
                      เวลาตรวจวัดจริง: {primaryRainStation.observedAt}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleFocusInCardMap(
                          `${primaryRainStation.lat},${primaryRainStation.lng}`,
                          `สถานีวัดฝน ${primaryRainStation.name}`
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>ดูแผนที่ในเว็บ</span>
                    </button>
                    <a
                      href={primaryRainStation.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold transition-colors"
                    >
                      <span>เว็บนอก</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-600 py-4">
                กำลังเชื่อมต่อข้อมูลสถานีวัดน้ำฝนจากคลังข้อมูลน้ำแห่งชาติ...
              </div>
            )}
          </div>
        </div>

        {(status.nearbyWaterStations.length > 1 || status.nearbyRainStations.length > 1) && (
          <div>
            <button
              type="button"
              onClick={() => setShowMoreStations(!showMoreStations)}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 hover:text-slate-950 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer"
            >
              {showMoreStations ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>ซ่อนสถานีตรวจวัดใกล้เคียงจุดอื่น</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>
                    ดูสถานีตรวจวัดระดับน้ำและน้ำฝนใกล้เคียงเพิ่มเติมอีก{' '}
                    {status.nearbyWaterStations.length + status.nearbyRainStations.length - 2} สถานี
                  </span>
                </>
              )}
            </button>

            {showMoreStations && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {status.nearbyWaterStations.slice(1).map((ws) => (
                  <div
                    key={`ws-${ws.id}`}
                    className="rounded-xl bg-white border border-slate-200 p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-black text-slate-900 block">
                        สถานีวัดน้ำ: {ws.name} (ห่าง {ws.distanceKm} กม.)
                      </span>
                      <span className="text-slate-600 font-semibold">
                        อ.{ws.amphoe} จ.{ws.province} • {ws.situationLabel} (
                        {ws.storagePercent !== null
                          ? `${ws.storagePercent.toFixed(1)}% ของตลิ่ง`
                          : `${ws.waterLevelMsl ?? '-'} ม.รทก.`}
                        )
                      </span>
                    </div>
                    <a
                      href={ws.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold shrink-0 inline-flex items-center gap-1"
                    >
                      <span>แผนที่</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}

                {status.nearbyRainStations.slice(1, 5).map((rs) => (
                  <div
                    key={`rs-${rs.id}`}
                    className="rounded-xl bg-white border border-slate-200 p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-black text-slate-900 block">
                        สถานีวัดฝน: {rs.name} (ห่าง {rs.distanceKm} กม.)
                      </span>
                      <span className="text-slate-600 font-semibold">
                        ต.{rs.tambon} อ.{rs.amphoe} • ฝนสะสม 24 ชม.:{' '}
                        <strong className="text-slate-900">{rs.rain24hMm} มม.</strong>
                      </span>
                    </div>
                    <a
                      href={rs.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold shrink-0 inline-flex items-center gap-1"
                    >
                      <span>แผนที่</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. ถนนเส้นรอง ซอย หมู่บ้าน ชุมชน และลำน้ำของจริงในพื้นที่ */}
      <div className="p-5 sm:p-6 border-b border-slate-100 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowLocalAreaDetails(!showLocalAreaDetails)}
            className="flex items-center gap-2 text-left cursor-pointer group"
          >
            <Route className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <h4 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-emerald-800 transition-colors">
                5. ถนนเชื่อมโยง ซอยย่อย หมู่บ้าน และลำน้ำรอบพื้นที่ {location.name}
              </h4>
              <p className="text-xs font-semibold text-slate-600">
                ดึงรายชื่อจริงจาก OpenStreetMap และสถานีท้องถิ่น • กดปุ่ม “จราจรสด” เพื่อดูเส้นสีจราจรของแต่ละซอยได้ทันที
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setShowLocalAreaDetails(!showLocalAreaDetails)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
          >
            {showLocalAreaDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {showLocalAreaDetails && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-2.5">
              <label className="block text-xs font-black text-emerald-950">
                ค้นหาซอย หมู่บ้าน หรือจุดสำคัญเฉพาะเจาะจงในย่าน {location.name} (ดูแผนที่ในเว็บได้ทันทีโดยไม่ต้องออกนอกเว็บ):
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={localSearchInput}
                    onChange={(e) => setLocalSearchInput(e.target.value)}
                    placeholder={`พิมพ์ชื่อซอย หมู่บ้าน หรืออาคารใน ${location.name}...`}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-emerald-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const q = localSearchInput.trim()
                        ? `${localSearchInput.trim()} ${location.tambon} ${location.amphoe} ${location.province}`
                        : `${location.name} ${location.province}`;
                      handleFocusInCardMap(q, localSearchInput.trim() || location.name);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition-colors cursor-pointer shrink-0"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>ดูแผนที่จุดนี้ในเว็บ</span>
                  </button>
                  <a
                    href={customMapSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition-colors shrink-0"
                  >
                    <span>เปิดเว็บ Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={customOsmSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-extrabold transition-colors shrink-0"
                  >
                    <span>เว็บ OSM</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-4">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-sky-700" />
                  ถนนสายหลัก ถนนเส้นรอง และซอยจริงในพื้นที่ ({status.realRoads.length})
                </h5>
                {status.realRoads.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {status.realRoads.map((road) => (
                      <div
                        key={road.id}
                        className="rounded-xl bg-white border border-slate-200/90 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {road.name}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {road.typeLabel}
                            {road.distanceKm > 0 ? ` • ห่าง ${road.distanceKm} กม.` : ''} • {road.sourceLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleFocusInCardMap(
                                `${road.name} ${location.amphoe} ${location.province}`,
                                road.name
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black cursor-pointer"
                          >
                            ดูในเว็บ
                          </button>
                          <a
                            href={road.googleTrafficUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-[11px] font-extrabold inline-flex items-center gap-1"
                          >
                            <span>เว็บนอก</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    กดปุ่ม “เปิดดูบน Google Maps” ด้านบนเพื่อดูโครงข่ายถนนและซอยย่อยทั้งหมดในย่านนี้
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-4">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-emerald-700" />
                  หมู่บ้าน ชุมชน จุดสำคัญ และลำน้ำจริงในพื้นที่ (
                  {status.realVillagesAndLandmarks.length + status.realWaterways.length})
                </h5>
                {status.realVillagesAndLandmarks.length > 0 || status.realWaterways.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {status.realWaterways.map((ww) => (
                      <div
                        key={ww.id}
                        className="rounded-xl bg-blue-50/70 border border-blue-200/90 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black text-blue-950 truncate">
                            🌊 {ww.name}
                          </p>
                          <p className="text-[11px] font-semibold text-blue-800">
                            {ww.typeLabel} • {ww.sourceLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleFocusInCardMap(
                                `${ww.name} ${location.amphoe} ${location.province}`,
                                ww.name
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black cursor-pointer"
                          >
                            ดูในเว็บ
                          </button>
                          <a
                            href={ww.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-100 text-blue-900 border border-blue-200 text-[11px] font-extrabold inline-flex items-center gap-1"
                          >
                            <span>เว็บนอก</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}

                    {status.realVillagesAndLandmarks.map((pl) => (
                      <div
                        key={pl.id}
                        className="rounded-xl bg-white border border-slate-200/90 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {pl.name}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {pl.typeLabel}
                            {pl.streetName ? ` (${pl.streetName})` : ''}
                            {pl.distanceKm > 0 ? ` • ห่าง ${pl.distanceKm} กม.` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleFocusInCardMap(
                                `${pl.name} ${location.amphoe} ${location.province}`,
                                pl.name
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black cursor-pointer"
                          >
                            ดูในเว็บ
                          </button>
                          <a
                            href={pl.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-extrabold inline-flex items-center gap-1"
                          >
                            <span>เว็บนอก</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    กดปุ่ม “เปิดดูบน Google Maps” ด้านบนเพื่อดูหมู่บ้านและชุมชนทั้งหมดในย่านนี้
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. กล่องตรวจสอบแหล่งข้อมูลจริง (คลิกเปิดดูข้อมูลต้นทางได้ทุกจุด) */}
      <div className="p-5 sm:p-6 bg-slate-900 text-white">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h4 className="text-sm sm:text-base font-black text-white">
                ตรวจสอบแหล่งข้อมูลจริง (คลิกเพื่อเปิดดูข้อมูลต้นทางจากหน่วยงานรัฐและแผนที่จราจร)
              </h4>
              <p className="text-xs text-slate-300">
                ข้อมูลทุกตัวในหน้านี้ดึงจากแหล่งข้อมูลจริง สามารถกดลิงก์ด้านล่างเพื่อเทียบเคียงข้อมูลต้นฉบับได้ทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowVerificationPanel(!showVerificationPanel)}
            className="text-xs font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 cursor-pointer shrink-0"
          >
            {showVerificationPanel ? 'ย่อลง' : 'แสดงลิงก์ทั้งหมด'}
          </button>
        </div>

        {showVerificationPanel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            <a
              href={verificationLinks.thaiWaterLevelWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 p-3 flex items-start justify-between gap-2 transition-colors"
            >
              <div>
                <span className="text-xs font-black text-sky-300 block">
                  1. ระดับน้ำทั่วประเทศ (สสน.)
                </span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                  คลังข้อมูลน้ำแห่งชาติ (ThaiWater.net)
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
            </a>

            <a
              href={verificationLinks.thaiWaterRainWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 p-3 flex items-start justify-between gap-2 transition-colors"
            >
              <div>
                <span className="text-xs font-black text-sky-300 block">
                  2. ปริมาณฝนสะสม 24 ชม. (สสน.)
                </span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                  ตารางและแผนที่สถานีวัดน้ำฝนทั่วไทย
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
            </a>

            <a
              href={verificationLinks.googleMapsTrafficUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 p-3 flex items-start justify-between gap-2 transition-colors"
            >
              <div>
                <span className="text-xs font-black text-orange-300 block">
                  3. สภาพจราจรสด (Google Traffic)
                </span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                  เปิดดูสีจราจรสดพิกัด {location.name}
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-orange-300 shrink-0 mt-0.5" />
            </a>

            <a
              href={verificationLinks.dohFloodWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 p-3 flex items-start justify-between gap-2 transition-colors"
            >
              <div>
                <span className="text-xs font-black text-amber-300 block">
                  4. น้ำท่วมทางหลวง (กรมทางหลวง DOH)
                </span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                  ระบบติดตามสภาพน้ำท่วมบนทางหลวงทั่วไทย
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            </a>

            <a
              href={verificationLinks.bmaFloodWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 p-3 flex items-start justify-between gap-2 transition-colors"
            >
              <div>
                <span className="text-xs font-black text-amber-300 block">
                  5. ระบบตรวจวัดน้ำท่วมถนน กทม. (DDS)
                </span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                  สำนักการระบายน้ำ กรุงเทพมหานคร
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            </a>

            <a
              href={verificationLinks.windyRadarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 p-3 flex items-start justify-between gap-2 transition-colors"
            >
              <div>
                <span className="text-xs font-black text-emerald-300 block">
                  6. เรดาร์กลุ่มเมฆฝนสด (Windy Radar)
                </span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block">
                  เปิดดูกลุ่มฝนตรงพิกัด {location.name}
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            </a>
          </div>
        )}

        <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>อัปเดตข้อมูลล่าสุดเวลา {status.updatedAt} น.</span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowInlineRawJson(!showInlineRawJson)}
              className="text-sky-300 hover:text-white font-black underline underline-offset-2 cursor-pointer"
            >
              {showInlineRawJson ? 'ซ่อนข้อมูลดิบ API ในเว็บ' : 'ดูข้อมูลดิบ API ในเว็บนี้ทันที'}
            </button>
            <a
              href={verificationLinks.thaiWaterLevelApiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline underline-offset-2 inline-flex items-center gap-1"
            >
              <span>API ระดับน้ำ สสน. (เว็บนอก)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={verificationLinks.thaiWaterRainApiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline underline-offset-2 inline-flex items-center gap-1"
            >
              <span>API น้ำฝน สสน. (เว็บนอก)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={verificationLinks.openMeteoApiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline underline-offset-2 inline-flex items-center gap-1"
            >
              <span>API สภาพอากาศ (เว็บนอก)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {showInlineRawJson && (
          <div className="mt-3 rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs font-mono tabular-nums text-emerald-300 overflow-x-auto max-h-64">
            <pre>
              {JSON.stringify(
                {
                  location: status.location.name,
                  coords: { lat: status.location.lat, lng: status.location.lng },
                  traffic: {
                    color: status.trafficStatus.colorNameTh,
                    speed: status.trafficStatus.estimatedSpeedText,
                    delay: status.trafficStatus.delayEstimateText
                  },
                  waterStation: status.primaryWaterStation,
                  rainStation: status.primaryRainStation,
                  weather: {
                    tempC: status.tempC,
                    rainProb: status.rainProbabilityPercent,
                    rainMmPerHour: status.rainMmPerHour,
                    windKmh: status.windKmh
                  }
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </article>
  );
};
