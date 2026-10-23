/**
 * FORMATS DE SORTIE : la table (dimensions, réseaux, zones sûres) et la mise en page CALCULÉE dans chaque format pour
 * les fiches témoins : dimensions exactes, rien hors de la zone sûre ni dans la bande des sous-titres, aucun mot
 * coupé, même ordre de lecture, tailles au-dessus du plancher, crayon dans la zone sûre.
 */
import { describe, expect, it } from "vitest";
import { TAILLE_PLANCHER_VIDEO } from "../../../src/briques/habillage/charte-video";
import { DIMENSIONS_SCENES, controlerProprietes } from "../../../src/briques/tableau-scene/proprietes";
import { planifierScene, poseStylo } from "../../../src/briques/tableau-scene/plan";
import { FORMATS_SORTIE, IDS_FORMATS_SORTIE, formatSortie, lireSorties, referenceFormat, zoneSureFormat, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, zoneSureTableau, type MiseEnPageTableau, type RectPx } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { EXEMPLES, ficheDemonstration } from "../regles/exemples";
import { scenesFormat } from "./outils";

const DIMENSIONS: Record<IdFormatSortie, [number, number]> = { vertical: [1080, 1920], portrait: [1080, 1350], carre: [1080, 1080], horizontal: [1920, 1080] };

const dedans = (r: RectPx, z: RectPx) => r.x >= z.x && r.y >= z.y && r.x + r.largeur <= z.x + z.largeur && r.y + r.hauteur <= z.y + z.hauteur;
const mots = (t: string) => t.split(/\s+/).filter(Boolean);

describe("table des formats de sortie", () => {
  it("quatre formats aux dimensions exactes, chacun avec ses réseaux et une source par zone", () => {
    expect(IDS_FORMATS_SORTIE).toEqual(["vertical", "portrait", "carre", "horizontal"]);
    for (const id of IDS_FORMATS_SORTIE) {
      const f = FORMATS_SORTIE[id];
      expect([f.largeur, f.hauteur]).toEqual(DIMENSIONS[id]);
      expect(f.reseaux.length).toBeGreaterThan(0);
      for (const r of f.reseaux) expect(r.source.length).toBeGreaterThan(5);
    }
    expect(FORMATS_SORTIE.vertical.reseaux.map((r) => r.libelle)).toEqual(expect.arrayContaining(["TikTok", "Reels Instagram", "Reels Facebook", "YouTube Shorts"]));
    expect(FORMATS_SORTIE.carre.reseaux.map((r) => r.libelle)).toContain("LinkedIn");
    expect(FORMATS_SORTIE.horizontal.reseaux.map((r) => r.libelle)).toEqual(["YouTube"]);
  });

  it("la zone sûre du vertical est celle d'avant (union des réseaux du 9:16 du registre)", () => {
    expect(zoneSureFormat("vertical")).toEqual(zoneSureTableau());
  });

  it("la référence des tailles garde la même taille réelle (petit côté 1 080 px : 1080 × 1920)", () => {
    for (const id of IDS_FORMATS_SORTIE) expect(referenceFormat(id)).toEqual({ largeur: 1080, hauteur: 1920 });
  });

  it("les dimensions acceptées par les scènes sont celles de la table", () => {
    expect([...DIMENSIONS_SCENES].sort((a, b) => a.largeur - b.largeur || a.hauteur - b.hauteur)).toEqual(
      IDS_FORMATS_SORTIE.map((id) => ({ largeur: formatSortie(id).largeur, hauteur: formatSortie(id).hauteur })).sort((a, b) => a.largeur - b.largeur || a.hauteur - b.hauteur),
    );
  });

  it("lit une liste de sorties ; défaut vertical ; refuse un format inconnu", () => {
    expect(lireSorties(undefined)).toEqual(["vertical"]);
    expect(lireSorties("vertical, carre,carre")).toEqual(["vertical", "carre"]);
    expect(() => lireSorties("vertical,cinema")).toThrow("cinema");
  });
});

