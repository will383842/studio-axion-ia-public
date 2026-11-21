/**
 * AUD-7 · le devis en pause se range dans la pause, et le geste « accepter le devis » seul lève l'impasse.
 * Moteur réel, outils doubles, dépôts en mémoire : aucun appel réel, 0 €. Aucun réglage n'est allumé hors `tutoriel.formulaire` (garde des actions).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ ouverte: true }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session.ouverte) throw new Error("session exigée");
    return {};
  }),
}));

import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { ENTREE_DEVIS_TUTORIEL, etablirDevis, lireAccordDevis, texteDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { commandeTutoriel, outilsDoubles, SCRIPT, type Journal } from "./doubles";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const actions = await import("@/app/(studio)/tutoriel-outil/actions-devis");
const service = await import("@/services/tutoriel-devis");

const T0 = Date.UTC(2026, 10, 8, 9);
const LE = "2026-11-21T08:00:00.000Z";
const ROLES = [{ id: "plan", essaisMax: 2 }];

const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
const pause = (t: Travail) => (t.parametres?.pause as { code: string; devis?: { phrases: string[]; empreinte: string } } | undefined) ?? null;

/** Outils doubles + port du devis, lisant l'accord dans la commande COURANTE (comme les branchements). */
function outils(j: Journal, c: () => CommandeFabrication): () => Promise<OutilsTutoriel> {
  const doubles = outilsDoubles(j, {});
  return async () => ({
    ...doubles,
    devis: {
      roles: ROLES,
      accord: lireAccordDevis(c().entrees),
      consomme: async (e) => ({ appelsClaude: (e.appelsClaude?.script ?? 0) + (e.appelsClaude?.plan ?? 0), caracteresVoix: e.audio && !e.audio.reutilise ? e.audio.caracteres : 0, rendus: e.rendus.length }),
    },
  });
}

