/**
 * Vérification E2E n° 2 — restes du générateur (parcours et données), banque de matières VIDE comme en production :
 *  - données n° 5 / parcours n° 13 : « Il manque » sans doublon, 3 au plus, tout annoncé dès le premier arrêt ;
 *  - données n° 4 : un cas client ajouté depuis la fiche sujet sans accord est SIGNALÉ, et l'accord se donne sur place ;
 *  - parcours n° 13 : le type d'une matière annoncée (« Actualité : … ») ou datée est le bon ;
 *  - parcours n° 20 : jamais d'accroche tronquée par le raccourcissement simulé.
 * Simulation, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const { proposerTypeMatiere } = await import("@/domaine/derivations-generateur");
const { raccourcir } = await import("@/generateur/roles/commun");
const { manquesLisibles, phraseManques } = await import("@/generateur/choix-combinaison");

const MDP = "essai-e2e2-gen-restes";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
});
afterEach(() => bg.arreterBoucleGeneration());

const IDEE = "Les relances de devis faites à la main chaque vendredi soir dans une PME";

function elements(phrase: string): string[] {
  const corps = /Il manque : (.*?)( \(et \d+ autres?\))?\.$/.exec(phrase)?.[1] ?? /Puis : (.*?)( \(et \d+ autres?\))?\.$/.exec(phrase)?.[1] ?? "";
  return corps.split(" ; ").filter(Boolean);
}

describe("E2E-2 données n° 5 / parcours n° 13 · « Il manque » lisible", () => {
  it("sujet seul, banque vide : le 1er arrêt annonce aussi la suite ; puis la liste n'a aucun doublon et 3 éléments au plus", async () => {
    const r = await bg.lancerGeneration({ idee: IDEE, reseaux: ["tiktok", "linkedin"], formatId: "avocat", mode: "avatar" } as never);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.ceQuIlFaudrait).toMatch(/^Il faudrait .+\. Puis : .+\.$/);
    const suite = elements(r.ceQuIlFaudrait);
    expect(new Set(suite).size).toBe(suite.length);
    // Un cas client AVEC accord et une question reçue (le parcours du rapport) : la liste suivante est propre.
    await bg.completerSujetParSaisie(r.scriptMaitreId, { texte: "Un client nous a dit : on perdait deux jours par mois à relancer les devis à la main.", type: "cas-client", accord: true });
    const r2 = await bg.completerSujetParSaisie(r.scriptMaitreId, { texte: "Est-ce qu'on peut relancer un devis sans paraître insistant ?" });
    const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    if (r2.resultat.ok) return; // assez de matière : rien à lister
    const liste = elements(m!.manque!.ceQuIlFaudrait);
    expect(liste.length).toBeGreaterThan(0);
    expect(liste.length).toBeLessThanOrEqual(3);
    expect(new Set(liste).size, m!.manque!.ceQuIlFaudrait).toBe(liste.length);
  });

  it("manquesLisibles : un même besoin (mêmes sources) n'apparaît qu'une fois ; phraseManques plafonne à 3", () => {
    const t = (id: string, libelle: string, sources: string[]) => ({ id, libelle, obligatoire: true, sources }) as never;
    const c = { manquants: [t("raison", "le pourquoi", ["a"]), t("pourquoi", "le pourquoi", ["a"]), t("regle", "la règle", ["b"]), t("regle-2", "une règle du métier", ["b"])], appuiManquant: true, faible: false, corpsEstimeSec: 30, realisable: false } as never;
    expect(manquesLisibles(c)).toEqual(["le pourquoi", "la règle", "un appui (une preuve, une observation, ou votre avis si vous parlez)"]);
    expect(phraseManques(["a", "b", "c", "d", "e"])).toBe("a ; b ; c (et 2 autres)");
  });
});

describe("E2E-2 données n° 4 · cas client ajouté depuis la fiche du sujet", () => {
  it("sans accord : rangé comme cas client, signalé sur la fiche ; « J'ai son accord » le rend utilisable et relance", async () => {
    const r = await bg.lancerGeneration({ idee: IDEE, reseaux: ["tiktok"], formatId: "avocat", mode: "avatar" } as never);
    const { matiere } = await bg.completerSujetParSaisie(r.scriptMaitreId, { texte: "Un client nous a dit : on perdait deux jours par mois à relancer les devis à la main.", type: "cas-client" });
    expect(matiere.type).toBe("cas-client");
    expect(matiere.accord).toMatchObject({ requis: true, obtenu: false });
    // Comme dans « Mes matières » : la preuve du cas client est créée.
    expect(matiere.preuveId).toBeTruthy();
    expect((await bg.matieresSansAccord(r.scriptMaitreId)).map((x) => x.id)).toEqual([matiere.id]);
    await bg.donnerAccordEtReprendre(r.scriptMaitreId, matiere.id);
    expect((await depots().matieres.obtenir(matiere.id))?.accord?.obtenu).toBe(true);
    expect(await bg.matieresSansAccord(r.scriptMaitreId)).toEqual([]);
  });
});

describe("E2E-2 parcours n° 13 et 20 · type proposé, accroches entières", () => {
  it("« Actualité : … », une date du mois, « Étude : … » : le bon type", () => {
    expect(proposerTypeMatiere("Actualité : en septembre 2026, la facture électronique devient obligatoire pour les PME.")).toBe("actualite");
    expect(proposerTypeMatiere("En septembre 2026, la facture électronique devient obligatoire pour les grandes entreprises.")).toBe("actualite");
    expect(proposerTypeMatiere("Étude : 62 % des PME ressaisissent leurs factures.")).toBe("etude");
    expect(proposerTypeMatiere("Je pense qu'un tableur sans contrôle coûte plus cher qu'un outil.")).toBe("avis-will");
  });

  it("raccourcir ne laisse ni petit mot final, ni double ponctuation, ni phrase d'un mot", () => {
    expect(raccourcir("Vos factures volent du temps à vos équipes.")).toBe("Vos factures volent du temps.");
    expect(raccourcir("Vous pensez gagner du temps sur votre relance ? Pas du tout.")).toBe("Vous pensez gagner du temps sur votre relance ?");
    expect(raccourcir("Une seule question sur vos données.")).toBe("Une seule question.");
  });
});
