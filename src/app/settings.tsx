import { AiError, GEMINI_MODEL, testGeminiKey } from '@/ai/gemini';
import { clearAiKey, getAiKey, setAiKey } from '@/ai/key';
import * as Application from 'expo-application';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Linking,
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
  getSavingsBalance,
  getSettings,
  importBackup,
  listCategories,
  updateSettings,
  type Category,
  type Settings,
} from '@/db/repo';
import { downloadAndInstall, openInstallPermission } from '@/features/update/install';
import { fetchLatestRelease, type LatestRelease } from '@/features/update/release';
import { isNewerVersion } from '@/features/update/version';
import { pinBudgetWidget } from '@/features/widget/pin';
import { parseBackup } from '@/lib/backup';
import { todayISO } from '@/lib/date';
import { formatRp, formatSignedRp } from '@/lib/money';
import { splitDaily } from '@/logic/rollover';
import { makeThemedStyles, useTheme } from '@/theme/theme';
import { radius, size, space, type, type Palette } from '@/theme/tokens';
import { MoneyEditor } from '@/ui/money-editor';

const THEME_OPTIONS = [
  { value: 'system' as const, label: 'Sistem' },
  { value: 'light' as const, label: 'Terang' },
  { value: 'dark' as const, label: 'Gelap' },
];

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
  const styles = useStyles();
  const { colors, mode, setMode } = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editor, setEditor] = useState<EditorKey | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiKey, setAiKeyState] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [savingsBalance, setSavingsBalance] = useState(0);
  const [updatePhase, setUpdatePhase] = useState<
    'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'opened' | 'error'
  >('idle');
  const [release, setRelease] = useState<LatestRelease | null>(null);
  const [progress, setProgress] = useState(0);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextSettings, nextCategories] = await Promise.all([getSettings(), listCategories()]);
    setSettings(nextSettings);
    setCategories(nextCategories);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [nextSettings, nextCategories, storedKey, nextBalance] = await Promise.all([
        getSettings(),
        listCategories(),
        getAiKey(),
        getSavingsBalance(),
      ]);
      if (cancelled) return;
      setSettings(nextSettings);
      setCategories(nextCategories);
      setAiKeyState(storedKey);
      setSavingsBalance(nextBalance);
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
      Alert.alert(
        'Gagal menambah kategori',
        message.includes('UNIQUE') ? 'Nama itu sudah ada.' : message,
      );
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

  async function handleSaveKey() {
    const value = keyDraft.trim();
    if (value === '') return;
    try {
      await setAiKey(value);
      setAiKeyState(value);
      setEditingKey(false);
      setKeyDraft('');
      setAiMessage('API key tersimpan di perangkat.');
    } catch (error) {
      Alert.alert('Gagal menyimpan key', messageOf(error));
    }
  }

  async function handleTestKey() {
    if (!aiKey || busy) return;
    setBusy(true);
    setAiMessage(null);
    try {
      await testGeminiKey(aiKey);
      setAiMessage('Koneksi ke Gemini berhasil.');
    } catch (error) {
      setAiMessage(error instanceof AiError ? error.message : messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemoveKey() {
    Alert.alert('Hapus API key?', 'Tambah cepat tetap bisa dipakai lewat parser lokal.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await clearAiKey();
          setAiKeyState(null);
          setAiMessage(null);
        },
      },
    ]);
  }

  async function handleCheckUpdate() {
    if (updatePhase === 'checking' || updatePhase === 'downloading') return;

    setUpdatePhase('checking');
    setUpdateMessage(null);
    setRelease(null);

    try {
      const latest = await fetchLatestRelease();
      const current = Application.nativeApplicationVersion ?? '0.0.0';

      if (!isNewerVersion(latest.version, current)) {
        setUpdatePhase('latest');
        setUpdateMessage(`Kamu sudah di versi terbaru (${current}).`);
        return;
      }

      setRelease(latest);
      setUpdatePhase('available');
    } catch (error) {
      setUpdatePhase('error');
      setUpdateMessage(messageOf(error));
    }
  }

  async function handleInstallUpdate() {
    if (!release || updatePhase === 'downloading') return;

    setUpdatePhase('downloading');
    setProgress(0);
    setUpdateMessage(null);

    try {
      await downloadAndInstall(release, setProgress);
      setUpdatePhase('opened');
      setUpdateMessage('Dialog install dibuka. Setujui untuk memperbarui.');
    } catch (error) {
      setUpdatePhase('error');
      setUpdateMessage(messageOf(error));
    }
  }

  async function handlePinWidget() {
    const pinned = await pinBudgetWidget();
    if (!pinned) {
      Alert.alert(
        'Tidak bisa menambah widget',
        'Launcher ini tidak mendukung permintaan pin. Tambahkan manual: tahan home screen → Widgets → Avaln Kas.',
      );
    }
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
            <Row
              label="Jatah harian"
              value={formatRp(daily.base)}
              hint="otomatis dari budget mingguan"
            />
            <Row
              label="Batas bawah"
              value={floorActive ? formatSignedRp(settings.debtFloor ?? 0) : 'Tanpa batas'}
              onPress={() => setEditor('floor')}
              hint={
                floorActive ? 'minus tidak bisa lebih dalam dari ini' : 'minus boleh tanpa batas'
              }
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

          <Section title="Tampilan">
            <View style={styles.chips}>
              {THEME_OPTIONS.map((option) => {
                const selected = option.value === mode;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setMode(option.value)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.sectionHint}>
              “Sistem” mengikuti mode gelap Android. Pilihan disimpan di perangkat ini.
            </Text>
            <Row label="Widget home screen" value="Tambah" onPress={() => void handlePinWidget()} />
            <Text style={styles.sectionHint}>
              Menampilkan sisa hari ini dan sisa minggu. Hanya tersedia di APK, bukan Expo Go.
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
                placeholderTextColor={colors.ink3}
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
                  style={[
                    styles.addButton,
                    (newCategory.trim() === '' || busy) && styles.addDisabled,
                  ]}
                >
                  Tambah
                </Text>
              </Pressable>
            </View>
          </Section>

          <Section title="Pembaruan">
            <Row
              label="Versi terpasang"
              value={Application.nativeApplicationVersion ?? 'tidak diketahui'}
            />
            {Application.applicationId === 'com.avaln.kas' ? (
              <>
                <Row
                  label="Cek update"
                  value={
                    updatePhase === 'checking'
                      ? 'Mengecek…'
                      : updatePhase === 'downloading'
                        ? 'Mengunduh…'
                        : 'Jalankan'
                  }
                  onPress={() => void handleCheckUpdate()}
                />
                {release ? (
                  <View style={styles.updateBox}>
                    <Text style={styles.updateTitle}>{`Versi ${release.version} tersedia`}</Text>
                    {release.notes ? (
                      <Text style={styles.updateNotes} numberOfLines={5}>
                        {release.notes}
                      </Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleInstallUpdate()}
                      disabled={updatePhase === 'downloading'}
                      style={({ pressed }) => [
                        styles.updateButton,
                        updatePhase === 'downloading' && styles.updateButtonBusy,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.updateButtonLabel}>
                        {updatePhase === 'downloading'
                          ? `Mengunduh ${Math.round(progress * 100)}%`
                          : `Unduh & pasang ${release.version}`}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                {updateMessage ? <Text style={styles.sectionHint}>{updateMessage}</Text> : null}
                <Row
                  label="Izin pasang aplikasi"
                  value="Buka"
                  onPress={() =>
                    void openInstallPermission().catch((error) =>
                      Alert.alert('Tidak bisa membuka pengaturan', messageOf(error)),
                    )
                  }
                />
                <Text style={styles.sectionHint}>
                  Updater mengunduh APK dari GitHub Releases. Android tetap menampilkan dialog
                  Install; data lama tidak hilang karena keystore sama.
                </Text>
              </>
            ) : (
              <Text style={styles.sectionHint}>Updater hanya tersedia di APK, bukan Expo Go.</Text>
            )}
          </Section>

          <Section title="Tabungan">
            <Row
              label="Saldo tabungan"
              value={formatRp(savingsBalance)}
              onPress={() => router.push('/savings')}
            />
            <Row
              label="Target tabungan"
              value={settings.savingsTarget > 0 ? formatRp(settings.savingsTarget) : 'Belum diatur'}
              onPress={() => router.push('/savings')}
            />
            <Row
              label="Sweep otomatis"
              value={settings.savingsEnabled ? 'Aktif' : 'Nonaktif'}
              onPress={() => void save({ savingsEnabled: !settings.savingsEnabled })}
            />
            <Text style={styles.sectionHint}>
              Sisa bulan disapu ke tabungan setiap awal bulan (dieksekusi pada awal minggu pertama
              setelah tanggal 1). Saldo minus tidak pernah disapu.
            </Text>
          </Section>

          <Section title="AI (opsional)">
            {aiKey ? (
              <>
                <Row
                  label="Status"
                  value="Aktif"
                  hint={`Gemini · ${GEMINI_MODEL} · key di SecureStore`}
                />
                <Row
                  label="Tes koneksi"
                  value={busy ? 'Menguji…' : 'Jalankan'}
                  onPress={() => void handleTestKey()}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={confirmRemoveKey}
                  style={styles.subAction}
                >
                  <Text style={styles.subActionText}>Hapus API key</Text>
                </Pressable>
              </>
            ) : editingKey ? (
              <>
                <TextInput
                  value={keyDraft}
                  onChangeText={setKeyDraft}
                  placeholder="Tempel API key Gemini"
                  placeholderTextColor={colors.ink3}
                  style={styles.input}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={200}
                />
                <View style={styles.keyActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setEditingKey(false);
                      setKeyDraft('');
                    }}
                    hitSlop={space.sm}
                  >
                    <Text style={styles.subActionText}>Batal</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void handleSaveKey()}
                    disabled={keyDraft.trim() === ''}
                    hitSlop={space.sm}
                  >
                    <Text style={[styles.addButton, keyDraft.trim() === '' && styles.addDisabled]}>
                      Simpan
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Row
                label="API key Gemini"
                value="Belum diatur"
                onPress={() => setEditingKey(true)}
              />
            )}

            {aiMessage ? <Text style={styles.sectionHint}>{aiMessage}</Text> : null}
            <Text style={styles.sectionHint}>
              Tanpa key, Tambah cepat tetap jalan dengan parser lokal (mis. “kopi 18rb”).
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL('https://aistudio.google.com/apikey')}
              hitSlop={space.sm}
            >
              <Text style={styles.link}>Ambil API key di aistudio.google.com/apikey</Text>
            </Pressable>
          </Section>

          <Section title="Data">
            <Row label="Export backup" value="JSON" onPress={() => void handleExport()} />
            <Row label="Import backup" value="JSON" onPress={() => void handleImport()} />
            <Text style={styles.sectionHint}>
              File JSON berisi transaksi, kategori, dan setelan. Simpan ke Drive supaya aman kalau
              HP hilang.
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
  const styles = useStyles();
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
  const styles = useStyles();
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeThemedStyles((c: Palette) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.bg,
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
      color: c.ink2,
      width: 56,
    },
    label: {
      ...type.label,
      color: c.ink3,
    },
    empty: {
      ...type.meta,
      color: c.ink3,
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
    updateBox: {
      marginTop: space.md,
      paddingTop: space.md,
      borderTopWidth: size.hairline,
      borderTopColor: c.hairline,
    },
    updateTitle: {
      ...type.meta,
      color: c.ink,
    },
    updateNotes: {
      ...type.meta,
      fontSize: 12,
      color: c.ink3,
      marginTop: space.xs,
      lineHeight: 18,
    },
    updateButton: {
      marginTop: space.md,
      minHeight: size.touch,
      borderRadius: radius.full,
      backgroundColor: c.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    updateButtonBusy: {
      backgroundColor: c.ink3,
    },
    updateButtonLabel: {
      ...type.meta,
      color: c.bg,
      fontWeight: '600',
    },
    sectionHint: {
      ...type.meta,
      color: c.ink3,
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
      borderTopColor: c.hairline,
    },
    rowMain: {
      flexShrink: 1,
    },
    rowLabel: {
      ...type.body,
      color: c.ink,
    },
    rowHint: {
      ...type.meta,
      fontSize: 12,
      color: c.ink3,
      marginTop: 2,
    },
    rowValue: {
      ...type.body,
      color: c.ink2,
      fontVariant: ['tabular-nums'],
    },
    rowValueAction: {
      color: c.ink,
      textDecorationLine: 'underline',
      textDecorationColor: c.hairline,
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
      borderColor: c.hairline,
    },
    chipSelected: {
      backgroundColor: c.ink,
      borderColor: c.ink,
    },
    chipText: {
      ...type.meta,
      color: c.ink2,
    },
    chipTextSelected: {
      color: c.bg,
    },
    remove: {
      ...type.meta,
      color: c.danger,
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
      backgroundColor: c.sunken,
      borderRadius: radius.md,
      paddingHorizontal: space.lg,
      minHeight: size.touch,
      color: c.ink,
    },
    addButton: {
      ...type.meta,
      color: c.ink,
      fontWeight: '600',
    },
    addDisabled: {
      color: c.ink3,
    },
    version: {
      ...type.meta,
      fontSize: 12,
      color: c.ink3,
      marginTop: space.xxl,
    },
    subAction: {
      minHeight: size.touch,
      justifyContent: 'center',
    },
    subActionText: {
      ...type.meta,
      color: c.ink2,
    },
    keyActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: space.lg,
      marginTop: space.md,
    },
    link: {
      ...type.meta,
      color: c.accent,
      marginTop: space.sm,
    },
    dangerRow: {
      minHeight: size.touch,
      justifyContent: 'center',
    },
    danger: {
      ...type.body,
      color: c.danger,
    },
  }),
);
