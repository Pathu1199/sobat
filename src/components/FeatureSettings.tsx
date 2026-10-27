import React from 'react';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Toggle } from '../ui/components';

/**
 * Settings → Features: the parts of the app that stay off unless switched on
 * here, and off everywhere while off: eye-care breaks, the day's line and the
 * plates of "What fits today".
 */
export function FeatureSettings() {
  const app = useApp();
  const f = app.state.settings.features;
  const t = makeT(app.state.profile.lang);
  return (
    <Card>
      <Toggle
        title={t('feat_breaks')}
        desc={t('feat_breaks_desc')}
        on={f.breaks}
        onToggle={() => {
          // Switched on here, the breaks run: the break panel's own switch may have been turned off before.
          if (!f.breaks && !app.state.breakSettings.enabled) app.setBreakSettings({ enabled: true });
          app.setSettings({ features: { ...f, breaks: !f.breaks } });
        }}
      />
      <Divider />
      <Toggle title={t('feat_mantra')} desc={t('feat_mantra_desc')} on={f.mantra} onToggle={() => app.setSettings({ features: { ...f, mantra: !f.mantra } })} />
      <Divider />
      <Toggle title={t('feat_plates')} desc={t('feat_plates_desc')} on={f.autoPlates} onToggle={() => app.setSettings({ features: { ...f, autoPlates: !f.autoPlates } })} />
    </Card>
  );
}
