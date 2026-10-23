/**
 * FACE CAMÉRA ANIMÉE — « Utiliser un script validé » (raccord usine → script → film → face caméra animée, décision de Will).
 * Seuls les scripts VALIDÉS du format `facecam-animee` sont proposés ; le texte choisi remplit « Ce que vous dites » ; lecture seule.
 */
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const scripts = await import("@/services/scripts");
const fa = await import("@/services/facecam-animee");
const { ecrireParametre } = await import("@/services/_commun");
const { PHRASE_AUCUN_SCRIPT_VALIDE, phraseDureeScript } = await import("@/components/formats/facecam-animee/scripts-valides");
const { entreesDuDepotFA } = fa;

const MDP = "essai-script-valide-fa";
const blocs = (texte: string) => [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte }] }];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await ecrireParametre("afficherExemples", false);
});

async function creer(formatId: string, sujet: string, texte: string, valide: boolean) {
  const id = await scripts.enregistrerScript({ formatId, sujet, blocs: blocs(texte) });
  if (valide) await depots().scripts.modifier(id, { statutEditorial: "valide" });
  return id;
}

describe("Utiliser un script validé · la liste", () => {
  it("n'offre que les scripts VALIDÉS du format face caméra animée", async () => {
    const bon = await creer("facecam-animee", "Relances clients", "Vous perdez 12 heures par semaine.", true);
    await creer("facecam-animee", "Brouillon", "Pas encore validé.", false);
    await creer("avocat", "Autre format", "Validé mais ailleurs.", true);
    const liste = await fa.scriptsValidesFacecamAnimee();
    expect(liste.map((s) => s.id)).toEqual([bon]);
    expect(liste[0].sujet).toBe("Relances clients");
  });

  it("ne propose pas un script validé sans aucun texte", async () => {
    await creer("facecam-animee", "Vide", "", true);
    const bon = await creer("facecam-animee", "Plein", "Un vrai texte.", true);
    expect((await fa.scriptsValidesFacecamAnimee()).map((s) => s.id)).toEqual([bon]);
  });

  it("état vide : liste vide et phrase claire", async () => {
    await creer("facecam-animee", "Brouillon", "Texte.", false);
    expect(await fa.scriptsValidesFacecamAnimee()).toEqual([]);
    expect(PHRASE_AUCUN_SCRIPT_VALIDE).toBe("Aucun script validé pour ce format pour l'instant");
  });

  it("exige une session", async () => {
    await auth.seDeconnecter();
    await expect(fa.scriptsValidesFacecamAnimee()).rejects.toBeTruthy();
  });
});

describe("Utiliser un script validé · le texte", () => {
  it("rend le texte du script (blocs et segments mis bout à bout) sans rien ajouter ni modifier", async () => {
    const id = await scripts.enregistrerScript({
      formatId: "facecam-animee",
      sujet: "Deux blocs",
      blocs: [
        { id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Première phrase." }] },
        { id: "b2", blocRecette: "corps", segments: [{ id: "s2", texte: "Deuxième   phrase." }, { id: "s3", texte: "Troisième." }] },
      ],
    });
    await depots().scripts.modifier(id, { statutEditorial: "valide" });
    const avant = JSON.stringify(await depots().scripts.obtenir(id));
    const r = await fa.texteDuScriptValideFA(id);
    expect(r).toEqual({ texte: "Première phrase. Deuxième phrase. Troisième.", tronque: false });
    expect(JSON.stringify(await depots().scripts.obtenir(id))).toBe(avant);
  });

  it("refuse un brouillon, le script d'un autre format et un identifiant inconnu", async () => {
    const brouillon = await creer("facecam-animee", "B", "Texte.", false);
    const autre = await creer("avocat", "A", "Texte.", true);
    for (const id of [brouillon, autre, "script-inconnu"]) await expect(fa.texteDuScriptValideFA(id)).rejects.toThrow(fa.PHRASE_SCRIPT_INTROUVABLE_FA);
  });

  it("texte très long : coupé à la borne du champ, à la fin d'un mot, avec l'avis « tronqué »", () => {
    const long = Array.from({ length: 6000 }, () => "bonjour").join(" ");
    const r = fa.texteDitDuScript(long);
    expect(r.tronque).toBe(true);
    expect(r.texte.length).toBeLessThanOrEqual(fa.TEXTE_DIT_MAX_FA);
    expect(r.texte.endsWith("bonjour")).toBe(true);
    // Le texte repris est exactement celui que le dépôt garde (même borne).
    const entrees = entreesDuDepotFA({ id: "f", cleStockage: "c" }, { dureeSec: 30, texte: r.texte }, true) as { facecamAnimee: { texteValide: string } };
    expect(entrees.facecamAnimee.texteValide).toBe(r.texte);
    expect(fa.texteDitDuScript("court")).toEqual({ texte: "court", tronque: false });
  });

  it("durée lisible dans la liste", () => {
    expect([phraseDureeScript(0), phraseDureeScript(45), phraseDureeScript(80), phraseDureeScript(120)]).toEqual(["", "environ 45 s", "environ 1 min 20", "environ 2 min"]);
  });
});

describe("Utiliser un script validé · l'écran", () => {
  it("le bouton est sur la carte de chaque prise et la feuille remplit le champ « Ce que vous dites »", () => {
    const src = readFileSync("src/components/formats/facecam-animee/DepotPrise.tsx", "utf8");
    expect(src).toContain("Utiliser un script validé");
    expect(src).toMatch(/modifier\(scriptPour, \{ texte, texteOuvert: true/);
    expect(readFileSync("src/components/formats/facecam-animee/FeuilleScriptsValides.tsx", "utf8")).toContain("PHRASE_AUCUN_SCRIPT_VALIDE");
  });
});
