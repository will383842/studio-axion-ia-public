/**
 * 26/10/2026 : une ligne d'écran « X · Y » qui précède le titre ne passe plus ENTIÈRE en étiquette : l'étiquette (interlettrage large)
 * passait à la ligne et recouvrait le titre. Seule la partie X devient étiquette, le titre reste entier. Fixture de v-b54bb4798246
 * (écran e15 : « OUI · Autoliquidation » puis « VALIDÉ · Envoi + archivage + écriture *comptable* »).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { recettePourVersion } from "@/moteurs/montage-image-video/variete/tirage";

const F = JSON.parse(readFileSync(join(__dirname, "fixtures", "facturation-j30-scene.json"), "utf8")) as { videoId: string; carte: unknown; fiche: unknown; recette: unknown; fins: { id: string; muet: boolean }[]; pistes: { version: string; dureeSec: number; finVoixSec: number; motsCorps: number; mots: unknown[] }[]; versions: { id: string; piste: string; format: "9:16" | "4:5"; reseaux: string[] }[] };

describe("en-tête d'une paire « X · Y » avant le titre", () => {
  it("l'étiquette ne reprend que X, le titre « VALIDÉ · … » reste entier et visible", () => {
    const v = F.versions[0]!;
    const p = F.pistes.find((x) => x.version === v.piste)!;
    const fin = F.fins.find((f) => f.id === v.id);
    const { ligne } = mettreEnSceneIV({ carte: F.carte, fiche: F.fiche, voix: { mots: p.mots, motsCorps: p.motsCorps, dureeSec: p.dureeSec, finVoixSec: p.finVoixSec }, fin: fin && !fin.muet ? fin : null, reseaux: v.reseaux, bruitagesValides: BRUITAGES_V4_IV, variete: recettePourVersion(F.recette as never, v.reseaux as never, v.format), graine: F.videoId } as never);
    const e = ligne.evenements.find((x) => /VALIDÉ · Envoi/.test(x.texte ?? ""));
    expect(e).toBeDefined();
    const [etiquette, titre] = e!.texte!.split("|");
    expect(etiquette).toBe("OUI");
    expect(etiquette).not.toMatch(/·|Autoliquidation/);
    expect(titre).toBe("VALIDÉ · Envoi + archivage + écriture *comptable*");
  });
});
