import { describe, expect, it } from "vitest";
import { TYPES_AUTOMATISATION } from "@/domaine/ciblage/types";
import { STATUTS_VISUEL } from "@/domaine/visuels/statuts";
import type { StatutVideo } from "@/domaine/types";
import { motsInterditsEnvoi } from "@/fournisseurs/publication/mots-interdits-envoi";
import { RESEAUX } from "@/reseaux";
import { RESEAUX_TAXONOMIE, STATUTS_COMMUNS, THEMES_CONTENU, TYPES_CONTENU, libelleStatutCommun, projeterStatutVideo, projeterStatutVisuel } from "@/domaine/taxonomie-contenu";

const STATUTS_VIDEO: StatutVideo[] = ["brouillon", "maquette", "en_file", "en_fabrication", "prete", "echec", "annulee", "archivee"];

describe("taxonomie du contenu", () => {
  it("reprend les 12 types du ciblage sans divergence", () => {
    expect(THEMES_CONTENU).toHaveLength(12);
    expect(THEMES_CONTENU.map((t) => t.id)).toEqual(TYPES_AUTOMATISATION.map((t) => t.id));
    expect(THEMES_CONTENU.map((t) => t.libelle)).toEqual(TYPES_AUTOMATISATION.map((t) => t.libelle));
  });
  it("liste 3 types de contenu et les 6 réseaux du registre", () => {
    expect([...TYPES_CONTENU]).toEqual(["video", "image", "carrousel"]);
    expect([...RESEAUX_TAXONOMIE].sort()).toEqual(RESEAUX.map((r) => r.id).sort());
  });
  it("projette chaque statut visuel", () => {
    for (const s of STATUTS_VISUEL) expect(STATUTS_COMMUNS).toContain(projeterStatutVisuel(s));
    expect(projeterStatutVisuel("publie")).toBe("publie");
    expect(projeterStatutVisuel("echec_rendu")).toBe("echec");
  });
  it("projette chaque statut vidéo", () => {
    for (const s of STATUTS_VIDEO) expect(STATUTS_COMMUNS).toContain(projeterStatutVideo(s));
    expect(projeterStatutVideo("prete")).toBe("pret");
    expect(projeterStatutVideo("archivee")).toBe("archive");
  });
  it("n'emploie aucun libellé interdit", () => {
    const textes = [...THEMES_CONTENU.map((t) => t.libelle), ...STATUTS_COMMUNS.map(libelleStatutCommun)];
    for (const t of textes) expect(motsInterditsEnvoi(t)).toEqual([]);
  });
});
