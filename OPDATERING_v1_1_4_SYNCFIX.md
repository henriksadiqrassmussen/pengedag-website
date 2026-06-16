# Pengedag Vikarbureau v1.1.4 SyncFix

Rettet:

- Desktop blander ikke længere kun gammelt lokalt mobil-cache uden mulighed for at rydde.
- Ny knap: Synkroniser fra backend.
- Ny knap: Ryd lokale mobilposter.
- Desktop beregner timer fra start/slut/pause, hvis gamle lokale poster mangler calculation.hours.
- Backend har /api/mobile/routes som testoversigt.
- /api/mobile/times bruges som alias til mobile time entries.

Vigtigt:
Hvis backend viser count: 0, men desktop stadig viser gamle poster, er det lokale cacheposter i desktop. Brug Ryd lokale mobilposter eller Synkroniser fra backend.
