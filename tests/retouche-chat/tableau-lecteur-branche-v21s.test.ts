/**
 * S-06-b-v21s : « Demander une modification » d'un tableau animé : quand les règles gratuites ne comprennent pas la demande,
 * `propositionTableau` demande UNE opération au lecteur commun (clé `retoucheChat.tableauLecteur`, ÉTEINTE par défaut).
 * Chemin RÉEL : vrai `proposerModification`, dépôts mémoire, vidéo tableau de `tests/tableau/retouches/origine-will-retouche.test.ts`
 * (banc + fiche de démonstration), client Claude simulé (faux `fetch`, aucun réseau). 0 €.
 * Modèles : tests/retouche-chat/lecteur-studio.test.ts (Claude simulé, compteur), origine-will-retouche.test.ts (vidéo tableau).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "../helpers/g0";
import { ficheDemonstration } from "../tableau/regles/exemples";
import { banc } from "../tableau/moteur/doubles";
import { controler } from "../../outils/gardes/regles-de-fer.mjs";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("server-only", () => ({}));
// Doubles contrôlés (inactifs par défaut : le vrai code passe) : (d) un lecteur qui rendrait une opération que l'aperçu
// refuse ; (f) un estimateur de retouche à montant non nul (en mémoire il vaut 0), pour que « coût = celui des règles » morde.
const double = vi.hoisted(() => ({ op: undefined as unknown, prixCentimes: undefined as number | undefined }));
vi.mock("@/services/retouche-chat/tableau", async (original) => {
  const vrai = await original<typeof import("@/services/retouche-chat/tableau")>();
  return { ...vrai, lireDemandeTableauParClaude: (async (...a: Parameters<typeof vrai.lireDemandeTableauParClaude>) => (double.op !== undefined ? double.op : vrai.lireDemandeTableauParClaude(...a))) as typeof vrai.lireDemandeTableauParClaude };
});
vi.mock("@/moteurs", async (original) => {
  const vrai = await original<typeof import("@/moteurs")>();
  const moteurDeCommande = ((c: Parameters<typeof vrai.moteurDeCommande>[0]) => {
    const m = vrai.moteurDeCommande(c);
    if (double.prixCentimes === undefined) return m;
    return { ...m, estimerRetouche: async (...a: Parameters<NonNullable<typeof m.estimerRetouche>>) => ({ ...(await m.estimerRetouche!(...a)), total: { centimes: double.prixCentimes!, devise: "EUR" } }) };
  }) as typeof vrai.moteurDeCommande;
  return { ...vrai, moteurDeCommande };
});
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => ({ ...(await original<object>()), ecranTableauVisible: () => true }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const commun = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { proposerModification, confirmerModification, historiqueModifications } = await import("@/services/modifications");
const { ficheTableauDeLaVideo } = await import("@/services/tableau-vue");
const { exemplesTableau } = await import("@/moteurs/montage-tableau/demande");
const { ETAPE_LECTURE_CHAT } = await import("@/services/retouche-chat/appel-claude-chat");
const { CLE_REGLAGE_LECTEUR_TABLEAU } = await import("@/services/retouche-chat/lecteur-studio");

const MDP = "essai-s06b-tableau";
const VIDEO = "v-03";
const NON_COMPRISE = "fais quelque chose de joli pour moi";
const SCENE = ficheDemonstration.scenes[1];
const OP_VOIX = { type: "modifierTexteDit", sceneId: SCENE.id, texte: `${SCENE.texteDit} Simplement.` };
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await commun.ecrireParametre("fournisseur.texte-reseaux", "claude");
  await preparerTableau();
});
afterEach(() => {
  double.op = undefined;
  double.prixCentimes = undefined;
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.restoreAllMocks();
});

/** La vidéo v-03 devient un tableau animé fabriqué (fiche de démonstration), comme origine-will-retouche.test.ts. */
async function preparerTableau(fiche = ficheDemonstration) {
  const b = banc(fiche);
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  const commande = { ...b.commande(fiche), videoId: VIDEO };
  await depots().videos.modifier(VIDEO, { formatId: "tableau-anime", estDemo: false });
  // La matière de démonstration montrée par la fiche (écran 5), validée et non périmée (contexte des exemples du tableau).
  await depots().matieres.enregistrer({ id: "matiere-demo-idees", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" } as never);
  await depots().versions.modifier(ver.id, { commande, estDemo: false, projetMontage: { moteur: "montage-tableau", tableau: { journal: { version: "fabrication-tableau/1", etapes: {} }, fiche, retouchee: true } } });
}

/** Client Claude simulé : chaque appel rend `supplementaires` (le tableau) ; les corps envoyés sont gardés. */
function brancherClaude(supplementaires: unknown = [OP_VOIX]) {
  void credits.declarerRecharge("anthropic", 500);
  const appels: string[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(String(init?.body));
    return reponseFlux(fluxReussi({ texte: JSON.stringify({ operations: [], supplementaires }), modele: "claude-opus-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

const depensesChat = () => depots().depenses.lister((d) => d.videoId === VIDEO && d.lignes.some((l) => l.etape.startsWith(ETAPE_LECTURE_CHAT)));
const sansIdDate = <T extends object>(p: T) => ({ ...p, id: "-", date: "-" });
const historique = () => historiqueModifications(VIDEO);
const allumer = () => commun.ecrireParametre(CLE_REGLAGE_LECTEUR_TABLEAU, true);

describe("S-06-b-v21s · tableau : règles muettes → une opération du lecteur commun", () => {
  // ALLUMER-LECTEUR-CHAT-v20k (seconde lecture du pilote) : la clé absente est désormais ALLUMÉE ; « éteint = identique » est GARDÉ pour `false` écrit.
  it("(a) éteint = identique : `false`, \"true\", lecture qui lève → incomprise d'aujourd'hui (phrase et exemples), 0 appel, 0 dépense", async () => {
    await commun.ecrireParametre(CLE_REGLAGE_LECTEUR_TABLEAU, false);
    const appels = brancherClaude();
    const temoin = await proposerModification(VIDEO, NON_COMPRISE);
    expect(temoin.statut).toBe("incomprise");
    expect(temoin.resume.startsWith("Je n'ai pas trouvé quoi changer sur le tableau.")).toBe(true);
    const vue = (await ficheTableauDeLaVideo(VIDEO))!;
    for (const ex of exemplesTableau(vue.fiche!, vue.contexte)) expect(temoin.resume).toContain(ex);
    await commun.ecrireParametre(CLE_REGLAGE_LECTEUR_TABLEAU, "true");
    expect(sansIdDate(await proposerModification(VIDEO, NON_COMPRISE))).toEqual(sansIdDate(temoin));
    const lire = commun.lireParametre;
    vi.spyOn(commun, "lireParametre").mockImplementation(async (cle: string, defaut: unknown) => {
      if (cle === CLE_REGLAGE_LECTEUR_TABLEAU) throw new Error("base en panne");
      return lire(cle, defaut as never);
    });
    await allumer();
    expect(sansIdDate(await proposerModification(VIDEO, NON_COMPRISE))).toEqual(sansIdDate(temoin));
    expect(appels).toHaveLength(0);
    expect(await depensesChat()).toHaveLength(0);
  });

  it("(b) allumé, non reconnue → 1 lecture : proposée, l'opération de Claude, la phrase exacte, 1 dépense de l'étape du chat", async () => {
    await allumer();
    const appels = brancherClaude();
    const p = await proposerModification(VIDEO, NON_COMPRISE);
    expect(appels).toHaveLength(1);
    expect(p.statut).toBe("proposee");
    expect(p.operationsTableau).toEqual([OP_VOIX]);
    // La voix refaite recale toute la vidéo : les 6 écrans sont refaits (comme pour la même opération venue des règles).
    expect(p.plansTouches).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p.resume).toBe("Je propose ce changement sur le tableau : écrans 1, 2, 3, 4, 5, 6. La voix est refaite (payant).");
    expect(await depensesChat()).toHaveLength(1);
  });

  it("(b) sans voix : pas de suffixe payant ; pluriel « écrans N, M. », singulier « écran N. »", async () => {
    await allumer();
    const ligne = SCENE.elements.find((e) => e.type === "ligne")!;
    brancherClaude([{ type: "retirerMarque", sceneId: SCENE.id, elementId: ligne.id }]);
    const p = await proposerModification(VIDEO, NON_COMPRISE);
    expect(p.statut).toBe("proposee");
    expect(p.plansTouches).toEqual([1, 2, 3]);
    expect(p.resume).toBe("Je propose ce changement sur le tableau : écrans 1, 2, 3.");
    const derniere = ficheDemonstration.scenes[5];
    brancherClaude([{ type: "ajouterMarque", sceneId: derniere.id, elementId: derniere.elements.find((e) => e.type === "ligne")!.id, marque: "souligne" }]);
    expect((await proposerModification(VIDEO, NON_COMPRISE)).resume).toBe("Je propose ce changement sur le tableau : écrans 5, 6.");
    // Singulier : la dernière scène seule sur sa page (fiche copiée, page 4).
    const seule = structuredClone(ficheDemonstration);
    seule.scenes[5].page = 4;
    await preparerTableau(seule);
    const une = await proposerModification(VIDEO, NON_COMPRISE);
    expect(une.plansTouches).toEqual([6]);
    expect(une.resume).toBe("Je propose ce changement sur le tableau : écran 6.");
  });

  it("(b) sans écran (fin changée) : « Je propose ce changement sur le tableau. »", async () => {
    await allumer();
    const vue = (await ficheTableauDeLaVideo(VIDEO))!;
    brancherClaude([{ type: "changerFin", appelId: vue.contexte.appels![0] }]);
    const fin = await proposerModification(VIDEO, NON_COMPRISE);
    expect(fin.statut).toBe("proposee");
    expect(fin.plansTouches).toEqual([]);
    expect(fin.resume).toBe("Je propose ce changement sur le tableau.");
  });

  it("(c) reconnue par les règles → 0 appel (clé allumée)", async () => {
    await allumer();
    const appels = brancherClaude();
    const vue = (await ficheTableauDeLaVideo(VIDEO))!;
    const ex = exemplesTableau(vue.fiche!, vue.contexte)[0];
    expect(ex).toBeTruthy();
    const p = await proposerModification(VIDEO, ex);
    expect(p.statut).toBe("proposee");
    expect(appels).toHaveLength(0);
    expect(await depensesChat()).toHaveLength(0);
  });

  it("(d) sortie refusée : hors schéma, ou refusée par l'aperçu → incomprise, phrase d'aujourd'hui", async () => {
    const temoin = await proposerModification(VIDEO, NON_COMPRISE); // éteint : la phrase d'aujourd'hui
    await allumer();
    for (const sortie of [[{ type: "inventee", sceneId: SCENE.id }], [{ ...OP_VOIX, sceneId: "scene-inconnue" }], "pas une liste"]) {
      brancherClaude(sortie);
      const p = await proposerModification(VIDEO, NON_COMPRISE);
      expect(p.statut, JSON.stringify(sortie)).toBe("incomprise");
      expect(p.resume.startsWith("Je n'ai pas trouvé quoi changer sur le tableau.")).toBe(true);
      expect(p.resume).toBe(temoin.resume);
    }
    // Un lecteur qui rendrait une opération sur une scène inconnue : l'aperçu de modifications.ts la refuse aussi.
    double.op = { ...OP_VOIX, sceneId: "scene-inconnue" };
    const p = await proposerModification(VIDEO, NON_COMPRISE);
    expect(p.statut).toBe("incomprise");
    expect(p.resume).toBe(temoin.resume);
  });

  it("(e) plafond : la 4e lecture de la vidéo → incomprise, 0 appel de plus (compteur commun, 3 dépenses)", async () => {
    await allumer();
    const appels = brancherClaude();
    for (let i = 0; i < 3; i++) expect((await proposerModification(VIDEO, NON_COMPRISE)).statut).toBe("proposee");
    expect(appels).toHaveLength(3);
    const p = await proposerModification(VIDEO, NON_COMPRISE);
    expect(p.statut).toBe("incomprise");
    expect(p.resume.startsWith("Je n'ai pas trouvé quoi changer sur le tableau.")).toBe(true);
    expect(appels).toHaveLength(3);
    expect(await depensesChat()).toHaveLength(3);
  });

  it("(f) prix inchangé : coût = celui d'une opération venue des règles ; confirmation par le même chemin (retoucherTableau, accord inchangé)", async () => {
    double.prixCentimes = 137;
    const vue = (await ficheTableauDeLaVideo(VIDEO))!;
    const regles = await proposerModification(VIDEO, exemplesTableau(vue.fiche!, vue.contexte)[0]);
    expect(regles.cout).toEqual({ centimes: 137, devise: "EUR" });
    await allumer();
    brancherClaude();
    const p = await proposerModification(VIDEO, NON_COMPRISE);
    expect(p.cout).toEqual(regles.cout);
    // Même chemin que la proposition des règles : `retoucherTableau` (accord sur la voix, mode indicatif : « le prix ne bloque jamais »).
    const issue = await confirmerModification(VIDEO, p.id);
    expect(issue.travailId).toBeTruthy();
    expect((await historique()).find((x) => x.id === p.id)?.statut).not.toBe("proposee");
  });

  it("(g) aucune phrase montant : le résumé passe la règle « montant » de regles-de-fer", async () => {
    await allumer();
    brancherClaude();
    const p = await proposerModification(VIDEO, NON_COMPRISE);
    const r = controler([{ chemin: "src/components/retouche-chat/fictif-s06b.tsx", contenu: `const t = ${JSON.stringify(p.resume)};` }], { exceptions: {} }) as { defauts: { regle: string }[] };
    expect(r.defauts.filter((d) => d.regle === "montant")).toEqual([]);
    expect(controler([{ chemin: "src/components/retouche-chat/fictif-s06b.tsx", contenu: 'const t = "12 €";' }], { exceptions: {} }).defauts.some((d: { regle: string }) => d.regle === "montant")).toBe(true);
  });
});
