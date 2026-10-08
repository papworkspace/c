import {
  calculateDistanceKm,
  createLocationFromTambon,
  findNearestTambonByCoords,
  getFlatTambonIndex,
  THAI_PROVINCES_COORDS,
  ThaiLocation
} from '../data/thaiLocations';
import { getFavoriteLocations } from './favoritesService';
import {
  CURATED_ROAD_SEGMENTS,
  findNearbyRoadSegmentsByCoords
} from '../data/thaiRoadSegments';
import {
  fetchRouteStatuses,
  formatColloquialThaiHour,
  getCachedLocationStatus,
  getNationwideSituationReport,
  getSearchReferenceCoordinates,
  HourlyForecastPoint,
  LocationRealtimeStatus,
  normalizeSemanticSearchKey,
  RealRainStation,
  RealWaterStation,
  resolveQueryProximityAnchor,
  roadSegmentToLocation,
  searchLocalRoadsAndLocationsSync,
  searchRoadsAndLocations,
  setSearchReferenceCoordinates,
  TrafficColorCode,
  WaterSafetyTier
} from './weatherWaterService';

export interface AiRainPredictionItem {
  locationName: string;
  shortPlaceName: string;
  timeColloquial: string; // เช่น "บ่าย 2 โมง"
  timeClock: string; // เช่น "14:00 น."
  rainLabel: string; // เช่น "ฝนตกหนัก", "ฝนตกปานกลาง", "ไม่มีฝน ท้องฟ้าโปร่ง"
  probabilityPercent: number; // เช่น 80
  precipMm: number;
  tempC: number;
  highlightLine: string; // เช่น "ดอนเมือง บ่าย 2 โมง ฝนตกหนัก โอกาสเกิด 80%"
  peakTodayLine?: string; // ช่วงเวลาที่โอกาสเกิดฝนสูงสุดของวันนี้
  hourlyTimeline: Array<{
    colloquial: string;
    clock: string;
    prob: number;
    rainText: string;
    tempC: number;
  }>;
  location: ThaiLocation;
}

export interface AiSimplePlaceCard {
  id: string;
  roleLabel?: string; // เช่น "จุดเริ่มต้น (A)", "ระหว่างทาง", "ปลายทาง (B)" หรือ "จุดที่คุณถาม"
  placeTitle: string;
  areaSubtitle: string;
  trafficColor: TrafficColorCode;
  trafficEasyText: string;
  waterTier: WaterSafetyTier;
  waterEasyText: string;
  vehicleEasyAdvice: string;
  rainPredictionLine: string;
  currentWeatherEasy: string;
  location: ThaiLocation;
  status: LocationRealtimeStatus;
}

export interface AiEssentialBullet {
  icon: 'rain' | 'traffic' | 'water' | 'route';
  label: string;
  value: string;
  tone?: 'safe' | 'caution' | 'warning';
}

export interface QuestionTopicFocus {
  asksRain: boolean;
  asksTraffic: boolean;
  asksFlood: boolean;
  asksBestTime: boolean;
  asksVehiclePass: boolean;
  asksRainDurationOrIntensity: boolean;
  hasExplicitTopic: boolean;
  mode: 'rain_only' | 'traffic_only' | 'flood_only' | 'multi';
}

export interface AiConversationContextState {
  userQuestion: string;
  shortContextTitle: string;
  resolvedTopicFocus: QuestionTopicFocus;
  resolvedTargetHour: number | null;
  resolvedLocations: ThaiLocation[];
  isRoute: boolean;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string; // คำตอบสั้นเจาะจงเฉพาะสิ่งที่ถาม (1-2 บรรทัด)
  spokenAnswerText?: string; // ข้อความสรุปตรงประเด็นสำหรับให้ AI ตอบด้วยเสียงอัตโนมัติ
  targetScopeLabel?: string; // ป้ายบอกความเจาะจง เช่น "เจาะจง: พยากรณ์ฝน • ดอนเมือง (14:00 น.)"
  detailedText?: string; // ข้อมูลเพิ่มเติม (ซ่อนไว้ในปุ่มกดขยาย)
  essentialHighlights?: AiEssentialBullet[]; // แสดงเฉพาะหัวข้อที่ผู้ใช้ถาม (1-3 บรรทัดสั้นๆ)
  timestamp: string;
  queryType?: 'route_a_to_b' | 'rain_when_where' | 'place_check' | 'overview_general';
  isFollowUpContinuation?: boolean;
  previousQuestionRef?: string;
  conversationContext?: AiConversationContextState;
  quickVerdict?: {
    statusTone: 'safe' | 'caution' | 'warning';
    headline: string;
    subtext: string;
  };
  routeSummary?: {
    originName: string;
    destinationName: string;
    distanceKm: number;
    overallTrafficText: string;
    overallFloodText: string;
    canPassText: string;
  };
  rainPredictions?: AiRainPredictionItem[];
  placeCards?: AiSimplePlaceCard[];
  followUpSuggestions?: string[];
}

export interface PreloadedCategorizedWebData {
  updatedAt: string;
  totalWaterStations: number;
  totalRainStations: number;
  totalPreloadedPlaces: number;
  rainRanked: AiRainPredictionItem[];
  trafficRanked: AiSimplePlaceCard[];
  floodRanked: AiSimplePlaceCard[];
  overflowWaterStations: Array<{ station: RealWaterStation; location: ThaiLocation }>;
  watchWaterStations: Array<{ station: RealWaterStation; location: ThaiLocation }>;
  activeRainStations: Array<{ station: RealRainStation; location: ThaiLocation }>;
  popularRoutePresets: Array<{
    id: string;
    originLabel: string;
    destLabel: string;
    queryText: string;
    trafficColor: TrafficColorCode;
    waterTier: WaterSafetyTier;
    summaryBadge: string;
  }>;
}

/**
 * วิเคราะห์จุดเน้นและเจตนาย่อยของคำถาม เพื่อให้ AI ตอบเจาะจงเฉพาะเรื่องที่ผู้ใช้ถาม
 * หากเป็นคำถามต่อเนื่องที่ไม่ได้ระบุหัวข้อใหม่ (เช่น "แล้วบ่าย 3 ล่ะ?", "แล้วสรงประภาล่ะ?", "หนักไหม?") จะยึดหัวข้อจากคำถามก่อนหน้าเหมือนเป็นเรื่องเดียวกันทันที
 */
export function detectQuestionTopicFocus(
  userMessage: string,
  fallbackPreviousFocus?: QuestionTopicFocus | null
): QuestionTopicFocus {
  const m = userMessage.toLowerCase();
  const asksBestTime =
    /(ออกกี่โมง|เดินทางกี่โมง|ควรออกตอนไหน|ออกตอนไหนดี|ไปกี่โมงดี|เผื่อเวลา|ใช้เวลากี่นาที|กี่นาทีถึง)/i.test(
      m
    );
  const asksVehiclePass =
    /(ผ่านได้ไหม|ไปได้ไหม|ลุยได้ไหม|รถเล็ก|รถเก๋ง|มอเตอร์ไซค์|มอไซค์|จักรยานยนต์|รถกระบะ|วิ่งเลนไหน|ช่องทางไหน)/i.test(
      m
    );
  const asksRainDurationOrIntensity =
    /(ตกหนักไหม|หนักไหม|แรงไหม|หยุดกี่โมง|ซากี่โมง|ตกถึงกี่โมง|ตกนานไหม|ต้องพกร่มไหม|กี่เปอร์เซ็นต์)/i.test(
      m
    );

  const asksRain =
    asksRainDurationOrIntensity ||
    /(ฝน|ตกไหม|ตกกี่โมง|พายุ|เมฆ|อากาศ|ฟ้าครึ้ม|ร่ม|เปียก|พยากรณ์)/i.test(m);
  const asksTraffic =
    asksBestTime ||
    /(รถติด|ติดไหม|ติดหนักไหม|ติดนานไหม|การจราจร|จราจร|คล่องตัว|ชะลอตัว|รถเยอะ|ความเร็ว|ทำความเร็ว)/i.test(
      m
    );
  const asksFlood =
    asksVehiclePass ||
    /(น้ำท่วม|ท่วมไหม|น้ำขัง|รอระบาย|ล้นตลิ่ง|ระดับน้ำ|จมน้ำ|ลุยน้ำ|ท่วมสูง|กี่ซม|ถนนแห้ง)/i.test(
      m
    );

  const anyExplicit = asksRain || asksTraffic || asksFlood;

  if (!anyExplicit && fallbackPreviousFocus) {
    return {
      ...fallbackPreviousFocus,
      asksBestTime,
      asksVehiclePass,
      asksRainDurationOrIntensity,
      hasExplicitTopic: false
    };
  }

  if (asksRain && !asksTraffic && !asksFlood) {
    return {
      asksRain: true,
      asksTraffic: false,
      asksFlood: false,
      asksBestTime,
      asksVehiclePass,
      asksRainDurationOrIntensity,
      hasExplicitTopic: true,
      mode: 'rain_only'
    };
  }
  if (asksTraffic && !asksRain && !asksFlood) {
    return {
      asksRain: false,
      asksTraffic: true,
      asksFlood: false,
      asksBestTime,
      asksVehiclePass,
      asksRainDurationOrIntensity,
      hasExplicitTopic: true,
      mode: 'traffic_only'
    };
  }
  if (asksFlood && !asksRain && !asksTraffic) {
    return {
      asksRain: false,
      asksTraffic: false,
      asksFlood: true,
      asksBestTime,
      asksVehiclePass,
      asksRainDurationOrIntensity,
      hasExplicitTopic: true,
      mode: 'flood_only'
    };
  }

  return {
    asksRain: anyExplicit ? asksRain : true,
    asksTraffic: anyExplicit ? asksTraffic : true,
    asksFlood: anyExplicit ? asksFlood : true,
    asksBestTime,
    asksVehiclePass,
    asksRainDurationOrIntensity,
    hasExplicitTopic: anyExplicit,
    mode: 'multi'
  };
}

