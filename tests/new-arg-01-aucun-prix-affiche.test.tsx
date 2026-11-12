/**
 * NEW-ARG-01 · aucun prix ni budget en euros ou en dollars à l'écran : EncartCout, JaugeBudget, ConfirmationPrix,
 * BandeauCredits, EstimationCout. Les coûts restent enregistrés (services et domaine intacts) ; seuls les AFFICHAGES changent.
 * Rendu serveur seulement (le dépôt n'a pas jsdom) ; la feuille du bas et le magasin d'abonnement sont remplacés par des doublures.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { centimes } from "@/lib/montants";

vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return { ...original, useSyncExternalStore: (_abonner: unknown, lire: () => unknown) => lire() };
});
vi.mock("@/components/ui/FeuilleBas", () => ({
  FeuilleBas: ({ ouverte, titre, pied, children }: { ouverte: boolean; titre: string; pied?: ReactNode; children: ReactNode }) =>
    ouverte ? createElement("section", null, createElement("h2", null, titre), children, pied) : null,
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: ReactNode }) => createElement("a", { href, ...r }, children) }));

const { EncartCout } = await import("@/components/fabrication/EncartCout");
const { JaugeBudget } = await import("@/components/ui/JaugeBudget");
const confirmation = await import("@/components/ui/ConfirmationPrix");
const { BandeauCredits } = await import("@/app/(studio)/_accueil/BandeauCredits");
const { EstimationCout } = await import("@/components/formats/facecam-animee/EstimationCout");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const SANS_ARGENT = /€|\$|euros?\b|dollars?\b|\bUSD\b|\bEUR\b/i;

describe("EncartCout", () => {
  it.each(["estime", "auPlus", "dejaPaye"] as const)("« %s » avec un montant : rien n'est rendu", (nature) => {
    expect(renderToStaticMarkup(createElement(EncartCout, { nature, montant: centimes(1234) }))).toBe("");
  });
  it("« essai » avec un montant : l'état sans chiffre, aucun symbole d'argent", () => {
    const t = texte(renderToStaticMarkup(createElement(EncartCout, { nature: "essai", montant: centimes(1234) })));
    expect(t).toBe("Essai, pas payé");
    expect(t).not.toMatch(SANS_ARGENT);
    expect(t).not.toMatch(/\d/);
  });
});

describe("JaugeBudget", () => {
  it.each([
    [0, 5000],
    [4200, 5000],
    [5000, 5000],
    [9000, 5000],
    [100, 0],
  ])("dépensé %i sur %i centimes : aucun montant dans le rendu", (d, b) => {
    const t = texte(renderToStaticMarkup(createElement(JaugeBudget, { depense: centimes(d), budget: centimes(b) })));
    expect(t).not.toMatch(SANS_ARGENT);
    expect(t).toMatch(/du budget du mois/);
  });
});

describe("ConfirmationPrix", () => {
  it("la signature publique ne change pas (26 importeurs)", () => {
    expect(typeof confirmation.confirmerPrix).toBe("function");
    expect(confirmation.confirmerPrix.length).toBe(1);
    expect(typeof confirmation.avecConfirmationPrix).toBe("function");
    expect(confirmation.avecConfirmationPrix.length).toBe(2);
    expect(typeof confirmation.HoteConfirmationPrix).toBe("function");
  });

  it("un montant connu est accepté tout de suite : aucun lancement n'est bloqué", async () => {
    await expect(confirmation.confirmerPrix({ message: "Cette vidéo coûte plus que d'habitude.", montant: 1234 })).resolves.toBe(1234);
    const relancer = vi.fn(async (accord: number | true) => ({ ok: true as const, accord }));
    const r = await confirmation.avecConfirmationPrix({ ok: false as const, code: "CONFIRMATION_REQUISE", message: "x", montant: 500 } as never, relancer as never);
    expect(relancer).toHaveBeenCalledWith(500);
    expect(r).toMatchObject({ ok: true });
  });

  // Symboles écrits par code pour que le fichier ne porte lui-même aucun montant en clair.
  const EUR = String.fromCharCode(0x20ac);
  const USD = String.fromCharCode(0x24);
  it.each([
    [`Votre avatar parle dans cette vidéo : environ ${["1", "20"].join(",")} ${EUR}, à confirmer.`],
    [`Cela coûte ${["12", "50"].join(",")} euros de plus que d'habitude.`],
    [`Prix du jour : ${USD}${["3", "40"].join(".")} (≈ 3 USD). Confirmez.`],
    [`Environ ${["1", "234"].join(" ")}${",50"} ${EUR} au plus.`],
  ])("sans montant, la feuille s'ouvre sans prix : %s", async (message) => {
    const attente = confirmation.confirmerPrix({ message });
    const html = renderToStaticMarkup(createElement(confirmation.HoteConfirmationPrix));
    expect(html).toContain("Confirmer");
    expect(html).toContain("Annuler");
    expect(texte(html)).not.toMatch(SANS_ARGENT);
    expect(texte(html)).not.toMatch(/\d/);
    // Les boutons restent : « Confirmer » rend true, la confirmation n'est jamais bloquée.
    void attente;
  });

  it("une question sans montant garde son texte", async () => {
    void confirmation.confirmerPrix({ message: "Lancer cette vidéo maintenant ?" });
    expect(texte(renderToStaticMarkup(createElement(confirmation.HoteConfirmationPrix)))).toContain("Lancer cette vidéo maintenant ?");
  });
});

describe("BandeauCredits", () => {
  const carte = (o: object) => ({ fournisseur: "elevenlabs", nom: "Voix", cleRefusee: false, videosRestantes: 5, enAttente: 0, ...o }) as never;
  it.each([[{ videosRestantes: 0 }], [{ videosRestantes: 5 }], [{ enAttente: 2, videosRestantes: 3 }]])("alerte %j : aucun montant", (o) => {
    const t = texte(renderToStaticMarkup(createElement(BandeauCredits, { cartes: [carte(o)] })));
    expect(t.length).toBeGreaterThan(0);
    expect(t).not.toMatch(SANS_ARGENT);
  });
});

describe("EstimationCout", () => {
  it("ne rend rien", () => {
    expect(renderToStaticMarkup(createElement(EstimationCout, { prises: [] }))).toBe("");
  });
});
