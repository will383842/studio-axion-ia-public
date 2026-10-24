/** K5 : l'écran de choix. Réglage éteint (aucun `stock` sur les cas) : rien de nouveau ; allumé : filtres et bouton, jamais de fabrication. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined }), usePathname: () => "/cas-concret", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({ confirmerCasAction: vi.fn(), estimerCasAction: vi.fn(), preparerEtLancerAction: vi.fn() }));

import { EntreeCasConcret } from "@/components/formats/cas-concret/entree/EntreeCasConcret";
import { versVueCas, type VueCas } from "@/components/formats/cas-concret/entree/vue";
import { empreinteCas } from "@/formats/cas-concret/cas";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";

const vues: VueCas[] = CATALOGUE.map((c, i) => versVueCas(c, empreinteCas(c), i < 3));
const valides = vues.filter((v) => v.valide);
const aValider = vues.filter((v) => !v.valide);
const rendre = (v: VueCas[], a: VueCas[]) => renderToStaticMarkup(createElement(EntreeCasConcret, { valides: v, aValider: a, montants: {} }));

describe("écran de choix et stock", () => {
  it("réglage éteint : pas de filtres du stock ; le bouton « Proposez-moi un cas restant » est là (refonte de la page, 24/10)", () => {
    const h = rendre(valides, aValider);
    expect(h).toContain("Proposez-moi un cas restant");
    expect(h).not.toContain("Filtres du stock");
  });

  it("réglage allumé : filtres au-dessus des cartes et bouton ; le bouton n'est ni un envoi ni un lancement", () => {
    const avec = valides.map((v, i) => ({ ...v, stock: { traite: i === 0, fiche: `IN-0${i + 1}`, secteur: "IN", taille: "PME" } }));
    const h = rendre(avec, aValider);
    expect(h).toContain("Filtres du stock");
    expect(h).toContain("Proposez-moi un cas restant");
    expect(h.indexOf("Filtres du stock")).toBeLessThan(h.indexOf("<ul"));
    expect(h).not.toContain("Fabriquer la vidéo");
    expect(h).not.toMatch(/<form/);
    expect(h).toContain('aria-pressed="false"');
  });

  it("allumé, sans filtre : le texte d'avant ; la phrase « pour ces filtres » ne vient qu'avec un filtre actif (état local, vérifié par le texte du rendu initial)", () => {
    const avec = valides.map((v, i) => ({ ...v, stock: { traite: i === 0, fiche: `IN-0${i + 1}`, secteur: "IN", taille: "PME" } }));
    expect(rendre(avec, aValider)).not.toContain("Aucun cas pour ces filtres.");
    expect(rendre([], [])).not.toContain("Aucun cas pour ces filtres.");
  });
});
