/**
 * Harmonisation des écrans de création (docs/harmonisation-ecrans/PLAN.md §f) : TEST DE CONTRAT.
 * `A_FAIRE` ne peut que rétrécir : un écran conforme n'y figure plus, aucun écran n'y est ajouté.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const { GabaritCreation } = await import("@/components/creation/GabaritCreation");

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");

interface EcranCreation {
  id: string;
  /** Page, sous src/app/(studio). */
  page: string;
  /** Composants racine du générateur (sous src/), lus avec la page. */
  composants: string[];
  /** Les composants sont des branches EXCLUSIVES à l'écran (étapes de l'assistant) : on compte le maximum, pas la somme. */
  exclusifs?: boolean;
}

export const ECRANS_CREATION: EcranCreation[] = [
  { id: "assistant", page: "nouvelle/[format]/page.tsx", composants: ["assistant/Assistant.tsx", "assistant/etapes/Express.tsx", "assistant/etapes/Fabrication.tsx"], exclusifs: true },
  { id: "face-camera-animee", page: "face-camera-animee/page.tsx", composants: ["components/formats/facecam-animee/DepotPrise.tsx"] },
  { id: "tableau", page: "tableau/nouvelle/page.tsx", composants: ["components/formats/tableau-anime/NouvelleVideoTableau.tsx"] },
  { id: "cas-concret", page: "cas-concret/page.tsx", composants: ["components/formats/cas-concret/entree/EntreeCasConcret.tsx"] },
  { id: "image-video-depot", page: "image-video/page.tsx", composants: ["components/formats/image-video/Depot.tsx"] },
  { id: "image-video-video", page: "image-video/[videoId]/page.tsx", composants: ["components/formats/image-video/Fabrication.tsx"] },
  { id: "image-video-lot", page: "image-video/lot/[lotId]/page.tsx", composants: ["components/formats/image-video/SuiviLot.tsx"] },
];

/** Photo de départ (H0), figée : la liste ne peut que rétrécir. */
const A_FAIRE_DEPART: readonly string[] = ["assistant", "face-camera-animee", "tableau", "cas-concret", "image-video-depot", "image-video-video", "image-video-lot"];

/** Écarts au contrat : écran hors de la photo de départ, doublon, écran de départ retiré du registre. */
function ecartsAFaire(aFaire: string[], registre: string[]): string[] {
  const ajoutes = aFaire.filter((id) => !A_FAIRE_DEPART.includes(id));
  const doublons = aFaire.filter((id, i) => aFaire.indexOf(id) !== i);
  const retires = A_FAIRE_DEPART.filter((id) => !registre.includes(id));
  return [...ajoutes, ...doublons, ...retires];
}

/** Écrans pas encore passés dans le gabarit. À retirer d'ici, un par un, à la fin de chaque lot. */
export const A_FAIRE: string[] = ["cas-concret"];

const dossierPage = (e: EcranCreation) => join("src/app/(studio)", e.page.replace(/\/page\.tsx$/, ""));
const sourcePage = (e: EcranCreation) => lire(join("src/app/(studio)", e.page));

/** Le gabarit est dans la page, ou dans le composant racine client du générateur (assistant : l'étape vit côté client). */
const sourcesDe = (e: EcranCreation) => [sourcePage(e), ...e.composants.map((c) => lire(join("src", c)))];

function conforme(e: EcranCreation): boolean {
  return sourcesDe(e).some((s) => /<GabaritCreation/.test(s));
}

