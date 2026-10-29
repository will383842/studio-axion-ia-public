/**
 * 25/10/2026 (prod v-246dda0d1174, version Facebook en lecture unique) : HeyGen horodate « profil. » fin 81,96 s et « Le »
 * début 82,14 s, mais le silence mesuré est 82,06-82,18 s (il dépasse le début de « Le » : horodatage ~0,1 s trop tôt).
 * Deux contrôles refusaient à tort :
 *  1. « phrase sautée » : la fenêtre bornée par les horodatages ne contenait que 0,08 s de silence (< 0,1 s) ;
 *  2. le placement des coupes : la règle « jamais de son retiré » s'appliquait à la traîne de « profil. », la phrase
 *     qu'on veut justement retirer, et empêchait de pousser le début du morceau gardé au silence.
 * Correctif : la fenêtre s'élargit de l'erreur d'horodatage sans entrer dans un mot gardé ; un retrait voulu accepte la
 * traîne du mot sauté (son qui précède le silence), jamais l'attaque du mot gardé.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { REGLES_COUPES_IV, coupesEnPleinSon, paroleRetireeIV, phrasesSauteesSansSilenceIV, placerCoupesIV, type MesureSonIV } from "@/moteurs/montage-image-video/assemblage";
import { RECETTE_VOIX_IV } from "@/moteurs/montage-image-video/assemblage";
import { planRaccordVoix, type Silence } from "@/moteurs/montage-image-video/emprunts";
import { ecransDuScript } from "@/moteurs/montage-image-video/script-colle";

const f = 0.02;
const DUREE = 90;
const n = Math.ceil(DUREE / f);
const SEUIL = -45;

/** Voix à −20 dB, −50 dB dans les silences, traîne de « profil. » décroissante jusqu'au silence. */
function mesureDe(silences: Silence[], traine: Record<number, number>): MesureSonIV {
  const dans = (t: number) => silences.some((z) => t >= z.debutSec - 1e-9 && t < z.finSec - 1e-9);
  const niveaux = Array.from({ length: n }, (_, w) => traine[w] ?? (dans(w * f + f / 2) ? -50 : -20));
  return { silences, silencesBruts: silences, seuilDb: SEUIL, niveaux, fenetreSec: f, paroles: niveaux.map((x) => x > SEUIL) };
}
const fen = (t: number) => Math.round(t / f);

/** Traîne mesurée de « profil. » : −27,5 dB à 81,96 s, puis −30, −34, −36 et −37,9 dB à 82,04 s. */
const TRAINE: Record<number, number> = { [fen(81.96)]: -27.5, [fen(81.98)]: -30, [fen(82.0)]: -34, [fen(82.02)]: -36, [fen(82.04)]: -37.9 };

const mot = (m: string, d: number, e: number): MotHorodate => ({ mot: m, debutSec: d, finSec: e }) as MotHorodate;
/** Comme en prod : seuls les mots GARDÉS sont dans la liste (les mots sautés, 81,04-81,96, en sont absents). */
const MOTS = (debutLe: number, mot1 = "Le"): MotHorodate[] => [
  mot("minutes.", 80.42, 80.7),
  mot(mot1, debutLe, debutLe + (mot1 === "Le" ? 0.06 : 0.4)),
  mot("lien", debutLe + (mot1 === "Le" ? 0.1 : 0.5), debutLe + (mot1 === "Le" ? 0.3 : 0.7)),
  mot("est", debutLe + 0.72, debutLe + 0.8),
  mot("en", debutLe + 0.82, debutLe + 0.9),
  mot("commentaire.", debutLe + 0.92, debutLe + 1.5),
];
const RETRAIT: [number, number][] = [[81.04, 81.96]];

const SIL_AVANT: Silence = { debutSec: 80.72, finSec: 81.02 };
const SIL_REEL: Silence = { debutSec: 82.06, finSec: 82.18 };

