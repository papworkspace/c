import { ThaiLocation } from '../data/thaiLocations';

export type FavoriteIconType = 'home' | 'work' | 'school' | 'road' | 'star';

export interface FavoriteItem {
  id: string;
  name: string; // ชื่อสถานที่จริง เช่น "ต.คูคต อ.ลำลูกกา จ.ปทุมธานี" หรือ "ถนนสรงประภา"
  customLabel?: string; // ป้ายชื่อที่ตั้งเอง เช่น "บ้าน", "ที่ทำงาน", "คอนโด", "โรงเรียน"
  location: ThaiLocation;
  iconType: FavoriteIconType;
  createdAt: number;
}

const STORAGE_FAVORITES_KEY = 'thairoute_favorite_locations_v1';
const LISTENERS: Array<(favorites: FavoriteItem[]) => void> = [];

function notifyListeners(favorites: FavoriteItem[]) {
  LISTENERS.forEach((fn) => {
    try {
      fn(favorites);
    } catch {
      // ignore
    }
  });
}

// รายการเริ่มต้นตัวอย่างเพื่อให้ผู้ใช้เห็นประโยชน์ทันทีตั้งแต่เปิดแอปครั้งแรก
const DEFAULT_INITIAL_FAVORITES: FavoriteItem[] = [
  {
    id: 'fav-sample-home',
    name: 'ต.คูคต อ.ลำลูกกา จ.ปทุมธานี',
    customLabel: 'บ้าน (คูคต/ลำลูกกา)',
    iconType: 'home',
    location: {
      id: 'tambon-pathum-khukhot',
      name: 'ต.คูคต อ.ลำลูกกา จ.ปทุมธานี',
      province: 'ปทุมธานี',
      amphoe: 'อ.ลำลูกกา',
      tambon: 'ต.คูคต',
      region: 'central',
      lat: 13.9625,
      lng: 100.6382
    },
    createdAt: Date.now() - 3600000
  },
  {
    id: 'fav-sample-work',
    name: 'แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร',
    customLabel: 'ที่ทำงาน (จตุจักร)',
    iconType: 'work',
    location: {
      id: 'tambon-bkk-chatuchak',
      name: 'แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร',
      province: 'กรุงเทพมหานคร',
      amphoe: 'เขตจตุจักร',
      tambon: 'แขวงจตุจักร',
      region: 'central',
      lat: 13.8282,
      lng: 100.5601
    },
    createdAt: Date.now() - 7200000
  },
  {
    id: 'fav-sample-road',
    name: 'ถนนวิภาวดีรังสิต (แยกสุทธิสาร - ห้าแยกลาดพร้าว)',
    customLabel: 'เส้นทางประจำ (ถ.วิภาวดี)',
    iconType: 'road',
    location: {
      id: 'road-viphawadi-ladprao',
      name: 'ถนนวิภาวดีรังสิต (แยกสุทธิสาร - ห้าแยกลาดพร้าว)',
      roadName: 'ถนนวิภาวดีรังสิต',
      province: 'กรุงเทพมหานคร',
      amphoe: 'เขตจตุจักร',
      tambon: 'แขวงจอมพล',
      region: 'central',
      lat: 13.805,
      lng: 100.5615,
      trafficHotspotNote: 'จุดชะลอตัวช่วงแยกสุทธิสาร มุ่งหน้าห้าแยกลาดพร้าว'
    },
    createdAt: Date.now() - 10800000
  }
];

export function getFavoriteLocations(): FavoriteItem[] {
  if (typeof window === 'undefined') return DEFAULT_INITIAL_FAVORITES;
  try {
    const raw = localStorage.getItem(STORAGE_FAVORITES_KEY);
    if (!raw) {
      // บันทึกค่าเริ่มต้นเพื่อให้มีข้อมูลตัวอย่างทันที
      localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(DEFAULT_INITIAL_FAVORITES));
      return DEFAULT_INITIAL_FAVORITES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_INITIAL_FAVORITES;
}

export function saveFavoriteLocationsToStorage(favorites: FavoriteItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(favorites));
    notifyListeners(favorites);
  } catch {
    // ignore
  }
}

export function isLocationMatching(a: ThaiLocation, b: ThaiLocation): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.roadName && b.roadName && a.roadName === b.roadName && a.name === b.name) return true;
  if (
    a.province === b.province &&
    a.amphoe === b.amphoe &&
    a.tambon === b.tambon &&
    Math.abs(a.lat - b.lat) < 0.005 &&
    Math.abs(a.lng - b.lng) < 0.005
  ) {
    return true;
  }
  return false;
}

export function findFavoriteForLocation(
  loc: ThaiLocation,
  currentFavorites?: FavoriteItem[]
): FavoriteItem | undefined {
  const list = currentFavorites || getFavoriteLocations();
  return list.find((item) => isLocationMatching(item.location, loc));
}

export function isLocationFavorited(
  loc: ThaiLocation,
  currentFavorites?: FavoriteItem[]
): boolean {
  return !!findFavoriteForLocation(loc, currentFavorites);
}

export function addLocationToFavorites(
  location: ThaiLocation,
  customLabel?: string,
  iconType: FavoriteIconType = 'star'
): FavoriteItem {
  const current = getFavoriteLocations();
  const existingIndex = current.findIndex((item) => isLocationMatching(item.location, location));

  const newItem: FavoriteItem = {
    id: existingIndex >= 0 ? current[existingIndex].id : `fav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: location.name,
    customLabel: customLabel?.trim() || location.name,
    location: { ...location },
    iconType,
    createdAt: existingIndex >= 0 ? current[existingIndex].createdAt : Date.now()
  };

  let updated: FavoriteItem[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = newItem;
  } else {
    // เพิ่มไว้บนสุดเพื่อให้เห็นทันที
    updated = [newItem, ...current];
  }

  saveFavoriteLocationsToStorage(updated);
  return newItem;
}

export function removeLocationFromFavorites(idOrLocation: string | ThaiLocation): void {
  const current = getFavoriteLocations();
  let updated: FavoriteItem[];

  if (typeof idOrLocation === 'string') {
    updated = current.filter((item) => item.id !== idOrLocation);
  } else {
    updated = current.filter((item) => !isLocationMatching(item.location, idOrLocation));
  }

  saveFavoriteLocationsToStorage(updated);
}

export function updateFavoriteDetails(
  id: string,
  customLabel: string,
  iconType: FavoriteIconType
): void {
  const current = getFavoriteLocations();
  const index = current.findIndex((item) => item.id === id);
  if (index === -1) return;

  const updated = [...current];
  updated[index] = {
    ...updated[index],
    customLabel: customLabel.trim() || updated[index].name,
    iconType
  };

  saveFavoriteLocationsToStorage(updated);
}

export function subscribeFavorites(callback: (favorites: FavoriteItem[]) => void): () => void {
  LISTENERS.push(callback);
  return () => {
    const idx = LISTENERS.indexOf(callback);
    if (idx !== -1) LISTENERS.splice(idx, 1);
  };
}
