/**
 * E2E-1 générateur n° 18 (MINEUR, 03/10) — les voyants ambre de la fiche sujet montraient le message brut des
 * contrôles : « Corps court (8.7 s) : vérifier… », « Rythme trop régulier : écart-type 2.44 mots (seuil 2.5) »,
 * « 9.0 s sans relance (de 2.3 à 11.4 s) ». À l'écran : une phrase simple, en virgule française, sans jargon.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { phraseControle } = await import("@/domaine/controles-script/phrases");
const { NIVEAUX } = await import("@/domaine/controles-script/niveaux");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const JARGON = /écart-type|ecart-type|seuil|plafond|\bsegments?\b|sans relance|mots\/s|\bC\d+\b|\d\.\d/i;

describe("E2E-1 n° 18 · phrases simples des contrôles", () => {
  it("les trois messages du rapport deviennent des phrases simples", () => {
    const a = phraseControle({ controle: "C12", message: "Corps court (8.7 s) : vérifier qu'il ne manque rien." });
    expect(a).toBe("Le milieu de la vidéo est court (9 s) : vérifiez qu'il ne manque rien.");
    const b = phraseControle({ controle: "C9", message: "Rythme trop régulier : écart-type 2.44 mots (seuil 2.5)." });
    expect(b).not.toMatch(JARGON);
    expect(b).toMatch(/longueur/);
    const c = phraseControle({ controle: "C11", message: "9.0 s sans relance (de 2.3 à 11.4 s)." });
    expect(c).toBe("Environ 9 s sans rien de neuf : ajoutez une question ou un fait qui relance l'attention.");
  });

  it("toute alerte d'un contrôle d'écriture, quel que soit son code, se lit sans jargon ni décimale à point", () => {
    // Messages-types de chaque contrôle d'alerte (machine) : la forme réelle produite par le code.
    const exemples: [string, string][] = [
      ["C9 bis", "Trop dense : 4.8 mots/s (« Votre équipe recopie tout »)."],
      ["C12", "Corps de 41.2 s (plafond 35 s) : à raccourcir."],
      ["C12", "62.4 s, au-delà de la zone du réseau (60 s) : à raccourcir."],
      ["C12", "12.1 s, sous la zone du réseau (15 s) : information."],
      ["C23", "4.6 s sans changement à l'écran."],
      ["C26", "Plan de 3.9 s sans changement visuel annoté (« et voilà »)."],
      ["C26", "Phrase courte à fusionner ou à marquer « coupe courte voulue » (« Voilà. »)."],
      ["C29", "Plus d'un appui dans un même segment."],
      ["C31", "Ancrage dit à 11.2 s (avant 10 s ou porteur de la livraison)."],
      ["C38", "« recopi… » répété dans 3 segments."],
      ["C38 bis", "Matière mat-1 citée dans 3 segments."],
      ["C46", "Aucune valeur (fait, preuve, geste) dite avant 12.0 s."],
      ["C78", "Coût du problème dit à 6,4 s (avant 5 s attendu)."],
      ["C39", "3 résultats de suite sans relance."],
      ["C63", "Appel de 6 mots, plus court que les modèles (8 à 47)."],
    ];
    for (const [controle, message] of exemples) {
      expect(NIVEAUX[controle], controle).toBeTruthy();
      expect(phraseControle({ controle, message }), `${controle} : ${message}`).not.toMatch(JARGON);
    }
  });
});

describe("E2E-1 n° 18 · sur un vrai sujet écrit (simulé)", () => {
  const MDP = "e2e1-restes-phrases";
  beforeAll(async () => {
    await preparerMotDePasse(MDP);
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    bg.suspendreBoucleGeneration(true);
    await auth.seConnecter(MDP, false);
    for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
    for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  });
  afterEach(() => bg.arreterBoucleGeneration());

  it("les voyants des versions écrites se lisent sans jargon", async () => {
    const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" });
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    const vs = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
    const alertes = vs.flatMap((v) => v.controles.violations.filter((x) => !x.bloquant));
    expect(alertes.length).toBeGreaterThan(0);
    for (const x of alertes) expect(phraseControle(x), x.message).not.toMatch(JARGON);
  });
});
