/**
 * 25/10/2026 : refus de la mise en scène de la vidéo Image→vidéo v-b54bb4798246 (schéma « flux facturation », 941×1672),
 * rejoué avec les vraies données (5 versions : YouTube Shorts, LinkedIn 4:5, Instagram, Facebook 9:16 et 4:5).
 *
 * Cause a) Q12 + Q13 : l'écran e12 (scène « alerte ») a deux lignes « J+30 · Relance niveau 1 » puis « J+60 · … *alerte* ».
 * `enTetes` prend la ligne au mot orange comme titre ; l'autre ligne, PLACÉE AVANT le titre et dite trop tôt pour relancer
 * l'en-tête, était repliée en étiquette du dernier en-tête (à 43,2 s) SANS ses chiffres : « 30 » (dit à 40,4 s) n'était
 * jamais compté à l'écran. Elle est maintenant posée en en-tête sur le mot qui dit son chiffre.
 * Cause b) Q14 : l'écran e02 (« micro-objet », `refs: []`, carte sans bloc « bénéfice ») ne posait rien (pas de bénéfice,
 * pas d'en-tête, pas de comblement) : 5,3 s sans rien de neuf. Il passe en texte seul (« titre »), comme les moments
 * « dossiers / sources / recherche » sans bloc cité.
 *
 * La fixture ne porte ni adresse signée, ni clé de stockage, ni empreinte : seulement ce que `sceneDe` passe à `mettreEnSceneIV`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { compteRythme, instantsVisibles } from "@/moteurs/montage-image-video/controles-scene";
import { ficheMiseEnScene, mettreEnSceneIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { recettePourVersion } from "@/moteurs/montage-image-video/variete/tirage";

interface PisteFixture { version: string; reseaux: string[]; dureeSec: number; finVoixSec: number; motsCorps: number; mots: { mot: string; debutSec: number; finSec: number }[] }
interface FinFixture { id: string; muet: boolean }
const F = JSON.parse(readFileSync(join(__dirname, "fixtures", "facturation-j30-scene.json"), "utf8")) as {
  videoId: string;
  carte: unknown;
  fiche: { ecrans: { id: string; scene: string; refs: string[]; textesEcran: string[] }[] };
  recette: unknown;
  fins: FinFixture[];
  pistes: PisteFixture[];
  versions: { id: string; piste: string; format: "9:16" | "4:5"; reseaux: string[] }[];
};

/** Même assemblage que `sceneDe` (fabrication.ts). */
function entreeDe(v: (typeof F.versions)[number], fiche: unknown = F.fiche): EntreeMiseEnSceneIV {
  const p = F.pistes.find((x) => x.version === v.piste)!;
  const fin = F.fins.find((f) => f.id === v.id);
  return {
    carte: F.carte,
    fiche,
    voix: { mots: p.mots, motsCorps: p.motsCorps, dureeSec: p.dureeSec, finVoixSec: p.finVoixSec },
    fin: fin && !fin.muet ? fin : null,
    reseaux: v.reseaux,
    bruitagesValides: BRUITAGES_V4_IV,
    ...(v.format === "4:5" ? { format: v.format } : {}),
    variete: recettePourVersion(F.recette as never, v.reseaux as never, v.format),
    graine: F.videoId,
  } as unknown as EntreeMiseEnSceneIV;
}

const resultats = new Map<number, ResultatMiseEnSceneIV>();
const resultatDe = (k: number): ResultatMiseEnSceneIV => {
  let r = resultats.get(k);
  if (!r) {
    r = mettreEnSceneIV(entreeDe(F.versions[k]));
    resultats.set(k, r);
  }
  return r;
};
const INDEX = F.versions.map((_, k) => k);

