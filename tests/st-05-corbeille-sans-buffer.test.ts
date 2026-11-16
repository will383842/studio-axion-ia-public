/**
 * ST-05 · La corbeille ne parle plus de Buffer dans son code (partie qui ne dépend pas de la PR 440 / L7-06).
 * Lecture de sources uniquement : aucun appel réel, aucune donnée touchée.
 *
 * L0-13d : plus aucune exception dans domaine/corbeille.ts ; dans services/corbeille.ts, seule la clé alias
 * `brouillonsBuffer` (lue par tests/zernio/z2s-corbeille.test.ts, retirée par L0-13h) reste tolérée.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { messageCorbeille } from "@/domaine/corbeille";

const lire = (f: string) => readFileSync(f, "utf8");
const CLE_ALIAS = /\bbrouillonsBuffer\b/g; // seule exception : la clé alias L0-13, retirée par L0-13h

describe("ST-05 · corbeille sans Buffer", () => {
  it("règle 1 : domaine/corbeille.ts ne contient plus « Buffer » (aucune exception)", () => {
    const reste = lire("src/domaine/corbeille.ts").match(/buffer/gi) ?? [];
    expect(reste).toEqual([]);
  });

  it("règle 2 : services/corbeille.ts n'a plus de « Buffer » hors de la clé alias", () => {
    const reste = lire("src/services/corbeille.ts").replace(CLE_ALIAS, "").match(/buffer/gi) ?? [];
    expect(reste).toEqual([]);
  });

  it("règle 3 : le refus Buffer n'est pas décrit comme propre à la corbeille", () => {
    expect(lire("src/services/corbeille.ts")).not.toMatch(/envoi vers buffer/i);
  });

  it("règle 3 bis : la clé alias est commentée « alias L0-13, retiré par L0-13h » et « dans Buffer ou Zernio » n'existe plus dans src/", () => {
    expect(lire("src/services/corbeille.ts")).toMatch(/alias L0-13, retiré par L0-13h/);
    for (const f of ["src/domaine/corbeille.ts", "src/services/corbeille.ts", "src/services/annulation-video.ts", "src/app/(studio)/videos/actions.ts"]) expect(lire(f)).not.toContain("dans Buffer ou Zernio");
  });

  it("règle 4 : le message garde son comportement (aucun brouillon, un, plusieurs)", () => {
    expect(messageCorbeille(1, 0)).toBe("Vidéo mise à la corbeille. Restaurable pendant 30 jours.");
    expect(messageCorbeille(1, 1)).toBe("Vidéo mise à la corbeille. Restaurable pendant 30 jours. 1 brouillon reste chez l'outil d'envoi : à supprimer dans l'outil.");
    expect(messageCorbeille(2, 3)).toContain("3 brouillons restent");
  });
});
