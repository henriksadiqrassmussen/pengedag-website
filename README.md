# Pengedag Backend v0.4

Skabelon til login, 183 dages prøveperiode, Stripe webhook og revisor ZIP upload.

## Kør lokalt
```bash
npm install
cp .env.example .env
npm start
```

## Endpoints
- GET /health
- POST /api/register
- POST /api/login
- GET /api/license
- POST /api/revisor/upload
- POST /api/stripe/webhook

Vigtigt: Brug database, HTTPS, rigtig Stripe-signaturvalidering og persistent upload storage før produktion.


## Mobil medarbejderapp v0.5
Backend har nu endpoints til smartphone-timer og lønseddel-hentning:
- POST /api/mobile/time-entry
- GET /api/mobile/time-entries
- POST /api/mobile/payslip/publish
- GET /api/mobile/payslip/:employeeId
Sæt MOBILE_SHARED_SECRET i .env, hvis mobil-endpoints skal beskyttes med en delt nøgle.


## Overtidsregler v0.5.1

Backend har nu endpoints til arbejdsgiverstyrede overtidsregler:

- `POST /api/mobile/overtime-rules` gemmer standardregler.
- `GET /api/mobile/overtime-rules/:employeeId` henter regler til medarbejderappen.
- `POST /api/mobile/overtime-rules/:employeeId` kan gemme medarbejder-specifikke regler.

Medarbejderappen kan hente reglerne og beregner automatisk normal timer/overtid ud fra arbejdsgiverens indstillinger.
