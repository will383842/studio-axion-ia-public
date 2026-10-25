/**
 * 25/10/2026 : refus Q14 « Rythme » d'une vidéo Image→vidéo (carte « chatbot ») rejouée avec les vraies données.
 *
 * Cause a) l'écran e04 (scène « dossiers », `refs: []`) n'a aucun élément qui compte comme nouveauté : rien de neuf de
 * 12,6 s à 18,9 s (seuil 2,4 s). Même trou que celui du 17/10 pour « micro-objet » sans bénéfice : l'écran passe en
 * texte seul (« titre »), qui pose ses lignes l'une après l'autre.
 * Cause b) `recouper()` ne coupait pas sur un bloc de la carte (rôle « noeud ») : deux longs plans de suite restaient entiers.
 *
 * La fixture ne porte ni adresse signée, ni clé de stockage, ni empreinte : seulement ce que `sceneDe` (fabrication.ts)
 * passe à `mettreEnSceneIV`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { compteRythme, instantsVisibles } from "@/moteurs/montage-image-video/controles-scene";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { recettePourVersion } from "@/moteurs/montage-image-video/variete/tirage";

interface PisteFixture { version: string; reseaux: string[]; dureeSec: number; finVoixSec: number; motsCorps: number; mots: { mot: string; debutSec: number; finSec: number }[] }
interface FinFixture { id: string; muet: boolean }
const F = JSON.parse(readFileSync(join(__dirname, "fixtures", "rythme-moment-vide-scene.json"), "utf8")) as {
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

const NOMS = F.versions.map((v) => `${v.id} ${v.format}`);
const resultats = new Map<string, ResultatMiseEnSceneIV>();
const resultatDe = (k: number): ResultatMiseEnSceneIV => {
  let r = resultats.get(NOMS[k]);
  if (!r) {
    r = mettreEnSceneIV(entreeDe(F.versions[k]));
    resultats.set(NOMS[k], r);
  }
  return r;
};
const INDEX = F.versions.map((_, k) => k);

describe("rythme : un écran « dossiers » sans bloc cité ne laisse plus un trou", () => {
  it("la fixture est bien l'écran e04 « dossiers » sans référence", () => {
    const e04 = F.fiche.ecrans.find((e) => e.id === "e04")!;
    expect(e04.scene).toBe("dossiers");
    expect(e04.refs).toEqual([]);
  });

  it.each(INDEX)("version %i : mise en scène acceptée", (k) => {
    const r = resultatDe(k);
    expect(r.phrases).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it.each(INDEX)("version %i : un instant qui compte tombe entre 12,6 s et 18,9 s", (k) => {
    const { evenements } = resultatDe(k).ligne;
    const dedans = evenements.filter((e) => compteRythme(e) && e.instantSec > 12.6 && e.instantSec < 18.9);
    expect(dedans.length).toBeGreaterThan(0);
  });

  it.each(INDEX)("version %i : aucun écart de plus de 2,4 s entre deux changements qui comptent", (k) => {
    const { evenements, finVoixSec } = resultatDe(k).ligne;
    const pts = [0, ...instantsVisibles(evenements, finVoixSec).filter((t) => t > 0), finVoixSec];
    for (let i = 1; i < pts.length; i++) expect(pts[i] - pts[i - 1], `de ${pts[i - 1]} à ${pts[i]}`).toBeLessThanOrEqual(2.4 + 1e-6);
  });

  it.each(INDEX)("version %i : jamais deux plans de suite de plus de 4 s", (k) => {
    const { plans, finVoixSec } = resultatDe(k).ligne;
    const duree = (p: { debut: number; fin: number }) => Math.min(p.fin, finVoixSec) - p.debut;
    for (let i = 1; i < plans.length; i++) expect(duree(plans[i]) > 4 + 1e-6 && duree(plans[i - 1]) > 4 + 1e-6, `${plans[i - 1].id} puis ${plans[i].id}`).toBe(false);
  });

  it.each(INDEX)("version %i : l'écran e04 est mis en scène comme un écran de texte (sorte « emotion »)", (k) => {
    const plansE04 = resultatDe(k).ligne.plans.filter((p) => p.ecran === "e04");
    expect(plansE04.length).toBeGreaterThan(0);
    for (const p of plansE04) expect(p.sorte).toBe("emotion");
  });
});

/** Fiche de la fixture dont certains écrans sont modifiés. */
const ficheAvec = (modif: Record<string, Record<string, unknown>>) => ({ ...F.fiche, ecrans: F.fiche.ecrans.map((e) => ({ ...e, ...(modif[e.id] ?? {}) })) });

describe("rythme : les moments qui relancent eux-mêmes le rythme ne sont pas touchés", () => {
  it.each([0, 1])("version %i : e12 (email) et e13 (alerte) avec un lien seul gardent leur scène et leur sorte « moment »", (k) => {
    const e12 = F.fiche.ecrans.find((e) => e.id === "e12")!;
    const e13 = F.fiche.ecrans.find((e) => e.id === "e13")!;
    const e14 = F.fiche.ecrans.find((e) => e.id === "e14")!; // reçoit les blocs n09-n11 : sinon Q12 les attendrait en vain
    expect([e12.scene, e13.scene]).toEqual(["email", "alerte"]);
    const r = mettreEnSceneIV(entreeDe(F.versions[k], ficheAvec({ e12: { refs: ["l08"] }, e13: { refs: ["l09"] }, e14: { refs: [...e14.refs, "n09", "n10", "n11"] } })));
    for (const id of ["e12", "e13"]) {
      const plans = r.ligne.plans.filter((p) => p.ecran === id);
      expect(plans.length, id).toBeGreaterThan(0);
      for (const p of plans) {
        expect(p.sorte, id).toBe("moment");
        expect(p.scene, id).toBe(id === "e12" ? "email" : "alerte");
      }
    }
    expect(r.phrases).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("un écran « dossiers » sans bloc cité ET sans texte d'écran n'est pas passé en « titre »", () => {
    const r = mettreEnSceneIV(entreeDe(F.versions[1], ficheAvec({ e04: { textesEcran: [] } })));
    const plans = r.ligne.plans.filter((p) => p.ecran === "e04");
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) expect(p.sorte).toBe("moment");
  });
});
