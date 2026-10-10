import { useApp } from '../App';

export function About() {
  const { go, health, walks } = useApp();
  const species = new Set(walks.flatMap((w) => w.tags)).size;

  return (
    <div className="about">
      <header className="topbar topbar--sub">
        <button className="btn btn--quiet" onClick={() => go('home')}>← home</button>
        <span className="topbar__title">manifesto</span>
        <span />
      </header>

      <article className="manifesto">
        <h1>the screen should be the shortest part.</h1>
        <p>
          Every app you own is optimised to keep you looking. Helio is optimised to <i>end the session early</i>. You
          open it once: a seed (a tiny mission for the real world) is whispered in your ear. Then the screen is done —
          it dims itself into a pocket stone and waits, patiently, while you go be a person outside.
        </p>
        <p>
          When you come back with one photo, a model running <b>on your own machine</b> — open weights, no cloud — decides
          whether what you photographed is really what the seed asked for. Not a like. Not a streak point. A small,
          honest, verifiable act of having been outdoors.
        </p>
        <h2>why open weights are the whole point</h2>
        <ul className="about__list">
          <li><b>it works with no internet.</b> Trails, mountains, dead zones. The verifier lives in your pocket's reach — your laptop, your phone's local model — not in a datacenter that needs two bars.</li>
          <li><b>your world stays yours.</b> Nobody's server gets your photos, your location (which Helio never even asks for), or your habits. The journal is yours to export, encrypt, or lose in a river.</li>
          <li><b>you can change its mind.</b> Swap Gemma for Llama for a model you fine-tuned on your own balcony. Pin the weights, keep them forever — nothing here is rented.</li>
          <li><b>it costs nothing to run.</b> No API meter, no monthly plan, no landlord. A 4GB model on a 5-year-old laptop is enough to send a whole family outside.</li>
        </ul>
        <h2>the quiet mechanic: grass windows</h2>
        <p>
          Helio's dial isn't decoration. A small tabular foundation model (TabPFN) learns from a decade of your city's
          weather — and, over time, from <i>your own</i> walks — to point at the golden hours worth going outside. Personal,
          private, instant, on CPU.
        </p>
        <h2>proof of grass</h2>
        <p>
          No leaderboards, no public profiles. Just a meadow that grows when you do, and a stamp you earned: a local
          vision model looked at what you saw and agreed you were really there.
        </p>
        <p className="about__stats">
          this device: {walks.length} verified walks · {species} kinds of things met · model: {health?.engine ?? 'offline — using hand-written seeds'}
        </p>
        <p className="about__credits">
          Made for the Hacktoberfest Open-Source AI Challenge · Week 1 — Touch Grass. Built on open weights, open
          frameworks, and the radical idea that software can want less of your attention.
        </p>
      </article>
    </div>
  );
}
