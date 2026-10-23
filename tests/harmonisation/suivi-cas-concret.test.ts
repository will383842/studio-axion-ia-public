/** Lot F8 : le suivi du cas concret passe par EnTeteSuivi + ActionsSuivi + BoutonArreter ; relance par adresse fixe, carte « À relire », argent « Déjà payé ». */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never) }));
vi.mock("@/app/(studio)/videos/actions", () => ({ arreterFabricationAction: async () => ({ ok: true, donnees: { centimes: 0 } }), annulerVideoAction: async () => ({ ok: true }) }));
vi.mock("@/hooks/useTravaux", () => ({ useTravaux: () => ({ travail: undefined, actualiser: async () => undefined }) }));

const { SuiviCasConcret } = await import("@/components/formats/cas-concret/fiche-video/SuiviCasConcret");
const { CODE_A_RELIRE } = await import("@/components/formats/cas-concret/fiche-video/a-relire");

const SOURCE = readFileSync(join(process.cwd(), "src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx"), "utf8");
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const etape = (cle: string, statut: string, extra: Record<string, unknown> = {}) => ({ cle, nom: cle, icone: "film", dependDe: [], statut, progression: 0, sortieFichierIds: [], ...extra });
const travail = (statut: string, extra: Record<string, unknown> = {}) =>
  ({ id: "t1", cibleId: "v1", statut, progression: 40, resteSec: 300, resteMin: 5, tentatives: 1, depense: { centimes: 1234, devise: "EUR" }, enAttenteFournisseur: false, boucleActive: true, etapes: [etape("voix", "terminee"), etape("montage", "en_cours")], ...extra }) as never;
const html = (statut: string, extra?: Record<string, unknown>, props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SuiviCasConcret, { initial: travail(statut, extra), ...props } as never));
const echecAvec = (erreur: Record<string, unknown>) => ({ etapes: [etape("voix", "terminee"), etape("montage", "echec", { erreur })] });

