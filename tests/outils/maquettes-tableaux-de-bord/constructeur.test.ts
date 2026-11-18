/**
 * T-EXT-25a · Constructeur de maquette : description → 4 fichiers conformes à la charte, déterministes, sans réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";
import { construireMaquette, MENTION_ECRAN, NOMS_FICHIERS } from "../../../outils/maquettes-tableaux-de-bord/constructeur/construire";

const DOSSIER = join(process.cwd(), "outils/maquettes-tableaux-de-bord/charte");
const charteCss = readFileSync(join(DOSSIER, "charte.css"), "utf8");
const reel = JSON.parse(readFileSync(join(DOSSIER, "noms-neutres.json"), "utf8")) as NomsNeutres;
const noms: NomsNeutres = { ...reel, maquettes: { ...reel.maquettes, atelier: { produit: "Espace démo · Atelier", organisation: "Entreprise exemple" } } };

const brut = {
  version: "description-maquette.v1",
  nom: "Espace démo · Atelier",
  entreprise: "Entreprise exemple",
  metier: "Atelier",
  ecrans: [
    {
      id: "accueil",
      modele: "tableau-de-bord",
      titre: "Votre journée",
      zones: [
        { id: "resume", type: "kpi", libelle: "À traiter", donnees: [{ id: "a-traiter", libelle: "À traiter", valeur: 8, exemple: true, etat: "maintenant" }, { id: "avant-tri", libelle: "Avant le tri", valeur: "Tout à la main", etat: "avant" }] },
      ],
    },
    { id: "liste", modele: "boite-de-reception", titre: "Vos messages", zones: [{ id: "messages", type: "liste", libelle: "Messages", donnees: [{ id: "m-un", libelle: "Devis demandé", valeur: "Nouveau" }] }] },
  ],
  etats: { avant: "Avant : tout à la main", maintenant: "Maintenant : tout est prêt" },
};

function description(): DescriptionMaquette {
  const l = lireDescriptionMaquette(brut, { interdits: reel.interdits });
  if (!l.ok) throw new Error(l.erreurs.join(" | "));
  return l.description;
}
const ressources = { charteCss, ecrans: { "boite-de-reception": '<div class="boite">Boîte neutre</div>' } };

describe("construireMaquette", () => {
  const { fichiers } = construireMaquette(description(), ressources);

  it("rend les 4 fichiers, déclarés conformes par le contrôle de la charte", () => {
    expect(Object.keys(fichiers).sort()).toEqual([...NOMS_FICHIERS].sort());
    const r = controlerMaquette(NOMS_FICHIERS.map((chemin) => ({ chemin, contenu: fichiers[chemin] })), noms, "atelier");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("n'a ni adresse, ni script externe, ni fetch, ni bleu, ni couleur hors charte", () => {
    const tout = NOMS_FICHIERS.map((n) => fichiers[n]).join("\n").replace(charteCss, "");
    expect(tout).not.toMatch(/https?:/);
    expect(tout).not.toMatch(/<script[^>]*\ssrc=["']?(?:https?:)?\/\//);
    expect(tout).not.toMatch(/<script>/);
    expect(tout).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|import\(/);
    expect(tout).not.toMatch(/bleu|blue/i);
    const couleurs = (tout.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toUpperCase());
    const charte = new Set((charteCss.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toUpperCase()));
    for (const c of couleurs) expect(charte.has(c), c).toBe(true);
  });

  it("expose demoMaquette.aller et reinitialiser, et la mention exemple sur chaque écran", () => {
    expect(fichiers["app.js"]).toMatch(/window\.demoMaquette\s*=/);
    expect(fichiers["app.js"]).toMatch(/aller:\s*function/);
    expect(fichiers["app.js"]).toMatch(/reinitialiser:\s*function/);
    const ecrans = fichiers["index.html"].match(/<article class="ecran"/g)?.length ?? 0;
    expect(ecrans).toBe(2);
    expect(fichiers["index.html"].split(`<p class="mention-ecran">${MENTION_ECRAN}</p>`).length - 1).toBe(ecrans);
    expect(fichiers["index.html"]).toContain(`class="mention-demo">${MENTION_ECRAN}`);
  });

  it("demo-data.js expose les données exemple et les états", () => {
    const fenetre: Record<string, unknown> = {};
    new Function("window", fichiers["demo-data.js"])(fenetre);
    const donnees = fenetre.donneesExemple as { premierEcran: string; ecrans: Record<string, true>; etats: Record<string, string> };
    expect(donnees.premierEcran).toBe("accueil");
    expect(Object.keys(donnees.ecrans)).toEqual(["accueil", "liste"]);
    expect(donnees.etats.avant).toContain("Avant");
  });

  it("échappe tout texte (jamais une balise dans le HTML)", () => {
    const d = description();
    d.ecrans[0]!.titre = 'A<b>"x"';
    const { fichiers: f } = construireMaquette(d, ressources);
    expect(f["index.html"]).toContain("A&lt;b&gt;&quot;x&quot;");
    expect(f["index.html"]).not.toContain("<b>");
  });

  it("est déterministe : même description, mêmes fichiers", () => {
    expect(construireMaquette(description(), ressources)).toEqual(construireMaquette(description(), ressources));
  });
});
