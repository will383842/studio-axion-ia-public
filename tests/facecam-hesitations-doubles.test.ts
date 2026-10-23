/**
 * RAPPORT V6 — P0 n° 7 et 8 « couper bégaiements, hésitations et phrases redites ».
 *  - les « euh » retrouvés dans le son par le studio-aligneur (`source: "acoustique"`, Whisper les efface) sont coupés,
 *    sur la vraie transcription d'IMG_7747 ;
 *  - une phrase (ou une fin de phrase) dite deux fois n'est JAMAIS gardée deux fois : la première est coupée
 *    automatiquement ; le contrôle `phrasesEnDouble` le vérifie et devient une alerte BLOQUANTE (comme les phrases
 *    manquantes, désormais bloquantes aussi).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { calculerCoupes, controlerCoupes, doublesDansLesGardes, gardesApres, motsDuMontage } from "@/briques/coupes";
import { alertesControles } from "@/moteurs/montage-facecam/chaine";

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[] };

/** Mots posés l'un après l'autre (0,3 s par mot, 0,05 s entre deux, `pauses` : blanc avant l'index donné). */
function dire(texte: string, depart = 1, pauses: Record<number, number> = {}): MotHorodate[] {
  let t = depart;
  return texte.split(/\s+/).filter(Boolean).map((mot, i) => {
    t += pauses[i] ?? 0;
    const m = { mot, debutSec: +t.toFixed(3), finSec: +(t + 0.3).toFixed(3) };
    t += 0.35;
    return m;
  });
}

const entendus = (mots: MotHorodate[], plan: ReturnType<typeof calculerCoupes>) => motsDuMontage(mots, plan.gardes).map((m) => m.mot).join(" ");

describe("V6 P0 n° 8 · aucune phrase en double", () => {
  it("vidéo libre : une fin de phrase redite (que la règle « début répété » ne voit pas) est coupée une fois", () => {
    const mots = dire("Ce n'est pas la charge normale d'un dirigeant, c'est du temps qui s'échappe. C'est du temps qui s'échappe, chaque jour, sans bruit.", 1, { 9: 0.8 });
    const plan = calculerCoupes({ mots, dureeSec: 12 });
    const monte = entendus(mots, plan);
    expect(monte.match(/du temps qui s'échappe/g)).toHaveLength(1);
    expect(monte).toContain("C'est du temps qui s'échappe, chaque jour, sans bruit.");
    expect(plan.coupes.some((c) => c.type === "reprise")).toBe(true);
    expect(controlerCoupes(plan, mots).phrasesEnDouble).toEqual([]);
  });

  it("texte validé : la fin de phrase redite après une hésitation n'est gardée qu'une fois", () => {
    const texte = "Ce n'est pas la charge normale d'un dirigeant. C'est du temps qui s'échappe, chaque jour, sans bruit.";
    const mots = dire("Ce n'est pas la charge normale d'un dirigeant. C'est du temps qui s'échappe chaque jour, chaque jour sans bruit. C'est du temps qui s'échappe, chaque jour, sans bruit.", 1, { 8: 0.6, 19: 0.9 });
    const plan = calculerCoupes({ mots, dureeSec: 14, texteValide: texte });
    expect(plan.mode).toBe("texte");
    expect(entendus(mots, plan).match(/temps qui s'échappe/g)).toHaveLength(1);
    expect(controlerCoupes(plan, mots).phrasesEnDouble).toEqual([]);
  });

  it("une répétition VOULUE (écrite deux fois dans le texte validé) est gardée", () => {
    const texte = "Chaque jour, chaque jour qui passe, vous perdez du temps. Chaque jour, chaque jour qui passe, vous perdez de l'argent.";
    const mots = dire(texte, 1, { 9: 0.5 });
    const plan = calculerCoupes({ mots, dureeSec: 12, texteValide: texte });
    expect(entendus(mots, plan).match(/chaque jour qui passe/gi)).toHaveLength(2);
    expect(controlerCoupes(plan, mots).phrasesEnDouble).toEqual([]);
  });

  it("contrôle : une redite rétablie à la main est signalée ; les alertes « en double » et « manquante » sont bloquantes", () => {
    const mots = dire("Ce n'est pas la charge normale d'un dirigeant, c'est du temps qui s'échappe. C'est du temps qui s'échappe, chaque jour, sans bruit.", 1, { 9: 0.8 });
    const plan = calculerCoupes({ mots, dureeSec: 12 });
    const redite = plan.coupes.find((c) => c.type === "reprise")!;
    const ctrl = controlerCoupes(plan, mots, [redite.id]);
    expect(ctrl.phrasesEnDouble.length).toBeGreaterThan(0);
    expect(ctrl.phrasesEnDouble[0].texte).toMatch(/temps qui s'échappe/);
    expect(doublesDansLesGardes(mots, gardesApres(plan, [redite.id]))).toHaveLength(1);
    const coupes = { mode: "libre" as const, texteNonRetrouve: false, liste: plan.coupes, gardes: plan.gardes, consignes: [], dureeSourceSec: 12, dureeSortieSec: 10, resume: "", phrasesManquantes: [2], phrasesEnDouble: ctrl.phrasesEnDouble };
    const alertes = alertesControles(undefined, undefined, coupes, 0);
    expect(alertes.find((a) => /absente/.test(a.message))?.gravite).toBe("bloquant");
    expect(alertes.find((a) => /deux fois/.test(a.message))?.gravite).toBe("bloquant");
  });
});

describe("V6 P0 n° 7 · « euh » retrouvés dans le son, coupés (vraie transcription d'IMG_7747)", () => {
  it("la transcription Whisper réelle n'a aucun « euh » ; ceux ajoutés par la détection acoustique sont tous coupés", () => {
    const mots = reel.mots;
    expect(mots.filter((m) => /^(euh|heu|hum)\W*$/i.test(m.mot))).toHaveLength(0);
    // Trois blancs de la prise où Will a hésité : le studio-aligneur y pose un mot « euh » (`source: "acoustique"`).
    const blancs: { debutSec: number; finSec: number }[] = [];
    for (let i = 1; i < mots.length && blancs.length < 3; i++) {
      const trou = mots[i].debutSec - mots[i - 1].finSec;
      if (trou >= 0.5) blancs.push({ debutSec: +(mots[i - 1].finSec + 0.08).toFixed(3), finSec: +(mots[i].debutSec - 0.08).toFixed(3) });
    }
    expect(blancs).toHaveLength(3);
    const avecEuh = [...mots, ...blancs.map((b) => ({ mot: "euh", ...b, source: "acoustique" }) as MotHorodate)].sort((a, b) => a.debutSec - b.debutSec);
    const plan = calculerCoupes({ mots: avecEuh, dureeSec: 90 });
    expect(entendus(avecEuh, plan)).not.toMatch(/\beuh\b/);
    for (const b of blancs) expect(plan.gardes.some((g) => g.debutSec < b.finSec - 0.05 && g.finSec > b.debutSec + 0.05)).toBe(false);
    expect(controlerCoupes(plan, avecEuh).coupesDansUnMot).toEqual([]);
  });

  it("bégaiement transcrit verbatim (« je je », « le le ») : le premier est coupé", () => {
    const mots = dire("Alors je je voulais vous parler de de la formation.");
    const plan = calculerCoupes({ mots, dureeSec: 6 });
    expect(entendus(mots, plan)).toBe("Alors je voulais vous parler de la formation.");
  });
});