function lancer(silences: Silence[], mots: MotHorodate[], debutB: number, mesure = mesureDe(silences, TRAINE)) {
  const plan = {
    ...planRaccordVoix({ mots, dureeSec: DUREE }, undefined, RECETTE_VOIX_IV),
    morceaux: [
      { debutSec: 0, finSec: 81.0, source: 0 as const },
      { debutSec: debutB, finSec: DUREE, source: 0 as const },
    ],
  };
  const s = { corps: silences };
  const d = { corps: DUREE };
  const { plan: p } = placerCoupesIV(plan, { corps: mots }, s, d, REGLES_COUPES_IV, { mesures: { corps: mesure }, retraitsVoulus: RETRAIT, garderPausesSansSilence: true });
  return { plan: p, ms: p.morceaux.filter((x) => !x.silence), hors: coupesEnPleinSon(p, s, d), mesure, mots, silences };
}

describe("phrase sautée dont le silence dépasse l'horodatage du mot gardé (prod v-246dda0d1174)", () => {
  const silences = [SIL_AVANT, SIL_REEL];
  const mots = MOTS(82.14);

  it("contrôle « phrase sautée » : le silence de 0,12 s trouvé dans la fenêtre élargie suffit (avant : refus à 81,96)", () => {
    expect(phrasesSauteesSansSilenceIV(mots, silences, RETRAIT)).toEqual([]);
  });

  it("placement : aucune coupe hors silence, le morceau gardé commence dans le silence, le mot « Le » est entier", () => {
    const { ms, hors, mesure, plan } = lancer(silences, mots, 82.04);
    expect(hors).toEqual([]);
    expect(ms).toHaveLength(2);
    expect(ms[1].debutSec).toBeGreaterThanOrEqual(82.06 - 1e-6);
    expect(ms[1].debutSec).toBeLessThanOrEqual(82.14 + 1e-6);
    // Rien de retiré n'est de la parole hors du retrait voulu.
    expect(paroleRetireeIV(plan, { corps: mesure }, { corps: DUREE }, RETRAIT)).toEqual([]);
  });
});

