/**
 * G2 : PREUVES ALLÉGÉES, CONTEXTE DE MARQUE, « MA VOIX » (plan v5 B.10 ligne G2). Aucune clé, aucun appel.
 * Critères : une preuve saisie en < 20 s (énoncé + « ce qu'on peut dire ») ; « à ne pas dire » proposé SANS fait ajouté,
 * validé d'un toucher ; accords en interrupteurs ; péremption par type ; appelants de `lireFaconDeParler` inchangés ;
 * tournures appliquées (deux niveaux) ; positions en références ; thèmes et interdits validés d'un toucher ; carnet de
 * voix par sous-chaîne exacte ; règles datées ; prononciations « à valider ». Données d'ESSAI (TEST) seulement.
 */
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { matiere, preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const preuves = await import("@/services/preuves");
const mat = await import("@/services/matieres");
const ctx = await import("@/services/contexte-axion");
const voix = await import("@/services/voix");
const scripts = await import("@/services/scripts");
const { etape19Generateur } = await import("@/services/migrations/etape-19-generateur");
import { extraireValeurs, natureDe, proposerANePasDire, sansFaitAjoute } from "@/domaine/preuves-saisie";
import { appliquerInterdits, appliquerTournures, proposerCarnetVoix, rappelHebdoDu, siglesInconnus } from "@/domaine/voix";

const MDP = "essai-g2-preuves-voix";
const MAINTENANT = "2026-10-02T08:00:00.000Z";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("preuves allégées : < 20 s, énoncé + « ce qu'on peut dire »", () => {
  it("l'énoncé dicté suffit : type, nature, valeurs, source et péremption par défaut ; validée d'office", async () => {
    const debut = performance.now();
    const { preuve, propositions } = await preuves.ajouterPreuve({ enonce: "TEST Mon client a supprimé 35 h de saisie par semaine.", peutDire: ["35 heures de saisie en moins"], estDemo: true });
    expect(performance.now() - debut).toBeLessThan(20_000);
    expect(preuve).toMatchObject({
      type: "cas-client",
      nature: "chiffree",
      valeurs: [{ brut: "35 h", normalise: 35, unite: "h" }],
      formulationsAutorisees: ["TEST Mon client a supprimé 35 h de saisie par semaine.", "35 heures de saisie en moins"],
      formulationsInterdites: [],
      source: { titre: "Dictée" },
      saisiePar: "will",
      statut: "validee",
      client: { anonymise: true, accordEcrit: false },
    });
    // Péremption cas client : 24 mois.
    expect(new Date(preuve.perimeLe!).getUTCFullYear() - new Date(preuve.source.date).getUTCFullYear()).toBe(2);
    // « À ne pas dire » proposé, jamais appliqué avant le toucher, sans aucun fait ajouté.
    expect(propositions.length).toBeGreaterThan(0);
    for (const p of propositions) expect(sansFaitAjoute(preuve.enonce, p.texte)).toBe(true);
    const validee = await preuves.validerANePasDire(preuve.id, propositions[0].texte);
    expect(validee.formulationsInterdites).toEqual([propositions[0].texte]);
    expect((await preuves.propositionsANePasDire(preuve.id)).map((p) => p.texte)).not.toContain(propositions[0].texte);
    // Une formulation qui ajoute un chiffre est refusée.
    await expect(preuves.validerANePasDire(preuve.id, "plus de 50 h")).rejects.toMatchObject({ code: "FAIT_AJOUTE" });
  });

  it("valeurs, nature et types par défaut ; péremption par type (étude 18 mois, règle 12 mois)", () => {
    expect(extraireValeurs("62 % des PME, 1 200 € par mois, 3,5 jours")).toEqual([
      { brut: "62 %", normalise: 62, unite: "%" },
      { brut: "1 200 €", normalise: 1200, unite: "€" },
      { brut: "3,5 jours", normalise: 3.5, unite: "jours" },
    ]);
    expect(natureDe("Une partie des factures arrive en retard.")).toBe("vague");
    expect(natureDe("Les équipes respirent.")).toBe("qualitative");
    for (const p of [
      proposerANePasDire({ enonce: "Une partie des factures arrive en retard.", type: "chiffre-interne", nature: "vague", valeurs: [] }),
      proposerANePasDire({ enonce: "Les équipes respirent.", type: "chiffre-interne", nature: "qualitative", valeurs: [] }),
    ])
      for (const x of p) expect(x.texte).not.toMatch(/\d/);
  });

  it("étude et règle : péremption selon le type ; accords en interrupteurs, répercutés sur la matière qui cite la preuve", async () => {
    const { preuve: etude } = await preuves.ajouterPreuve({ enonce: "TEST Selon une étude, 62 % des PME n'ont aucun outil.", source: { date: "2026-01-15T00:00:00.000Z" }, estDemo: true });
    expect(etude).toMatchObject({ type: "etude", niveau: "prouve", perimeLe: "2027-07-15T00:00:00.000Z" });
    const regle = await preuves.changerTypePreuve(etude.id, "regle-loi");
    expect(regle.perimeLe).toBe("2027-01-15T00:00:00.000Z");

    const { matiere: cas } = await mat.ajouterMatiere({ texte: "TEST Mon client a gagné 35 h par semaine.", type: "cas-client", estDemo: true });
    expect(cas.accord).toMatchObject({ obtenu: false });
    await preuves.basculerAccordPreuve(cas.preuveId!, "accordEcrit", true);
    expect((await depots().matieres.obtenir(cas.id))!.accord).toMatchObject({ obtenu: true });
    const p = await preuves.basculerAccordPreuve(cas.preuveId!, "accordCapture", true);
    expect(p.client).toMatchObject({ accordEcrit: true, accordCapture: true });
  });

  it("retirer une preuve fait tomber les matières qui la citent ; rien n'est supprimé", async () => {
    const { matiere: cas } = await mat.ajouterMatiere({ texte: "TEST Mon client a gagné 35 h par semaine.", type: "cas-client", accord: true, estDemo: true });
    const impact = await preuves.retirerPreuve(cas.preuveId!, "accord-retire");
    expect(impact.versions).toEqual([]);
    expect(await depots().preuves.obtenir(cas.preuveId!)).toMatchObject({ retrait: { motif: "accord-retire" } });
    expect(await depots().matieres.obtenir(cas.id)).toMatchObject({ texte: cas.texte, retrait: { motif: "accord-retire" } });
    expect((await preuves.listerPreuves())[0].disponible).toBe(false);
  });
});

describe("« Ma façon de parler » : appelants de lireFaconDeParler inchangés", () => {
  it("même signature, même forme ; la fiche validée y est recopiée ; enregistrerFaconDeParler marche toujours", async () => {
    const source = readFileSync("src/services/scripts.ts", "utf8");
    expect(source).toContain("export async function lireFaconDeParler(): Promise<FaconDeParler>");
    expect(source).toContain("export async function enregistrerFaconDeParler(f: FaconDeParler): Promise<void>");
    const avant = await scripts.lireFaconDeParler();
    expect(Object.keys(avant).sort()).toEqual(["expressions", "motsInterdits", "notes", "tutoiement"]);

    await etape19Generateur(depots(), MAINTENANT);
    const vue = await voix.lireFicheStyle();
    expect(vue.depuisReglage).toBe(false);
    expect(vue.fiche).toMatchObject({ version: 1, expressions: [] });
    expect(vue.fiche!.valideeParWillLe).toBeUndefined();

    await voix.ajouterTexteWill("TEST Concrètement, on regarde vos factures. Retenez une chose : on commence petit.", "post-dicte", { estDemo: true });
    const fiche = await voix.validerFicheStyle({ expressions: ["Concrètement"], motsBannis: ["disruptif"] });
    expect(fiche).toMatchObject({ id: "fiche-style-v2", version: 2, expressions: ["Concrètement"], motsBannis: ["disruptif"] });
    expect(fiche.valideeParWillLe).toBeDefined();
    expect(fiche.longueurPhraseMediane).toBeGreaterThan(0);
    expect(fiche.ouvertures[0]).toBe("TEST Concrètement");
    expect(await depots().fichesStyle.compter()).toBe(2);

    const apres = await scripts.lireFaconDeParler();
    expect(Object.keys(apres).sort()).toEqual(["expressions", "motsInterdits", "notes", "tutoiement"]);
    expect(apres).toMatchObject({ expressions: ["Concrètement"], motsInterdits: ["disruptif"], tutoiement: false });
    await scripts.enregistrerFaconDeParler({ ...apres, notes: "TEST" });
    expect((await scripts.lireFaconDeParler()).notes).toBe("TEST");
  });
});

describe("tournures interdites à deux niveaux : appliquées", () => {
  it("semées (bloquant, grappe), essai sur un texte, ajout par Will, niveau, rangement", async () => {
    await etape19Generateur(depots(), MAINTENANT);
    const bloque = await voix.essayerTournures("Et si je vous disais que vos factures se rangent seules ?");
    expect(bloque.bloque).toBe(true);
    expect(bloque.bloquantes.map((t) => t.id)).toContain("tournure-plan-et-si-je-vous-disais");
    expect((await voix.essayerTournures("Vos factures arrivent en retard le lundi.")).bloque).toBe(false);

    const t = await voix.ajouterTournure("petit bijou", "grappe");
    expect(t).toMatchObject({ id: "tournure-will-petit-bijou", source: "will", niveau: "grappe" });
    const une = await voix.essayerTournures("Ce tableau, c'est un petit bijou.");
    expect(une.grappes.map((x) => x.id)).toContain(t.id);
    expect(une.bloque).toBe(false); // une seule grappe dans un script
    expect((await voix.essayerTournures("Ce tableau, c'est un petit bijou.", { post: true })).bloque).toBe(true); // dès 1 dans un post
    expect((await voix.essayerTournures("Un petit bijou, vraiment un petit bijou.")).bloque).toBe(true); // 2 grappes
    await voix.changerNiveauTournure(t.id, "bloquant");
    expect((await voix.essayerTournures("Un Petit Bijou.")).bloque).toBe(true);
    await voix.rangerTournure(t.id);
    expect((await voix.essayerTournures("Un petit bijou.")).trouvees.map((x) => x.id)).not.toContain(t.id);
    expect(await depots().tournesInterdites.obtenir(t.id)).toBeTruthy(); // rangée, jamais effacée
    // Limite de mot : « petits bijoux » n'est pas la tournure.
    expect(appliquerTournures("Un petits bijoux.", [{ ...t, archiveLe: undefined }]).trouvees).toEqual([]);
  });
});

describe("contexte de marque : versionné, références, validé d'un toucher", () => {
  beforeEach(async () => {
    await etape19Generateur(depots(), MAINTENANT);
  });

  it("positions = références vers des avis (aucune copie), une version par changement", async () => {
    const { matiere: avis } = await mat.ajouterMatiere({ texte: "TEST Un tableau Excel partagé n'est pas un outil de pilotage.", type: "avis-will", estDemo: true });
    const c1 = await ctx.marquerPosition(avis.id, true);
    expect(c1).toMatchObject({ id: "contexte-axion-v1", version: 1, positionIds: [avis.id] });
    expect(JSON.stringify(c1)).not.toContain(avis.texte);
    expect((await depots().matieres.obtenir(avis.id))!.positionDeMarque).toBe(true);
    const c2 = await ctx.marquerPosition(avis.id, false);
    expect(c2).toMatchObject({ version: 2, positionIds: [] });
    expect(await depots().contexteAxion.compter()).toBe(3);
    const { matiere: question } = await mat.ajouterMatiere({ texte: "TEST Est-ce que ça marche ?", estDemo: true });
    await expect(ctx.marquerPosition(question.id, true)).rejects.toMatchObject({ code: "PAS_UN_AVIS" });
  });

  it("thèmes : proposés à part, appliqués seulement au toucher", async () => {
    const c0 = await ctx.lireContexte();
    expect(c0.piliers).toEqual([]);
    expect(c0.piliersProposes!.length).toBeGreaterThanOrEqual(5);
    const c1 = await ctx.validerPilier("automatisation");
    expect(c1.piliers.map((p) => p.id)).toEqual(["automatisation"]);
    expect(c1.valideeParWillLe).toBeDefined();
    const c2 = await ctx.ajouterPilier("Former les dirigeants");
    expect(c2.piliers.map((p) => p.id)).toEqual(["automatisation", "former-les-dirigeants"]);
    // Une matière dictée ensuite reçoit le thème validé qui correspond.
    const { matiere: m } = await mat.ajouterMatiere({ texte: "TEST Automatiser la saisie des factures prend une semaine.", type: "observation", estDemo: true });
    expect(m.pilier).toBe("automatisation");
  });

  it("interdits : préremplis (appliqués d'office), confirmés d'un toucher ; ordres relus en G2 proposés avec leur source", async () => {
    const vue = await ctx.lireInterdits();
    expect(vue.actifs.map((i) => i.id)).toEqual(["interdit-reservation-directe", "interdit-telephone-public", "interdit-demarre", "interdit-certifexemple", "interdit-trop-s-engager"]);
    expect(vue.actifs.every((i) => !i.confirmeLe && i.origine.startsWith("Ordre de Will"))).toBe(true);
    expect(vue.proposes.map((i) => i.id)).toEqual(["interdit-sans-engagement-seul"]);
    expect(vue.proposes.every((i) => /^Ordre de Will du \d\d\/\d\d\/2026$/.test(i.origine))).toBe(true);

    // Appliqués d'office, même avant confirmation : ils ne font que restreindre.
    expect(appliquerInterdits("Appelez-moi au 06 12 34 56 78.", vue.actifs).map((i) => i.id)).toEqual(["interdit-telephone-public"]);
    expect(appliquerInterdits("Le diagnostic est sans engagement.", ctx.INTERDITS_RELUS_G2).map((i) => i.id)).toEqual(["interdit-sans-engagement-seul"]);
    expect(appliquerInterdits("Le diagnostic est gratuit et sans engagement.", ctx.INTERDITS_RELUS_G2)).toEqual([]);

    const c1 = await ctx.confirmerInterdit("interdit-telephone-public");
    expect(c1.interdits.find((i) => i.id === "interdit-telephone-public")!.confirmeLe).toBeDefined();
    const c2 = await ctx.confirmerInterdit("interdit-sans-engagement-seul");
    expect(c2.interdits.find((i) => i.id === "interdit-sans-engagement-seul")).toMatchObject({ origine: "Ordre de Will du 21/09/2026" });
    expect((await ctx.lireInterdits()).proposes.map((i) => i.id)).toEqual([]);
  });

  it("carnet de voix : expressions tirées par sous-chaîne exacte, validées d'un toucher", async () => {
    const a = await voix.ajouterTexteWill("TEST Concrètement, on regarde vos factures ensemble. Retenez une chose : on commence petit.", "memo", { estDemo: true });
    await voix.ajouterTexteWill("TEST Retenez une chose : l'outil ne fait pas tout. Concrètement, on commence petit.", "memo", { estDemo: true });
    const proposees = await ctx.proposerExpressions();
    const expressions = proposees.map((p) => p.expression);
    expect(expressions).toContain("on commence petit");
    expect(expressions).toContain("Retenez une chose");
    for (const p of proposees) expect((await depots().exemplesStyle.obtenir(p.texteSourceId))!.texte.includes(p.expression)).toBe(true);
    const c = await ctx.validerExpression("Retenez une chose", a.id);
    expect(c.carnetVoix).toEqual([{ expression: "Retenez une chose", texteSourceId: a.id, validee: true }]);
    await expect(ctx.validerExpression("Retenez bien une chose", a.id)).rejects.toMatchObject({ code: "VERBATIM" });
    expect(proposerCarnetVoix([{ id: "x", texte: "Une seule fois ici." }])).toEqual([]);
  });
});

describe("règles datées, prononciations à valider, rappel", () => {
  it("règles datées semées listées ; relue d'un toucher (date du jour, revue dans 6 mois)", async () => {
    await etape19Generateur(depots(), MAINTENANT);
    const regles = await voix.listerReglesDatees();
    expect(regles.length).toBeGreaterThan(10);
    const r = await voix.marquerRegleRelue(regles[0].regle.id);
    expect(r.verifieeLe.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
    expect(r.aRevoirLe! > r.verifieeLe).toBe(true);
  });

  it("sigles inconnus en file « à valider » (jamais bloquante) ; validé tel quel d'un toucher", async () => {
    await depots().matieres.enregistrer(matiere("TEST Le DAF et le RSSI relisent le CRM."));
    const avant = await voix.fileAValider();
    expect(avant.siglesInconnus).toEqual(expect.arrayContaining(["RSSI", "TEST"]));
    await voix.validerSigleTelQuel("RSSI");
    const apres = await voix.fileAValider();
    expect(apres.siglesInconnus).not.toContain("RSSI");
    const entree = (await depots().prononciations.lister((p) => p.mot === "RSSI"))[0];
    expect(entree).toMatchObject({ prononciation: "RSSI", source: "script" });
    expect(entree.ecouteeLe).toBeDefined();
    expect(siglesInconnus(["Le DAF"], [{ mot: "DAF" }])).toEqual([]);
  });

  it("rappel hebdomadaire : jamais s'il est coupé, au plus tous les 7 jours sinon", () => {
    expect(rappelHebdoDu(false, undefined, MAINTENANT)).toBe(false);
    expect(rappelHebdoDu(true, undefined, MAINTENANT)).toBe(true);
    expect(rappelHebdoDu(true, "2026-09-28T08:00:00.000Z", MAINTENANT)).toBe(false);
    expect(rappelHebdoDu(true, "2026-09-25T08:00:00.000Z", MAINTENANT)).toBe(true);
  });
});