// พจนานุกรมคำเรียกชื่อย่อ/ภาษาพูดของคนไทย เพื่อแปลงเป็นพิกัดจริงได้ทันทีใน 0ms
const COLLOQUIAL_PLACE_ALIASES: Array<{
  keywords: string[];
  label: string;
  province: string;
  amphoe: string;
  tambon: string;
  lat: number;
  lng: number;
  roadName?: string;
}> = [
  {
    keywords: ['ดอนเมือง', 'สนามบินดอนเมือง', 'ท่าอากาศยานดอนเมือง'],
    label: 'ดอนเมือง (ถ.วิภาวดีรังสิต)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตดอนเมือง',
    tambon: 'แขวงดอนเมือง',
    lat: 13.9186,
    lng: 100.6068,
    roadName: 'ถนนวิภาวดีรังสิต / ดอนเมือง'
  },
  {
    keywords: ['สรงประภา', 'ถนนสรงประภา', 'ตลาดบุญอนันต์', 'วัดดอนเมือง', 'วัดสีกัน'],
    label: 'ถนนสรงประภา (ดอนเมือง)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตดอนเมือง',
    tambon: 'แขวงสีกัน',
    lat: 13.9265,
    lng: 100.5905,
    roadName: 'ถนนสรงประภา'
  },
  {
    keywords: ['อนุสรณ์สถาน', 'แยกอนุสรณ์สถาน', 'อนุสรณ์สถานแห่งชาติ'],
    label: 'แยกอนุสรณ์สถาน (พหลโยธิน - ลำลูกกา)',
    province: 'ปทุมธานี',
    amphoe: 'อ.ลำลูกกา',
    tambon: 'ต.คูคต',
    lat: 13.9523,
    lng: 100.6197,
    roadName: 'ถนนพหลโยธิน / ถนนวิภาวดีรังสิต'
  },
  {
    keywords: ['ฟิวเจอร์', 'ฟิวเจอร์พาร์ค', 'ฟิวเจอร์รังสิต', 'ฟิวเจอร์พาร์ครังสิต', 'รังสิต', 'เมเจอร์รังสิต'],
    label: 'ฟิวเจอร์พาร์ค รังสิต',
    province: 'ปทุมธานี',
    amphoe: 'อ.ธัญบุรี',
    tambon: 'ต.ประชาธิปัตย์',
    lat: 13.9892,
    lng: 100.6177,
    roadName: 'ถนนพหลโยธิน / รังสิต'
  },
  {
    keywords: ['เซียร์', 'เซียร์รังสิต', 'ตลาดสี่มุมเมือง', 'เมืองเอก'],
    label: 'เซียร์รังสิต / ตลาดสี่มุมเมือง',
    province: 'ปทุมธานี',
    amphoe: 'อ.ลำลูกกา',
    tambon: 'ต.คูคต',
    lat: 13.9635,
    lng: 100.6205,
    roadName: 'ถนนพหลโยธิน (ช่วงคูคต-รังสิต)'
  },
  {
    keywords: ['ลำลูกกา', 'ถนนลำลูกกา', 'คูคต', 'บีทีเอสคูคต', 'bts คูคต'],
    label: 'ถนนลำลูกกา / คูคต',
    province: 'ปทุมธานี',
    amphoe: 'อ.ลำลูกกา',
    tambon: 'ต.คูคต',
    lat: 13.9498,
    lng: 100.6385,
    roadName: 'ถนนลำลูกกา'
  },
  {
    keywords: ['ม.กรุงเทพ', 'ม.ธรรมศาสตร์', 'มธ.รังสิต', 'คลองหลวง', 'ตลาดไท'],
    label: 'ม.กรุงเทพ - ม.ธรรมศาสตร์ รังสิต',
    province: 'ปทุมธานี',
    amphoe: 'อ.คลองหลวง',
    tambon: 'ต.คลองหนึ่ง',
    lat: 14.0652,
    lng: 100.6085,
    roadName: 'ถนนพหลโยธิน (คลองหลวง)'
  },
  {
    keywords: [
      'กองบัญชาการกองทัพไทย',
      'บก.ทท.',
      'บก.ทท',
      'กองทัพไทย',
      'กองบัญชาการทหารสูงสุด',
      'บก.ทหารสูงสุด',
      'กรมการกงสุล',
      'กงสุลแจ้งวัฒนะ',
      'ดีเอสไอ',
      'ศาลปกครอง',
      'ไปรษณีย์ไทยแจ้งวัฒนะ',
      'ทีโอทีแจ้งวัฒนะ'
    ],
    label: 'กองบัญชาการกองทัพไทย (ถ.แจ้งวัฒนะ เขตหลักสี่)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตหลักสี่',
    tambon: 'แขวงทุ่งสองห้อง',
    lat: 13.8918,
    lng: 100.5658,
    roadName: 'ถนนแจ้งวัฒนะ (ช่วงศูนย์ราชการฯ - กองบัญชาการกองทัพไทย)'
  },
  {
    keywords: ['ศูนย์ราชการแจ้งวัฒนะ', 'ศูนย์ราชการฯ แจ้งวัฒนะ', 'ศูนย์ราชการ'],
    label: 'ศูนย์ราชการฯ แจ้งวัฒนะ (เขตหลักสี่)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตหลักสี่',
    tambon: 'แขวงทุ่งสองห้อง',
    lat: 13.8892,
    lng: 100.5685,
    roadName: 'ถนนแจ้งวัฒนะ (หน้าศูนย์ราชการฯ)'
  },
  {
    keywords: ['ไอทีสแควร์', 'it square', 'วัดหลักสี่', 'แยกหลักสี่', 'สถานีหลักสี่'],
    label: 'แยกหลักสี่ / ไอทีสแควร์ / วัดหลักสี่',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตหลักสี่',
    tambon: 'แขวงตลาดบางเขน',
    lat: 13.8865,
    lng: 100.5772,
    roadName: 'ถนนวิภาวดีรังสิต / ถนนแจ้งวัฒนะ (แยกหลักสี่)'
  },
  {
    keywords: ['แจ้งวัฒนะ', 'ถนนแจ้งวัฒนะ', 'เมืองทอง', 'เมืองทองธานี', 'อิมแพ็ค', 'เซ็นทรัลแจ้งวัฒนะ', 'ปากเกร็ด', 'ห้าแยกปากเกร็ด'],
    label: 'ถนนแจ้งวัฒนะ / เมืองทองธานี / ปากเกร็ด',
    province: 'นนทบุรี',
    amphoe: 'อ.ปากเกร็ด',
    tambon: 'ต.คลองเกลือ',
    lat: 13.9012,
    lng: 100.5385,
    roadName: 'ถนนแจ้งวัฒนะ'
  },
  {
    keywords: ['กองทัพอากาศ', 'พิพิธภัณฑ์กองทัพอากาศ', 'โรงพยาบาลภูมิพล', 'รพ.ภูมิพล', 'แยก คปอ', 'คปอ', 'สะพานใหม่', 'ตลาดยิ่งเจริญ'],
    label: 'กองทัพอากาศ / รพ.ภูมิพล / สะพานใหม่ (ถ.พหลโยธิน)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตดอนเมือง',
    tambon: 'แขวงสนามบิน',
    lat: 13.9052,
    lng: 100.6185,
    roadName: 'ถนนพหลโยธิน (ช่วงสะพานใหม่ - แยก คปอ.)'
  },
  {
    keywords: ['กองบัญชาการกองทัพบก', 'กองทัพบก', 'บก.ทบ.', 'ราชดำเนินนอก', 'เวทีราชดำเนิน'],
    label: 'กองบัญชาการกองทัพบก (ถ.ราชดำเนินนอก)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตพระนคร',
    tambon: 'แขวงบางขุนพรหม',
    lat: 13.7628,
    lng: 100.5088,
    roadName: 'ถนนราชดำเนินนอก'
  },
  {
    keywords: ['กองบัญชาการกองทัพเรือ', 'กองทัพเรือ', 'บก.ทร.', 'หอประชุมกองทัพเรือ', 'พระราชวังเดิม', 'วัดอรุณ'],
    label: 'กองบัญชาการกองทัพเรือ / พระราชวังเดิม',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตบางกอกใหญ่',
    tambon: 'แขวงวัดอรุณ',
    lat: 13.7432,
    lng: 100.4885,
    roadName: 'ถนนอรุณอมรินทร์ / ถนนวังเดิม'
  },
  {
    keywords: ['สำนักงานปลัดกระทรวงกลาโหม', 'ปลัดกระทรวงกลาโหม', 'กลาโหมศรีสมาน'],
    label: 'สำนักงานปลัดกระทรวงกลาโหม (ศรีสมาน)',
    province: 'นนทบุรี',
    amphoe: 'อ.ปากเกร็ด',
    tambon: 'ต.บ้านใหม่',
    lat: 13.9315,
    lng: 100.5562,
    roadName: 'ถนนศรีสมาน'
  },
  {
    keywords: ['กระทรวงกลาโหม', 'สนามหลวง', 'ศาลหลักเมือง', 'วัดพระแก้ว', 'พระบรมมหาราชวัง', 'ท่าพระจันทร์'],
    label: 'กระทรวงกลาโหม / สนามหลวง / ศาลหลักเมือง',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตพระนคร',
    tambon: 'แขวงพระบรมมหาราชวัง',
    lat: 13.7512,
    lng: 100.4945,
    roadName: 'ถนนสนามไชย / ถนนราชดำเนินใน'
  },
  {
    keywords: ['สำนักงานตำรวจแห่งชาติ', 'สตช.', 'โรงพยาบาลตำรวจ', 'รพ.ตำรวจ'],
    label: 'สำนักงานตำรวจแห่งชาติ / รพ.ตำรวจ (ราชประสงค์)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตปทุมวัน',
    tambon: 'แขวงปทุมวัน',
    lat: 13.7452,
    lng: 100.5382,
    roadName: 'ถนนพระราม 1'
  },
  {
    keywords: ['วัดพระศรีมหาธาตุ', 'วงเวียนบางเขน', 'ม.ราชภัฏพระนคร', 'ราชภัฏพระนคร'],
    label: 'วัดพระศรีมหาธาตุ บางเขน / วงเวียนบางเขน',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตบางเขน',
    tambon: 'แขวงอนุสาวรีย์',
    lat: 13.8748,
    lng: 100.5962,
    roadName: 'ถนนพหลโยธิน / ถนนแจ้งวัฒนะ (วงเวียนบางเขน)'
  },
  {
    keywords: ['มหาวิทยาลัยรังสิต', 'ม.รังสิต', 'หมู่บ้านเมืองเอก', 'หลักหก', 'นาวงประชาพัฒนา'],
    label: 'มหาวิทยาลัยรังสิต (ม.รังสิต) / เมืองเอก',
    province: 'ปทุมธานี',
    amphoe: 'อ.เมืองปทุมธานี',
    tambon: 'ต.หลักหก',
    lat: 13.9648,
    lng: 100.5872,
    roadName: 'ถนนเอกทักษิณ / ถนนนาวงประชาพัฒนา'
  },
  {
    keywords: ['มหาวิทยาลัยศรีปทุม', 'ม.ศรีปทุม', 'บางบัว', 'กรมป่าไม้'],
    label: 'มหาวิทยาลัยศรีปทุม / บางบัว (ถ.พหลโยธิน)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตจตุจักร',
    tambon: 'แขวงเสนานิคม',
    lat: 13.8555,
    lng: 100.5845,
    roadName: 'ถนนพหลโยธิน (ช่วงบางบัว - ม.ศรีปทุม)'
  },
  {
    keywords: ['มหาวิทยาลัยธุรกิจบัณฑิตย์', 'ธุรกิจบัณฑิตย์', 'มธบ', 'ประชาชื่น', 'คลองประปาประชาชื่น'],
    label: 'มหาวิทยาลัยธุรกิจบัณฑิตย์ (ถ.ประชาชื่น)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตหลักสี่',
    tambon: 'แขวงทุ่งสองห้อง',
    lat: 13.8705,
    lng: 100.5512,
    roadName: 'ถนนประชาชื่น'
  },
  {
    keywords: ['สถานีกลางบางซื่อ', 'กรุงเทพอภิวัฒน์', 'สถานีกลางกรุงเทพอภิวัฒน์', 'บางซื่อ', 'หมอชิต 2', 'ขนส่งหมอชิต', 'เตาปูน'],
    label: 'สถานีกลางกรุงเทพอภิวัฒน์ (บางซื่อ) / หมอชิต 2',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตจตุจักร',
    tambon: 'แขวงจตุจักร',
    lat: 13.8042,
    lng: 100.5415,
    roadName: 'ถนนกำแพงเพชร / ถนนพหลโยธิน'
  },
  {
    keywords: ['ทำเนียบรัฐบาล', 'รัฐสภา', 'เกียกกาย', 'ลานพระบรมรูปทรงม้า'],
    label: 'ทำเนียบรัฐบาล / รัฐสภา (เขตดุสิต)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตดุสิต',
    tambon: 'แขวงดุสิต',
    lat: 13.7885,
    lng: 100.5148,
    roadName: 'ถนนพิษณุโลก / ถนนสามเสน'
  },
  {
    keywords: ['โรงพยาบาลศิริราช', 'ศิริราช', 'รพ.ศิริราช', 'วังหลัง', 'พรานนก'],
    label: 'โรงพยาบาลศิริราช / วังหลัง / พรานนก',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตบางกอกน้อย',
    tambon: 'แขวงศิริราช',
    lat: 13.7582,
    lng: 100.4855,
    roadName: 'ถนนวังหลัง / ถนนพรานนก'
  },
  {
    keywords: ['โรงพยาบาลรามาธิบดี', 'รามาธิบดี', 'รพ.รามา', 'โรงพยาบาลพระมงกุฎเกล้า', 'พระมงกุฎ', 'รพ.พระมงกุฎ'],
    label: 'รพ.รามาธิบดี / รพ.พระมงกุฎเกล้า (ถ.พระราม 6 - ราชวิถี)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตราชเทวี',
    tambon: 'แขวงทุ่งพญาไท',
    lat: 13.7668,
    lng: 100.5265,
    roadName: 'ถนนพระราม 6 / ถนนราชวิถี'
  },
  {
    keywords: ['จุฬาลงกรณ์มหาวิทยาลัย', 'จุฬา', 'สามย่าน', 'สามย่านมิตรทาวน์', 'โรงพยาบาลจุฬา', 'รพ.จุฬา', 'สวนลุมพินี'],
    label: 'จุฬาฯ / สามย่าน / รพ.จุฬาลงกรณ์ (ถ.พระราม 4)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตปทุมวัน',
    tambon: 'แขวงปทุมวัน',
    lat: 13.7328,
    lng: 100.5335,
    roadName: 'ถนนพระราม 4 / ถนนพญาไท'
  },
  {
    keywords: ['ศรีสมาน', 'แยกศรีสมาน', 'โรบินสันศรีสมาน'],
    label: 'แยกศรีสมาน / โรบินสันศรีสมาน',
    province: 'นนทบุรี',
    amphoe: 'อ.ปากเกร็ด',
    tambon: 'ต.บ้านใหม่',
    lat: 13.9332,
    lng: 100.5698,
    roadName: 'ถนนศรีสมาน'
  },
  {
    keywords: ['งามวงศ์วาน', 'แคราย', 'เดอะมอลล์งามวงศ์วาน', 'พันธุ์ทิพย์งามวงศ์วาน', 'พงษ์เพชร'],
    label: 'ถนนงามวงศ์วาน / แยกแคราย',
    province: 'นนทบุรี',
    amphoe: 'อ.เมืองนนทบุรี',
    tambon: 'ต.บางเขน',
    lat: 13.8565,
    lng: 100.5415,
    roadName: 'ถนนงามวงศ์วาน'
  },
  {
    keywords: ['บางใหญ่', 'เวสต์เกต', 'เซ็นทรัลเวสต์เกต', 'รัตนาธิเบศร์', 'บางบัวทอง'],
    label: 'บางใหญ่ / เซ็นทรัลเวสต์เกต',
    province: 'นนทบุรี',
    amphoe: 'อ.บางใหญ่',
    tambon: 'ต.เสาธงหิน',
    lat: 13.8768,
    lng: 100.4112,
    roadName: 'ถนนกาญจนาภิเษก / รัตนาธิเบศร์'
  },
  {
    keywords: ['เกษตร', 'ม.เกษตร', 'แยกเกษตร', 'เสนานิคม', 'รัชโยธิน', 'เซ็นทรัลลาดพร้าว', 'ห้าแยกลาดพร้าว', 'จตุจักร', 'หมอชิต'],
    label: 'ห้าแยกลาดพร้าว / จตุจักร / ม.เกษตร',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตจตุจักร',
    tambon: 'แขวงจอมพล',
    lat: 13.8162,
    lng: 100.5608,
    roadName: 'ถนนพหลโยธิน / วิภาวดีรังสิต'
  },
  {
    keywords: ['ลาดพร้าว', 'ถนนลาดพร้าว', 'โชคชัย 4', 'บางกะปิ', 'เดอะมอลล์บางกะปิ'],
    label: 'ถนนลาดพร้าว / บางกะปิ',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตลาดพร้าว',
    tambon: 'แขวงลาดพร้าว',
    lat: 13.7935,
    lng: 100.6052,
    roadName: 'ถนนลาดพร้าว'
  },
  {
    keywords: ['รามอินทรา', 'ถนนรามอินทรา', 'มีนบุรี', 'แฟชั่นไอส์แลนด์', 'วัชรพล', 'หลักสี่'],
    label: 'ถนนรามอินทรา / มีนบุรี',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตคันนายาว',
    tambon: 'แขวงรามอินทรา',
    lat: 13.8355,
    lng: 100.6638,
    roadName: 'ถนนรามอินทรา'
  },
  {
    keywords: ['รัชดา', 'ถนนรัชดาภิเษก', 'ห้วยขวาง', 'พระราม 9', 'แยกพระราม 9', 'ดินแดง'],
    label: 'ถนนรัชดาภิเษก / พระราม 9',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตห้วยขวาง',
    tambon: 'แขวงห้วยขวาง',
    lat: 13.7652,
    lng: 100.5705,
    roadName: 'ถนนรัชดาภิเษก / พระราม 9'
  },
  {
    keywords: ['สยาม', 'สยามพารากอน', 'เซ็นทรัลเวิลด์', 'ราชประสงค์', 'ปทุมวัน', 'พญาไท', 'อนุสาวรีย์', 'อนุสาวรีย์ชัย'],
    label: 'สยาม / ราชประสงค์ / อนุสาวรีย์ชัยฯ',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตปทุมวัน',
    tambon: 'แขวงปทุมวัน',
    lat: 13.7462,
    lng: 100.5347,
    roadName: 'ถนนพระราม 1 / พญาไท'
  },
  {
    keywords: ['สุขุมวิท', 'อโศก', 'แยกอโศก', 'พร้อมพงษ์', 'ทองหล่อ', 'เอกมัย', 'พระโขนง', 'อ่อนนุช'],
    label: 'ถนนสุขุมวิท (อโศก - ทองหล่อ)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตวัฒนา',
    tambon: 'แขวงคลองเตยเหนือ',
    lat: 13.7368,
    lng: 100.5604,
    roadName: 'ถนนสุขุมวิท / แยกอโศก'
  },
  {
    keywords: ['สีลม', 'สาทร', 'บางรัก', 'คลองเตย', 'พระราม 4'],
    label: 'สีลม / สาทร / พระราม 4',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตสาทร',
    tambon: 'แขวงทุ่งมหาเมฆ',
    lat: 13.7235,
    lng: 100.5312,
    roadName: 'ถนนสาทร / สีลม'
  },
  {
    keywords: ['บางนา', 'แยกบางนา', 'เมกะบางนา', 'บางนา-ตราด', 'อุดมสุข', 'แบริ่ง', 'สำโรง', 'ปากน้ำ'],
    label: 'แยกบางนา / บางนา-ตราด',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตบางนา',
    tambon: 'แขวงบางนาเหนือ',
    lat: 13.6682,
    lng: 100.6348,
    roadName: 'ถนนบางนา-ตราด'
  },
  {
    keywords: ['สุวรรณภูมิ', 'สนามบินสุวรรณภูมิ', 'ลาดกระบัง', 'กิ่งแก้ว', 'บางพลี'],
    label: 'สนามบินสุวรรณภูมิ / ลาดกระบัง',
    province: 'สมุทรปราการ',
    amphoe: 'อ.บางพลี',
    tambon: 'ต.หนองปรือ',
    lat: 13.69,
    lng: 100.7501,
    roadName: 'มอเตอร์เวย์ ทล.7 / ลาดกระบัง'
  },
  {
    keywords: ['พระราม 2', 'ถนนพระราม 2', 'บางขุนเทียน', 'แสมดำ', 'มหาชัย'],
    label: 'ถนนพระราม 2 (บางขุนเทียน)',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตบางขุนเทียน',
    tambon: 'แขวงแสมดำ',
    lat: 13.6512,
    lng: 100.4315,
    roadName: 'ถนนพระราม 2'
  },
  {
    keywords: ['เพชรเกษม', 'บางแค', 'เดอะมอลล์บางแค', 'ภาษีเจริญ', 'หนองแขม', 'อ้อมน้อย'],
    label: 'ถนนเพชรเกษม / บางแค',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตบางแค',
    tambon: 'แขวงบางแคเหนือ',
    lat: 13.7131,
    lng: 100.4085,
    roadName: 'ถนนเพชรเกษม'
  },
  {
    keywords: ['ปิ่นเกล้า', 'บรมราชชนนี', 'ตลิ่งชัน', 'พุทธมณฑล', 'ศาลายา'],
    label: 'ปิ่นเกล้า / ถนนบรมราชชนนี',
    province: 'กรุงเทพมหานคร',
    amphoe: 'เขตตลิ่งชัน',
    tambon: 'แขวงฉิมพลี',
    lat: 13.7815,
    lng: 100.4465,
    roadName: 'ถนนบรมราชชนนี'
  },
  {
    keywords: ['พัทยา', 'บางแสน', 'ศรีราชา', 'ชลบุรี', 'แหลมฉบัง'],
    label: 'ชลบุรี / บางแสน / พัทยา',
    province: 'ชลบุรี',
    amphoe: 'อ.เมืองชลบุรี',
    tambon: 'ต.แสนสุข',
    lat: 13.2845,
    lng: 100.9155,
    roadName: 'มอเตอร์เวย์ ทล.7 / สุขุมวิท'
  },
  {
    keywords: ['อยุธยา', 'บางปะอิน', 'สายเอเชีย', 'วังน้อย', 'เสนา', 'บางบาล'],
    label: 'พระนครศรีอยุธยา / สายเอเชีย',
    province: 'พระนครศรีอยุธยา',
    amphoe: 'อ.พระนครศรีอยุธยา',
    tambon: 'ต.ประตูชัย',
    lat: 14.3532,
    lng: 100.5684,
    roadName: 'ถนนสายเอเชีย (ทล.32)'
  },
  {
    keywords: ['โคราช', 'นครราชสีมา', 'ปากช่อง', 'เขาใหญ่', 'สีคิ้ว', 'มิตรภาพ'],
    label: 'นครราชสีมา (โคราช) / มิตรภาพ',
    province: 'นครราชสีมา',
    amphoe: 'อ.เมืองนครราชสีมา',
    tambon: 'ต.ในเมือง',
    lat: 14.9799,
    lng: 102.0978,
    roadName: 'ถนนมิตรภาพ (ทล.2)'
  },
  {
    keywords: ['หัวหิน', 'ชะอำ', 'ปราณบุรี'],
    label: 'หัวหิน / ชะอำ',
    province: 'ประจวบคีรีขันธ์',
    amphoe: 'อ.หัวหิน',
    tambon: 'ต.หัวหิน',
    lat: 12.5684,
    lng: 99.9577,
    roadName: 'ถนนเพชรเกษม (ทล.4)'
  },
  {
    keywords: ['หาดใหญ่', 'สงขลา'],
    label: 'หาดใหญ่ / สงขลา',
    province: 'สงขลา',
    amphoe: 'อ.หาดใหญ่',
    tambon: 'ต.หาดใหญ่',
    lat: 7.0086,
    lng: 100.4747,
    roadName: 'ถนนเพชรเกษม / กาญจนวนิช'
  }
];

function aliasToThaiLocation(alias: (typeof COLLOQUIAL_PLACE_ALIASES)[number]): ThaiLocation {
  const base = createLocationFromTambon(alias.province, alias.amphoe, alias.tambon);
  const nearCurated = findNearbyRoadSegmentsByCoords(alias.lat, alias.lng, 4.5, 4);
  const closestSeg = nearCurated[0]?.segment;

  // คงชื่อสถานที่เฉพาะที่ผู้ใช้ถามไว้เสมอ (เช่น "กองบัญชาการกองทัพไทย (ถ.แจ้งวัฒนะ เขตหลักสี่)")
  // พร้อมดึงข้อมูลคลองระบายน้ำและจุดเสี่ยงจากถนนสายหลักใกล้เคียงมาประกอบ
  return {
    ...base,
    id: `alias-${alias.label}`,
    name: alias.label,
    province: alias.province,
    amphoe: alias.amphoe,
    tambon: alias.tambon,
    lat: alias.lat,
    lng: alias.lng,
    roadName: alias.roadName || closestSeg?.roadName || base.roadName,
    highway: alias.roadName || closestSeg?.roadName || base.highway,
    waterwayWatch: closestSeg?.waterwayWatch || base.waterwayWatch,
    floodRiskNote: closestSeg?.floodRiskNote || base.floodRiskNote,
    trafficHotspotNote: closestSeg?.trafficHotspotNote || base.trafficHotspotNote
  };
}

/**
 * ดึงข้อมูลที่โหลดเก็บไว้ในเว็บแล้วแบบทันที (0ms) พร้อมจัดเรียงลำดับและแยกประเภทเรียบร้อย
 */
