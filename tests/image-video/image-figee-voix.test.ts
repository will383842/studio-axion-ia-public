/**
 * Image figée (décision de Will du 17/10) : une image figée jusqu'à 2,5 s est acceptée tant que la voix parle pendant ce
 * passage (écran tenu le temps d'une phrase, sous-titres qui avancent) ; hors voix (silence, fin), 0,5 s au plus.
 * Mesure PURE (journal de FFmpeg + mots de la ligne), branchée dans le rendu (`figeHorsVoixMaxSec`) et lue par Q24.
 * Le rythme Q14 (2,4 s sans changement compté) n'est pas concerné.
 */
import { describe, expect, it } from "vitest";
import { FIGE_IV, figeHorsVoixMaxSec, lireNoirEtFige, lirePassagesFiges, passagesFigesRefusesIV } from "@/moteurs/montage-image-video/commandes-ffmpeg";
import { MESURES_IV } from "@/moteurs/montage-image-video/controles";
import { parolesDeLaLigneIV } from "@/services/image-video-rendu";

const JOURNAL = [
  "[freezedetect @ 0x2] lavfi.freezedetect.freeze_start: 3",
  "[freezedetect @ 0x2] lavfi.freezedetect.freeze_duration: 1.6",
  "[freezedetect @ 0x2] lavfi.freezedetect.freeze_end: 4.6",
  "[freezedetect @ 0x2] lavfi.freezedetect.freeze_start: 10",
  "[freezedetect @ 0x2] lavfi.freezedetect.freeze_duration: 0.8",
  "[freezedetect @ 0x2] lavfi.freezedetect.freeze_end: 10.8",
  "[freezedetect @ 0x2] lavfi.freezedetect.freeze_start: 19.2",
].join("\n");

/** Mots de 0,25 s séparés de 0,1 s (une phrase dite), de `a` à `b`. */
const phrase = (a: number, b: number) => {
  const mots: { debutSec: number; finSec: number }[] = [];
  for (let t = a; t + 0.25 <= b + 1e-9; t += 0.35) mots.push({ debutSec: t, finSec: t + 0.25 });
  return mots;
};

describe("image figée : passages lus, jugés avec la voix", () => {
  it("lit chaque passage (début, durée) ; le dernier, sans fin, court jusqu'à la fin du fichier", () => {
    expect(lirePassagesFiges(JOURNAL, 20)).toEqual([
      { debutSec: 3, dureeSec: 1.6 },
      { debutSec: 10, dureeSec: 0.8 },
      { debutSec: 19.2, dureeSec: 0.8 },
    ]);
    expect(lirePassagesFiges("", 10)).toEqual([]);
    // La mesure d'avant ne change pas.
    expect(lireNoirEtFige(JOURNAL, 20).figeMaxSec).toBe(1.6);
  });

  it("figé pendant une phrase : seules ses respirations comptent ; figé dans un silence ou à la fin : en entier", () => {
    const paroles = [...phrase(2.5, 5), ...phrase(12, 18)];
    expect(figeHorsVoixMaxSec([{ debutSec: 3, dureeSec: 1.6 }], paroles)).toBeLessThanOrEqual(0.15);
    expect(figeHorsVoixMaxSec([{ debutSec: 10, dureeSec: 0.8 }], paroles)).toBe(0.8);
    expect(figeHorsVoixMaxSec([{ debutSec: 19.2, dureeSec: 0.8 }], paroles)).toBe(0.8);
    // Voix qui s'arrête au milieu du passage : le bout muet compte.
    expect(figeHorsVoixMaxSec([{ debutSec: 4, dureeSec: 2 }], paroles)).toBeCloseTo(6 - 4.85, 3);
    expect(figeHorsVoixMaxSec([], paroles)).toBe(0);
  });

  it("règle : ≤ 2,5 s sous la voix accepté, > 2,5 s refusé même sous la voix, > 0,5 s hors voix refusé", () => {
    expect(FIGE_IV).toEqual({ sousVoixMaxSec: 2.5, horsVoixMaxSec: 0.5 });
    expect(MESURES_IV.noirOuFigeMaxSec).toBe(0.5);
    expect(MESURES_IV.figeSousVoixMaxSec).toBe(2.5);
    const paroles = phrase(0, 30);
    expect(passagesFigesRefusesIV([{ debutSec: 3, dureeSec: 2.5 }], paroles)).toEqual([]);
    expect(passagesFigesRefusesIV([{ debutSec: 3, dureeSec: 2.6 }], paroles)).toEqual([{ debutSec: 3, dureeSec: 2.6 }]);
    expect(passagesFigesRefusesIV([{ debutSec: 31, dureeSec: 0.6 }], paroles)).toEqual([{ debutSec: 31, dureeSec: 0.6 }]);
    expect(passagesFigesRefusesIV([{ debutSec: 31, dureeSec: 0.4 }], paroles)).toEqual([]);
  });

  it("les paroles d'une ligne sont les mots de ses sous-titres", () => {
    const ligne = { sousTitres: { groupes: [{ id: "g1", debutSec: 0, finSec: 1, mots: [{ mot: "Bonjour", debutSec: 0.1, finSec: 0.5, orange: false }] }], bande: { haut: 0.6, bas: 0.67 }, taille: 60, ombre: false as const } };
    expect(parolesDeLaLigneIV(ligne)).toEqual([{ debutSec: 0.1, finSec: 0.5 }]);
  });
});