describe("témoins : ce qui doit rester refusé ou inchangé", () => {
  it("(i) phrase sautée vraiment collée (aucun silence de 0,1 s dans la fenêtre élargie) : toujours refusée", () => {
    const court: Silence = { debutSec: 82.1, finSec: 82.16 };
    const r = phrasesSauteesSansSilenceIV(MOTS(82.14), [SIL_AVANT, court], RETRAIT);
    expect(r).toEqual([{ source: "corps", instantSec: 81.96 }]);
  });

  it("(ii) un silence qui se termine dans l'intervalle retiré (du son du mot gardé) : le début du morceau ne dépasse pas le mot gardé", () => {
    // Un silence de 30 ms puis de la parole (« Le »), le vrai silence est plus loin : y pousser le début retirerait « Le ».
    const bref: Silence = { debutSec: 82.06, finSec: 82.09 };
    const loin: Silence = { debutSec: 82.3, finSec: 82.42 };
    const { ms } = lancer([SIL_AVANT, bref, loin], MOTS(82.14), 82.04);
    expect(ms[1].debutSec).toBeLessThanOrEqual(82.14 + 1e-6);
  });

  it("(iii) ancien cas à 0,30 s d'écart : contrôle et placement inchangés, sans coupe hors silence", () => {
    const sil: Silence = { debutSec: 82.1, finSec: 82.26 };
    const mots = MOTS(82.26);
    expect(phrasesSauteesSansSilenceIV(mots, [SIL_AVANT, sil], RETRAIT)).toEqual([]);
    const { ms, hors } = lancer([SIL_AVANT, sil], mots, 82.2, mesureDe([SIL_AVANT, sil], {}));
    expect(hors).toEqual([]);
    expect(ms[1].debutSec).toBeGreaterThanOrEqual(82.1 - 1e-6);
    expect(ms[1].debutSec).toBeLessThanOrEqual(82.26);
  });

  it("(iv) phrase collée au mot gardé avec un creux de 0,18 s DANS le mot : refusée, et « Pour » n'est jamais retiré", () => {
    const creux: Silence = { debutSec: 82.12, finSec: 82.3 };
    const mots = MOTS(82.06, "Pourtant");
    expect(phrasesSauteesSansSilenceIV(mots, [SIL_AVANT, creux], RETRAIT)).toEqual([{ source: "corps", instantSec: 81.96 }]);
    const { ms } = lancer([SIL_AVANT, creux], mots, 81.96);
    expect(ms[1].debutSec).toBeLessThanOrEqual(82.06 + 1e-6);
  });

  it("(v) la queue du mot gardé qui précède la phrase sautée n'est jamais rognée", () => {
    // « minutes. » horodaté 80,42-80,70 mais dit jusqu'à 80,90 ; occlusive de 0,08 s à 80,70-80,78 ; vraie pause 80,92-81,20.
    const occlusive: Silence = { debutSec: 80.7, finSec: 80.78 };
    const pause: Silence = { debutSec: 80.92, finSec: 81.2 };
    const mots = MOTS(82.14);
    const plan = {
      ...planRaccordVoix({ mots, dureeSec: DUREE }, undefined, RECETTE_VOIX_IV),
      morceaux: [
        { debutSec: 0, finSec: 80.8, source: 0 as const },
        { debutSec: 82.04, finSec: DUREE, source: 0 as const },
      ],
    };
    const sil = [occlusive, pause, SIL_REEL];
    const { plan: p } = placerCoupesIV(plan, { corps: mots }, { corps: sil }, { corps: DUREE }, REGLES_COUPES_IV, { mesures: { corps: mesureDe(sil, TRAINE) }, retraitsVoulus: [[81.2, 81.96]], garderPausesSansSilence: true });
    expect(p.morceaux.filter((x) => !x.silence)[0].finSec).toBeGreaterThanOrEqual(80.9);
  });

  it("(vi) horodatage du mot gardé en RETARD (0,18 s) : creux interne avant son début horodaté, l'attaque « Pour » n'est jamais retirée", () => {
    // « Pourtant » horodaté 82,20-82,60 mais dit dès 82,02 ; creux « Pour|tant » 82,10-82,22 ; voix à −20 dB (plateau, pas une traîne).
    const creux: Silence = { debutSec: 82.1, finSec: 82.22 };
    const sil = [SIL_AVANT, creux];
    const mots = [mot("minutes.", 80.42, 80.7), mot("Pourtant", 82.2, 82.6), mot("lien", 82.7, 82.9)];
    const plan = {
      ...planRaccordVoix({ mots, dureeSec: DUREE }, undefined, RECETTE_VOIX_IV),
      morceaux: [
        { debutSec: 0, finSec: 81.0, source: 0 as const },
        { debutSec: 82.0, finSec: DUREE, source: 0 as const },
      ],
    };
    const { plan: p } = placerCoupesIV(plan, { corps: mots }, { corps: sil }, { corps: DUREE }, REGLES_COUPES_IV, { mesures: { corps: mesureDe(sil, {}) }, retraitsVoulus: RETRAIT, garderPausesSansSilence: true });
    expect(p.morceaux.filter((x) => !x.silence)[1].debutSec).toBeLessThanOrEqual(82.02 + 1e-6);
  });

  it("(vii) un creux de 20 ms (bouche qui se ferme avant le « P ») avant l'attaque d'un mot gardé en retard : l'attaque n'est jamais retirée", () => {
    const creux: Silence = { debutSec: 82.16, finSec: 82.3 };
    const sil = [SIL_AVANT, creux];
    const mots = [mot("minutes.", 80.42, 80.7), mot("Pourtant", 82.3, 82.7), mot("lien", 82.8, 83.0)];
    const plan = {
      ...planRaccordVoix({ mots, dureeSec: DUREE }, undefined, RECETTE_VOIX_IV),
      morceaux: [
        { debutSec: 0, finSec: 81.0, source: 0 as const },
        { debutSec: 82.04, finSec: DUREE, source: 0 as const },
      ],
    };
    const { plan: p } = placerCoupesIV(plan, { corps: mots }, { corps: sil }, { corps: DUREE }, REGLES_COUPES_IV, { mesures: { corps: mesureDe(sil, { ...TRAINE, [fen(82.06)]: -50 }) }, retraitsVoulus: RETRAIT, garderPausesSansSilence: true });
    expect(p.morceaux.filter((y) => !y.silence)[1].debutSec).toBeLessThanOrEqual(82.08 + 1e-6);
  });
});

