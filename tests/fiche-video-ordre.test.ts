/**
 * Lot F (08/11, Williams) : la fiche /videos/[id] va à l'essentiel. La vidéo d'abord, un titre sobre, puis les actions
 * (Valider, Télécharger, Lien privé), les pastilles de réseau, seulement Durée et Vues en chiffres, le sujet replié,
 * et 6 onglets : Publier · Retouches · Sous-titres · Texte · Résultats · Détails.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockNavigation } from "./helpers/next-mocks";

vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }), usePathname: () => "/videos/v1" }));
vi.mock("@/app/(studio)/videos/actions", () => ({
  archiverVideosAction: vi.fn(),
  changerEtapeEditorialeAction: vi.fn(),
  desarchiverVideosAction: vi.fn(),
  enregistrerCommeModeleAction: vi.fn(),
  renommerVideoAction: vi.fn(),
  mettreALaCorbeilleAction: vi.fn(),
  viderCorbeilleAction: vi.fn(),
}));

const lire = (f: string) => readFileSync(f, "utf8");
const page = lire("src/app/(studio)/videos/[id]/page.tsx");
const corps = page.slice(page.indexOf("<GabaritFicheVideo"));
const format = { id: "facecam", nom: "Face caméra", icone: "camera" } as never;

describe("page : l'ordre des zones et la liste des onglets", () => {
  it("les actions (EnTeteVideo) viennent avant les chiffres, et les chiffres avant les onglets", () => {
    const entete = corps.indexOf("<EnTeteVideo");
    const chiffres = corps.indexOf("chiffres={");
    const onglets = corps.indexOf("onglets={");
    expect(entete).toBeGreaterThan(-1);
    expect(entete).toBeLessThan(chiffres);
    expect(chiffres).toBeLessThan(onglets);
  });

  it("6 onglets exacts, dans l'ordre, avec les identifiants publier et sous-titres gardés", () => {
    const valeurs = [...page.matchAll(/valeur: "([\w-]+)"/g)].map((m) => m[1]);
    expect(valeurs).toEqual(["publier", "retouches", "sous-titres", "script", "resultats", "details"]);
    for (const libelle of ["Publier", "Retouches", "Sous-titres", "Texte", "Résultats", "Détails"]) expect(page).toContain(`libelle: "${libelle}"`);
    for (const ancien of ["Miniature", "Qui parle", "Réglages", "Historique", "Script"]) expect(page).not.toContain(`libelle: "${ancien}"`);
  });

  it("Retouches s'affiche si prête, retouches, modifications ou miniatures", () => {
    expect(page).toContain("prete || d.retouches.length || modifications.length || d.miniatures.length");
  });

  it("seules Durée et Vues restent dans les chiffres du haut ; les coûts passent dans OngletDetails", () => {
    const haut = page.slice(page.indexOf("const chiffres: ChiffreVideo[]"), page.indexOf("const chiffresCout"));
    expect(haut).toContain('libelle: "Durée"');
    expect(haut).toContain('libelle: "Vues"');
    expect(haut).not.toContain("chiffresCoutVideo");
    expect(page).toContain("chiffresCoutVideo({ ...couts, coutEstime: v.coutEstime, fabricationSimulee, estDemo: v.estDemo })");
    expect(page).toMatch(/<OngletDetails\b[^>]*couts=\{chiffresCout\}/);
    expect(page).toContain("reseauxDeLaVideo(");
    expect(page).toMatch(/<SujetReplie\b/);
  });

  it("aucun « Cas concret MD » dans les fichiers du lot (décision du 08/11)", () => {
    for (const f of ["src/components/videos/EnTeteVideo.tsx", "src/components/publication/FeuilleTelecharger.tsx", "src/components/videos/fiche/OngletDetails.tsx", "src/components/videos/fiche/SujetReplie.tsx", "src/app/(studio)/videos/[id]/page.tsx"]) {
      expect(lire(f), f).not.toContain("Cas concret MD");
    }
  });
});

vi.setConfig({ testTimeout: 30000 });

describe("EnTeteVideo", () => {
  it("un seul h1, titre sobre (2 lignes au plus, titre complet en infobulle), Valider présent, pastilles de réseau", async () => {
    const { EnTeteVideo } = await import("@/components/videos/EnTeteVideo");
    const html = renderToStaticMarkup(
      createElement(EnTeteVideo, { videoId: "v1", titre: "Un titre", statut: "prete", etapeEditoriale: "a_relire", format, reseaux: ["linkedin", "instagram"], reseauxPrecis: true }),
    );
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("line-clamp-2");
    expect(html).toContain('title="Un titre"');
    expect(html).toContain("Valider");
    expect(html).toContain('data-precis="oui"');
  });

  it("vidéo pas prête : pas de bouton Valider", async () => {
    const { EnTeteVideo } = await import("@/components/videos/EnTeteVideo");
    const html = renderToStaticMarkup(createElement(EnTeteVideo, { videoId: "v1", titre: "Un titre", statut: "en_fabrication", format, reseaux: [], reseauxPrecis: false }));
    expect(html).not.toMatch(/>Valider</);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("l'emplacement actions est posé sous le titre", async () => {
    const { EnTeteVideo } = await import("@/components/videos/EnTeteVideo");
    const html = renderToStaticMarkup(createElement(EnTeteVideo, { videoId: "v1", titre: "T", statut: "prete", format, reseaux: [], reseauxPrecis: false, actions: createElement("i", null, "ICI") }));
    expect(html.indexOf("ICI")).toBeGreaterThan(html.indexOf("</h1>"));
  });
});

describe("SujetReplie", () => {
  it("un <details> fermé quand le sujet diffère du titre", async () => {
    const { SujetReplie } = await import("@/components/videos/fiche/SujetReplie");
    const html = renderToStaticMarkup(createElement(SujetReplie, { titre: "Le titre", sujet: "Un long sujet de départ" }));
    expect(html).toContain("<details");
    expect(html).not.toContain("open");
    expect(html).toContain("Le sujet de la vidéo");
    expect(html).toContain("Un long sujet de départ");
  });

  it.each([[undefined], [""], ["  Le titre "]])("rien quand le sujet est absent ou identique au titre (%s)", async (sujet) => {
    const { SujetReplie } = await import("@/components/videos/fiche/SujetReplie");
    expect(renderToStaticMarkup(createElement(SujetReplie, { titre: "Le titre", sujet }))).toBe("");
  });
});

describe("OngletDetails", () => {
  it("porte les coûts, puis le contenu (Réglages, Historique)", async () => {
    const { OngletDetails } = await import("@/components/videos/fiche/OngletDetails");
    const html = renderToStaticMarkup(createElement(OngletDetails, { couts: [{ libelle: "Payé", valeur: "1,20 €", icone: "euro" }] }, createElement("p", null, "REGLAGES")));
    expect(html).toContain("Payé");
    expect(html).toContain("1,20");
    expect(html.indexOf("REGLAGES")).toBeGreaterThan(html.indexOf("Payé"));
  });

  it("sans coût (face caméra) : seulement le contenu", async () => {
    const { OngletDetails } = await import("@/components/videos/fiche/OngletDetails");
    const html = renderToStaticMarkup(createElement(OngletDetails, { couts: [] }, createElement("p", null, "REGLAGES")));
    expect(html).toContain("REGLAGES");
    expect(html).not.toContain("<ul");
  });
});

describe("FeuilleTelecharger", () => {
  it("chaque fichier passe par la route de téléchargement direct (identifiants seulement)", () => {
    const src = lire("src/components/publication/FeuilleTelecharger.tsx");
    expect(src).toContain("/api/telechargements/video?video=");
    expect(src).toContain("encodeURIComponent(s.ratio)");
    expect(src).not.toMatch(/href=\{s\.url\}/);
    expect(src).toContain("href={sousTitres[f]}");
  });
});

describe("loading.tsx suit le nouvel ordre", () => {
  it("la rangée d'actions vient avant les chiffres", () => {
    const l = lire("src/app/(studio)/videos/[id]/loading.tsx");
    expect(l.indexOf('data-squelette="actions"')).toBeGreaterThan(-1);
    expect(l.indexOf('data-squelette="actions"')).toBeLessThan(l.indexOf('data-squelette="chiffres"'));
  });
});
