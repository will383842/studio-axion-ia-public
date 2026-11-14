/**
 * PR-B · activation des autres mots par l'écran, derrière « plusieurs mots ». Faux site signé, registre en mémoire, valeurs 100 % FICTIVES,
 * aucun réseau, aucun appel Zernio. Les mots du test sont des exemples fictifs.
 *  - réglage ÉTEINT (défaut) : rien ne change pour personne ;
 *  - réglage allumé : un autre mot s'active (textes validés pour CE réseau, cible active non d'essai, Facebook seulement) et se réactive après une pause.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneMot } from "@/services/mots-service";
import { ENV_SITE_FICTIF, siteCiblesFactice } from "./aides/site-cibles-factice";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

const reseau = vi.fn(async () => new Response("{}"));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const { lireParametre, ecrireParametre } = await import("@/services/_commun");
const pm = await import("@/services/parcours-mot");
const CS = await import("@/services/cibles-site");
const S = await import("@/services/mots-service");
const G = await import("@/services/mots-gestes"); // branche la garde d'envoi par compte
const MM = await import("@/services/parcours-mots-multiples");
const { lireVueMotsCibles } = await import("@/services/mots-cibles-vue");
const { PARAM_COMPTES_ZERNIO } = await import("@/services/zernio");
const { reinitialiserCacheStatsMots } = await import("@/services/stats-mots");
const { phraseRefus } = await import("@/components/mots/etat-mots");

const FB = "compte-fb-fictif";
const IG = "compte-ig-fictif";
let site: ReturnType<typeof siteCiblesFactice>;
const registre = () => lireParametre<Record<string, LigneMot>>(S.PARAM_REGISTRE_MOTS, {});
const ligne = (mot: string, compte: string, etat: LigneMot["etat"], idWorkflow: string | null = null): [string, LigneMot] => [`${mot}|${compte}`, { mot, compte, etat, idWorkflow, raison: "local", modifieLe: "x" }];
const poserRegistre = (...l: Array<[string, LigneMot]>) => ecrireParametre(S.PARAM_REGISTRE_MOTS, Object.fromEntries(l));
const allumer = (v: boolean) => ecrireParametre(MM.PARAM_MOTS_MULTIPLES, v);
/** Valide les textes de TOUS1 pour un réseau (geste de l'opérateur), comme l'écran. */
async function validerTous1(reseauVoulu: "facebook" | "instagram" = "facebook"): Promise<void> {
  const ap = (await G.gesteApercuTextesMot("TOUS1")).find((x) => x.reseau === reseauVoulu);
  if (!ap || !ap.ok) throw new Error(`aperçu refusé : ${ap && !ap.ok ? ap.raison : "absent"}`);
  const r = await G.gesteValiderTextesMot("TOUS1", reseauVoulu, ap.empreinte);
  if (!r.ok) throw new Error(r.raison);
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", reseau);
  vi.stubEnv("SITE_GUIDES_RESEAU_SECRET", ENV_SITE_FICTIF.SITE_GUIDES_RESEAU_SECRET);
  vi.stubEnv("SITE_VIDEOS_URL", ENV_SITE_FICTIF.SITE_VIDEOS_URL);
  vi.stubEnv("MOTS_ENABLED", "1");
  vi.stubEnv("PARCOURS_CONVERSATION_COMPTES", `${FB}, ${IG}`);
  reinitialiserDepots();
  CS.reinitialiserEtatCiblesSite();
  reinitialiserCacheStatsMots();
  S.injecterExecuteurMots(async () => {
    throw new Error("appel Zernio interdit");
  });
  site = siteCiblesFactice();
  pm.injecterTransportSite(site.transport);
  await ecrireParametre(PARAM_COMPTES_ZERNIO, {
    lusLe: "2026-01-01T00:00:00.000Z",
    comptes: [
      { id: FB, reseau: "facebook", nom: "Page fictive" },
      { id: IG, reseau: "instagram", nom: "Insta fictif" },
    ],
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  pm.injecterTransportSite(null);
});

describe("réglage « plusieurs mots » ÉTEINT (défaut) : rien ne change", () => {
  it("un autre mot : plusieurs_mots_eteint, aucune ligne ; l'écran dit la même raison", async () => {
    expect(await G.gesteActiverMot("TOUS1", FB)).toMatchObject({ issue: "refuse", raison: "plusieurs_mots_eteint" });
    expect(await registre()).toEqual({});
    const vue = await lireVueMotsCibles({ lignes: [] });
    expect(vue!.mots.find((m) => m.mot === "TOUS1")!.comptes.find((c) => c.compte === FB)).toMatchObject({ activable: false, raison: "plusieurs_mots_eteint" });
  });
  it("même textes validés : toujours refusé tant que le réglage est éteint ; une ligne en pause ne se réactive pas", async () => {
    await validerTous1();
    expect(await G.gesteActiverMot("TOUS1", FB)).toMatchObject({ issue: "refuse", raison: "plusieurs_mots_eteint" });
    await poserRegistre(ligne("TOUS1", FB, "pause"));
    expect(await G.gesteReactiver("TOUS1", FB)).toMatchObject({ issue: "refuse" });
    expect((await registre())[`TOUS1|${FB}`].etat).toBe("pause");
  });
  it("le réglage illisible vaut éteint (échec fermé)", async () => {
    await validerTous1();
    const lire = vi.spyOn(MM, "motsMultiplesActifs").mockResolvedValue(false);
    expect(await G.gesteActiverMot("TOUS1", FB)).toMatchObject({ raison: "plusieurs_mots_eteint" });
    lire.mockRestore();
  });
});

describe("réglage allumé : activation d'un autre mot par l'écran", () => {
  beforeEach(async () => {
    await allumer(true);
  });
  it("sans textes validés pour ce réseau : refus, aucune ligne ; l'écran dit pourquoi", async () => {
    expect(await G.gesteActiverMot("TOUS1", FB)).toMatchObject({ issue: "refuse", raison: "textes_non_valides_reseau" });
    expect(await registre()).toEqual({});
    const vue = await lireVueMotsCibles({ lignes: [] });
    expect(vue!.mots.find((m) => m.mot === "TOUS1")!.comptes.find((c) => c.compte === FB)).toMatchObject({ activable: false, raison: "textes_non_valides_reseau" });
  });
  it("textes validés Facebook : activé en local (ligne active, idWorkflow nul), rien vers Zernio ; l'écran le dit activable", async () => {
    await validerTous1();
    const vue = await lireVueMotsCibles({ lignes: [] });
    expect(vue!.mots.find((m) => m.mot === "TOUS1")!.comptes.find((c) => c.compte === FB)).toMatchObject({ activable: true, raison: null });
    const r = await G.gesteActiverMot("TOUS1", FB);
    expect(r.issue).toBe("execute");
    expect((await registre())[`TOUS1|${FB}`]).toMatchObject({ mot: "TOUS1", compte: FB, etat: "actif", idWorkflow: null, raison: "local" });
    expect(reseau).not.toHaveBeenCalled();
  });
  it("Instagram : refusé instagram_pas_encore, même textes validés pour Instagram ; aucune ligne ; phrase propre", async () => {
    await validerTous1("instagram").catch(() => undefined);
    expect(await G.gesteActiverMot("TOUS1", IG)).toMatchObject({ issue: "refuse", raison: "instagram_pas_encore" });
    expect(await registre()).toEqual({});
    const vue = await lireVueMotsCibles({ lignes: [] });
    expect(vue!.mots.find((m) => m.mot === "TOUS1")!.comptes.find((c) => c.compte === IG)).toMatchObject({ activable: false, raison: "instagram_pas_encore" });
    expect(phraseRefus("instagram_pas_encore")).toMatch(/Instagram/);
    expect(phraseRefus("instagram_pas_encore")).not.toBe("Demande refusée.");
    expect(phraseRefus("instagram_pas_encore")).not.toMatch(/abonn/i);
  });
  it("cible d'essai : refus cible_test, aucune ligne", async () => {
    await validerTous1();
    const cible = site.cibles.find((c) => c.code === "gde-essai01")!;
    cible.test = true;
    CS.reinitialiserEtatCiblesSite();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3600_000); // la copie du catalogue est périmée : le site est relu
    const r = await G.gesteActiverMot("TOUS1", FB);
    expect(r).toMatchObject({ issue: "refuse", raison: "cible_test" });
    expect(await registre()).toEqual({});
  });
  it("cible désactivée : refus, aucune ligne", async () => {
    await validerTous1();
    site.cibles.find((c) => c.code === "gde-essai01")!.actif = false;
    CS.reinitialiserEtatCiblesSite();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3600_000); // la copie du catalogue est périmée : le site est relu
    const r = await G.gesteActiverMot("TOUS1", FB);
    expect(r.issue).toBe("refuse");
    expect(await registre()).toEqual({});
  });
  it("réactivation après une pause : la ligne locale repasse active, la clé reste, rien vers Zernio", async () => {
    await validerTous1();
    await poserRegistre(ligne("TOUS1", FB, "pause"));
    const r = await G.gesteReactiver("TOUS1", FB);
    expect(r.issue).toBe("execute");
    expect(Object.keys(await registre())).toEqual([`TOUS1|${FB}`]);
    expect((await registre())[`TOUS1|${FB}`]).toMatchObject({ etat: "actif", idWorkflow: null });
    expect(reseau).not.toHaveBeenCalled();
  });
  it("réactivation SANS textes validés (ou cible d'essai) : refus complet, la ligne reste en pause", async () => {
    await poserRegistre(ligne("TOUS1", FB, "pause"));
    expect(await G.gesteReactiver("TOUS1", FB)).toMatchObject({ issue: "refuse", raison: "textes_non_valides_reseau" });
    expect((await registre())[`TOUS1|${FB}`].etat).toBe("pause");
  });
  it("réactivation sur Instagram : refusée instagram_pas_encore, la ligne reste en pause (jamais d'effacement)", async () => {
    await poserRegistre(ligne("TOUS1", IG, "pause"));
    expect(await G.gesteReactiver("TOUS1", IG)).toMatchObject({ issue: "refuse", raison: "instagram_pas_encore" });
    expect((await registre())[`TOUS1|${IG}`].etat).toBe("pause");
  });
  it("une ligne posée chez Zernio garde son chemin habituel (réactivation par Zernio, pas en local)", async () => {
    await poserRegistre(ligne("TOUS1", FB, "pause", "w1"));
    const r = await G.gesteReactiver("TOUS1", FB);
    expect(r.issue === "execute" && !r.idWorkflow).toBe(false); // jamais activée en local
    expect((await registre())[`TOUS1|${FB}`].idWorkflow).toBe("w1");
  });
  it("tout arrêter / disjoncteur : l'activation d'un autre mot reste refusée", async () => {
    await validerTous1();
    await ecrireParametre("zernio.envoi_autorise", false);
    expect((await G.gesteActiverMot("TOUS1", FB)).issue).toBe("refuse");
    expect(await registre()).toEqual({});
  });
});

describe("GUIDE : chemin strictement identique, réglage allumé ou éteint", () => {
  it("la réactivation d'un GUIDE local passe toujours par reactiverMot (garde propre à GUIDE)", async () => {
    for (const v of [false, true]) {
      await allumer(v);
      const spy = vi.spyOn(S, "activerMotParcours");
      await poserRegistre(ligne("GUIDE", FB, "pause"));
      await G.gesteReactiver("GUIDE", FB);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
  it("gesteActiverMot('GUIDE') passe par gesteActiverMotLocal, jamais par le réglage « plusieurs mots »", async () => {
    const lire = vi.spyOn(MM, "motsMultiplesActifs");
    await G.gesteActiverMot("GUIDE", FB);
    expect(lire).not.toHaveBeenCalled();
    lire.mockRestore();
  });
});