describe("v-b54bb4798246 : la mise en scène passe sur les 5 versions", () => {
  it("la fixture est bien celle du refus (e12 « alerte » J+30/J+60, e02 « micro-objet » sans bloc)", () => {
    expect(F.versions.length).toBe(5);
    const e12 = F.fiche.ecrans.find((e) => e.id === "e12")!;
    expect(e12.scene).toBe("alerte");
    expect(e12.textesEcran[0]).toContain("J+30");
    const e02 = F.fiche.ecrans.find((e) => e.id === "e02")!;
    expect(e02.scene).toBe("micro-objet");
    expect(e02.refs).toEqual([]);
  });

  it.each(INDEX)("version %i : aucun refus", (k) => {
    const r = resultatDe(k);
    expect(r.phrases).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it.each(INDEX)("version %i : « 30 » est à l'écran sur le mot « trente » (fenêtre Q13)", (k) => {
    const { evenements, chiffresDits } = resultatDe(k).ligne;
    const dit = chiffresDits.find((d) => d.cle === "30|nombre" && d.ecran === "e12")!;
    expect(dit).toBeDefined();
    const montre = evenements.some((e) => e.visible && e.chiffres.includes("30|nombre") && e.instantSec >= dit.t - 0.3 - 1e-6 && e.instantSec <= dit.t + 0.6 + 1e-6);
    expect(montre).toBe(true);
  });

  it.each(INDEX)("version %i : « 60 » reste montré sur son mot (rien de retiré)", (k) => {
    const { evenements, chiffresDits } = resultatDe(k).ligne;
    const dit = chiffresDits.find((d) => d.cle === "60|nombre")!;
    expect(evenements.some((e) => e.visible && e.chiffres.includes("60|nombre") && Math.abs(e.instantSec - dit.t) <= 0.6 + 1e-6)).toBe(true);
  });

  it.each(INDEX)("version %i : aucun écart de plus de 2,4 s entre deux changements qui comptent", (k) => {
    const { evenements, finVoixSec } = resultatDe(k).ligne;
    const pts = [0, ...instantsVisibles(evenements, finVoixSec).filter((t) => t > 0), finVoixSec];
    for (let i = 1; i < pts.length; i++) expect(pts[i] - pts[i - 1], `de ${pts[i - 1]} à ${pts[i]}`).toBeLessThanOrEqual(2.4 + 1e-6);
  });

  it.each(INDEX)("version %i : e02 montre son texte « Le *soir*, vous recopiez » (écran de texte)", (k) => {
    const { evenements, plans } = resultatDe(k).ligne;
    expect(plans.filter((p) => p.ecran === "e02").every((p) => p.sorte === "emotion")).toBe(true);
    expect(evenements.some((e) => e.visible && compteRythme(e) && (e as { texte?: string }).texte?.includes("soir"))).toBe(true);
  });
});

describe("garde-fous : ce qui ne doit pas changer", () => {
  it("un « micro-objet » qui cite un bloc « bénéfice » garde sa scène", () => {
    const carte = { ...(F.carte as Record<string, unknown>), noeuds: [...((F.carte as { noeuds: unknown[] }).noeuds), { id: "nb", role: "benefice", ordre: 99, acteur: "inconnu", couleur: "neutre", libelle: "Soirées libérées" }] };
    const fiche = { ...F.fiche, ecrans: F.fiche.ecrans.map((e) => (e.id === "e02" ? { ...e, refs: ["nb"] } : e)) };
    expect(ficheMiseEnScene(fiche as never, carte as never).ecrans.find((e) => e.id === "e02")!.scene).toBe("micro-objet");
  });

  it("un « micro-objet » sans bloc ET sans texte d'écran n'est pas passé en « titre »", () => {
    const fiche = { ...F.fiche, ecrans: F.fiche.ecrans.map((e) => (e.id === "e02" ? { ...e, textesEcran: [] } : e)) };
    expect(ficheMiseEnScene(fiche as never, F.carte as never).ecrans.find((e) => e.id === "e02")!.scene).toBe("micro-objet");
  });
});
