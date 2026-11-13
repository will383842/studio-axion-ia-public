/**
 * Tableau animé — GV2-47 : le contrôle de variété lit un VRAI historique (les vidéos « prêtes » du tableau), figé à la
 * création de la version en cours. Dépôts en mémoire.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let versions: Record<string, unknown>[] = [];
let lectureEnPanne = false;
vi.mock("@/services/_commun", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  depots: () => ({
    versions: {
      lister: async (f?: (v: Record<string, unknown>) => boolean) => {
        if (lectureEnPanne) throw new Error("base illisible");
        return versions.filter((v) => (f ? f(v) : true));
      },
    },
  }),
}));

import { controlerVideoTableau, type EntreeControleTableau, type OutilsControleTableau } from "../../../src/moteurs/montage-tableau/controles";
import { ID_MOTEUR_TABLEAU } from "../../../src/moteurs/montage-tableau";
import { historiqueVarieteTableau } from "../../../src/services/tableau-branchements";
import { contexteExemple, copie, ficheErreurCorrigee } from "../regles/exemples";

const RELECTURE_RAS: OutilsControleTableau = { relireImagesCles: () => ({ imagesLues: 6, remarques: [] }) };
const MESURES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesNoiresHorsFin: 0, imagesFigeesHorsFin: 0, dureeSec: 60, vmaf: 95, vmafSeuil: 90 };

const version = (videoId: string, creeLe: string, fiche: unknown = copie(ficheErreurCorrigee)) => ({
  id: `ver-${videoId}-${creeLe}`, videoId, creeLe, statut: "prete", commande: { moteurId: ID_MOTEUR_TABLEAU },
  projetMontage: { tableau: { journal: { version: 1, etapes: {} }, fiche } },
});
const entree = (historique: EntreeControleTableau["historique"]): EntreeControleTableau => {
  const fiche = copie(ficheErreurCorrigee);
  return { fiche, contexte: contexteExemple(fiche), historique, dejaVu: { coche: true, le: "2026-10-10" }, mesures: MESURES };
};

beforeEach(() => {
  versions = [];
  lectureEnPanne = false;
});

describe("historique de variété du tableau", () => {
  it("deux vidéos prêtes identiques : l'historique n'est pas vide et le contrôle refuse (refus levable)", async () => {
    versions = [version("v1", "2026-11-01T10:00:00Z"), version("v2", "2026-11-02T10:00:00Z")];
    const h = await historiqueVarieteTableau("v3", "2026-11-03T10:00:00Z");
    expect(h).toHaveLength(2);
    const r = await controlerVideoTableau(entree(h), RELECTURE_RAS);
    expect(r.verdict).toBe("bloque");
    expect(new Set(r.bloquants.map((l) => l.famille))).toEqual(new Set(["variete"]));
    const levee = await controlerVideoTableau({ ...entree(h), leveeVariete: { motif: "Série voulue : même structure.", auteur: "Le fondateur" } }, RELECTURE_RAS);
    expect(levee.bloquants).toEqual([]);
  });

  it("une vidéo prête APRÈS la création de la version en cours n'entre pas, et la vidéo en cours est exclue", async () => {
    versions = [version("v1", "2026-11-01T10:00:00Z")];
    const avant = await historiqueVarieteTableau("v3", "2026-11-03T10:00:00Z");
    versions.push(version("v2", "2026-11-05T10:00:00Z"), version("v3", "2026-11-02T10:00:00Z"));
    const apres = await historiqueVarieteTableau("v3", "2026-11-03T10:00:00Z");
    expect(avant).toHaveLength(1);
    expect(apres).toEqual(avant);
  });

  it("lecture qui lève : historique vide, aucune exception ; fiche illisible : cette vidéo est ignorée", async () => {
    lectureEnPanne = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(historiqueVarieteTableau("v3", "2026-11-03T10:00:00Z")).resolves.toEqual([]);
    warn.mockRestore();
    lectureEnPanne = false;
    versions = [version("v1", "2026-11-01T10:00:00Z", "n'importe quoi"), version("v2", "2026-11-02T10:00:00Z", { scenes: null })];
    await expect(historiqueVarieteTableau("v3", "2026-11-03T10:00:00Z")).resolves.toEqual([]);
  });
});
