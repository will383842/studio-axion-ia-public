/**
 * Barre à 7 rubriques (12/11, refonte R2, décision de Williams) : structure, une seule entrée « page en cours »,
 * rubrique ouverte d'elle-même sur sa page, lien direct quand il ne reste qu'une sous-rubrique, pages trouvables par la recherche.
 * Rendu serveur seulement (jsdom n'est pas installé) : les clics, Échap et le localStorage ne sont pas rejoués ici.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

let chemin = "/";
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => chemin }));

const nav = await import("@/components/coquille/navigation");
const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");
const { pagesTrouvees } = await import("@/components/coquille/pages-recherche");

function rendre(c: string, options: { surLeSite?: boolean; aPublier?: boolean } = {}) {
  chemin = c;
  return renderToStaticMarkup(createElement(BarreLaterale, { formats: [], actionDeconnexion: async () => undefined, ...options }));
}
/** Le bouton du chevron d'une rubrique pliable (aria-expanded + aria-label « Ouvrir/Fermer X »). */
const entete = (html: string, libelle: string) => html.match(new RegExp(`<button[^>]*aria-expanded="(?:true|false)"[^>]*aria-label="(?:Ouvrir|Fermer) ${libelle}"[^>]*>`))?.[0] ?? "";
/** Le lien (icône + libellé) de la rubrique : sa balise ouvrante et son contenu jusqu'au libellé. */
const lien = (html: string, libelle: string) => html.match(new RegExp(`<a[^>]*>(?:(?!</a>)[\\s\\S])*${libelle}`))?.[0] ?? "";
const nbCourant = (html: string) => html.match(/aria-current="page"/g)?.length ?? 0;

