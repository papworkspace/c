import React from 'react';
import { WaterSafetyTier, WeatherKind } from '../services/weatherWaterService';

export const WeatherIllustration: React.FC<{
  kind: WeatherKind;
  size?: 'sm' | 'md' | 'lg';
}> = ({ kind, size = 'lg' }) => {
  const dim = size === 'lg' ? 76 : size === 'md' ? 52 : 34;

  switch (kind) {
    case 'sunny':
      return (
        <svg width={dim} height={dim} viewBox="0 0 80 80" fill="none" aria-hidden="true" className="shrink-0">
          <circle cx="40" cy="40" r="20" fill="#F59E0B" />
          <circle cx="40" cy="40" r="15" fill="#FBBF24" />
          <g stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round">
            <line x1="40" y1="8" x2="40" y2="14" />
            <line x1="40" y1="66" x2="40" y2="72" />
            <line x1="8" y1="40" x2="14" y2="40" />
            <line x1="66" y1="40" x2="72" y2="40" />
            <line x1="17.4" y1="17.4" x2="21.6" y2="21.6" />
            <line x1="58.4" y1="58.4" x2="62.6" y2="62.6" />
            <line x1="62.6" y1="17.4" x2="58.4" y2="21.6" />
            <line x1="21.6" y1="58.4" x2="17.4" y2="62.6" />
          </g>
        </svg>
      );

    case 'partly_cloudy':
      return (
        <svg width={dim} height={dim} viewBox="0 0 80 80" fill="none" aria-hidden="true" className="shrink-0">
          <circle cx="30" cy="30" r="14" fill="#FBBF24" />
          <g stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round">
            <line x1="30" y1="9" x2="30" y2="13" />
            <line x1="9" y1="30" x2="13" y2="30" />
            <line x1="15" y1="15" x2="18" y2="18" />
            <line x1="45" y1="15" x2="42" y2="18" />
          </g>
          <path
            d="M26 58H58C64.627 58 70 52.627 70 46C70 39.76 65.235 34.632 59.146 34.054C56.87 26.526 49.878 21 41.6 21C31.438 21 23.2 29.238 23.2 39.4C23.2 40.08 23.24 40.75 23.31 41.41C18.61 42.6 15 46.85 15 52C15 58.075 19.925 58 26 58Z"
            fill="#E2E8F0"
            stroke="#94A3B8"
            strokeWidth="2"
          />
        </svg>
      );

    case 'cloudy':
      return (
        <svg width={dim} height={dim} viewBox="0 0 80 80" fill="none" aria-hidden="true" className="shrink-0">
          <path
            d="M28 50H62C67.523 50 72 45.523 72 40C72 34.68 67.84 30.33 62.6 30.02C60.52 23.62 54.51 19 47.4 19C38.56 19 31.4 26.16 31.4 35C31.4 35.6 31.43 36.19 31.5 36.77C27.28 37.78 24 41.55 24 46C24 50.4 25.5 50 28 50Z"
            fill="#CBD5E1"
          />
          <path
            d="M20 60H56C62.627 60 68 54.627 68 48C68 41.76 63.235 36.632 57.146 36.054C54.87 28.526 47.878 23 39.6 23C29.438 23 21.2 31.238 21.2 41.4C21.2 42.08 21.24 42.75 21.31 43.41C16.61 44.6 13 48.85 13 54C13 59.5 16.5 60 20 60Z"
            fill="#F1F5F9"
            stroke="#64748B"
            strokeWidth="2.2"
          />
        </svg>
      );

    case 'fog':
      return (
        <svg width={dim} height={dim} viewBox="0 0 80 80" fill="none" aria-hidden="true" className="shrink-0">
          <path
            d="M22 44H58C63.5 44 68 39.5 68 34C68 28.8 64 24.5 58.9 24.1C56.8 17.8 50.9 13.2 44 13.2C35.3 13.2 28.2 20.3 28.2 29C28.2 29.6 28.2 30.1 28.3 30.7C24.2 31.7 21 35.4 21 39.8C21 43.5 21.5 44 22 44Z"
            fill="#CBD5E1"
          />
          <g stroke="#64748B" strokeWidth="4" strokeLinecap="round">
            <line x1="16" y1="53" x2="64" y2="53" />
            <line x1="22" y1="62" x2="58" y2="62" />
            <line x1="14" y1="71" x2="50" y2="71" />
          </g>
        </svg>
      );

    case 'drizzle':
      return (
        <svg width={dim} height={dim} viewBox="0 0 80 80" fill="none" aria-hidden="true" className="shrink-0">
          <circle cx="26" cy="24" r="11" fill="#FBBF24" />
          <path
            d="M22 50H58C64 50 69 45 69 39C69 33.3 64.6 28.6 59 28.1C56.8 21.2 50.4 16.2 42.8 16.2C33.5 16.2 26 23.7 26 33C26 33.6 26 34.2 26.1 34.8C21.8 35.9 18.5 39.8 18.5 44.5C18.5 49.5 20 50 22 50Z"
            fill="#E2E8F0"
            stroke="#64748B"
            strokeWidth="2"
          />
          <g stroke="#0284C7" strokeWidth="3.5" strokeLinecap="round">
            <line x1="30" y1="57" x2="27" y2="66" />
            <line x1="43" y1="57" x2="40" y2="66" />
            <line x1="55" y1="57" x2="52" y2="66" />
          </g>
        </svg>
      );

    case 'light_rain':
      return (
        <svg width={dim} height={dim} viewBox="0 0 80 80" fill="none" aria-hidden="true" className="shrink-0">
          <path
            d="M20 48H58C64.2 48 69.2 43 69.2 36.8C69.2 30.9 64.6 26.1 58.9 25.6C56.7 18.5 50.1 13.4 42.3 13.4C32.7 13.4 25 21.1 25 30.7C25 31.3 25 32 25.1 32.6C20.6 33.7 17.3 37.7 17.3 42.6C17.3 47.6 18.5 48 20 48Z"
            fill="#94A3B8"
            stroke="#475569"
            strokeWidth="2"
          />
          <g stroke="#0284C7" strokeWidth="4" strokeLinecap="round">
            <line x1="26" y1="54" x2="21" y2="68" />
            <line x1="38" y1="54" x2="33" y2="70" />
            <line x1="50" y1="54" x2="45" y2="68" />
            <line x1="60" y1="54" x2="55" y2="66" />
          </g>
        </svg>
      );

    case 'heavy_rain':
      return (
        <svg width={dim} height={dim} viewBox="0 0 80 80" fill="none" aria-hidden="true" className="shrink-0">
          <path
            d="M19 46H59C65.2 46 70.2 41 70.2 34.8C70.2 28.9 65.6 24.1 59.9 23.6C57.7 16.5 51.1 11.4 43.3 11.4C33.7 11.4 26 19.1 26 28.7C26 29.3 26 30 26.1 30.6C21.6 31.7 18.3 35.7 18.3 40.6C18.3 45.6 18.5 46 19 46Z"
            fill="#475569"
            stroke="#1E293B"
            strokeWidth="2"
          />
          <g stroke="#1D4ED8" strokeWidth="4.2" strokeLinecap="round">
            <line x1="24" y1="51" x2="17" y2="72" />
            <line x1="34" y1="51" x2="27" y2="74" />
            <line x1="44" y1="51" x2="37" y2="72" />
            <line x1="54" y1="51" x2="47" y2="74" />
            <line x1="63" y1="51" x2="56" y2="70" />
          </g>
        </svg>
      );

    case 'storm':
      return (
        <svg width={dim} height={dim} viewBox="0 0 80 80" fill="none" aria-hidden="true" className="shrink-0">
          <path
            d="M19 45H59C65.2 45 70.2 40 70.2 33.8C70.2 27.9 65.6 23.1 59.9 22.6C57.7 15.5 51.1 10.4 43.3 10.4C33.7 10.4 26 18.1 26 27.7C26 28.3 26 29 26.1 29.6C21.6 30.7 18.3 34.7 18.3 39.6C18.3 44.6 18.5 45 19 45Z"
            fill="#334155"
            stroke="#0F172A"
            strokeWidth="2.2"
          />
          <polygon
            points="43,40 31,57 41,57 36,75 54,53 43,53"
            fill="#F59E0B"
            stroke="#FEF3C7"
            strokeWidth="1.5"
          />
          <g stroke="#2563EB" strokeWidth="3.5" strokeLinecap="round">
            <line x1="23" y1="50" x2="18" y2="66" />
            <line x1="61" y1="50" x2="56" y2="66" />
          </g>
        </svg>
      );
  }
};

