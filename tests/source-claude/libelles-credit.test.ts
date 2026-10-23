/**
 * Textes d'argent de Claude en mode « abonnements » : un forfait se renouvelle, on ne le « recharge » pas.
 * Rendu en HTML statique, aucun appel.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/reglages", useSearchParams: () => new URLSearchParams() }));

const domCredits = await import("@/domaine/credits");
const suivis = await import("@/fournisseurs/credits/suivis");
const { Credits } = await import("@/components/reglages/Credits");
const { ProgressionEtapes } = await import("@/components/ui/ProgressionEtapes");

const carte = (extra: Record<string, unknown>) =>
  ({
    fournisseur: "anthropic",
    nom: "Claude",
    mode: "suivi",
    clePresente: true,
    cleRefusee: false,
    epuise: false,
    unite: "usd",
    soldeTexte: "10,00 $",
    disponibleTexte: "10,00 $",
    reserveTexte: null,
    consommeMoisTexte: "1,00 $",
    plafondMoisTexte: "100,00 $",
    videosRestantes: null,
    pourcentage: 50,
    ton: "vert",
    urlRecharge: "https://console.anthropic.com/",
    expirations: [],
    enAttente: 0,
    ...extra,
  }) as never;

describe("4. Réglages > Crédits et suivi : pas de « Recharger » pour Claude en mode abonnements", () => {
  it("carte Claude, abonnements → pas de bouton « Recharger »", () => {
    const html = renderToStaticMarkup(createElement(Credits, { cartes: [carte({ abonnements: true })] }));
    expect(html).not.toMatch(/Recharger/);
  });

  it("carte Claude, mode api → « Recharger » conservé", () => {
    expect(renderToStaticMarkup(createElement(Credits, { cartes: [carte({})] }))).toMatch(/Recharger/);
  });

  it("suivi : attente de crédit Claude → sans « Rechargez » ; un autre service → « Rechargez » conservé", () => {
    const rendre = (attenteCredit: string) => renderToStaticMarkup(createElement(ProgressionEtapes, { etapes: [], progression: 10, suivi: { attenteCredit, abonnementsClaude: attenteCredit === "Claude" } }));
    expect(rendre("Claude")).not.toMatch(/Rechargez/);
    expect(rendre("HeyGen")).toMatch(/Rechargez/);
  });

  it("suivi : « reprendra au renouvellement » seulement en mode abonnements ; en mode api → « Rechargez »", () => {
    const rendre = (abonnementsClaude?: boolean) => renderToStaticMarkup(createElement(ProgressionEtapes, { etapes: [], progression: 10, suivi: { attenteCredit: "Claude", abonnementsClaude } }));
    expect(rendre(true)).toMatch(/renouvellement/);
    expect(rendre(true)).not.toMatch(/Rechargez/);
    expect(rendre(false)).toMatch(/Rechargez/);
    expect(rendre(false)).not.toMatch(/renouvellement/);
    expect(rendre(undefined)).toMatch(/Rechargez/);
  });

  it("écriture en attente sans attente enregistrée : texte neutre, pas « Comptes Claude épuisés »", () => {
    expect(domCredits.messageAttenteEcritureParDefaut(true)).toBe("Écriture en attente : touchez « Reprendre » quand ce sera possible.");
    expect(domCredits.messageAttenteEcritureParDefaut(true)).not.toMatch(/épuisés/);
    expect(domCredits.messageAttenteEcritureParDefaut(false)).toMatch(/rechargez/i);
  });
});

describe("clé payante seule : Connexions", () => {
  it("aucune clé d'abonnement : la fin de la clé payante est montrée et /v1/models est lu avec elle", async () => {
    const appels: { url: string; cle: string }[] = [];
    const faux = (async (url: string, init: { headers: Record<string, string> }) => {
      appels.push({ url, cle: init.headers["x-api-key"] });
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const env = { ANTHROPIC_API_KEY_PAYANTE: "sk-ant-payante-ab12" };
    expect(suivis.cleClaudeAffichee(env)).toBe("sk-ant-payante-ab12");
    const r = await suivis.creerLecteurAnthropic(env, faux).testerConnexion();
    expect(r.ok).toBe(true);
    expect(r.finCle).toMatch(/ab12$/);
    expect(appels).toEqual([{ url: "https://api.anthropic.com/v1/models?limit=1", cle: "sk-ant-payante-ab12" }]);
  });

  it("une clé d'abonnement posée garde la priorité sur la clé payante", () => {
    expect(suivis.cleClaudeAffichee({ ANTHROPIC_API_KEY_PAYANTE: "payante", ANTHROPIC_API_KEY_2: "abo" })).toBe("abo");
  });

  it("aucune clé du tout → « Aucune clé sur le serveur »", async () => {
    const r = await suivis.creerLecteurAnthropic({}, (async () => { throw new Error("réseau interdit"); }) as typeof fetch).testerConnexion();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Aucune clé/);
  });
});
