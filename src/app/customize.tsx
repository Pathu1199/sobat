import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { IconButton } from '../components/TopBarActions';
import { extraItem } from '../core/bar';
import { cardsShown, defaultCustomize, moveCard, replaceTab, toggleCard, toggleTab } from '../core/customize';
import { normalizeTabs, TAB_IDS } from '../core/tabs';
import type { TabId, TodayCardId } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Row, Screen, SectionHeader, Small, Toggle } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Customize: the extra tabs (at most two beside Today, ➕ and Me; a third
 * asks, on the page, which one it replaces) and the cards on Today (Calories
 * left fixed at the top; the others switched on or off and moved up or down
 * with buttons, which a screen reader, a keyboard and a mouse all use alike).
 * The day's line is offered while it is switched on in Settings. Reset puts
 * the default back, with Undo. Holding a tab on the bar and Me's Customize
 * row both open it.
 */
export default function CustomizeScreen() {
  const app = useApp();
  const fb = useFeedback();
  const s = app.state.settings;
  const t = makeT(app.state.profile.lang);
  const tabs = normalizeTabs(s.tabs);
  const mantraOn = s.features.mantra;
  const cards = cardsShown(s.todayCards, mantraOn);
  // The day's line, while it is switched off in Settings, is not on the page: moving steps over it.
  const hidden: TodayCardId[] = mantraOn ? [] : ['mantra'];
  const [asking, setAsking] = useState<TabId | null>(null);
  const tabName = (id: TabId) => t(extraItem(id).labelKey);
  const cardName = (id: TodayCardId) => t(`cust_card_${id}`);

  function tapTab(id: TabId) {
    const r = toggleTab(s.tabs, id);
    if (r.full) {
      setAsking(id);
      return;
    }
    setAsking(null);
    app.setSettings({ tabs: r.tabs });
    fb.haptic('light');
  }

  function replace(out: TabId) {
    if (!asking) return;
    app.setSettings({ tabs: replaceTab(s.tabs, out, asking) });
    setAsking(null);
    fb.haptic('light');
  }

  function setCards(todayCards: { id: TodayCardId; on: boolean }[]) {
    app.setSettings({ todayCards });
    fb.haptic('light');
  }

  function reset() {
    const before = { tabs: s.tabs, todayCards: s.todayCards };
    app.setSettings(defaultCustomize());
    setAsking(null);
    fb.notify(t('cust_reset_done'), { label: t('undo'), onPress: () => app.setSettings(before) });
  }

  const locked = (icon: IconName, label: string) => (
    <View accessible accessibilityLabel={`${label}, ${t('cust_locked')}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch }}>
      <Ionicons name={icon} size={20} color={C.textDim} />
      <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{label}</Text>
      <Ionicons name="lock-closed-outline" size={16} color={C.textDim} />
    </View>
  );

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('cust_tabs')} />
        <Card>
          <Small color={C.textDim}>{t('cust_tabs_note')}</Small>
          {locked('today-outline', t('tab_today'))}
          <Divider />
          {locked('add', t('add_food'))}
          <Divider />
          {locked('person-circle-outline', t('tab_me'))}
          {TAB_IDS.map((id) => (
            <View key={id}>
              <Divider />
              <Toggle title={tabName(id)} desc={tabs.includes(id) ? t('cust_on_bar') : fill(t('cust_in_me'), { me: t('tab_me') })} on={tabs.includes(id)} onToggle={() => tapTab(id)} />
            </View>
          ))}
          {asking ? (
            <View style={{ gap: 8, padding: 12, borderRadius: S.radiusSm, borderWidth: 1, borderColor: C.accent }} accessibilityLiveRegion="polite">
              <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body) }}>{fill(t('cust_replace_q'), { tab: tabName(asking) })}</Text>
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                {tabs.map((id) => (
                  <Btn
                    key={id}
                    small
                    tone="soft"
                    label={tabName(id)}
                    accessibilityLabel={fill(t('cust_replace_a11y'), { tab: tabName(asking), out: tabName(id) })}
                    onPress={() => replace(id)}
                  />
                ))}
                <Btn small tone="ghost" label={t('cancel')} onPress={() => setAsking(null)} />
              </Row>
            </View>
          ) : null}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('cust_cards')} />
        <Card>
          {locked('flame-outline', t('cust_card_left'))}
          {cards.on.map((c, i) => (
            <View key={c.id}>
              <Divider />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ flex: 1 }}>
                  <Toggle title={cardName(c.id)} desc={t('cust_on_today')} on onToggle={() => setCards(toggleCard(s.todayCards, c.id))} />
                </View>
                <IconButton
                  name="chevron-up"
                  label={fill(t('cust_move_up'), { card: cardName(c.id) })}
                  onPress={() => setCards(moveCard(s.todayCards, c.id, -1, hidden))}
                  disabled={i === 0}
                />
                <IconButton
                  name="chevron-down"
                  label={fill(t('cust_move_down'), { card: cardName(c.id) })}
                  onPress={() => setCards(moveCard(s.todayCards, c.id, 1, hidden))}
                  disabled={i === cards.on.length - 1}
                />
              </View>
            </View>
          ))}
        </Card>
      </View>

      {cards.off.length > 0 || !mantraOn ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title={t('cust_more_cards')} />
          <Card>
            {cards.off.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider /> : null}
                <Toggle title={cardName(c.id)} desc={t('cust_off_today')} on={false} onToggle={() => setCards(toggleCard(s.todayCards, c.id))} />
              </View>
            ))}
            {mantraOn ? null : <Small color={C.textDim}>{t('cust_mantra_note')}</Small>}
          </Card>
        </View>
      ) : null}

      <Btn tone="ghost" label={t('cust_reset')} onPress={reset} />
    </Screen>
  );
}
