import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AiError, parseWithGemini } from '@/ai/gemini';
import { getAiKey } from '@/ai/key';
import { addTransaction, listCategories, type Category } from '@/db/repo';
import { addDays, formatDayMonth, todayISO, type ISODate } from '@/lib/date';
import { parseQuickAdd, type QuickParse } from '@/logic/quick-add';
import { color, radius, size, space, type } from '@/theme/tokens';
import { AmountText } from '@/ui/amount-text';
import { Screen } from '@/ui/screen';

const EXAMPLES = ['kopi 18rb', 'gaji 1,5jt', 'kemarin parkir 5rb'];

type Source = 'lokal' | 'AI';

type Result = Pick<QuickParse, 'kind' | 'amount' | 'note' | 'categoryName' | 'date'> & {
  source: Source;
};

export default function QuickScreen() {
  const [text, setText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cats, key] = await Promise.all([listCategories(), getAiKey()]);
      if (cancelled) return;
      setCategories(cats);
      setHasKey(Boolean(key));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function analyze() {
    if (busy || text.trim() === '') return;

    Keyboard.dismiss();
    setError(null);
    setResult(null);

    const today = todayISO();
    const local = parseQuickAdd(text, { today, categories });
    if (local) {
      setResult({ ...local, source: 'lokal' });
      return;
    }

    if (!hasKey) {
      setError('Nominal belum jelas. Tulis seperti "kopi 18rb", atau isi manual lewat tombol +.');
      return;
    }

    setBusy(true);
    try {
      const key = await getAiKey();
      if (!key) throw new AiError('API key tidak ditemukan. Atur ulang di Setelan.');
      const ai = await parseWithGemini(text, { today, categories }, key);
      if (!ai) {
        setError('AI juga belum bisa memahami kalimat itu. Coba tulis nominalnya, mis. 25rb.');
        return;
      }
      setResult({ ...ai, source: 'AI' });
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'AI gagal memproses. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  function categoryId(name: string | null): number | null {
    if (!name) return null;
    return categories.find((c) => c.name === name)?.id ?? null;
  }

  async function save() {
    if (!result || saving) return;
    setSaving(true);
    try {
      await addTransaction({
        kind: result.kind,
        amount: result.amount,
        categoryId: categoryId(result.categoryName),
        note: result.note,
        localDate: result.date,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function editInForm() {
    if (!result) return;
    router.replace({
      pathname: '/add',
      params: {
        amount: String(result.amount),
        kind: result.kind,
        note: result.note,
        date: result.date,
        categoryId: result.categoryName ? String(categoryId(result.categoryName) ?? '') : '',
      },
    });
  }

  const today: ISODate = todayISO();
  const yesterday = addDays(today, -1);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={space.md}>
          <Text style={styles.back}>Kembali</Text>
        </Pressable>
        <Text style={styles.label}>Tambah cepat</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Tulis satu kalimat</Text>
        <Text style={styles.body}>
          Nominal, jenis, kategori, dan tanggal diisi otomatis. Kamu tetap bisa mengubahnya sebelum
          menyimpan.
        </Text>

        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError(null);
            setResult(null);
          }}
          placeholder="mis. makan siang 25rb"
          placeholderTextColor={color.ink3}
          style={styles.input}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={analyze}
          maxLength={140}
        />

        <View style={styles.examples}>
          {EXAMPLES.map((example) => (
            <Pressable
              key={example}
              accessibilityRole="button"
              onPress={() => {
                setText(example);
                setError(null);
                setResult(null);
              }}
              style={({ pressed }) => [styles.example, pressed && styles.pressed]}
            >
              <Text style={styles.exampleText}>{example}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={analyze}
          disabled={busy || text.trim() === ''}
          style={({ pressed }) => [
            styles.analyze,
            (busy || text.trim() === '') && styles.analyzeDisabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={color.bg} />
          ) : (
            <Text style={styles.analyzeLabel}>{hasKey ? 'Proses (lokal / AI)' : 'Proses'}</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardLabel}>
                {result.kind === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                {` · ${result.source}`}
              </Text>
              <Text style={styles.cardDate}>
                {result.date === today
                  ? 'Hari ini'
                  : result.date === yesterday
                    ? 'Kemarin'
                    : formatDayMonth(result.date)}
              </Text>
            </View>

            <AmountText
              value={result.amount}
              variant="display"
              tone={result.kind === 'income' ? 'accent' : 'default'}
              signed={result.kind === 'income'}
              style={styles.cardAmount}
            />

            <Text style={styles.cardMeta}>
              {result.categoryName ?? 'Tanpa kategori'}
              {result.note ? ` · ${result.note}` : ''}
            </Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={editInForm}
                style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryLabel}>Ubah</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={save}
                disabled={saving}
                style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              >
                <Text style={styles.primaryLabel}>{saving ? 'Menyimpan…' : 'Simpan'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.privacy}>
          AI hanya dipakai kalau nominal tidak bisa dibaca lokal. Saat itu, kalimat ini dikirim ke
          Google Gemini — riwayat transaksi tidak pernah dikirim.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.touch,
  },
  headerSpacer: {
    width: 56,
  },
  back: {
    ...type.meta,
    color: color.ink2,
    width: 56,
  },
  label: {
    ...type.label,
    color: color.ink3,
  },
  content: {
    paddingBottom: space.huge,
  },
  title: {
    ...type.title,
    color: color.ink,
    marginTop: space.xl,
  },
  body: {
    ...type.meta,
    color: color.ink2,
    marginTop: space.sm,
    lineHeight: 21,
  },
  input: {
    ...type.body,
    marginTop: space.xl,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: color.sunken,
    paddingHorizontal: space.lg,
    color: color.ink,
  },
  examples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  example: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: size.hairline,
    borderColor: color.hairline,
  },
  exampleText: {
    ...type.meta,
    fontSize: 13,
    color: color.ink2,
  },
  analyze: {
    marginTop: space.lg,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeDisabled: {
    backgroundColor: color.hairline,
  },
  analyzeLabel: {
    ...type.body,
    color: color.bg,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    ...type.meta,
    color: color.danger,
    marginTop: space.lg,
    lineHeight: 20,
  },
  card: {
    marginTop: space.xl,
    borderTopWidth: size.hairline,
    borderTopColor: color.hairline,
    paddingTop: space.lg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    ...type.label,
    color: color.ink3,
  },
  cardDate: {
    ...type.meta,
    fontSize: 12,
    color: color.ink3,
  },
  cardAmount: {
    fontSize: 40,
    lineHeight: 48,
    marginTop: space.sm,
  },
  cardMeta: {
    ...type.meta,
    color: color.ink2,
    marginTop: space.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.xl,
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: size.hairline,
    borderColor: color.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    ...type.body,
    color: color.ink,
  },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    ...type.body,
    color: color.bg,
    fontWeight: '600',
  },
  privacy: {
    ...type.meta,
    fontSize: 12,
    color: color.ink3,
    marginTop: space.xxl,
    lineHeight: 18,
  },
});
