/**
 * CAL-13b : les composants déjà livrés sont branchés dans la page du calendrier.
 * Lecture du source de la page (pas de navigateur) + rendu serveur du bandeau, de l'alerte et de l'état vide.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlerteProximite } from "@/components/calendrier/AlerteProximite";
import { BandeauAujourdhui } from "@/components/calendrier/BandeauAujourdhui";
import { VueVide } from "@/components/calendrier/VueVide";

const page = readFileSync("src/app/(studio)/calendrier/page.tsx", "utf8");

describe("CAL-13b — branchements dans page.tsx", () => {
  it("importe chaque composant branché", () => {
    for (const nom of ["VueAgenda", "VueVide", "BandeauAujourdhui", "AlerteProximite"]) {
      expect(page, nom).toMatch(new RegExp(`import \\{ ${nom} \\} from "@/components/calendrier/${nom}"`));
    }
  });
  it("vue Agenda sur téléphone (860 px et moins), grille sur ordinateur", () => {
    expect(page).toMatch(/min-\[861px\]:hidden[^]*?<VueAgenda entrees=\{entreesSemaine\}[^>]*criteres=\{criteres\}/);
    expect(page).toMatch(/hidden min-\[861px\]:block[^]*?<SemaineAvecApercu[^>]*criteres=\{criteres\}/);
  });
  it("les critères des filtres (réseaux allumés) sont passés à la grille", () => {
    expect(page).toMatch(/const criteres: CriteresFiltre = \{ reseaux: reseauxActifs, types: \[\], etats: \[\] \}/);
  });
  it("états vides : semaine passée et filtre vide", () => {
    expect(page).toMatch(/<VueVide etat="semaine-passee"/);
    expect(page).toMatch(/<VueVide etat="filtre-vide"/);
  });
  it("bandeau d'aujourd'hui et alerte de proximité", () => {
    expect(page).toMatch(/<BandeauAujourdhui entrees=\{entreesSemaine\} aujourdhui=\{aujourdhui\}/);
    expect(page).toMatch(/<AlerteProximite entrees=\{visibles\}/);
  });
  it("un seul orange plein, aucun prix, aucune couleur écrite en dur", () => {
    expect(page).not.toMatch(/bg-orange\b/);
    expect(page).not.toMatch(/€|\bEUR\b/);
    expect(page).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});

describe("CAL-13b — rendu des composants branchés", () => {
  it("bandeau : compte du jour et lien vers la journée", () => {
    const h = renderToStaticMarkup(<BandeauAujourdhui entrees={[{ jour: "2026-11-14", etat: "a_valider" }, { jour: "2026-11-15", etat: "brouillon" }]} aujourdhui="2026-11-14" />);
    expect(h).toContain("1 publication, dont 1 à valider.");
    expect(h).toContain("/calendrier?vue=jour&amp;date=2026-11-14");
  });
  it("alerte : rien sans paires", () => {
    expect(renderToStaticMarkup(<AlerteProximite entrees={[]} />)).toBe("");
  });
  it("états vides", () => {
    expect(renderToStaticMarkup(<VueVide etat="semaine-passee" lienAujourdhui="/calendrier" />)).toContain("Semaine passée");
    expect(renderToStaticMarkup(<VueVide etat="filtre-vide" lienTout="/calendrier" />)).toContain("Tout afficher");
  });
});