export function getPreloadedCategorizedWebData(
  activeLocations: ThaiLocation[] = []
): PreloadedCategorizedWebData {
  const seenKeys = new Set<string>();
  const allMonitoredLocations: ThaiLocation[] = [];

  const pushLoc = (loc: ThaiLocation) => {
    const key = `${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      allMonitoredLocations.push(loc);
    }
  };

  for (const loc of activeLocations) {
    pushLoc(loc);
  }

  for (const seg of CURATED_ROAD_SEGMENTS) {
    pushLoc(roadSegmentToLocation(seg));
  }

  for (const alias of COLLOQUIAL_PLACE_ALIASES) {
    pushLoc(aliasToThaiLocation(alias));
  }

  const allStatuses = allMonitoredLocations.map((loc) => getCachedLocationStatus(loc));
  const allRainPredictions = allStatuses.map((st) => buildRainPredictionForStatus(st, null));
  const allSimpleCards = allStatuses.map((st) => statusToSimplePlaceCard(st));

  const rainRanked = [...allRainPredictions].sort(
    (a, b) =>
      b.probabilityPercent + b.precipMm * 10 - (a.probabilityPercent + a.precipMm * 10)
  );

  const trafficScore: Record<TrafficColorCode, number> = {
    red: 3,
    yellow: 2,
    green: 1
  };
  const trafficRanked = [...allSimpleCards].sort((a, b) => {
    const diff = trafficScore[b.trafficColor] - trafficScore[a.trafficColor];
    if (diff !== 0) return diff;
    return b.status.rainProbabilityPercent - a.status.rainProbabilityPercent;
  });

  const waterScore: Record<WaterSafetyTier, number> = {
    critical: 4,
    danger: 3,
    watch: 2,
    normal: 1
  };
  const floodRanked = [...allSimpleCards].sort((a, b) => {
    const diff = waterScore[b.waterTier] - waterScore[a.waterTier];
    if (diff !== 0) return diff;
    const pctB = b.status.primaryWaterStation?.storagePercent ?? 0;
    const pctA = a.status.primaryWaterStation?.storagePercent ?? 0;
    return pctB - pctA;
  });

  const nationalReport = getNationwideSituationReport('all_overview');

  const routePairs: Array<{ a: string; b: string }> = [
    { a: 'ดอนเมือง', b: 'ฟิวเจอร์รังสิต' },
    { a: 'สรงประภา', b: 'ลาดพร้าว' },
    { a: 'อนุสรณ์สถาน', b: 'สยาม' },
    { a: 'แจ้งวัฒนะ', b: 'จตุจักร' },
    { a: 'รังสิต', b: 'อยุธยา' },
    { a: 'บางนา', b: 'ชลบุรี' }
  ];

  const popularRoutePresets = routePairs.map((pair, idx) => {
    const aliasA = COLLOQUIAL_PLACE_ALIASES.find((al) => al.keywords.includes(pair.a));
    const aliasB = COLLOQUIAL_PLACE_ALIASES.find((al) => al.keywords.includes(pair.b));
    const stA = aliasA ? getCachedLocationStatus(aliasToThaiLocation(aliasA)) : allStatuses[0];
    const stB = aliasB
      ? getCachedLocationStatus(aliasToThaiLocation(aliasB))
      : allStatuses[1] || allStatuses[0];

    const worstTraffic: TrafficColorCode =
      stA?.trafficStatus.colorCode === 'red' || stB?.trafficStatus.colorCode === 'red'
        ? 'red'
        : stA?.trafficStatus.colorCode === 'yellow' || stB?.trafficStatus.colorCode === 'yellow'
          ? 'yellow'
          : 'green';

    const worstWater: WaterSafetyTier =
      waterScore[stA?.waterSafetyTier || 'normal'] >= waterScore[stB?.waterSafetyTier || 'normal']
        ? stA?.waterSafetyTier || 'normal'
        : stB?.waterSafetyTier || 'normal';

    const summaryBadge =
      worstTraffic === 'red'
        ? '🔴 มีช่วงรถติด'
        : worstTraffic === 'yellow'
          ? '🟡 ชะลอตัวบางช่วง'
          : '🟢 คล่องตัว';

    return {
      id: `preset-route-${idx}`,
      originLabel: pair.a,
      destLabel: pair.b,
      queryText: `จาก ${pair.a} ไป ${pair.b} รถติดไหม น้ำท่วมไหม?`,
      trafficColor: worstTraffic,
      waterTier: worstWater,
      summaryBadge
    };
  });

  return {
    updatedAt: new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    totalWaterStations: nationalReport.totalMonitoredWaterStations,
    totalRainStations: nationalReport.totalMonitoredRainStations,
    totalPreloadedPlaces: allSimpleCards.length,
    rainRanked,
    trafficRanked,
    floodRanked,
    overflowWaterStations: nationalReport.overflowWaterStations,
    watchWaterStations: nationalReport.watchWaterStations,
    activeRainStations: nationalReport.activeRainStations,
    popularRoutePresets
  };
}

function stripQuestionNoise(rawText: string): string {
  return rawText
    .replace(
      /(เดินทางจาก|ขับรถจาก|เริ่มจาก|ออกจาก|จากตรงนั้น|จากแถวนั้น|จากที่นี่|จากที่นั่น|จาก|ไปยัง|มุ่งหน้าไป|วิ่งต่อไป|ต่อไป|แล้วถ้าไป|ถ้าไป|ไปที่|ไปแถว|ไปได้ไหม|ไปเลยไหม|ไปไหม|บอกเลย|ได้เลย|ตากฝน|รถติดหนักไหม|รถติดนานไหม|รถติดไหม|ติดหนักไหม|ติดนานไหม|ติดไหม|มีน้ำท่วมขังไหม|มีน้ำท่วมไหม|น้ำท่วมขังไหม|น้ำท่วมไหม|ท่วมสูงไหม|ท่วมไหม|น้ำขังไหม|รอระบายไหม|ถนนแห้งไหม|ฝนจะตกหนักไหม|ฝนตกหนักไหม|ฝนจะตกไหม|ฝนตกไหม|ฝนจะตกเพิ่มกี่โมง|ฝนจะตกกี่โมง|ตกหนักไหม|ตกแรงไหม|ตกนานไหม|หยุดตกกี่โมง|หยุดกี่โมง|ซากี่โมง|ตกถึงกี่โมง|ตกกี่โมง|ออกเดินทางกี่โมงดี|เดินทางกี่โมงดี|ออกกี่โมงดี|ควรออกกี่โมง|ออกตอนไหนดี|ต้องเผื่อเวลากี่นาที|เผื่อเวลากี่นาที|ใช้เวลากี่นาที|กี่นาที|กี่ชั่วโมง|กี่โมง|โอกาสเกิดกี่เปอร์เซ็นต์|โอกาสกี่เปอร์เซ็นต์|กี่เปอร์เซ็นต์|กี่ซม\.?|กี่เมตร|ความเร็วเท่าไหร่|เท่าไหร่|ตอนนี้|เวลานี้|วันนี้|บ่ายนี้|เย็นนี้|ค่ำนี้|คืนนี้|เช้านี้|พรุ่งนี้เช้า|พรุ่งนี้|ช่วงเช้า|ช่วงบ่าย|ช่วงเย็น|ช่วงค่ำ|หัวค่ำ|เลิกงาน|เที่ยงคืน|เที่ยง|บ่ายโมง|ทุ่มนึง|อีก\s*\d+\s*(?:ชม\.?|ชั่วโมง)|(?:บ่าย|ตี|เวลา)\s*\d+[:.]?\d*|\d+\s*(?:โมงเช้า|โมงเย็น|ทุ่ม|โมง|นาฬิกา|น\.)|\d{1,2}[:.]\d{2}|เป็นยังไงบ้าง|เป็นไงบ้าง|เป็นยังไง|เป็นไง|ยังไงบ้าง|ยังไง|ที่ไหนบ้าง|ที่ไหน|แถวนั้น|ตรงนั้น|จุดนั้น|พื้นที่นั้น|พื้นที่นี้|เส้นนั้น|เส้นนี้|ทางนั้น|ทางนี้|ที่นั่น|ที่นี่|เมื่อกี้|ตะกี้|ขากลับ|เดินทางกลับ|ขาไป|แถว|บริเวณ|ย่าน|ซอย|ถนนสายหลัก|สายหลัก|ทางด่วน|วิ่งเลนไหน|เลนไหน|ช่องทางไหน|ถนน|ตรง|รถยนต์|รถเก๋ง|เก๋ง|รถกระบะ|กระบะ|รถเล็ก|รถใหญ่|มอเตอร์ไซค์|มอไซค์|จักรยานยนต์|ผ่านได้ปกติไหม|ผ่านได้ไหม|ลุยได้ไหม|เลี่ยงไปทางไหน|ต้องพกร่มไหม|พกร่มไหม|หนักไหม|แรงไหม|เบาไหม|นานไหม|สูงไหม|ลึกไหม|ดีไหม|ได้ไหม|ปกติไหม|หรือเปล่า|รึเปล่า|ป่าว|มั้ย|ไหม|เหรอ|แล้วถ้าเป็น|แล้วถ้า|สมมติว่า|สมมติ|ถ้าเกิด|ถ้าเป็น|ถ้า|ส่วน|สำหรับ|ต่อเนื่อง|ถามต่อ|ขอรายละเอียดเพิ่ม|รายละเอียด|ทำไมถึง|ทำไม|ควร|ต้อง|จะ|ยัง|อยู่|มี|ไม่มี|และ|หรือ|กับ|ล่ะ|ละ|ครับ|ค่ะ|คะ|นะ|หน่อย|จ๊ะ|จ้ะ|เอ่ย|[?()•,-])/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

const LANDMARK_PREFIX_REGEX =
  /(กองบัญชาการ|กองทัพ|บก\.|กรม|กระทรวง|สำนักงาน|ศูนย์ราชการ|ศูนย์|ศาล|ทำเนียบ|รัฐสภา|สถานีตำรวจ|สน\.|สภ\.|โรงพยาบาล|รพ\.|คลินิก|มหาวิทยาลัย|ม\.|โรงเรียน|ร\.ร\.|วิทยาลัย|สถาบัน|วัด|มัสยิด|โบสถ์|อนุสาวรีย์|อนุสรณ์สถาน|ห้าง|เซ็นทรัล|เดอะมอลล์|โรบินสัน|โลตัส|บิ๊กซี|แม็คโคร|ตลาด|อิมแพ็ค|ไบเทค|สนามบิน|ท่าอากาศยาน|สถานี|บีทีเอส|เอ็มอาร์ที|ท่าเรือ|บขส\.|หมู่บ้าน|คอนโด|อาคาร|ตึก|นิคม|สวน|สนาม|ค่าย)/i;

/**
 * ตรวจสอบว่าข้อความสามารถจับคู่กับตำบล/อำเภอใน flatIndex ได้อย่างปลอดภัยหรือไม่
 * ป้องกันปัญหาชื่อสถานที่สำคัญ เช่น "กองบัญชาการกองทัพไทย" ไปตรงกับคำลงท้าย "ต.ทัพไทย อ.ตาพระยา"
 */
function matchSafeTambonOrAmphoeFromFlatIndex(
  rawText: string,
  lowerCleaned: string
): ThaiLocation | null {
  if (!lowerCleaned || lowerCleaned.length < 2) return null;

  const hasExplicitSubdistrictPrefix = /(ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต)\s*[^\s]+/i.test(rawText);

  // หากมีคำนำหน้าสถานที่สำคัญ (เช่น กองบัญชาการ, โรงพยาบาล, วัด, มหาวิทยาลัย, กรม, กระทรวง)
  // และไม่ได้ระบุ "ต./ตำบล/แขวง/อ./อำเภอ/เขต" ห้ามจับคู่สุ่มกับชื่อตำบลเด็ดขาด!
  if (LANDMARK_PREFIX_REGEX.test(rawText) && !hasExplicitSubdistrictPrefix) {
    return null;
  }

  // คำทั่วไปที่อาจซ้ำกับชื่อตำบลแต่ไม่ใช่การถามชื่อตำบลโดยตรง
  const ambiguousTambonWords = new Set([
    'ทัพไทย',
    'ในเมือง',
    'นอกเมือง',
    'ตลาด',
    'กลาง',
    'สนามบิน',
    'ท่าเรือ',
    'มหาธาตุ',
    'บ้านใหม่',
    'หน้าเมือง',
    'หัวรอ'
  ]);

  const flatIndex = getFlatTambonIndex();
  const refCoords = getSearchReferenceCoordinates();

  // 1. กรณีระบุคำนำหน้า ต./ตำบล/แขวง/อ./อำเภอ/เขต ชัดเจน (จัดอันดับด้วย Proximity Search รัศมีพิกัดใกล้สุดก่อน)
  if (hasExplicitSubdistrictPrefix) {
    const explicitMatch = rawText.match(/(?:ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต)\s*([^\s,?]+)/i);
    const targetName = explicitMatch ? explicitMatch[1].trim().toLowerCase() : lowerCleaned;
    const candidates: Array<{ loc: ThaiLocation; distKm: number }> = [];
    for (let i = 0; i < flatIndex.length; i++) {
      const item = flatIndex[i];
      const cleanAmphoe = item.amphoe.replace(/^(อ\.|เขต)/, '').trim().toLowerCase();
      const cleanTambon = item.tambon.replace(/^(ต\.|แขวง)/, '').trim().toLowerCase();
      if (cleanTambon === targetName || cleanAmphoe === targetName) {
        const distKm = calculateDistanceKm(refCoords.lat, refCoords.lng, item.lat, item.lng);
        candidates.push({
          loc: createLocationFromTambon(item.province, item.amphoe, item.tambon),
          distKm
        });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.distKm - b.distKm);
      return candidates[0].loc;
    }
  }

  // 2. กรณีพิมพ์ชื่ออำเภอหรือตำบลตรงๆ ทั้งคำ (Exact Match เท่านั้น + จัดอันดับด้วย Proximity Search เพื่อป้องกันการข้ามจังหวัดผิดพลาด)
  if (!ambiguousTambonWords.has(lowerCleaned)) {
    const candidates: Array<{ loc: ThaiLocation; rank: number; distKm: number }> = [];
    for (let i = 0; i < flatIndex.length; i++) {
      const item = flatIndex[i];
      const cleanAmphoe = item.amphoe.replace(/^(อ\.|เขต)/, '').trim().toLowerCase();
      const cleanTambon = item.tambon.replace(/^(ต\.|แขวง)/, '').trim().toLowerCase();
      if (cleanAmphoe === lowerCleaned || cleanTambon === lowerCleaned) {
        const distKm = calculateDistanceKm(refCoords.lat, refCoords.lng, item.lat, item.lng);
        candidates.push({
          loc: createLocationFromTambon(item.province, item.amphoe, item.tambon),
          rank: cleanAmphoe === lowerCleaned ? 1 : 2,
          distKm
        });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.distKm - b.distKm));
      return candidates[0].loc;
    }
  }

  return null;
}

const resolvedSemanticPlaceCache = new Map<string, ThaiLocation>();

/**
 * ค้นหาสถานที่ 1 แห่งแบบทันทีจากข้อมูลที่โหลดไว้ในเว็บ (0ms Synchronous) พร้อมใช้ Semantic Search Cache และ Proximity Anchor
 */
export function resolveSinglePlaceSync(rawText: string): ThaiLocation | null {
  const cleaned = stripQuestionNoise(rawText);
  if (!cleaned || cleaned.length < 2) return null;

  const semanticKey = normalizeSemanticSearchKey(cleaned);
  if (semanticKey && resolvedSemanticPlaceCache.has(semanticKey)) {
    return resolvedSemanticPlaceCache.get(semanticKey)!;
  }

  const lower = cleaned.toLowerCase();

  // 0. ค้นหาจากสถานที่โปรดของผู้ใช้งาน (เช่น บ้าน, ที่ทำงาน, คอนโด, โรงเรียน หรือป้ายชื่อที่ตั้งไว้)
  const favorites = getFavoriteLocations();
  for (const fav of favorites) {
    const custom = (fav.customLabel || '').toLowerCase();
    const fname = fav.name.toLowerCase();
    if (
      (custom && (lower === custom || lower.includes(custom))) ||
      (lower === fname || lower.includes(fname)) ||
      (fav.iconType === 'home' && /^(บ้าน|ที่บ้าน|คอนโด)$/i.test(cleaned)) ||
      (fav.iconType === 'work' && /^(ที่ทำงาน|ออฟฟิศ|บริษัท)$/i.test(cleaned)) ||
      (fav.iconType === 'school' && /^(โรงเรียน|มหาลัย|มหาวิทยาลัย)$/i.test(cleaned))
    ) {
      if (semanticKey) resolvedSemanticPlaceCache.set(semanticKey, fav.location);
      return fav.location;
    }
  }

  // 1. ค้นหาจากพจนานุกรมสถานที่สำคัญและย่านหลัก โดยเลือกคำค้นที่ตรงและยาวที่สุดก่อน
  let bestAlias: (typeof COLLOQUIAL_PLACE_ALIASES)[number] | null = null;
  let bestAliasKwLen = 0;

  for (const alias of COLLOQUIAL_PLACE_ALIASES) {
    for (const kw of alias.keywords) {
      const kwLower = kw.toLowerCase();
      if (lower.includes(kwLower) || kwLower === lower) {
        if (kwLower.length > bestAliasKwLen) {
          bestAliasKwLen = kwLower.length;
          bestAlias = alias;
        }
      }
    }
  }
  if (bestAlias) {
    const loc = aliasToThaiLocation(bestAlias);
    if (semanticKey) resolvedSemanticPlaceCache.set(semanticKey, loc);
    return loc;
  }

  // 2. ค้นหาด้วยระบบ Spatial Proximity Anchor และ Semantic Search Cache ใน weatherWaterService
  const proximityAnchor = resolveQueryProximityAnchor(cleaned);
  if (proximityAnchor && proximityAnchor.matchedSegments.length > 0) {
    const loc = roadSegmentToLocation(proximityAnchor.matchedSegments[0]);
    if (semanticKey) resolvedSemanticPlaceCache.set(semanticKey, loc);
    return loc;
  }

  const semanticCachedItems = searchLocalRoadsAndLocationsSync(cleaned);
  if (
    semanticCachedItems.length > 0 &&
    (semanticCachedItems[0].category === 'landmark_place' ||
      semanticCachedItems[0].category === 'road_segment')
  ) {
    const loc = semanticCachedItems[0].location;
    if (semanticKey) resolvedSemanticPlaceCache.set(semanticKey, loc);
    return loc;
  }

  // 3. ค้นหาจากชื่อจังหวัด (ต้องไม่ชนกับชื่อหน่วยงาน)
  if (!LANDMARK_PREFIX_REGEX.test(rawText)) {
    for (const prov of THAI_PROVINCES_COORDS) {
      if (lower === prov.name.toLowerCase() || lower.includes(prov.name.toLowerCase())) {
        const loc = createLocationFromTambon(prov.name, '');
        if (semanticKey) resolvedSemanticPlaceCache.set(semanticKey, loc);
        return loc;
      }
    }
  }

  // 4. ค้นหาจากชื่ออำเภอ/ตำบล แบบปลอดภัยด้วย Proximity Search
  const adminLoc = matchSafeTambonOrAmphoeFromFlatIndex(rawText, lower);
  if (adminLoc && semanticKey) {
    resolvedSemanticPlaceCache.set(semanticKey, adminLoc);
  }
  return adminLoc;
}

/**
 * ค้นหาสถานที่จริงจาก OpenStreetMap (Nominatim) โดยตรง พร้อมคัดกรองด้วยรัศมีพิกัด (Proximity Search)
 */
async function queryOpenStreetMapPlaceDirect(placeQuery: string): Promise<ThaiLocation | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      placeQuery
    )}&countrycodes=th&addressdetails=1&limit=5&accept-language=th`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'ThaiWeatherWaterApp/1.0' },
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        const localAnchor = resolveQueryProximityAnchor(placeQuery);
        const refCoords = localAnchor || getSearchReferenceCoordinates();

        // คัดกรองและจัดอันดับพิกัดจาก OpenStreetMap ด้วย Proximity Search
        const scoredOsm = items
          .map((item) => {
            const lat = Number(item?.lat);
            const lng = Number(item?.lon);
            const distKm = calculateDistanceKm(refCoords.lat, refCoords.lng, lat, lng);
            return { item, lat, lng, distKm };
          })
          .filter(({ lat, lng, distKm }) => {
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
            if (localAnchor && localAnchor.isSpecificLandmarkOrRoad && distKm > 25.0) {
              return false;
            }
            return true;
          })
          .sort((a, b) => (localAnchor ? a.distKm - b.distKm : 0));

        const chosen = scoredOsm[0];
        if (chosen) {
          const { item: top, lat, lng } = chosen;
          const nearestAdmin = findNearestTambonByCoords(lat, lng);
          const nearbyCurated = findNearbyRoadSegmentsByCoords(lat, lng, 6.0, 4);
          const closestSeg = nearbyCurated[0]?.segment;
          const addr = top?.address || {};
          const roadName = (
            addr.road ||
            addr.highway ||
            closestSeg?.roadName ||
            nearestAdmin.roadName ||
            ''
          ).trim();
          const districtArea =
            addr.city_district || addr.county || addr.city || addr.town || nearestAdmin.amphoe;
          const subArea =
            addr.suburb || addr.quarter || addr.neighbourhood || addr.village || nearestAdmin.tambon;
          const osmProv = (addr.state || addr.province || '').replace(/^จังหวัด\s*/, '').trim();
          const provinceArea =
            osmProv && osmProv === nearestAdmin.province ? osmProv : nearestAdmin.province;
          const displayTitle = (top?.name || placeQuery).trim();

          return {
            ...nearestAdmin,
            id: `osm-direct-${top?.place_id || placeQuery}`,
            name: `${displayTitle} (${roadName ? `${roadName} ` : ''}${districtArea})`,
            province: provinceArea,
            amphoe: districtArea,
            tambon: subArea,
            lat,
            lng,
            roadName: roadName || displayTitle,
            highway: roadName || nearestAdmin.highway,
            waterwayWatch: closestSeg?.waterwayWatch || nearestAdmin.waterwayWatch,
            floodRiskNote: closestSeg?.floodRiskNote || nearestAdmin.floodRiskNote,
            trafficHotspotNote: closestSeg?.trafficHotspotNote || nearestAdmin.trafficHotspotNote
          };
        }
      }
    }
  } catch {
    // ignore network timeout
  }
  return null;
}

