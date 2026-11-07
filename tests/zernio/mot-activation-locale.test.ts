/** Activation LOCALE du mot GUIDE : aucune requête vers /v1/workflows, tout refus est fermé. Valeurs fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot, RequeteMots } from "@/services/mots-service";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const S = await import("@/services/mots-service");

const ALLUME = { MOTS_ENABLED: "1" };
const COMPTE = "compte_fictif_1";
const saisie = { mot: "GUIDE", reponsePublique: "Message automatique envoyé par Axion IA. regardez vos messages privés.", messagePrive: "Message automatique envoyé par Axion IA. Quelle adresse pour le guide ?", relance: null, fin: "Message automatique envoyé par Axion IA. Merci, c'est noté." };
const valider = () => S.validerMot({ saisie, confirmeParOperateur: true });
const demande = (env: Record<string, string | undefined> = ALLUME) => ({ mot: "GUIDE" as const, compte: COMPTE, confirmeParOperateur: true, env });
/** Même lecture que la garde `motGuideActif` de la machine de conversation (registre["GUIDE|compte"].etat === "actif"). */
const guideActif = async () => (await lireParametre<Record<string, { etat?: string }>>(S.PARAM_REGISTRE_MOTS, {}))[`GUIDE|${COMPTE}`]?.etat === "actif";
const ligne = async () => (await lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {}))[`GUIDE|${COMPTE}`];
let appels: RequeteMots[];

beforeEach(() => {
  reinitialiserDepots();
  appels = [];
  S.injecterExecuteurMots(async (r) => {
    appels.push(r);
    return { statut: 200, corps: { id: "wf_fictif" } };
  });
});

describe("activation locale du mot GUIDE", () => {
  it("écrit la ligne « actif » sans aucun appel réseau", async () => {
    await valider();
    const r = await S.activerMotLocal(demande());
    expect(r.issue).toBe("execute");
    expect(appels).toHaveLength(0);
    expect(await ligne()).toMatchObject({ mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: "local" });
  });

  it("refuse sans geste de l'opérateur", async () => {
    await valider();
    expect((await S.activerMotLocal({ ...demande(), confirmeParOperateur: false })).issue).toBe("refuse");
    expect(await ligne()).toBeUndefined();
  });

  it.each([
    ["« Tout arrêter » actif", "tout_arrete", async () => ecrireParametre("zernio.envoi_autorise", false), ALLUME, true],
    ["disjoncteur ouvert", "disjoncteur_ouvert", async () => ecrireParametre(S.PARAM_GARDES_MOTS, { disjoncteur: { ouvert: true, raison: "essai", ouvertLe: "2026-01-01T00:00:00.000Z" } }), ALLUME, true],
    ["mot non validé", "mot_non_valide", async () => undefined, ALLUME, false],
    ["MOTS_ENABLED éteint", "interrupteur_eteint", async () => undefined, {}, true],
  ])("refuse : %s", async (_nom, raison, preparer, env, valide) => {
    if (valide) await valider();
    await preparer();
    const r = await S.activerMotLocal(demande(env));
    expect(r).toMatchObject({ issue: "refuse", raison });
    expect(await ligne()).toBeUndefined();
    expect(appels).toHaveLength(0);
  });

  it("« Tout arrêter » met en pause une ligne locale sans réseau ni erreur comptée", async () => {
    await valider();
    await S.activerMotLocal(demande());
    await ecrireParametre("zernio.envoi_autorise", false);
    const r = await S.appliquerToutArreter({ env: ALLUME });
    expect(r).toEqual({ arret: true, pauses: 1 });
    expect((await ligne()).etat).toBe("pause_auto");
    expect(appels).toHaveLength(0);
    const g = await S.lireGardes();
    expect(g.erreursConsecutives).toBe(0);
    expect(g.disjoncteur.ouvert).toBe(false);
  });

  it("plusieurs « Tout arrêter » d'affilée avec exécuteur absent n'ouvrent pas le disjoncteur", async () => {
    S.injecterExecuteurMots(null);
    await valider();
    await S.activerMotLocal(demande());
    await ecrireParametre("zernio.envoi_autorise", false);
    for (let i = 0; i < 7; i++) await S.appliquerToutArreter({ env: ALLUME });
    expect((await S.lireGardes()).disjoncteur.ouvert).toBe(false);
    expect((await ligne()).etat).toBe("pause_auto");
  });

  it("le garde du parcours devient vrai après activation et faux après pause", async () => {
    await valider();
    expect(await guideActif()).toBe(false);
    await S.activerMotLocal(demande());
    expect(await guideActif()).toBe(true);
    const p = await S.mettreEnPauseLocal({ mot: "GUIDE", compte: COMPTE, confirmeParOperateur: true });
    expect(p.issue).toBe("execute");
    expect(await guideActif()).toBe(false);
    expect(appels).toHaveLength(0);
  });

  it("mettreEnPause et réactiverMot traitent une ligne locale sans réseau (réactivation soumise aux mêmes gardes)", async () => {
    await valider();
    await S.activerMotLocal(demande());
    expect((await S.mettreEnPause(demande())).issue).toBe("execute");
    expect((await ligne()).etat).toBe("pause");
    await ecrireParametre("zernio.envoi_autorise", false);
    expect((await S.reactiverMot(demande())).raison).toBe("tout_arrete");
    await ecrireParametre("zernio.envoi_autorise", true);
    expect((await S.reactiverMot(demande())).issue).toBe("execute");
    expect(await guideActif()).toBe(true);
    expect(appels).toHaveLength(0);
  });

  it("ne remplace pas une ligne posée chez Zernio", async () => {
    await valider();
    await ecrireParametre(S.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "pause", idWorkflow: "wf_1", raison: null, modifieLe: "2026-01-01T00:00:00.000Z" } });
    expect((await S.activerMotLocal(demande())).issue).toBe("refuse");
    expect((await ligne()).idWorkflow).toBe("wf_1");
  });
});
