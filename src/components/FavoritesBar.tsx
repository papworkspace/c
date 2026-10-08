import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Car,
  Check,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Plus,
  Radio,
  Sparkles,
  Star,
  Trash2,
  X
} from 'lucide-react';
import { ThaiLocation } from '../data/thaiLocations';
import {
  addLocationToFavorites,
  FavoriteIconType,
  FavoriteItem,
  getFavoriteLocations,
  isLocationFavorited,
  isLocationMatching,
  removeLocationFromFavorites,
  subscribeFavorites,
  updateFavoriteDetails
} from '../services/favoritesService';
import {
  getInstantRouteStatuses,
  LocationRealtimeStatus,
  subscribeRealtimeBackgroundUpdates
} from '../services/weatherWaterService';

interface FavoritesBarProps {
  currentLocation: ThaiLocation;
  onSelectFavorite: (location: ThaiLocation) => void;
  className?: string;
  variant?: 'compact' | 'full';
  showAddCurrentButton?: boolean;
}

export const FavoritesBar: React.FC<FavoritesBarProps> = ({
  currentLocation,
  onSelectFavorite,
  className = '',
  variant = 'full',
  showAddCurrentButton = true
}) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => getFavoriteLocations());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add_current' | 'edit'>('add_current');
  const [editingFavId, setEditingFavId] = useState<string | null>(null);

  // ข้อมูลในฟอร์มของโมดอล
  const [formLocation, setFormLocation] = useState<ThaiLocation>(currentLocation);
  const [formLabel, setFormLabel] = useState<string>('');
  const [formIcon, setFormIcon] = useState<FavoriteIconType>('star');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ติดตามการอัปเดตข้อมูลสถานที่โปรดและการอัปเดตสถานะอากาศ
  const [statusTick, setStatusTick] = useState(0);

  useEffect(() => {
    const unsubFav = subscribeFavorites((favs) => {
      setFavorites(favs);
    });
    const unsubWeather = subscribeRealtimeBackgroundUpdates(() => {
      setStatusTick((t) => t + 1);
    });
    return () => {
      unsubFav();
      unsubWeather();
    };
  }, []);

  // คำนวณสถานะสภาพอากาศและน้ำท่วมแบบสดๆ ของแต่ละสถานที่โปรด
  const favoriteStatuses = useMemo(() => {
    const map = new Map<string, LocationRealtimeStatus>();
    favorites.forEach((fav) => {
      try {
        const res = getInstantRouteStatuses([fav.location]);
        if (res && res[0]) {
          map.set(fav.id, res[0]);
        }
      } catch {
        // ignore
      }
    });
    return map;
  }, [favorites, statusTick]);

  const isCurrentLocationSaved = useMemo(() => {
    return isLocationFavorited(currentLocation, favorites);
  }, [currentLocation, favorites]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleOpenAddCurrentModal = () => {
    setModalMode('add_current');
    setFormLocation(currentLocation);
    // ตั้งชื่อแนะนำเบื้องต้น
    const initialLabel = currentLocation.roadName
      ? currentLocation.roadName
      : `${currentLocation.tambon} (${currentLocation.amphoe})`;
    setFormLabel(initialLabel);
    setFormIcon('star');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (fav: FavoriteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditingFavId(fav.id);
    setFormLocation(fav.location);
    setFormLabel(fav.customLabel || fav.name);
    setFormIcon(fav.iconType);
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === 'add_current') {
      addLocationToFavorites(formLocation, formLabel, formIcon);
      showToast(`บันทึก “${formLabel.trim() || formLocation.name}” ลงสถานที่โปรดแล้ว ⭐`);
    } else if (editingFavId) {
      updateFavoriteDetails(editingFavId, formLabel, formIcon);
      showToast(`อัปเดตข้อมูลสถานที่โปรดเรียบร้อย`);
    }
    setIsModalOpen(false);
  };

  const handleQuickToggleCurrent = () => {
    if (isCurrentLocationSaved) {
      removeLocationFromFavorites(currentLocation);
      showToast(`ลบ “${currentLocation.name}” ออกจากสถานที่โปรดแล้ว`);
    } else {
      handleOpenAddCurrentModal();
    }
  };

  const handleDeleteFavorite = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeLocationFromFavorites(id);
    showToast(`ลบ “${name}” ออกจากสถานที่โปรดแล้ว`);
  };

  const renderIcon = (type: FavoriteIconType, className = 'w-4 h-4') => {
    switch (type) {
      case 'home':
        return <Home className={className} />;
      case 'work':
        return <Building2 className={className} />;
      case 'school':
        return <GraduationCap className={className} />;
      case 'road':
        return <Car className={className} />;
      case 'star':
      default:
        return <Star className={className} />;
    }
  };

  const LABEL_PRESETS: Array<{ label: string; icon: FavoriteIconType }> = [
    { label: 'บ้าน', icon: 'home' },
    { label: 'ที่ทำงาน', icon: 'work' },
    { label: 'โรงเรียน / มหาวิทยาลัย', icon: 'school' },
    { label: 'ถนนเส้นประจำ', icon: 'road' },
    { label: 'คอนโด', icon: 'home' },
    { label: 'จุดหมายสำคัญ', icon: 'star' }
  ];

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Toast แจ้งเตือนความสำเร็จ */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl border border-slate-700 text-xs sm:text-sm font-black flex items-center gap-2 animate-bounce">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* แถบหัวเรื่อง: หัวข้อ + ปุ่มบันทึกจุดปัจจุบัน */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-2xs">
            ⭐
          </span>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span>สถานที่โปรดของคุณ (บันทึกไว้เช็คด่วน)</span>
              <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                ({favorites.length} จุด)
              </span>
            </h3>
            <p className="text-[11px] font-semibold text-slate-500">
              แตะเพื่อเรียกดูสภาพฝน น้ำท่วม และจราจรได้ทันทีในคลิกเดียวโดยไม่ต้องค้นหาใหม่
            </p>
          </div>
        </div>

        {showAddCurrentButton && (
          <button
            type="button"
            onClick={handleQuickToggleCurrent}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs ${
              isCurrentLocationSaved
                ? 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200'
                : 'bg-white hover:bg-amber-50 text-slate-800 hover:text-amber-900 border border-slate-300 hover:border-amber-400'
            }`}
            title={
              isCurrentLocationSaved
                ? 'จุดนี้อยู่ในสถานที่โปรดแล้ว (แตะเพื่อลบ)'
                : 'บันทึกจุดที่เลือกอยู่นี้ลงในสถานที่โปรด'
            }
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isCurrentLocationSaved
                  ? 'text-amber-500 fill-amber-500'
                  : 'text-slate-400'
              }`}
            />
            <span>
              {isCurrentLocationSaved
                ? 'บันทึกจุดนี้แล้ว (แตะเพื่อลบ)'
                : '+ บันทึกจุดปัจจุบันลงรายการโปรด'}
            </span>
          </button>
        )}
      </div>

      {/* รายการการ์ดสถานที่โปรด */}
      {favorites.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 p-4 text-center space-y-2">
          <p className="text-xs font-bold text-slate-500">
            ยังไม่มีสถานที่โปรด — แตะปุ่ม “+ บันทึกจุดปัจจุบันลงรายการโปรด” เพื่อบันทึกบ้านหรือที่ทำงานไว้เช็คด่วนได้เลย
          </p>
          <button
            type="button"
            onClick={handleOpenAddCurrentModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black cursor-pointer shadow-2xs"
          >
            <Star className="w-3.5 h-3.5 fill-slate-950" />
            <span>บันทึก “{currentLocation.name}” เลย</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {favorites.map((fav) => {
            const isSelected = isLocationMatching(fav.location, currentLocation);
            const status = favoriteStatuses.get(fav.id);

            // คำนวณสรุปอากาศย่อ
            const rainProb = status?.rainProbabilityPercent ?? 0;
            const isRainHigh = rainProb >= 60;
            const waterTier = status?.waterSafetyTier ?? 'normal';
            const isWaterWarn = waterTier === 'critical' || waterTier === 'danger';
            const trafficColor = status?.trafficStatus?.colorCode ?? 'green';

            return (
              <div
                key={fav.id}
                onClick={() => onSelectFavorite(fav.location)}
                className={`group relative rounded-2xl p-3 border-2 transition-all cursor-pointer text-left flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                    : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-amber-300 shadow-2xs'
                }`}
              >
                {/* ส่วนบน: ไอคอน + ชื่อที่ตั้ง + ปุ่มแก้ไข/ลบ */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 shadow-2xs'
                          : 'bg-slate-100 text-slate-700 group-hover:bg-amber-100 group-hover:text-amber-900'
                      }`}
                    >
                      {renderIcon(fav.iconType, 'w-3.5 h-3.5')}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs sm:text-sm font-black text-slate-950 truncate">
                          {fav.customLabel || fav.name}
                        </h4>
                        {isSelected && (
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-200 text-amber-950 shrink-0">
                            ดูอยู่ตอนนี้
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 truncate">
                        {fav.location.roadName
                          ? `${fav.location.roadName} (${fav.location.tambon})`
                          : `${fav.location.tambon} ${fav.location.amphoe} จ.${fav.location.province}`}
                      </p>
                    </div>
                  </div>

                  {/* ปุ่มจัดการ */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(fav, e)}
                      title="แก้ไขชื่อป้าย"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFavorite(fav.id, fav.customLabel || fav.name, e)}
                      title="ลบออกจากรายการโปรด"
                      className="p-1 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ส่วนล่าง: ป้ายสถานะเรียลไทม์สดๆ (ฝน • น้ำ • จราจร) */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[11px] font-black">
                  <div className="flex items-center gap-1.5">
                    {/* ชิปฝน */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
                        isRainHigh
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span>🌧️</span>
                      <span>{rainProb}%</span>
                    </span>

                    {/* ชิปน้ำท่วม */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
                        isWaterWarn
                          ? 'bg-red-100 text-red-900 border border-red-200'
                          : waterTier === 'watch'
                            ? 'bg-amber-100 text-amber-950 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-950 border border-emerald-200'
                      }`}
                    >
                      <span>🌊</span>
                      <span>
                        {waterTier === 'critical'
                          ? 'น้ำล้นตลิ่ง'
                          : waterTier === 'danger'
                            ? 'น้ำท่วมขัง'
                            : waterTier === 'watch'
                              ? 'ระวังน้ำขัง'
                              : 'ถนนแห้ง'}
                      </span>
                    </span>

                    {/* ชิปจราจร */}
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
                        trafficColor === 'red'
                          ? 'bg-red-100 text-red-900'
                          : trafficColor === 'yellow'
                            ? 'bg-amber-100 text-amber-950'
                            : 'bg-emerald-100 text-emerald-950'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          trafficColor === 'red'
                            ? 'bg-red-600'
                            : trafficColor === 'yellow'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                      />
                      <span>
                        {trafficColor === 'red'
                          ? 'ติดขัด'
                          : trafficColor === 'yellow'
                            ? 'ชะลอตัว'
                            : 'คล่องตัว'}
                      </span>
                    </span>
                  </div>

                  <span className="text-[10px] font-black text-sky-700 group-hover:underline">
                    แตะดูสด →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* โมดอลบันทึก / แก้ไขสถานที่โปรด */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm">
                  ⭐
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {modalMode === 'add_current'
                    ? 'บันทึกเป็นสถานที่โปรด'
                    : 'แก้ไขข้อมูลสถานที่โปรด'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* ข้อมูลสถานที่เป้าหมาย */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-1">
                <span className="text-[11px] font-black text-slate-500 uppercase">
                  พิกัดสถานที่
                </span>
                <p className="text-sm font-black text-slate-900">
                  {formLocation.name}
                </p>
                <p className="text-xs font-semibold text-slate-600">
                  {formLocation.tambon} • {formLocation.amphoe} • จ.{formLocation.province}
                </p>
              </div>

              {/* ป้ายชื่อที่ตั้งเอง */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  ชื่อเรียกสถานที่ (เช่น บ้าน, ที่ทำงาน, คอนโด, ถนนประจำ)
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="เช่น บ้าน, ที่ทำงานคุณแม่, โรงเรียนลูก"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-300 focus:border-amber-500 text-sm font-extrabold text-slate-900 focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>

              {/* ปุ่มลัดเลือกป้ายชื่อสำเร็จรูป */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-black text-slate-600">
                  หรือแตะเลือกป้ายลัด:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {LABEL_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setFormLabel(preset.label);
                        setFormIcon(preset.icon);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-950 border border-slate-200 text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* เลือกไอคอน */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  สัญลักษณ์ไอคอน
                </label>
                <div className="flex items-center gap-2">
                  {(
                    [
                      { type: 'home', label: 'บ้าน' },
                      { type: 'work', label: 'ที่ทำงาน' },
                      { type: 'school', label: 'โรงเรียน' },
                      { type: 'road', label: 'ถนน' },
                      { type: 'star', label: 'ดาว' }
                    ] as const
                  ).map((ic) => (
                    <button
                      key={ic.type}
                      type="button"
                      onClick={() => setFormIcon(ic.type)}
                      className={`flex-1 py-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        formIcon === ic.type
                          ? 'bg-amber-50 border-amber-500 text-amber-950 font-black'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {renderIcon(ic.type, 'w-4 h-4')}
                      <span className="text-[10px]">{ic.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-black cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกสถานที่โปรด</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
