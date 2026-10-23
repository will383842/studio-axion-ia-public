/**
 * Relecture finale de v-6e4a06b9c718 (23/10/2026) : la mise en scène rejouée avec les VRAIES données de la vidéo
 * (carte, script, voix mot à mot, fins, recette de variété), pour les 3 versions (LinkedIn, Instagram, Facebook, 9:16).
 *
 * Lot 1 : cause B (écran « 80% — Réponse connue » : l'unité devenait « % — Réponse connue ») et cause C (« Envoyé équipe
 * concernée » paraissait APRÈS l'alerte Telegram). Aucun seuil ni aucune exigence de la relecture n'est modifié.
 *
 * La fixture ne porte ni adresse signée, ni clé de stockage, ni secret : seulement ce que `sceneDe` (fabrication.ts) passe à
 * `mettreEnSceneIV`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { recettePourVersion } from "@/moteurs/montage-image-video/variete/tirage";

interface PisteFixture {
  version: string;
  reseaux: string[];
  courte: boolean;
  dureeSec: number;
  finVoixSec: number;
  motsCorps: number;
  mots: { mot: string; debutSec: number; finSec: number }[];
}
interface FinFixture { id: string; muet: boolean }
const F = JSON.parse(readFileSync(join(__dirname, "fixtures", "v-6e4a06b9c718-scene.json"), "utf8")) as {
  videoId: string;
  carte: unknown;
  fiche: unknown;
  plan: { fins: FinFixture[] };
  recette: unknown;
  pistes: PisteFixture[];
  dureesScenes: Record<string, number>;
};

/** Même assemblage que `sceneDe` (fabrication.ts) pour une version longue en 9:16. */
function entreeDe(p: PisteFixture): EntreeMiseEnSceneIV {
  const fin = F.plan.fins.find((f) => f.id === p.version);
  return {
    carte: F.carte,
    fiche: F.fiche,
    voix: { mots: p.mots, motsCorps: p.motsCorps, dureeSec: p.dureeSec, finVoixSec: p.finVoixSec },
    fin: fin && !fin.muet ? fin : null,
    reseaux: p.reseaux,
    bruitagesValides: BRUITAGES_V4_IV,
    variete: recettePourVersion(F.recette as never, p.reseaux as never, "9:16"),
    graine: F.videoId,
  } as unknown as EntreeMiseEnSceneIV;
}

const resultats = new Map<string, ResultatMiseEnSceneIV>();
const resultatDe = (v: string): ResultatMiseEnSceneIV => {
  let r = resultats.get(v);
  if (!r) {
    r = mettreEnSceneIV(entreeDe(F.pistes.find((p) => p.version === v)!));
    resultats.set(v, r);
  }
  return r;
};
const VERSIONS = F.pistes.map((p) => p.version);

describe("v-6e4a06b9c718 : la mise en scène rejouée avec les vraies données", () => {
  it("les 3 versions de la vidéo sont bien dans la fixture", () => {
    expect(VERSIONS).toEqual(["fin-linkedin", "fin-instagram", "fin-facebook"]);
  });

  it.each(VERSIONS)("%s : mêmes durées qu'en production, aucune phrase de refus de la mise en scène", (v) => {
    const r = resultatDe(v);
    expect(r.phrases).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.ligne.dureeSec).toBeCloseTo(F.dureesScenes[v], 2);
  });
});

describe("cause B : l'écran e06 « *80%* — Réponse connue »", () => {
  it.each(VERSIONS)("%s : l'unité est seulement « % » ; « Réponse connue » est une pastille, sans tiret", (v) => {
    const ecrans = resultatDe(v).ligne.blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "ecran" }> => b.sorte === "ecran" && b.ecran.id === "e06");
    expect(ecrans).toHaveLength(1);
    const e = ecrans[0].ecran;
    expect(e.type).toBe("chiffre");
    if (e.type !== "chiffre") return;
    expect(e.nombre).toBe(80);
    expect(e.unite).toBe("%");
    expect(e.pastilles).toContain("Réponse connue");
    expect(e.pastilles[0]).toBe("Réponse connue");
    for (const t of [e.unite, ...e.pastilles]) expect(t).not.toMatch(/[—–]/u);
    expect(e.compteur).toBe(true);
  });
});

describe("cause C : « Envoyé équipe concernée » (n10, écran e11) vient AVANT l'alerte Telegram (n11, écran e12)", () => {
  it.each(VERSIONS)("%s : n10 est posé dans le plan de e11, jamais dans celui de e12", (v) => {
    const { plans, evenements } = resultatDe(v).ligne;
    const planDe = (id: string) => plans.find((p) => p.id === id)!;
    const plansE11 = plans.filter((p) => p.ecran === "e11");
    const plansE12 = plans.filter((p) => p.ecran === "e12");
    expect(plansE11.length).toBeGreaterThan(0);
    expect(plansE12.length).toBeGreaterThan(0);

    const visiblesN10 = evenements.filter((x) => x.ref === "n10" && x.visible).sort((a, b) => a.instantSec - b.instantSec);
    expect(visiblesN10.length).toBeGreaterThan(0);
    // Le premier moment où n10 se voit tombe dans le plan de l'écran e11 (le seul écran qui le cite).
    const premier = visiblesN10[0];
    expect(planDe(premier.plan).ecran).toBe("e11");
    // Et avant le début de l'alerte.
    const debutE12 = Math.min(...plansE12.map((p) => p.debut));
    expect(premier.instantSec).toBeLessThan(debutE12);
    // Rien de n10 n'est posé en « déclencheur » sous la notification.
    expect(evenements.filter((x) => x.ref === "n10" && planDe(x.plan).ecran === "e12")).toEqual([]);
  });

  it.each(VERSIONS)("%s : l'alerte n11 arrive après n10", (v) => {
    const { evenements } = resultatDe(v).ligne;
    const t = (ref: string) => Math.min(...evenements.filter((x) => x.ref === ref && x.visible).map((x) => x.instantSec));
    expect(t("n10")).toBeLessThan(t("n11"));
  });
});
