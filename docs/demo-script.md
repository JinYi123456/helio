# demo script

## 90-second run (live, from the repo)

Have running: `npm run dev` (agent + web), ollama with `gemma4:e2b` pulled. Open
http://localhost:5183 on a phone-sized window.

1. **boot** (5s) — "helio asks one thing: your name. Nothing else. No account."
2. **dial** (10s) — "This ring is *today*. The gold arc is what TabPFN thinks — it read ten
   years of this city's weather — is the best two hours to be outside. It runs on my
   laptop, on CPU."
3. **door** (15s) — tap the dial. "The mission compiler — a local Gemma through Mastra —
   wrote this. Not a template: it saw the window score, the season, my history." Show
   the whisper, the proof criteria, the "why now" line.
4. **pocket** (10s) — "i'm going" → "THE SCREEN IS DONE NOW. look up." — "This screen is
   the product. The phone goes in the pocket."
5. **proof** (25s) — shutter → pick a photo (use `vibe_images/grass-proof-test_*.png` on a
   laptop without a camera). "A vision model on my machine — Gemma — checks the photo
   against the criteria. No upload. Watch the stamp: 95% sure, and it tells me what it
   saw."
6. **journal** (15s) — automatic haiku + front page. "It wrote a poem about my walk and
   filed it. One page, verified."
7. **meadow** (10s) — "Every verified walk grows the meadow and meets a species. There are
   twelve. The math is simple: the game only advances when you actually went."

If short on time, end on the meadow streak. If long, show settings → "test connection"
(whole stack green, on-device) and the manifesto ("read the full manifesto").

## The fail states are the flex (30s, optional)

- Turn off ollama → ask for a seed → a hand-written seed walks in, labelled "offline — a
  hand-written seed instead". "The product degrades honestly. It never lies about itself."
- Upload the keyboard photo (`notgrass-proof-test_*.png`) → verdict: not grass. "It
  refuses desk photos. That's the whole point."

## Shot list for the article

1. dial with gold window + seed card (hero)
2. door screen — whisper + proof criteria
3. pocket screen — "the screen is done now"
4. proof stamp — "95% sure · checked in 46.4s"
5. journal page with haiku
6. meadow — 1/12 species dex
7. terminal: `npm test` + `npm run test:py` green
8. architecture diagram (README)

## Demo link hygiene

Render free tier sleeps after 15 idle minutes. Wake both services before judging:
open `https://<agent>.onrender.com/api/health` and `https://<tabpfn>.onrender.com/health`
once. Photo proof on the hosted demo works without a camera (file upload). For a local
tunnel instead: `scripts/tunnel.sh` (cloudflared quick tunnel, no account).
