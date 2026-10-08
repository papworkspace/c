import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Car,
  CloudRain,
  Database,
  Droplets,
  ExternalLink,
  Eye,
  Layers,
  MapPin,
  Navigation,
  Radio,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Waves,
  Wind,
  X
} from 'lucide-react';
import { ThaiLocation } from '../data/thaiLocations';
import {
  getAllLiveTelemetrySnapshot,
  LocationRealtimeStatus,
  TrafficColorCode
} from '../services/weatherWaterService';

export type InAppViewerTab =
  | 'map_traffic'
  | 'weather_radar'
  | 'water_table'
  | 'rain_table'
  | 'road_flood_matrix'
  | 'raw_api_inspector';

export type WindyRadarOverlay = 'radar' | 'rain' | 'wind' | 'clouds' | 'temp';

export interface InAppFocusTarget {
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  mapSearchQuery?: string;
  externalUrl?: string;
  externalLabel?: string;
  secondaryExternalUrl?: string;
  secondaryExternalLabel?: string;
}

interface InAppDataCenterProps {
  activeStatus: LocationRealtimeStatus;
  allRouteStatuses?: LocationRealtimeStatus[];
  activeTab: InAppViewerTab;
  onTabChange: (tab: InAppViewerTab) => void;
  focusTarget?: InAppFocusTarget | null;
  onClearFocusTarget?: () => void;
  onSelectLocation: (loc: ThaiLocation) => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

const TRAFFIC_DOT_CLASSES: Record<TrafficColorCode, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-600'
};

