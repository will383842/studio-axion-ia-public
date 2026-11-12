/** Règle « aucun prix » : cartes de crédit sans montant ; un niveau en mots ou une quantité. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/nouvelle/[format]/actions-credits", () => ({ lancerVideosEnAttenteAction: async () => ({ ok: true, donnees: { lancees: [] } }) }));
vi.mock("@/app/(studio)/reglages/actions", () => ({ declarerRechargeAction: async () => ({ ok: true }) }));

const { Credits } = await import("@/components/reglages/Credits");
const { CarteCredits } = await import("@/app/(studio)/_accueil/CarteCredits");
const { niveauCredit, niveauCompteClaude } = await import("@/domaine/niveau-credit");

const carte = (extra: Record<string, unknown> = {}) => ({
  fournisseur: "heygen", nom: "HeyGen", mode: "reel", clePresente: true, cleRefusee: false, epuise: false, unite: "usd",
  soldeTexte: "180,97 $", disponibleTexte: "180,97 $", reserveTexte: "4,00 $", luLe: "2026-11-11T10:00:00Z",
  consommeMoisTexte: "12,50 $", plafondMoisTexte: "50 €", videosRestantes: 7, pourcentage: 60, ton: "vert", urlRecharge: "https://x",
  expirations: [{ montantTexte: "20,00 $", expireLe: "2026-12-01T00:00:00Z" }], enAttente: 0, ...extra,
});
const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("crédits sans montant", () => {
  it("Réglages › Crédits et carte de l'Accueil n'affichent ni € ni $ (hors champ de saisie)", () => {
    const cartes = [carte(), carte({ fournisseur: "fal", nom: "fal.ai", videosRestantes: 40 }), carte({ fournisseur: "anthropic", nom: "Claude", videosRestantes: 3, ton: "orange" })] as never;
    const reglages = texte(renderToStaticMarkup(createElement(Credits, { cartes })).replace(/<(?:label|dialog)[\s\S]*?<\/(?:label|dialog)>/g, ""));
    expect(reglages).not.toMatch(/[€]|\d\s?\$|180,97/);
    expect(reglages).toContain("≈ 7 vidéos");
    const accueil = texte(renderToStaticMarkup(createElement(CarteCredits, { cartes, brouillonsPrets: 0 })));
    expect(accueil).not.toMatch(/[$€]|180,97/);
    expect(accueil).toContain("≈ 7 vidéos restantes");
    expect(accueil).toContain("Crédit suffisant");
    expect(accueil).toContain("À recharger bientôt");
  });

  it("niveaux : mêmes seuils que le bandeau", () => {
    const base = { ton: "vert" as const, videosRestantes: 50 as number | null, soldeConnu: true };
    expect(niveauCredit(base)).toBe("suffisant");
    expect(niveauCredit({ ...base, videosRestantes: 10 })).toBe("bientot");
    expect(niveauCredit({ ...base, videosRestantes: 0 })).toBe("epuise");
    expect(niveauCredit({ ...base, epuise: true })).toBe("epuise");
    expect(niveauCompteClaude({ etat: "estime", restantCentimes: 1500 })).toBe("bientot");
    expect(niveauCompteClaude({ etat: "a-renseigner", restantCentimes: null })).toBe("inconnu");
  });
});
