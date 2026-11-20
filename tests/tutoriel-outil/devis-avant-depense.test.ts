/**
 * T-EXT-42 : le devis en quantités est montré et accepté AVANT toute dépense. Moteur réel, outils doubles :
 * aucun appel réel, aucun rendu réel, aucun navigateur.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil, validerScriptTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { ENTREE_DEVIS_TUTORIEL, etablirDevis, lireAccordDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { commandeTutoriel, outilsDoubles, SCRIPT, une, type Journal } from "./doubles";
import { avecRegistreFige, commandeDossier, FILM, fauxPort } from "./equipe-doubles";
import type { PortEquipe } from "@/moteurs/montage-tutoriel-outil/chaine";

// Raccords : réglage simulé (valeur, ou lecture qui lève) ; voix, rendu et stockage réels remplacés par des doubles vides.
const reglage: { valeur: unknown; leve: boolean } = { valeur: undefined, leve: false };
vi.mock("@/services/_commun", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  lireParametre: async (id: string, defaut: unknown) => {
    if (id !== "tutoriel.devisAvantDepense") return defaut;
    if (reglage.leve) throw new Error("lecture impossible");
    return reglage.valeur === undefined ? defaut : reglage.valeur;
  },
}));
vi.mock("@/services/tableau-outils", () => ({
  TARIF_VOIX_CENTIMES_PAR_CARACTERE: 0,
  branchementsReels: async () => ({ voix: {}, montage: { rendu: () => ({}), signer: async () => ({ lectures: {}, depots: {} }) }, env: "test" }),
}));

const T0 = Date.UTC(2026, 10, 8, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

type Devis = NonNullable<OutilsTutoriel["devis"]>;
const ROLES = [{ id: "plan", essaisMax: 2 }];

/** Outils doubles + port du devis, lisant l'accord dans la commande (comme les branchements) et comptant comme eux. */
function avecDevis(j: Journal, c: () => CommandeFabrication, roles: Devis["roles"] = ROLES, opts: Parameters<typeof outilsDoubles>[1] = {}, equipe?: PortEquipe): () => Promise<OutilsTutoriel> {
  // Les doubles sont créés UNE fois (le service de rendu simulé garde ses demandes d'un tour à l'autre) ; seul l'accord se relit.
  const doubles = outilsDoubles(j, opts);
  return async () => ({
    ...doubles,
    ...(equipe ? { equipe } : {}),
    devis: {
      roles,
      accord: lireAccordDevis(c().entrees),
      consomme: async (e) => ({ appelsClaude: (e.appelsClaude?.script ?? 0) + (e.appelsClaude?.plan ?? 0) + Object.values(e.appelsClaude?.roles ?? {}).reduce((n, v) => n + v, 0), caracteresVoix: e.audio && !e.audio.reutilise ? e.audio.caracteres : 0, rendus: e.rendus.length }),
    },
  });
}

