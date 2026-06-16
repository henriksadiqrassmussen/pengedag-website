# Pengedag Backend v1.1.2 MobileAliasFix

Denne pakke retter alias-ruterne til medarbejderappen/desktop:

- GET /api/mobile/time-entries
- GET /api/mobile/times
- GET /api/mobile/timesheets
- GET /api/mobile/entries

Efter upload til Railway skal disse links virke:

- /
- /health
- /api/mobile/routes
- /api/mobile/time-entries
- /api/mobile/times

Upload kun indholdet af `pengedag-backend/` til Railway-service root. Upload ikke node_modules.
