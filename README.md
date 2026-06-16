Pengedag Railway Backend ONLY v1.2.1 - Nat-overtid

Denne pakke er kun til Railway backend. Upload kun disse filer til Railway:
- package.json
- package-lock.json
- server.js
- README.md

Start command:
npm run start

Test:
/health
/api/mobile/times

Rettet:
- Vagter over midnat beregnes korrekt.
- Nat-overtid 22:00-06:00 understøttes.
- 22:01-02:01 bliver 4,00 timer og 4,00 nat-overtid, hvis reglen er aktiv.