describe("structure des sept rubriques", () => {
  it("ordre : Accueil, Écrire, Mes contenus, Calendrier, Publier, Résultats, Ressources ; Réglages en bas", () => {
    expect(nav.RUBRIQUES_NAV.map((r) => r.libelle)).toEqual(["Accueil", "Écrire", "Mes contenus", "Calendrier", "Publier", "Résultats", "Ressources"]);
    expect(nav.NAV_PIED.map((e) => e.libelle)).toEqual(["Réglages"]);
  });
  it("Mes contenus : Vidéos, Carrousels (pas d'Infographies tant que l'écran n'existe pas) ; Ressources : Personnages, Bibliothèque", () => {
    const sous = (id: string) => nav.RUBRIQUES_NAV.find((r) => r.id === id)!.enfants!.map((e) => e.libelle);
    expect(sous("contenus")).toEqual(["Vidéos", "Carrousels"]);
    expect(sous("ressources")).toEqual(["Personnages", "Bibliothèque"]);
  });
  it("l'ordre du HTML suit celui de la barre", () => {
    const html = rendre("/mesures", { surLeSite: true, aPublier: true });
    const ordre = ["Accueil", "Écrire", "Mes contenus", "Calendrier", "Publier", "Résultats", "Ressources", "Réglages"].map((l) => html.indexOf(`>${l}</span>`));
    expect(ordre.every((i) => i > 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });
  it("Écrire reste allumé sur /scripts et /idees ; Réglages sur /veille", () => {
    expect(nav.hrefCourant("/scripts/abc")).toBe("/ecrire");
    expect(nav.hrefCourant("/idees")).toBe("/ecrire");
    expect(nav.hrefCourant("/veille")).toBe("/reglages");
  });
  it("Vidéos est allumé sur toutes les pages de création gardées (/formats, /cas-concret, /image-video…)", () => {
    for (const c of ["/videos", "/formats/avocat", "/cas-concret", "/image-video", "/tableau/nouvelle", "/face-camera-animee", "/demo-facecam", "/tutoriel-outil"]) expect(nav.hrefCourant(c), c).toBe("/videos");
  });
});

describe("une seule entrée « page en cours »", () => {
  it("exactement une aria-current sur chaque page de la barre", () => {
    const pages = ["/", "/ecrire", "/videos", "/carrousels", "/calendrier", "/a-publier", "/sur-le-site", "/mots", "/mesures", "/personnages", "/bibliotheque", "/reglages", "/veille", "/nouvelle"];
    for (const c of pages) expect(nbCourant(rendre(c, { surLeSite: true, aPublier: true })), c).toBe(1);
  });
  it("aucune sur une page hors barre (/contenus, /modeles) : l'en-tête d'une rubrique n'en porte jamais", () => {
    for (const c of ["/contenus", "/modeles"]) expect(nbCourant(rendre(c)), c).toBe(0);
    expect(entete(rendre("/videos"), "Mes contenus")).not.toContain("aria-current");
  });
});

describe("rubrique ouverte sur sa page", () => {
  it("fermée par défaut, ouverte d'elle-même sur l'une de ses pages (aria-expanded)", () => {
    expect(entete(rendre("/mesures"), "Mes contenus")).toContain('aria-expanded="false"');
    expect(entete(rendre("/mesures"), "Ressources")).toContain('aria-expanded="false"');
    expect(entete(rendre("/carrousels"), "Mes contenus")).toContain('aria-expanded="true"');
    expect(entete(rendre("/cas-concret"), "Mes contenus")).toContain('aria-expanded="true"');
    expect(entete(rendre("/bibliotheque"), "Ressources")).toContain('aria-expanded="true"');
  });
  it("la liste fermée est cachée (hidden), l'ouverte est visible", () => {
    expect(rendre("/mesures")).toContain('hidden=""');
    const ouverte = rendre("/carrousels");
    expect(ouverte.match(/<ul id="[^"]*-sous"[^>]*>/g)?.some((u) => !u.includes("hidden"))).toBe(true);
  });
  it("Publier s'ouvre sur /a-publier quand la page est allumée", () => {
    expect(entete(rendre("/a-publier", { aPublier: true }), "Publier")).toContain('aria-expanded="true"');
    expect(nav.rubriqueDeLaPage("/sur-le-site", true, false)).toBe("publier");
    expect(nav.rubriqueDeLaPage("/mesures")).toBeNull();
  });
});

describe("lien direct quand il ne reste qu'une sous-rubrique", () => {
  it("Publier sans réglage allumé : un lien vers /mots, sans pli ni aria-expanded", () => {
    const publier = nav.rubriquesLaterales(false, false).find((r) => r.id === "publier")!;
    expect(nav.estPliable(publier)).toBe(false);
    expect(nav.cibleRubrique(publier).href).toBe("/mots");
    const html = rendre("/mesures");
    expect(html).toMatch(/<a[^>]*href="\/mots"[^>]*>(?:(?!<\/a>)[\s\S])*Publier/);
    expect(entete(html, "Publier")).toBe("");
  });
  it("Publier avec « Vidéos validées » ou « Sur le site » : rubrique pliable dont le clic mène à la première sous-rubrique visible", () => {
    const avecA = nav.rubriquesLaterales(false, true).find((r) => r.id === "publier")!;
    expect(nav.estPliable(avecA)).toBe(true);
    expect(nav.cibleRubrique(avecA).href).toBe("/a-publier");
    expect(nav.cibleRubrique(nav.rubriquesLaterales(true, false).find((r) => r.id === "publier")!).href).toBe("/sur-le-site");
    expect(lien(rendre("/mesures", { aPublier: true }), "Publier")).toContain('href="/a-publier"');
  });
  it("le clic sur Mes contenus mène à Vidéos, sur Ressources à Personnages", () => {
    const html = rendre("/mesures");
    expect(lien(html, "Mes contenus")).toContain('href="/videos"');
    expect(lien(html, "Ressources")).toContain('href="/personnages"');
  });
});

describe("pages hors barre mais trouvables", () => {
  const hrefs = (q: string) => pagesTrouvees(q).map((p) => p.href);
  it("Tous mes contenus et Mes modèles ne sont plus dans la barre, mais la recherche les trouve", () => {
    const html = rendre("/mesures", { surLeSite: true, aPublier: true });
    expect(html).not.toContain('href="/contenus"');
    expect(html).not.toContain('href="/modeles"');
    expect(hrefs("tous mes contenus")).toContain("/contenus");
    expect(hrefs("modeles")).toContain("/modeles");
  });
  it("les écrans de création ne sont plus dans la recherche (ils passent par Nouvelle vidéo et la feuille Créer)", () => {
    for (const [q, h] of [["cas concret", "/cas-concret"], ["tableau", "/tableau/nouvelle"], ["image", "/image-video"], ["face camera", "/face-camera-animee"]]) expect(hrefs(q), q).not.toContain(h);
  });
});

describe("en-tête de rubrique : le lien navigue, le bouton plie", () => {
  it("le bouton du chevron (44 px) porte aria-expanded, aria-controls et un nom « Ouvrir/Fermer … » ; le lien n'a pas aria-expanded", () => {
    const html = rendre("/carrousels");
    const b = entete(html, "Mes contenus");
    expect(b).toContain('aria-label="Fermer Mes contenus"');
    expect(b).toContain("size-11");
    expect(entete(rendre("/mesures"), "Ressources")).toContain('aria-label="Ouvrir Ressources"');
    expect(html).not.toMatch(/<a[^>]*aria-expanded/);
    const id = b.match(/aria-controls="([^"]+)"/)?.[1];
    expect(html).toContain(`id="${id}"`);
  });
  it("le clic du lien ignore les touches (nouvel onglet) : le code le prévoit", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/components/coquille/BarreLaterale.tsx", "utf8")).toContain("ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0");
  });
});

describe("feuille « Créer » : formatsCreer", () => {
  const f = (id: string, statut: "actif" | "bientot" | "masque", extra: Partial<import("@/components/coquille/navigation").FormatNavigation> = {}) => ({ id, nom: `Format ${id}`, icone: "film" as const, statut, nbVideos: 0, ...extra });
  it("garde les formats actifs ; écarte « bientôt », masqués et essais", () => {
    const liste = nav.formatsCreer([f("a", "actif"), f("b", "bientot"), f("c", "masque"), f("d", "actif", { essai: true })]);
    expect(liste.map((x) => x.id)).toEqual(["a"]);
  });
  it("adresse de création du registre, sinon repli /nouvelle/<id>", () => {
    const liste = nav.formatsCreer([f("a", "actif"), f("cas", "actif", { adresseCreation: "/cas-concret" })]);
    expect(liste.map((x) => x.href)).toEqual(["/nouvelle/a", "/cas-concret"]);
  });
});
