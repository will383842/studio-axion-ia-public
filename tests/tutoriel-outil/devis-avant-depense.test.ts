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
function avecDevis(j: Journal, c: () => CommandeFabrication, roles: Devis["roles"] = ROLES, opts: Parameters<typeof outilsDoubles>[1] = {}): () => Promise<OutilsTutoriel> {
  // Les doubles sont créés UNE fois (le service de rendu simulé garde ses demandes d'un tour à l'autre) ; seul l'accord se relit.
  const doubles = outilsDoubles(j, opts);
  return async () => ({
    ...doubles,
    devis: {
      roles,
      accord: lireAccordDevis(c().entrees),
      consomme: async (e) => ({ appelsClaude: (e.appelsClaude?.script ?? 0) + (e.appelsClaude?.plan ?? 0), caracteresVoix: e.audio && !e.audio.reutilise ? e.audio.caracteres : 0, rendus: e.rendus.length }),
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

  it("départ d'une idée : un premier accord pour l'écriture, un SECOND après la validation du script, 0 voix avant", async () => {
    const j = journalVide();
    const c0 = commandeTutoriel({ script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { idee: "Créer un tableau de bord" } } });
    const roles = [{ id: "script", essaisMax: 1 }, ...ROLES];
    let c = c0;
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, roles) });
    const t0 = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });

    // Pause 1 : rien n'est écrit sans accord.
    let t = await mener(moteur, () => c, t0);
    expect(pause(t)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    rien(j);

    // Accord 1 (script encore inconnu : 0 caractère) : seul Claude écrit le script, puis pause de relecture.
    const devis1 = etablirDevis({ roles, caracteresScript: 0, texteScript: "", motsScript: 0, voixDejaPayee: false, ratios: c.ratios, essai: false });
    c = avecAccord(c0, devis1.empreinte);
    t = await mener(moteur, () => c, t);
    expect(pause(t)?.code).toBe("TO_SCRIPT_A_VALIDER");
    expect(j.claude).toHaveLength(1);
    expect(j.voix).toHaveLength(0);

    // Script validé : l'empreinte change, un second accord est demandé, toujours 0 voix.
    t = validerScriptTutoriel(t);
    t = await mener(moteur, () => c, t);
    expect(pause(t)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    expect(j.voix).toHaveLength(0);
    expect(j.rendus).toHaveLength(0);

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

  it("plafond vérifié AVANT chaque appel : script ×1 + plan ×2 = 3 appels au plus, jamais un 4e (TO_DEVIS_ATTEINT avant)", async () => {
    const j = journalVide();
    const c0 = commandeTutoriel({ script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { idee: "Créer un tableau de bord" } } });
    const roles = [{ id: "script", essaisMax: 1 }, ...ROLES];
    // Première écriture trop courte : l'appel est compté, le script n'est pas écrit.
    const devis1 = etablirDevis({ roles, caracteresScript: 0, texteScript: "", motsScript: 0, voixDejaPayee: false, ratios: c0.ratios, essai: false });
    const c = avecAccord(c0, devis1.empreinte);
    const moteur = creerMoteurTutorielOutil({ outils: avecDevis(j, () => c, roles, { scriptEcrit: "Trop court." }) });
    let t = await moteur.lancer(c, { travailId: "t", versionId: "v", titre: "T", maintenant: T0 });
    // Chaque relance (après l'échec de l'écriture) repasse par la garde ; on relance jusqu'à la pause du devis.
    for (let i = 0; i < 6 && pause(t)?.code !== "TO_DEVIS_ATTEINT"; i++) {
      t = await mener(moteur, () => c, { ...t, statut: "en_file", erreur: undefined, parametres: { ...t.parametres, pause: undefined }, etapes: t.etapes.map((e) => (e.statut === "echec" ? { ...e, statut: "en_attente" as const, erreur: undefined } : e)) });
      expect(j.claude.length).toBeLessThanOrEqual(3);
    }
    expect(j.claude.length).toBeLessThanOrEqual(3);
    expect(pause(t)?.code).toBe("TO_DEVIS_ATTEINT");
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
