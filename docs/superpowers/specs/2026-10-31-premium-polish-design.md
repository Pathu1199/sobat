# Premium polish: calmer surfaces, fewer words

Date: 2026-10-31. Status: approved by Varad ("make this app easy to use,
simple, sober, not so unwanted wording; verify and apply").

## What Varad asked for

Looking at the renamed app with real data, Varad wants it easier to use
and more premium: simple, sober, and without words that don't help. The
mockup they approved is in the artifact "Dhyey Premium Screens" and in
`update.md` (section "premium pass"). This spec turns it into rules.

## Rules

### Surfaces

- **Cards have no hairline border.** `Card` in `src/ui/components.tsx` and
  every ad-hoc card style drop `borderWidth`/`borderColor` and take a soft
  shadow: light mode `shadowColor #10211D`, opacity 0.06, radius 12, offset
  (0, 4), elevation 2 on Android; dark mode the same with opacity 0.3. On
  the web, `boxShadow: 0 1px 2px rgba(16,33,29,.06), 0 8px 24px
  rgba(16,33,29,.06)`. New tokens in `theme.ts`: `S.shadow` (style object)
  and `C.pageAlt` (the page background one step lighter than `C.bg`, used
  behind sheets and tiles).
- **Corners:** cards 20, tiles 20, sheets 24 on top, buttons 14, chips 12.
- **Page background** stays `C.bg`; cards are `C.card`. No tinted card
  backgrounds except the current-meal block (`accentSoft`) and the amber
  note.
- **Spacing:** 16 between cards, 16 inside, 24 above the big number, 12
  between the strip and the number. `Screen` keeps the 16 side gutter.

### Today

- **Header:** the day ("शनिवार, ३१ ऑक्टोबर") small and muted above a
  greeting with the user's first name ("शुभ सकाळ, वरद"); the streak as a
  small soft pill at the right. The logo leaves the Today header (the
  name is in the tab title and on Me).
- **Week strip:** no arrows and no date-range label; swipe left or right
  moves a week; day letters small and muted; the day number medium; a dot
  under each day (filled teal = full record, amber = missing, outline =
  planned); today in a soft teal pill. The strip is not inside a card.
- **Calories left:** the number centred at `F.number`, "कॅलरी शिल्लक"
  under it, a 5-pt bar, then one muted line "सुचवलेलं 1,760 · लक्ष्य 1,762
  · प्रथिने 6 / 112 ग्रॅ". Not inside a card.
- **The low-intake warning** (`IntakeCard`) becomes a one-line amber note:
  soft amber background, dark amber text, a △ glyph, text "गेल्या 3
  दिवसांत सरासरी 1,395 kcal, रेषेखाली. आजचं नियोजन पूर्ण खा." in all three
  languages. No red, no left border, no link; tapping it opens the plan.
- **Menu card:** title "आजचं जेवण" (en "Today's meals", hi "आज का खाना")
  instead of "मेन्यू". Rows as now; the current slot's block keeps the
  `accentSoft` fill, with "ठरल्याप्रमाणे खाल्लं" as the one filled button
  and "बदला" as a quiet outline button on a white chip.
- **Tiles** unchanged.
- **Remove from Today:** the "Dhyey is not a doctor…" footer line (it
  stays on Me → Settings → About and on the welcome page), and any hint
  line that tells the user to tap something ("टॅप करा…", "Tap a line to
  log it…").

### Add sheet

- Title "जेवण नोंदवा" stays. Remove the "Dhyey works out the rest" style
  hints and the "Typical home-cooked values; your recipe may differ"
  line under foods (keep it only inside the food detail sheet).
- Section labels are two words at most.

### Progress

- One weight card, not a tile plus a card with the same number: the hero
  card shows the smoothed weight, the 3-week change, the sparkline and the
  goal line. The Weight tile goes; the Streak tile stays.
- Stat cards "Lost / To go / Full days" stay.

### Me

- A header with the first name, "लक्ष्य 80 किलो · आठवड्याला 0.5" under it,
  and the logo at the right in a soft circle.
- Rows keep their icons; the sub-lines under rows are at most one short
  phrase ("हालचाल, योग, झोप, मन" is fine; "टॅब आणि आजच्या पानावरचं कार्ड"
  becomes "टॅब आणि कार्ड").

### Words, everywhere

- **Remove** hint and explainer sentences from the main screens: every
  string that starts with "Tap", "टॅप", "टैप" or tells the user what a
  control does; every "…works out the rest", "…is not a doctor" line
  outside About; every second sentence of a two-sentence card body that
  only explains the first.
- **Shorten** settings descriptions to one line each.
- **Keep** the safety lines where they matter: the helpline card, the
  guardrail replies, the low-intake note, About.
- The i18n keys stay; their values shrink. Dead keys are deleted from all
  three dicts in the same commit. English, Marathi and Hindi change
  together.

## Testing

- Pure helpers (e.g. the amber note text, the header greeting by hour)
  get unit tests. Screens are checked in the web preview at 375 px, light
  and dark, Marathi at text scale 1.25, with screenshots of Today (with
  the seeded store), the add sheet, Progress and Me.
- `npx tsc --noEmit`, `npx expo lint`, `npx vitest run` clean.

## Files

`src/ui/theme.ts`, `src/ui/components.tsx`, `src/ui/tiles.tsx`,
`src/components/WeekStrip.tsx`, `src/components/IntakeCard.tsx`,
`src/components/DayMenu.tsx`, `src/components/AddSheet.tsx`,
`src/app/(tabs)/index.tsx`, `src/app/(tabs)/progress.tsx`,
`src/app/(tabs)/me.tsx`, `src/app/settings.tsx`, `src/i18n/index.ts`,
and their tests.
