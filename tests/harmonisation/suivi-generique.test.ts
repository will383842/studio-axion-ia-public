/** Lot F5 : le suivi générique d'un travail (fiche vidéo, avocat, face caméra animée) passe par EnTeteSuivi + ActionsSuivi ; l'argent se dit « Déjà payé : x ». */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/actions", () => ({ reessayerTravailAction: async () => ({ ok: true }) }));
vi.mock("@/app/(studio)/videos/actions", () => ({ arreterFabricationAction: async () => ({ ok: true, donnees: { centimes: 0 } }), passerDevantAction: async () => ({ ok: true }) }));
vi.mock("@/hooks/useTravaux", () => ({ useTravaux: () => ({ travail: undefined, actualiser: async () => undefined }) }));

const { SuiviTravail } = await import("@/components/videos/SuiviTravail");

const SOURCE = readFileSync(join(process.cwd(), "src/components/videos/SuiviTravail.tsx"), "utf8");
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const etape = (cle: string, statut: string, extra: Record<string, unknown> = {}) => ({ cle, nom: cle, icone: "film", dependDe: [], statut, progression: 0, sortieFichierIds: [], ...extra });
const travail = (statut: string, extra: Record<string, unknown> = {}) =>
  ({ id: "t1", cibleId: "v1", statut, progression: 40, resteSec: 300, resteMin: 5, depense: { centimes: 1234, devise: "EUR" }, enAttenteFournisseur: false, boucleActive: true, etapes: [etape("voix", "terminee"), etape("montage", "en_cours")], ...extra }) as never;
const rendre = (statut: string, extra?: Record<string, unknown>, props: Record<string, unknown> = {}) => texte(renderToStaticMarkup(createElement(SuiviTravail, { initial: travail(statut, extra), ...props })));

describe("SuiviTravail · socle des suivis", () => {
  it("est écrit avec EnTeteSuivi et ActionsSuivi, garde son sondage et son « Passer devant »", () => {
    expect(SOURCE).toMatch(/<EnTeteSuivi\b/);
    expect(SOURCE).toMatch(/<ActionsSuivi\b/);
    expect(SOURCE).toMatch(/<SuiviFabrication\b/);
    expect(SOURCE).toMatch(/useTravaux\(/);
    expect(SOURCE).toMatch(/passerDevant/);
  });

  it("en file : titre commun, Passer devant avant Arrêter, « Déjà payé : » et plus jamais « dépensés »", () => {
    const t = rendre("en_file", { rang: 2 });
    expect(t).toContain("Votre vidéo se fabrique");
    expect(t.indexOf("Passer devant")).toBeGreaterThan(-1);
    expect(t.indexOf("Passer devant")).toBeLessThan(t.indexOf("Arrêter"));
    expect(t).toMatch(/Déjà payé : 12,34/);
    expect(t).not.toMatch(/dépensé/);
  });

  it("en file : l'en-tête ne promet pas « Encore quelques minutes » (le temps est dit une seule fois, sous la barre)", () => {
    const t = rendre("en_file", { rang: 2 });
    expect(t).not.toContain("Encore quelques minutes");
    expect(t).toContain("Vous pouvez fermer");
  });

  it("feuille « Arrêter » : pas de phrase d'argent sans prix, et « Déjà payé » comme libellé commun", () => {
    const arreter = readFileSync(join(process.cwd(), "src/components/videos/BoutonArreter.tsx"), "utf8");
    expect(arreter).not.toContain("Déjà dépensé");
    expect(arreter).toMatch(/LIBELLES_ARGENT\.dejaPaye/);
    expect(SOURCE).toMatch(/description=\{sansPrix \? "Ce qui est déjà fait est gardé\." : undefined\}/);
  });

  it("format sans prix : aucun montant, aucun « Déjà payé »", () => {
    const t = rendre("en_cours", {}, { sansPrix: true });
    expect(t).toContain("Arrêter");
    expect(t).not.toMatch(/€|Déjà payé|dépensé/);
  });

  it("rien de payé : pas de ligne d'argent", () => {
    expect(rendre("en_cours", { depense: { centimes: 0, devise: "EUR" } })).not.toMatch(/Déjà payé/);
  });

  it("arrêtée sur erreur : titre commun et message de l'étape ; arrêtée par Will : « Rien n'est perdu. »", () => {
    const echec = rendre("echec", { etapes: [etape("voix", "echec", { erreur: { messagePourWill: "La voix a coincé.", reessayable: true } })] });
    expect(echec).toContain("La fabrication s'est arrêtée");
    expect(echec).toContain("La voix a coincé.");
    expect(echec).not.toContain("Passer devant");
    const annule = rendre("annule");
    expect(annule).toContain("Vous avez arrêté la fabrication");
    expect(annule).toContain("Rien n'est perdu.");
  });

  it("terminé : pas de titre en plus (la fiche dit déjà que la vidéo est prête)", () => {
    expect(rendre("termine", { progression: 100 })).not.toContain("Votre vidéo se fabrique");
  });
});
