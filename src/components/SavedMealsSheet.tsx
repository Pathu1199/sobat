import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { SavedMeal } from '../core/types';
import { lineInfo } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Divider, Empty, ListRow } from '../ui/components';
import { withUndoAt } from '../ui/listUndo';
import { Sheet } from '../ui/Sheet';
import { C, S } from '../ui/theme';
import { UndoLine, useUndoable } from './tiles/UndoLine';

/**
 * Me → Saved meals: each meal the person saved, its foods and calories, and a
 * delete. The Undo for a delete is a line in the deleted row's place for five
 * seconds, where the tap was (the app-wide toast would sit behind the open
 * sheet), and it puts the same meal back in that place. They are logged from
 * the ➕ sheet.
 */
export function SavedMealsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const meals = app.state.savedMeals;
  const deleted = useUndoable<{ meal: SavedMeal; index: number }>((d) => fill(t('me_saved_deleted'), { name: d.meal.name }), t('undo'));
  const rows = withUndoAt(meals, deleted.held ? deleted.held.index : null);
  return (
    <Sheet open={open} title={t('me_saved')} onClose={onClose}>
      {rows.length === 0 ? (
        <Empty text={t('me_saved_empty')} />
      ) : (
        rows.map((r, n) => {
          const line = n > 0 ? <Divider /> : null;
          if (r.kind === 'undo') {
            const held = deleted.held;
            return held ? (
              <View key={`undo:${held.meal.id}`}>
                {line}
                <UndoLine
                  text={deleted.text}
                  undoLabel={deleted.undoLabel}
                  onUndo={() => {
                    app.restoreSavedMeal(held.meal, held.index);
                    fb.haptic('light');
                    deleted.clear();
                  }}
                />
              </View>
            ) : null;
          }
          const m = r.item;
          const kcal = m.lines.reduce((a, l) => a + (lineInfo(l, app.planFoods)?.kcal ?? 0), 0);
          return (
            <View key={m.id}>
              {line}
              <ListRow
                title={m.name}
                sub={fill(t(m.lines.length === 1 ? 'add_bar_one' : 'add_bar'), { n: m.lines.length, kcal })}
                actions={
                  <Pressable
                    onPress={() => {
                      app.removeSavedMeal(m.id);
                      deleted.show({ meal: m, index: r.index });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={fill(t('me_saved_delete'), { name: m.name })}
                    style={({ pressed }) => ({ width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.redSoft : 'transparent' })}>
                    <Ionicons name="trash-outline" size={20} color={C.textDim} />
                  </Pressable>
                }
              />
            </View>
          );
        })
      )}
    </Sheet>
  );
}
