/**
 * RECETTE DE LA VOIX DU TABLEAU (11/10) : calcul PUR des morceaux gardés et des nouveaux horodatages (aucun mot perdu,
 * ordre gardé, durée cohérente), paramètres envoyés à `studio-rendu` (mode `recette`) et son graphe FFmpeg, machine de
 * la voix (recette appliquée, repli sur la voix brute dit au journal), et la chaîne : vitesse 1,1, mots recalés utilisés
 * par le calage. Doubles seulement : aucun appel.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "../../../src/domaine/types";
import { blancApres, parametresRecette, planRecetteVoix, RECETTE_VOIX_TABLEAU, reglagesRecette } from "../../../src/moteurs/montage-tableau/recette-voix";
import { avancerVoixTableau, REPLI_SANS_HORODATAGE, type EtatVoixTableau } from "../../../src/moteurs/montage-tableau/voix-tableau";
import { fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { argumentsRecette } from "../../../studio-rendu/src/operations/nettoyage-audio";
import { copie, ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

const mot = (m: string, debutSec: number, finSec: number): MotHorodate => ({ mot: m, debutSec, finSec });

/** Une phrase avec des blancs longs, une virgule, deux-points et une fin de phrase. */
const MOTS: MotHorodate[] = [
  mot("Vous", 0.4, 0.6),
  mot("perdez", 0.62, 0.95),
  mot("du", 1.6, 1.7), // blanc de 0,65 s entre deux mots → 0,10 s
  mot("temps,", 1.72, 2.1),
  mot("chaque", 2.9, 3.2), // après une virgule → 0,13 s
  mot("jour :", 3.22, 3.6),
  mot("voici", 4.4, 4.7), // après deux-points → 0,13 s
  mot("pourquoi.", 4.72, 5.2),
  mot("Faites", 6.5, 6.8), // fin de phrase → 0,20 s
  mot("ceci.", 6.82, 7.3),
];

describe("recette · calcul pur", () => {
  const plan = planRecetteVoix(MOTS, 8.5);
  const k = RECETTE_VOIX_TABLEAU.filtres.atempo;

  it("aucun mot perdu, ordre gardé, chaque mot garde sa durée (÷ atempo)", () => {
    expect(plan.mots.map((m) => m.mot)).toEqual(MOTS.map((m) => m.mot));
    for (let i = 1; i < plan.mots.length; i++) expect(plan.mots[i].debutSec).toBeGreaterThanOrEqual(plan.mots[i - 1].finSec);
    plan.mots.forEach((m, i) => expect(m.finSec - m.debutSec).toBeCloseTo((MOTS[i].finSec - MOTS[i].debutSec) / k, 3));
  });

  it("blancs resserrés : 0,10 s entre deux mots, 0,13 s après virgule ou deux-points, 0,30 s après une fin de phrase (÷ atempo)", () => {
    const blanc = (i: number) => +((plan.mots[i + 1].debutSec - plan.mots[i].finSec) * k).toFixed(3);
    expect(blanc(1)).toBeCloseTo(0.1, 3);
    expect(blanc(3)).toBeCloseTo(0.13, 3);
    expect(blanc(5)).toBeCloseTo(0.13, 3);
    expect(blanc(7)).toBeCloseTo(0.3, 3);
    // Un blanc déjà court n'est jamais allongé.
    expect(blanc(0)).toBeCloseTo(0.02, 3);
    expect(blancApres("fin.")).toBe(0.3);
  });

  it("garde de 0,035 s avant le premier mot, queue de 0,45 s après le dernier ; aucune coupe à moins de 0,035 s d'un mot", () => {
    expect(plan.morceaux[0].debutSec).toBeCloseTo(0.4 - 0.035, 4);
    expect(plan.morceaux.at(-1)!.finSec).toBeCloseTo(7.3 + 0.45, 4);
    // Chaque mot, avec 0,035 s de chaque côté, tient dans un seul morceau gardé.
    for (const m of MOTS) expect(plan.morceaux.some((c) => c.debutSec <= m.debutSec - 0.035 + 1e-9 && c.finSec >= m.finSec + 0.035 - 1e-9), m.mot).toBe(true);
  });

  it("durée cohérente : morceaux ÷ atempo, puis 0,8 s de silence ; le fondu de sortie (0,22 s) finit avec la parole", () => {
    const garde = plan.morceaux.reduce((s, m) => s + m.finSec - m.debutSec, 0);
    expect(plan.dureeResserreeSec).toBeCloseTo(garde, 3);
    expect(plan.dureeSec).toBeCloseTo(garde / k + 0.8, 3);
    expect(plan.mots.at(-1)!.finSec).toBeLessThanOrEqual(plan.dureeSec - 0.8);
    expect(plan.debutFonduSortieSec).toBeCloseTo(garde / k - 0.22, 3);
  });

  it("refuse des horodatages absents ou en désordre (la voix brute sera gardée)", () => {
    expect(() => planRecetteVoix([], 3)).toThrow(/Aucun horodatage/);
    expect(() => planRecetteVoix([mot("a", 1, 1.2), mot("b", 0.5, 0.7)], 3)).toThrow(/désordre/);
  });

  it("paramètres de `studio-rendu` : les filtres de la recette, dans l'ordre, et un graphe FFmpeg sûr", () => {
    const p = parametresRecette(plan);
    expect(p).toMatchObject({ mode: "recette", fonduMs: 6, fonduSortieSec: 0.22, silenceFinSec: 0.8 });
    expect(p.filtres).toBe("atempo=1,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3,loudnorm=I=-14:TP=-1.5:LRA=7");
    const args = argumentsRecette("/tmp/source", "/tmp/sortie.wav", p);
    const graphe = args[args.indexOf("-filter_complex") + 1];
    expect(graphe.match(/\[0:a\]atrim=/g)).toHaveLength(plan.morceaux.length);
    expect(graphe).toContain(`concat=n=${plan.morceaux.length}:v=0:a=1`);
    expect(graphe).toContain("afade=t=in:d=0.0060");
    // Porte de bruit (14/10, `tests/tableau/souffle-voix`) entre le compresseur et la `loudnorm`.
    expect(graphe).toContain("[c]atempo=1,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3[cp]");
    expect(graphe).toContain("sidechaingate=");
    expect(graphe).toContain("[cg]loudnorm=I=-14:TP=-1.5:LRA=7,aresample=48000,afade=t=out:");
    expect(graphe).toContain("apad=pad_dur=0.8000");
    expect(() => argumentsRecette("/tmp/s", "/tmp/o.wav", { ...p, filtres: "amovie=/etc/passwd" })).toThrow(/non permis/);
  });

  it("un seul fichier de données : la recette validée", () => {
    expect(RECETTE_VOIX_TABLEAU.synthese).toEqual({ fournisseur: "heygen", moteur: "starfish", vitesse: 1, locale: "fr-FR" });
    expect(reglagesRecette()).toMatchObject({ resserrage: { gardeSec: 0.035, blancMotsSec: 0.1, blancVirguleSec: 0.13, blancPhraseSec: 0.3, fonduMs: 6, queueSec: 0.45 }, fin: { fonduSortieSec: 0.22, silenceSec: 0.8 } });
  });
});