async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: () => CommandeFabrication, travail: Travail) {
  let t = travail;
  for (let i = 0; i < 400; i++) {
    t = (await moteur.avancer(t, c(), T0 + i * 1000)).travail;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return t;
}

/** Fabrique la vidéo, la version et le travail en pause TO_DEVIS_A_ACCEPTER dans les dépôts ; rend ce qu'il faut pour reprendre. */
async function installerPauseDevis() {
  const j = journalVide();
  let commande: CommandeFabrication = { ...commandeTutoriel(), videoId: "v1" };
  await depots().videos.enregistrer({ id: "v1", titre: "Mon tutoriel", formatId: "tutoriel-outil", statut: "en_fabrication", entrees: {}, creeLe: LE, modifieLe: LE } as never);
  await depots().versions.enregistrer({ id: "ver1", videoId: "v1", numero: 1, statut: "en_fabrication", commande, creeLe: LE, modifieLe: LE } as never);
  const moteur = creerMoteurTutorielOutil({ outils: outils(j, () => commande) });
  const t0 = await moteur.lancer(commande, { travailId: "t1", versionId: "ver1", titre: "T", maintenant: T0 });
  const t = await mener(moteur, () => commande, t0);
  await depots().travaux.enregistrer({ ...t, creeLe: LE } as never);
  const relire = async () => {
    commande = (await depots().versions.obtenir("ver1"))!.commande;
    return commande;
  };
  return { j, t, moteur, reprendre: async () => { await relire(); return mener(moteur, () => commande, (await depots().travaux.obtenir("t1"))!); } };
}
const rien = (j: Journal) => expect([j.voix.length, j.claude.length, j.rendus.length]).toEqual([0, 0, 0]);
const travail = async () => (await depots().travaux.obtenir("t1"))!;
const instantane = async () => JSON.stringify([await depots().travaux.lister(), await depots().videos.lister(), await depots().versions.lister()]);

beforeEach(async () => {
  reinitialiserDepots();
  session.ouverte = true;
  await ecrireParametre("tutoriel.formulaire", true);
});

describe("AUD-7 : la pause porte le devis montré", () => {
  it("TO_DEVIS_A_ACCEPTER : phrases et empreinte du devis, 0 appel", async () => {
    const { j, t, } = await installerPauseDevis();
    expect(pause(t)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    const c = commandeTutoriel();
    const attendu = etablirDevis({ roles: ROLES, caracteresScript: SCRIPT.length, texteScript: SCRIPT, motsScript: SCRIPT.split(/\s+/).filter(Boolean).length, voixDejaPayee: false, ratios: c.ratios, essai: false });
    expect(pause(t)?.devis).toEqual({ phrases: texteDevis(attendu), empreinte: attendu.empreinte });
    expect(JSON.stringify(pause(t)?.devis)).not.toMatch(/[€$]|centime|euro/i);
    rien(j);
  });
});

describe("AUD-7 : etat.equipe.devis", () => {
  it("équipe déjà dans l'état : le devis y est rangé ; sans équipe, aucune équipe partielle n'est créée", async () => {
    const j = journalVide();
    const c = { ...commandeTutoriel(), videoId: "v1" };
    const moteur = creerMoteurTutorielOutil({ outils: outils(j, () => c) });
    const t0 = await moteur.lancer(c, { travailId: "t1", versionId: "ver1", titre: "T", maintenant: T0 });
    const sans = await mener(moteur, () => c, t0);
    expect((sans.parametres?.tutoriel as { equipe?: unknown }).equipe).toBeUndefined();
    const equipe = { demande: {}, payes: {} };
    const avec = { ...t0, parametres: { ...t0.parametres, tutoriel: { ...(t0.parametres!.tutoriel as object), equipe } } } as Travail;
    const t = await mener(moteur, () => c, avec);
    expect(pause(t)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    expect((t.parametres?.tutoriel as { equipe: { devis: unknown; demande: unknown } }).equipe).toMatchObject({ demande: {}, devis: pause(t)!.devis });
    rien(j);
  });
});

describe("AUD-7 : impasse levée", () => {
  it("accepter le devis seul : accord écrit (vidéo + version), pause retirée, la fabrication va au bout", async () => {
    const { j, t, reprendre } = await installerPauseDevis();
    const r = await actions.accepterDevisAction("v1", pause(t)!.devis!.empreinte);
    expect(r).toMatchObject({ ok: true, donnees: { statut: "ok" } });
    expect(lireAccordDevis((await depots().videos.obtenir("v1"))!.entrees)?.empreinte).toBe(pause(t)!.devis!.empreinte);
    expect(lireAccordDevis((await depots().versions.obtenir("ver1"))!.commande.entrees)?.empreinte).toBe(pause(t)!.devis!.empreinte);
    expect((await travail()).parametres?.pause).toBeUndefined();
    expect((await travail()).statut).toBe("en_cours");
    rien(j);
    const fin = await reprendre();
    expect(pause(fin)).toBeNull();
    expect(fin.statut).toBe("termine");
    expect(j.voix).toHaveLength(1);
  });

  it("pause enregistrée sur un travail « en_cours » (état réel de la boucle) : le devis se lit et s'accepte", async () => {
    const { t } = await installerPauseDevis();
    await depots().travaux.modifier("t1", { statut: "en_cours" });
    expect(await service.lireDevisAAccepter("v1")).toEqual(pause(t)!.devis);
    expect(await service.accepterDevis("v1", pause(t)!.devis!.empreinte)).toMatchObject({ statut: "ok" });
  });

  it("ne change aucun réglage : seule la clé du formulaire est posée par le test, devisAvantDepense reste absente", async () => {
    const { t } = await installerPauseDevis();
    await actions.accepterDevisAction("v1", pause(t)!.devis!.empreinte);
    const { lireParametre } = await import("@/services/_commun");
    expect(await lireParametre("tutoriel.devisAvantDepense", false)).toBe(false);
  });
});

describe("AUD-7 : refus", () => {
  it("empreinte périmée (devis changé entre-temps) : refus, rien n'est écrit", async () => {
    const { t } = await installerPauseDevis();
    const avant = await instantane();
    for (const e of ["empreinte-perimee", `${pause(t)!.devis!.empreinte}x`, "", "   ", "a".repeat(201)]) {
      const r = await actions.accepterDevisAction("v1", e);
      expect(r.ok && r.donnees.statut).toBe("refusee");
    }
    expect(await instantane()).toBe(avant);
  });

  it("devis remplacé dans la pause après la lecture de Williams : l'ancienne empreinte est refusée", async () => {
    const { t } = await installerPauseDevis();
    const vue = pause(t)!.devis!.empreinte;
    const tr = await travail();
    await depots().travaux.modifier("t1", { parametres: { ...tr.parametres, pause: { ...(tr.parametres!.pause as object), devis: { phrases: ["Claude : 9 appels au plus"], empreinte: "nouvelle" } } } });
    expect(await service.accepterDevis("v1", vue)).toEqual({ statut: "refusee", phrase: service.PHRASE_DEVIS_CHANGE });
    expect(lireAccordDevis((await depots().videos.obtenir("v1"))!.entrees)).toBeNull();
  });

  it.each([
    ["pause du script", { code: "TO_SCRIPT_A_VALIDER" }],
    ["pause des outils", { code: "TO_OUTILS_NON_RELIES" }],
    ["pause de la pièce", { code: "TO_PIECE_A_VALIDER" }],
  ])("autre pause (%s) : refus, rien n'est écrit", async (_n, autre) => {
    const { t } = await installerPauseDevis();
    const tr = await travail();
    await depots().travaux.modifier("t1", { parametres: { ...tr.parametres, pause: { ...autre, message: "x", devis: pause(t)!.devis } } });
    const avant = await instantane();
    expect(await service.accepterDevis("v1", pause(t)!.devis!.empreinte)).toEqual({ statut: "refusee", phrase: service.PHRASE_DEVIS_RIEN });
    expect(await instantane()).toBe(avant);
  });

  it("sans pause, travail terminé, en échec ou annulé, vidéo inconnue : refus", async () => {
    const { t } = await installerPauseDevis();
    const e = pause(t)!.devis!.empreinte;
    for (const statut of ["termine", "echec", "annule"] as const) {
      await depots().travaux.modifier("t1", { statut });
      expect(await service.accepterDevis("v1", e)).toMatchObject({ statut: "refusee" });
    }
    expect(await service.accepterDevis("inconnue", e)).toMatchObject({ statut: "refusee" });
    expect(await service.lireDevisAAccepter("inconnue")).toBeNull();
  });

  it("accord non rejouable : la 2e demande est refusée et n'écrit rien", async () => {
    const { t } = await installerPauseDevis();
    const e = pause(t)!.devis!.empreinte;
    expect((await service.accepterDevis("v1", e)).statut).toBe("ok");
    const apres = await instantane();
    expect((await service.accepterDevis("v1", e)).statut).toBe("refusee");
    expect(await instantane()).toBe(apres);
  });

  it("pause TO_DEVIS_ATTEINT : aucun devis à accepter, refus, rien n'est écrit", async () => {
    const { t } = await installerPauseDevis();
    const tr = await travail();
    await depots().travaux.modifier("t1", { parametres: { ...tr.parametres, pause: { code: "TO_DEVIS_ATTEINT", message: "x", devis: pause(t)!.devis } } });
    const avant = await instantane();
    expect(await service.accepterDevis("v1", pause(t)!.devis!.empreinte)).toEqual({ statut: "refusee", phrase: service.PHRASE_DEVIS_RIEN });
    expect(await instantane()).toBe(avant);
  });

  it("pause TO_DEVIS_A_ACCEPTER dont l'empreinte est déjà acceptée : refus « déjà accepté »", async () => {
    const { t } = await installerPauseDevis();
    const e = pause(t)!.devis!.empreinte;
    const v = (await depots().videos.obtenir("v1"))!;
    await depots().videos.modifier("v1", { entrees: { ...v.entrees, [ENTREE_DEVIS_TUTORIEL]: { empreinte: e, le: LE } } });
    const tr = await travail();
    await depots().travaux.modifier("t1", { parametres: { ...tr.parametres, pause: { code: "TO_DEVIS_A_ACCEPTER", message: "x", devis: pause(t)!.devis } } });
    expect(await service.accepterDevis("v1", e)).toEqual({ statut: "refusee", phrase: service.PHRASE_DEVIS_DEJA });
  });

  it("éteint (formulaire) ou sans session : l'action refuse, rien n'est écrit", async () => {
    const { t } = await installerPauseDevis();
    const e = pause(t)!.devis!.empreinte;
    const avant = await instantane();
    await ecrireParametre("tutoriel.formulaire", "true");
    expect((await actions.accepterDevisAction("v1", e)).ok).toBe(false);
    await ecrireParametre("tutoriel.formulaire", true);
    session.ouverte = false;
    expect((await actions.accepterDevisAction("v1", e)).ok).toBe(false);
    expect(await instantane()).toBe(avant);
  });
});

describe("AUD-7 : lecture", () => {
  it("lireDevisAAccepter rend le devis en pause, puis null une fois accepté", async () => {
    const { t } = await installerPauseDevis();
    expect(await service.lireDevisAAccepter("v1")).toEqual(pause(t)!.devis);
    await service.accepterDevis("v1", pause(t)!.devis!.empreinte);
    expect(await service.lireDevisAAccepter("v1")).toBeNull();
  });
});

describe("AUD-7 : par la vraie boucle (lireTravauxAAvancer + moteur.avancer + ecrireAvancement)", () => {
  it("la pause réelle est en « en_cours » ; accepter le devis ; un nouveau tour fait repartir la fabrication", async () => {
    const { lireTravauxAAvancer, ecrireAvancement } = await import("@/services/travaux");
    const j = journalVide();
    let commande: CommandeFabrication = { ...commandeTutoriel(), videoId: "v1" };
    await depots().videos.enregistrer({ id: "v1", titre: "Mon tutoriel", formatId: "tutoriel-outil", statut: "en_fabrication", ratios: ["4:5"], entrees: {}, creeLe: LE, modifieLe: LE } as never);
    await depots().versions.enregistrer({ id: "ver1", videoId: "v1", numero: 1, statut: "en_fabrication", commande, creeLe: LE, modifieLe: LE } as never);
    const moteur = creerMoteurTutorielOutil({ outils: outils(j, () => commande) });
    await depots().travaux.enregistrer({ ...(await moteur.lancer(commande, { travailId: "t1", versionId: "ver1", titre: "T", maintenant: T0 })), creeLe: LE } as never);
    let instant = T0;
    /** Un tour de la vraie boucle : lecture (sort de la file), moteur, écriture. */
    const tourReel = async () => {
      instant += 1000;
      for (const lu of await lireTravauxAAvancer(instant, () => moteur)) {
        commande = lu.commande;
        await ecrireAvancement(lu, await moteur.avancer(lu.travail, lu.commande, instant));
      }
    };
    for (let i = 0; i < 400 && !(await travail()).parametres?.pause; i++) await tourReel();
    const enPause = await travail();
    expect(pause(enPause)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    expect(enPause.statut).toBe("en_cours"); // l'état réel : jamais remis « en_file »
    rien(j);
    expect(await service.lireDevisAAccepter("v1")).toEqual(pause(enPause)!.devis);
    expect(await service.accepterDevis("v1", pause(enPause)!.devis!.empreinte)).toMatchObject({ statut: "ok" });
    for (let i = 0; i < 400 && !["termine", "echec", "annule"].includes((await travail()).statut) && !(await travail()).parametres?.pause; i++) await tourReel();
    const fin = await travail();
    expect(pause(fin)).toBeNull();
    expect(fin.statut).toBe("termine");
    expect(j.voix).toHaveLength(1);
  }, 60_000);
});
