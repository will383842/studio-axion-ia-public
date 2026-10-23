/**
 * Relecture finale A09 (PR #254), défauts 2 et 4, sur la chaîne courte (Claude simulé, `fetch` jamais appelé, 0 $) :
 *  - « + Tu » : le script réécrit les finalistes dans la bonne adresse ; un CONTRÔLE PAR CODE refuse une accroche, une
 *    finaliste ou une 1re ligne dans l'autre adresse (script : échec technique ; déclinaison : version écartée, au journal) ;
 *  - relecture inutilisable : plus gardée en silence ; la version reste utilisable, marquée « non relue » (journal de
 *    l'écriture, journal du studio, contrôle NON-RELUE sur la version).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { executeurSimule } from "../helpers/g4";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { ExecuteurRoles, SortieExecution } from "@/generateur/chaine";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 30_000 });

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre } = await import("@/services/_commun");
const { ROLES_CHAINE_COURTE, adresseFautive, CONTROLE_NON_RELUE } = await import("@/generateur/chaine-courte");
const { ROLES_ECRITURE } = await import("@/generateur/roles");

const MDP = "essai-chaine-courte-adresse";
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
  await ecrireParametre(bg.PARAM_CHAINE, "courte");
});
afterEach(() => bg.arreterBoucleGeneration());

const S = SUJETS_BANC[0];

/** Un sujet au « vous » écrit par la courte (simulée), puis son « + Tu » lancé. */
async function sujetPuisTu(reseaux = [S.reseaux[0]]) {
  const r = await bg.lancerGeneration({ idee: S.idee, reseaux: [...reseaux], formatId: "avocat", pilier: S.pilier.id, mode: "avatar" });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration(() => executeurSimule().executeur);
  const s = await bg.ajouterDeclinaison(r.scriptMaitreId, { adresse: "tu" });
  if (!s.ok) throw new Error("supplément");
  return { r, s };
}

describe("adresseFautive : contrôle par code de l'adresse", () => {
  it("« vous » dans une vidéo au « tu » (et l'inverse) ; un texte sans adresse passe", () => {
    expect(adresseFautive("Vous pensez gagner du temps sur vos données ?", "tu")).toBe(true);
    expect(adresseFautive("Tu penses gagner du temps sur tes données ?", "tu")).toBe(false);
    expect(adresseFautive("Tu penses gagner du temps ?", "vous")).toBe(true);
    expect(adresseFautive("Le tableur ne vérifie rien.", "tu")).toBe(false);
    expect(adresseFautive("Le ton juste compte.", "vous")).toBe(false);
  });
});

describe("« + Tu » sur la chaîne courte : accroches et finalistes à la bonne adresse", () => {
  it("le script reçoit les finalistes à réécrire ; les finalistes, l'accroche et la 1re ligne de la version « Tu » sont au « tu »", async () => {
    const { r, s } = await sujetPuisTu();
    const { executeur, appels } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    expect((await depots().generations.obtenir(s.generationId))?.statut).toBe("terminee");
    const script = appels.find((a) => a.role === "court-script")!;
    expect(script.entree.variable).toMatch(/<finalistes_a_readresser adresse="tu">/);
    const etat = await bg.lireEtatChaine(s.generationId);
    expect(etat?.finalistes?.length).toBeGreaterThan(0);
    for (const f of etat!.finalistes!) expect(adresseFautive(f.dit, "tu"), f.dit).toBe(false);
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId && x.code.endsWith("-T")))[0];
    expect(adresseFautive(v.ouverture[0].segments[0].texte, "tu")).toBe(false);
    expect(adresseFautive(v.publication.premiereLigne, "tu")).toBe(false);
  });

  it("le script garde des finalistes au « vous » : refusé par le code, échec technique (« Reprendre l'écriture »), aucune version « Tu »", async () => {
    const { r, s } = await sujetPuisTu();
    const { executeur } = executeurSimule({
      "court-script": (e: EntreeRole) => {
        const sortie = ROLES_CHAINE_COURTE.script.simuler(e) as { finalistes?: unknown };
        delete sortie.finalistes;
        return sortie;
      },
    });
    await bg.tourBoucleGeneration(() => executeur);
    expect((await depots().generations.obtenir(s.generationId))?.statut).toBe("echec");
    expect((await bg.ecritureArretee(r.scriptMaitreId))?.message).toMatch(/pas au « tu »/);
    expect(await depots().variantes.compter((v) => v.scriptMaitreId === r.scriptMaitreId && v.code.endsWith("-T"))).toBe(0);
  });

  it("une déclinaison écrit son accroche au « vous » : la version est écartée et notée au journal de l'écriture", async () => {
    const { r, s } = await sujetPuisTu(S.reseaux.slice(0, 2));
    const { executeur } = executeurSimule({
      declinaison: (e: EntreeRole) => {
        const sortie = ROLES_ECRITURE.declinaison.simuler(e) as { accroche: string };
        return { ...sortie, accroche: "Vous perdez vos journées à recopier ?" };
      },
    });
    await bg.tourBoucleGeneration(() => executeur);
    expect((await depots().generations.obtenir(s.generationId))?.statut).toBe("terminee");
    const tu = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId && v.code.endsWith("-T"));
    expect(tu.map((v) => v.reseau)).toEqual([S.reseaux[0]]);
    const journal = (await bg.lireEtatChaine(s.generationId))?.journal ?? [];
    expect(journal.some((j) => j.role === "declinaison" && j.resultat === "invalide" && j.echecs?.some((x) => /pas au « tu »/.test(x)))).toBe(true);
  });
});

describe("relecture inutilisable : la version gardée est marquée « non relue »", () => {
  it("sortie illisible : l'écriture va au bout, l'échec est au journal (écriture et studio), la version porte NON-RELUE", async () => {
    const r = await bg.lancerGeneration({ idee: S.idee, reseaux: [S.reseaux[0]], formatId: "avocat", pilier: S.pilier.id, mode: "avatar" });
    if (!r.ok) throw new Error("lancement");
    const base = executeurSimule().executeur;
    const executeur: ExecuteurRoles = {
      async executer<T extends z.ZodType>(role: DefinitionRole<T>, entree: EntreeRole): Promise<SortieExecution<z.infer<T>>> {
        if (role.id === "court-relecture") return { ok: true, invalide: "JSON illisible", coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
        return base.executer(role, entree);
      },
    };
    await bg.tourBoucleGeneration(() => executeur);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
    const etat = await bg.lireEtatChaine(r.generationId);
    expect(etat?.nonRelue).toMatch(/Relecture inutilisable \(JSON illisible\)/);
    expect(etat?.journal.find((j) => j.role === "court-relecture")?.resultat).toBe("invalide");
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
    const marque = v.controles.violations.find((x) => x.controle === CONTROLE_NON_RELUE);
    expect(marque).toMatchObject({ bloquant: false });
    expect(marque?.message).toMatch(/^Non relue/);
    const evenements = await depots().evenements.lister((e) => e.entiteId === r.scriptMaitreId);
    expect(evenements.some((e) => /Relecture inutilisable/.test(e.message))).toBe(true);
  });

  it("relecture valide : aucune marque « non relue »", async () => {
    const r = await bg.lancerGeneration({ idee: S.idee, reseaux: [S.reseaux[0]], formatId: "avocat", pilier: S.pilier.id, mode: "avatar" });
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration(() => executeurSimule().executeur);
    expect((await bg.lireEtatChaine(r.generationId))?.nonRelue).toBeUndefined();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
    expect(v.controles.violations.some((x) => x.controle === CONTROLE_NON_RELUE)).toBe(false);
  });
});