export const InAppDataCenter: React.FC<InAppDataCenterProps> = ({
  activeStatus,
  allRouteStatuses = [],
  activeTab,
  onTabChange,
  focusTarget,
  onClearFocusTarget,
  onSelectLocation,
  isModal = false,
  onCloseModal
}) => {
  const [radarOverlay, setRadarOverlay] = useState<WindyRadarOverlay>('radar');
  const [tableFilterQuery, setTableFilterQuery] = useState<string>('');
  const [waterStatusFilter, setWaterStatusFilter] = useState<'all' | 'overflow' | 'watch' | 'normal'>('all');
  const [rainLevelFilter, setRainLevelFilter] = useState<'all' | 'heavy' | 'moderate'>('all');
  const [trafficColorFilter, setTrafficColorFilter] = useState<'all' | TrafficColorCode>('all');
  const [mapZoomLevel, setMapZoomLevel] = useState<number>(15);

  const telemetry = useMemo(
    () => getAllLiveTelemetrySnapshot(tableFilterQuery),
    [tableFilterQuery]
  );

  // พิกัดที่ใช้แสดงผลบนแผนที่และเรดาร์ในเว็บ
  const targetLat = focusTarget?.lat ?? activeStatus.location.lat;
  const targetLng = focusTarget?.lng ?? activeStatus.location.lng;
  const targetTitle = focusTarget?.title ?? activeStatus.location.name;
  const targetSubtitle =
    focusTarget?.subtitle ??
    `${activeStatus.location.tambon} ${activeStatus.location.amphoe} จ.${activeStatus.location.province}`;

  const embeddedGoogleMapUrl = useMemo(() => {
    if (focusTarget?.mapSearchQuery) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(
        focusTarget.mapSearchQuery
      )}&t=m&z=${mapZoomLevel}&output=embed&hl=th`;
    }
    return `https://maps.google.com/maps?q=${targetLat},${targetLng}&t=m&z=${mapZoomLevel}&output=embed&hl=th`;
  }, [focusTarget, targetLat, targetLng, mapZoomLevel]);

  const embeddedWindyRadarUrl = useMemo(() => {
    return `https://embed.windy.com/embed2.html?lat=${targetLat.toFixed(
      4
    )}&lon=${targetLng.toFixed(4)}&detailLat=${targetLat.toFixed(
      4
    )}&detailLon=${targetLng.toFixed(
      4
    )}&width=900&height=520&zoom=10&level=surface&overlay=${radarOverlay}&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
  }, [targetLat, targetLng, radarOverlay]);

  const filteredWaterStations = useMemo(() => {
    return telemetry.waterStations.filter(({ station: ws }) => {
      const pct = ws.storagePercent ?? 0;
      if (waterStatusFilter === 'overflow') return ws.situationLevel === 5 || pct > 100;
      if (waterStatusFilter === 'watch') return ws.situationLevel === 4 || (pct >= 80 && pct <= 100);
      if (waterStatusFilter === 'normal') return ws.situationLevel !== 5 && ws.situationLevel !== 4 && pct < 80;
      return true;
    });
  }, [telemetry.waterStations, waterStatusFilter]);

  const filteredRainStations = useMemo(() => {
    return telemetry.rainStations.filter(({ station: rs }) => {
      if (rainLevelFilter === 'heavy') return rs.rain24hMm >= 35;
      if (rainLevelFilter === 'moderate') return rs.rain24hMm > 0;
      return true;
    });
  }, [telemetry.rainStations, rainLevelFilter]);

  const filteredRoadStatuses = useMemo(() => {
    return telemetry.roadStatuses.filter((st) => {
      if (trafficColorFilter === 'all') return true;
      return st.trafficStatus.colorCode === trafficColorFilter;
    });
  }, [telemetry.roadStatuses, trafficColorFilter]);

  return (
    <section
      className={`rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden ${
        isModal ? 'ring-2 ring-sky-500' : ''
      }`}
    >
      {/* แถบหัวศูนย์ข้อมูลสดในเว็บ (In-App Command Center Header) */}
      <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-300 font-semibold">
              <span>ศูนย์ดูข้อมูลสดในเว็บครบวงจร (ไม่ต้องสลับออกนอกเว็บ)</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-300">
                อัปเดต {telemetry.updatedAt} น.
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
              ดูแผนที่ถนน-ซอย • เรดาร์เมฆฝนสด • ตารางสถานีวัดน้ำ สสน. และข้อมูลทางหลวงในหน้าเดียว
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            {focusTarget && onClearFocusTarget && (
              <button
                type="button"
                onClick={onClearFocusTarget}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer whitespace-nowrap"
              >
                กลับพิกัดหลัก ({activeStatus.location.name})
              </button>
            )}
            {isModal && onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black cursor-pointer whitespace-nowrap"
              >
                <X className="w-4 h-4" />
                <span>ปิดหน้าต่างขยาย</span>
              </button>
            )}
          </div>
        </div>

        {/* ปุ่มสลับโหมดดูข้อมูลในเว็บ (In-App View Switcher) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => onTabChange('map_traffic')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'map_traffic'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>1. แผนที่ถนน-ซอย & จราจรในเว็บ</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('weather_radar')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'weather_radar'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>2. เรดาร์กลุ่มเมฆฝน & ลมสดในเว็บ</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('water_table')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'water_table'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>
              3. ตารางระดับน้ำ สสน. ในเว็บ ({telemetry.totalWaterCount.toLocaleString()} สถานี)
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('rain_table')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'rain_table'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>
              4. ตารางน้ำฝนสะสม สสน. ในเว็บ ({telemetry.totalRainCount.toLocaleString()} สถานี)
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('road_flood_matrix')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'road_flood_matrix'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>5. ตารางน้ำท่วมถนน & สีจราจร ({telemetry.totalRoadCount} ช่วงถนน)</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('raw_api_inspector')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'raw_api_inspector'
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>6. ข้อมูลดิบ API & ลิงก์หน่วยงานรัฐ</span>
          </button>
        </div>
      </div>

      {/* เนื้อหาแต่ละแท็บที่แสดงผลในเว็บทันที */}
      <div className="p-4 sm:p-6">
        {/* แท็บที่ 1: แผนที่พิกัดจริง ถนน ซอย จุดตั้งสถานี และสภาพจราจรในเว็บ */}
        {activeTab === 'map_traffic' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-bold">
                  <span>กำลังแสดงแผนที่ในเว็บของพิกัด:</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    GPS {targetLat.toFixed(4)}, {targetLng.toFixed(4)}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  {targetTitle}{' '}
                  <span className="text-xs sm:text-sm font-bold text-slate-600">
                    ({targetSubtitle})
                  </span>
                </h3>
              </div>

              {/* ปุ่มปรับระยะซูมในเว็บ + ปุ่มกดไปดูเว็บอื่นหากต้องการเช็คเทียบ */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
                  <span className="px-2 text-slate-600">ระยะซูม:</span>
                  {[
                    { z: 13, label: 'ระดับอำเภอ' },
                    { z: 15, label: 'ระดับถนน' },
                    { z: 17, label: 'ระดับซอย/หมู่บ้าน' }
                  ].map((item) => (
                    <button
                      key={item.z}
                      type="button"
                      onClick={() => setMapZoomLevel(item.z)}
                      className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                        mapZoomLevel === item.z
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700 hover:text-slate-950'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <a
                  href={
                    focusTarget?.externalUrl ||
                    activeStatus.trafficStatus.googleTrafficLayerUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black whitespace-nowrap"
                >
                  <span>{focusTarget?.externalLabel || 'เปิด Google Maps Traffic เว็บนอก'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href={
                    focusTarget?.secondaryExternalUrl ||
                    activeStatus.verificationLinks.openStreetMapUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold whitespace-nowrap"
                >
                  <span>{focusTarget?.secondaryExternalLabel || 'เปิด OpenStreetMap'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* แถบสรุปสถานะสีจราจรและระดับน้ำของพิกัดที่ดูอยู่ควบคู่กับแผนที่ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-500 block">
                    สัญลักษณ์สีจราจรพื้นที่หลัก
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`w-3.5 h-3.5 rounded-full inline-block ${
                        TRAFFIC_DOT_CLASSES[activeStatus.trafficStatus.colorCode]
                      }`}
                    />
                    <span className="text-sm font-black text-slate-900">
                      {activeStatus.trafficStatus.colorNameTh}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-700 font-mono tabular-nums">
                  {activeStatus.trafficStatus.estimatedSpeedText}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-500 block">
                    สถานะน้ำท่วมขังผิวจราจร
                  </span>
                  <span className="text-sm font-black text-slate-900 mt-1 block">
                    {activeStatus.waterHeadline}
                  </span>
                </div>
                <span className="text-xs font-bold text-sky-900">
                  {activeStatus.waterSafetyTier === 'normal' ? 'สัญจรปกติ' : 'โปรดระวัง'}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-500 block">
                    สภาพอากาศและฝนตอนนี้
                  </span>
                  <span className="text-sm font-black text-slate-900 mt-1 block">
                    {activeStatus.weatherHeadline} ({activeStatus.tempC}°C)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onTabChange('weather_radar')}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer whitespace-nowrap"
                >
                  สลับดูเรดาร์ฝนสด
                </button>
              </div>
            </div>

            {/* แผนที่แบบโต้ตอบได้ฝังในเว็บ (Interactive Embedded Map) */}
            <div className="rounded-xl overflow-hidden border border-slate-300 bg-slate-100 h-96 sm:h-[440px] relative">
              <iframe
                key={embeddedGoogleMapUrl}
                title={`แผนที่ในเว็บ ${targetTitle}`}
                src={embeddedGoogleMapUrl}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* ปุ่มกดเลือกจุดย่อยในพื้นที่ (ถนนรอง ซอย หมู่บ้าน ลำน้ำ สถานีวัดน้ำ) เพื่อสลับดูบนแผนที่ในเว็บนี้ได้ทันที */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-black text-slate-700">
                คลิกชื่อถนน ซอย หมู่บ้าน ลำน้ำ หรือสถานีตรวจวัดด้านล่าง เพื่อเลื่อนแผนที่ในเว็บนี้ไปดูพิกัดนั้นทันที:
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onClearFocusTarget && onClearFocusTarget()}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                    !focusTarget
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  พิกัดหลัก: {activeStatus.location.name}
                </button>

                {activeStatus.primaryWaterStation && (
                  <button
                    type="button"
                    onClick={() =>
                      onSelectLocation({
                        ...activeStatus.location,
                        lat: activeStatus.primaryWaterStation!.lat,
                        lng: activeStatus.primaryWaterStation!.lng
                      })
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-950 border border-blue-200 cursor-pointer transition-colors"
                  >
                    สถานีวัดน้ำ: {activeStatus.primaryWaterStation.name}
                  </button>
                )}

                {activeStatus.realRoads.slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setMapZoomLevel(16);
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 hover:bg-sky-50 text-slate-800 border border-slate-200 cursor-pointer transition-colors"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* แท็บที่ 2: เรดาร์กลุ่มเมฆฝน & กระแสลมสดในเว็บ (Windy Live Weather Radar Embed) */}
        {activeTab === 'weather_radar' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  เรดาร์ตรวจอากาศและกลุ่มเมฆฝนสดในเว็บ: พิกัด {targetTitle}
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  ซูมและเลื่อนดูทิศทางกลุ่มเมฆฝน พายุ และความเร็วลมได้โดยตรงในหน้านี้ หรือกดสลับชั้นข้อมูลด้านขวา
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'radar', label: 'เรดาร์ฝนสด (Radar)' },
                    { id: 'rain', label: 'ฝนสะสม (Rain)' },
                    { id: 'wind', label: 'กระแสลม (Wind)' },
                    { id: 'clouds', label: 'กลุ่มเมฆ (Clouds)' },
                    { id: 'temp', label: 'อุณหภูมิ (Temp)' }
                  ] as Array<{ id: WindyRadarOverlay; label: string }>
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRadarOverlay(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors whitespace-nowrap ${
                      radarOverlay === item.id
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                <a
                  href={activeStatus.verificationLinks.windyRadarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black whitespace-nowrap"
                >
                  <span>เปิดเว็บ Windy เต็มจอ</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  href={activeStatus.verificationLinks.tmdWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold whitespace-nowrap"
                >
                  <span>เว็บกรมอุตุฯ (TMD)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-300 bg-slate-900 h-96 sm:h-[460px] relative">
              <iframe
                key={embeddedWindyRadarUrl}
                title={`เรดาร์สภาพอากาศสด ${targetTitle}`}
                src={embeddedWindyRadarUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* แท็บที่ 3: ตารางข้อมูลสถานีวัดระดับน้ำทั่วประเทศของ สสน. (ThaiWater) ในเว็บ */}
        {activeTab === 'water_table' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ตารางสถานีวัดระดับน้ำโทรมาตรทั่วประเทศ (ข้อมูลจริงจากคลังข้อมูลน้ำแห่งชาติ สสน.)
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  ดูค่าระดับน้ำเทียบตลิ่งได้โดยตรงในหน้าเว็บนี้ หรือกดปุ่ม “ดูจุดนี้ในเว็บ” เพื่อเช็คถนนและสีจราจรรอบสถานีทันที
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://www.thaiwater.net/water/wl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black whitespace-nowrap"
                >
                  <span>เปิดเว็บ ThaiWater ต้นทาง</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* แถบค้นหาและกรองสถานะระดับน้ำ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'ทุกสถานะ' },
                  { id: 'overflow', label: '🔴 น้ำล้นตลิ่ง (>100%)' },
                  { id: 'watch', label: '🟠 น้ำมากเฝ้าระวัง (80-100%)' },
                  { id: 'normal', label: '🟢 ระดับน้ำปกติ (<80%)' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWaterStatusFilter(tab.id as typeof waterStatusFilter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors whitespace-nowrap ${
                      waterStatusFilter === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableFilterQuery}
                  onChange={(e) => setTableFilterQuery(e.target.value)}
                  placeholder="ค้นหาจังหวัด อำเภอ ลุ่มน้ำ หรือชื่อสถานี..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600"
                />
                {tableFilterQuery && (
                  <button
                    type="button"
                    onClick={() => setTableFilterQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[460px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-black">สถานี / ลุ่มน้ำ</th>
                    <th className="py-2.5 px-3 font-black">ตำบล / อำเภอ / จังหวัด</th>
                    <th className="py-2.5 px-3 font-black">สถานะน้ำ</th>
                    <th className="py-2.5 px-3 font-black text-right">ความจุตลิ่ง (%)</th>
                    <th className="py-2.5 px-3 font-black text-right">ระดับน้ำ (ม.รทก.)</th>
                    <th className="py-2.5 px-3 font-black text-right">เทียบตลิ่ง (ม.)</th>
                    <th className="py-2.5 px-3 font-black text-right">การดำเนินการ (ในเว็บ / เว็บนอก)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredWaterStations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-bold">
                        ไม่พบสถานีวัดระดับน้ำตามเงื่อนไขที่กรอง
                      </td>
                    </tr>
                  ) : (
                    filteredWaterStations.map(({ station: ws, location: loc }) => {
                      const pct = ws.storagePercent ?? 0;
                      const isOverflow = ws.situationLevel === 5 || pct > 100;
                      const isWatch = ws.situationLevel === 4 || (pct >= 80 && pct <= 100);
                      return (
                        <tr key={`wt-${ws.id}`} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div>สถานี{ws.name}</div>
                            <div className="text-[11px] text-slate-500 font-normal">
                              {ws.basin} · {ws.agencyShort}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-semibold">
                            ต.{ws.tambon || '-'} อ.{ws.amphoe} จ.{ws.province}
                          </td>
                          <td className="py-2.5 px-3 font-black">
                            <span
                              className={
                                isOverflow
                                  ? 'text-red-700'
                                  : isWatch
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                              }
                            >
                              {isOverflow ? '🔴 น้ำล้นตลิ่ง' : isWatch ? '🟠 น้ำมาก' : '🟢 ปกติ'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-black text-slate-900">
                            {ws.storagePercent !== null ? `${ws.storagePercent.toFixed(1)}%` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-700">
                            {ws.waterLevelMsl ?? '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-700">
                            {ws.diffBankText} {ws.diffBankM ?? '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectLocation(loc)}
                                className="px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-black cursor-pointer whitespace-nowrap"
                              >
                                ดูในเว็บนี้
                              </button>
                              <a
                                href={ws.googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <span>แผนที่นอก</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* แท็บที่ 4: ตารางสถานีวัดน้ำฝนสะสม 24 ชม. ทั่วประเทศในเว็บ */}
        {activeTab === 'rain_table' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ตารางสถานีวัดน้ำฝนอัตโนมัติทั่วประเทศ (ปริมาณฝนสะสม 24 ชั่วโมง จาก สสน.)
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  ตรวจสอบปริมาณน้ำฝนสะสมรายตำบล/อำเภอได้โดยตรงในหน้าเว็บ พร้อมปุ่มกดดูผลกระทบน้ำขังและการจราจรจุดนั้นทันที
                </p>
              </div>

              <a
                href="https://www.thaiwater.net/weather/rain"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black whitespace-nowrap self-start"
              >
                <span>เปิดเว็บน้ำฝน สสน. ต้นทาง</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'ทุกสถานี' },
                  { id: 'heavy', label: '🌧️ ฝนตกหนัก (ตั้งแต่ 35 มม.)' },
                  { id: 'moderate', label: '🌦️ มีฝนตกสะสม (> 0 มม.)' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRainLevelFilter(tab.id as typeof rainLevelFilter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors whitespace-nowrap ${
                      rainLevelFilter === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableFilterQuery}
                  onChange={(e) => setTableFilterQuery(e.target.value)}
                  placeholder="ค้นหาจังหวัด อำเภอ ตำบล หรือชื่อสถานี..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[460px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-black">สถานีวัดน้ำฝน</th>
                    <th className="py-2.5 px-3 font-black">ตำบล / อำเภอ / จังหวัด</th>
                    <th className="py-2.5 px-3 font-black text-right">ฝนสะสม 24 ชม. (มม.)</th>
                    <th className="py-2.5 px-3 font-black">ระดับความรุนแรง</th>
                    <th className="py-2.5 px-3 font-black">เวลาตรวจวัด</th>
                    <th className="py-2.5 px-3 font-black text-right">การดำเนินการ (ในเว็บ / เว็บนอก)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRainStations.map(({ station: rs, location: loc }) => (
                    <tr key={`rt-${rs.id}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        สถานี{rs.name}{' '}
                        <span className="text-[11px] text-slate-500 font-normal">
                          ({rs.agencyShort})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-semibold">
                        ต.{rs.tambon || '-'} อ.{rs.amphoe} จ.{rs.province}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-black text-sky-900">
                        {rs.rain24hMm.toFixed(1)} มม.
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {rs.rain24hMm >= 90
                          ? '🔴 ฝนตกหนักมาก'
                          : rs.rain24hMm >= 35
                            ? '🟠 ฝนตกหนัก'
                            : rs.rain24hMm > 0
                              ? '🔵 มีฝนตก'
                              : '🟢 ไม่มีฝน'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                        {rs.observedAt}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectLocation(loc)}
                            className="px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-black cursor-pointer whitespace-nowrap"
                          >
                            ดูในเว็บนี้
                          </button>
                          <a
                            href={rs.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>แผนที่นอก</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* แท็บที่ 5: ตารางน้ำท่วมถนนสายหลัก กทม./ปริมณฑล/ทางหลวง และสีจราจรในเว็บ */}
        {activeTab === 'road_flood_matrix' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ตารางสถานะน้ำท่วมขังและสัญลักษณ์สีจราจร (เขียว-เหลือง-แดง) บนถนนสายหลักและทางหลวง
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  รวมข้อมูลจุดเสี่ยงน้ำท่วมขังถนน กทม. ปริมณฑล และทางหลวงแผ่นดิน ดูครบในหน้าเว็บพร้อมปุ่มเปิดเว็บสำนักการระบายน้ำ กทม. และกรมทางหลวง
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://dds.bangkok.go.th/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-black whitespace-nowrap"
                >
                  <span>เปิดเว็บสำนักการระบายน้ำ กทม.</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="https://www.doh.go.th/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold whitespace-nowrap"
                >
                  <span>เปิดเว็บกรมทางหลวง (DOH)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'ทุกสีจราจร' },
                  { id: 'red', label: '🔴 สีแดง (รถติดขัด)' },
                  { id: 'yellow', label: '🟡 สีเหลือง (ชะลอตัว)' },
                  { id: 'green', label: '🟢 สีเขียว (คล่องตัว)' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTrafficColorFilter(tab.id as typeof trafficColorFilter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors whitespace-nowrap ${
                      trafficColorFilter === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableFilterQuery}
                  onChange={(e) => setTableFilterQuery(e.target.value)}
                  placeholder="ค้นหาชื่อถนน แยก หรือสถานที่สำคัญ..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[460px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-black">ช่วงถนน / สถานที่สำคัญ</th>
                    <th className="py-2.5 px-3 font-black">สัญลักษณ์สีจราจร</th>
                    <th className="py-2.5 px-3 font-black">ความเร็วเคลื่อนตัว</th>
                    <th className="py-2.5 px-3 font-black">สถานะน้ำท่วมขังบนถนน</th>
                    <th className="py-2.5 px-3 font-black text-right">การดำเนินการ (ในเว็บ / เว็บนอก)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRoadStatuses.map((st) => {
                    const tc = st.trafficStatus.colorCode;
                    return (
                      <tr key={`rm-${st.location.id}`} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <div>{st.location.name}</div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            {st.location.tambon} · {st.location.amphoe} · จ.{st.location.province}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-black">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={`w-3 h-3 rounded-full inline-block ${TRAFFIC_DOT_CLASSES[tc]}`}
                            />
                            <span>{st.trafficStatus.colorNameTh}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-700">
                          {st.trafficStatus.estimatedSpeedText}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {st.waterHeadline}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectLocation(st.location)}
                              className="px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-black cursor-pointer whitespace-nowrap"
                            >
                              ดูในเว็บนี้
                            </button>
                            <a
                              href={st.trafficStatus.googleTrafficLayerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold inline-flex items-center gap-1 whitespace-nowrap"
                            >
                              <span>จราจรนอก</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* แท็บที่ 6: ตัวตรวจสอบข้อมูลดิบ API และลิงก์หน่วยงานรัฐทั้งหมดในหน้าเว็บ */}
        {activeTab === 'raw_api_inspector' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ข้อมูลดิบจากระบบโทรมาตรและ API ทางการของพื้นที่ “{activeStatus.location.name}”
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  ตรวจสอบค่าตัวเลขดิบทุกตัวได้โดยตรงบนหน้าเว็บนี้ พร้อมลิงก์กดเปิดดูเว็บต้นทางของหน่วยงานรัฐได้ทุกจุด
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ข้อมูลดิบชุดที่ 1: JSON สรุปสถานะสดในเว็บ */}
              <div className="rounded-xl bg-slate-900 text-slate-100 p-4 space-y-2 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-sky-400">
                    ข้อมูลสดที่ประมวลผลในเว็บ (Live Telemetry Payload)
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    อัปเดต {activeStatus.updatedAt} น.
                  </span>
                </div>
                <pre className="text-[11px] font-mono tabular-nums text-emerald-300 bg-slate-950/90 p-3 rounded-lg overflow-x-auto max-h-80 leading-relaxed">
                  {JSON.stringify(
                    {
                      location: {
                        name: activeStatus.location.name,
                        tambon: activeStatus.location.tambon,
                        amphoe: activeStatus.location.amphoe,
                        province: activeStatus.location.province,
                        coordinates: {
                          lat: activeStatus.location.lat,
                          lng: activeStatus.location.lng
                        }
                      },
                      trafficSignal: {
                        colorCode: activeStatus.trafficStatus.colorCode,
                        colorNameTh: activeStatus.trafficStatus.colorNameTh,
                        headline: activeStatus.trafficStatus.headline,
                        estimatedSpeed: activeStatus.trafficStatus.estimatedSpeedText,
                        delayEstimate: activeStatus.trafficStatus.delayEstimateText
                      },
                      waterAndFlood: {
                        safetyTier: activeStatus.waterSafetyTier,
                        headline: activeStatus.waterHeadline,
                        nearestWaterStation: activeStatus.primaryWaterStation
                          ? {
                              name: activeStatus.primaryWaterStation.name,
                              basin: activeStatus.primaryWaterStation.basin,
                              storagePercent: activeStatus.primaryWaterStation.storagePercent,
                              waterLevelMsl: activeStatus.primaryWaterStation.waterLevelMsl,
                              diffBankM: activeStatus.primaryWaterStation.diffBankM,
                              observedAt: activeStatus.primaryWaterStation.observedAt
                            }
                          : null,
                        nearestRainStation: activeStatus.primaryRainStation
                          ? {
                              name: activeStatus.primaryRainStation.name,
                              rain24hMm: activeStatus.primaryRainStation.rain24hMm,
                              observedAt: activeStatus.primaryRainStation.observedAt
                            }
                          : null
                      },
                      weather: {
                        tempC: activeStatus.tempC,
                        feelsLikeC: activeStatus.feelsLikeC,
                        rainProbabilityPercent: activeStatus.rainProbabilityPercent,
                        rainMmPerHour: activeStatus.rainMmPerHour,
                        humidityPercent: activeStatus.humidityPercent,
                        windKmh: activeStatus.windKmh
                      }
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              {/* ข้อมูลชุดที่ 2: ลิงก์เปิดดูเว็บไซต์ต้นทางเพื่อเช็คเทียบเคียง (External Verification Links) */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-700">
                  กดไปดูเว็บต้นทางของหน่วยงานรัฐและแผนที่โลกเพื่อเช็คข้อมูลเทียบเคียงได้ทุกเมื่อ:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <a
                    href={activeStatus.verificationLinks.thaiWaterLevelWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 p-3 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        1. เว็บระดับน้ำ สสน. (ThaiWater)
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        คลังข้อมูลน้ำแห่งชาติ
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-sky-700 shrink-0" />
                  </a>

                  <a
                    href={activeStatus.verificationLinks.thaiWaterRainWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 p-3 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        2. เว็บน้ำฝนสะสม สสน.
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        สถานีวัดน้ำฝน 24 ชม. ทั่วไทย
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-sky-700 shrink-0" />
                  </a>

                  <a
                    href={activeStatus.verificationLinks.googleMapsTrafficUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 p-3 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        3. Google Maps Traffic
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        เส้นสีจราจรสดบน Google Maps
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-emerald-700 shrink-0" />
                  </a>

                  <a
                    href={activeStatus.verificationLinks.windyRadarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 p-3 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        4. เรดาร์เมฆฝนสด Windy.com
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        เปิดดูเรดาร์บนเว็บ Windy
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-sky-700 shrink-0" />
                  </a>

                  <a
                    href={activeStatus.verificationLinks.bmaFloodWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 p-3 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        5. สำนักการระบายน้ำ กทม. (DDS)
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        ตรวจวัดน้ำท่วมถนนกรุงเทพฯ
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-amber-700 shrink-0" />
                  </a>

                  <a
                    href={activeStatus.verificationLinks.dohFloodWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 p-3 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        6. กรมทางหลวง (DOH)
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        รายงานน้ำท่วมทางหลวงแผ่นดิน
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-amber-700 shrink-0" />
                  </a>

                  <a
                    href={activeStatus.verificationLinks.thaiWaterLevelApiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 p-3 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        7. API ระดับน้ำ สสน. (JSON)
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        เปิดไฟล์ข้อมูลดิบต้นทาง
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-600 shrink-0" />
                  </a>

                  <a
                    href={activeStatus.verificationLinks.openMeteoApiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 p-3 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        8. API สภาพอากาศ (Open-Meteo)
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        เปิดไฟล์ JSON พิกัดนี้
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-600 shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
