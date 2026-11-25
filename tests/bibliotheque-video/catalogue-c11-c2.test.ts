/** C11-C2-a-v20k : 5 capacités du chantier 11 inscrites au catalogue (ids + lignes), aucune permise, aucun effet sur une vidéo. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE_CAPACITES, ID, ligneCapacite } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_COUVERTURE } from "@/briques/bibliotheque-video/catalogue/couverture";
import { porteCapacite } from "@/briques/bibliotheque-video/moteur";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const CINQ = [
  ["cadrage.camera-couverture", "cadrageCameraCouverture", "eteint"],
  ["ecran.carte-video-arrondie", "ecranCarteVideoArrondie", "prevu"],
  ["ecran.grilles-archive", "ecranGrillesArchive", "prevu"],
  ["ecran.ecrans-composes", "ecranEcransComposes", "prevu"],
] as const;
const IDS = CINQ.map(([id]) => id as IdCapacite);
const FORMATS = [...Object.keys(PROFILS_DU_CODE), "podcast", "inconnu"];

describe("C11-C2-a-v20k", () => {
  it("(a) 4 lignes ajoutées à la suite des 5 existantes (la 5e, motion.titre-etape-montante : HORS PERIMETRE), chantier 11, états exacts", () => {
    expect(LIGNES_COUVERTURE).toHaveLength(9);
    expect(LIGNES_COUVERTURE.slice(5).map((l) => [l.id, l.etat, l.chantier])).toEqual(CINQ.map(([id, , etat]) => [id, etat, "11"]));
  });
  it("(b) chaque id : une fois dans ID (clé camelCase), une fois au catalogue, jamais prod, demande, coulisse ni absent", () => {
    for (const [id, cle, etat] of CINQ) {
      expect((ID as Record<string, string>)[cle], cle).toBe(id);
      expect(Object.values(ID).filter((v) => v === id), id).toHaveLength(1);
      expect(CATALOGUE_CAPACITES.filter((l) => l.id === id), id).toHaveLength(1);
      expect(ligneCapacite(id as IdCapacite)?.etat, id).toBe(etat);
    }
  });
  it("(c) aucune ligne permise : aucun `permis` ni état allume/prod sur les 5", () => {
    for (const l of LIGNES_COUVERTURE.slice(5)) {
      expect("permis" in l).toBe(false);
      expect(["prevu", "eteint"]).toContain(l.etat);
    }
  });
  it("(d) aucun profil ne permet l'une des 5 et porteCapacite la refuse pour chaque format", () => {
    for (const f of FORMATS) {
      const profil = PROFILS_DU_CODE[f] ?? profilNeutre(f);
      for (const id of IDS) {
        expect(profil.capacites[id], `${f} ${id}`).toBeUndefined();
        const entree = { bibliothequeVideo: { version: "bibliotheque-video/1", profil, recents: [], graine: "g", figeeLe: "2026-11-16T00:00:00.000Z" } };
        const r = porteCapacite(entree, id);
        expect(r.bibliotheque === true ? r.permis : false, `${f} ${id}`).toBe(false);
        expect(porteCapacite({}, id)).toEqual({ bibliotheque: false });
      }
    }
  });
  it("(e) les 4 lignes « prevu » ne sont pas contrôlées par la garde de liaison ; « eteint » : le film dépend du cran du dosage (lecture de chaine.ts)", () => {
    const chaine = readFileSync(join(process.cwd(), "src/moteurs/montage-tutoriel-outil/chaine.ts"), "utf8");
    expect(chaine).toContain("dosageMotion?.cran");
    expect(chaine).not.toContain("cadrage.camera-couverture");
  });
  it("(f) docs/bibliotheque-video.md cite les 4 ids", () => {
    const doc = readFileSync(join(process.cwd(), "docs/bibliotheque-video.md"), "utf8");
    for (const id of IDS) expect(doc, id).toContain(`\`${id}\``);
  });
});
