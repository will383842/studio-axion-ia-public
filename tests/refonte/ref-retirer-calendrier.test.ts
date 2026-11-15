/** REF-RETIRER-CALENDRIER : lecture du source — le retrait du calendrier est branché sans appel externe. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (p: string) => readFileSync(p, "utf8");

describe("REF-RETIRER-CALENDRIER", () => {
  it("le panneau du calendrier montre le retrait seulement pour un carrousel programmé à venir", () => {
    const s = lire("src/components/calendrier/ApercuPublication.tsx");
    expect(s).toContain('entree.type === "carrousel"');
    expect(s).toContain('entree.etat === "programme"');
    expect(s).toContain("<RetirerDuCalendrier");
  });
  it("la fiche du carrousel offre le retrait sans JavaScript, avec confirmation cachée", () => {
    const s = lire("src/app/(studio)/carrousels/[id]/page.tsx");
    expect(s).toContain("<summary");
    expect(s).toContain('name="confirmation" value="retirer"');
    const a = lire("src/app/(studio)/carrousels/[id]/actions.ts");
    expect(a).toMatch(/retirerDuCalendrierAction\(donnees: FormData\)[^{]*\{\s*await exigerSession\(/);
  });
});
