/**
 * V4-1, mission C : la voix n'est jamais coupée avant la fin du texte.
 *  - contrôle BLOQUANT sur le son final : la v4 (voix coupée net dans « machine », −20 dB puis silence numérique, 80 ms
 *    avant la fin du mot donnée par HeyGen) est refusée ; une fin de phrase naturelle de la même voix passe ;
 *  - les coupes du montage tombent dans un silence MESURÉ (jamais à l'heure de fin d'un mot du fournisseur).
 * Rouge avant `fin-de-voix.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGLES_FIN_DE_VOIX, REGLES_RECALAGE_CAS_CONCRET, controlerFinDeVoix, lireSilencedetect, lireWav, recalerCoupesSurSilences, silencesMesures } from "@/moteurs/montage-cas-concret/fin-de-voix";
import { RECETTE_VOIX_CAS_CONCRET, planRaccordVoix } from "@/moteurs/montage-cas-concret/recette-voix";

const SONS = join(__dirname, "sons");
const wav = (nom: string) => lireWav(readFileSync(join(SONS, nom)));
/** `v4-fin-coupee.wav` commence à 37,5 s de la v4 ; HeyGen date la fin de « machine. » à 39,810 s (voix4.json ÷ 1,08). */
const FIN_MACHINE = 39.81 - 37.5;
/** `v4-phrase-entiere.wav` commence à 8,5 s ; fin de « signature. » à 10,755 s. */
const FIN_SIGNATURE = 10.755 - 8.5;

/** Son de synthèse : une « syllabe » (sinus 200 Hz) de `de` à `a` s, silence ailleurs ; `fondu` : fin en douceur (s). */
function syllabes(dureeSec: number, morceaux: { de: number; a: number; fondu?: number }[], frequence = 16000, plancher = 0): Float32Array {
  const x = new Float32Array(Math.round(dureeSec * frequence));
  for (let i = 0; i < x.length; i++) {
    const t = i / frequence;
    const m = morceaux.find((s) => t >= s.de && t < s.a);
    let g = 0;
    if (m) g = m.fondu ? Math.min(1, (m.a - t) / m.fondu) : 1;
    x[i] = 0.3 * g * Math.sin(2 * Math.PI * 200 * t) + plancher * Math.sin(i * 12.9898);
  }
  return x;
}

