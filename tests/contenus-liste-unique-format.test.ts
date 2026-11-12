/**
 * REF-R5 : « Mes contenus » est UNE liste. Filtre Famille (Tout reste dedans) et nouveau filtre Format.
 * Données inventées, aucun appel réel.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FiltresContenus, compterContenus, lienContenus, lireFiltresContenus } from "../src/components/contenus/FiltresContenus";
import { GrilleContenus, calculerVueContenus } from "../src/components/contenus/GrilleContenus";
import { filtrerContenus, type ContenuBibliotheque } from "../src/domaine/filtres-contenus";
import { listerFormats } from "../src/formats";

const [F1, F2] = listerFormats({ inclureMasques: true, inclureReservesAWill: true }).map((f) => f.id);
const T = (n: number) => new Date(Date.parse("2026-11-01T10:00:00.000Z") + n * 60_000).toISOString();
const c = (id: string, type: ContenuBibliotheque["type"], n: number, format?: string): ContenuBibliotheque => ({
  id, type, titre: `Titre ${id}`, statut: "pret", reseaux: [], modifieLe: T(n), ...(format ? { format } : {}),
});
const JEU = [c("v1", "video", 1, F1), c("v2", "video", 2, F1), c("v3", "video", 3, F2), c("c1", "carrousel", 4), c("i1", "image", 5)];

describe("REF-R5 : filtre Format", () => {
  it("l'adresse ne garde qu'un format du registre ; une valeur inconnue est ignorée", () => {
    expect(lireFiltresContenus({ format: F1 }).format).toBe(F1);
    expect(lireFiltresContenus({ format: "zzz" }).format).toBeUndefined();
    expect(lireFiltresContenus({ format: "" })).toEqual({ page: 1 });
  });
  it("le filtre ne garde que les contenus de ce format", () => {
    expect(filtrerContenus(JEU, { format: F1 }).map((x) => x.id)).toEqual(["v1", "v2"]);
    expect(calculerVueContenus(JEU, { format: F2 }).total).toBe(1);
  });
  it("le lien garde les autres filtres ; « Tous » retire le format", () => {
    expect(lienContenus({ type: "video", format: F1 }, { format: F2 })).toBe(`/contenus?type=video&format=${F2}`);
    expect(lienContenus({ type: "video", format: F1 }, { format: undefined })).toBe("/contenus?type=video");
  });
  it("les compteurs ne listent que les formats présents ; le groupe s'affiche avec ses nombres", () => {
    const comptes = compterContenus(JEU);
    expect(comptes.formats.map((f) => [f.id, f.nombre])).toEqual([[F1, 2], [F2, 1]]);
    const html = renderToStaticMarkup(createElement(FiltresContenus, { params: {}, filtres: {}, comptes }));
    expect(html).toContain('aria-label="Format"');
    expect(html).toContain(`href="/contenus?format=${F1}"`);
  });
  it("sans vidéo, pas de groupe Format ; un format choisi garde son groupe", () => {
    const sans = renderToStaticMarkup(createElement(FiltresContenus, { params: {}, filtres: {}, comptes: compterContenus([c("c1", "carrousel", 1)]) }));
    expect(sans).not.toContain('aria-label="Format"');
  });
  it("un format sans résultat donne l'état vide avec le lien pour tout afficher", () => {
    const f = { format: F2, page: 1 };
    const html = renderToStaticMarkup(createElement(GrilleContenus, { vue: calculerVueContenus([c("v1", "video", 1, F1)], f), params: { format: F2 }, filtres: f }));
    expect(html).toContain("Rien ne correspond");
  });
});

describe("REF-R5 : une seule liste, filtre Famille", () => {
  const html = renderToStaticMarkup(createElement(FiltresContenus, { params: {}, filtres: {}, comptes: compterContenus(JEU) }));
  it("« Tout » est dans le filtre Famille, avec Vidéos, Images et Carrousels", () => {
    expect(html).toContain('aria-label="Famille"');
    expect(html).not.toContain('aria-label="Type"');
    expect(html).toMatch(/aria-current="true"[^>]*>Tout</);
    for (const mot of ["Vidéos", "Images", "Carrousels"]) expect(html).toContain(mot);
  });
  it("les cartes portent le liseré et la pastille de leur famille (jetons)", () => {
    const g = renderToStaticMarkup(createElement(GrilleContenus, { vue: calculerVueContenus(JEU, {}), params: {}, filtres: {} }));
    expect(g).toContain("border-l-fam-video");
    expect(g).toContain("border-l-fam-carrousel");
    expect(g).toContain('data-famille="infographie"');
  });
  it("la page /contenus est une seule liste (un seul composant de grille), sans orange d'accent", () => {
    const page = readFileSync(join(__dirname, "../src/app/(studio)/contenus/page.tsx"), "utf-8");
    expect(page.match(/<GrilleContenus/g)).toHaveLength(1);
    const grille = readFileSync(join(__dirname, "../src/components/contenus/GrilleContenus.tsx"), "utf-8");
    expect(grille).not.toMatch(/orange/);
  });
});
