# Pengedag Vikarbureau v1.1.3 Samlet

Denne ZIP er en samlet version med:

- Desktop-app
- Medarbejderapp/PWA
- Pengedag-hjemmeside
- Railway-backend
- Compliance/GodkendelsesKlar+ filer

## Rettelser i v1.1.3

- Desktop viser nu mobile timer fra `calculation.hours` korrekt.
- Desktop viser overtid fra `calculation.overtimeHours` korrekt.
- Desktop viser også beregnet løn og kundepris inkl. moms i mobil-timetabellen.
- Godkendelse af mobil-timer bruger backend-beregningen, når den findes.
- Backend har alle mobile alias-ruter: `/api/mobile/time-entries`, `/api/mobile/times`, `/api/mobile/timesheets`, `/api/mobile/entries`.
- Backend genberegner timer fra start/slut/pause, så 07:00-08:00 bliver 1 time.
- Status ændres fra Lokal til Afventer i backend-flowet.

## Railway-test

Efter upload af `pengedag-backend` til Railway, test:

```text
/health
/api/mobile/routes
/api/mobile/times
```

`/api/mobile/times` skal svare med JSON og `entries`.