describe("contrôle de la fin de la voix (bloquant)", () => {
  it("la v4 est REFUSÉE : la voix s'arrête net en plein mot, avant la fin du dernier mot", () => {
    const son = wav("v4-fin-coupee.wav");
    const r = controlerFinDeVoix(son, FIN_MACHINE);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.coupeNetteSec).toBeCloseTo(39.73 - 37.5, 1);
    expect(r.raison).toMatch(/coupée net/);
    expect(r.raison).toMatch(/pas dite jusqu'au bout/);
  });

  it("une fin de phrase naturelle de la même voix PASSE", () => {
    const son = wav("v4-phrase-entiere.wav");
    const r = controlerFinDeVoix(son, FIN_SIGNATURE);
    expect(r).toMatchObject({ ok: true });
  });

  it("un son qui finit avant l'heure de fin du dernier mot est refusé, même sans chute brutale", () => {
    const son = { echantillons: syllabes(3, [{ de: 0.5, a: 1.6, fondu: 0.15 }]), frequence: 16000 };
    expect(controlerFinDeVoix(son, 1.6).ok).toBe(true);
    const r = controlerFinDeVoix(son, 2.2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toMatch(/avant la fin du dernier mot/);
  });

  it("une extinction douce finie 0,12 s avant l'heure annoncée du dernier mot PASSE (essai réel du 14/10, fin LinkedIn)", () => {
    const son = { echantillons: syllabes(3, [{ de: 0.5, a: 1.6, fondu: 0.15 }]), frequence: 16000 };
    expect(controlerFinDeVoix(son, 1.72).ok).toBe(true);
  });

  it("une chute brutale au milieu de la piste (raccord du corps et de la fin) est aussi refusée", () => {
    const son = { echantillons: syllabes(4, [{ de: 0.5, a: 1.5 }, { de: 1.7, a: 3.2, fondu: 0.2 }]), frequence: 16000 };
    const r = controlerFinDeVoix(son, 3.2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.coupeNetteSec).toBeCloseTo(1.5, 1);
  });

  it("lit un WAV PCM 16 bits mono", () => {
    const son = wav("v4-phrase-entiere.wav");
    expect(son.frequence).toBe(16000);
    expect(son.echantillons.length / son.frequence).toBeCloseTo(2.45, 1);
  });
});

describe("silences mesurés", () => {
  it("trouve les blancs d'un son (même règle que silencedetect : sous −45 dB pendant 50 ms)", () => {
    const s = silencesMesures({ echantillons: syllabes(3, [{ de: 0.5, a: 1.2 }, { de: 1.5, a: 2.5 }]), frequence: 16000 });
    expect(s.map((x) => [+x.debutSec.toFixed(2), +x.finSec.toFixed(2)])).toEqual([
      [0, 0.5],
      [1.2, 1.5],
      [2.5, 3],
    ]);
  });

  it("lit la sortie de ffmpeg silencedetect", () => {
    const sortie = "[silencedetect @ 0x1] silence_start: 1.2\n[silencedetect @ 0x1] silence_end: 1.5 | silence_duration: 0.3\n[silencedetect @ 0x1] silence_start: 2.5\n";
    expect(lireSilencedetect(sortie, 3)).toEqual([
      { debutSec: 1.2, finSec: 1.5 },
      { debutSec: 2.5, finSec: 3 },
    ]);
  });
});

describe("coupes dans un silence mesuré", () => {
  // Corps : « un deux », HeyGen date la fin de « deux » à 1,10 s mais le mot sonne jusqu'à 1,30 s (0,2 s trop tôt).
  const corps = { mots: [{ mot: "un", debutSec: 0.2, finSec: 0.5 }, { mot: "deux.", debutSec: 0.7, finSec: 1.1 }], dureeSec: 2 };
  const fin = { mots: [{ mot: "trois.", debutSec: 0.3, finSec: 0.8 }], dureeSec: 1.5 };
  const silencesCorps = [{ debutSec: 0, finSec: 0.2 }, { debutSec: 0.5, finSec: 0.7 }, { debutSec: 1.3, finSec: 2 }];
  const silencesFin = [{ debutSec: 0, finSec: 0.3 }, { debutSec: 0.8, finSec: 1.5 }];

  it("la coupe du corps, posée par la recette à 0,10 s après l'heure du fournisseur (en plein mot), recule dans le blanc mesuré", () => {
    const p = planRaccordVoix(corps, fin);
    const dernierCorps = p.morceaux.filter((m) => m.source === 0 && !m.silence).at(-1)!;
    expect(dernierCorps.finSec).toBeCloseTo(1.2, 3); // en plein mot : 1,1 + 0,1
    const r = recalerCoupesSurSilences(p, { corps: corps.mots, fin: fin.mots }, { 0: silencesCorps, 1: silencesFin });
    const recale = r.plan.morceaux.filter((m) => m.source === 0 && !m.silence).at(-1)!;
    expect(recale.finSec).toBeGreaterThanOrEqual(1.3);
    expect(recale.finSec).toBeLessThanOrEqual(1.36);
    expect(r.coupesDeplacees).toBe(1);
  });

  it("les mots qui suivent sont décalés d'autant ; la durée suit ; aucune coupe ne reste en plein son", () => {
    const p = planRaccordVoix(corps, fin);
    const r = recalerCoupesSurSilences(p, { corps: corps.mots, fin: fin.mots }, { 0: silencesCorps, 1: silencesFin });
    const ecart = r.plan.morceaux.filter((m) => m.source === 0 && !m.silence).at(-1)!.finSec - 1.2;
    const k = 1.08;
    expect(r.plan.mots[2].debutSec - p.mots[2].debutSec).toBeCloseTo(ecart / k, 3);
    expect(r.plan.mots[0]).toEqual(p.mots[0]);
    expect(r.plan.dureeSec - p.dureeSec).toBeCloseTo(ecart / k, 3);
    for (const m of r.plan.morceaux.filter((x) => !x.silence)) {
      const s = m.source === 0 ? silencesCorps : silencesFin;
      const dans = (t: number) => s.some((x) => t >= x.debutSec - 1e-6 && t <= x.finSec + 1e-6);
      expect(dans(m.finSec), `fin ${m.finSec}`).toBe(true);
    }
  });

  it("des coupes déjà dans un blanc ne bougent pas", () => {
    const p = planRaccordVoix({ ...corps, mots: [corps.mots[0], { ...corps.mots[1], finSec: 1.3 }] }, fin);
    const r = recalerCoupesSurSilences(p, { corps: [corps.mots[0], { ...corps.mots[1], finSec: 1.3 }], fin: fin.mots }, { 0: silencesCorps, 1: silencesFin });
    expect(r.plan).toEqual(p);
    expect(r.coupesDeplacees).toBe(0);
  });
});

describe("coupe déjà dans un blanc mais à quelques ms de son début (v-0250d2cedaa6)", () => {
  // « deux. » finit à 1,20 s : la recette coupe à 1,30 s ; le blanc mesuré commence à 1,29 s (10 ms avant la coupe).
  const corps = { mots: [{ mot: "un", debutSec: 0.2, finSec: 0.5 }, { mot: "deux.", debutSec: 0.7, finSec: 1.2 }], dureeSec: 2 };
  const fin = { mots: [{ mot: "trois.", debutSec: 0.3, finSec: 0.8 }], dureeSec: 1.5 };
  const silencesFin = [{ debutSec: 0, finSec: 0.3 }, { debutSec: 0.8, finSec: 1.5 }];
  const blancs = (debut: number) => [{ debutSec: 0, finSec: 0.2 }, { debutSec: 0.5, finSec: 0.7 }, { debutSec: debut, finSec: 2 }];
  const dernier = (p: ReturnType<typeof planRaccordVoix>) => p.morceaux.filter((m) => m.source === 0 && !m.silence).at(-1)!;

  it("(a) avec les réglages du cas concret, la coupe garde 0,04 s de blanc ; mots et durée suivent", () => {
    const p = planRaccordVoix(corps, fin);
    expect(dernier(p).finSec).toBeCloseTo(1.3, 3);
    const r = recalerCoupesSurSilences(p, { corps: corps.mots, fin: fin.mots }, { 0: blancs(1.29), 1: silencesFin }, RECETTE_VOIX_CAS_CONCRET, REGLES_RECALAGE_CAS_CONCRET);
    expect(dernier(r.plan).finSec).toBeCloseTo(1.33, 4);
    expect(r.coupesDeplacees).toBe(1);
    expect(r.plan.mots[2].debutSec - p.mots[2].debutSec).toBeCloseTo(0.03 / 1.08, 3);
    expect(r.plan.dureeSec - p.dureeSec).toBeCloseTo(0.03 / 1.08, 3);
    expect(r.plan.mots.slice(0, 2)).toEqual(p.mots.slice(0, 2));
  });

  it("(b) avec les réglages par défaut (image→vidéo), le plan est rendu inchangé", () => {
    const p = planRaccordVoix(corps, fin);
    const r = recalerCoupesSurSilences(p, { corps: corps.mots, fin: fin.mots }, { 0: blancs(1.29), 1: silencesFin });
    expect(r.plan).toEqual(p);
    expect(r.coupesDeplacees).toBe(0);
    expect(REGLES_FIN_DE_VOIX.queueMinDansBlancSec).toBe(0);
  });

  it("(c) une coupe déjà à 0,04 s ou plus du début de son blanc ne bouge pas", () => {
    const p = planRaccordVoix(corps, fin);
    const r = recalerCoupesSurSilences(p, { corps: corps.mots, fin: fin.mots }, { 0: blancs(1.25), 1: silencesFin }, RECETTE_VOIX_CAS_CONCRET, REGLES_RECALAGE_CAS_CONCRET);
    expect(r.plan).toEqual(p);
    expect(r.coupesDeplacees).toBe(0);
  });

  it("(d) morceau suivant collé à la coupe : rien ne bouge", () => {
    const p = planRaccordVoix(corps, fin);
    const d = dernier(p);
    const colle = { ...p, morceaux: [...p.morceaux, { ...d, debutSec: d.finSec, finSec: d.finSec + 0.3 }] };
    const r = recalerCoupesSurSilences(colle, { corps: corps.mots, fin: fin.mots }, { 0: blancs(1.29), 1: silencesFin }, RECETTE_VOIX_CAS_CONCRET, REGLES_RECALAGE_CAS_CONCRET);
    expect(r.plan.morceaux[p.morceaux.indexOf(d)].finSec).toBeCloseTo(d.finSec, 4);
  });

  /** Le vrai cas de LT-02 : deux morceaux du CORPS séparés par un blanc ; `ecart` = distance entre la fin du premier et le début du second. */
  const deuxMorceaux = (ecart: number) => {
    const p = planRaccordVoix(corps, fin);
    const i = p.morceaux.indexOf(dernier(p));
    const d = p.morceaux[i];
    const a = { ...d, finSec: d.finSec };
    const b = { ...d, debutSec: d.finSec + ecart, finSec: d.finSec + ecart + 0.5 };
    return { p, i, plan: { ...p, morceaux: [...p.morceaux.slice(0, i), a, b, ...p.morceaux.slice(i + 1)] } };
  };

  it("(e) deux morceaux du corps séparés par le blanc : la fin du premier garde 0,04 s, le début du second ne bouge pas, les mots suivants avancent", () => {
    const { p, i, plan } = deuxMorceaux(0.5);
    const r = recalerCoupesSurSilences(plan, { corps: corps.mots, fin: fin.mots }, { 0: blancs(1.29), 1: silencesFin }, RECETTE_VOIX_CAS_CONCRET, REGLES_RECALAGE_CAS_CONCRET);
    expect(r.plan.morceaux[i].finSec).toBeCloseTo(1.33, 4);
    expect(r.plan.morceaux[i + 1].debutSec).toBeCloseTo(plan.morceaux[i + 1].debutSec, 4);
    expect(r.coupesDeplacees).toBe(1);
    expect(r.plan.mots[2].debutSec - plan.mots[2].debutSec).toBeCloseTo(0.03 / 1.08, 3);
    expect(r.plan.mots.slice(0, 2)).toEqual(p.mots.slice(0, 2));
  });

  it("(f) morceau suivant à 0,02 s de la coupe : la fin s'arrête au début du suivant", () => {
    const { i, plan } = deuxMorceaux(0.02);
    const r = recalerCoupesSurSilences(plan, { corps: corps.mots, fin: fin.mots }, { 0: blancs(1.29), 1: silencesFin }, RECETTE_VOIX_CAS_CONCRET, REGLES_RECALAGE_CAS_CONCRET);
    expect(r.plan.morceaux[i].finSec).toBeCloseTo(r.plan.morceaux[i + 1].debutSec, 4);
    expect(r.plan.morceaux[i].finSec).toBeCloseTo(plan.morceaux[i].finSec + 0.02, 4);
  });
});
