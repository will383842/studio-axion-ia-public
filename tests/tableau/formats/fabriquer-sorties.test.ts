/**
 * FABRICATION À PLUSIEURS SORTIES (doubles seulement, aucun appel) : la voix et le calage sont faits UNE fois ; chaque
 * sortie a ses scènes, sa vidéo, sa vignette et ses contrôles ; le nom de chaque fichier porte le format ; le journal
 * liste chaque sortie. Sans `sorties` : le vertical seul, comme avant.
 */
import { describe, expect, it } from "vitest";
import type { ParametresDemandeComposition } from "../../../src/briques/composition/scene";
import type { ProprietesTableauScene } from "../../../src/briques/tableau-scene/types";
import { ETAPES_FABRICATION, ID_SCENE_FIN, fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { ficheDemonstration } from "../regles/exemples";
import { doubles } from "../fabriquer/doubles";

const FIN = "Enregistrez cette vidéo pour la refaire";
type Complet = Extract<ParametresDemandeComposition, { mode: "complet" }>;

describe("fabrication à trois sorties", () => {
  it("une seule voix, trois vidéos aux bonnes dimensions, chacune avec ses scènes, sa vignette et ses contrôles", async () => {
    const d = doubles(ficheDemonstration, { fin: FIN });
    const r = await fabriquerTableau({ ...d.outils, sorties: ["vertical", "carre", "horizontal"] });

    // La voix (et le calage) une seule fois pour les trois sorties.
    expect(d.lectures()).toBe(1);
    expect(r.etapes.filter((e) => e.etape === "voix")).toHaveLength(1);
    expect(r.etapes.filter((e) => e.etape === "calage")).toHaveLength(1);
    // Autant de traitements de la voix que pour une seule sortie.
    const seul = doubles(ficheDemonstration, { fin: FIN });
    await fabriquerTableau(seul.outils);
    const voixDe = (x: typeof d) => x.soumises.filter((s) => s.operation !== "composition").length;
    expect(voixDe(d)).toBe(voixDe(seul));

    expect(r.sorties.map((s) => [s.format, s.largeur, s.hauteur])).toEqual([
      ["vertical", 1080, 1920],
      ["carre", 1080, 1080],
      ["horizontal", 1920, 1080],
    ]);
    // Une composition par sortie, à son ratio.
    expect(d.compositionsSoumises().map((c) => (c.parametres as unknown as Complet).ratio)).toEqual(["9:16", "1:1", "16:9"]);
    // Chaque sortie : toutes ses scènes (et la fin) rendues, à ses dimensions.
    const ids = [...ficheDemonstration.scenes.map((s) => s.id), ID_SCENE_FIN];
    expect(d.scenesSoumises()).toHaveLength(3 * ids.length);
    for (const s of r.sorties) {
      expect(s.scenes.rendues).toEqual(ids);
      expect(Object.keys(s.cles.scenes)).toEqual(ids);
      const props = d.scenesSoumises().filter((x) => Object.values(s.cles.scenes).includes(x.sortie.cle)).map((x) => (x.parametres as { proprietes: ProprietesTableauScene }).proprietes);
      expect(props).toHaveLength(ids.length);
      for (const p of props) expect([p.largeur, p.hauteur]).toEqual([s.largeur, s.hauteur]);
      expect(s.controles.verdict).toBe("livrable");
      expect(s.controleFichier.format).toBe(s.format);
      expect(s.cles.vignette).toMatch(/\.jpg$/);
    }
    // Le nom de chaque fichier porte le format.
    const [v, c, h] = r.sorties;
    expect(v.cles.video).toMatch(/-9x16\.mp4$/);
    expect(c.cles.video).toMatch(/tb-carre-.*-1x1\.mp4$/);
    expect(h.cles.video).toMatch(/tb-horizontal-.*-16x9\.mp4$/);
    expect(c.cles.vignette).toMatch(/tb-carre-.*\.jpg$/);
    for (const cle of Object.values(c.cles.scenes)) expect(cle).toContain("carre-");
    for (const cle of Object.values(h.cles.scenes)) expect(cle).toContain("horizontal-");
    expect(new Set([v.cles.video, c.cles.video, h.cles.video]).size).toBe(3);

    // Champs d'avant : la première sortie ; étapes des autres sorties nommées.
    expect(r.cles.video).toBe(v.cles.video);
    expect(r.etapes.filter((e) => e.etape === "composition").map((e) => e.sortie)).toEqual([undefined, "carre", "horizontal"]);

    // Le journal liste chaque sortie (format, dimensions, chemin, durée, taille).
    expect(d.journal.valeur?.resume).toEqual(r.sorties.map((s) => ({ format: s.format, largeur: s.largeur, hauteur: s.hauteur, chemin: s.cles.video, dureeSec: s.dureeSec, tailleOctets: null })));

    // Sous-titres dans la bande de chaque sortie, lettre à la taille de référence hors du vertical.
    for (const [i, s] of r.sorties.entries()) {
      const p = d.compositionsSoumises()[i].parametres as unknown as Complet;
      expect([p.image.largeur, p.image.hauteur]).toEqual([s.largeur, s.hauteur]);
      expect(p.export.conversionRvbSure).toBe(true);
      expect(p.export.mesurerBords).toBe(true);
    }
  });

  it("relancée : tout est repris, aucune voix ni aucun rendu de plus", async () => {
    const d = doubles(ficheDemonstration, { fin: FIN });
    const outils = { ...d.outils, sorties: ["vertical", "portrait", "carre"] as const };
    await fabriquerTableau(outils);
    const n = d.soumises.length;
    const r = await fabriquerTableau(outils);
    expect(d.lectures()).toBe(1);
    expect(d.soumises.length).toBe(n);
    expect(r.etapes.filter((e) => e.etape !== "controles").every((e) => e.statut === "reprise")).toBe(true);
    for (const s of r.sorties) expect(s.scenes.rendues).toEqual([]);
  });

  it("ajouter une sortie plus tard ne relit pas la voix et ne refait pas le vertical", async () => {
    const d = doubles(ficheDemonstration, { fin: FIN });
    await fabriquerTableau(d.outils);
    const avant = d.soumises.length;
    const r = await fabriquerTableau({ ...d.outils, sorties: ["vertical", "portrait"] });
    expect(d.lectures()).toBe(1);
    const nouvelles = d.soumises.slice(avant);
    expect(nouvelles.every((s) => s.operation === "composition")).toBe(true);
    expect(nouvelles.filter((s) => (s.parametres as { mode?: string }).mode === "complet")).toHaveLength(1);
    expect(r.sorties[0].scenes.rendues).toEqual([]);
    expect(r.sorties[1].format).toBe("portrait");
  });

  it("sans `sorties` : le vertical seul, étapes d'avant", async () => {
    const d = doubles(ficheDemonstration, { fin: FIN });
    const r = await fabriquerTableau(d.outils);
    expect(r.sorties.map((s) => s.format)).toEqual(["vertical"]);
    expect(r.etapes.map((e) => e.etape)).toEqual([...ETAPES_FABRICATION]);
    expect(r.etapes.some((e) => e.sortie)).toBe(false);
    expect(d.compositionsSoumises()).toHaveLength(1);
  });
});
