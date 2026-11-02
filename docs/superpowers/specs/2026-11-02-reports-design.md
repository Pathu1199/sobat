# Reports: day, week and month, and a monthly PDF

Date: 2026-11-02. Status: Part B of the roadmap. Varad asked for "day/week/month
views with comparisons, best day, goals and completion, medals; 'Download
monthly report' as a designed PDF (iPhone: Share sheet)", and said "start 6".

## Why

Progress shows where the user stands now (the weight card, the streak, medals,
the calendar). It cannot answer "how did this week go compared with last
week?" or "what did October look like?". The old Charts page tries to, but it
counts a day as "logged" when it has any calories, which disagrees with the
record (full, partial, empty days) that Today, Progress and the streak use.
Reports answers those questions using the record's own rules, in the app's kind tone.
The monthly PDF is something the user can keep or show a doctor or a friend.

## Rules that hold everywhere

- **One judge.** A day is read the way Progress reads it:
  - the record and its mark come from `useRecordOn` and `markOf`;
  - "perfect" comes from `usePerfectOn`;
  - the average calories use `completeIntake`'s rule (complete days only);
  - the start comes from `stripSince`.
  - Reports never computes a day a second way.
- **Days that count.** A date in the period that is today or before, the
  user's start (`since`) or after, and not a free (off) day. A future date, a
  date before the start and an off day are shown as such and never judged.
- **Kind tone.**
  - A rise in a good count is said in the accent colour ("2 more than last week").
  - A fall is said plainly in muted text ("1 fewer than last week"), never amber or red.
  - "Same as last week" is muted.
  - Calories, protein and weight are given as plain numbers, with no colour or arrow, because more is not better for them.
