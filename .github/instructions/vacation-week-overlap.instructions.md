---
description: "Use when changing vacation/absence selectable days or monthly hour targets. Enforce week-overlap month boundaries instead of sprint-based logic. vacations, absences, selectable days, month overlap, working days, weekly boundaries."
name: "Vacation Week Overlap Rules"
applyTo: "client/src/components/**/*.vue, client/src/composables/**/*.ts, client/src/stores/**/*.ts"
---
# Vacation And Absence Rules

- Do not use sprint-based windows or open-sprint logic for vacation/absence day selection.
- Selectable vacation days must include all working days inside the current month.
- Selectable vacation days may include working days outside the month only if they belong to a week that intersects the current month.
- Compute overlap boundaries from the week of the first day of the month through the week of the last day of the month.
- Exclude weekends from selectable vacation/absence days.
- Monthly/weekly/daily target-hour calculations must discount only vacation days that fall inside their corresponding date range.
- Keep vacation day identity normalized as YYYY-MM-DD and sorted for stable persistence and comparisons.
