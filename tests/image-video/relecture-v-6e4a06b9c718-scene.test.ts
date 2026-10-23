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
import { planEnsemble } from "@/briques/schema-motion/plan-objets";
import { TEMPS_APPARITION, traceFeutre } from "../../studio-rendu/compositions/image-video/variete/apparition/apparition";
import { disposer } from "@/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_IV, ZONE_UTILE_IV } from "@/briques/schema-motion/types";
import { proprietesEcranIV916 } from "@/moteurs/montage-image-video/ecrans-v4";
import { proprietesPleineImage } from "@/moteurs/montage-image-video/emprunts";
import { miseEnPageAuxInstantsIV } from "@/moteurs/montage-image-video/emprise-ligne";
import { instantsClesIV } from "@/moteurs/montage-image-video/relecture-finale";
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

describe("cause F : contrôle « Mise en page » (Q21) aux instants clés, remplissage vertical d'un dossier seul (38,1 s)", () => {
  it.each(VERSIONS)("%s : aucun défaut de mise en page aux instants clés", (v) => {
    const { ligne } = resultatDe(v);
    const instants = instantsClesIV(ligne, F.carte as never).map((i) => i.instantSec);
    expect(instants.length).toBeGreaterThan(0);
    expect(miseEnPageAuxInstantsIV(ligne, instants).flatMap((x) => x.defauts)).toEqual([]);
  });
});

describe("cause G : les écrans v4 en 9:16 restent au-dessus de la bande des sous-titres (le « % » de e06 à 18,6 s)", () => {
  const HAUTEUR = 1920;
  const basDesTextes = (p: Parameters<typeof disposer>[0]) => Math.max(...disposer(p).textes.filter((t) => t.nom !== "marque").map((t) => t.boite.y + t.boite.hauteur));
  const ecransDe = (v: string) => resultatDe(v).ligne.blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "ecran" }> => b.sorte === "ecran");
  const avecFin = (b: Extract<BlocRenduIV, { sorte: "ecran" }>) => ({ ...b.ecran, finMs: b.ecran.debutMs + Math.round((b.fin - b.debut) * 1000) });

  it.each(VERSIONS)("%s : aucun texte d'écran ne descend dans la bande des sous-titres ni sous la zone utile", (v) => {
    const ecrans = ecransDe(v);
    expect(ecrans.length).toBeGreaterThan(0);
    for (const b of ecrans) {
      const bas = basDesTextes(proprietesEcranIV916(avecFin(b)));
      expect(bas, `écran ${b.ecran.id}`).toBeLessThanOrEqual(BANDE_SOUS_TITRES_IV.haut * HAUTEUR);
      expect(bas, `écran ${b.ecran.id}`).toBeLessThanOrEqual(ZONE_UTILE_IV.bas * HAUTEUR + 1);
    }
  });

  it.each(VERSIONS)("%s : témoin — l'ancienne zone « pleine image » du cas concret faisait descendre l'écran e06 dans la bande", (v) => {
    const e06 = ecransDe(v).find((b) => b.ecran.id === "e06")!;
    expect(basDesTextes(proprietesPleineImage({ ecrans: [avecFin(e06)], captures: {} })[0])).toBeGreaterThan(BANDE_SOUS_TITRES_IV.haut * HAUTEUR);
  });
});

describe("cause H : à 22,4 s la carte n05 « Envoyée en 4 sec » a fini son tracé au feutre (APP-B posé en 0,3 s)", () => {
  it("le tracé est entièrement posé 0,30 s après le début de l'apparition (plancher de la relecture des images)", () => {
    expect(traceFeutre(0.3)).toEqual({ contour: 1, blanc: 1, texte: 1, feutre: 0 });
    expect(traceFeutre(0.15).contour).toBeGreaterThan(0.5);
  });
  it("le calendrier garde l'ordre : contour, puis blanc, puis texte, puis le feutre s'en va", () => {
    const F = TEMPS_APPARITION.feutre;
    expect(F.blancDebut).toBeLessThan(F.texteDebut);
    expect(F.blancDebut + F.blanc).toBeLessThanOrEqual(F.texteDebut + F.texte + 1e-9);
    expect(F.sortieDebut + F.sortie).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(F.texteDebut + F.texte).toBeLessThanOrEqual(0.3 + 1e-9);
  });
});

describe("cause I : vue d'ensemble — « Message client » (n01) n'est pas posé à côté de « Chatbot IA » (n02)", () => {
  it.each(VERSIONS)("%s : n02 strictement sous n01 dans chaque vue d'ensemble de la vidéo", (v) => {
    const toiles = resultatDe(v).ligne.blocs.filter((b) => b.sorte === "toile");
    expect(toiles.length).toBeGreaterThan(0);
    for (const b of toiles) {
      const schema = (b as unknown as { proprietes: { schema: Parameters<typeof planEnsemble>[0] } }).proprietes.schema;
      const plan = planEnsemble(schema);
      const n01 = plan.blocs.find((x) => x.id === "n01");
      const n02 = plan.blocs.find((x) => x.id === "n02");
      if (!n01 || !n02) continue;
      expect(n02.y).toBeGreaterThanOrEqual(n01.y + n01.hauteur - 1);
    }
  });
});
