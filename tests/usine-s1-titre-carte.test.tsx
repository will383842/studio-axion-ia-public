/** S1 · la carte d'une proposition montre le titre du sujet (repli, contexte, texte pur). Aucun réseau, aucun modèle. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { CarteProposition, titreProposition } = await import("@/components/calendrier/CarteProposition");
import type { IdeeUsine } from "@/domaine/usine";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";

const entree = (titre?: string): EntreeCarte => ({ cle: "k1", jour: "2030-01-07", reseau: "linkedin", type: "video", etat: "propose", heure: "09:00", ...(titre ? { titre } : {}) }) as EntreeCarte;
const sujet = (o: Partial<IdeeUsine> = {}): IdeeUsine => ({ signature: "s", parts: {}, metier: "Plomberie", taille: "TPE", douleur: "Les devis traînent", casUsage: "Devis en dix minutes", ...o });
const rendre = (e: EntreeCarte, s?: IdeeUsine, p: { ressembleA?: string } = {}) => renderToStaticMarkup(<CarteProposition entree={e} debut="2030-01-07" {...(s ? { sujet: s } : {})} {...p} />);

describe("titre de la carte proposition", () => {
  it("montre le titre de la proposition, en deux lignes au plus, texte complet accessible", () => {
    const html = rendre(entree("Relancer un devis sans froisser"), sujet());
    expect(html).toContain("Relancer un devis sans froisser");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain('title="Relancer un devis sans froisser"');
  });
  it("ajoute une ligne de contexte (métier) et « Ressemble à »", () => {
    const html = rendre(entree("Un titre"), sujet(), { ressembleA: "Publication du lundi" });
    expect(html).toContain("Plomberie");
    expect(html).toContain("Ressemble à");
    expect(html).toContain("Publication du lundi");
  });
  it("contexte « Actualité » pour une nouveauté", () => {
    expect(rendre(entree("Un titre"), sujet({ metier: "", parts: { actualite: "a1" } }))).toContain("Actualité");
  });
  it("repli : sans titre, le titre vient du sujet ; jamais de carte sans titre", () => {
    expect(rendre(entree(), sujet({ sujet: "Le sujet de repli" }))).toContain("Le sujet de repli");
    expect(titreProposition(entree(), sujet({ sujet: undefined }))).toBe("Les devis traînent");
    expect(titreProposition(entree(), undefined)).toBeTruthy();
    expect(rendre(entree())).toContain("data-titre-proposition");
  });
  it("rien d'injecté : le texte reste du texte", () => {
    const html = rendre(entree("<img src=x onerror=alert(1)>"), sujet({ metier: "<b>x</b>" }));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>x");
    expect(html).toContain("&lt;img");
  });
});