describe("script collé : la phrase-choc finale reste dite mot pour mot et fait 8 mots au plus", () => {
  const mots = (t: string) => t.split(/\s+/).filter(Boolean);
  const bout = (e: string[][]) => e.map((x) => x.join(" ")).join(" ");
  const SCRIPT = "Vous gérez une petite entreprise et vous perdez du temps sur des tâches répétitives ? Réservez un appel, nous regardons ensemble ce qui peut être automatisé chez vous. Merci pour votre attention aujourd'hui. Un deux trois quatre cinq six sept huit neuf dix onze douze.";

  it("sans ponctuation utile : les 8 derniers mots, tous les mots du script gardés", () => {
    const e = ecransDuScript(SCRIPT);
    expect(mots(bout(e))).toEqual(mots(SCRIPT));
    expect(mots(e.at(-1)!.join(" ")).length).toBeLessThanOrEqual(8);
  });

  it("coupe au dernier signe dont la suite fait 8 mots ou moins", () => {
    const t = "Un deux trois quatre cinq six. Vous perdez du temps chaque jour, alors que tout peut être fait pour vous sans effort ni attente, très vite et bien.";
    const e = ecransDuScript(t);
    expect(e.at(-1)!.join(" ")).toBe("très vite et bien.");
    expect(mots(bout(e))).toEqual(mots(t));
  });

  const SIX = "Un deux trois quatre cinq six. Sept huit neuf dix onze douze. Le client attend. Vous gagnez du temps. Votre équipe respire. ";

  it("script de 6 phrases ou plus finissant par une phrase de 9 à 16 mots avec une virgule : coupée à la virgule, mots identiques", () => {
    const t = `${SIX}Vous perdez du temps chaque jour, alors que tout est fait pour vous.`;
    const e = ecransDuScript(t);
    expect(e.at(-1)!.join(" ")).toBe("alors que tout est fait pour vous.");
    expect(e.at(-2)!.join(" ")).toBe("Vous perdez du temps chaque jour,");
    expect(mots(bout(e))).toEqual(mots(t));
  });

  it("garde le PREMIER signe dont la suite fait 8 mots ou moins (fin la plus longue possible)", () => {
    const t = `${SIX}Vous perdez du temps, chaque jour, tout est fait pour vous.`;
    const e = ecransDuScript(t);
    expect(e.at(-1)!.join(" ")).toBe("chaque jour, tout est fait pour vous.");
    expect(mots(e.at(-1)!.join(" ")).length).toBeLessThanOrEqual(8);
    expect(mots(bout(e))).toEqual(mots(t));
  });

  it("une fin qui dépasserait 80 caractères (texte affiché tronqué) est coupée plus loin, mots intacts", () => {
    const t = `${SIX}Vous perdez du temps, alors qu'automatiquement institutionnalisation extraordinairement incompréhensiblement anticonstitutionnellement.`;
    const e = ecransDuScript(t);
    const fin = e.at(-1)!.join(" ");
    expect(fin.length).toBeLessThanOrEqual(80);
    expect(fin.length).toBeGreaterThan(0);
    expect(t.endsWith(fin)).toBe(true);
    expect(mots(bout(e))).toEqual(mots(t));
  });

  it("au-delà de 60 écrans après la coupe, deux écrans du corps sont fondus : 60 écrans, tête et fin intactes, mots identiques", () => {
    const court = Array.from({ length: 59 }, (_, i) => `Écran numéro ${i + 1}.`).join(" ");
    const t = `${court} Vous perdez du temps chaque jour, alors que tout est fait pour vous.`;
    const e = ecransDuScript(t);
    expect(e).toHaveLength(60);
    expect(e[0]!.join(" ")).toBe("Écran numéro 1.");
    expect(e.at(-1)!.join(" ")).toBe("alors que tout est fait pour vous.");
    expect(mots(bout(e))).toEqual(mots(t));
  });

  it("script sans aucun mot : aucun écran, pas d'erreur", () => {
    expect(ecransDuScript("   ")).toEqual([]);
  });

  it("une phrase finale de 8 mots ou moins reste telle quelle ; la tête est le résultat", () => {
    const t = "Un deux trois quatre cinq six sept. Huit neuf dix onze douze treize. Le client attend. Vous gagnez du temps. Votre client a toujours une réponse.";
    const e = ecransDuScript(t);
    expect(e.at(-1)!.join(" ")).toBe("Votre client a toujours une réponse.");
    expect(mots(bout(e))).toEqual(mots(t));
  });
});
