import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addCategory,
  countTransactionsByCategory,
  deleteAllTransactions,
  deleteCategory,
  exportBackup,
  getSettings,
  importBackup,
  listCategories,
  updateSettings,
  type Category,
  type Settings,
} from '@/db/repo';
import { parseBackup } from '@/lib/backup';
import { todayISO } from '@/lib/date';
import { formatRp, formatSignedRp } from '@/lib/money';
import { splitDaily } from '@/logic/rollover';
import { color, radius, size, space, type } from '@/theme/tokens';
import { MoneyEditor } from '@/ui/money-editor';

const WEEKDAYS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 0, label: 'Minggu' },
] as const;

type EditorKey = 'weekly' | 'floor';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editor, setEditor] = useState<EditorKey | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextSettings, nextCategories] = await Promise.all([getSettings(), listCategories()]);
    setSettings(nextSettings);
    setCategories(nextCategories);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [nextSettings, nextCategories] = await Promise.all([getSettings(), listCategories()]);
      if (cancelled) return;
      setSettings(nextSettings);
      setCategories(nextCategories);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: Parameters<typeof updateSettings>[0]) {
    const next = await updateSettings(patch);
    setSettings(next);
  }

  async function handleAddCategory() {
    const name = newCategory.trim();
    if (name === '' || busy) return;
    setBusy(true);
    try {
      await addCategory(name);
      setNewCategory('');
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Gagal menambah kategori', message.includes('UNIQUE') ? 'Nama itu sudah ada.' : message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteCategory(category: Category) {
    void (async () => {
      const count = await countTransactionsByCategory(category.id);
      Alert.alert(
        `Hapus "${category.name}"?`,
        count > 0
          ? `${count} transaksi akan kehilangan kategori (nominalnya tetap tersimpan).`
          : 'Kategori ini belum dipakai transaksi.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Hapus',
            style: 'destructive',
            onPress: async () => {
              await deleteCategory(category.id);
              await load();
            },
          },
        ],
      );
    })();
  }

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    try {
      const backup = await exportBackup();
      const uri = `${FileSystem.cacheDirectory}budgeting-${todayISO()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: 'Simpan atau bagikan backup',
        });
      } else {
        Alert.alert('Backup dibuat', uri);
      }
    } catch (error) {
      Alert.alert('Gagal export', messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (busy) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;

      const asset = picked.assets?.[0];
      if (!asset) return;

      const text = await FileSystem.readAsStringAsync(asset.uri);
      const backup = parseBackup(text);

      Alert.alert(
        `Import ${backup.transactions.length} transaksi?`,
        'Semua transaksi, kategori, dan setelan saat ini akan diganti dengan isi file. Tindakan ini tidak bisa dibatalkan.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                const result = await importBackup(backup);
                await load();
                Alert.alert('Selesai', `${result.transactions} transaksi berhasil dipulihkan.`);
              } catch (error) {
                Alert.alert('Gagal import', messageOf(error));
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Gagal import', messageOf(error));
    }
  }

  function confirmResetData() {
    Alert.alert(
      'Hapus semua transaksi?',
      'Seluruh catatan dan riwayat minggu akan hilang. Budget dan kategori tetap ada. Tidak bisa dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus semua',
          style: 'destructive',
          onPress: async () => {
            await deleteAllTransactions();
            Alert.alert('Selesai', 'Semua transaksi sudah dihapus.');
          },
        },
      ],
    );
  }

  if (!settings) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.empty}>Memuat…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const daily = splitDaily(settings.weeklyBudget);
  const floorActive = settings.debtFloor !== null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={space.md}>
            <Text style={styles.back}>Kembali</Text>
          </Pressable>
          <Text style={styles.label}>Pengaturan</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Section title="Budget">
            <Row
              label="Budget mingguan"
              value={formatRp(settings.weeklyBudget)}
              onPress={() => setEditor('weekly')}
            />
            <Row label="Jatah harian" value={formatRp(daily.base)} hint="otomatis dari budget mingguan" />
            <Row
              label="Batas bawah"
              value={floorActive ? formatSignedRp(settings.debtFloor ?? 0) : 'Tanpa batas'}
              onPress={() => setEditor('floor')}
              hint={floorActive ? 'minus tidak bisa lebih dalam dari ini' : 'minus boleh tanpa batas'}
            />
            {floorActive ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    'Matikan batas bawah?',
                    'Minus bisa terbawa tanpa batas ke minggu berikutnya.',
                    [
                      { text: 'Batal', style: 'cancel' },
                      {
                        text: 'Matikan',
                        style: 'destructive',
                        onPress: () => void save({ debtFloor: null }),
                      },
                    ],
                  )
                }
                style={styles.subAction}
              >
                <Text style={styles.subActionText}>Matikan batas bawah</Text>
              </Pressable>
            ) : null}
            <Text style={styles.sectionHint}>
              Pemasukan yang kamu catat menambah pool minggu itu, tidak mengganti budget mingguan.
            </Text>
          </Section>

          <Section title="Mulai minggu">
            <View style={styles.chips}>
              {WEEKDAYS.map((day) => {
                const selected = day.value === settings.weekStart;
                return (
                  <Pressable
                    key={day.value}
                    accessibilityRole="button"
                    onPress={() => void save({ weekStart: day.value })}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.sectionHint}>
              Minggu yang sudah lewat ikut dihitung ulang saat pilihan ini diubah.
            </Text>
          </Section>

          <Section title="Kategori">
            {categories.map((category, index) => (
              <View key={category.id} style={[styles.row, index > 0 && styles.rowBorder]}>
                <Text style={styles.rowLabel}>{category.name}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Hapus kategori ${category.name}`}
                  onPress={() => confirmDeleteCategory(category)}
                  hitSlop={space.md}
                >
                  <Text style={styles.remove}>Hapus</Text>
                </Pressable>
              </View>
            ))}

            <View style={styles.addRow}>
              <TextInput
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder="Kategori baru"
                placeholderTextColor={color.ink3}
                style={styles.input}
                maxLength={24}
                returnKeyType="done"
                onSubmitEditing={() => void handleAddCategory()}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleAddCategory()}
                disabled={newCategory.trim() === '' || busy}
                hitSlop={space.md}
              >
                <Text
                  style={[styles.addButton, (newCategory.trim() === '' || busy) && styles.addDisabled]}
                >
                  Tambah
                </Text>
              </Pressable>
            </View>
          </Section>

          <Section title="Data">
            <Row label="Export backup" value="JSON" onPress={() => void handleExport()} />
            <Row label="Import backup" value="JSON" onPress={() => void handleImport()} />
            <Text style={styles.sectionHint}>
              File JSON berisi transaksi, kategori, dan setelan. Simpan ke Drive supaya aman
              kalau HP hilang.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={confirmResetData}
              style={styles.dangerRow}
            >
              <Text style={styles.danger}>Hapus semua transaksi</Text>
            </Pressable>
            <Text style={styles.sectionHint}>Data tersimpan lokal di HP ini.</Text>
            <Text style={styles.version}>Avaln Kas · v0.1.0</Text>
          </Section>
        </ScrollView>
      </View>

      {editor !== null ? (
        <MoneyEditor
          title={editor === 'floor' ? 'Batas bawah minus' : 'Budget mingguan'}
          initial={
            editor === 'floor'
              ? Math.abs(settings.debtFloor ?? settings.weeklyBudget)
              : settings.weeklyBudget
          }
          negative={editor === 'floor'}
          hint={editor === 'floor' ? 'Masukkan angka positif, disimpan sebagai minus.' : undefined}
          onCancel={() => setEditor(null)}
          onSave={(amount) => {
            const key = editor;
            setEditor(null);
            if (key === 'weekly') void save({ weeklyBudget: amount });
            if (key === 'floor') void save({ debtFloor: amount });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  hint,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={[styles.rowValue, onPress && styles.rowValueAction]}>{value}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.bg,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
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
  empty: {
    ...type.meta,
    color: color.ink3,
    marginTop: space.xxl,
  },
  content: {
    paddingBottom: space.huge,
  },
  section: {
    marginTop: space.xxl,
  },
  sectionBody: {
    marginTop: space.sm,
  },
  sectionHint: {
    ...type.meta,
    color: color.ink3,
    marginTop: space.md,
  },
  row: {
    minHeight: size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  rowBorder: {
    borderTopWidth: size.hairline,
    borderTopColor: color.hairline,
  },
  rowMain: {
    flexShrink: 1,
  },
  rowLabel: {
    ...type.body,
    color: color.ink,
  },
  rowHint: {
    ...type.meta,
    fontSize: 12,
    color: color.ink3,
    marginTop: 2,
  },
  rowValue: {
    ...type.body,
    color: color.ink2,
    fontVariant: ['tabular-nums'],
  },
  rowValueAction: {
    color: color.ink,
    textDecorationLine: 'underline',
    textDecorationColor: color.hairline,
  },
  pressed: {
    opacity: 0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: size.hairline,
    borderColor: color.hairline,
  },
  chipSelected: {
    backgroundColor: color.ink,
    borderColor: color.ink,
  },
  chipText: {
    ...type.meta,
    color: color.ink2,
  },
  chipTextSelected: {
    color: color.bg,
  },
  remove: {
    ...type.meta,
    color: color.danger,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
  input: {
    ...type.body,
    flex: 1,
    backgroundColor: color.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: size.touch,
    color: color.ink,
  },
  addButton: {
    ...type.meta,
    color: color.ink,
    fontWeight: '600',
  },
  addDisabled: {
    color: color.ink3,
  },
  version: {
    ...type.meta,
    fontSize: 12,
    color: color.ink3,
    marginTop: space.xxl,
  },
  subAction: {
    minHeight: size.touch,
    justifyContent: 'center',
  },
  subActionText: {
    ...type.meta,
    color: color.ink2,
  },
  dangerRow: {
    minHeight: size.touch,
    justifyContent: 'center',
  },
  danger: {
    ...type.body,
    color: color.danger,
  },
});
