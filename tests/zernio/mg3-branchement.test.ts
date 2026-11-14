/**
 * R5 : écran /mots branché (créer un mot, choisir sa cible, activer par compte). Faux site signé, faux registre en mémoire,
 * valeurs 100 % FICTIVES, aucun réseau, aucun appel Zernio. Les mots du test sont des exemples fictifs, pas des mots du produit.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot } from "@/services/mots-service";
import type { TransportSite } from "@/fournisseurs/site/types";
import { ENV_SITE_FICTIF, siteCiblesFactice } from "./aides/site-cibles-factice";

let session = true;
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!session) throw new Error("NON_CONNECTE");
    return {};
  }),
}));

const reseau = vi.fn(async () => new Response("{}"));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { lireParametre, ecrireParametre } = await import("@/services/_commun");
const pm = await import("@/services/parcours-mot");
const CS = await import("@/services/cibles-site");
const S = await import("@/services/mots-service");
// Le chargement de ce module est ce qui branche la garde d'envoi par compte (injection).
const G = await import("@/services/mots-gestes");
const A = await import("@/app/(studio)/mots/actions");
const { lireVueMotsCibles } = await import("@/services/mots-cibles-vue");
const { PARAM_COMPTES_ZERNIO } = await import("@/services/zernio");
const { reinitialiserCacheStatsMots } = await import("@/services/stats-mots");
const { PHRASES_REFUS, phraseRefus } = await import("@/components/mots/etat-mots");

const FB = "compte-fb-fictif";
const IG = "compte-ig-fictif";
const LI = "compte-li-fictif";
const INCONNU = "compte-sans-reseau";
let site: ReturnType<typeof siteCiblesFactice>;
const ecritures = () => site.appels.filter((a) => a.methode === "POST");
const registre = () => lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {});
const ligne = (mot: string, compte: string, etat: LigneMot["etat"]): [string, LigneMot] => [`${mot}|${compte}`, { mot, compte, etat, idWorkflow: null, raison: "local", modifieLe: "x" }];
const poserRegistre = (...l: Array<[string, LigneMot]>) => ecrireParametre(S.PARAM_REGISTRE_MOTS, Object.fromEntries(l));
const rien = async () => JSON.stringify([await depots().parametres.lister(() => true)]);
const brancher = (t: TransportSite) => pm.injecterTransportSite(t);

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", reseau);
  vi.stubEnv("SITE_GUIDES_RESEAU_SECRET", ENV_SITE_FICTIF.SITE_GUIDES_RESEAU_SECRET);
  vi.stubEnv("SITE_VIDEOS_URL", ENV_SITE_FICTIF.SITE_VIDEOS_URL);
  vi.stubEnv("MOTS_ENABLED", "1");
  vi.stubEnv("PARCOURS_CONVERSATION_COMPTES", `${FB}, ${IG}, ${LI}, ${INCONNU}`);
  reinitialiserDepots();
  CS.reinitialiserEtatCiblesSite();
  reinitialiserCacheStatsMots();
  session = true;
  S.injecterExecuteurMots(async () => {
    throw new Error("appel Zernio interdit");
  });
  site = siteCiblesFactice();
  // Un second guide actif (pour changer de cible) et le mot GUIDE de départ.
  site.cibles.push({ code: "gde-essai03", type: "guide", titre: "Guide fictif D", actif: true, test: false });
  site.liaisons.push({ mot: "guide", reseau: "tous", codeCible: "gde-essai01", actif: true });
  brancher(site.transport);
  await ecrireParametre(PARAM_COMPTES_ZERNIO, {
    lusLe: "2026-01-01T00:00:00.000Z",
    comptes: [
      { id: FB, reseau: "facebook", nom: "Page fictive" },
      { id: IG, reseau: "instagram", nom: "Insta fictif" },
      { id: LI, reseau: "linkedin_page", nom: "LinkedIn fictif" },
    ],
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  pm.injecterTransportSite(null);
});

describe("branchement : la garde d'envoi par compte est injectée au chargement", () => {
  it("un mot autre que GUIDE passe par la garde (et non par le refus « fermé par défaut »)", async () => {
    const r = await S.activerMotParcours({ mot: "CONVERSATION", compte: LI, confirmeParOperateur: true, plusieursMots: async () => true });
    // Sans injection : `mot_non_valide`. Avec : la garde répond pour ce compte LinkedIn.
    expect(r).toMatchObject({ issue: "refuse", raison: "reseau_a_la_main" });
  });
  it("compte sans réseau connu : refus de la garde, rien n'est posé", async () => {
    const r = await S.activerMotParcours({ mot: "CONVERSATION", compte: INCONNU, confirmeParOperateur: true, plusieursMots: async () => true });
    expect(r).toMatchObject({ issue: "refuse", raison: "reseau_du_compte_inconnu" });
    expect(await registre()).toEqual({});
  });
});

describe("sans session : refus, 0 lecture, 0 écriture", () => {
  it("chaque geste et chaque action exige la session avant tout", async () => {
    session = false;
    const avant = await rien();
    const appels: Array<() => Promise<unknown>> = [
      () => G.gesteCreerMot("CONVERSATION", "gde-essai01"),
      () => G.gesteChangerCible("TOUS1", "gde-essai03"),
      () => G.gesteApercuTextesMot("TOUS1"),
      () => G.gesteValiderTextesMot("TOUS1", "facebook", "x"),
      () => G.gesteActiverMot("TOUS1", FB),
      () => G.gestePauseMot("TOUS1", FB),
      () => A.creerMotAction("CONVERSATION", "gde-essai01"),
      () => A.changerCibleAction("TOUS1", "gde-essai03"),
      () => A.apercuTextesMotAction("TOUS1"),
      () => A.validerTextesMotAction("TOUS1", "facebook", "x"),
      () => A.activerMotAction("TOUS1", FB),
      () => A.pauseMotAction("TOUS1", FB),
    ];
    for (const a of appels) await expect(a()).rejects.toThrow("NON_CONNECTE");
    expect(site.appels).toHaveLength(0);
    expect(await rien()).toBe(avant);
    expect(reseau).not.toHaveBeenCalled();
  });
});

describe("créer un mot", () => {
  it("GUIDE est réservé, STOP est refusé : aucune écriture", async () => {
    expect(await G.gesteCreerMot("GUIDE", "gde-essai01")).toMatchObject({ ok: false, raison: "mot_reserve" });
    expect(await G.gesteCreerMot("guide", "gde-essai01")).toMatchObject({ ok: false, raison: "mot_reserve" });
    expect(await G.gesteCreerMot("STOP", "gde-essai01")).toMatchObject({ ok: false, raison: "mot_reserve" });
    expect(ecritures()).toHaveLength(0);
  });
  it("un mot neuf : UNE liaison « tous » vers la cible, rien d'autre", async () => {
    const r = await A.creerMotAction("Conversation", "gde-essai01");
    expect(r.ok).toBe(true);
    const posts = ecritures();
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0].corps)).toMatchObject({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01" });
    expect(reseau).not.toHaveBeenCalled();
    expect(await registre()).toEqual({}); // brouillon : aucun compte activé
  });
  it("un mot qui existe déjà : phrase du tableau, aucune écriture", async () => {
    const r = await A.creerMotAction("tous1", "gde-essai01");
    expect(r).toEqual({ ok: false, phrase: "Ce mot existe déjà : changez sa cible depuis le tableau." });
    expect(ecritures()).toHaveLength(0);
  });
  it("cible absente ou désactivée : phrase du site", async () => {
    const { PHRASES_REFUS_SITE } = await import("@/domaine/guide-reseau/cibles-contrat");
    expect(await A.creerMotAction("CONVERSATION", "gde-nexistepas")).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.cible_inconnue });
    expect(await A.creerMotAction("CONVERSATION", "gde-essai02")).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.cible_inactive });
    expect(ecritures()).toHaveLength(0);
  });
  it("depuis une simple copie du catalogue : refus, aucune écriture", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 10, 12, 10, 0, 0));
    expect(await CS.lireCiblesSite()).not.toBeNull(); // la copie est faite
    site.etat.panne = true;
    vi.setSystemTime(Date.UTC(2026, 10, 12, 10, 30, 0)); // copie trop vieille pour servir sans relire, encore valable en secours
    const r = await A.creerMotAction("CONVERSATION", "gde-essai01");
    expect(r).toEqual({ ok: false, phrase: phraseRefus("site_injoignable") });
    expect(ecritures()).toHaveLength(0);
  });
});

describe("changer la cible d'un mot", () => {
  it("relie « tous » puis chaque ligne propre, met les lignes locales actives en pause, ne supprime aucune clé", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01", actif: true });
    site.liaisons.push({ mot: "conversation", reseau: "instagram", codeCible: "gde-essai01", actif: true });
    await poserRegistre(ligne("CONVERSATION", FB, "actif"), ligne("CONVERSATION", IG, "actif"), ligne("CONVERSATION", LI, "pause"), ligne("TOUS1", FB, "actif"));
    const cles = Object.keys(await registre()).sort();
    const r = await A.changerCibleAction("CONVERSATION", "gde-essai03");
    expect(r).toEqual({ ok: true, phrase: "Cible changée. Le mot a été mis en pause sur 2 compte(s) : validez ses textes puis réactivez-le." });
    expect(ecritures().map((p) => JSON.parse(p.corps).reseau)).toEqual(["tous", "instagram"]);
    const apres = await registre();
    expect(Object.keys(apres).sort()).toEqual(cles);
    expect(apres[`CONVERSATION|${FB}`].etat).toBe("pause");
    expect(apres[`CONVERSATION|${IG}`].etat).toBe("pause");
    expect(apres[`TOUS1|${FB}`].etat).toBe("actif"); // un autre mot n'est pas touché
    expect(reseau).not.toHaveBeenCalled();
  });
  it("le mot GUIDE : refusé, rien n'est écrit", async () => {
    const r = await A.changerCibleAction("GUIDE", "gde-essai03");
    expect(r).toEqual({ ok: false, phrase: "La cible du mot GUIDE ne se change pas ici pour l'instant." });
    expect(ecritures()).toHaveLength(0);
  });
  it("arrêt au premier échec : phrase des changements faits, et pause quand même", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01", actif: true });
    site.liaisons.push({ mot: "conversation", reseau: "instagram", codeCible: "gde-essai01", actif: true });
    await poserRegistre(ligne("CONVERSATION", FB, "actif"));
    let posts = 0;
    brancher(async (req) => {
      if (req.methode === "POST" && ++posts === 2) return { statut: 422, corps: { ok: false, erreur: "reception_eteinte" } };
      return site.transport(req);
    });
    const r = await A.changerCibleAction("CONVERSATION", "gde-essai03");
    expect(r.ok).toBe(false);
    expect(r.phrase).toContain("1 réseau(x) sur 2");
    expect(r.phrase).toContain("mis en pause sur 1 compte(s)");
    expect(posts).toBe(2);
    expect((await registre())[`CONVERSATION|${FB}`].etat).toBe("pause");
  });
  it("cible désactivée : refus avant toute écriture, rien n'est mis en pause", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01", actif: true });
    await poserRegistre(ligne("CONVERSATION", FB, "actif"));
    const r = await A.changerCibleAction("CONVERSATION", "gde-essai02");
    expect(r.ok).toBe(false);
    expect(ecritures()).toHaveLength(0);
    expect((await registre())[`CONVERSATION|${FB}`].etat).toBe("actif");
  });
});

describe("activer / pause par compte", () => {
  it("« plusieurs mots » éteint : un mot autre que GUIDE ne part pas", async () => {
    const r = await A.activerMotAction("TOUS1", FB);
    expect(r).toEqual({ issue: "refuse", phrase: phraseRefus("plusieurs_mots_eteint") });
    expect(await registre()).toEqual({});
  });
  it("pause : ligne locale en pause, la clé reste", async () => {
    await poserRegistre(ligne("TOUS1", FB, "actif"));
    const r = await A.pauseMotAction("TOUS1", FB);
    expect(r.issue).toBe("execute");
    expect((await registre())[`TOUS1|${FB}`].etat).toBe("pause");
    expect(reseau).not.toHaveBeenCalled();
  });
});

describe("vue de l'écran", () => {
  it("états par compte : réseau à la main, réseau inconnu, mots éteint, GUIDE à part", async () => {
    const lignes = [ligne("TOUS1", FB, "actif")[1]];
    const vue = await lireVueMotsCibles({ lignes });
    expect(vue).not.toBeNull();
    expect(vue!.plusieursMotsAllume).toBe(false);
    expect(vue!.depuisCopie).toBe(false);
    const tous1 = vue!.mots.find((m) => m.mot === "TOUS1")!;
    expect(tous1.etat).toBe("actif");
    const c = (id: string) => tous1.comptes.find((x) => x.compte === id)!;
    expect(c(FB)).toMatchObject({ etat: "actif", activable: false, raison: "plusieurs_mots_eteint", nom: "Page fictive" });
    expect(c(LI)).toMatchObject({ reseau: "linkedin", activable: false, raison: "reseau_a_la_main" });
    expect(c(INCONNU)).toMatchObject({ reseau: null, activable: false, raison: "reseau_du_compte_inconnu" });
    const guide = vue!.mots.find((m) => m.mot === "GUIDE")!;
    expect(guide.comptes.find((x) => x.compte === FB)).toMatchObject({ activable: true, raison: null });
    expect(guide.comptes.find((x) => x.compte === LI)).toMatchObject({ activable: false, raison: "reseau_a_la_main" });
    expect(vue!.tableau.lignes.length).toBeGreaterThan(0);
    expect(reseau).not.toHaveBeenCalled();
  });
  it("catalogue du site introuvable (ni site ni copie) : null, l'écran d'avant s'affiche seul", async () => {
    site.etat.panne = true;
    expect(await lireVueMotsCibles({ lignes: [] })).toBeNull();
  });
  it("reçoit les lignes déjà lues : ne rappelle JAMAIS lireVueMots", () => {
    const source = readFileSync(new URL("../../src/services/mots-cibles-vue.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/lireVueMots\s*[(,}]/);
    expect(source).not.toMatch(/zernio-client|fournisseurs\/publication/);
  });
  it("la page lit la vue des mots une seule fois", () => {
    const page = readFileSync(new URL("../../src/app/(studio)/mots/page.tsx", import.meta.url), "utf8");
    expect(page.match(/gesteLireMots\(\)/g)).toHaveLength(1);
    expect(page).toContain("lireVueMotsCibles({ lignes: vue.lignes })");
  });
});

describe("correctifs de relecture", () => {
  const zernio = (l: [string, LigneMot]): [string, LigneMot] => [l[0], { ...l[1], idWorkflow: "wf-x", raison: "zernio" }];
  it("pause d'une ligne posée chez Zernio : refus ligne_zernio, ni exécuteur Zernio ni fetch", async () => {
    const executeur = vi.fn(async () => {
      throw new Error("appel Zernio interdit");
    });
    S.injecterExecuteurMots(executeur);
    await poserRegistre(zernio(ligne("TOUS1", FB, "actif")));
    const r = await G.gestePauseMot("TOUS1", FB);
    expect(r).toMatchObject({ issue: "refuse", raison: "ligne_zernio" });
    expect(phraseRefus("ligne_zernio")).toBe("Ce mot est posé chez Zernio : utilisez la pause habituelle.");
    expect(executeur).not.toHaveBeenCalled();
    expect(reseau).not.toHaveBeenCalled();
    expect((await registre())[`TOUS1|${FB}`].etat).toBe("actif");
  });
  it("pause : mot non normalisé ou compte hors liste refusés", async () => {
    expect(await G.gestePauseMot("tous1", FB)).toMatchObject({ issue: "refuse", raison: "mot_invalide" });
    expect(await G.gestePauseMot("TOUS1", "compte-inconnu")).toMatchObject({ issue: "refuse", raison: "compte_hors_liste" });
  });
  it("changer la cible, réponse incertaine (5xx) : les lignes locales actives sont quand même mises en pause", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01", actif: true });
    await poserRegistre(ligne("CONVERSATION", FB, "actif"));
    brancher(async (req) => (req.methode === "POST" ? { statut: 503, corps: {} } : site.transport(req)));
    const r = await G.gesteChangerCible("CONVERSATION", "gde-essai03");
    expect(r.ok).toBe(false);
    expect(r.phrase).toContain("mis en pause sur 1 compte(s)");
    expect((await registre())[`CONVERSATION|${FB}`].etat).toBe("pause");
  });
  it("changer la cible : les lignes actives posées chez Zernio sont signalées, non touchées", async () => {
    site.liaisons.push({ mot: "conversation", reseau: "tous", codeCible: "gde-essai01", actif: true });
    await poserRegistre(ligne("CONVERSATION", FB, "actif"), zernio(ligne("CONVERSATION", IG, "actif")));
    const r = await G.gesteChangerCible("CONVERSATION", "gde-essai03");
    expect(r.ok).toBe(true);
    expect(r.phrase).toContain("mis en pause sur 1 compte(s)");
    expect(r.phrase).toContain("1 ligne(s) posée(s) chez Zernio restent actives : mettez-les en pause depuis la pause habituelle.");
    const apres = await registre();
    expect(apres[`CONVERSATION|${FB}`].etat).toBe("pause");
    expect(apres[`CONVERSATION|${IG}`].etat).toBe("actif");
  });
  it("« plusieurs mots » allumé : un mot autre que GUIDE n'est pas activable tant que l'activation est fermée", async () => {
    await ecrireParametre("parcours.mots_multiples", true);
    const vue = await lireVueMotsCibles({ lignes: [] });
    expect(vue!.plusieursMotsAllume).toBe(true);
    const tous1 = vue!.mots.find((m) => m.mot === "TOUS1")!;
    expect(tous1.comptes.find((x) => x.compte === FB)).toMatchObject({ activable: false, raison: "activation_pas_encore_ouverte" });
    expect(phraseRefus("activation_pas_encore_ouverte")).toBe("L’envoi des mots autres que GUIDE n’est pas encore ouvert : il arrive avec le prochain lot.");
  });
  it("GUIDE déjà actif sur un compte : pas activable pour ce compte", async () => {
    const vue = await lireVueMotsCibles({ lignes: [ligne("GUIDE", FB, "actif")[1]] });
    const guide = vue!.mots.find((m) => m.mot === "GUIDE")!;
    expect(guide.comptes.find((x) => x.compte === FB)).toMatchObject({ etat: "actif", activable: false, raison: null });
    expect(guide.comptes.find((x) => x.compte === IG)).toMatchObject({ activable: true });
  });
  it("STOP et les mots d'opposition : mot_reserve, aucune écriture", async () => {
    for (const m of ["STOP", "stop", "ARRETEZ", "Désinscrire"]) expect(await G.gesteCreerMot(m, "gde-essai01")).toMatchObject({ ok: false, raison: "mot_reserve" });
    expect(phraseRefus("mot_reserve")).toContain("GUIDE ou mot d’opposition comme STOP");
    expect(ecritures()).toHaveLength(0);
  });
});

describe("chaque raison a sa phrase", () => {
  const CODES = [
    "plusieurs_mots_eteint", "activation_par_la_fiche", "textes_non_valides_reseau", "reseau_a_la_main", "reseau_du_compte_inconnu",
    "cible_test", "adresse_pas_encore", "site_injoignable", "sans_cible", "cible_introuvable", "mot_guide_a_part", "titre_cible_absent",
    "mot_reserve", "activation_pas_encore_ouverte", "cible_guide_figee", "mot_existe", "mot_invalide", "validation_perimee", "lecture_impossible",
  ];
  it.each(CODES)("%s", (code) => {
    expect(Object.hasOwn(PHRASES_REFUS, code)).toBe(true);
    expect(phraseRefus(code)).not.toBe("Demande refusée.");
    expect(phraseRefus(code)).not.toMatch(/abonn/i);
  });
});
