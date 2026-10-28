import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GAP_CHOICES } from '../core/breaks';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Field, Micro, Pill, Row, Toggle } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

/**
 * Settings → Features → "Break settings": the eye-care breaks in detail
 * (which breaks, how often, how strict, when they pause, the work hours and
 * the sound), folded under one row. Shown only while eye-care breaks are on
 * in Features, so its own switch never reads on while nothing runs, and
 * reachable by everyone, not only under Advanced.
 */
export function BreakSettingsCard() {
  const app = useApp();
  const br = app.state.breakSettings;
  const t = makeT(app.state.profile.lang);
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        aria-expanded={open}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
        <Ionicons name="timer-outline" size={16} color={C.textDim} />
        <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{t('brk_settings')}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={C.textFaint} />
      </Pressable>
      {open ? (
        <>
          <Divider />
          <Toggle
            title={t('break_monitor')}
            desc={t('break_monitor_desc')}
            on={br.enabled}
            onToggle={() => app.setBreakSettings({ enabled: !br.enabled })}
          />

          <Divider />
          <Micro>{t('brk_kinds')}</Micro>
          {(['micro', 'long', 'posture', 'blink'] as const).map((k) => (
            <View key={k} style={{ gap: 7 }}>
              <Toggle
                title={t(`brk_${k}`)}
                desc={t(`brk_${k}_hint`)}
                on={br[k].enabled}
                onToggle={() => app.setBreakSettings({ [k]: { ...br[k], enabled: !br[k].enabled } } as Partial<typeof br>)}
              />
              {br[k].enabled ? (
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {GAP_CHOICES[k].map((m) => (
                    <Pill
                      key={m}
                      label={`${m} ${t('tile_unit_min')}`}
                      active={br[k].everyMinutes === m}
                      onPress={() => app.setBreakSettings({ [k]: { ...br[k], everyMinutes: m } } as Partial<typeof br>)}
                    />
                  ))}
                </Row>
              ) : null}
            </View>
          ))}

          <Divider />
          <Micro>{t('brk_strictness')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {(['gentle', 'normal', 'strict'] as const).map((s) => (
              <Pill
                key={s}
                label={t(s === 'strict' ? 'brk_strict_mode' : `brk_${s}`)}
                active={br.strictness === s}
                onPress={() => app.setBreakSettings({ strictness: s })}
              />
            ))}
          </Row>
          <Micro>
            {br.strictness === 'gentle'
              ? t('brk_gentle_desc')
              : br.strictness === 'strict'
                ? t('brk_strict_desc')
                : fill(t('brk_normal_desc'), { n: br.maxSkipsPerDay })}
          </Micro>
          {br.strictness === 'normal' ? (
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 3, 5].map((n) => (
                <Pill key={n} label={String(n)} active={br.maxSkipsPerDay === n} onPress={() => app.setBreakSettings({ maxSkipsPerDay: n })} />
              ))}
            </Row>
          ) : null}

          <Divider />
          <Micro>{t('brk_smart_pause')}</Micro>
          <Toggle
            title={t('brk_when_fullscreen')}
            desc={t('brk_fullscreen_desc')}
            on={br.smartPause.whenFullscreen}
            onToggle={() => app.setBreakSettings({ smartPause: { ...br.smartPause, whenFullscreen: !br.smartPause.whenFullscreen } })}
          />
          <Toggle
            title={t('brk_when_oncall')}
            desc={t('brk_oncall_desc')}
            on={br.smartPause.whenOnCall}
            onToggle={() => app.setBreakSettings({ smartPause: { ...br.smartPause, whenOnCall: !br.smartPause.whenOnCall } })}
          />

          <Divider />
          <Toggle
            title={t('brk_schedule')}
            desc={t('brk_schedule_desc')}
            on={br.schedule !== null}
            onToggle={() =>
              app.setBreakSettings({ schedule: br.schedule === null ? { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 } : null })
            }
          />
          {br.schedule ? (
            <Row style={{ gap: 12 }}>
              <Field
                label={t('time_from')}
                value={String(br.schedule.startHour)}
                onChangeText={(v) => app.setBreakSettings({ schedule: { ...br.schedule!, startHour: Number(v) || 0 } })}
                keyboardType="numeric"
              />
              <Field
                label={t('time_to')}
                value={String(br.schedule.endHour)}
                onChangeText={(v) => app.setBreakSettings({ schedule: { ...br.schedule!, endHour: Number(v) || 0 } })}
                keyboardType="numeric"
              />
            </Row>
          ) : null}

          <Divider />
          <Toggle title={t('brk_sound')} desc={t('brk_sound_desc')} on={br.sound} onToggle={() => app.setBreakSettings({ sound: !br.sound })} />

          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>{t('break_compliance')}</Micro>
            <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
              {app.state.breaks.filter((b) => b.action === 'taken').length}
              <Text style={{ color: C.textFaint, fontWeight: '500' }}> / {app.state.breaks.length}</Text>
            </Text>
          </Row>
        </>
      ) : null}
    </Card>
  );
}