export async function resolveSinglePlaceByText(rawText: string): Promise<ThaiLocation | null> {
  const syncHit = resolveSinglePlaceSync(rawText);
  if (syncHit) return syncHit;

  const cleaned = stripQuestionNoise(rawText);
  if (!cleaned || cleaned.length < 2) return null;

  const semanticKey = normalizeSemanticSearchKey(cleaned);

  // ค้นหาพิกัดสถานที่จริงจาก OpenStreetMap โดยตรงก่อน เพื่อความแม่นยำสูงสุดสำหรับชื่อหน่วยงาน/อาคาร/วัด/โรงเรียน
  const directOsm = await queryOpenStreetMapPlaceDirect(cleaned);
  if (directOsm) {
    if (semanticKey) resolvedSemanticPlaceCache.set(semanticKey, directOsm);
    return directOsm;
  }

  const searchItems = await searchRoadsAndLocations(cleaned);
  if (searchItems.length > 0) {
    const loc = searchItems[0].location;
    if (semanticKey) resolvedSemanticPlaceCache.set(semanticKey, loc);
    return loc;
  }

  return null;
}

/**
 * สกัดเฉพาะสถานที่ที่ผู้ใช้ระบุจริงๆ เท่านั้น (เรียงตามความเจาะจงสูงสุด และไม่ดึงตำบลสุ่มมาปนเด็ดขาด)
 */
function extractMentionedLocationsSync(userMessage: string): ThaiLocation[] {
  const cleanedForPlace = stripQuestionNoise(userMessage);
  const lowerCleaned = cleanedForPlace.toLowerCase();
  const lowerRaw = userMessage.toLowerCase();

  const found: ThaiLocation[] = [];

  const addIfDistinctArea = (loc: ThaiLocation) => {
    const isDuplicateArea = found.some(
      (existing) =>
        existing.id === loc.id ||
        calculateDistanceKm(existing.lat, existing.lng, loc.lat, loc.lng) < 3.2
    );
    if (!isDuplicateArea) {
      found.push(loc);
    }
  };

  // 0. ตรวจจากสถานที่โปรดของผู้ใช้งาน
  const favorites = getFavoriteLocations();
  for (const fav of favorites) {
    const custom = (fav.customLabel || '').toLowerCase();
    const fname = fav.name.toLowerCase();
    if (
      (custom && (lowerCleaned.includes(custom) || lowerRaw.includes(custom))) ||
      (fname && (lowerCleaned.includes(fname) || lowerRaw.includes(fname))) ||
      (fav.iconType === 'home' && /(^|\s)(บ้าน|ที่บ้าน|คอนโด)(\s|$|[?.,!])/i.test(userMessage)) ||
      (fav.iconType === 'work' && /(^|\s)(ที่ทำงาน|ออฟฟิศ|บริษัท)(\s|$|[?.,!])/i.test(userMessage)) ||
      (fav.iconType === 'school' && /(^|\s)(โรงเรียน|มหาลัย|มหาวิทยาลัย)(\s|$|[?.,!])/i.test(userMessage))
    ) {
      addIfDistinctArea(fav.location);
    }
  }

  // หากผู้ใช้ถามถึง "สถานที่โปรด" / "รายการโปรด" / "ที่บันทึกไว้" ทั้งหมด
  if (/(สถานที่โปรด|รายการโปรด|ที่บันทึกไว้|สถานที่ที่บันทึกไว้)/i.test(userMessage)) {
    for (const fav of favorites) {
      addIfDistinctArea(fav.location);
    }
  }

  // 1. ตรวจจากชื่อสถานที่สำคัญ/ย่านหลัก โดยเรียงตามความยาวของคำที่ตรงมากที่สุดก่อน
  const matchedAliases: Array<{
    alias: (typeof COLLOQUIAL_PLACE_ALIASES)[number];
    maxKwLen: number;
  }> = [];

  for (const alias of COLLOQUIAL_PLACE_ALIASES) {
    let maxLen = 0;
    for (const kw of alias.keywords) {
      const kwLower = kw.toLowerCase();
      if (lowerRaw.includes(kwLower)) {
        if (kwLower.length > maxLen) {
          maxLen = kwLower.length;
        }
      }
    }
    if (maxLen > 0) {
      matchedAliases.push({ alias, maxKwLen: maxLen });
    }
  }

  matchedAliases.sort((a, b) => b.maxKwLen - a.maxKwLen);
  for (const item of matchedAliases) {
    addIfDistinctArea(aliasToThaiLocation(item.alias));
    if (found.length >= 2) break;
  }

  // 2. ตรวจจากฐานข้อมูลช่วงถนนสายหลัก (เฉพาะเมื่อยังไม่ครบหรือยังไม่เจอย่านนั้น)
  if (found.length === 0) {
    const matchedSegments: Array<{
      seg: (typeof CURATED_ROAD_SEGMENTS)[number];
      maxKwLen: number;
    }> = [];

    for (const seg of CURATED_ROAD_SEGMENTS) {
      let maxLen = 0;
      if (seg.placeName && lowerRaw.includes(seg.placeName.toLowerCase())) {
        maxLen = seg.placeName.length + 5;
      }
      for (const kw of seg.keywords) {
        const kwLower = kw.toLowerCase();
        if (kwLower.length >= 4 && lowerRaw.includes(kwLower)) {
          if (kwLower.length > maxLen) {
            maxLen = kwLower.length;
          }
        }
      }
      if (maxLen > 0) {
        matchedSegments.push({ seg, maxKwLen: maxLen });
      }
    }

    matchedSegments.sort((a, b) => b.maxKwLen - a.maxKwLen);
    for (const item of matchedSegments) {
      addIfDistinctArea(roadSegmentToLocation(item.seg));
      if (found.length >= 2) break;
    }
  }

  // 3. หากยังไม่เจอสถานที่ใดๆ เลย และไม่ใช่ชื่อหน่วยงาน/สถานที่สำคัญเฉพาะ จึงตรวจชื่อจังหวัด
  if (found.length === 0 && lowerCleaned.length >= 2 && !LANDMARK_PREFIX_REGEX.test(userMessage)) {
    const ambiguousProvinces = new Set(['เลย', 'ตาก', 'น่าน', 'แพร่', 'ตรัง', 'ตราด']);
    for (const prov of THAI_PROVINCES_COORDS) {
      const pLower = prov.name.toLowerCase();
      if (ambiguousProvinces.has(prov.name)) {
        const explicitProvRegex = new RegExp(`(จังหวัด|จ\\.|เมือง|แถว|ที่)\\s*${prov.name}`, 'i');
        if (explicitProvRegex.test(userMessage) || lowerCleaned === pLower) {
          addIfDistinctArea(createLocationFromTambon(prov.name, ''));
          break;
        }
      } else if (lowerCleaned === pLower || lowerCleaned.includes(pLower)) {
        addIfDistinctArea(createLocationFromTambon(prov.name, ''));
        break;
      }
    }
  }

  // 4. ตรวจชื่ออำเภอ/ตำบลแบบปลอดภัย (Exact Match เท่านั้น ห้ามตัดคำย่อยในชื่อสถานที่สำคัญ เช่น กองบัญชาการกองทัพไทย -> ทัพไทย!)
  if (found.length === 0 && lowerCleaned.length >= 2) {
    const safeTambonLoc = matchSafeTambonOrAmphoeFromFlatIndex(userMessage, lowerCleaned);
    if (safeTambonLoc) {
      addIfDistinctArea(safeTambonLoc);
    }
  }

  return found;
}

async function extractMentionedLocationsInText(
  userMessage: string
): Promise<ThaiLocation[]> {
  const syncFound = extractMentionedLocationsSync(userMessage);
  if (syncFound.length > 0) return syncFound;

  const candidatePlace = stripQuestionNoise(userMessage);
  if (candidatePlace.length >= 2 && candidatePlace.length <= 40) {
    const osmLoc = await resolveSinglePlaceByText(candidatePlace);
    if (osmLoc) {
      return [osmLoc];
    }
  }

  return [];
}

function parseRouteRawNames(cleanMsg: string): { rawA: string; rawB: string; onlyDest?: string } | null {
  const fromToRegex =
    /(?:เดินทาง|ขับรถ|ขี่รถ|วิ่ง|นั่งรถ)?\s*จาก\s*([^\s,]+(?:\s+[^\s,]+){0,3}?)\s*(?:ไป|ไปยัง|ไปที่|ไปแถว|มุ่งหน้าไป|มุ่งหน้า|ถึง)\s*([^\s,?]+(?:\s+[^\s,?]+){0,3})/i;
  const match1 = cleanMsg.match(fromToRegex);

  let rawA = '';
  let rawB = '';

  if (match1) {
    rawA = match1[1].trim();
    rawB = match1[2].trim();
  } else {
    const simpleToRegex =
      /^([^\s,?]+(?:\s+[^\s,?]+){0,2}?)\s+(?:ไป|ไปยัง|ไปแถว|ถึง)\s+([^\s,?]+(?:\s+[^\s,?]+){0,3})/i;
    const match2 = cleanMsg.match(simpleToRegex);
    if (match2) {
      const candidateA = match2[1]
        .replace(/^(เดินทาง|ขับรถ|ถ้าจะ|อยาก|ช่วยเช็ค|เช็ค|ดู|แถว)\s*/i, '')
        .trim();
      const ignoredStarters = ['จะ', 'อยาก', 'กำลังจะ', 'ถ้า', 'ช่วย', 'ฝน', 'น้ำ', 'รถ'];
      if (candidateA && !ignoredStarters.includes(candidateA)) {
        rawA = candidateA;
        rawB = match2[2].trim();
      }
    }
  }

  if (!rawA && !rawB) {
    const onlyDestRegex =
      /(?:เดินทางไป|ขับรถไป|จะไป|กำลังไป|วิ่งไป|มุ่งหน้าไป|แล้วถ้าไป|ถ้าไป|ต่อไป|วิ่งต่อไป|จากตรงนั้นไป|จากแถวนั้นไป)\s*([^\s,?]+(?:\s+[^\s,?]+){0,2})/i;
    const match3 = cleanMsg.match(onlyDestRegex);
    if (match3) {
      const candidateB = match3[1]
        .replace(/(รถติดไหม|น้ำท่วมไหม|ฝนตกไหม|ดีไหม|ได้ไหม|ล่ะ|ครับ|ค่ะ).*$/i, '')
        .trim();
      if (candidateB.length >= 2) {
        return { rawA: '', rawB: '', onlyDest: candidateB };
      }
    }
    return null;
  }

  rawB = rawB
    .replace(
      /\s*(รถติดไหม|ติดไหม|มีน้ำท่วมไหม|น้ำท่วมไหม|ท่วมไหม|ฝนตกไหม|ฝนจะตกไหม|ไปได้ไหม|ผ่านได้ไหม|เป็นยังไง|เป็นไง|ดีไหม|และฝนจะตกกี่โมง|ครับ|ค่ะ).*$/i,
      ''
    )
    .trim();

  if (!rawA || !rawB) return null;
  return { rawA, rawB };
}

function detectRouteQuerySync(
  userMessage: string,
  fallbackOrigin: ThaiLocation
): {
  origin: ThaiLocation;
  destination: ThaiLocation;
  corridorLocations: ThaiLocation[];
} | null {
  const parsed = parseRouteRawNames(userMessage.trim());
  if (!parsed) return null;

  if (parsed.onlyDest) {
    const destLoc = resolveSinglePlaceSync(parsed.onlyDest);
    if (destLoc && destLoc.id !== fallbackOrigin.id) {
      const corridor = buildIntermediateCorridorPoints(fallbackOrigin, destLoc);
      return {
        origin: fallbackOrigin,
        destination: destLoc,
        corridorLocations: [fallbackOrigin, ...corridor, destLoc]
      };
    }
    return null;
  }

  const locA = resolveSinglePlaceSync(parsed.rawA);
  const locB = resolveSinglePlaceSync(parsed.rawB);
  if (!locA || !locB) return null;

  const corridor = buildIntermediateCorridorPoints(locA, locB);
  return {
    origin: locA,
    destination: locB,
    corridorLocations: [locA, ...corridor, locB]
  };
}

async function detectAndResolveRouteQuery(
  userMessage: string,
  fallbackOrigin: ThaiLocation
): Promise<{
  origin: ThaiLocation;
  destination: ThaiLocation;
  corridorLocations: ThaiLocation[];
} | null> {
  const syncRoute = detectRouteQuerySync(userMessage, fallbackOrigin);
  if (syncRoute) return syncRoute;

  const parsed = parseRouteRawNames(userMessage.trim());
  if (!parsed) return null;

  if (parsed.onlyDest) {
    const destLoc = await resolveSinglePlaceByText(parsed.onlyDest);
    if (destLoc && destLoc.id !== fallbackOrigin.id) {
      const corridor = buildIntermediateCorridorPoints(fallbackOrigin, destLoc);
      return {
        origin: fallbackOrigin,
        destination: destLoc,
        corridorLocations: [fallbackOrigin, ...corridor, destLoc]
      };
    }
    return null;
  }

  const [locA, locB] = await Promise.all([
    resolveSinglePlaceByText(parsed.rawA),
    resolveSinglePlaceByText(parsed.rawB)
  ]);

  if (!locA || !locB) return null;

  const corridor = buildIntermediateCorridorPoints(locA, locB);
  return {
    origin: locA,
    destination: locB,
    corridorLocations: [locA, ...corridor, locB]
  };
}

function buildIntermediateCorridorPoints(
  origin: ThaiLocation,
  destination: ThaiLocation
): ThaiLocation[] {
  const totalDist = calculateDistanceKm(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng
  );
  if (totalDist < 3.0) return [];

  const candidates: Array<{ loc: ThaiLocation; distFromOrigin: number; perpDist: number }> = [];

  for (const seg of CURATED_ROAD_SEGMENTS) {
    const dOrigin = calculateDistanceKm(origin.lat, origin.lng, seg.lat, seg.lng);
    const dDest = calculateDistanceKm(destination.lat, destination.lng, seg.lat, seg.lng);

    if (dOrigin < 1.5 || dDest < 1.5) continue;

    if (dOrigin + dDest <= totalDist * 1.3) {
      const detour = dOrigin + dDest - totalDist;
      candidates.push({
        loc: roadSegmentToLocation(seg),
        distFromOrigin: dOrigin,
        perpDist: detour
      });
    }
  }

  candidates.sort((a, b) => a.perpDist - b.perpDist || a.distFromOrigin - b.distFromOrigin);

  // คัดเฉพาะจุดกึ่งกลางที่สำคัญที่สุด 1 จุด เพื่อไม่ให้ข้อมูลระหว่างทางเยอะเกินไป
  if (candidates.length > 0) {
    return [candidates[0].loc];
  }

  if (totalDist >= 10) {
    const midLat = (origin.lat + destination.lat) / 2;
    const midLng = (origin.lng + destination.lng) / 2;
    const midTambon = findNearestTambonByCoords(midLat, midLng);
    if (midTambon.id !== origin.id && midTambon.id !== destination.id) {
      return [midTambon];
    }
  }

  return [];
}

