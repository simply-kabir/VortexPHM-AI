# VortexPHM-AI Frontend (Next.js 15)

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm run dev                    # http://localhost:3000
npm run build                  # production build (verified)
npx tsc --noEmit               # type check (verified)
```

Routes: `/` landing (always dark) · `/fleet` triage board · `/engine/[id]` cockpit · `/models` · `/audit` · `/viewer` 3D test bench.
The backend must be running (see the root README / Master_Build_Guide.md). Pages show an explicit error or empty state if it is not.

Assets in `public/`: `engine-seq/` (hero frames), `models/engine.glb` + `stations.json` + `CREDITS.txt`.
Asset tools (optional, already run): `tools/process_model.mjs`, `tools/process_frames.py`, `tools/validate_model.mjs`.
Tuning: `src/lib/story.ts` (landing copy and label pins), `src/lib/sequence.ts` (frame counts), `src/lib/stations.ts` (station-sensor map).
