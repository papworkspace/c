import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  CloudRain,
  Droplets,
  ExternalLink,
  MapPin,
  Radio,
  Search,
  ShieldAlert,
  Waves,
  X
} from 'lucide-react';
import { ThaiLocation } from '../data/thaiLocations';
import {
  getNationwideSituationReport,
  SituationQueryIntent,
  TrafficColorCode
} from '../services/weatherWaterService';
import { InAppFocusTarget, InAppViewerTab } from './InAppDataCenter';

interface NationwideSituationPanelProps {
  initialQuery?: string;
  initialIntent?: SituationQueryIntent;
  onSelectLocation: (loc: ThaiLocation) => void;
  onOpenInAppViewer?: (tab: InAppViewerTab, focus?: InAppFocusTarget) => void;
  onClose?: () => void;
}

const TRAFFIC_DOT_CLASSES: Record<TrafficColorCode, string> = {
  green: 'bg-emerald-500 ring-2 ring-emerald-200',
  yellow: 'bg-amber-400 ring-2 ring-amber-200',
  red: 'bg-red-600 ring-2 ring-red-200'
};

const TRAFFIC_BADGE_CLASSES: Record<TrafficColorCode, string> = {
  green: 'bg-emerald-50 border-emerald-300 text-emerald-950',
  yellow: 'bg-amber-50 border-amber-300 text-amber-950',
  red: 'bg-red-50 border-red-300 text-red-950'
};