async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: () => CommandeFabrication, travail: Travail, jusqua = 400) {
  let t = travail;
  for (let i = 0; i < jusqua; i++) {
    t = (await moteur.avancer(t, c(), T0 + i * 1000)).travail;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return t;
}

const pause = (t: Travail) => (t.parametres?.pause as { code: string; message: string } | undefined) ?? null;
const rien = (j: Journal) => expect([j.voix.length, j.claude.length, j.rendus.length]).toEqual([0, 0, 0]);

/** Le devis tel que le moteur l'établit pour un script collé, au pas de la voix (script lu, voix à payer). */
const devisVoix = (c: CommandeFabrication, roles: Devis["roles"] = ROLES) =>
  etablirDevis({ roles, caracteresScript: SCRIPT.length, texteScript: SCRIPT, motsScript: SCRIPT.split(/\s+/).filter(Boolean).length, voixDejaPayee: false, ratios: c.ratios, essai: false });
const avecAccord = (c: CommandeFabrication, empreinte: string): CommandeFabrication => ({ ...c, entrees: { ...c.entrees, [ENTREE_DEVIS_TUTORIEL]: { empreinte, le: "2026-11-18T10:00:00.000Z" } } });

describe("T-EXT-42 : éteint (devis absent)", () => {
  it("mêmes étapes, mêmes appels et même résultat qu'avant : le devis n'existe pas", async () => {
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
    const c = commandeTutoriel();
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    const t = await mener(moteur, () => c, t0);
    expect(t.statut).toBe("termine");
    expect(pause(t)).toBeNull();
    expect(j.voix).toHaveLength(1);
    expect(j.claude).toHaveLength(1);
    expect(j.rendus.filter((d) => d.operation === "composition")).toHaveLength(2);
  });
});

describe("T-EXT-42 : allumé", () => {
  it("sans accord : pause TO_DEVIS_A_ACCEPTER avant la voix, 0 appel voix / Claude / rendu, jamais un échec", async () => {
    const j = journalVide();
    const c = commandeTutoriel();
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    const t = await mener(moteur, () => c, t0);
    expect(pause(t)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    expect(pause(t)?.message).toBe("Le devis de cette vidéo attend votre accord : ouvrez l'écran de validation.");
    expect(t.statut).toBe("en_file");
    expect(t.erreur).toBeUndefined();
    expect(t.etapes.find((e) => e.cle === "voix")?.statut).toBe("en_attente");
    rien(j);
    // Une pause ne se transforme pas en échec en insistant.
    const encore = (await moteur.avancer(t, c, T0 + 9e5)).travail;
    expect(encore.statut).toBe("en_file");
    expect(pause(encore)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    rien(j);
  });

  it("accord à empreinte périmée : pause, 0 appel", async () => {
    const j = journalVide();
    const c0 = commandeTutoriel();
    const c = avecAccord(c0, "empreinte-perimee");
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    const t = await mener(moteur, () => c, t0);
    expect(pause(t)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    rien(j);
  });

  it("accord pour le devis courant : la fabrication va jusqu'au bout, dans les quantités du devis", async () => {
    const j = journalVide();
    const c = avecAccord(commandeTutoriel(), devisVoix(commandeTutoriel()).empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    const t = await mener(moteur, () => c, t0);
    expect(pause(t)).toBeNull();
    expect(t.statut).toBe("termine");
    expect(j.voix).toHaveLength(1);
    expect(j.claude).toHaveLength(1);
    expect(j.rendus.filter((d) => d.operation === "composition")).toHaveLength(2);
  });

  it("consommation au-delà du devis : pause TO_DEVIS_ATTEINT sans message de montant, 0 appel de plus", async () => {
    const j = journalVide();
    const c = avecAccord(commandeTutoriel(), "a-remplacer");
    // Devis d'un seul appel Claude permis, deux déjà revenus (état forcé) : le plafond par vidéo est dépassé.
    const roles = [{ id: "plan", essaisMax: 1 }];
    const empreinte = devisVoix(c, roles).empreinte;
    const cc = avecAccord(commandeTutoriel(), empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => cc, roles) });
    const t0 = await moteur.lancer(cc, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    const etatTrop = { ...(t0.parametres!.tutoriel as object), appelsClaude: { script: 0, plan: 2 } };
    const t = await mener(moteur, () => cc, { ...t0, parametres: { ...t0.parametres, tutoriel: etatTrop } });
    expect(pause(t)?.code).toBe("TO_DEVIS_ATTEINT");
    expect(pause(t)?.message).toMatch(/^Le devis de cette vidéo est atteint \(Claude\) : rien de plus n'est lancé sans votre accord\.$/);
    expect(pause(t)?.message).not.toMatch(/€|\$|EUR|USD|euro|dollar|prix|coût/i);
    expect(t.statut).toBe("en_file");
    expect(t.erreur).toBeUndefined();
    rien(j);
  });

  // AUTORISATION PERMANENTE (c) : l'écriture d'une idée par l'ancien écrivain est retirée (T-EXT-55) ; l'équipe écrit à partir d'un
  // dossier. Mêmes attentes : un accord avant le 1er appel, un SECOND après la validation du script, 0 voix avant.
  const ROLES_EQUIPE = [
    { id: "chef-de-projet", essaisMax: 1 },
    { id: "analyste", essaisMax: 1 },
    { id: "stratege", essaisMax: 1 },
    { id: "scenariste", essaisMax: 2 },
    { id: "plan", essaisMax: 2 },
  ];

  it("départ d'un dossier (équipe) : un premier accord pour l'écriture, un SECOND après la validation du script, 0 voix avant", async () => {
    const j = journalVide();
    const eq = fauxPort();
    const c0 = commandeDossier(FILM);
    const roles = ROLES_EQUIPE;
    let c = c0;
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, roles, {}, eq.port) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });

    // Pause 1 : rien n'est écrit sans accord (le devis est montré avant le 1er appel de rôle).
    let t = await mener(moteur, () => c, t0);
    expect(pause(t)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    rien(j);
    expect(eq.appels).toHaveLength(0);

    // Accord 1 (script encore inconnu : 0 caractère) : seule l'équipe écrit le script, puis pause de relecture.
    const devis1 = etablirDevis({ roles, caracteresScript: 0, texteScript: "", motsScript: 0, voixDejaPayee: false, ratios: c.ratios, essai: false });
    c = avecAccord(c0, devis1.empreinte);
    t = await mener(moteur, () => c, t);
    expect(pause(t)?.code).toBe("TO_SCRIPT_A_VALIDER");
    expect(eq.appels).toEqual(["stratege", "scenariste"]);
    expect(j.voix).toHaveLength(0);

    // Script validé : l'empreinte change, un second accord est demandé, toujours 0 voix.
    t = validerScriptTutoriel(avecRegistreFige(t), undefined, { version: "A" });
    t = await mener(moteur, () => c, t);
    expect(pause(t)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    expect(j.voix).toHaveLength(0);
    expect(j.rendus).toHaveLength(0);
    expect(eq.appels).toHaveLength(2);

    // Accord 2 sur le script validé : la fabrication va au bout.
    const texte = (t.parametres!.tutoriel as { script: { texte: string } }).script.texte;
    const devis2 = etablirDevis({ roles, caracteresScript: texte.length, texteScript: texte, motsScript: texte.split(/\s+/).filter(Boolean).length, voixDejaPayee: false, ratios: c.ratios, essai: false });
    expect(devis2.empreinte).not.toBe(devis1.empreinte);
    c = avecAccord(c0, devis2.empreinte);
    t = await mener(moteur, () => c, t);
    expect(pause(t)).toBeNull();
    expect(t.statut).toBe("termine");
    expect(j.voix).toHaveLength(1);
  });

  it("une prononciation qui allonge le texte lu, accord bon : la vidéo va au bout, 1 voix (le devis compte le texte réellement lu)", async () => {
    const j = journalVide();
    const c0 = commandeTutoriel({ prononciations: [{ mot: "tableau", prononciation: "ta-bleau-ta-bleau-ta-bleau" }] as CommandeFabrication["prononciations"] });
    const lu = SCRIPT.replace(/tableau/gi, "ta-bleau-ta-bleau-ta-bleau");
    expect(lu.length).toBeGreaterThan(SCRIPT.length);
    const devis = etablirDevis({ roles: ROLES, caracteresScript: lu.length, texteScript: SCRIPT, motsScript: lu.split(/\s+/).filter(Boolean).length, voixDejaPayee: false, ratios: c0.ratios, essai: false });
    const c = avecAccord(c0, devis.empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    const t = await mener(moteur, () => c, t0);
    expect(pause(t)).toBeNull();
    expect(t.statut).toBe("termine");
    expect(j.voix).toHaveLength(1);
  });

  // AUTORISATION PERMANENTE (c) : « script ×1 + plan ×2 » devient « chaque rôle × ses essais + plan ×2 » (T-EXT-55). Même mesure :
  // le plafond est vérifié AVANT chaque appel, jamais un appel de plus que le devis.
  it("plafond vérifié AVANT chaque appel : stratège ×1 + scénariste ×1 permis, jamais un 4e appel de rôle (TO_DEVIS_ATTEINT avant)", async () => {
    const j = journalVide();
    const eq = fauxPort({ illisible: "scenariste" });
    const c0 = commandeDossier(FILM);
    // Comme en production (tutoriel-branchements.ts) : le plan ×2 est toujours dans le devis ; il ne doit pas servir de marge aux rôles.
    const roles = [{ id: "stratege", essaisMax: 1 }, { id: "scenariste", essaisMax: 1 }, { id: "plan", essaisMax: 2 }];
    const devis1 = etablirDevis({ roles, caracteresScript: 0, texteScript: "", motsScript: 0, voixDejaPayee: false, ratios: c0.ratios, essai: false });
    const c = avecAccord(c0, devis1.empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, roles, {}, eq.port) });
    let t = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    for (let i = 0; i < 6 && pause(t)?.code !== "TO_DEVIS_ATTEINT"; i++) {
      t = await mener(moteur, () => c, { ...t, statut: "en_file", erreur: undefined, parametres: { ...t.parametres, pause: undefined } });
      expect(eq.appels.length).toBeLessThanOrEqual(2);
    }
    // Le devis permet 2 appels (stratège ×1 + scénariste ×1) : le scénariste illisible ne repart pas pour un 2e essai.
    expect(eq.appels).toEqual(["stratege", "scenariste"]);
    expect(pause(t)?.code).toBe("TO_DEVIS_ATTEINT");
    expect(j.claude).toHaveLength(0);
    expect(j.voix).toHaveLength(0);
  });

  it("devis de l'équipe : les rôles déjà passés ne sont pas recomptés « à venir » (chef + analyste + stratège = 3 appels, puis le scénariste passe)", async () => {
    const j = journalVide();
    const eq = fauxPort();
    const c0 = commandeDossier(FILM);
    // Total du devis : 1 + 1 + 1 + 2 (rôles) + 2 (plan) = 7 appels. Avant le scénariste : 3 consommés + 2 restants = 5 ≤ 7.
    // Compté à l'ancienne (tous les essais de tous les rôles, soit 5, en plus des 3 consommés) : 8 > 7, arrêt à tort.
    const devis1 = etablirDevis({ roles: ROLES_EQUIPE, caracteresScript: 0, texteScript: "", motsScript: 0, voixDejaPayee: false, ratios: c0.ratios, essai: false });
    const c = avecAccord(c0, devis1.empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, ROLES_EQUIPE, {}, eq.port) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    // Le chef et l'analyste ont déjà fait chacun un appel (revenu) ; le stratège en fait un, puis le scénariste.
    const etat0 = t0.parametres!.tutoriel as Record<string, unknown>;
    const depart = { ...t0, parametres: { ...t0.parametres, tutoriel: { ...etat0, appelsClaude: { plan: 0, roles: { "chef-de-projet": 1, analyste: 1 } } } } };
    const t = await mener(moteur, () => c, depart);
    expect(pause(t)?.code).toBe("TO_SCRIPT_A_VALIDER");
    expect(eq.appels).toEqual(["stratege", "scenariste"]);
  });

  it("la garde n'appelle jamais rien d'elle-même (espions)", async () => {
    const j = journalVide();
    const c = commandeTutoriel();
    const fabrique = avecDevis(j, () => c);
    const outils = await fabrique();
    const espion = vi.spyOn(outils, "claude");
    const moteur = creerMoteurTutorielOutil({ outils: async () => outils });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    await mener(moteur, () => c, t0);
    expect(espion).not.toHaveBeenCalled();
  });
});

describe("T-EXT-42 : le réglage tutoriel.devisAvantDepense (seul true exact allume)", () => {
  beforeAll(async () => {
    await import("@/services/tutoriel-branchements");
  });
  beforeEach(() => {
    reglage.valeur = undefined;
    reglage.leve = false;
  });
  const outilsReels = async (c: CommandeFabrication) => {
    const { servicesTutoriel } = await import("@/moteurs/montage-tutoriel-outil");
    return (await servicesTutoriel().outils!(c, "t1")) as OutilsTutoriel;
  };

  it.each([undefined, false, "true", 1, null])("réglage %s : aucun devis, comportement d'aujourd'hui", async (v) => {
    reglage.valeur = v;
    expect((await outilsReels(commandeTutoriel())).devis).toBeUndefined();
  });

  it("lecture du réglage qui lève : la panne remonte, jamais un devis à moitié allumé", async () => {
    reglage.leve = true;
    await expect(outilsReels(commandeTutoriel())).rejects.toThrow("lecture impossible");
  });

  it("exactement true : le port est fourni (accord relu, rôles du plan, consommation depuis l'état)", async () => {
    reglage.valeur = true;
    const d = (await outilsReels(commandeTutoriel())).devis!;
    expect(d.roles).toEqual([{ id: "plan", essaisMax: 2 }]);
    expect(d.accord).toBeNull();
    const idee = (await outilsReels(commandeTutoriel({ script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { idee: "Un tableau" } } }))).devis!;
    expect(idee.roles).toEqual([{ id: "script", essaisMax: 1 }, { id: "plan", essaisMax: 2 }]);
    const avecAccordLu = (await outilsReels(avecAccord(commandeTutoriel(), "abc"))).devis!;
    expect(avecAccordLu.accord).toEqual({ empreinte: "abc", le: "2026-11-18T10:00:00.000Z" });
    expect(await d.consomme({ ratios: ["4:5"], rendus: [], reserves: [], appelsClaude: { script: 1, plan: 2 } })).toEqual({ appelsClaude: 3, caracteresVoix: 0, rendus: 0 });
  });
});
