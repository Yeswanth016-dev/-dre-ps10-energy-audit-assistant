# URJA Voice

Voice-based energy audit assistant. Static `index.html` frontend + one serverless function (`api/transcribe.js`) that calls Sarvam Speech-to-Text. Energy and cost maths is deterministic JavaScript, never AI.

## Run locally
```bash
npm i -g vercel          # once
cp .env.example .env.local   # then put your key after SARVAM_API_KEY=
vercel dev               # open http://localhost:3000
```
Do not open `index.html` as `file://`: `/api/transcribe` and microphone access need a server (http://localhost counts as secure).

## Deploy to Vercel
1. Push to GitHub (`.env*` is git-ignored) and import the repo in Vercel, or run `vercel --prod`.
2. Project Settings -> Environment Variables -> add `SARVAM_API_KEY` = your key (Production + Preview + Development). Optional: `SARVAM_STT_MODEL`.
3. Redeploy so the variable is picked up. The frontend calls `/api/transcribe` on the same domain.

## Notes
- Sarvam's REST speech-to-text accepts audio up to about 30 seconds, so recording auto-stops at 30 s. The browser converts the recording to 16 kHz mono WAV before upload.
- Pipeline: tap mic -> record -> `/api/transcribe` -> Sarvam -> transcript -> equipment extraction -> your review -> deterministic calculation.
- Demo transcript loads only from "Use Demo Input" or "Run 2-Minute Demo".

## Troubleshooting
- Microphone denied: click the lock icon in the address bar -> Site settings -> Microphone -> Allow, then reload. Needs HTTPS or localhost.
- 401/403 (shown as "Sarvam authentication failed"): key missing/wrong/expired. Check the Vercel variable name is exactly `SARVAM_API_KEY`, then redeploy.
- 429: rate limit or quota. Wait, or check your Sarvam dashboard.
- "could not process this audio": recording longer than 30 s, empty, or unsupported format.
- "Server is missing SARVAM_API_KEY": variable not set for this environment, or `vercel dev` started without `.env.local`.