export const NationwideSituationPanel: React.FC<NationwideSituationPanelProps> = ({
  initialQuery = '',
  initialIntent = 'flood_now',
  onSelectLocation,
  onOpenInAppViewer,
  onClose
}) => {
  const [activeIntent, setActiveIntent] = useState<SituationQueryIntent>(initialIntent);
  const [areaSearch, setAreaSearch] = useState<string>(() => {
    const cleaned = initialQuery
      .replace(
        /(ตอนนี้|เวลานี้|ล่าสุด|ที่ไหนบ้าง|ที่ไหน|บ้าง|จุด|พื้นที่|สถานการณ์|น้ำท่วมขัง|น้ำท่วม|น้ำล้นตลิ่ง|ฝนตกหนัก|ฝนตก|รถติดหนัก|รถติด|จราจรติดขัด|ถนนไหน|เช็ค|ดู|อยากรู้ว่า|อยากรู้|ไหม|ครับ|ค่ะ|\?)/g,
        ' '
      )
      .trim();
    return cleaned;
  });

  const report = useMemo(
    () => getNationwideSituationReport(areaSearch, activeIntent),
    [areaSearch, activeIntent]
  );

  return (
    <section className="rounded-3xl bg-white border-2 border-sky-500 shadow-lg overflow-hidden">
      {/* ส่วนหัวรายงานสถานการณ์สดทั่วไทย */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500 text-slate-950 text-xs font-black">
                <Radio className="w-3.5 h-3.5" />
                <span>รายงานสถานการณ์สดทั่วประเทศ (Real-Time)</span>
              </span>
              <span className="text-xs font-bold text-slate-300">
                อัปเดตล่าสุด {report.updatedAt} น.
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-snug">
              {report.queryTitle}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-300">
              {report.querySubtitle}
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black border border-slate-700 cursor-pointer shrink-0 self-start"
            >
              <X className="w-4 h-4" />
              <span>กลับหน้าการ์ดหลัก</span>
            </button>
          )}
        </div>

        {/* ปุ่มสลับหมวดหมู่คำถามยอดฮิต + ช่องกรองจังหวัด/พื้นที่ */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveIntent('flood_now')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeIntent === 'flood_now'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Waves className="w-4 h-4" />
              <span>
                1. ตอนนี้น้ำท่วม/น้ำล้นตลิ่งที่ไหนบ้าง ({report.overflowWaterStations.length + report.watchWaterStations.length} จุด)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveIntent('rain_now')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeIntent === 'rain_now'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <CloudRain className="w-4 h-4" />
              <span>
                2. ตอนนี้ฝนตกหนักที่ไหนบ้าง ({report.activeRainStations.length} จุด)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveIntent('traffic_now')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeIntent === 'traffic_now'
                  ? 'bg-sky-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>3. ตอนนี้ถนนสายไหนรถติดบ้าง (สีแดง-เหลือง-เขียว)</span>
            </button>
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              placeholder="กรองจังหวัด/อำเภอ/ถนน เช่น ปทุมธานี..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs sm:text-sm font-bold text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-400"
            />
            {areaSearch && (
              <button
                type="button"
                onClick={() => setAreaSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* สรุปตัวเลขภาพรวม */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 bg-slate-50 divide-x divide-y sm:divide-y-0 divide-slate-200">
        <div className="p-4">
          <span className="text-xs font-extrabold text-red-700 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
            สถานีน้ำล้นตลิ่งตอนนี้
          </span>
          <p className="text-2xl font-black text-red-950 mt-1">
            {report.overflowWaterStations.length}{' '}
            <span className="text-xs font-bold text-slate-600">สถานี</span>
          </p>
        </div>

        <div className="p-4">
          <span className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            สถานีเฝ้าระวังน้ำมาก (80-100%)
          </span>
          <p className="text-2xl font-black text-amber-950 mt-1">
            {report.watchWaterStations.length}{' '}
            <span className="text-xs font-bold text-slate-600">สถานี</span>
          </p>
        </div>

        <div className="p-4">
          <span className="text-xs font-extrabold text-sky-800 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
            จุดที่มีฝนตกสะสมใน 24 ชม.
          </span>
          <p className="text-2xl font-black text-sky-950 mt-1">
            {report.activeRainStations.length}{' '}
            <span className="text-xs font-bold text-slate-600">สถานี</span>
          </p>
        </div>

        <div className="p-4">
          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            สถานะสีจราจรบนถนนสายหลัก
          </span>
          <p className="text-sm font-black text-slate-900 mt-1.5 flex items-center gap-2">
            <span className="text-red-700">แดง {report.redTrafficRoads.length}</span>•
            <span className="text-amber-700">เหลือง {report.yellowTrafficRoads.length}</span>•
            <span className="text-emerald-700">เขียว {report.greenTrafficRoads.length}</span>
          </p>
        </div>
      </div>

      {/* เนื้อหาตามหมวดหมู่ที่เลือก */}
      <div className="p-5 sm:p-6 space-y-6">
        {activeIntent === 'flood_now' && (
          <>
            {/* 1. จุดน้ำล้นตลิ่งจริงจากคลังข้อมูลน้ำแห่งชาติ (สสน.) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    1. พื้นที่รายงาน “น้ำล้นตลิ่ง / น้ำท่วมริมลำน้ำ” ตอนนี้ (ข้อมูลจริงจาก สสน. ThaiWater)
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenInAppViewer && (
                    <button
                      type="button"
                      onClick={() => onOpenInAppViewer('water_table')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer"
                    >
                      <span>ดูตารางระดับน้ำครบทุกสถานีในเว็บนี้</span>
                    </button>
                  )}
                  <a
                    href="https://www.thaiwater.net/water/wl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-black text-sky-800 hover:underline"
                  >
                    <span>เปิดเว็บ สสน. ต้นทาง</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {report.overflowWaterStations.length === 0 ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 flex items-center gap-3 text-emerald-950">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm sm:text-base font-black">
                      ขณะนี้ไม่พบสถานีวัดน้ำล้นตลิ่งเกิน 100% ในเขตพื้นที่ที่กรอง
                    </p>
                    <p className="text-xs font-bold opacity-85">
                      ท่านสามารถดูจุดเฝ้าระวังน้ำมาก (80-100% ของความจุลำน้ำ) และจุดเสี่ยงน้ำขังบนถนนสายหลักด้านล่างได้ทันที
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.overflowWaterStations.map(({ station: ws, location: loc }) => (
                    <div
                      key={`overflow-${ws.id}`}
                      className="rounded-2xl bg-red-50/90 border-2 border-red-300 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-red-600 text-white text-xs font-black">
                            🔴 น้ำล้นตลิ่ง ({ws.storagePercent !== null ? `${ws.storagePercent.toFixed(1)}%` : 'เกินตลิ่ง'})
                          </span>
                          <span className="text-xs font-bold text-red-900">
                            จ.{ws.province} • อ.{ws.amphoe}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-slate-900">
                          สถานี{ws.name} ({ws.basin})
                        </h4>
                        <p className="text-xs font-bold text-slate-700">
                          ต.{ws.tambon || '-'} อ.{ws.amphoe} จ.{ws.province} • {ws.diffBankText}{' '}
                          <strong className="text-red-700">{ws.diffBankM ?? '-'} ม.</strong> • ระดับน้ำ{' '}
                          {ws.waterLevelMsl ?? '-'} ม.รทก.
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          หน่วยงาน: {ws.agency} • เวลาตรวจวัด: {ws.observedAt}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-red-200/80">
                        <button
                          type="button"
                          onClick={() => onSelectLocation(loc)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-black cursor-pointer transition-colors"
                        >
                          <span>ดูน้ำท่วม & สีจราจรจุดนี้</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={ws.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-700 hover:text-slate-950"
                        >
                          <MapPin className="w-3.5 h-3.5 text-red-600" />
                          <span>แผนที่พิกัดจริง</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. จุดเฝ้าระวังน้ำมาก (80% - 100% ของตลิ่ง) */}
            {report.watchWaterStations.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    2. พื้นที่ “น้ำมาก / เฝ้าระวังระดับน้ำใกล้ตลิ่ง (80% - 100%)” ({report.watchWaterStations.length} จุด)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {report.watchWaterStations.slice(0, 12).map(({ station: ws, location: loc }) => (
                    <div
                      key={`watch-${ws.id}`}
                      className="rounded-2xl bg-amber-50/80 border border-amber-300 p-3.5 flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[11px] font-black">
                            น้ำมาก {ws.storagePercent?.toFixed(1)}% ของตลิ่ง
                          </span>
                          <span className="text-[11px] font-bold text-amber-950">
                            จ.{ws.province}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900">
                          สถานี{ws.name} ({ws.basin})
                        </h4>
                        <p className="text-xs font-semibold text-slate-700">
                          ต.{ws.tambon || '-'} อ.{ws.amphoe} • {ws.diffBankText} {ws.diffBankM ?? '-'} ม.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectLocation(loc)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-black cursor-pointer transition-colors"
                      >
                        <span>เช็คถนนและการจราจรจุดนี้</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. สถานะน้ำท่วมขังและสัญลักษณ์สีจราจรบนถนนสายหลักสำคัญ */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  3. สถานะน้ำท่วมขังควบคู่ “สีจราจร (เขียว-เหลือง-แดง)” บนถนนสายหลักและจุดเสี่ยง
                </h3>
                <span className="text-xs font-bold text-slate-600">
                  กดเลือกถนนเพื่อเปิดดูรายละเอียดครบทุกช่วง
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.floodWatchRoads.slice(0, 12).map((st) => {
                  const tc = st.trafficStatus.colorCode;
                  return (
                    <div
                      key={`road-flood-${st.location.id}`}
                      className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between gap-3 hover:border-sky-400 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-black ${TRAFFIC_BADGE_CLASSES[tc]}`}
                          >
                            <span
                              className={`w-2.5 h-2.5 rounded-full inline-block ${TRAFFIC_DOT_CLASSES[tc]}`}
                            />
                            <span>จราจร: {st.trafficStatus.colorNameTh}</span>
                          </span>

                          <span
                            className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                              st.waterSafetyTier === 'critical'
                                ? 'bg-red-600 text-white'
                                : st.waterSafetyTier === 'danger'
                                  ? 'bg-orange-600 text-white'
                                  : st.waterSafetyTier === 'watch'
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {st.waterHeadline}
                          </span>
                        </div>

                        <h4 className="text-sm sm:text-base font-black text-slate-900">
                          {st.location.name}
                        </h4>
                        <p className="text-xs font-semibold text-slate-600">
                          {st.location.floodRiskNote || st.waterConditionReason}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                        <span className="text-xs font-bold text-slate-600">
                          {st.trafficStatus.estimatedSpeedText}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectLocation(st.location)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer"
                        >
                          <span>ดูการ์ดถนนนี้</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeIntent === 'rain_now' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-sky-600" />
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  พื้นที่ที่มีปริมาณฝนสะสมสูงสุดในรอบ 24 ชั่วโมง (ข้อมูลจริงจาก สสน. ThaiWater)
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenInAppViewer && (
                  <button
                    type="button"
                    onClick={() => onOpenInAppViewer('rain_table')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer"
                  >
                    <span>ดูตารางน้ำฝนครบทุกสถานีในเว็บนี้</span>
                  </button>
                )}
                <a
                  href="https://www.thaiwater.net/weather/rain"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-black text-sky-800 hover:underline"
                >
                  <span>เปิดเว็บน้ำฝน สสน. ต้นทาง</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {report.activeRainStations.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center">
                <p className="text-base font-black text-slate-800">
                  ไม่พบสถานีที่มีฝนตกสะสมในเขตพื้นที่ที่ระบุ
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.activeRainStations.map(({ station: rs, location: loc }) => (
                  <div
                    key={`rain-${rs.id}`}
                    className="rounded-2xl bg-sky-50/70 border border-sky-200 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                            rs.rain24hMm >= 90
                              ? 'bg-red-600 text-white'
                              : rs.rain24hMm >= 35
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-sky-600 text-white'
                          }`}
                        >
                          ฝนสะสม {rs.rain24hMm.toFixed(1)} มม.
                        </span>
                        <span className="text-xs font-bold text-sky-950">จ.{rs.province}</span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-slate-900">
                        สถานี{rs.name}
                      </h4>
                      <p className="text-xs font-semibold text-slate-700">
                        ต.{rs.tambon || '-'} อ.{rs.amphoe} จ.{rs.province}
                      </p>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        หน่วยงาน: {rs.agencyShort} • อัปเดต: {rs.observedAt}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectLocation(loc)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-black cursor-pointer transition-colors"
                    >
                      <span>เช็คน้ำท่วมและการจราจรจุดนี้</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeIntent === 'traffic_now' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-red-50 border-2 border-red-300 p-3.5 flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-red-600 shrink-0 shadow-xs" />
                <div>
                  <p className="text-xs font-black text-red-950">สีแดง (รถติดขัด)</p>
                  <p className="text-xs font-bold text-slate-700">
                    พบ {report.redTrafficRoads.length} ช่วงถนน • ควรเผื่อเวลาเดินทาง
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-3.5 flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-amber-400 shrink-0 shadow-xs" />
                <div>
                  <p className="text-xs font-black text-amber-950">สีเหลือง (ชะลอตัว)</p>
                  <p className="text-xs font-bold text-slate-700">
                    พบ {report.yellowTrafficRoads.length} ช่วงถนน • เคลื่อนตัวได้เรื่อยๆ
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-3.5 flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500 shrink-0 shadow-xs" />
                <div>
                  <p className="text-xs font-black text-emerald-950">สีเขียว (คล่องตัว)</p>
                  <p className="text-xs font-bold text-slate-700">
                    พบ {report.greenTrafficRoads.length} ช่วงถนน • รถวิ่งได้สะดวก
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ...report.redTrafficRoads,
                ...report.yellowTrafficRoads,
                ...report.greenTrafficRoads
              ].map((st) => {
                const tc = st.trafficStatus.colorCode;
                return (
                  <div
                    key={`traffic-road-${st.location.id}`}
                    className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-3 ${TRAFFIC_BADGE_CLASSES[tc]}`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-xs font-black">
                          <span
                            className={`w-3.5 h-3.5 rounded-full inline-block ${TRAFFIC_DOT_CLASSES[tc]}`}
                          />
                          <span>{st.trafficStatus.colorNameTh}</span>
                        </span>
                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-white/90 border border-slate-200 text-slate-800">
                          {st.waterHeadline}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-slate-900">{st.location.name}</h4>
                      <p className="text-xs font-bold text-slate-700">
                        {st.trafficStatus.headline} ({st.trafficStatus.estimatedSpeedText})
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-300/60">
                      <span className="text-xs font-extrabold text-slate-700">
                        {st.trafficStatus.delayEstimateText}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectLocation(st.location)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black cursor-pointer"
                      >
                        <span>ดูการ์ดจุดนี้</span>
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
    </section>
  );
};