- **Fair comparisons.**
  - A period that holds today is compared with the same span of the period before it. Monday to today is compared with last Monday to the same weekday. The 1st to today is compared with the same days of last month, cut to that month's length.
  - A period that is over is compared with the whole period before it.
  - Day view compares a day with the day before it.
  - When the earlier span has no day that counts (the user's first week), there is no comparison line.
- **Words.**
  - Every new string goes into en, mr and hi together, with keys prefixed `rep_`.
  - Numbers use `numberText`.
  - Dates use the `formatDay*` and `formatMonthYear` helpers in `core/date.ts`.

## Core: `src/core/report.ts` (pure, tested)

```ts
export type ReportKind = 'day' | 'week' | 'month';
export type ReportPeriod = { kind: ReportKind; start: ISODate; end: ISODate; dates: ISODate[] };

periodOf(kind, anchor): ReportPeriod     // day: [anchor]; week: Monday..Sunday; month: 1st..last
shiftPeriod(p, by: -1 | 1): ReportPeriod
periodSteps(p, today, since): { prev: boolean; next: boolean }   // not before the period holding `since`, not after the one holding today
compareSpan(p, today): ISODate[]          // the earlier dates to compare with (rules above)
countedDates(dates, today, since, offDays): ISODate[]
```

A day's facts, read through injected functions so the core stays pure:

```ts
export type DayFacts = {
  date: ISODate;
  counts: boolean;                 // a day that counts
  mark: StripMark;                 // markOf(recordOn(date), date, today, since).mark
  perfect: boolean;
  kcal: number; protein: number;   // eaten that date
  waterMl: number; walkMin: number;
  jobs: { done: number; total: number; minutes: number };   // dayStatus(abhyas, date, NO_TIMER)
  score: DayScore;                 // core/teacher dayScore, nowMinutes 1440 for a past day, the minute now for today
};

export type ReportInput = {
  today: ISODate; nowMinutes: number; since: ISODate; offDays: number[];
  goals: { kcal: number; protein: number; waterMl: number; walkMin: number };
  factsOn: (date: ISODate) => DayFacts;     // the screen builds this from the store hooks
  weights: WeightLog[];
  perfectWeekMondays: ISODate[];            // perfect-week medals (core/perfect perfectWeeks)
};

export type PeriodReport = {
  period: ReportPeriod;
  days: DayFacts[];                    // every date of the period, in order
  counted: number;                     // days that count
  full: { n: number; of: number };     // fullDays's rule
  perfect: number;
  avgKcal: number | null;              // complete days only, as completeIntake
  avgProtein: number | null;           // the same complete days
  water: { n: number; of: number };    // days the water goal was met, of days that count
  walk: { minutes: number; n: number; of: number };  // total minutes, days the walk goal was met
  jobs: { done: number; due: number; minutes: number } | null;   // null when no job was due
  weight: { from: number; to: number; change: number } | null;   // first and last weigh-in in the period, 2 or more
  best: { date: ISODate; done: number; of: number; perfect: boolean } | null;
  perfectWeeks: number;                // perfect-week medals whose Monday is in the period
};

periodReport(p, input): PeriodReport
compareReport(now: PeriodReport, input): PeriodReport | null   // the same figures over compareSpan; null when it has no day that counts
delta(now: number, before: number): { diff: number; word: 'more' | 'fewer' | 'same' }
```

**Best day.**
- Candidates are the days that count, today included.
- The score is `scoreOf(day.score)`, and a perfect day ranks above any day that isn't.
- A day qualifies only when `score > 0` and `score * 2 >= possible`, as on the teacher card. Here `possible` = meals due + jobs due + 1 for a water goal.
- Ties go to the higher share of what the day held, then to the later day.
- Day view has no best day.

## Screen: `src/app/reports.tsx`, route `/reports?p=week&d=2026-11-02`

From the top:

1. **The period switch.** A `Segmented` control: Day · Week · Month. The default is Week.
2. **The stepper row.**
   - A back chevron, the period's name, and a forward chevron. Each chevron is hidden when `periodSteps` says no.
   - The period's name:
     - Day: "Today", "Yesterday", or `formatDayLong`.
     - Week: "This week", or "27 Oct – 2 Nov".
     - Month: "This month", or "October 2026".
   - A swipe isn't needed.
3. **The headline card.**
   - Week or month:
     - The number at `F.number` reads "5 / 7", with "full days" under it.
     - Then a gold-star line "2 perfect days", shown only when there are any.
     - Then the best day: "Best day: Thursday 30 Oct · 7 of 8 done", with ★ when it was perfect.
   - Day:
     - The day's mark in words: full, partial, empty, free day, or not started yet.
     - Then a ★ line when it was perfect.
4. **The goals card.** One row each for meals, calories, protein, water, walk, routine and weight. Each row has its icon, its label, its value, a 4 pt `Bar` where a goal exists, and under it a comparison line in `Micro`.
   - Week and month:
     - Meals: "5 of 7 full days".
     - Calories: "1,720 avg · goal 1,760".
     - Protein: "84 g avg · goal 112 g".
     - Water: "goal met 4 of 7 days".
     - Walk: "140 min · goal met 3 days".
     - Routine: "18 of 21 jobs · 6 h 10 min".
     - Weight: "−0.6 kg (82.4 → 81.8)".
   - Day:
     - Meals: "3 of 4 logged".
     - Calories: "1,640 of 1,760".
     - Protein: "70 of 112 g".
     - Water: "2.0 of 2.5 L".
     - Walk: "25 of 30 min".
     - Routine: "2 of 3 jobs · 45 min".
     - Weight: the weigh-in that day, if there is one.
   - A row with nothing to say is left out: no job due, no weigh-in, or a walk goal of 0.
5. **The calories chart** (week and month). The existing `BarChart`, with the goal line.
6. **Medals** (week and month). "Perfect weeks: 2", shown only when there are any. The shelf itself stays on Progress.
7. **Month view only.** The "Download monthly report" button (`Btn`, tone primary).
8. **A quiet "All charts" link** to `/growth` at the foot.

**When nothing counts**, the period shows one `Small` line in place of the cards: "Nothing to report for this week yet." A future or free day says so.

**How to get here.**
- On Progress, the "Charts" button becomes "Reports" and opens `/reports`. History stays as it is, and Charts moves to the foot of Reports.
- The weekly report notification's tap route (`tapRoute`, kind `report`) opens `/reports?p=week&d=<the Monday before>` instead of `/progress`. The `PushSchedule` shape doesn't change, so the relay needs no redeploy.

## The monthly PDF

**Content, in the user's language.** It's an A4 portrait page or pages, containing:
- **A header:** the logo mark tile in the palette accent, "Dhyey", "Monthly report · October 2026", and the user's first name.
- **A summary line:** "21 of 31 full days · 6 perfect days · best day Thursday 30 Oct".
- **A grid of eight stats:** the goals card's figures, each with its comparison line against the month before.
- **A calories bar chart:** one bar a day, with the goal line, as inline SVG.
- **A table with one row a day:** date, calories, protein, water, walk, jobs, and the record mark as a word, with ★ for a perfect day. A free day, a day before the start and a future day each show a dash.
- **Medals:** perfect weeks in the month, and how many medals are held now (`useRewards`).
- **A footer:** "Made with Dhyey on 2 Nov 2026 · Dhyey is not a doctor".

**Pieces.**
- **`src/core/reportDoc.ts` (pure, tested).**
  - `reportDoc(report, before, input) → ReportDoc` builds every string already translated and every number already formatted.
  - `reportHtml(doc, colors) → string` writes one HTML document with inline CSS.
    - The fonts are `-apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif`.
    - Every user string is escaped, including the name and job names.
- **`src/core/pdfWriter.ts` (pure, tested).** `pdfFromJpegs(pages: { jpeg: Uint8Array; width: number; height: number }[]) → Uint8Array` writes a PDF 1.4.
  - Each page is one A4 page (595 × 842 pt) holding one DCT (JPEG) image.
  - It has a correct xref table and trailer.
  - It uses no library.
- **`src/services/reportCanvas.web.ts` (web only).** `drawReportPages(doc, colors) → HTMLCanvasElement[]` draws the same document on A4 canvases at 1240 × 1754 px.
  - The browser draws the text, so Marathi and Hindi letters join correctly.
  - The table runs on to further pages as needed.
- **`src/services/reportPdf.ts` (native) and `reportPdf.web.ts` (web).** Both export `prepareReport(doc, colors) → Promise<PreparedReport>` and `shareReport(prepared) → Promise<void>`.
  - Native:
    - `expo-print`'s `printToFileAsync({ html, width: 595, height: 842 })` makes the file.
    - `expo-sharing`'s `shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle })` shares it.
  - Web:
    - The canvases go to JPEG (quality 0.9), then `pdfFromJpegs` turns them into a `File` named `dhyey-report-2026-10.pdf`.
    - Sharing uses `navigator.share({ files })` when `navigator.canShare({ files })` says yes (the iPhone Share sheet).
    - Otherwise it downloads through an object URL.
    - A cancelled share (`AbortError`) is not an error.
  - New dependencies go through `npx expo install expo-print expo-sharing`.
- **Two steps on the web.** Safari only allows a share from a tap, and making the PDF takes a moment.
  1. The first tap reads "Preparing…" while the file is made.
  2. The button then becomes "Share PDF" (or "Save PDF" where the browser cannot share files), and that tap shares at once.
  - On a phone app, one tap is enough.

## Not in this part

- Reports don't change:
  - the old Charts page, apart from the link to it moving;
  - the AI weekly report card;
  - the relay;
  - the stored state.
- No new stored value, and `STATE_VERSION` stays 8.
- No week PDF.
- No sharing of the report to the coach or the AI.

## Testing

- **`report.ts`:**
  - periods across month and year ends;
  - `compareSpan` for a running and a finished week and month, including a 31st compared with a 30-day month;
  - steps at the user's start and at today;
  - days that count;
  - full, perfect and water days;
  - the average on complete days only;
  - jobs and the weight;
  - the best day, including ties, the half rule and a perfect day winning;
  - `delta` words.
- **`reportDoc.ts`:** the strings in en and mr, a name holding `<b>` escaped, a free day as a dash, and the HTML containing the SVG chart.
- **`pdfWriter.ts`:**
  - the file starts with `%PDF-1.4` and ends with `%%EOF`;
  - each xref offset points at `n 0 obj`;
  - the page count matches;
  - the image stream length equals the JPEG length.
- **`tapRoute`:** the report kind goes to `/reports?p=week&d=…`.
- **Screen check:** in the web preview at 375 px, in light and dark, and in Marathi at text scale 1.25, Reports' week, month and day views look right, and the PDF is made, opened and checked. Then `npx tsc --noEmit`, `npx expo lint` (0 warnings), `npx vitest run` and `cd relay && npx vitest run` must all pass.
