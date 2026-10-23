/**
 * E2E-1 générateur n° 26 (MINEUR, 03/10) — « Ma voix › Tournures interdites » affichait les motifs normalisés
 * (« a l ere de », « ainsi en tete », « aujourd hui je vais »). Attendu : un texte lisible, accents et apostrophes.
 */
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { libelleTournure } = await import("@/domaine/voix");
const { TOURNURES_CALIBREES } = await import("@/donnees/generateur/tournures-calibrees");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const voix = await import("@/services/voix");

const libelle = (motif: string) => {
  const t = TOURNURES_CALIBREES.find((x) => x.motif === motif)!;
  return libelleTournure(t.motif, t.regexOrigine);
};

describe("E2E-1 n° 26 · tournures lisibles", () => {
  it("les trois exemples du rapport", () => {
    expect(libelle("a-l-ere-de")).toBe("à l'ère de");
    expect(libelle("ainsi-en-tete")).toBe("« Ainsi, » en début de phrase");
    expect(libelle("aujourd-hui-je-vais")).toBe("aujourd'hui je vais");
  });

  it("aucune tournure semée ne s'affiche sous sa forme normalisée", () => {
    for (const t of TOURNURES_CALIBREES) {
      const l = libelleTournure(t.motif, t.regexOrigine);
      // Plus de lettre isolée née d'une apostrophe retirée (« n en », « l ere »), ni de mot sans son accent.
      expect(l, t.motif).not.toMatch(/(?:^|\s)[nldcjs](?:\s|$)/);
      expect(l, t.motif).not.toMatch(/\b(?:ere|tete|resultat|verifie|probleme|cle|resume|decortiquer|decryptons)\b/);
    }
  });

  it("un motif dicté par Will reste tel quel", () => {
    expect(libelleTournure("Top 1 %")).toBe("Top 1 %");
    expect(libelleTournure("C'est un game changer")).toBe("C'est un game changer");
  });
});

describe("E2E-1 n° 26 · la liste lue par l'écran porte le libellé", () => {
  beforeAll(async () => {
    await preparerMotDePasse("e2e1-restes-tournures");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter("e2e1-restes-tournures", false);
  });

  it("listerTournures donne « à l'ère de », et l'écran affiche ce libellé", async () => {
    const t = TOURNURES_CALIBREES.find((x) => x.motif === "a-l-ere-de")!;
    await depots().tournesInterdites.enregistrer({ id: t.id, motif: t.motif, regex: t.regex, type: t.type, niveau: t.niveau, portee: "partout", raison: "essai", source: t.source, creeLe: "2026-10-03T00:00:00Z", modifieLe: "2026-10-03T00:00:00Z" });
    const liste = await voix.listerTournures();
    expect(liste.find((x) => x.id === t.id)?.libelle).toBe("à l'ère de");
    const ecran = readFileSync("src/components/voix/MaVoix.tsx", "utf8");
    expect(ecran).toContain("{t.libelle ?? t.motif}");
    expect(ecran).not.toContain('t.motif.replace(/-/g, " ")');
  });
});