// ภาพกราฟิกเทียบความสูงระดับน้ำกับตัวคน (ตาตุ่ม / เข่า / เอว) และล้อรถยนต์ ดูเข้าใจง่ายใน 1 วินาที
export const WaterLevelHumanGraphic: React.FC<{
  tier: WaterSafetyTier;
}> = ({ tier }) => {
  const waterHeightPx =
    tier === 'normal'
      ? 0
      : tier === 'watch'
        ? 20
        : tier === 'danger'
          ? 44
          : 70;

  const waterFill =
    tier === 'normal'
      ? '#10B981'
      : tier === 'watch'
        ? '#F59E0B'
        : tier === 'danger'
          ? '#EA580C'
          : '#DC2626';

  const bgSurface =
    tier === 'normal'
      ? '#F0FDF4'
      : tier === 'watch'
        ? '#FFFBEB'
        : tier === 'danger'
          ? '#FFF7ED'
          : '#FEF2F2';

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-200/80 p-3"
      style={{ backgroundColor: bgSurface }}
    >
      <div className="flex items-center justify-between gap-3">
        <svg
          width="152"
          height="88"
          viewBox="0 0 156 92"
          fill="none"
          aria-hidden="true"
          className="shrink-0 rounded-lg bg-white border border-slate-200/70"
        >
          <line x1="0" y1="22" x2="156" y2="22" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" />
          <text x="6" y="19" fill="#64748B" fontSize="9" fontWeight="600">ระดับเอว</text>

          <line x1="0" y1="48" x2="156" y2="48" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" />
          <text x="6" y="45" fill="#64748B" fontSize="9" fontWeight="600">ระดับเข่า</text>

          <line x1="0" y1="70" x2="156" y2="70" stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth="1" />
          <text x="6" y="67" fill="#64748B" fontSize="9" fontWeight="600">ระดับตาตุ่ม</text>

          <rect x="0" y="84" width="156" height="8" fill="#334155" />

          {/* คนยืนเทียบความสูงน้ำ */}
          <g transform="translate(88, 12)">
            <circle cx="14" cy="8" r="6.5" fill="#1E293B" />
            <rect x="9" y="16" width="10" height="24" rx="4" fill="#334155" />
            <rect x="9" y="38" width="4.2" height="34" rx="2" fill="#1E293B" />
            <rect x="14.8" y="38" width="4.2" height="34" rx="2" fill="#1E293B" />
          </g>

          {/* รถยนต์เทียบความสูงล้อ */}
          <g transform="translate(116, 48)">
            <path
              d="M4 18L9 7H25L30 18H34C35.5 18 36 19 36 21V28H2V21C2 19 2.5 18 4 18Z"
              fill="#475569"
            />
            <path d="M10 9.5H24L27.5 17H6.5L10 9.5Z" fill="#E2E8F0" />
            <circle cx="10" cy="29" r="6" fill="#0F172A" />
            <circle cx="10" cy="29" r="2.5" fill="#94A3B8" />
            <circle cx="28" cy="29" r="6" fill="#0F172A" />
            <circle cx="28" cy="29" r="2.5" fill="#94A3B8" />
          </g>

          {waterHeightPx > 0 && (
            <g>
              <rect
                x="0"
                y={84 - waterHeightPx}
                width="156"
                height={waterHeightPx}
                fill={waterFill}
                fillOpacity="0.38"
              />
              <line
                x1="0"
                y1={84 - waterHeightPx}
                x2="156"
                y2={84 - waterHeightPx}
                stroke={waterFill}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        <div className="flex-1 min-w-0">
          <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
            {tier === 'normal' && 'พื้นถนนแห้งปกติ'}
            {tier === 'watch' && 'น้ำขังระดับตาตุ่ม'}
            {tier === 'danger' && 'น้ำท่วมครึ่งแข้งถึงเข่า'}
            {tier === 'critical' && 'น้ำท่วมสูงถึงระดับเอว'}
          </div>
          <div className="text-xs sm:text-sm text-slate-700 mt-1 leading-relaxed">
            {tier === 'normal' && 'ล้อรถเกาะถนนดี ขับขี่ได้ตามสบาย'}
            {tier === 'watch' && 'น้ำแตะขอบยางล่าง ระวังถนนลื่น'}
            {tier === 'danger' && 'น้ำถึงท่อไอเสีย รถเก๋งและมอเตอร์ไซค์ควรเลี่ยง'}
            {tier === 'critical' && 'น้ำท่วมมิดล้อ ห้ามขับฝ่าเด็ดขาด'}
          </div>
        </div>
      </div>
    </div>
  );
};

export const WeatherSceneGraphic: React.FC<{
  kind: WeatherKind;
  isDay?: boolean;
}> = ({ kind }) => <WeatherIllustration kind={kind} size="lg" />;

export const WaterLevelGaugeGraphic: React.FC<{
  tier: WaterSafetyTier;
  waterLevelCm?: number;
}> = ({ tier }) => <WaterLevelHumanGraphic tier={tier} />;

