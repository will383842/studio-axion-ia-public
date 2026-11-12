/**
 * Note : jsdom n'est pas installé (et on n'en ajoute pas) : le rendu est serveur seulement (renderToStaticMarkup).
 *
 * 12/11 (refonte R2, barre à 7 rubriques dont 3 pliables, décision de Williams) : les titres de groupe fixes laissent la place à des
 * rubriques pliables (aria-expanded) ; le gabarit compact et les autres règles restent.
 * Menu : gabarit compact aligné sur le CRM Pro,
 * bouton de repli accessible, OngletsBas (mobile) sans aria-current sur un bouton.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => "/cas-concret" }));

const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");

const html = renderToStaticMarkup(createElement(BarreLaterale, { formats: [], actionDeconnexion: async () => undefined }));
const lire = (p: string) => readFileSync(p, "utf8");
const sourceBarre = lire("src/components/coquille/BarreLaterale.tsx");

describe("rubriques pliables", () => {
  it("deux rubriques pliables ici (Mes contenus, Ressources) avec aria-expanded ; « Publier » n'a qu'une sous-rubrique visible : lien direct vers /mots, sans pli ; plus de titres h2 de groupe", () => {
    for (const t of ["Mes contenus", "Ressources"]) expect(html).toMatch(new RegExp(`<a[^>]*aria-expanded="(true|false)"[^>]*>(?:(?!</a>)[\\s\\S])*${t}`));
    expect(html).toMatch(/<a[^>]*href="\/mots"[^>]*>(?:(?!<\/a>)[\s\S])*Publier/);
    expect(html).not.toMatch(/<a[^>]*aria-expanded[^>]*href="\/mots"/);
    expect(html.match(/<h2/g)).toHaveLength(1); // seul « Compte » (pied), réservé aux lecteurs d'écran
    expect(html).not.toContain("aria-disabled");
  });

  it("plus aucun ancien mécanisme de section repliable ni de liste de formats dans le code", () => {
    for (const mot of ["SectionPliable", "lireSectionRepliee", "CLE_SECTION", "sectionOuverte", "SousListeFormats"]) expect(sourceBarre).not.toContain(mot);
  });
  it("chaque liste reliée à un titre (aria-labelledby) ou à sa rubrique (aria-controls) existe", () => {
    for (const m of html.matchAll(/<ul[^>]*aria-labelledby="([^"]+)"/g)) expect(html).toContain(`id="${m[1]}"`);
    for (const m of html.matchAll(/aria-controls="([^"]+)"/g)) expect(html).toContain(`id="${m[1]}"`);
  });
  it("un seul <nav aria-label=\"Menu principal\"> ; « Nouvelle vidéo » est hors du <nav>", () => {
    expect(html.match(/<nav/g)).toHaveLength(1);
    expect(html).toContain('<nav id="');
    expect(html).toContain('aria-label="Menu principal"');
    expect(html.indexOf('href="/nouvelle"')).toBeLessThan(html.indexOf("<nav"));
  });
  it("« Vidéos » est allumé sur /cas-concret (rubrique « Mes contenus » ouverte d'elle-même), une seule ligne porte aria-current", () => {
    expect(html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0]).toContain('href="/videos"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});

describe("bouton de repli", () => {
  it("aria-expanded, aria-controls vers l'id de la nav, libellé « Replier le menu »", () => {
    const b = html.match(/<button[^>]*aria-label="Replier le menu"[^>]*>/)?.[0] ?? "";
    expect(b).toContain('aria-expanded="true"');
    const id = b.match(/aria-controls="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<nav id="${id}"`);
  });
  it("la clé mémorisée et la variable de largeur ne changent pas", () => {
    expect(sourceBarre).toContain('"studio.barreRepliee"');
    expect(sourceBarre).toContain("--largeur-barre-courante");
  });
});

/** Gabarit compact aligné sur le CRM Pro (Williams : « le menu latéral est plus gros que celui du CRM Pro »). */
describe("barre latérale compacte (bureau)", () => {
  it("liens 14 px, graisse 500, py-1.5 (jamais font-semibold sur l'entrée active)", () => {
    const actif = html.match(/<a[^>]*aria-current="page"[^>]*href="\/videos"[^>]*>|<a[^>]*href="\/videos"[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(actif).toContain("text-sm");
    expect(actif).toContain("font-medium");
    expect(actif).toContain("py-1.5");
    expect(actif).not.toContain("font-semibold");
  });
  it("le pied (Réglages, Me déconnecter) est en text-xs font-medium", () => {
    const reglages = html.match(/<a[^>]*href="\/reglages"[^>]*>/)?.[0] ?? "";
    expect(reglages).toContain("text-xs");
    expect(reglages).toContain("font-medium");
    expect(html).toMatch(/<button[^>]*font-medium[^>]*>(?:<svg|<span)[\s\S]*?Me déconnecter/);
  });
  it("en-têtes de rubrique pliable : 14 px, graisse 500, comme les autres entrées (jamais en gras)", () => {
    const entete = html.match(/<a[^>]*aria-expanded[^>]*>/)?.[0] ?? "";
    expect(entete).toContain("text-sm");
    expect(entete).toContain("font-medium");
    expect(entete).not.toContain("font-semibold");
  });
  it("la barre n'emploie ni font-bold/extrabold sur les items, ni Archivo (font-titre), ni la taille sur mesure 13 px des sous-items", () => {
    for (const f of ["src/components/coquille/BarreLaterale.tsx", "src/components/coquille/OngletsBas.tsx"]) {
      const src = lire(f);
      expect(src).not.toMatch(/font-(bold|extrabold|black)/);
      expect(src).not.toContain("font-titre");
      expect(src).not.toContain("Archivo");
    }
    expect(sourceBarre).not.toContain("text-[13px] transition");
    // L'item actif n'est pas en font-semibold (seul le titre de groupe l'est).
    expect(sourceBarre).not.toMatch(/actif \? "[^"]*font-semibold/);
    expect(html).not.toContain("Archivo");
  });
  it("le logo de la barre : Manrope 14 px gras serré, sous-marque 10 px à +0.05em, pas d'Archivo", () => {
    const logo = lire("src/components/coquille/Logo.tsx");
    expect(logo).toContain("text-sm font-bold tracking-tight");
    expect(logo).toContain("tracking-wider");
    expect(logo).not.toContain("tracking-[0.2em]");
  });
  it("la barre et les onglets du bas prennent le bleu ciel (classe theme-barre)", () => {
    expect(html).toContain("theme-barre");
    expect(lire("src/components/coquille/OngletsBas.tsx")).toContain("theme-barre");
  });
});

describe("OngletsBas (mobile) : statique", () => {
  const src = lire("src/components/coquille/OngletsBas.tsx");
  it("aria-label « Menu principal (mobile) »", () => {
    expect(src).toContain('aria-label="Menu principal (mobile)"');
  });
  it("aucun aria-current sur un <button> ; aria-haspopup=\"dialog\" sur Créer et Plus", () => {
    for (const b of src.match(/<button[\s\S]*?>/g) ?? []) expect(b).not.toContain("aria-current");
    expect(src.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
  });
  it("Plus actif : texte caché « , contient la page en cours »", () => {
    expect(src).toContain('<span className="sr-only">, contient la page en cours</span>');
  });
});
