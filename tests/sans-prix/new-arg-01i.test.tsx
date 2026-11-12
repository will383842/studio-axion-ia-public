/**
 * NEW-ARG-01i : derniers affichages d'argent (réglages des crédits, titre des détails d'une vidéo).
 * Règle du fondateur : aucun symbole monétaire ni mot de prix à l'écran. Rendu serveur (le dépôt n'a pas jsdom),
 * données fictives. Les saisies restent présentes : seul leur libellé change.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/(studio)/reglages/actions", () => ({ declarerRechargeAction: vi.fn() }));
vi.mock("@/app/(studio)/reglages/actions-credit-claude", () => ({ definirCycleCreditClaudeAction: vi.fn(), releverCreditClaudeAction: vi.fn() }));
// La feuille du bas est un portail fermé par défaut : on affiche son contenu pour regarder le vrai champ de saisie.
vi.mock("@/components/ui/FeuilleBas", () => ({
  FeuilleBas: ({ titre, description, children }: { titre: string; description?: string; children: React.ReactNode }) => (
    <section>
      <h2>{titre}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

const { Credits } = await import("@/components/reglages/Credits");
const { CreditClaude } = await import("@/components/reglages/CreditClaude");
const { OngletDetails } = await import("@/components/videos/fiche/OngletDetails");
type CarteCredit = import("@/services/credits").CarteCredit;
type VueCreditClaude = import("@/services/credit-claude").VueCreditClaude;

const INTERDIT = /€|\$|\bEUR\b|\bUSD\b|euros?\b|dollars?\b|\bco[ûu]ts?\b|\bprix\b/i;

/** Texte visible + attributs lisibles (libellés, placeholders, aria) : pas les noms de classes. */
function visible(html: string): string {
  return html.replace(/\sclass="[^"]*"/g, "");
}

const carte: CarteCredit = {
  fournisseur: "heygen",
  nom: "HeyGen",
  mode: "suivi",
  clePresente: true,
  cleRefusee: false,
  epuise: false,
  unite: "usd",
  soldeTexte: null,
  disponibleTexte: null,
  reserveTexte: null,
  consommeMoisTexte: "",
  plafondMoisTexte: "",
  videosRestantes: null,
  pourcentage: null,
  ton: "neutre",
  urlRecharge: "https://exemple.fr/recharge",
  expirations: [],
  enAttente: 0,
};

const vue: VueCreditClaude = {
  totalTexte: "",
  mode: "abonnements",
  api: { finCle: null, eteinte: true, consommeMoisTexte: "" },
  comptes: [
    {
      source: "abonnement-1",
      libelle: "Compte 1",
      finCle: null,
      etat: "estime",
      restantTexte: "",
      depuisTexte: null,
      restantCentimes: null,
      releveLe: null,
      cycleSaisiSurTexte: null,
      base: null,
      cycle: null,
      expireLe: null,
      prochainLe: null,
      desactive: false,
      doublon: false,
      horsTotalTexte: null,
    },
  ],
};

describe("NEW-ARG-01i : aucun symbole d'argent dans les réglages des crédits", () => {
  it("Credits : la saisie de recharge existe encore, sans symbole ni mot de prix", () => {
    const html = visible(renderToStaticMarkup(<Credits cartes={[carte]} />));
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain("Montant");
    expect(html).not.toMatch(INTERDIT);
  });

  it("CreditClaude : les deux saisies (cycle, relevé) et leurs boutons restent, sans symbole", () => {
    const html = visible(renderToStaticMarkup(<CreditClaude vue={vue} />));
    expect(html).toContain("Enregistrer le cycle");
    expect(html).toContain("Enregistrer le relevé");
    expect((html.match(/inputMode="decimal"/g) ?? []).length).toBe(2);
    expect(html).not.toMatch(INTERDIT);
  });

  it("CreditClaude : les textes exportés ne portent aucun symbole d'argent", async () => {
    const { TEXTES_CREDIT_CLAUDE } = await import("@/components/reglages/CreditClaude");
    for (const t of Object.values(TEXTES_CREDIT_CLAUDE)) expect(t).not.toMatch(/€|\$|\bEUR\b|\bUSD\b/);
  });
});

describe("NEW-ARG-01i : titre des détails d'une vidéo", () => {
  it("un chiffre fourni s'affiche encore, sous un titre sans mot de prix", () => {
    const html = visible(renderToStaticMarkup(<OngletDetails couts={[{ libelle: "Durée", valeur: "42 s", icone: "horloge" }]} />));
    expect(html).toContain("42 s");
    expect(html).not.toMatch(INTERDIT);
  });
});
