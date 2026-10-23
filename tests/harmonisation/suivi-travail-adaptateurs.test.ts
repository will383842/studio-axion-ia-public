/** Harmonisation H8b : l'assistant (face caméra, avocat) rend sa fabrication via SuiviFabrication ; aucun montant sur la face caméra. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const { SuiviFabrication } = await import("@/components/creation/SuiviFabrication");
const { versSuiviFabrication, versSuiviParlant } = await import("@/components/creation/vues-travail");

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const etape = (cle: string, statut: string, extra: Record<string, unknown> = {}) => ({ cle, nom: cle, icone: "film", dependDe: [], statut, progression: statut === "terminee" ? 100 : 0, sortieFichierIds: [], ...extra });
const travail = (p: Record<string, unknown> = {}) =>
  ({
    id: "t1",
    cibleId: "v1",
    statut: "en_cours",
    progression: 40,
    resteSec: 300,
    resteMin: 5,
    heureFin: "15 h 40",
    depense: { centimes: 1234, devise: "EUR" },
    enAttenteFournisseur: false,
    boucleActive: true,
    etapes: [etape("voix", "terminee"), etape("montage", "en_cours", { progression: 40 }), etape("export", "en_attente")],
    ...p,
  }) as never;

describe("versSuiviFabrication (VueTravail → vue normalisée)", () => {
  it("en cours : étapes faite / en cours / à venir, progression et temps repris du travail", () => {
    const v = versSuiviFabrication(travail());
    expect(v.etat).toBe("en-cours");
    expect(v.etapes.map((e) => e.etat)).toEqual(["faite", "en-cours", "a-venir"]);
    expect(v.progression).toBe(40);
    expect(v.suivi).toMatchObject({ resteMin: 5, heureFin: "15 h 40" });
  });

  it("terminé : prête ; échec d'une étape : coincée avec sa phrase ; annulé : arrêtée ; étape ignorée gardée", () => {
    expect(versSuiviFabrication(travail({ statut: "termine", progression: 100 })).etat).toBe("prete");
    const echec = versSuiviFabrication(travail({ statut: "echec", etapes: [etape("voix", "echec", { erreur: { messagePourWill: "La voix a coincé.", reessayable: true } })] }));
    expect(echec.etat).toBe("coincee");
    expect(echec.etapes[0]).toMatchObject({ etat: "arretee", erreur: { message: "La voix a coincé.", reessayable: true } });
    expect(versSuiviFabrication(travail({ statut: "annule" })).etat).toBe("arretee");
    expect(versSuiviFabrication(travail({ etapes: [etape("x", "ignoree")] })).etapes[0].etat).toBe("ignoree");
  });

  it("file d'attente et outil ralenti repris, sans aucun champ d'argent", () => {
    const v = versSuiviFabrication(travail({ statut: "en_file", rang: 2, debutVers: "15 h 10", enAttenteFournisseur: true, attenteCredit: "ElevenLabs" }));
    expect(v.suivi).toMatchObject({ rang: 2, debutVers: "15 h 10", enAttenteFournisseur: true, attenteCredit: "ElevenLabs" });
    expect(JSON.stringify(v)).not.toMatch(/depense|centimes|1234|devise/);
  });
});

describe("aucun montant sur la face caméra", () => {
  it("le suivi d'un travail qui a déjà dépensé n'affiche ni euro ni « dépensés »", () => {
    const html = renderToStaticMarkup(createElement(SuiviFabrication, { vue: versSuiviFabrication(travail()) }));
    expect(texte(html)).not.toMatch(/€|dépensé|payé/);
    expect(texte(html)).toContain("encore 5 min");
  });

  it("la montée « parlante » (4 étapes) n'a pas de montant non plus", () => {
    const v = versSuiviParlant([{ cle: "son", statut: "terminee" }, { cle: "coupes", statut: "en_cours" }], "en_cours");
    expect(v.etapes.map((e) => e.libelle)).toEqual(["Le son", "Les coupes", "L'image", "Les sous-titres et cartes"]);
    expect(v.etapes.map((e) => e.etat)).toEqual(["faite", "en-cours", "a-venir", "a-venir"]);
    expect(texte(renderToStaticMarkup(createElement(SuiviFabrication, { vue: v })))).not.toMatch(/€|dépensé|payé/);
  });

  it("la fabrication de l'assistant ne passe aucun montant au suivi ni à « Arrêter » pour un format sans prix", () => {
    const src = lire("src/assistant/etapes/Fabrication.tsx");
    expect(src).toMatch(/formatSansPrix\(brouillon\.formatId\)/);
    expect(src).toMatch(/sansPrix \? undefined : t\.depense/);
    expect(lire("src/components/videos/BoutonArreter.tsx")).toMatch(/depense\?: Montant/);
  });
});

describe("SuiviFabrication · pied et réessai", () => {
  it("le pied (montant du composant spécifique) et l'action s'affichent ; le champ vue n'a pas d'argent", () => {
    const html = renderToStaticMarkup(createElement(SuiviFabrication, { vue: versSuiviFabrication(travail()), pied: createElement("span", null, "12 € dépensés"), actions: createElement("button", null, "Arrêter") }));
    expect(texte(html)).toContain("12 € dépensés");
    expect(texte(html)).toContain("Arrêter");
  });
});

describe("écrans de fabrication", () => {
  const fabrication = lire("src/assistant/etapes/Fabrication.tsx");

  it("Fabrication : barre collée, EnTetePage, rendu via SuiviFabrication, plus de fixed bas ni de <h1>", () => {
    expect(fabrication).toMatch(/<BarreActionCollee[^>]*auDessusDesOnglets=\{false\}/);
    expect(fabrication).toMatch(/<EnTetePage/);
    expect(fabrication).toMatch(/<SuiviFabrication/);
    expect(fabrication).not.toMatch(/<h1\b/);
    expect(fabrication).not.toMatch(/fixed inset-x-0 bottom-0/);
  });

  it("au bureau, le bouton du bas reste dans la colonne (max-w-xl centrée), pas sur toute la largeur de l'écran", () => {
    expect(fabrication).toMatch(/<BarreActionCollee[^>]*className="[^"]*lg:mx-auto[^"]*lg:max-w-xl/);
  });

  it("SuiviTravail et AttenteFacecam rendent via SuiviFabrication (sondage inchangé)", () => {
    const suivi = lire("src/components/videos/SuiviTravail.tsx");
    const attente = lire("src/components/facecam/AttenteFacecam.tsx");
    expect(suivi).toMatch(/<SuiviFabrication/);
    expect(suivi).toContain("message={panne}");
    expect(suivi).toMatch(/useTravaux\(/);
    expect(attente).toMatch(/<SuiviFabrication/);
    expect(attente).toMatch(/useTravaux\(/);
    expect(attente).not.toMatch(/€|depense|formaterMontant/);
  });
});
