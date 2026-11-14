/**
 * CAL-13b : les composants déjà livrés sont branchés dans la page du calendrier.
 * Lecture du source de la page (pas de navigateur) + rendu serveur du bandeau, de l'alerte et de l'état vide.
 */
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlerteProximite } from "@/components/calendrier/AlerteProximite";
import { BandeauAujourdhui } from "@/components/calendrier/BandeauAujourdhui";
import { VueVide } from "@/components/calendrier/VueVide";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
const listerCalendrier = vi.fn(async () => [] as unknown[]);
vi.mock("@/services/publications", () => ({ listerCalendrier: () => listerCalendrier(), listerAProgrammer: async () => [] }));

const { monter } = await import("../aides/crochets-factices");
const { cleJour } = await import("@/lib/dates");

/** Rend la page du calendrier avec une semaine contenant ces publications (aujourd'hui, heure de Paris). */
async function pageAvec(pubs: Record<string, unknown>[], params: Record<string, string> = {}): Promise<string> {
  monter(() => null, {}).rendre(); // remet les crochets factices à zéro
  listerCalendrier.mockResolvedValueOnce([
    { jour: cleJour(new Date()), publications: pubs.map((p, i) => ({ id: `p${i}`, statut: "programmee", via: "manuel", date: new Date().toISOString(), texte: "Un texte", reseauNom: "Réseau", video: null, ...p })) },
  ]);
  const { default: Page } = await import("../../src/app/(studio)/calendrier/page");
  return renderToStaticMarkup((await Page({ searchParams: Promise.resolve(params) })) as ReactElement);
}
/** Seulement la partie « téléphone » (Agenda) du rendu. */
const agenda = (h: string) => h.slice(h.indexOf("data-agenda"), h.indexOf("hidden min-[861px]:block"));

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
  it("les critères des filtres (réseaux allumés, plus types, états et mot de l'adresse — CAL-13d) sont passés à la grille", () => {
    expect(page).toMatch(/const criteresComplets: CriteresFiltre = \{ \.\.\.filtres, reseaux: reseauxActifs.length === RESEAUX_CALENDRIER.length \? undefined : reseauxActifs \}/);
    // Le mot est appliqué avant (titre + texte) : la grille et l'Agenda reçoivent des critères sans mot.
    expect(page).toMatch(/const criteres: CriteresFiltre = \{ \.\.\.criteresComplets, motCle: "" \}/);
  });
  it("états vides : semaine passée et filtre vide", () => {
    expect(page).toMatch(/<VueVide etat="semaine-passee"/);
    expect(page).toMatch(/<VueVide etat="filtre-vide"/);
  });
  it("bandeau d'aujourd'hui et alerte de proximité", () => {
    expect(page).toMatch(/<BandeauAujourdhui entrees=\{visiblesReelles\} aujourdhui=\{aujourdhui\}/);
    expect(page).toMatch(/<AlerteProximite entrees=\{visiblesReelles\}/);
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

describe("CAL-13b — comportement de la page (correctifs de la relecture)", () => {
  beforeEach(() => listerCalendrier.mockReset());

  it("1. une publication YouTube reste visible sans ?reseaux= (grille et Agenda)", async () => {
    const h = await pageAvec([{ reseau: "youtube", videoId: "v1" }, { reseau: "youtube-shorts", videoId: "v2" }]);
    expect(h).toContain('data-carte="publication:p0|youtube"');
    expect(h).toContain('data-carte="publication:p1|youtube-shorts"');
    expect(h.match(/data-carte="publication:p0\|youtube"/g)?.length).toBe(2); // Agenda + grille
  });
  it("1. une semaine 100 % YouTube n'affiche pas « filtre-vide »", async () => {
    const h = await pageAvec([{ reseau: "youtube", videoId: "v1" }]);
    expect(h).not.toContain("Aucune publication ne correspond");
    expect(h).not.toContain("Tout afficher");
  });
  it("1. avec un filtre explicite, YouTube est bien masqué et « filtre-vide » apparaît", async () => {
    const h = await pageAvec([{ reseau: "youtube", videoId: "v1" }], { reseaux: "linkedin" });
    expect(h).not.toContain('data-carte="publication:p0|youtube"');
    expect(h).toContain("Tout afficher");
  });
  it("2. un envoi Buffer refusé n'est pas montré « Programmé » sur téléphone", async () => {
    const h = agenda(await pageAvec([{ reseau: "linkedin", via: "buffer", statut: "programmee", etatEnvoi: "refuse" }]));
    expect(h).toContain('data-etat="a_corriger"');
    expect(h).toContain("À corriger");
    expect(h).not.toContain("Programmé");
  });
  it("2. « À vérifier » et « Envoi en cours » gardent leurs mots", async () => {
    const h = agenda(await pageAvec([{ reseau: "linkedin", via: "buffer", etatEnvoi: "a-verifier" }, { reseau: "facebook", via: "buffer", etatEnvoi: "en-cours" }]));
    expect(h).toContain("À vérifier");
    expect(h).toContain("Envoi en cours");
    expect(h).not.toContain("Programmé");
  });
  it("2. un essai reste « Essai »", async () => {
    const h = agenda(await pageAvec([{ reseau: "linkedin", via: "simulation" }]));
    expect(h).toContain("Essai");
    expect(h).not.toContain("Programmé");
  });
  it("3. le titre de chaque jour de l'Agenda mène à la vue Jour (filtres gardés)", async () => {
    const h = agenda(await pageAvec([{ reseau: "linkedin" }], { reseaux: "linkedin,facebook" }));
    const jour = cleJour(new Date());
    expect(h).toContain(`href="/calendrier?vue=jour&amp;date=${jour}&amp;reseaux=linkedin,facebook"`);
    expect(h).toContain("Ouvrir la journée du");
  });
  it("4. le nom du compte visé est montré sur téléphone", async () => {
    const h = agenda(await pageAvec([{ reseau: "linkedin", canalNom: "Page entreprise" }, { reseau: "linkedin", canalNom: "Compte perso" }]));
    expect(h).toContain("· Page entreprise");
    expect(h).toContain("· Compte perso");
  });
  it("mineur : un essai ne compte pas comme publication ; le compteur suit le filtre des réseaux", async () => {
    const h = await pageAvec([{ reseau: "linkedin" }, { reseau: "linkedin", via: "simulation" }, { reseau: "facebook" }], { reseaux: "linkedin" });
    expect(h).toContain("1 publication");
    expect(h).toContain("1 essai");
  });
});