describe("registre des écrans de création", () => {
  it("A_FAIRE ne contient que des écrans du registre, jamais un écran ajouté", () => {
    for (const id of A_FAIRE) expect(A_FAIRE_DEPART).toContain(id);
  });

  it("A_FAIRE ne peut que rétrécir : un écran ajouté au registre ET à A_FAIRE est refusé, un écran retiré du registre aussi", () => {
    const ids = ECRANS_CREATION.map((e) => e.id);
    expect(ecartsAFaire(A_FAIRE, ids)).toEqual([]);
    expect(ecartsAFaire([...A_FAIRE, "nouvel-ecran"], [...ids, "nouvel-ecran"])).toContain("nouvel-ecran");
    expect(ecartsAFaire(A_FAIRE, ids.filter((id) => id !== "assistant"))).toContain("assistant");
    expect(ecartsAFaire(["assistant", "assistant"], ids)).toContain("assistant");
  });

  it("chaque page du registre existe", () => {
    for (const e of ECRANS_CREATION) expect(existsSync(join(RACINE, "src/app/(studio)", e.page)), e.page).toBe(true);
  });

  it("un écran conforme ne figure plus dans A_FAIRE, un écran à faire n'est pas déjà conforme", () => {
    for (const e of ECRANS_CREATION) expect(conforme(e), `${e.id} : conforme=${conforme(e)} / A_FAIRE=${A_FAIRE.includes(e.id)}`).toBe(!A_FAIRE.includes(e.id));
  });
});

describe("écrans conformes", () => {
  it("le registre est cohérent", () => {
    expect(ECRANS_CREATION.length - A_FAIRE.length).toBeGreaterThanOrEqual(0);
  });

  for (const e of ECRANS_CREATION.filter((x) => !A_FAIRE.includes(x.id))) {
    describe(e.id, () => {
      const sources = () => sourcesDe(e);

      it("utilise GabaritCreation, sans EnTeteAssistant ni <h1> maison", () => {
        expect(sources().some((s) => /<GabaritCreation/.test(s))).toBe(true);
        for (const s of sources()) {
          expect(s).not.toMatch(/EnTeteAssistant/);
          expect(s).not.toMatch(/<h1\b/);
        }
      });

      it("aucun fixed bottom-0 hors BarreActionCollee", () => {
        for (const s of sources()) expect(s).not.toMatch(/fixed bottom-0/);
      });

      it("au plus une BarreActionCollee sur le chemin de rendu (gabarit OU enfant)", () => {
        const barres = (s: string) => (/<GabaritCreation[\s\S]*?\baction=/.test(s) ? 1 : 0) + (s.match(/<BarreActionCollee\b/g)?.length ?? 0);
        const comptes = sources().map(barres);
        expect(e.exclusifs ? Math.max(...comptes) : comptes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1);
      });

      it("a un loading.tsx dans le dossier de la route", () => {
        expect(existsSync(join(RACINE, dossierPage(e), "loading.tsx"))).toBe(true);
      });
    });
  }
});

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const zones = (html: string) => [...html.matchAll(/data-zone="([a-z]+)"/g)].map((m) => m[1]);
const rendre = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(GabaritCreation, { entete: { titre: "Titre" }, ...p } as never, createElement("p", null, "Zone du générateur")));

describe("GabaritCreation · rendu", () => {
  it("racine data-gabarit, un seul h1, zones dans l'ordre", () => {
    const html = rendre({
      etapes: { etapes: [{ cle: "a", libelle: "Un" }, { cle: "b", libelle: "Deux" }], courante: 0 },
      suivi: createElement("div", null, "suivi"),
      recents: createElement("div", null, "récents"),
      action: createElement("button", null, "Aller"),
    });
    expect(html).toContain('data-gabarit="creation"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(zones(html)).toEqual(["entete", "etapes", "specifique", "suivi", "recents", "action"]);
  });

  it("écran à une étape, sans suivi ni récents ni action : entête et zone seulement", () => {
    const html = rendre({});
    expect(zones(html)).toEqual(["entete", "specifique"]);
    expect(html).not.toMatch(/fixed/);
  });

  it("sans action : aucune BarreActionCollee (l'enfant porte la sienne)", () => {
    expect(rendre({ recents: createElement("div", null, "r") })).not.toContain('data-zone="action"');
  });

  it("avec action : une seule barre collée, le contenu s'y trouve", () => {
    const html = rendre({ action: createElement("button", null, "Aller"), actionSecondaire: createElement("button", null, "Retour") });
    expect(html.match(/fixed inset-x-0/g)).toHaveLength(1);
    expect(texte(html)).toContain("Aller");
    expect(texte(html)).toContain("Retour");
  });

  it("largeur étroite par défaut, large sur demande", () => {
    expect(rendre({})).toContain("max-w-2xl");
    expect(rendre({ largeur: "large" })).not.toContain("max-w-2xl");
  });
});
