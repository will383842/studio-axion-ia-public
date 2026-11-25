/**
 * ALLUMER-VARIETE-COMMUNE-v21o (E2, point 5) : la clé `varieteCommune` est ALLUMÉE par défaut (absent ou `null` = allumé) ;
 * `false` écrit en base l'éteint. Dépôts en mémoire, aucun appel réel, 0 €.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import { lireReglageVarieteCommune } from "@/briques/variete-commune/reglage";
import { blocHistoriqueV4 } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { entreesAvocatDuLancement } from "@/services/avocat-branchements";
import { ENTREE_MOTION_AVOCAT } from "@/moteurs/montage-avocat/motion";
import { lireVarieteCommune } from "@/services/variete-commune/lire-reglage";

const CLE = "varieteCommune";
const ligne = (extra: Record<string, unknown> = {}) => ({ id: "EN_COURS", entrees: {}, ...extra }) as never;
async function regler(valeur: unknown) {
  await depots().parametres.enregistrer({ id: CLE, valeur, creeLe: "x", modifieLe: "x" } as never);
}
async function voisineLinkedin() {
  await depots().publications.enregistrer({ id: "p-AUTRE", videoId: "AUTRE", reseau: "linkedin", statut: "publiee", via: "zernio", date: "2026-11-10T10:00:00Z", texte: "t", creeLe: "x", modifieLe: "x" } as never);
  await depots().versions.enregistrer({
    id: "v-AUTRE", videoId: "AUTRE", numero: 1, commande: { formatId: "facecam", moteurId: "montage-facecam" }, statut: "prete", choisie: true,
    creeLe: "2026-11-09T10:00:00Z", modifieLe: "2026-11-09T10:00:00Z",
    projetMontage: { moteur: "montage-facecam", motionCommune: { cartes: [{ ratio: "9:16", debutSec: 1, modele: "frise", statut: "posee" }] } },
  } as never);
}

beforeEach(() => {
  reinitialiserDepots();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ALLUMER-VARIETE-COMMUNE-v21o", () => {
  it("(a) lecteur : base vide → true ; null → true ; false écrit → false", async () => {
    expect(await lireVarieteCommune(CLE)).toBe(true);
    await regler(null);
    expect(await lireVarieteCommune(CLE)).toBe(true);
    await regler(false);
    expect(await lireVarieteCommune(CLE)).toBe(false);
  });

  it("(b) réglage complet : base vide → allumé aux défauts ; false, 'true', {}, 1 → éteint ; lecture qui lève → éteint", async () => {
    expect(await lireReglageVarieteCommune(lireVarieteCommune)).toMatchObject({ actif: true, seuil: 0.5, fenetre: 10 });
    for (const v of [false, "true", {}, 1]) {
      await regler(v);
      expect(await lireReglageVarieteCommune(lireVarieteCommune), `valeur ${JSON.stringify(v)}`).toEqual({ actif: false });
    }
    reinitialiserDepots();
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("panne"));
    expect(await lireReglageVarieteCommune(lireVarieteCommune)).toEqual({ actif: false });
  });

  it("(c) bout en bout sans écrire la clé : la carte de la voisine LinkedIn est évitée ; avec false : sortie d'avant", async () => {
    await voisineLinkedin();
    const sortie = await entreesAvocatDuLancement(ligne({ reseau: "linkedin" }));
    expect(sortie[ENTREE_MOTION_AVOCAT]).toMatchObject({ actif: true, dejaServis: ["frise"] });
    await regler(false);
    expect(await entreesAvocatDuLancement(ligne({ reseau: "linkedin" }))).toEqual({ [ENTREE_MOTION_AVOCAT]: { actif: true } });
  });

  it("(d) garde texte : aucune écriture ni import payant dans les dossiers de la variété commune", () => {
    const fichiers = execSync("git ls-files 'src/services/variete-commune/*' 'src/briques/variete-commune/*'", { encoding: "utf8" }).split("\n").filter(Boolean);
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) {
      const code = readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      expect(code, f).not.toMatch(/\.(creer|modifier|supprimer|enregistrer)\(|ecrireParametre/);
      expect(code, f).not.toMatch(/@anthropic-ai|generation-claude|depense-claude-video/);
    }
  });

  it("(e) le message du réalisateur : une seule ligne de voisines, ≤ 200 caractères", () => {
    const b = blocHistoriqueV4([], [], ["Chrono", "CarteChecklist", "BadgeCompteur"]);
    expect(b.split("\n")).toHaveLength(1);
    expect(b.length).toBeLessThanOrEqual(200);
  });

  it("(f) inventaire : la ligne de la clé est « allume » avec le motif `cle, true`", () => {
    const t = readFileSync("tests/usine/inventaire/habillage-et-briques.test.ts", "utf8");
    expect(t).toMatch(/cle: "varieteCommune", etat: "allume"[^\n]*lireParametre<unknown>\\\(cle, true\\\)/);
    expect(readFileSync("src/services/variete-commune/lire-reglage.ts", "utf8")).toMatch(/lireParametre<unknown>\(cle, true\)/);
  });
});