function detectTargetHourFromQuestion(userMessage: string): number | null {
  const m = userMessage
    .toLowerCase()
    .replace(/หนึ่ง/g, '1')
    .replace(/สอง/g, '2')
    .replace(/สาม/g, '3')
    .replace(/สี่/g, '4')
    .replace(/ห้า/g, '5')
    .replace(/หก/g, '6')
    .replace(/เจ็ด/g, '7')
    .replace(/แปด/g, '8')
    .replace(/เก้า/g, '9')
    .replace(/สิบเอ็ด/g, '11')
    .replace(/สิบ/g, '10');

  const inHoursMatch = m.match(/อีก\s*(\d+)\s*(?:ชม|ชั่วโมง)/);
  if (inHoursMatch) {
    const addH = Number(inHoursMatch[1]);
    if (addH >= 1 && addH <= 12) {
      return (new Date().getHours() + addH) % 24;
    }
  }

  const baaMatch = m.match(/บ่าย\s*(\d+)/);
  if (baaMatch) {
    const n = Number(baaMatch[1]);
    if (n >= 1 && n <= 5) return 12 + n;
  }
  if (m.includes('บ่ายโมง')) return 13;
  if (m.includes('เที่ยงคืน')) return 0;
  if (m.includes('เที่ยง')) return 12;

  const eveningMatch = m.match(/(\d+)\s*โมงเย็น/);
  if (eveningMatch) {
    const n = Number(eveningMatch[1]);
    if (n >= 4 && n <= 6) return 12 + n;
  }

  const thumMatch = m.match(/(\d+)\s*ทุ่ม/);
  if (thumMatch) {
    const n = Number(thumMatch[1]);
    if (n >= 1 && n <= 5) return 18 + n;
  }
  if (m.includes('ทุ่มนึง')) return 19;

  const morningMatch = m.match(/(\d+)\s*โมงเช้า/);
  if (morningMatch) {
    const n = Number(morningMatch[1]);
    if (n >= 6 && n <= 11) return n;
  }

  const clockMatch = m.match(/(\d{1,2})[:.](\d{2})/);
  if (clockMatch) {
    const h = Number(clockMatch[1]);
    if (h >= 0 && h <= 23) return h;
  }

  if (m.includes('บ่ายนี้') || m.includes('ช่วงบ่าย')) return 14;
  if (m.includes('เย็นนี้') || m.includes('ช่วงเย็น') || m.includes('เลิกงาน')) return 17;
  if (m.includes('ค่ำนี้') || m.includes('คืนนี้') || m.includes('หัวค่ำ')) return 20;
  if (m.includes('เช้านี้') || m.includes('ช่วงเช้า') || m.includes('พรุ่งนี้เช้า')) return 8;

  return null;
}

/**
 * คำนวณช่วงเวลาที่เหมาะสมที่สุดในการเดินทาง (Best Departure Time Advisor) จากพยากรณ์ 12 ชม. ข้างหน้า
 */
function computeBestTravelWindowLine(status: LocationRealtimeStatus): string {
  const detailed =
    status.hourly24hDetailed && status.hourly24hDetailed.length > 0
      ? status.hourly24hDetailed.slice(0, 10)
      : status.hourlyForecast.slice(0, 8);

  if (detailed.length === 0) {
    return 'สามารถเดินทางได้ตามปกติ';
  }

  let bestPt = detailed[0];
  let minRiskScore = Infinity;

  for (const pt of detailed) {
    const h = pt.hour24 ?? 12;
    const isPeakRush = (h >= 7 && h <= 9) || (h >= 16 && h <= 19);
    const rushPenalty = isPeakRush ? 22 : 0;
    const riskScore = pt.rainProbPercent + pt.precipMm * 15 + rushPenalty;
    if (riskScore < minRiskScore) {
      minRiskScore = riskScore;
      bestPt = pt;
    }
  }

  const h24 = bestPt.hour24 ?? 12;
  const col = formatColloquialThaiHour(h24);
  return `ช่วงเวลาเดินทางที่ดีที่สุด: ${col.shortName} (${String(h24).padStart(2, '0')}:00 น.) โอกาสฝนเพียง ${bestPt.rainProbPercent}% และรถคล่องตัว`;
}

/**
 * ดึงบริบทการสนทนาต่อเนื่องจาก "คำถามและคำตอบก่อนหน้าล่าสุดของผู้ใช้งาน" (เหมือนความสามารถของ Gemini)
 * โดยอ่านจาก conversationContext ที่บันทึกสะสมไว้ในคำตอบก่อนหน้า ทำให้ถามต่อยอดกี่ครั้งก็ไม่หลุดประเด็น!
 */
function extractLastConversationContext(chatHistory: AiChatMessage[] = []): {
  lastUserQuestion: string | null;
  lastAssistantHeadline: string | null;
  lastShortContextTitle: string | null;
  lastLocations: ThaiLocation[];
  isLastRoute: boolean;
  lastTopicFocus: QuestionTopicFocus | null;
  lastTargetHour: number | null;
} {
  let lastAssistantMsg: AiChatMessage | null = null;
  let lastAssistantIdx = -1;

  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const msg = chatHistory[i];
    if (msg.role === 'assistant' && msg.id !== 'welcome-init') {
      lastAssistantMsg = msg;
      lastAssistantIdx = i;
      break;
    }
  }

  let lastUserQuestion: string | null = null;
  if (lastAssistantIdx > 0) {
    for (let i = lastAssistantIdx - 1; i >= 0; i--) {
      if (chatHistory[i].role === 'user') {
        lastUserQuestion = chatHistory[i].text;
        break;
      }
    }
  }

  if (lastAssistantMsg?.conversationContext) {
    const ctx = lastAssistantMsg.conversationContext;
    return {
      lastUserQuestion: lastUserQuestion || ctx.userQuestion,
      lastAssistantHeadline: lastAssistantMsg.quickVerdict?.headline || lastAssistantMsg.text,
      lastShortContextTitle: ctx.shortContextTitle,
      lastLocations: ctx.resolvedLocations,
      isLastRoute: ctx.isRoute,
      lastTopicFocus: ctx.resolvedTopicFocus,
      lastTargetHour: ctx.resolvedTargetHour
    };
  }

  const lastTopicFocus = lastUserQuestion ? detectQuestionTopicFocus(lastUserQuestion, null) : null;
  const lastTargetHour = lastUserQuestion ? detectTargetHourFromQuestion(lastUserQuestion) : null;

  if (lastAssistantMsg && lastAssistantMsg.placeCards && lastAssistantMsg.placeCards.length > 0) {
    return {
      lastUserQuestion,
      lastAssistantHeadline: lastAssistantMsg.quickVerdict?.headline || lastAssistantMsg.text,
      lastShortContextTitle: lastAssistantMsg.targetScopeLabel || null,
      lastLocations: lastAssistantMsg.placeCards.map((c) => c.location),
      isLastRoute:
        lastAssistantMsg.queryType === 'route_a_to_b' &&
        lastAssistantMsg.placeCards.length >= 2,
      lastTopicFocus,
      lastTargetHour
    };
  }

  return {
    lastUserQuestion,
    lastAssistantHeadline: null,
    lastShortContextTitle: null,
    lastLocations: [],
    isLastRoute: false,
    lastTopicFocus,
    lastTargetHour
  };
}

/**
 * สร้างปุ่มคำถามต่อเนื่องที่โฟกัสเฉพาะสถานที่/เส้นทาง และประเด็นของคำถามก่อนหน้าที่ผู้ใช้เพิ่งถามเท่านั้น
 */
function buildFocusedFollowUpSuggestions(params: {
  focus: QuestionTopicFocus;
  targetHour: number | null;
  shortPrimaryName: string;
  isRoute?: boolean;
  shortOriginName?: string;
  shortDestName?: string;
}): string[] {
  const { focus, targetHour, shortPrimaryName, isRoute, shortOriginName, shortDestName } = params;

  if (isRoute && shortOriginName && shortDestName) {
    if (focus.asksBestTime) {
      return [
        `เส้นทาง ${shortOriginName} ไป ${shortDestName} มีจุดน้ำท่วมขังไหม?`,
        `ระหว่างทาง ${shortOriginName} ไป ${shortDestName} ฝนจะตกกี่โมง?`,
        `แล้วขากลับจาก ${shortDestName} มา ${shortOriginName} รถติดไหม?`
      ];
    }
    if (focus.mode === 'traffic_only') {
      return [
        `จาก ${shortOriginName} ไป ${shortDestName} ควรออกเดินทางกี่โมงดี?`,
        `เส้นทาง ${shortOriginName} ไป ${shortDestName} มีจุดน้ำท่วมขังไหม?`,
        `แล้วขากลับจาก ${shortDestName} มา ${shortOriginName} รถติดไหม?`
      ];
    }
    if (focus.mode === 'flood_only') {
      return [
        `เส้นทาง ${shortOriginName} ไป ${shortDestName} ตอนนี้รถติดไหม?`,
        `ระหว่างทาง ${shortOriginName} ไป ${shortDestName} ฝนจะตกเพิ่มกี่โมง?`,
        `แล้วขากลับจาก ${shortDestName} มา ${shortOriginName} น้ำท่วมไหม?`
      ];
    }
    if (focus.mode === 'rain_only') {
      return [
        `จาก ${shortOriginName} ไป ${shortDestName} ควรออกเดินทางกี่โมงดีถึงไม่เจอฝน?`,
        `เส้นทาง ${shortOriginName} ไป ${shortDestName} ตอนนี้น้ำท่วมขังไหม?`,
        `เส้นทาง ${shortOriginName} ไป ${shortDestName} ตอนนี้รถติดไหม?`
      ];
    }
    return [
      `จาก ${shortOriginName} ไป ${shortDestName} ควรออกเดินทางกี่โมงดี?`,
      `ระหว่างทาง ${shortOriginName} ไป ${shortDestName} ฝนจะตกกี่โมง?`,
      `แล้วขากลับจาก ${shortDestName} มา ${shortOriginName} รถติดไหม?`
    ];
  }

  if (focus.asksBestTime) {
    return [
      `แถว ${shortPrimaryName} ตอนนี้น้ำท่วมขังไหม รถเล็กผ่านได้ไหม?`,
      `แล้วช่วงเย็น (17:00 น.) แถว ${shortPrimaryName} ฝนตกไหม?`,
      `แถว ${shortPrimaryName} ตอนนี้รถติดไหม?`
    ];
  }

  if (focus.mode === 'rain_only') {
    const nextTimeQuestion =
      targetHour === 17
        ? `แล้วช่วงค่ำ (20:00 น.) แถว ${shortPrimaryName} ฝนตกไหม?`
        : targetHour === 14
          ? `แล้วช่วงเย็น (17:00 น.) แถว ${shortPrimaryName} ฝนตกไหม?`
          : `แล้วบ่าย 2 โมง (14:00 น.) แถว ${shortPrimaryName} ฝนตกไหม?`;
    return [
      nextTimeQuestion,
      `แถว ${shortPrimaryName} ควรออกเดินทางกี่โมงดี?`,
      `แถว ${shortPrimaryName} ตอนนี้น้ำท่วมขังไหม รถเล็กผ่านได้ไหม?`
    ];
  }

  if (focus.mode === 'flood_only') {
    if (focus.asksVehiclePass) {
      return [
        `แถว ${shortPrimaryName} ควรออกเดินทางกี่โมงดี?`,
        `วันนี้แถว ${shortPrimaryName} ฝนจะตกเพิ่มกี่โมง?`,
        `แถว ${shortPrimaryName} ตอนนี้รถติดไหม?`
      ];
    }
    return [
      `แถว ${shortPrimaryName} รถเก๋งและมอเตอร์ไซค์ผ่านได้ปกติไหม?`,
      `วันนี้แถว ${shortPrimaryName} ฝนจะตกเพิ่มกี่โมง?`,
      `แถว ${shortPrimaryName} ตอนนี้รถติดไหม?`
    ];
  }

  if (focus.mode === 'traffic_only') {
    return [
      `แถว ${shortPrimaryName} ควรออกเดินทางกี่โมงดีรถไม่ติด?`,
      `แถว ${shortPrimaryName} ตอนนี้มีน้ำท่วมขังบนผิวจราจรไหม?`,
      `วันนี้แถว ${shortPrimaryName} ฝนจะตกกี่โมง?`
    ];
  }

  return [
    `แถว ${shortPrimaryName} ตอนนี้น้ำท่วมไหม รถเล็กผ่านได้ไหม?`,
    `แถว ${shortPrimaryName} ควรออกเดินทางกี่โมงดี?`,
    `วันนี้แถว ${shortPrimaryName} ฝนจะตกกี่โมง?`
  ];
}

/**
 * แนะนำคำถามและสถานที่อัตฉริยะแบบสดขณะกำลังพิมพ์ (0ms Live Smart Autocomplete)
 */
