/** R3 : activation par compte d'un mot autre que GUIDE (garde d'envoi). Valeurs fictives, aucun réseau. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot } from "@/services/mots-service";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { lireParametre, ecrireParametre, sousVerrou } =
  await import("@/services/_commun");
const S = await import("@/services/mots-service");

const COMPTE = "c1";
const ENV = { MOTS_ENABLED: "1", PARCOURS_CONVERSATION_COMPTES: "c1, c2" };
const registre = async () =>
  lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {});
const ouvert = async () => true;
const executeur = vi.fn(async () => ({ statut: 200 }));
const base = {
  mot: "CHATGPT",
  compte: COMPTE,
  confirmeParOperateur: true,
  env: ENV,
  plusieursMots: ouvert,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  reinitialiserDepots();
  S.injecterExecuteurMots(executeur);
  S.injecterVerificationMotParcours(async () => null);
});

describe("activerMotParcours", () => {
  it("sans confirmation : refus", async () => {
    expect(
      await S.activerMotParcours({ ...base, confirmeParOperateur: false }),
    ).toMatchObject({
      issue: "refuse",
      raison: "validation_operateur_absente",
    });
    expect(await registre()).toEqual({});
  });
  it("STOP et mot non normalisé : refus mot_invalide", async () => {
    expect(await S.activerMotParcours({ ...base, mot: "STOP" })).toMatchObject({
      raison: "mot_invalide",
    });
    expect(
      await S.activerMotParcours({ ...base, mot: "chatgpt" }),
    ).toMatchObject({ raison: "mot_invalide" });
  });
  it("compte hors liste : refus", async () => {
    const verif = vi.fn(async () => null);
    S.injecterVerificationMotParcours(verif);
    expect(
      await S.activerMotParcours({ ...base, compte: "autre" }),
    ).toMatchObject({ raison: "compte_hors_liste" });
    expect(verif).not.toHaveBeenCalled(); // refusé avant toute vérification
  });
  it("réglage plusieurs mots éteint : refus, aucune ligne", async () => {
    expect(
      await S.activerMotParcours({ ...base, plusieursMots: async () => false }),
    ).toMatchObject({ raison: "plusieurs_mots_eteint" });
    expect(
      await S.activerMotParcours({ ...base, plusieursMots: undefined }),
    ).toMatchObject({ raison: "plusieurs_mots_eteint" });
    expect(await registre()).toEqual({});
  });
  it("sans vérification injectée : refus mot_non_valide", async () => {
    S.injecterVerificationMotParcours(null);
    expect(await S.activerMotParcours(base)).toMatchObject({
      issue: "refuse",
      raison: "mot_non_valide",
    });
    expect(await registre()).toEqual({});
  });
  it("vérification qui refuse : refus avec son code, aucune ligne", async () => {
    S.injecterVerificationMotParcours(async () => "textes_non_valides_reseau");
    expect(await S.activerMotParcours(base)).toMatchObject({
      issue: "refuse",
      raison: "textes_non_valides_reseau",
    });
    expect(await registre()).toEqual({});
  });
  it("interrupteur éteint : interrupteur_eteint, aucune ligne", async () => {
    expect(
      await S.activerMotParcours({
        ...base,
        env: { ...ENV, MOTS_ENABLED: "0" },
      }),
    ).toMatchObject({ raison: "interrupteur_eteint" });
    expect(await registre()).toEqual({});
  });
  it("succès : ligne CHATGPT|c1 active, rien vers Zernio", async () => {
    const r = await S.activerMotParcours(base);
    expect(r.issue).toBe("execute");
    expect((await registre())["CHATGPT|c1"]).toMatchObject({
      mot: "CHATGPT",
      compte: COMPTE,
      etat: "actif",
      idWorkflow: null,
      raison: "local",
    });
    expect(executeur).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("ligne posée chez Zernio : deja_pose_chez_zernio", async () => {
    await ecrireParametre(S.PARAM_REGISTRE_MOTS, {
      "CHATGPT|c1": {
        mot: "CHATGPT",
        compte: COMPTE,
        etat: "pause",
        idWorkflow: "w1",
        raison: null,
        modifieLe: "x",
      },
    });
    expect(await S.activerMotParcours(base)).toMatchObject({
      raison: "deja_pose_chez_zernio",
    });
  });
  it("la vérification tourne HORS verrou (elle peut elle-même prendre le verrou)", async () => {
    S.injecterVerificationMotParcours(async () => {
      await sousVerrou(async () => undefined);
      return null;
    });
    const r = await Promise.race([
      S.activerMotParcours(base),
      new Promise<string>((ok) => setTimeout(() => ok("bloque"), 2000)),
    ]);
    expect(r).not.toBe("bloque");
    expect((r as { issue: string }).issue).toBe("execute");
  }, 6000);
});

describe("reactiverMot", () => {
  it("une ligne locale CHATGPT en pause ne se réactive pas par la fiche", async () => {
    await ecrireParametre(S.PARAM_REGISTRE_MOTS, {
      "CHATGPT|c1": {
        mot: "CHATGPT",
        compte: COMPTE,
        etat: "pause",
        idWorkflow: null,
        raison: "local",
        modifieLe: "x",
      },
    });
    expect(
      await S.reactiverMot({
        mot: "CHATGPT",
        compte: COMPTE,
        confirmeParOperateur: true,
        env: ENV,
      }),
    ).toMatchObject({ issue: "refuse", raison: "activation_par_la_fiche" });
    expect((await registre())["CHATGPT|c1"].etat).toBe("pause");
  });
});