describe("recette · machine de la voix et chaîne", () => {
  it("le son brut part à `studio-rendu` (mode recette) et les mots recalés sont rendus", async () => {
    const d = doubles(copie(ficheDemonstration));
    const outils = { ...d.outils.voix, idBase: "tb-essai", texte: () => "x", empreinte: () => "e", caler: () => false };
    const brut = { fichierCle: "studio/dev/brut.mp3", dureeSec: 8.5, mots: MOTS, coutCentimes: 3, fournisseur: "simulation", caracteres: 50 };
    let e: EtatVoixTableau = { phase: "a-analyser", brut };
    e = await avancerVoixTableau(e, outils);
    expect(e.phase).toBe("recette");
    expect(d.soumises.at(-1)?.parametres).toMatchObject({ mode: "recette" });
    e = await avancerVoixTableau(e, outils);
    expect(e.phase).toBe("faite");
    if (e.phase !== "faite") return;
    expect(e.audio.mots).toEqual(planRecetteVoix(MOTS, 8.5).mots);
    expect(e.audio.recette).toEqual({ id: RECETTE_VOIX_TABLEAU.id, appliquee: true });
  });

  it("repli : sans horodatage des mots, la voix brute est gardée et l'audio le dit", async () => {
    const d = doubles(copie(ficheDemonstration));
    const outils = { ...d.outils.voix, idBase: "tb-essai", texte: () => "x", empreinte: () => "e", caler: () => false };
    const brut = { fichierCle: "studio/dev/brut.mp3", dureeSec: 8.5, mots: MOTS, coutCentimes: 3, fournisseur: "simulation", caracteres: 50, approximatif: "non-relie" as const };
    const e = await avancerVoixTableau({ phase: "a-analyser", brut }, outils);
    expect(d.soumises).toHaveLength(0);
    expect(e).toMatchObject({ phase: "faite", audio: { fichierCle: "studio/dev/brut.mp3", mots: MOTS, recette: { appliquee: false, raison: REPLI_SANS_HORODATAGE } } });
  });

  it("la chaîne lit à la vitesse 1,0, applique la recette, et le calage suit les mots recalés", async () => {
    const d = doubles(copie(ficheDemonstration));
    const vitesses: number[] = [];
    const lire = d.outils.voix.voix().lire.bind(d.outils.voix.voix());
    const voix = { ...d.outils.voix.voix(), lire: async (x: Parameters<typeof lire>[0]) => (vitesses.push(x.reglages.vitesse), lire(x)) };
    const r = await fabriquerTableau({ ...d.outils, voix: { ...d.outils.voix, voix: () => voix } });
    expect(vitesses).toEqual([1]);
    expect(d.soumises.filter((x) => x.operation === "nettoyage-audio").map((x) => (x.parametres as { mode: string }).mode)).toEqual(["recette"]);
    expect(r.recetteVoix).toEqual({ id: RECETTE_VOIX_TABLEAU.id, appliquee: true });
    const voixFaite = d.journal.valeur!.etapes.voix!.sortie as { mots: MotHorodate[] };
    const calage = d.journal.valeur!.etapes.calage!.sortie as { fiche: { scenes: { finMs: number }[] } };
    // La dernière scène finit sur le dernier mot recalé (temps du son final).
    expect(Math.abs(calage.fiche.scenes.at(-1)!.finMs / 1000 - voixFaite.mots.at(-1)!.finSec)).toBeLessThan(1.5);
  });
});
