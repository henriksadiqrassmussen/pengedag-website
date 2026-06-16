# Pengedag Vikarbureau v1.0 – Godkendelses-klar

Denne version er forberedt til arbejdet frem mod registrering hos Erhvervsstyrelsen.

**Vigtigt:** Programmet er ikke registreret/godkendt endnu. Brug disclaimeren i appen og på hjemmesiden, indtil Erhvervsstyrelsen har registreret systemet.

## Kør desktop
```bash
npm install
npm start
```

## Kør backend
```bash
cd pengedag-backend
npm install
cp .env.example .env
npm start
```

## Nye mapper
- `docs/` – kladder til systembeskrivelse, kravmatrix, IT-sikkerhed, backup og anmeldelse på Virk
- `pengedag-backend/` – backend-skabelon til Railway, login, Stripe, revisor-upload og mobilapp
- `medarbejder-app/` – PWA til medarbejdertimer
- `pengedag-website/` – download-hjemmeside

## Nye sider i desktop
- Godkendelse
- Rettelseslog
- Backup & sikkerhed

# Pengedag Vikarbureau v1.0 Godkendelses-klar

Windows/Electron app til små vikarbureauer, flyttefolk og medarbejderstyring.

## Nyt i v1.0 Godkendelses-klar

- Ny desktop-side: **Overtidsregler**.
- Arbejdsgiver kan indtaste regler én gang:
  - automatisk overtid ja/nej
  - overtid efter X timer pr. dag/vagt
  - overtid efter X timer pr. uge
  - afrunding af overtid
  - standard overtidstimeløn
- Medarbejdere kan have medarbejder-specifik regel for overtid efter timer/dag.
- Desktop-appen beregner automatisk normal timer/overtid på vagter/job.
- Smartphone-appen kan hente overtidsregler fra backend og beregner automatisk overtid.
- Når mobil-timer godkendes i desktop, genberegnes overtid, løn, kundepris, moms og dækningsbidrag ud fra arbejdsgivers regler.
- Mobil-timer viser nu både normal timer og overtid.
- Backend har endpoints til at gemme/hente overtidsregler for medarbejderappen.

## Kør desktop

```bash
npm install
npm start
```

## Kør backend

```bash
cd pengedag-backend
npm install
cp .env.example .env
npm start
```

## Hjemmeside

Upload `pengedag-website/` til dit webhotel. Medarbejderappen ligger under `pengedag-website/medarbejder-app/`.

## Bemærk

Programmet er stadig en lokal regnskabs- og vikarstyringshjælper. Det er ikke et registreret/godkendt bogføringssystem, og løn skal kontrolleres mod skattekort, eIndkomst, feriepenge, ATP og relevante aftaler.


---

## v1.1.3 Samlet compliance-tiltag

Denne pakke tilføjer konkrete tekniske kladder til:

- SAF-T eksport/import
- NemHandel/OIOUBL e-faktura XML
- Hash-baseret uforanderlig rettelseslog
- Permanent bilagsopbevaring med SHA-256
- Automatisk backup-motor
- Databehandleraftale-checkliste
- Revisor/bogholder-testplan

Backend test:

```bash
cd pengedag-backend
npm install
npm run test:compliance
npm start
```

Nye backend endpoints:

```text
POST /api/compliance/saft/export
POST /api/compliance/saft/import
POST /api/compliance/oioubl/invoice
POST /api/compliance/audit
GET  /api/compliance/audit/verify
POST /api/compliance/attachment
POST /api/compliance/backup/run
```

Vigtigt: XML-generering er nu teknisk forberedt, men officielle XSD/schematron-valideringer og ekstern revisor/bogholder-test skal udføres før anmeldelse.
