/**
 * GV-ST-03d · Image → vidéo : l'identifiant de rendu ne reprend plus un ancien rendu quand la recette porte SOU-C, SOU-D ou SOU-E
 * (le tirage de sous-titres étant éteint, l'image change). Sans recette ou SOU-B : identifiant strictement inchangé.
 * Ne dépend pas de `studio-rendu`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { idRenduSansStyleIV, VERSION_COMPOSITIONS_IV } from "@/moteurs/montage-image-video/fabrication";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { planMixageIV } from "@/moteurs/montage-image-video/assemblage";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { planDesFinsAvant as planDesFinsIV } from "./plan-des-fins-avant";

vi.mock("server-only", () => ({}));

const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const carte: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 32);

function ligneDe(sousTitres?: RecetteVarieteIV["sousTitres"]) {
  const fiche = FICHES_SIMULEES["essai-c"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES, ...(sousTitres ? { variete: { ...RECETTE_REFERENCE_IV, sousTitres } } : {}) }).ligne;
}

/** L'identifiant d'avant GV-ST-03d (formule recopiée). */
function idAvant(ligne: ReturnType<typeof ligneDe>) {
  const mixage = planMixageIV({ finVoixSec: 0, version: "t", empreinte: "t" } as never, ligne.bruitages, ligne.dureeSec);
  return { mixage, id: `iv-rendu-${empreinte(["v1", empreinte(ligne), mixage.id, VERSION_COMPOSITIONS_IV])}` };
}

describe("GV-ST-03d · identifiant de rendu sans style choisi", () => {
  it("sans recette : identifiant inchangé", () => {
    const l = ligneDe();
    const a = idAvant(l);
    expect(idRenduSansStyleIV("v1", l, a.mixage.id)).toBe(a.id);
  });
  it("SOU-B : identifiant inchangé", () => {
    const l = ligneDe("SOU-B");
    const a = idAvant(l);
    expect(idRenduSansStyleIV("v1", l, a.mixage.id)).toBe(a.id);
  });
  it.each(["SOU-C", "SOU-D", "SOU-E"] as const)("%s : identifiant différent de celui d'avant", (code) => {
    const l = ligneDe(code);
    const a = idAvant(l);
    const id = idRenduSansStyleIV("v1", l, a.mixage.id);
    expect(id).not.toBe(a.id);
    expect(id.startsWith(a.id)).toBe(true);
    expect(id).toMatch(/-st1$/);
  });
});
