import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.post('/api/ai/chat', async (req, res) => {
    const {
      message = '',
      history = [],
      realtimeContextText = '',
      fallbackEverydayAnswer = '',
      favorites = [],
      taskComplexity = 'general'
    } = req.body || {};

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        reply: fallbackEverydayAnswer || 'ระบบตรวจสอบข้อมูลเรียลไทม์ให้เรียบร้อยแล้วครับ',
        source: 'realtime_engine'
      });
    }

    const favoritesContext =
      Array.isArray(favorites) && favorites.length > 0
        ? `\n[รายการสถานที่โปรดของผู้ใช้งานขณะนี้]\n` +
          favorites
            .map(
              (f: { customLabel?: string; name?: string; location?: { name?: string; province?: string } }, i: number) =>
                `${i + 1}. ${f.customLabel || f.name}: ${f.location?.name || f.name} (จ.${f.location?.province || ''})`
            )
            .join('\n')
        : '';

    const systemInstruction = `คุณคือ "ThaiRoute AI" ผู้ช่วยอัจฉริยะวิเคราะห์สภาพอากาศ ฝน น้ำท่วม การจราจร และการเดินทางทั่วประเทศไทย
บทบาทและหน้าที่หลักของคุณ:
1. วิเคราะห์สภาพอากาศ ปริมาณฝน โอกาสเกิดฝน ระดับน้ำท่วมขัง และสีสภาพจราจรแบบเรียลไทม์ โดยใช้ภาษาไทยที่กระชับ ตรงประเด็น เหมาะสำหรับอ่านหรือฟังเสียงสรุป
2. เชื่อมโยงและจดจำ "สถานที่โปรดของผู้ใช้งาน" (เช่น บ้าน, ที่ทำงาน, โรงเรียน, ถนนประจำ): หากผู้ใช้ถามถึงคำว่า "บ้าน", "ที่ทำงาน", "คอนโด" หรือชื่อย่อใดๆ ให้อ้างอิงพิกัดจาก [รายการสถานที่โปรดของผู้ใช้งาน] ทันที เช่น ถามว่า "บ้านฝนตกไหม" ให้ตอบสภาพอากาศของสถานที่โปรดที่เป็นบ้าน
3. รองรับการสนทนาต่อเนื่องหลายเทิร์น (Multi-turn Conversation): เชื่อมโยงบริบทจากประวัติการสนทนา เช่น หากถามต่อว่า "แล้วขากลับล่ะ", "แล้วบ่าย 3 ล่ะ", "รถเล็กผ่านได้ไหม", "รถติดไหม" ให้เข้าใจทันทีว่าหมายถึงสถานที่และเส้นทางที่คุยกันก่อนหน้า
4. ให้คำแนะนำการเดินทางที่เป็นประโยชน์ เช่น ช่วงเวลาที่ควรออกเดินทางเพื่อเลี่ยงฝนตกหนักหรือรถติด และแนะนำทางเลี่ยงหากมีน้ำท่วมขัง`;

    // เลือก Model ตามระดับความซับซ้อนของงานตามข้อกำหนด
    // gemini-3.1-pro-preview สำหรับงานซับซ้อนสูง, gemini-3.5-flash สำหรับงานทั่วไป, gemini-3.1-flash-lite สำหรับงานที่ต้องการความเร็วสูง
    const primaryModel =
      taskComplexity === 'complex'
        ? 'gemini-3.1-pro-preview'
        : taskComplexity === 'fast'
          ? 'gemini-3.1-flash-lite'
          : 'gemini-3.5-flash';

    // เตรียมประวัติการสนทนาต่อเนื่องแบบ Multi-turn
    const conversationHistoryLines = Array.isArray(history) && history.length > 0
      ? history
          .slice(-6)
          .map((h: { role?: string; text?: string }) =>
            `${h.role === 'user' ? 'ผู้ใช้งาน' : 'ThaiRoute AI'}: ${h.text || ''}`
          )
          .join('\n')
      : '';

    const fullPrompt = `${
      favoritesContext ? `${favoritesContext}\n\n` : ''
    }${
      conversationHistoryLines
        ? `[ประวัติการสนทนาต่อเนื่องที่ผ่านมา]\n${conversationHistoryLines}\n\n`
        : ''
    }[ข้อมูลสภาพอากาศ น้ำท่วม และจราจรจริง ณ ปัจจุบัน]\n${realtimeContextText}\n\n[ข้อความล่าสุดของผู้ใช้งาน]\n${message}\n\nตอบสรุปสั้น กระชับ ตรงประเด็น (1-2 ประโยค) เหมาะสำหรับอ่านและพูดด้วยเสียง:`;

    try {
      const response = await ai.models.generateContent({
        model: primaryModel,
        contents: fullPrompt,
        config: {
          systemInstruction,
          temperature: 0.25
        }
      });

      const text = response.text?.trim();
      if (text) {
        return res.json({
          reply: text,
          source: 'gemini',
          model: primaryModel
        });
      }
    } catch (primaryErr) {
      // Fallback model tiers: gemini-3.5-flash -> gemini-3.1-flash-lite
      const fallbackModels =
        primaryModel === 'gemini-3.5-flash'
          ? ['gemini-3.1-flash-lite', 'gemini-flash-latest']
          : ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

      for (const fallbackModel of fallbackModels) {
        try {
          const fallbackRes = await ai.models.generateContent({
            model: fallbackModel,
            contents: fullPrompt,
            config: {
              systemInstruction,
              temperature: 0.25
            }
          });
          const text2 = fallbackRes.text?.trim();
          if (text2) {
            return res.json({
              reply: text2,
              source: 'gemini',
              model: fallbackModel
            });
          }
        } catch {
          // ลองโมเดลถัดไป
        }
      }
    }

    return res.json({
      reply: fallbackEverydayAnswer || 'ระบบตรวจสอบข้อมูลเรียลไทม์ให้เรียบร้อยแล้วครับ',
      source: 'realtime_engine'
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
