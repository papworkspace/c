import { AiChatMessage } from '../services/aiAssistantService';

export interface AiVoicePlaybackState {
  activeId: string | null;
  activeText: string | null;
}

type SpeechStateListener = (state: AiVoicePlaybackState) => void;

let currentVoiceState: AiVoicePlaybackState = {
  activeId: null,
  activeText: null
};

const listeners = new Set<SpeechStateListener>();

function notifySpeechListeners(activeId: string | null, activeText: string | null = null) {
  currentVoiceState = { activeId, activeText };
  listeners.forEach((fn) => fn(currentVoiceState));
}

export function getAiVoicePlaybackState(): AiVoicePlaybackState {
  return currentVoiceState;
}

export function subscribeAiVoiceState(listener: SpeechStateListener): () => void {
  listeners.add(listener);
  listener(currentVoiceState);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * ทำความสะอาดและแปลงตัวย่อภาษาไทยให้เสียง AI พูดสรุปตรงประเด็นได้อย่างเป็นธรรมชาติและชัดเจน
 */
export function normalizeThaiTextForSpeech(rawText: string): string {
  return rawText
    .replace(/\*\*/g, '')
    .replace(/[🔴🟡🟢🌊🌧️🚗🛣️🎯⚡✨🔊📍⚠️✅•]/g, ' ')
    .replace(/[➔→]/g, ' ไป ')
    .replace(/~/g, 'ประมาณ ')
    .replace(/°C/gi, ' องศาเซลเซียส')
    .replace(/%/g, ' เปอร์เซ็นต์')
    .replace(/กม\.\/ชม\./g, 'กิโลเมตรต่อชั่วโมง')
    .replace(/มม\.\/ชม\./g, 'มิลลิเมตรต่อชั่วโมง')
    .replace(/ม\.รทก\./g, 'เมตรระดับทะเลปานกลาง')
    .replace(/\bจ\.\s*/g, 'จังหวัด')
    .replace(/\bอ\.\s*/g, 'อำเภอ')
    .replace(/\bต\.\s*/g, 'ตำบล')
    .replace(/\bถ\.\s*/g, 'ถนน')
    .replace(/\bซม\./g, 'เซนติเมตร')
    .replace(/\bมม\./g, 'มิลลิเมตร')
    .replace(/\bกม\./g, 'กิโลเมตร')
    .replace(/\bชม\./g, 'ชั่วโมง')
    .replace(/(\d+)\s*ม\./g, '$1 เมตร')
    .replace(/(\d{1,2}):00\s*น\./g, '$1 นาฬิกา')
    .replace(/(\d{1,2}:\d{2})\s*น\./g, '$1 นาฬิกา')
    .replace(/สสน\./g, 'สอ สอ นอ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function selectBestThaiVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const thaiVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith('th') ||
      v.name.toLowerCase().includes('thai') ||
      v.name.includes('ไทย')
  );
  if (thaiVoices.length === 0) return null;

  const preferred = thaiVoices.find(
    (v) =>
      v.name.includes('Google') ||
      v.name.includes('Premwadee') ||
      v.name.includes('Kanya') ||
      v.name.includes('Narisa')
  );
  return preferred || thaiVoices[0];
}

export function stopAllSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  notifySpeechListeners(null, null);
}

/**
 * ให้ AI ตอบด้วยเสียงอัตโนมัติทันทีด้วยข้อความสรุปตรงประเด็นของผู้ใช้งาน (ไม่ต้องกดปุ่ม)
 */
export function speakAiDirectSummaryAutomatically(id: string, summaryText: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  const cleanText = normalizeThaiTextForSpeech(summaryText);
  if (!cleanText) return false;

  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    // ignore speech reset quirks
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'th-TH';
  utterance.rate = 1.02;
  utterance.pitch = 1.0;

  const bestVoice = selectBestThaiVoice();
  if (bestVoice) {
    utterance.voice = bestVoice;
  }

  utterance.onstart = () => {
    notifySpeechListeners(id, summaryText);
  };
  utterance.onend = () => {
    if (currentVoiceState.activeId === id) {
      notifySpeechListeners(null, null);
    }
  };
  utterance.onerror = () => {
    if (currentVoiceState.activeId === id) {
      notifySpeechListeners(null, null);
    }
  };

  notifySpeechListeners(id, summaryText);
  window.speechSynthesis.speak(utterance);
  return true;
}

/**
 * สร้างข้อความเสียงสรุปตรงประเด็นของ AI สำหรับตอบผู้ใช้งานโดยตรง
 */
export function buildAiMessageSpeechScript(msg: AiChatMessage): string {
  if (msg.spokenAnswerText && msg.spokenAnswerText.trim().length > 0) {
    return msg.spokenAnswerText.trim();
  }

  if (msg.quickVerdict) {
    const headline = msg.quickVerdict.headline.trim();
    const subtext = msg.quickVerdict.subtext?.trim() || '';
    if (subtext && subtext !== headline) {
      return `${headline} ${subtext}`;
    }
    return headline;
  }

  return msg.text;
}
