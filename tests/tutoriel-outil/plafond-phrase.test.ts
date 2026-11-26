/**
 * T-EXT-V2-07 : plafond par vidéo de la création par Claude (maquette ou flux) depuis une phrase. Calcul pur : aucun appel
 * à Claude, aucun rendu, 0 €. Aucun prix écrit à la main : tout est recalculé par `pireCasRequete`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { pireCasRequete, type DefinitionRole } from "@/generateur/roles/types";
import { entreeMaquettiste, roleMaquettiste, type ContexteMaquettiste, type ManqueMaquettiste } from "@/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { PROPOSITIONS_PIECE_MAX } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { PLAFOND_TUTORIEL_USD } from "@/services/plafond-tutoriel";
import { coutPirePieceCreeeUsd, ETAPE_PIECE_TUTORIEL, PREFIXE_ETAPE_TUTORIEL, plafondTutorielParDefautUsd, plafondTutorielPhraseUsd, detailPlafondTutorielUsd } from "@/services/tutoriel-claude";

const role = roleMaquettiste as unknown as DefinitionRole;
const ctx = (n: number): ContexteMaquettiste => ({ metier: "x".repeat(40), carteZones: [], interdits: [], demande: "x".repeat(n), proposition: 2 });
const unePropositionMax = (n: number) => Math.max(pireCasRequete(role, entreeMaquettiste("maquette", ctx(n))), pireCasRequete(role, entreeMaquettiste("flux-automatisation" as ManqueMaquettiste, ctx(n))));

describe("T-EXT-V2-07 : plafond depuis une phrase", () => {
  it("la création au pire = 1 proposition + 1 reprise portant le bloc de 6 remarques de 200 caractères, recalculé ici", () => {
    expect(PROPOSITIONS_PIECE_MAX).toBe(2);
    const sans = entreeMaquettiste("maquette", ctx(300));
    const bloc = Array.from({ length: 6 }, () => "x".repeat(200)).join(" | ");
    const avec = { ...sans, variable: `${sans.variable}\n<remarques_precedentes>${bloc}</remarques_precedentes>` };
    const reprise = Math.max(pireCasRequete(role, avec), pireCasRequete(role, entreeMaquettiste("flux-automatisation" as ManqueMaquettiste, ctx(300))));
    expect(coutPirePieceCreeeUsd()).toBeCloseTo(unePropositionMax(300) + reprise, 10);
    // Le bloc de remarques coûte un peu plus (environ 0,002 $) : le calcul le compte, il n'est plus « 2 × une proposition ».
    expect(coutPirePieceCreeeUsd()).toBeGreaterThan(2 * unePropositionMax(300));
    expect(coutPirePieceCreeeUsd() - 2 * unePropositionMax(300)).toBeLessThan(0.01);
  });

  it("le plafond EFFECTIF d'une phrase reste 1,11 $ (le plafond calculé ne sert qu'au-dessous)", () => {
    expect(Math.min(PLAFOND_TUTORIEL_USD, plafondTutorielPhraseUsd())).toBe(PLAFOND_TUTORIEL_USD);
    expect(PLAFOND_TUTORIEL_USD).toBe(1.11);
  });

  it("le plafond d'une phrase est au moins celui d'un dossier, et un multiple de 0,05", () => {
    const phrase = plafondTutorielPhraseUsd();
    expect(phrase).toBeGreaterThanOrEqual(plafondTutorielParDefautUsd());
    expect(Math.round(phrase * 100) % 5).toBe(0);
  });

  it("le maquettiste n'est jamais compté deux fois : dossier − maquettiste ×1 + création, arrondi au pas supérieur", () => {
    const d = detailPlafondTutorielUsd();
    const attendu = Math.ceil(Math.round((d.total - (d.roles.maquettiste ?? 0) + coutPirePieceCreeeUsd()) * 1e6) / 1e6 / 0.05) * 0.05;
    expect(plafondTutorielPhraseUsd()).toBeCloseTo(attendu, 10);
  });

  it("le plafond d'un dossier ne change pas : il reste le total du détail, arrondi au pas", () => {
    const d = detailPlafondTutorielUsd();
    expect(plafondTutorielParDefautUsd()).toBeCloseTo(Math.ceil(Math.round(d.total * 1e6) / 1e6 / 0.05) * 0.05, 10);
  });

  it("une demande de 300 caractères coûte au pire au moins autant qu'une de 10 (borne prise sur la plus longue)", () => {
    expect(unePropositionMax(300)).toBeGreaterThanOrEqual(unePropositionMax(10));
    expect(coutPirePieceCreeeUsd()).toBeGreaterThanOrEqual(2 * unePropositionMax(10));
  });

  it("l'étape porte le préfixe du tutoriel (la dépense compte dans le plafond `tuto`)", () => {
    expect(ETAPE_PIECE_TUTORIEL).toBe(`${PREFIXE_ETAPE_TUTORIEL} maquettiste`);
  });

  it("le détail est écrit une seule fois au journal technique", async () => {
    vi.resetModules();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const m = await import("@/services/tutoriel-claude");
    m.plafondTutorielPhraseUsd();
    m.plafondTutorielPhraseUsd();
    const lignes = info.mock.calls.map((a) => String(a[0])).filter((l) => l.startsWith("Plafond tutoriel depuis une phrase"));
    info.mockRestore();
    expect(lignes).toHaveLength(1);
  });

  it("aucun littéral de prix dans tutoriel-claude.ts (hors commentaires)", () => {
    const source = readFileSync("src/services/tutoriel-claude.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(source).not.toMatch(/0\.\d+\s*\$|\$\s*0\.\d+/);
  });
});