export function getLiveSmartTypingSuggestions(
  partialInput: string,
  activeLocations: ThaiLocation[] = []
): string[] {
  const clean = partialInput.trim();
  if (clean.length < 2) return [];
  const lower = clean.toLowerCase();

  const suggestions: string[] = [];
  const pushUnique = (s: string) => {
    if (!suggestions.includes(s) && suggestions.length < 4) {
      suggestions.push(s);
    }
  };

  for (const alias of COLLOQUIAL_PLACE_ALIASES) {
    if (
      alias.label.toLowerCase().includes(lower) ||
      alias.keywords.some((k) => k.toLowerCase().includes(lower))
    ) {
      const shortName = alias.label.split('(')[0].trim();
      pushUnique(`${shortName} ตอนนี้รถติดไหม น้ำท่วมไหม?`);
      pushUnique(`${shortName} วันนี้ฝนจะตกกี่โมง?`);
    }
    if (suggestions.length >= 4) break;
  }

  if (suggestions.length < 4) {
    const anchor = resolveQueryProximityAnchor(clean);
    if (anchor && anchor.matchedSegments.length > 0) {
      const seg = anchor.matchedSegments[0];
      const title = seg.placeName || seg.segmentTitle.split('(')[0].trim();
      pushUnique(`${title} ตอนนี้รถติดไหม น้ำท่วมไหม?`);
      pushUnique(`${title} วันนี้ฝนจะตกกี่โมง และออกเดินทางกี่โมงดี?`);
    }
  }

  if (suggestions.length === 0 && activeLocations[0]) {
    const originShort = activeLocations[0].name.split(/—|\(/)[0].trim();
    pushUnique(`${clean} ตอนนี้รถติดไหม น้ำท่วมไหม?`);
    pushUnique(`${clean} วันนี้ฝนจะตกกี่โมง?`);
    pushUnique(`จาก ${originShort} ไป ${clean} รถติดไหม?`);
  }

  return suggestions.slice(0, 4);
}

export function buildRainPredictionForStatus(
  status: LocationRealtimeStatus,
  targetHour: number | null = null
): AiRainPredictionItem {
  const detailed =
    status.hourly24hDetailed && status.hourly24hDetailed.length > 0
      ? status.hourly24hDetailed
      : status.hourlyForecast;

  const shortPlace = status.location.name
    .replace(/\s*\(.*?\)/g, '')
    .split(/—|•|-/)[0]
    .trim();

  // หาช่วงเวลาที่โอกาสฝนสูงสุดของวันนี้เสมอไว้เปรียบเทียบ
  const upcoming18 = detailed.slice(0, 18);
  let peakPoint: HourlyForecastPoint | undefined;
  let maxScore = -1;
  for (const pt of upcoming18) {
    const score = pt.rainProbPercent + pt.precipMm * 12;
    if (score > maxScore) {
      maxScore = score;
      peakPoint = pt;
    }
  }

  let chosenPoint: HourlyForecastPoint | undefined;
  if (targetHour !== null) {
    chosenPoint = detailed.find((p) => p.hour24 === targetHour);
  }
  if (!chosenPoint) {
    chosenPoint = peakPoint;
  }

  const fallbackHour = targetHour ?? (new Date().getHours() + 2) % 24;
  const chosenHour24 = chosenPoint?.hour24 ?? fallbackHour;
  const col = formatColloquialThaiHour(chosenHour24);
  const prob = chosenPoint ? chosenPoint.rainProbPercent : status.rainProbabilityPercent;
  const precip = chosenPoint ? chosenPoint.precipMm : status.rainMmPerHour;
  const temp = chosenPoint ? chosenPoint.tempC : status.tempC;

  let rainEasyLabel = 'ไม่มีฝน ท้องฟ้าโปร่ง';
  if (precip >= 4.0 || (prob >= 75 && precip >= 1.5)) {
    rainEasyLabel = 'ฝนตกหนัก';
  } else if (precip >= 1.0 || prob >= 60) {
    rainEasyLabel = 'ฝนตกปานกลาง';
  } else if (precip >= 0.2 || prob >= 40) {
    rainEasyLabel = 'มีโอกาสฝนปรอยๆ';
  } else if (status.rainMmPerHour > 0) {
    rainEasyLabel = 'กำลังมีฝนตกในพื้นที่';
  }

  const cleanHighlight =
    prob >= 35 || precip > 0
      ? `${shortPlace} ${col.shortName} (${String(chosenHour24).padStart(2, '0')}:00 น.) ${rainEasyLabel} โอกาสเกิด ${prob}%`
      : `${shortPlace} ช่วง${col.shortName} (${String(chosenHour24).padStart(2, '0')}:00 น.) ท้องฟ้าโปร่ง โอกาสเกิดฝนเพียง ${prob}%`;

  const peakCol = formatColloquialThaiHour(peakPoint?.hour24 ?? chosenHour24);
  const peakProb = peakPoint ? peakPoint.rainProbPercent : prob;
  const peakTodayLine =
    peakProb >= 35
      ? `ช่วงที่มีโอกาสฝนสูงสุดวันนี้คือ ${peakCol.shortName} (${String(peakPoint?.hour24 ?? chosenHour24).padStart(2, '0')}:00 น.) โอกาส ${peakProb}%`
      : `ตลอดวันนี้ท้องฟ้าค่อนข้างโปร่ง โอกาสเกิดฝนสูงสุดเพียง ${peakProb}% (${peakCol.shortName})`;

  const hourlyTimeline = detailed.slice(0, 8).map((pt) => {
    const hCol = formatColloquialThaiHour(pt.hour24 ?? 12);
    return {
      colloquial: hCol.shortName,
      clock: pt.timeLabel,
      prob: pt.rainProbPercent,
      rainText:
        pt.rainProbPercent >= 70 || pt.precipMm >= 3.5
          ? 'ฝนตกหนัก'
          : pt.rainProbPercent >= 50 || pt.precipMm >= 0.8
            ? 'ฝนปานกลาง'
            : pt.rainProbPercent >= 35 || pt.precipMm > 0
              ? 'ฝนปรอยๆ'
              : 'ไม่มีฝน',
      tempC: pt.tempC
    };
  });

  return {
    locationName: status.location.name,
    shortPlaceName: shortPlace,
    timeColloquial: col.shortName,
    timeClock: `${String(chosenHour24).padStart(2, '0')}:00 น.`,
    rainLabel: rainEasyLabel,
    probabilityPercent: prob,
    precipMm: precip,
    tempC: temp,
    highlightLine: cleanHighlight,
    peakTodayLine,
    hourlyTimeline,
    location: status.location
  };
}

export function statusToSimplePlaceCard(
  status: LocationRealtimeStatus,
  roleLabel?: string,
  targetHour: number | null = null
): AiSimplePlaceCard {
  const rainPred = buildRainPredictionForStatus(status, targetHour);

  let trafficEasyText = 'คล่องตัว ขับสบาย ไม่เสียเวลาเพิ่ม';
  if (status.trafficStatus.colorCode === 'red') {
    trafficEasyText = `รถติดขัด (${status.trafficStatus.delayEstimateText})`;
  } else if (status.trafficStatus.colorCode === 'yellow') {
    trafficEasyText = `ชะลอตัวบางช่วง พอไหลไปได้ (${status.trafficStatus.delayEstimateText})`;
  }

  let waterEasyText = 'ไม่มีน้ำท่วมขัง ถนนแห้งปกติ';
  let vehicleEasyAdvice = 'มอเตอร์ไซค์และรถเก๋งผ่านได้สบาย';

  if (status.waterSafetyTier === 'critical') {
    waterEasyText = 'มีน้ำท่วมสูง/น้ำล้นตลิ่งในจุดลุ่มต่ำ ห้ามฝ่า';
    vehicleEasyAdvice = 'งดนำรถทุกชนิดผ่านจุดน้ำท่วมสูง ให้ใช้ทางยกระดับ/ถนนสายหลัก';
  } else if (status.waterSafetyTier === 'danger') {
    waterEasyText = 'มีน้ำท่วมขังระดับครึ่งแข้งในซอยต่ำ/ช่องซ้าย';
    vehicleEasyAdvice = 'รถเก๋งและมอเตอร์ไซค์ควรเลี่ยงซอยต่ำ (วิ่งช่องขวาบนถนนใหญ่)';
  } else if (status.waterSafetyTier === 'watch') {
    waterEasyText = 'ถนนสายหลักแห้งปกติ (เฝ้าระวังน้ำรอระบายริมทาง)';
    vehicleEasyAdvice = 'รถเก๋งและมอเตอร์ไซค์ผ่านถนนสายหลักได้ปกติ';
  }

  return {
    id: status.location.id,
    roleLabel,
    placeTitle: status.location.name.split(/—/)[0].trim(),
    areaSubtitle: `${status.location.tambon} ${status.location.amphoe} จ.${status.location.province}`,
    trafficColor: status.trafficStatus.colorCode,
    trafficEasyText,
    waterTier: status.waterSafetyTier,
    waterEasyText,
    vehicleEasyAdvice,
    rainPredictionLine: rainPred.highlightLine,
    currentWeatherEasy: `ตอนนี้ ${status.tempC}°C • ${status.weatherHeadline}`,
    location: status.location,
    status
  };
}

function getOverviewRepresentativeLocations(activeLocations: ThaiLocation[]): ThaiLocation[] {
  const list: ThaiLocation[] = [];
  const seen = new Set<string>();

  const pushUnique = (loc: ThaiLocation) => {
    const key = `${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push(loc);
    }
  };

  for (const loc of activeLocations.slice(0, 1)) {
    pushUnique(loc);
  }

  const keyAliases = [
    'ดอนเมือง',
    'อนุสรณ์สถาน',
    'ฟิวเจอร์รังสิต',
    'แจ้งวัฒนะ',
    'ลาดพร้าว',
    'สยาม',
    'บางนา',
    'พระราม 2'
  ];

  for (const kw of keyAliases) {
    const foundAlias = COLLOQUIAL_PLACE_ALIASES.find((a) => a.keywords.includes(kw));
    if (foundAlias) {
      pushUnique(aliasToThaiLocation(foundAlias));
    }
    if (list.length >= 6) break;
  }

  return list;
}

/**
 * สร้างคำตอบสำหรับเส้นทาง A -> B (เจาะจงเฉพาะสิ่งที่ถามบนเส้นทาง A -> B พร้อมข้อความเสียงสรุปตรงประเด็นและบริบทต่อเนื่องแบบ Gemini)
 */
function buildRouteAiMessageFromStatuses(
  cleanMsg: string,
  routeDetected: {
    origin: ThaiLocation;
    destination: ThaiLocation;
    corridorLocations: ThaiLocation[];
  },
  statuses: LocationRealtimeStatus[],
  targetHour: number | null,
  customShortText?: string,
  overrideFocus?: QuestionTopicFocus,
  followUpMeta?: {
    isFollowUpContinuation: boolean;
    previousQuestion?: string | null;
    isReturnTrip?: boolean;
  }
): AiChatMessage {
  const focus = overrideFocus || detectQuestionTopicFocus(cleanMsg);
  const originStatus = statuses[0];
  const destStatus = statuses[statuses.length - 1];
  const totalDistKm = Number(
    calculateDistanceKm(
      routeDetected.origin.lat,
      routeDetected.origin.lng,
      routeDetected.destination.lat,
      routeDetected.destination.lng
    ).toFixed(1)
  );

  const placeCards: AiSimplePlaceCard[] = statuses.map((st, idx) => {
    const role =
      idx === 0
        ? 'จุดเริ่มต้น (A)'
        : idx === statuses.length - 1
          ? 'ปลายทาง (B)'
          : 'จุดผ่านระหว่างทาง';
    return statusToSimplePlaceCard(st, role, targetHour);
  });

  const rainPredictions = statuses.map((st) => buildRainPredictionForStatus(st, targetHour));

  const hasDangerFlood = statuses.some(
    (s) => s.waterSafetyTier === 'critical' || s.waterSafetyTier === 'danger'
  );
  const hasWatchFlood = statuses.some((s) => s.waterSafetyTier === 'watch');
  const redTrafficPoints = statuses.filter((s) => s.trafficStatus.colorCode === 'red');
  const yellowTrafficPoints = statuses.filter((s) => s.trafficStatus.colorCode === 'yellow');

  const shortOriginName = originStatus.location.name.split(/—|\(/)[0].trim();
  const shortDestName = destStatus.location.name.split(/—|\(/)[0].trim();
  const bestWindowLine = computeBestTravelWindowLine(originStatus);

  const overallTrafficText =
    redTrafficPoints.length > 0
      ? `🔴 รถติดขัดช่วง ${redTrafficPoints.map((r) => r.location.name.split(/—|-|\(/)[0].trim()).join(', ')} (+15-25 นาที)`
      : yellowTrafficPoints.length > 0
        ? `🟡 ชะลอตัวช่วง ${yellowTrafficPoints.map((r) => r.location.name.split(/—|-|\(/)[0].trim()).join(', ')} (+5-10 นาที)`
        : '🟢 คล่องตัวตลอดสาย ไม่เสียเวลาเพิ่ม';

  const overallFloodText = hasDangerFlood
    ? '⚠️ มีจุดน้ำท่วมขังในซอยต่ำริมน้ำ (ให้วิ่งบนถนนใหญ่สายหลักเท่านั้น)'
    : hasWatchFlood
      ? '✅ ถนนสายหลักแห้งปกติ (เฝ้าระวังน้ำรอระบายริมทาง)'
      : '✅ ไม่มีน้ำท่วมขัง ถนนแห้งตลอดเส้นทาง';

  const canPassText = hasDangerFlood
    ? 'รถเก๋ง/มอเตอร์ไซค์ให้ใช้ถนนสายหลักเท่านั้น'
    : 'มอเตอร์ไซค์และรถเก๋งผ่านได้สบายตลอดสาย';

  const highestRainPred = [...rainPredictions].sort(
    (a, b) => b.probabilityPercent - a.probabilityPercent
  )[0];

  // คัดเฉพาะ Bullet ที่ตรงกับสิ่งที่ผู้ใช้ถามในเส้นทาง A -> B
  const essentialHighlights: AiEssentialBullet[] = [];
  if (focus.asksTraffic || focus.mode === 'multi') {
    essentialHighlights.push({
      icon: 'traffic',
      label: 'สภาพรถติด',
      value: overallTrafficText,
      tone: redTrafficPoints.length > 0 ? 'warning' : yellowTrafficPoints.length > 0 ? 'caution' : 'safe'
    });
  }
  if (focus.asksFlood || focus.mode === 'multi' || hasDangerFlood) {
    essentialHighlights.push({
      icon: 'water',
      label: 'น้ำท่วม & รถที่ผ่านได้',
      value: `${overallFloodText} (${canPassText})`,
      tone: hasDangerFlood ? 'warning' : hasWatchFlood ? 'caution' : 'safe'
    });
  }
  if (focus.asksRain || (focus.mode === 'multi' && (highestRainPred?.probabilityPercent ?? 0) >= 40)) {
    essentialHighlights.push({
      icon: 'rain',
      label: 'พยากรณ์ฝนระหว่างทาง',
      value: highestRainPred ? highestRainPred.highlightLine : 'ท้องฟ้าโปร่ง โอกาสเกิดฝนต่ำ',
      tone: (highestRainPred?.probabilityPercent ?? 0) >= 60 ? 'caution' : 'safe'
    });
  }

  const isCont = Boolean(followUpMeta?.isFollowUpContinuation);
  const routePrefix = followUpMeta?.isReturnTrip
    ? `ขากลับ ${shortOriginName} ➔ ${shortDestName}: `
    : isCont
      ? `ต่อเนื่องเส้นทาง ${shortOriginName} ➔ ${shortDestName}: `
      : `${shortOriginName} ➔ ${shortDestName}: `;

  let headline = routePrefix;
  let conciseOneLiner = `ระยะทาง ~${totalDistKm} กม. • ${canPassText}`;
  let spokenAnswerText = '';

  if (focus.asksBestTime) {
    headline += bestWindowLine;
    conciseOneLiner = `${overallTrafficText} • ${canPassText}`;
    spokenAnswerText = `สำหรับการเดินทางจาก ${shortOriginName} ไป ${shortDestName} ${bestWindowLine} ตลอดเส้นทาง${canPassText}ครับ`;
  } else if (focus.mode === 'traffic_only') {
    headline += overallTrafficText;
    conciseOneLiner = `ระยะทาง ~${totalDistKm} กม. • ${bestWindowLine}`;
    spokenAnswerText = `${followUpMeta?.isReturnTrip ? 'ส่วนขากลับ' : 'สำหรับการเดินทาง'}จาก ${shortOriginName} ไป ${shortDestName} ระยะทางประมาณ ${totalDistKm} กิโลเมตร สภาพจราจรตอนนี้ ${overallTrafficText} ครับ`;
  } else if (focus.mode === 'flood_only') {
    headline += overallFloodText;
    conciseOneLiner = `${canPassText} (ระยะทาง ~${totalDistKm} กม.)`;
    spokenAnswerText = `ตลอดเส้นทางจาก ${shortOriginName} ไป ${shortDestName} ${overallFloodText} ${canPassText}ครับ`;
  } else if (focus.mode === 'rain_only') {
    headline += highestRainPred ? highestRainPred.highlightLine : 'ไม่มีฝนตลอดเส้นทาง';
    conciseOneLiner = `ระยะทาง ~${totalDistKm} กม. • ${canPassText}`;
    spokenAnswerText = `พยากรณ์ฝนระหว่างทางจาก ${shortOriginName} ไป ${shortDestName} ${
      highestRainPred ? highestRainPred.highlightLine : 'ท้องฟ้าโปร่ง ไม่มีฝนตลอดเส้นทาง'
    } ครับ`;
  } else {
    headline += hasDangerFlood
      ? 'ใช้ถนนสายหลักผ่านได้ (เลี่ยงซอยต่ำ)'
      : redTrafficPoints.length > 0
        ? 'ถนนแห้งไม่ท่วม • มีรถติดบางช่วง'
        : 'เดินทางได้สบาย! ถนนแห้ง รถคล่องตัว';
    spokenAnswerText = `${
      followUpMeta?.isReturnTrip ? 'สำหรับขากลับ' : 'สรุปเส้นทาง'
    }จาก ${shortOriginName} ไป ${shortDestName} ระยะทางประมาณ ${totalDistKm} กิโลเมตร ${overallFloodText} ${canPassText} ส่วนการจราจร ${overallTrafficText} ครับ`;
  }

  const detailedLines = [
    `รายละเอียดรายจุดบนเส้นทาง **${shortOriginName} ➔ ${shortDestName}** (~${totalDistKm} กม.):`,
    ...placeCards.map(
      (c) =>
        `• **${c.roleLabel} (${c.placeTitle}):** ${
          c.trafficColor === 'red' ? '🔴 ติดขัด' : c.trafficColor === 'yellow' ? '🟡 ชะลอตัว' : '🟢 คล่องตัว'
        } | ${c.waterEasyText} | ${c.rainPredictionLine}`
    )
  ];

  const shortContextTitle = `เส้นทาง ${shortOriginName} ➔ ${shortDestName}`;

  return {
    id: `ai-${Date.now()}`,
    role: 'assistant',
    targetScopeLabel: isCont
      ? `ต่อเนื่องจากคำถามก่อนหน้า • ${shortContextTitle} (~${totalDistKm} กม.)`
      : `${shortContextTitle} (~${totalDistKm} กม.)`,
    text: customShortText || conciseOneLiner,
    spokenAnswerText: customShortText ? `${headline} ${customShortText}` : spokenAnswerText,
    detailedText: detailedLines.join('\n'),
    essentialHighlights,
    timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    queryType: 'route_a_to_b',
    isFollowUpContinuation: isCont,
    previousQuestionRef: followUpMeta?.previousQuestion || undefined,
    conversationContext: {
      userQuestion: cleanMsg,
      shortContextTitle,
      resolvedTopicFocus: focus,
      resolvedTargetHour: targetHour,
      resolvedLocations: routeDetected.corridorLocations,
      isRoute: true
    },
    quickVerdict: {
      statusTone: hasDangerFlood
        ? 'warning'
        : redTrafficPoints.length > 0 || hasWatchFlood
          ? 'caution'
          : 'safe',
      headline,
      subtext: customShortText || conciseOneLiner
    },
    routeSummary: {
      originName: shortOriginName,
      destinationName: shortDestName,
      distanceKm: totalDistKm,
      overallTrafficText,
      overallFloodText,
      canPassText
    },
    rainPredictions,
    placeCards,
    followUpSuggestions: buildFocusedFollowUpSuggestions({
      focus,
      targetHour,
      shortPrimaryName: shortDestName,
      isRoute: true,
      shortOriginName,
      shortDestName
    })
  };
}

/**
 * สร้างคำตอบแบบเจาะจงตรงประเด็น (เฉพาะสถานที่ที่ถาม และเฉพาะหัวข้อที่ถาม พร้อมเชื่อมโยงคำถามต่อเนื่องแบบ Gemini และสคริปต์เสียงตรงประเด็น!)
 */
function buildPlaceOrOverviewAiMessageFromStatuses(
  cleanMsg: string,
  isUnspecifiedPlace: boolean,
  statuses: LocationRealtimeStatus[],
  targetHour: number | null,
  customShortText?: string,
  overrideFocus?: QuestionTopicFocus,
  followUpMeta?: {
    isFollowUpContinuation: boolean;
    previousQuestion?: string | null;
  }
): AiChatMessage {
  const focus = overrideFocus || detectQuestionTopicFocus(cleanMsg);
  const nationalReport = getNationwideSituationReport(cleanMsg, 'all_overview');
  const rainPredictions = statuses.map((st) => buildRainPredictionForStatus(st, targetHour));

  const sortedRainPredictions = isUnspecifiedPlace
    ? [...rainPredictions].sort(
        (a, b) => b.probabilityPercent + b.precipMm * 10 - (a.probabilityPercent + a.precipMm * 10)
      )
    : rainPredictions;

  // หากผู้ใช้ระบุสถานที่ชัดเจน หรือถามต่อเนื่องจากสถานที่เดิม ให้จำกัดการ์ดเฉพาะจุดนั้น (สูงสุด 1-2 จุด) เพื่อความตรงประเด็น
  const maxCards = isUnspecifiedPlace ? 4 : Math.min(statuses.length, 2);
  const placeCards = statuses.slice(0, maxCards).map((st, idx) =>
    statusToSimplePlaceCard(
      st,
      isUnspecifiedPlace
        ? idx === 0
          ? 'จุดที่คุณอยู่ตอนนี้'
          : `จุดเฝ้าระวังที่ ${idx}`
        : 'จุดที่คุณถาม',
      targetHour
    )
  );

  const primaryCard = placeCards[0];
  const shortPrimaryName = primaryCard.placeTitle.split('(')[0].trim();
  const topRain = sortedRainPredictions[0];
  const bestWindowLine = computeBestTravelWindowLine(primaryCard.status);

  const overflowCount = nationalReport.overflowWaterStations.length;
  const watchCount = nationalReport.watchWaterStations.length;
  const overflowShortNames = nationalReport.overflowWaterStations
    .slice(0, 3)
    .map((o) => `อ.${o.station.amphoe} จ.${o.station.province}`)
    .join(', ');

  const isCont = Boolean(followUpMeta?.isFollowUpContinuation);

  let targetScopeLabel = '';
  let conciseHeadline = '';
  let conciseSubtext = '';
  let essentialHighlights: AiEssentialBullet[] = [];
  let conciseText = '';
  let spokenAnswerText = '';
  let detailedText = '';

  if (isUnspecifiedPlace) {
    if (focus.mode === 'flood_only') {
      targetScopeLabel = 'เจาะจง: ตรวจสอบจุดน้ำท่วมขังและระดับน้ำล่าสุด';
      conciseHeadline =
        overflowCount > 0
          ? `ถนนสายหลักแห้งปกติ • พบจุดน้ำล้นตลิ่งริมคลอง/แม่น้ำ ${overflowCount} จุด`
          : `ตอนนี้ถนนสายหลักแห้งปกติ ไม่พบจุดน้ำท่วมขังบนผิวจราจรหลัก`;
      conciseSubtext =
        overflowCount > 0
          ? `จุดน้ำล้นตลิ่ง: ${overflowShortNames} • ส่วนแถว ${shortPrimaryName} ${primaryCard.waterEasyText}`
          : `แถว ${shortPrimaryName}: ${primaryCard.waterEasyText} (${primaryCard.vehicleEasyAdvice})`;

      spokenAnswerText =
        overflowCount > 0
          ? `สรุปสถานการณ์น้ำท่วมตอนนี้ ถนนสายหลักแห้งปกติ แต่พบจุดน้ำล้นตลิ่งริมแม่น้ำ ${overflowCount} จุด ได้แก่ ${overflowShortNames} ส่วนบริเวณ ${shortPrimaryName} ${primaryCard.waterEasyText}ครับ`
          : `สรุปสถานการณ์น้ำท่วมตอนนี้ ถนนสายหลักแห้งปกติ ไม่พบจุดน้ำท่วมขังบนผิวจราจรหลัก บริเวณ ${shortPrimaryName} ${primaryCard.vehicleEasyAdvice}ครับ`;

      essentialHighlights = [
        {
          icon: 'water',
          label: `พื้นที่ของคุณ (${shortPrimaryName})`,
          value: `${primaryCard.waterEasyText} • ${primaryCard.vehicleEasyAdvice}`,
          tone:
            primaryCard.waterTier === 'critical' || primaryCard.waterTier === 'danger'
              ? 'warning'
              : 'safe'
        },
        {
          icon: 'water',
          label: 'จุดน้ำล้นตลิ่ง/เฝ้าระวังทั่วไทย',
          value:
            overflowCount > 0
              ? `พบน้ำล้นตลิ่ง ${overflowCount} จุด (${overflowShortNames}) และเฝ้าระวังน้ำมาก ${watchCount} จุด`
              : `ไม่พบสถานีน้ำล้นตลิ่ง (มีจุดเฝ้าระวังน้ำมาก ${watchCount} จุด ริมแม่น้ำสายหลัก)`,
          tone: overflowCount > 0 ? 'warning' : watchCount > 0 ? 'caution' : 'safe'
        }
      ];
      conciseText = conciseSubtext;
    } else if (focus.mode === 'traffic_only') {
      targetScopeLabel = 'เจาะจง: สรุปจุดรถติดและสภาพจราจรตอนนี้';
      const congestedCards = placeCards.filter((c) => c.trafficColor !== 'green');
      conciseHeadline =
        congestedCards.length > 0
          ? `จุดที่รถติด/ชะลอตัวตอนนี้: ${congestedCards
              .slice(0, 2)
              .map(
                (c) =>
                  `${c.placeTitle.split('(')[0].trim()} (${
                    c.trafficColor === 'red' ? '🔴 ติดขัด' : '🟡 ชะลอตัว'
                  })`
              )
              .join(', ')}`
          : `ตอนนี้ถนนสายหลักส่วนใหญ่ 🟢 คล่องตัว ขับสบาย`;
      conciseSubtext = `จุดที่คุณอยู่ (${shortPrimaryName}): ${primaryCard.trafficEasyText}`;
      spokenAnswerText = `${conciseHeadline} ส่วนบริเวณ ${shortPrimaryName} ตอนนี้ ${primaryCard.trafficEasyText}ครับ`;

      essentialHighlights = placeCards.slice(0, 3).map((c) => ({
        icon: 'traffic',
        label: c.placeTitle.split('(')[0].trim(),
        value: `${
          c.trafficColor === 'red'
            ? '🔴 รถติดขัด'
            : c.trafficColor === 'yellow'
              ? '🟡 ชะลอตัว'
              : '🟢 คล่องตัว'
        } — ${c.trafficEasyText}`,
        tone: c.trafficColor === 'red' ? 'warning' : c.trafficColor === 'yellow' ? 'caution' : 'safe'
      }));
      conciseText = conciseSubtext;
    } else if (focus.mode === 'rain_only') {
      targetScopeLabel =
        targetHour !== null
          ? `เจาะจง: พยากรณ์ฝนเวลา ${String(targetHour).padStart(2, '0')}:00 น.`
          : 'เจาะจง: อันดับพื้นที่โอกาสฝนตกสูงสุดวันนี้';
      conciseHeadline = topRain
        ? `โอกาสฝนสูงสุดวันนี้: ${topRain.highlightLine}`
        : primaryCard.rainPredictionLine;
      conciseSubtext =
        sortedRainPredictions.length > 1
          ? `รองลงมา: ${sortedRainPredictions[1].highlightLine}`
          : `จุดที่คุณอยู่ (${shortPrimaryName}): ${primaryCard.currentWeatherEasy}`;
      spokenAnswerText = `${conciseHeadline} ${conciseSubtext}ครับ`;

      essentialHighlights = sortedRainPredictions.slice(0, 3).map((rp, idx) => ({
        icon: 'rain',
        label: `อันดับ ${idx + 1} (${rp.shortPlaceName})`,
        value: `${rp.timeColloquial} (${rp.timeClock}) • ${rp.rainLabel} (โอกาสเกิด ${rp.probabilityPercent}%)`,
        tone: rp.probabilityPercent >= 60 ? 'caution' : 'safe'
      }));
      conciseText = conciseSubtext;
    } else {
      targetScopeLabel = `สรุปด่วนจุดที่คุณอยู่ (${shortPrimaryName}) และภาพรวม`;
      conciseHeadline = `${shortPrimaryName}: ${primaryCard.waterEasyText} • ${
        primaryCard.trafficColor === 'red'
          ? '🔴 รถติดขัด'
          : primaryCard.trafficColor === 'yellow'
            ? '🟡 ชะลอตัว'
            : '🟢 รถคล่องตัว'
      }`;
      conciseSubtext = `พยากรณ์ฝน: ${topRain ? topRain.highlightLine : primaryCard.rainPredictionLine}`;
      spokenAnswerText = `สรุปสถานการณ์บริเวณ ${shortPrimaryName} ตอนนี้ ${primaryCard.waterEasyText} การจราจร${primaryCard.status.trafficStatus.colorNameTh} ${primaryCard.trafficEasyText} และพยากรณ์ฝน ${
        topRain ? topRain.highlightLine : primaryCard.rainPredictionLine
      } ครับ`;

      essentialHighlights = [
        {
          icon: 'rain',
          label: 'พยากรณ์ฝนเด่นวันนี้',
          value: topRain ? topRain.highlightLine : primaryCard.rainPredictionLine,
          tone: (topRain?.probabilityPercent ?? 0) >= 60 ? 'caution' : 'safe'
        },
        {
          icon: 'traffic',
          label: `การจราจร (${shortPrimaryName})`,
          value: primaryCard.trafficEasyText,
          tone:
            primaryCard.trafficColor === 'red'
              ? 'warning'
              : primaryCard.trafficColor === 'yellow'
                ? 'caution'
                : 'safe'
        },
        {
          icon: 'water',
          label: 'สถานะน้ำท่วม',
          value: `${primaryCard.waterEasyText} (${primaryCard.vehicleEasyAdvice})`,
          tone:
            primaryCard.waterTier === 'critical' || primaryCard.waterTier === 'danger'
              ? 'warning'
              : 'safe'
        }
      ];
      conciseText = conciseSubtext;
    }

    detailedText = [
      `ข้อมูลขยายความเพิ่มเติม (จัดเรียงจากข้อมูลเรียลไทม์ในเว็บ):`,
      ...sortedRainPredictions.slice(0, 4).map((r) => `• 🌧️ ${r.highlightLine}`),
      ...placeCards
        .slice(0, 4)
        .map(
          (c) =>
            `• 🚗 **${c.placeTitle.split('(')[0].trim()}:** ${c.trafficEasyText} | ${c.waterEasyText}`
        )
    ].join('\n');
  } else {
    // กรณีผู้ใช้ระบุชื่อสถานที่ชัดเจน หรือเป็นการถามคำถามต่อเนื่องในพื้นที่เดิม (เหมือนเรื่องเดียวกันใน Gemini)
    const trafficDot =
      primaryCard.trafficColor === 'red'
        ? '🔴 รถติดขัด'
        : primaryCard.trafficColor === 'yellow'
          ? '🟡 ชะลอตัว'
          : '🟢 คล่องตัว';

    const contPrefix = isCont ? `ต่อเนื่องที่ ${shortPrimaryName}` : shortPrimaryName;

    if (focus.asksBestTime) {
      targetScopeLabel = isCont
        ? `ต่อเนื่องจากคำถามก่อนหน้า • เวลาเดินทางที่ดีที่สุด แถว${shortPrimaryName}`
        : `เจาะจง: แนะนำเวลาเดินทาง • ${shortPrimaryName}`;
      conciseHeadline = `${contPrefix}: ${bestWindowLine}`;
      conciseSubtext = `ตอนนี้จราจร ${trafficDot} (${primaryCard.trafficEasyText}) • ${primaryCard.waterEasyText}`;
      spokenAnswerText = `${
        isCont ? `ต่อเนื่องสำหรับบริเวณ ${shortPrimaryName} ครับ` : `สำหรับบริเวณ ${shortPrimaryName} ครับ`
      } ${bestWindowLine} ส่วนตอนนี้การจราจร${primaryCard.status.trafficStatus.colorNameTh} ${primaryCard.trafficEasyText}ครับ`;

      essentialHighlights = [
        {
          icon: 'traffic',
          label: `เวลาออกเดินทางที่แนะนำ (${shortPrimaryName})`,
          value: bestWindowLine,
          tone: 'safe'
        },
        {
          icon: 'traffic',
          label: 'สภาพจราจรตอนนี้',
          value: `${trafficDot} — ${primaryCard.trafficEasyText}`,
          tone:
            primaryCard.trafficColor === 'red'
              ? 'warning'
              : primaryCard.trafficColor === 'yellow'
                ? 'caution'
                : 'safe'
        }
      ];
      conciseText = conciseSubtext;
    } else if (focus.mode === 'rain_only') {
      targetScopeLabel =
        targetHour !== null
          ? `${isCont ? 'ต่อเนื่องจากคำถามก่อนหน้า' : 'เจาะจง'}: พยากรณ์ฝน • ${shortPrimaryName} เวลา ${topRain.timeColloquial} (${topRain.timeClock})`
          : `${isCont ? 'ต่อเนื่องจากคำถามก่อนหน้า' : 'เจาะจง'}: พยากรณ์ฝนวันนี้ • ${shortPrimaryName}`;

      if (focus.asksRainDurationOrIntensity) {
        conciseHeadline = `${contPrefix} (${topRain.timeColloquial}): ${topRain.rainLabel} โอกาสเกิด ${topRain.probabilityPercent}%`;
        conciseSubtext = `ปริมาณฝนคาดการณ์ ${topRain.precipMm.toFixed(1)} มม./ชม. • ${topRain.peakTodayLine || primaryCard.currentWeatherEasy}`;
        spokenAnswerText = `${
          isCont ? `ต่อเนื่องที่บริเวณ ${shortPrimaryName} ครับ` : `สำหรับบริเวณ ${shortPrimaryName} ครับ`
        } ช่วง${topRain.timeColloquial} สถานะคือ ${topRain.rainLabel} โอกาสเกิดฝน ${topRain.probabilityPercent} เปอร์เซ็นต์ ปริมาณฝนประมาณ ${topRain.precipMm.toFixed(1)} มิลลิเมตรต่อชั่วโมงครับ`;
      } else {
        conciseHeadline = isCont ? `ต่อเนื่องที่ ${topRain.highlightLine}` : `${topRain.highlightLine}`;
        conciseSubtext = `${primaryCard.currentWeatherEasy} • ปริมาณฝนคาดการณ์ ${topRain.precipMm.toFixed(1)} มม./ชม.`;
        spokenAnswerText = `${
          isCont ? `ต่อเนื่องที่บริเวณ ${shortPrimaryName} ครับ` : `สรุปพยากรณ์ฝนบริเวณ ${shortPrimaryName} ครับ`
        } ช่วง${topRain.timeColloquial} ${topRain.rainLabel} โอกาสเกิดฝน ${topRain.probabilityPercent} เปอร์เซ็นต์ อุณหภูมิประมาณ ${Math.round(topRain.tempC)} องศาเซลเซียสครับ`;
      }

      essentialHighlights = [
        {
          icon: 'rain',
          label: targetHour !== null ? `เวลาที่ถาม (${topRain.timeColloquial})` : 'ช่วงเวลาที่ต้องระวังฝน',
          value: `${topRain.rainLabel} • โอกาสเกิดฝน ${topRain.probabilityPercent}% (อุณหภูมิ ~${topRain.tempC}°C)`,
          tone: topRain.probabilityPercent >= 60 ? 'caution' : 'safe'
        }
      ];
      if (topRain.peakTodayLine && targetHour !== null) {
        essentialHighlights.push({
          icon: 'rain',
          label: 'ช่วงโอกาสฝนสูงสุดวันนี้',
          value: topRain.peakTodayLine,
          tone: topRain.probabilityPercent >= 60 ? 'caution' : 'safe'
        });
      }
      conciseText = conciseSubtext;
    } else if (focus.mode === 'traffic_only') {
      targetScopeLabel = `${isCont ? 'ต่อเนื่องจากคำถามก่อนหน้า' : 'เจาะจง'}: สภาพจราจร • ${shortPrimaryName}`;
      conciseHeadline = `${contPrefix}: ${trafficDot} (${primaryCard.status.trafficStatus.estimatedSpeedText})`;
      conciseSubtext = `${primaryCard.trafficEasyText} • ${primaryCard.waterEasyText}`;
      spokenAnswerText = `${
        isCont ? `ส่วนสภาพจราจรบริเวณ ${shortPrimaryName} ตอนนี้` : `สภาพจราจรบริเวณ ${shortPrimaryName} ตอนนี้`
      } เป็นสี${primaryCard.status.trafficStatus.colorNameTh} ${primaryCard.trafficEasyText} ความเร็วเฉลี่ย ${primaryCard.status.trafficStatus.estimatedSpeedText} ครับ`;

      essentialHighlights = [
        {
          icon: 'traffic',
          label: `การจราจร (${shortPrimaryName})`,
          value: `${trafficDot} — ${primaryCard.trafficEasyText} (ความเร็วเฉลี่ย ${primaryCard.status.trafficStatus.estimatedSpeedText})`,
          tone:
            primaryCard.trafficColor === 'red'
              ? 'warning'
              : primaryCard.trafficColor === 'yellow'
                ? 'caution'
                : 'safe'
        }
      ];
      conciseText = conciseSubtext;
    } else if (focus.mode === 'flood_only') {
      targetScopeLabel = `${isCont ? 'ต่อเนื่องจากคำถามก่อนหน้า' : 'เจาะจง'}: สถานะน้ำท่วมและการสัญจร • ${shortPrimaryName}`;
      if (focus.asksVehiclePass) {
        conciseHeadline = `${contPrefix}: ${primaryCard.vehicleEasyAdvice}`;
        conciseSubtext = `สถานะน้ำ: ${primaryCard.waterEasyText} (${primaryCard.status.waterConditionReason})`;
        spokenAnswerText = `${
          isCont ? `สำหรับการสัญจรบริเวณ ${shortPrimaryName} ครับ` : `บริเวณ ${shortPrimaryName} ครับ`
        } ${primaryCard.vehicleEasyAdvice} เนื่องจากตอนนี้${primaryCard.waterEasyText}ครับ`;
      } else {
        conciseHeadline = `${contPrefix}: ${primaryCard.waterEasyText}`;
        conciseSubtext = `${primaryCard.vehicleEasyAdvice}`;
        spokenAnswerText = `${
          isCont ? `ส่วนสถานะน้ำท่วมบริเวณ ${shortPrimaryName} ตอนนี้` : `สถานะน้ำท่วมบริเวณ ${shortPrimaryName} ตอนนี้`
        } ${primaryCard.waterEasyText} ${primaryCard.vehicleEasyAdvice}ครับ`;
      }

      essentialHighlights = [
        {
          icon: 'water',
          label: `น้ำท่วมไหม (${shortPrimaryName})`,
          value: `${primaryCard.waterEasyText} — ${primaryCard.vehicleEasyAdvice}`,
          tone:
            primaryCard.waterTier === 'critical' || primaryCard.waterTier === 'danger'
              ? 'warning'
              : primaryCard.waterTier === 'watch'
                ? 'caution'
                : 'safe'
        }
      ];
      conciseText = conciseSubtext;
    } else {
      targetScopeLabel = `${isCont ? 'ต่อเนื่องจากคำถามก่อนหน้า • ' : 'เจาะจงพื้นที่: '}${shortPrimaryName}`;
      conciseHeadline = `${contPrefix}: ${trafficDot} • ${primaryCard.waterEasyText}`;
      conciseSubtext = `${topRain.highlightLine}`;
      spokenAnswerText = `${
        isCont ? `ต่อเนื่องที่บริเวณ ${shortPrimaryName} ครับ` : `สรุปสถานการณ์บริเวณ ${shortPrimaryName} ครับ`
      } ตอนนี้${primaryCard.waterEasyText} ${primaryCard.vehicleEasyAdvice} การจราจรเป็นสี${primaryCard.status.trafficStatus.colorNameTh} ${primaryCard.trafficEasyText} และพยากรณ์ฝน ${topRain.highlightLine} ครับ`;

      if (focus.asksRain) {
        essentialHighlights.push({
          icon: 'rain',
          label: 'พยากรณ์ฝน',
          value: topRain.highlightLine,
          tone: topRain.probabilityPercent >= 60 ? 'caution' : 'safe'
        });
      }
      if (focus.asksTraffic) {
        essentialHighlights.push({
          icon: 'traffic',
          label: 'สภาพจราจร',
          value: `${trafficDot} — ${primaryCard.trafficEasyText}`,
          tone:
            primaryCard.trafficColor === 'red'
              ? 'warning'
              : primaryCard.trafficColor === 'yellow'
                ? 'caution'
                : 'safe'
        });
      }
      if (focus.asksFlood) {
        essentialHighlights.push({
          icon: 'water',
          label: 'น้ำท่วม & รถที่ผ่านได้',
          value: `${primaryCard.waterEasyText} (${primaryCard.vehicleEasyAdvice})`,
          tone:
            primaryCard.waterTier === 'critical' || primaryCard.waterTier === 'danger'
              ? 'warning'
              : primaryCard.waterTier === 'watch'
                ? 'caution'
                : 'safe'
        });
      }
      conciseText = conciseSubtext;
    }

    detailedText = placeCards
      .map((c, i) => {
        const rp = rainPredictions[i] || topRain;
        return [
          `📍 **${c.placeTitle} (${c.areaSubtitle})**`,
          `• สภาพอากาศปัจจุบัน: ${c.currentWeatherEasy}`,
          `• พยากรณ์ฝนรายชั่วโมง: ${rp.highlightLine}`,
          `• การจราจร: ${c.trafficEasyText}`,
          `• สถานะน้ำท่วมขัง: ${c.waterEasyText} (${c.vehicleEasyAdvice})`
        ].join('\n');
      })
      .join('\n\n');
  }

  const anyDanger = placeCards.some(
    (c) => c.waterTier === 'critical' || c.waterTier === 'danger'
  );
  const anyHighRain =
    (focus.asksRain || focus.mode === 'multi') &&
    sortedRainPredictions.slice(0, maxCards).some((r) => r.probabilityPercent >= 65);
  const anyRedTraffic =
    (focus.asksTraffic || focus.mode === 'multi') && primaryCard?.trafficColor === 'red';

  const resolvedLocationsForContext = isUnspecifiedPlace
    ? topRain && focus.mode === 'rain_only'
      ? [topRain.location]
      : placeCards.slice(0, 1).map((c) => c.location)
    : placeCards.map((c) => c.location);

  return {
    id: `ai-${Date.now()}`,
    role: 'assistant',
    targetScopeLabel,
    text: customShortText || conciseText,
    spokenAnswerText: customShortText ? `${conciseHeadline} ${customShortText}` : spokenAnswerText,
    detailedText,
    essentialHighlights,
    timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    queryType: isUnspecifiedPlace ? 'overview_general' : 'place_check',
    isFollowUpContinuation: isCont,
    previousQuestionRef: followUpMeta?.previousQuestion || undefined,
    conversationContext: {
      userQuestion: cleanMsg,
      shortContextTitle: shortPrimaryName,
      resolvedTopicFocus: focus,
      resolvedTargetHour: targetHour,
      resolvedLocations: resolvedLocationsForContext,
      isRoute: false
    },
    quickVerdict: {
      statusTone: anyDanger ? 'warning' : anyHighRain || anyRedTraffic ? 'caution' : 'safe',
      headline: conciseHeadline,
      subtext: customShortText || conciseSubtext
    },
    rainPredictions: sortedRainPredictions.slice(0, isUnspecifiedPlace ? 4 : Math.min(statuses.length, 2)),
    placeCards,
    followUpSuggestions: buildFocusedFollowUpSuggestions({
      focus,
      targetHour,
      shortPrimaryName:
        isUnspecifiedPlace && focus.mode === 'rain_only' && topRain
          ? topRain.shortPlaceName
          : shortPrimaryName
    })
  };
}

/**
 * ตอบคำถามทันทีใน 0 มิลลิวินาที (Synchronous Instant Answer) จากข้อมูลที่โหลดเตรียมไว้ในเว็บแล้ว + โฟกัสเฉพาะคำถามก่อนหน้าที่ผู้ใช้งานถาม
 */
export function getInstantAiAnswerFromPreloadedWebData(
  userMessage: string,
  activeLocations: ThaiLocation[],
  chatHistory: AiChatMessage[] = []
): AiChatMessage | null {
  const cleanMsg = userMessage.trim();
  if (!cleanMsg) return null;

  const memory = extractLastConversationContext(chatHistory);
  const focus = detectQuestionTopicFocus(cleanMsg, memory.lastTopicFocus);
  const detectedHour = detectTargetHourFromQuestion(cleanMsg);
  const targetHour =
    detectedHour !== null
      ? detectedHour
      : !focus.hasExplicitTopic && memory.lastTargetHour !== null
        ? memory.lastTargetHour
        : null;

  const primaryActiveLoc =
    memory.lastLocations[0] ||
    activeLocations[0] ||
    aliasToThaiLocation(COLLOQUIAL_PLACE_ALIASES[0]);
  setSearchReferenceCoordinates(primaryActiveLoc.lat, primaryActiveLoc.lng);

  // 0. กรณีถาม "ขากลับ" จากเส้นทางในคำถามก่อนหน้าทันที
  if (/(ขากลับ|เดินทางกลับ|แล้วขากลับ)/i.test(cleanMsg) && memory.isLastRoute && memory.lastLocations.length >= 2) {
    const revOrigin = memory.lastLocations[memory.lastLocations.length - 1];
    const revDest = memory.lastLocations[0];
    const corridor = buildIntermediateCorridorPoints(revOrigin, revDest);
    const revRoute = {
      origin: revOrigin,
      destination: revDest,
      corridorLocations: [revOrigin, ...corridor, revDest]
    };
    const cachedStatuses = revRoute.corridorLocations.map((loc) => getCachedLocationStatus(loc));
    return buildRouteAiMessageFromStatuses(cleanMsg, revRoute, cachedStatuses, targetHour, undefined, focus, {
      isFollowUpContinuation: true,
      previousQuestion: memory.lastUserQuestion,
      isReturnTrip: true
    });
  }

  // 1. เช็คว่าเป็นคำถามเส้นทาง A -> B หรือไม่ (ใช้สถานที่จากคำถามก่อนหน้าเป็นจุดตั้งต้นทันทีหากถามต่อยอด เช่น "แล้วถ้าไปฟิวเจอร์ล่ะ")
  const effectiveOrigin = memory.lastLocations[0] || primaryActiveLoc;
  const syncRoute = detectRouteQuerySync(cleanMsg, effectiveOrigin);
  if (syncRoute) {
    const cachedStatuses = syncRoute.corridorLocations.map((loc) => getCachedLocationStatus(loc));
    const isRouteFollowUp = Boolean(
      memory.lastUserQuestion &&
        memory.lastLocations.length > 0 &&
        syncRoute.origin.id === memory.lastLocations[0].id
    );
    return buildRouteAiMessageFromStatuses(cleanMsg, syncRoute, cachedStatuses, targetHour, undefined, focus, {
      isFollowUpContinuation: isRouteFollowUp,
      previousQuestion: memory.lastUserQuestion
    });
  }

  // 2. เช็คว่าเป็นการถามต่อเนื่องจากคำถามก่อนหน้า หรือถามสถานที่ใหม่
  const syncMentioned = extractMentionedLocationsSync(cleanMsg);
  const remainingPlaceCandidate = stripQuestionNoise(cleanMsg);
  const asksNationwideExplicitly = /(ที่ไหนบ้าง|ทั่วประเทศ|ทั่วไทย|จังหวัดไหนบ้าง)/i.test(cleanMsg);
  const hasExplicitFollowUpConnector =
    /^(แล้ว|ส่วน|สำหรับ|ถ้า|สมมติ|งั้น|ต่อเนื่อง|ถามต่อ|แถวนั้น|ตรงนั้น|จุดนั้น|ที่นั่น|ที่นี่|เส้นนั้น|ทางนั้น)/i.test(
      cleanMsg
    ) || /(ล่ะ|ละ|หรือยัง|ไหมครับ|ไหมค่ะ)\s*\??$/i.test(cleanMsg);

  // หากมีคำถามก่อนหน้า และผู้ใช้ไม่ได้ระบุสถานที่ใหม่ (และไม่ได้ถามว่า "ที่ไหนบ้าง") ให้โฟกัสเฉพาะสถานที่/เส้นทางของคำถามก่อนหน้าเหมือนเป็นเรื่องเดียวกัน 100%!
  const isFollowUpOnPreviousQuestion =
    syncMentioned.length === 0 &&
    remainingPlaceCandidate.length < 2 &&
    memory.lastLocations.length > 0 &&
    !asksNationwideExplicitly;

  if (isFollowUpOnPreviousQuestion) {
    if (memory.isLastRoute && memory.lastLocations.length >= 2) {
      const origin = memory.lastLocations[0];
      const destination = memory.lastLocations[memory.lastLocations.length - 1];
      const cachedStatuses = memory.lastLocations.map((loc) => getCachedLocationStatus(loc));
      return buildRouteAiMessageFromStatuses(
        cleanMsg,
        { origin, destination, corridorLocations: memory.lastLocations },
        cachedStatuses,
        targetHour,
        undefined,
        focus,
        {
          isFollowUpContinuation: true,
          previousQuestion: memory.lastUserQuestion
        }
      );
    }
    const cachedStatuses = memory.lastLocations.slice(0, 1).map((loc) => getCachedLocationStatus(loc));
    return buildPlaceOrOverviewAiMessageFromStatuses(
      cleanMsg,
      false,
      cachedStatuses,
      targetHour,
      undefined,
      focus,
      {
        isFollowUpContinuation: true,
        previousQuestion: memory.lastUserQuestion
      }
    );
  }

  const isGeneralQuestion =
    syncMentioned.length === 0 &&
    remainingPlaceCandidate.length < 2 &&
    (asksNationwideExplicitly ||
      /(ที่ไหน|ภาพรวม|วันนี้|ตอนนี้|บ่ายนี้|เย็นนี้|ฝนตกไหม|ฝนจะตก|น้ำท่วมไหม|น้ำท่วม|รถติดไหม|รถติด)/i.test(
        cleanMsg
      ));

  if (syncMentioned.length > 0 || isGeneralQuestion) {
    const isUnspecified = syncMentioned.length === 0;
    const locs = isUnspecified
      ? getOverviewRepresentativeLocations(activeLocations)
      : syncMentioned;
    const cachedStatuses = locs.map((loc) => getCachedLocationStatus(loc));
    const isContinuingTopicOnNewPlace = Boolean(
      !isUnspecified &&
        memory.lastUserQuestion &&
        (!focus.hasExplicitTopic || hasExplicitFollowUpConnector)
    );
    return buildPlaceOrOverviewAiMessageFromStatuses(
      cleanMsg,
      isUnspecified,
      cachedStatuses,
      targetHour,
      undefined,
      focus,
      {
        isFollowUpContinuation: isContinuingTopicOnNewPlace,
        previousQuestion: memory.lastUserQuestion
      }
    );
  }

  return null;
}

/**
 * ประมวลผลคำถามของผู้ใช้แบบครบวงจร (พร้อม Proximity Search + โฟกัสเฉพาะคำถามก่อนหน้าเหมือนความสามารถของ Gemini + เสียงสรุปตรงประเด็น)
 */
export async function askSmartWeatherTrafficAi(
  userMessage: string,
  activeLocations: ThaiLocation[],
  chatHistory: AiChatMessage[]
): Promise<AiChatMessage> {
  const cleanMsg = userMessage.trim();
  const memory = extractLastConversationContext(chatHistory);
  const focus = detectQuestionTopicFocus(cleanMsg, memory.lastTopicFocus);
  const detectedHour = detectTargetHourFromQuestion(cleanMsg);
  const targetHour =
    detectedHour !== null
      ? detectedHour
      : !focus.hasExplicitTopic && memory.lastTargetHour !== null
        ? memory.lastTargetHour
        : null;

  const primaryActiveLoc =
    memory.lastLocations[0] ||
    activeLocations[0] ||
    aliasToThaiLocation(COLLOQUIAL_PLACE_ALIASES[0]);
  setSearchReferenceCoordinates(primaryActiveLoc.lat, primaryActiveLoc.lng);

  const effectiveOrigin = memory.lastLocations[0] || primaryActiveLoc;

  // 0. กรณีถาม "ขากลับ" จากเส้นทางก่อนหน้า
  if (/(ขากลับ|เดินทางกลับ|แล้วขากลับ)/i.test(cleanMsg) && memory.isLastRoute && memory.lastLocations.length >= 2) {
    const revOrigin = memory.lastLocations[memory.lastLocations.length - 1];
    const revDest = memory.lastLocations[0];
    const corridor = buildIntermediateCorridorPoints(revOrigin, revDest);
    const revRoute = {
      origin: revOrigin,
      destination: revDest,
      corridorLocations: [revOrigin, ...corridor, revDest]
    };
    const statuses = await fetchRouteStatuses(revRoute.corridorLocations, false);
    return buildRouteAiMessageFromStatuses(cleanMsg, revRoute, statuses, targetHour, undefined, focus, {
      isFollowUpContinuation: true,
      previousQuestion: memory.lastUserQuestion,
      isReturnTrip: true
    });
  }

  // 1. ตรวจสอบว่าเป็นคำถามการเดินทางจากจุด A ไป จุด B หรือไม่
  const routeDetected = await detectAndResolveRouteQuery(cleanMsg, effectiveOrigin);

  if (routeDetected) {
    const statuses = await fetchRouteStatuses(routeDetected.corridorLocations, false);
    const isRouteFollowUp = Boolean(
      memory.lastUserQuestion &&
        memory.lastLocations.length > 0 &&
        routeDetected.origin.id === memory.lastLocations[0].id
    );
    const baseMsg = buildRouteAiMessageFromStatuses(
      cleanMsg,
      routeDetected,
      statuses,
      targetHour,
      undefined,
      focus,
      {
        isFollowUpContinuation: isRouteFollowUp,
        previousQuestion: memory.lastUserQuestion
      }
    );

    const bestWindowAdvice = computeBestTravelWindowLine(statuses[0]);
    const realtimeContextText = JSON.stringify({
      previousUserQuestion: memory.lastUserQuestion,
      previousAssistantSummary: memory.lastAssistantHeadline,
      questionFocus: focus.mode,
      origin: baseMsg.routeSummary?.originName,
      destination: baseMsg.routeSummary?.destinationName,
      distanceKm: baseMsg.routeSummary?.distanceKm,
      headline: baseMsg.quickVerdict?.headline,
      essentials: baseMsg.essentialHighlights,
      bestTravelTimeWindow: bestWindowAdvice
    });

    const geminiShortReply = await requestServerGeminiReply(
      cleanMsg,
      chatHistory,
      realtimeContextText,
      baseMsg.text,
      'complex'
    );

    return {
      ...baseMsg,
      text: geminiShortReply,
      spokenAnswerText: baseMsg.spokenAnswerText || geminiShortReply,
      quickVerdict: baseMsg.quickVerdict
        ? {
            ...baseMsg.quickVerdict,
            subtext: geminiShortReply
          }
        : undefined
    };
  }

  // 2. ตรวจสอบสถานที่ที่ถาม หรือใช้บริบทจากคำถามก่อนหน้าโดยตรง
  let mentionedLocations = await extractMentionedLocationsInText(cleanMsg);
  const remainingPlaceCandidate = stripQuestionNoise(cleanMsg);
  const asksNationwideExplicitly = /(ที่ไหนบ้าง|ทั่วประเทศ|ทั่วไทย|จังหวัดไหนบ้าง)/i.test(cleanMsg);
  const hasExplicitFollowUpConnector =
    /^(แล้ว|ส่วน|สำหรับ|ถ้า|สมมติ|งั้น|ต่อเนื่อง|ถามต่อ|แถวนั้น|ตรงนั้น|จุดนั้น|ที่นั่น|ที่นี่|เส้นนั้น|ทางนั้น)/i.test(
      cleanMsg
    ) || /(ล่ะ|ละ|หรือยัง|ไหมครับ|ไหมค่ะ)\s*\??$/i.test(cleanMsg);

  let isFollowUpContinuation = false;

  if (
    mentionedLocations.length === 0 &&
    remainingPlaceCandidate.length < 2 &&
    memory.lastLocations.length > 0 &&
    !asksNationwideExplicitly
  ) {
    isFollowUpContinuation = true;
    if (memory.isLastRoute && memory.lastLocations.length >= 2) {
      const origin = memory.lastLocations[0];
      const destination = memory.lastLocations[memory.lastLocations.length - 1];
      const statuses = await fetchRouteStatuses(memory.lastLocations, false);
      const baseRouteMsg = buildRouteAiMessageFromStatuses(
        cleanMsg,
        { origin, destination, corridorLocations: memory.lastLocations },
        statuses,
        targetHour,
        undefined,
        focus,
        {
          isFollowUpContinuation: true,
          previousQuestion: memory.lastUserQuestion
        }
      );
      return baseRouteMsg;
    }
    mentionedLocations = memory.lastLocations.slice(0, 1);
  } else if (
    mentionedLocations.length > 0 &&
    memory.lastUserQuestion &&
    (!focus.hasExplicitTopic || hasExplicitFollowUpConnector)
  ) {
    isFollowUpContinuation = true;
  }

  const isUnspecifiedPlace = mentionedLocations.length === 0;

  const locationsToFetch = isUnspecifiedPlace
    ? getOverviewRepresentativeLocations(activeLocations)
    : mentionedLocations;

  const statuses = await fetchRouteStatuses(locationsToFetch, false);
  const baseMsg = buildPlaceOrOverviewAiMessageFromStatuses(
    cleanMsg,
    isUnspecifiedPlace,
    statuses,
    targetHour,
    undefined,
    focus,
    {
      isFollowUpContinuation,
      previousQuestion: memory.lastUserQuestion
    }
  );

  const bestWindowAdvice = computeBestTravelWindowLine(statuses[0]);
  const realtimeContextText = JSON.stringify({
    previousUserQuestion: memory.lastUserQuestion,
    previousAssistantSummary: memory.lastAssistantHeadline,
    questionFocus: focus.mode,
    targetScope: baseMsg.targetScopeLabel,
    headline: baseMsg.quickVerdict?.headline,
    essentials: baseMsg.essentialHighlights,
    bestTravelTimeWindow: bestWindowAdvice
  });

  const geminiShortReply = await requestServerGeminiReply(
    cleanMsg,
    chatHistory,
    realtimeContextText,
    baseMsg.text,
    focus.mode === 'multi' ? 'general' : 'fast'
  );

  return {
    ...baseMsg,
    text: geminiShortReply,
    spokenAnswerText: baseMsg.spokenAnswerText || geminiShortReply,
    quickVerdict: baseMsg.quickVerdict
      ? {
          ...baseMsg.quickVerdict,
          subtext: geminiShortReply
        }
      : undefined
  };
}

async function requestServerGeminiReply(
  message: string,
  chatHistory: AiChatMessage[],
  realtimeContextText: string,
  fallbackEverydayAnswer: string,
  taskComplexity: 'fast' | 'general' | 'complex' = 'general'
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2600);

    const history = chatHistory
      .slice(-6)
      .map((h) => ({ role: h.role, text: h.text || h.spokenAnswerText || '' }));

    const favorites = getFavoriteLocations();

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        history,
        realtimeContextText,
        fallbackEverydayAnswer,
        favorites,
        taskComplexity
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.reply === 'string' && data.reply.trim().length > 0) {
        return data.reply.trim();
      }
    }
  } catch {
    // ใช้คำตอบภาษาชาวบ้านที่ประมวลผลจากข้อมูลจริงในเว็บทันที
  }
  return fallbackEverydayAnswer;
}
