/**
 * Correcteur final B — TEST-UI-REEL :
 *  - U3 : Réglages › Connexions affichait la pastille « Essai » et « 0 services en mode essai » quand tout est relié ;
 *  - U4 : Nouvelle vidéo › Plateau et Voix sans aucun personnage : un état vide qui guide (« Ajoutez-vous d'abord »,
 *    vers Personnages) au lieu d'un simple « Ajouter » ou de « Choisissez d'abord qui parle ».
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/nouvelle/avocat" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { Connexions } = await import("@/components/reglages/Connexions");
const { ChoixVoix, EtapeDistribution } = await import("@/assistant/etapes/Distribution");

/** Texte visible (sans balises ni attributs). */
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

function connexion(type: string, etat: "relie" | "simulation") {
  return { type, titre: type, etat, options: [{ id: etat === "relie" ? "reel" : "simulation", nom: "Service", choisi: true, pret: true, manque: [] }], details: [] } as never;
}

describe("U3 · Connexions : rien à signaler quand tout est relié", () => {
  it("tout relié : ni pastille « Essai », ni « 0 services en mode essai »", () => {
    const html = texte(renderToStaticMarkup(createElement(Connexions, { connexions: [connexion("texte", "relie"), connexion("montage", "relie")] })));
    expect(html).not.toMatch(/mode essai/);
    expect(html).not.toMatch(/\bEssai\b/);
  });

  it("un service en essai : la ligne reste", () => {
    const html = texte(renderToStaticMarkup(createElement(Connexions, { connexions: [connexion("texte", "relie"), connexion("montage", "simulation")] })));
    expect(html).toContain("1 service en mode essai.");
  });
});

describe("U4 · Plateau et Voix sans personnage : « Ajoutez-vous d'abord »", () => {
  const brouillon = { distribution: [], styles: {}, reglages: {}, ratios: [] } as never;
  const contexte = { personnages: [], elements: [], idees: [], enregistrer: async () => null } as never;
  const props = { formatId: "avocat", brouillon, modifier: () => undefined, suivant: () => undefined, allerA: () => undefined, repliee: false, contexte, compacte: true };

  it("Voix : invitation à s'ajouter, lien vers Personnages", () => {
    const html = renderToStaticMarkup(createElement(ChoixVoix, props));
    expect(texte(html)).toContain("Ajoutez-vous d'abord");
    expect(texte(html)).not.toContain("Choisissez d'abord qui parle");
    expect(html).toContain('href="/personnages"');
  });

  it("Plateau (qui joue) : invitation à s'ajouter, lien vers Personnages", () => {
    const html = renderToStaticMarkup(createElement(EtapeDistribution, props));
    expect(texte(html)).toContain("Ajoutez-vous d'abord");
    expect(html).toContain('href="/personnages"');
  });
});