describe("mise en page calculée par format", () => {
  it("le vertical demandé explicitement donne la mise en page d'avant, au caractère près", () => {
    expect(mettreEnPage(ficheDemonstration, { format: "vertical" })).toEqual(mettreEnPage(ficheDemonstration));
  });

  for (const id of IDS_FORMATS_SORTIE) {
    describe(FORMATS_SORTIE[id].libelle, () => {
      const temoins = Object.entries(EXEMPLES).map(([nom, fiche]) => ({ nom, ...scenesFormat(fiche, id) }));
      const vertical = Object.fromEntries(Object.entries(EXEMPLES).map(([nom, fiche]) => [nom, scenesFormat(fiche, "vertical").mise]));

      it("dimensions exactes ; bande des sous-titres et cadre dans la zone sûre", () => {
        for (const { mise } of temoins) {
          expect([mise.largeurPx, mise.hauteurPx]).toEqual(DIMENSIONS[id]);
          const zs = mise.zoneSure.px;
          expect(dedans(mise.bandeSousTitres.px, zs)).toBe(true);
          expect(dedans(mise.cadre.px, zs)).toBe(true);
          expect(mise.cadre.px.y + mise.cadre.px.hauteur).toBeLessThanOrEqual(mise.bandeSousTitres.px.y);
        }
      });

      it("rien ne déborde : chaque élément (et ses marques) dans la zone sûre, au-dessus de la bande", () => {
        for (const { mise } of temoins) {
          const zs = mise.zoneSure.px;
          for (const p of mise.pages)
            for (const e of p.elements) {
              expect(dedans(e.encombrement.px, zs), `${mise.format ?? "vertical"} p${p.page} ${e.elementId}`).toBe(true);
              expect(e.encombrement.px.y + e.encombrement.px.hauteur).toBeLessThanOrEqual(mise.bandeSousTitres.px.y);
              for (const l of e.lignes) expect(dedans(l.px, mise.cadre.px)).toBe(true);
            }
        }
      });

      it("aucun mot coupé, même ordre de lecture que le vertical, tailles au-dessus du plancher", () => {
        const plancher = Math.ceil(TAILLE_PLANCHER_VIDEO * referenceFormat(id).hauteur);
        for (const { nom, mise } of temoins) {
          const ordre = (m: MiseEnPageTableau) => m.pages.flatMap((p) => [...p.elements].sort((a, b) => a.ordre - b.ordre).map((e) => e.elementId));
          expect(ordre(mise)).toEqual(ordre(vertical[nom]));
          for (const p of mise.pages)
            for (const e of p.elements) {
              if (e.type === "ligne" || e.type === "chiffre" || e.type === "mention") {
                const ref = vertical[nom].pages.flatMap((q) => q.elements).find((x) => x.elementId === e.elementId)!;
                // Mêmes mots, dans le même ordre (seules les coupures de ligne changent).
                expect(e.lignes.flatMap((l) => mots(l.texte))).toEqual(ref.lignes.flatMap((l) => mots(l.texte)));
                expect(e.taillePx).toBeGreaterThanOrEqual(plancher);
              }
            }
        }
      });

      it("propriétés des scènes valides ; crayon dans la zone sûre, jamais dans la bande", () => {
        for (const { nom, mise, scenes } of temoins) {
          const zs = mise.zoneSure.px;
          for (const p of scenes) {
            expect(controlerProprietes(p), nom).toEqual([]);
            expect([p.largeur, p.hauteur]).toEqual(DIMENSIONS[id]);
            const plan = planifierScene(p);
            // Pointe pendant l'écriture et les gestes (la page qui tourne excepte) : dans la zone sûre.
            for (let i = 0; i < plan.images; i += 3) {
              const t = i / plan.fps;
              const enCours = plan.actions.find((a) => a.duree > 0 && t >= a.debut && t <= a.debut + a.duree);
              if (!enCours || enCours.sorte === "tourner") continue;
              const { pointe } = poseStylo(plan, t);
              expect(pointe.x >= zs.x && pointe.x <= zs.x + zs.largeur && pointe.y >= zs.y && pointe.y <= mise.bandeSousTitres.px.y, `${nom} ${p.scene.id} t=${t}`).toBe(true);
            }
            // Au repos : dans la zone sûre hors du vertical (le vertical garde sa marge d'avant, voir la PR).
            if (id !== "vertical") expect(plan.repos.x <= zs.x + zs.largeur && plan.repos.y <= mise.bandeSousTitres.px.y).toBe(true);
          }
        }
      });
    });
  }
});
