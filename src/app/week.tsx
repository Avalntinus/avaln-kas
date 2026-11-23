import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getIncomeBetween, getSettings, getSpendByDate, resolveRolloverIn } from '@/db/repo';
import { addDays, dayName, formatDayMonth, startOfWeek, todayISO, type ISODate } from '@/lib/date';
import { formatRp, formatSignedRp } from '@/lib/money';
import {
  computeWeek,
  dayUsage,
  meterZone,
  type BudgetSettings,
  type DayPoint,
  type WeekComputation,
  type WeekStartDay,
} from '@/logic/rollover';
import { closePastWeeks } from '@/logic/weeks';
import { color, size, space, type } from '@/theme/tokens';
import { AmountText } from '@/ui/amount-text';
import { Meter } from '@/ui/meter';
import { Screen } from '@/ui/screen';

export default function WeekScreen() {
  const [week, setWeek] = useState<WeekComputation | null>(null);
  const [today, setToday] = useState<ISODate>(todayISO());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const current = todayISO();
      const saved = await getSettings();
      const settings: BudgetSettings = {
        dailyTarget: saved.dailyTarget,
        weeklyBudget: saved.weeklyBudget,
        weekStart: saved.weekStart as WeekStartDay,
        debtFloor: saved.debtFloor,
      };

      await closePastWeeks(settings, current);

      const weekStart = startOfWeek(current, settings.weekStart);
      const weekEnd = addDays(weekStart, 6);

      const [spendByDate, income, rolloverIn] = await Promise.all([
        getSpendByDate(weekStart, weekEnd),
        getIncomeBetween(weekStart, weekEnd),
        resolveRolloverIn(weekStart),
      ]);

      if (cancelled) return;
      setToday(current);
      setWeek(
        computeWeek({
          weekStartDate: weekStart,
          budget: settings.weeklyBudget,
          rolloverIn,
          income,
          spendByDate,
          debtFloor: settings.debtFloor,
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!week) {
    return (
      <Screen>
        <Text style={styles.muted}>Memuat…</Text>
      </Screen>
    );
  }

  const weekRatio = week.pool > 0 ? week.spentTotal / week.pool : 1;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={space.md}>
          <Text style={styles.back}>Kembali</Text>
        </Pressable>
        <Text style={styles.label}>Rincian minggu</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.range}>
          {`${formatDayMonth(week.weekStart)} – ${formatDayMonth(week.weekEnd)}`}
        </Text>

        <Text style={[styles.label, styles.heroLabel]}>Sisa minggu</Text>
        <AmountText
          value={week.remaining}
          variant="display"
          tone={week.remaining < 0 ? 'danger' : 'default'}
          style={styles.heroAmount}
        />
        <Text style={styles.subline}>{`dari pool ${formatRp(week.pool)}`}</Text>

        <View style={styles.meterWrap}>
          <Meter ratio={weekRatio} zone={meterZone(weekRatio)} />
        </View>

        <View style={styles.facts}>
          <Fact label="Budget mingguan" value={formatRp(week.budget)} />
          {week.income > 0 ? (
            <Fact label="Pemasukan" value={formatSignedRp(week.income)} tone="accent" />
          ) : null}
          {week.rolloverIn !== 0 ? (
            <Fact
              label="Rollover masuk"
              value={formatSignedRp(week.rolloverIn)}
              tone={week.rolloverIn < 0 ? 'danger' : 'accent'}
            />
          ) : null}
        </View>

        {week.floorApplied ? (
          <Text style={styles.floorNote}>
            {`Batas bawah aktif: sisa minggu dipotong ke ${formatSignedRp(week.rolloverOut)}.`}
          </Text>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.daysHeader}>
          <Text style={styles.label}>Hari</Text>
          <Text style={styles.caption}>terpakai / jatah</Text>
        </View>

        {week.days.map((day) => (
          <DayRow key={day.date} day={day} today={today} />
        ))}

        <View style={styles.divider} />

        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Dibawa ke minggu depan</Text>
          <AmountText
            value={week.rolloverOut}
            variant="meta"
            signed
            tone={week.rolloverOut < 0 ? 'danger' : 'accent'}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function DayRow({ day, today }: { day: DayPoint; today: ISODate }) {
  const isToday = day.date === today;
  const isFuture = day.date > today;
  const usage = dayUsage(day);
  const zone = meterZone(usage);

  return (
    <View style={[styles.day, isToday && styles.dayToday]}>
      <View style={styles.dayTop}>
        <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
          {`${dayName(day.date).slice(0, 3)} ${formatDayMonth(day.date)}`}
          {isToday ? ' · hari ini' : ''}
        </Text>
        <Text style={styles.dayAmount}>
          <Text style={isFuture ? styles.muted : undefined}>{formatRp(day.spent)}</Text>
          <Text style={styles.dayBase}>{` / ${formatRp(day.base)}`}</Text>
        </Text>
      </View>

      <Meter ratio={usage} zone={zone} height={4} />

      {isFuture ? null : (
        <View style={styles.dayBottom}>
          <Text style={styles.dayMeta}>
            {day.carryIn !== 0 ? `masuk ${formatSignedRp(day.carryIn)}` : ''}
          </Text>
          <Text
            style={[
              styles.dayMeta,
              day.carryOut < 0 && styles.dayNegative,
              day.carryOut > 0 && styles.dayPositive,
            ]}
          >
            {`sisa ${formatSignedRp(day.carryOut)}`}
          </Text>
        </View>
      )}
    </View>
  );
}

function Fact({
  label,
  value,
  tone = 'muted',
}: {
  label: string;
  value: string;
  tone?: 'muted' | 'accent' | 'danger';
}) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text
        style={[
          styles.factValue,
          tone === 'accent' && styles.dayPositive,
          tone === 'danger' && styles.dayNegative,
        ]}
      >
        {value}
      </Text>
    </View>
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
  range: {
    ...type.meta,
    color: color.ink3,
    marginTop: space.md,
  },
  heroLabel: {
    marginTop: space.lg,
  },
  heroAmount: {
    fontSize: 40,
    lineHeight: 46,
    marginTop: space.xs,
  },
  subline: {
    ...type.meta,
    color: color.ink2,
    marginTop: space.xs,
  },
  meterWrap: {
    marginTop: space.md,
  },
  facts: {
    marginTop: space.md,
    gap: 2,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  factValue: {
    ...type.meta,
    color: color.ink,
  },
  floorNote: {
    ...type.meta,
    color: color.warn,
    marginTop: space.md,
  },
  divider: {
    height: size.hairline,
    backgroundColor: color.hairline,
    marginTop: space.lg,
  },
  daysHeader: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caption: {
    ...type.meta,
    fontSize: 12,
    color: color.ink3,
  },
  day: {
    marginTop: space.md,
  },
  dayToday: {
    borderLeftWidth: 2,
    borderLeftColor: color.accent,
    paddingLeft: space.md,
    marginLeft: -space.md,
  },
  dayTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  dayLabel: {
    ...type.meta,
    color: color.ink2,
  },
  dayLabelToday: {
    color: color.ink,
    fontWeight: '600',
  },
  dayAmount: {
    ...type.meta,
    color: color.ink,
  },
  dayBase: {
    color: color.ink3,
  },
  dayBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.xs,
    minHeight: 18,
  },
  dayMeta: {
    ...type.meta,
    fontSize: 12,
    color: color.ink3,
  },
  dayPositive: {
    color: color.accent,
  },
  dayNegative: {
    color: color.danger,
  },
  footerRow: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: {
    ...type.meta,
    color: color.ink2,
  },
  muted: {
    ...type.meta,
    color: color.ink2,
  },
});
