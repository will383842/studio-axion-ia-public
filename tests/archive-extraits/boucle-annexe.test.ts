/**
 * C3-UT-3.7 : l'inscription de l'archive est lancée en tâche annexe de la boucle, HORS du tour, et reste éteinte par défaut.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Video, VersionVideo, Sortie, Fichier } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const svc = await import("@/services/archive-extraits");

const INSCRIPTION = "bibliothequeVideo.archive.inscription";
const DERNIER = "bibliothequeVideo.archive.dernierPassage";
const ANCIEN = "2026-11-01T00:00:00.000Z";

describe("branchement statique dans boucle.ts", () => {
  const source = readFileSync("src/services/boucle.ts", "utf8");
  const lignes = source.split("\n");

  it("une seule ligne `void lancerAnnexe(\"archive des extraits\"` avec import dynamique", () => {
    const trouvees = lignes.filter((l) => l.includes('lancerAnnexe("archive des extraits"'));
    expect(trouvees).toHaveLength(1);
    expect(trouvees[0].trim().startsWith("void lancerAnnexe(")).toBe(true);
    expect(trouvees[0]).toContain('import("./archive-extraits")');
    expect(trouvees[0]).toContain("inscrireLesVideosPubliees");
    expect(trouvees[0]).not.toContain("await lancerAnnexe");
  });

  it("aucun import statique du service d'archive", () => {
    expect(lignes.filter((l) => /^\s*import\b.*from\s+["']\.\/archive-extraits["']/.test(l))).toHaveLength(0);
  });
});

describe("éteint = rien", () => {
  beforeEach(() => {
    reinitialiserDepots();
    vi.restoreAllMocks();
  });

  async function semer(id: string) {
    const d = depots();
    const base = { creeLe: ANCIEN, modifieLe: ANCIEN };
    await d.videos.enregistrer({ id, titre: id, formatId: "avocat", statut: "prete", etapeEditoriale: "publiee", marqueId: "m1", styles: {}, entrees: {}, reglages: {}, versionChoisieId: `ver-${id}`, ...base } as unknown as Video);
    await d.versions.enregistrer({ id: `ver-${id}`, videoId: id, numero: 1, statut: "prete", choisie: true, ...base, commande: { versionContrat: 2, moteurId: "montage-avocat", videoId: id, formatId: "avocat" } } as unknown as VersionVideo);
    await d.fichiers.enregistrer({ id: `fic-${id}`, cleStockage: `studio/prod/video/${id}/a.mp4`, nom: "a.mp4", mime: "video/mp4", taille: 1, origine: "genere", statut: "pret", ...base } as unknown as Fichier);
    await d.sorties.enregistrer({ id: `sor-${id}`, videoId: id, versionId: `ver-${id}`, ratio: "9:16", appelAuMot: false, fichierId: `fic-${id}`, dureeSec: 60, ...base } as unknown as Sortie);
  }

  it.each([["absent", undefined], ["texte « true »", "true"], ["nombre 1", 1], ["false", false]])("réglage %s : rien n'est écrit", async (_nom, valeur) => {
    await semer("a");
    if (valeur !== undefined) await ecrireParametre(INSCRIPTION, valeur);
    const d = depots();
    const ecritElements = vi.spyOn(d.elements, "enregistrer");
    const lectureVideos = vi.spyOn(d.videos, "lister");
    expect(await svc.inscrireLesVideosPubliees()).toEqual({ traitees: 0, ecrites: 0 });
    expect(ecritElements).not.toHaveBeenCalled();
    expect(lectureVideos).not.toHaveBeenCalled();
    expect(await d.elements.lister((e) => e.type === "source-extraits")).toHaveLength(0);
    expect(await d.parametres.obtenir(DERNIER)).toBeFalsy();
  });
});
