import type { ISODate } from '../lib/date';
import type { QuickCategory } from '../logic/quick-add';
import { validateAiQuick, type AiQuickParse } from './parse';

/** Ganti di satu tempat kalau mau model lain (mis. gemini-2.5-flash-lite). */
export const GEMINI_MODEL = 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 8000;

export class AiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

function friendlyStatus(status: number): string {
  if (status === 400 || status === 401 || status === 403) {
    return 'API key ditolak. Periksa kembali key Gemini di Setelan.';
  }
  if (status === 429) return 'Kuota AI habis. Coba lagi nanti.';
  if (status >= 500) return 'Layanan AI sedang gangguan. Coba lagi.';
  return `Permintaan AI gagal (HTTP ${status}).`;
}

async function request(path: string, init: RequestInit, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const separator = path.includes('?') ? '&' : '?';
    return await fetch(`${ENDPOINT}${path}${separator}key=${encodeURIComponent(apiKey)}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiError('AI terlalu lama merespons. Coba lagi.');
    }
    throw new AiError('Tidak bisa menghubungi AI. Periksa koneksi internet.');
  } finally {
    clearTimeout(timer);
  }
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['expense', 'income'] },
    amount: { type: 'INTEGER' },
    note: { type: 'STRING' },
    date: { type: 'STRING', enum: ['today', 'yesterday'] },
    category: { type: 'STRING' },
  },
  required: ['kind', 'amount', 'note', 'date'],
};

function buildPrompt(
  input: string,
  ctx: { today: ISODate; categories: readonly QuickCategory[] },
): string {
  const names = ctx.categories.map((c) => c.name).join(', ');
  return [
    'Ubah kalimat pengeluaran/pemasukan berbahasa Indonesia menjadi JSON.',
    'Aturan:',
    '- kind: "expense" untuk belanja, "income" untuk uang masuk (gaji, bonus, jual, refund).',
    '- amount: integer rupiah tanpa titik/koma. "25rb" = 25000, "1,5jt" = 1500000.',
    '- note: ringkasan singkat tanpa nominal (maks 80 karakter).',
    '- date: "today" atau "yesterday" saja.',
    `- category: pilih hanya dari [${names}] atau kosongkan.`,
    `Hari ini: ${ctx.today}.`,
    `Kalimat: "${input}"`,
  ].join('\n');
}

export async function parseWithGemini(
  input: string,
  ctx: { today: ISODate; categories: readonly QuickCategory[] },
  apiKey: string,
): Promise<AiQuickParse | null> {
  const response = await request(
    `/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(input, ctx) }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      }),
    },
    apiKey,
  );

  if (!response.ok) throw new AiError(friendlyStatus(response.status), response.status);

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;

  try {
    return validateAiQuick(JSON.parse(text), ctx);
  } catch {
    return null;
  }
}

/** Cek key tanpa memanggil model (gratis): cukup daftar model. */
export async function testGeminiKey(apiKey: string): Promise<void> {
  const response = await request('/models', { method: 'GET' }, apiKey);
  if (!response.ok) throw new AiError(friendlyStatus(response.status), response.status);
}