describe("SuiviCasConcret · socle des suivis", () => {
  it("est écrit avec EnTeteSuivi, ActionsSuivi et garde l'adresse fixe de relance", () => {
    expect(SOURCE).toMatch(/<EnTeteSuivi\b/);
    expect(SOURCE).toMatch(/<ActionsSuivi\b/);
    expect(SOURCE).toMatch(/<BoutonArreter\b/);
    expect(SOURCE).toContain("fetch(ADRESSE_RELANCE");
    expect(SOURCE).not.toMatch(/dépensé/);
  });

  it("en cours : le titre et la phrase communs, Arrêter puis Annuler, « Déjà payé : » (jamais « dépensés »)", () => {
    const h = html("en_cours");
    const t = texte(h);
    expect(t).toContain("Votre vidéo se fabrique");
    expect(t).toContain("Vous pouvez fermer.");
    expect(t.indexOf("Arrêter")).toBeGreaterThan(-1);
    expect(t.indexOf("Arrêter")).toBeLessThan(t.indexOf("Annuler cette vidéo"));
    expect(t).toMatch(/Déjà payé : 12,34/);
    expect(t).not.toMatch(/dépensé/);
    expect(t.match(/Votre vidéo se fabrique/g)).toHaveLength(1);
  });

  it("arrêt réessayable : titre commun, message, « Reprendre cette étape » avant Annuler, pas d'Arrêter", () => {
    const t = texte(html("echec", echecAvec({ code: "X", messagePourWill: "La voix a coincé.", reessayable: true })));
    expect(t).toContain("La fabrication s'est arrêtée");
    expect(t).toContain("La voix a coincé.");
    expect(t.match(/La voix a coincé\./g)).toHaveLength(1);
    expect(t.indexOf("Reprendre cette étape")).toBeGreaterThan(-1);
    expect(t.indexOf("Reprendre cette étape")).toBeLessThan(t.indexOf("Annuler cette vidéo"));
    expect(t).not.toContain("Arrêter");
  });

  it("arrêt sans réessai : « Recommencer ce cas » (adresse du format) et Annuler, aucun Reprendre", () => {
    const h = html("echec", echecAvec({ code: "X", messagePourWill: "Le calage a échoué.", reessayable: false }));
    expect(h).toContain('href="/cas-concret"');
    expect(texte(h)).toContain("Recommencer ce cas");
    expect(texte(h)).toContain("Annuler cette vidéo");
    expect(texte(h)).not.toContain("Reprendre");
    expect(texte(h)).not.toContain("Vous pouvez reprendre");
    expect(texte(h).match(/Le calage a échoué\./g)).toHaveLength(1);
  });

  it("arrêt sans réessai ni message d'étape : phrase de l'en-tête sans « Vous pouvez reprendre »", () => {
    const t = texte(html("echec", echecAvec({ code: "X", messagePourWill: "Le calage a échoué.", reessayable: false })));
    expect(t).not.toContain("Vous pouvez reprendre");
    expect(t).toContain("Une étape n'a pas abouti. Vous pouvez recommencer ce cas.");
  });

  it("étape en échec sans erreur, sans réessai : jamais « Vous pouvez reprendre », « Recommencer ce cas » proposé", () => {
    const t = texte(html("echec", { erreur: { code: "X", reessayable: false }, etapes: [etape("voix", "terminee"), etape("montage", "echec")] }));
    expect(t).toContain("Cette étape n'a pas abouti.");
    expect(t).toContain("Une étape n'a pas abouti. Vous pouvez recommencer ce cas.");
    expect(t).not.toContain("Vous pouvez reprendre");
    expect(t).not.toContain("Reprendre cette étape");
    expect(t).toContain("Recommencer ce cas");
  });

  it("arrêt sans réessai, erreur du travail seule (aucune étape en échec) : le message une fois, « Recommencer ce cas »", () => {
    const t = texte(html("echec", { erreur: { code: "X", messagePourWill: "Le montage a échoué.", reessayable: false } }));
    expect(t.match(/Le montage a échoué\./g)).toHaveLength(1);
    expect(t).toContain("Recommencer ce cas");
    expect(t).not.toContain("Reprendre");
    expect(t).not.toContain("Vous pouvez reprendre");
  });

  it("erreur du travail seule, sans message ni étape en échec, sans réessai : phrase de fin, jamais « Vous pouvez reprendre »", () => {
    const t = texte(html("echec", { erreur: { code: "X", reessayable: false } }));
    expect(t).toContain("Une étape n'a pas abouti. Vous pouvez recommencer ce cas.");
    expect(t).not.toContain("Vous pouvez reprendre");
    expect(t).toContain("Recommencer ce cas");
  });

  it("étape en échec sans erreur propre, message porté par le travail : affiché une seule fois", () => {
    const t = texte(html("echec", { erreur: { code: "X", messagePourWill: "Le montage a échoué.", reessayable: false }, etapes: [etape("voix", "terminee"), etape("montage", "echec")] }));
    expect(t.match(/Le montage a échoué\./g)).toHaveLength(1);
    expect(t).toContain("Recommencer ce cas");
  });

  it("À relire : titre commun, carte « À relire », ni Reprendre ni Annuler ni Arrêter", () => {
    const h = html("echec", echecAvec({ code: CODE_A_RELIRE, messagePourWill: "Relisez le script.", reessayable: true }));
    const t = texte(h);
    expect(t).toContain("Votre script attend votre relecture");
    expect(t).toContain("À relire");
    expect(t).not.toMatch(/Reprendre|Annuler|Arrêter/);
    expect(t).not.toContain("La fabrication s'est arrêtée");
  });

  it("vidéo arrêtée par Will : « Vous pouvez recommencer cette vidéo. », Recommencer + Annuler, pas de Reprendre", () => {
    const h = html("annule");
    const t = texte(h);
    expect(t).toContain("Vous avez arrêté la fabrication");
    expect(t).toContain("Vous pouvez recommencer cette vidéo.");
    expect(t).not.toContain("Rien n'est perdu.");
    expect(t).not.toContain("Reprendre");
    expect(t).toContain("Recommencer");
    expect(t).toContain("Annuler cette vidéo");
    expect(h).toContain('href="/cas-concret"');
  });

  it("terminé : pas de titre en plus ni de bouton", () => {
    const t = texte(html("termine", { progression: 100 }));
    expect(t).not.toContain("Votre vidéo se fabrique");
    expect(t).not.toMatch(/Arrêter|Annuler|Reprendre/);
  });

  it("vidéo PRÊTE dont le travail est annulé (retouche arrêtée) : ni « arrêtée », ni Recommencer, ni Annuler cette vidéo", () => {
    const t = texte(html("annule", undefined, { videoPrete: true, annulable: false }));
    expect(t).not.toContain("Vous avez arrêté la fabrication");
    expect(t).not.toContain("Annuler cette vidéo");
    expect(t).not.toContain("Recommencer");
  });

  it("vidéo arrêtée non prête : « Recommencer » (sans « ce cas ») et Annuler cette vidéo", () => {
    const t = texte(html("annule", undefined, { videoPrete: false, annulable: true }));
    expect(t).toContain("Recommencer");
    expect(t).not.toContain("Recommencer ce cas");
    expect(t).toContain("Annuler cette vidéo");
  });

  it("annulable=false : pas de « Annuler cette vidéo » sur un arrêt", () => {
    const t = texte(html("echec", echecAvec({ code: "X", messagePourWill: "La voix a coincé.", reessayable: true }), { annulable: false }));
    expect(t).not.toContain("Annuler cette vidéo");
  });
});
