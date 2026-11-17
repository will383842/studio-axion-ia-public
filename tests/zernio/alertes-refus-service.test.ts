/** Service d'alerte « refus d'envoi réglable » : cloche seulement, lecture des conversations seule. Données fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
const panne = { active: false };
vi.mock("@/services/notifications", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/services/notifications")>();
  return { ...reel, creerNotification: (...a: Parameters<typeof reel.creerNotification>) => (panne.active ? Promise.reject(new Error("panne fictive")) : reel.creerNotification(...a)) };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { depots, ecrireParametre, lireParametre } = await import("@/services/_commun");
const S = await import("@/services/alertes-refus-envoi");
const N = await import("@/services/notifications");

const T = Date.parse("2027-03-10T12:00:00Z");
const MIN = 60_000;
const PARAM = "parcours.conversations";
const TITRE = "Parcours des messages privés";

const raison = (motif: string, il = 3600_000) => ({ motif, statut: 400, codeClient: "refuse", meta: null, codeZernio: null, source: "nombres", le: new Date(T - il).toISOString() });
const conv = (o: Record<string, unknown> = {}) => ({ etat: "m1_refuse", reseau: "facebook", idCompte: "cpt-a", mot: "GUIDE", creeLe: new Date(T - 7200_000).toISOString(), refuseLe: new Date(T - 3600_000).toISOString(), refusPrive: raison("droits-manquants"), ...o });
const notifs = () => depots().notifications.lister((n) => n.titre === TITRE);

beforeEach(async () => {
  reinitialiserDepots();
  S.reinitialiserSurveillanceRefusEnvoi();
  panne.active = false;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("surveillerRefusEnvoi", () => {
  it("cloche seulement : aucune file d'envoi, aucun push", async () => {
    await ecrireParametre(PARAM, { "p1|x": conv() });
    expect(await S.surveillerRefusEnvoi({ maintenantMs: T })).toBe(1);
    const l = await notifs();
    expect(l).toHaveLength(1);
    expect(l[0].type).toBe("echec");
    expect(l[0].lien).toBe("/mots");
    expect((l[0] as { envoi?: unknown }).envoi).toBeUndefined();
    const envoyerPush = vi.fn(async () => ({ envoyes: 1, expires: [] as string[] }));
    await N.diffuserNotifications({ push: { publique: "p", privee: "q", sujet: "mailto:x@example.com" }, email: null, envoyerPush, maintenant: () => T });
    expect(envoyerPush).not.toHaveBeenCalled();
  });
  it("le dédoublonnage survit à une remise à zéro de la mémoire (il est en base)", async () => {
    await ecrireParametre(PARAM, { "p1|x": conv() });
    await S.surveillerRefusEnvoi({ maintenantMs: T });
    S.reinitialiserSurveillanceRefusEnvoi();
    expect(await S.surveillerRefusEnvoi({ maintenantMs: T + 20 * MIN })).toBe(0);
    expect(await notifs()).toHaveLength(1);
    const marques = await lireParametre<Record<string, string>>("parcours.alertes_refus", {});
    expect(Object.keys(marques)).toEqual(["refus:droits-manquants:cpt-a"]);
  });
  it("parcours.conversations strictement identique avant et après", async () => {
    await ecrireParametre(PARAM, { "p1|x": conv(), "p2": conv({ etat: "m2_envoye", refusPrive: undefined }) });
    const avant = JSON.stringify(await lireParametre(PARAM, {}));
    await S.surveillerRefusEnvoi({ maintenantMs: T });
    expect(JSON.stringify(await lireParametre(PARAM, {}))).toBe(avant);
  });
  it("fréquence : au plus une fois toutes les 10 minutes", async () => {
    await ecrireParametre(PARAM, { "p1|x": conv() });
    expect(await S.surveillerRefusEnvoi({ maintenantMs: T })).toBe(1);
    await ecrireParametre(PARAM, { "p1|x": conv(), "p2|y": conv({ idCompte: "cpt-i", reseau: "instagram", refusPrive: raison("jeton-expire-ou-invalide") }) });
    expect(await S.surveillerRefusEnvoi({ maintenantMs: T + 5 * MIN })).toBe(0);
    expect(await S.surveillerRefusEnvoi({ maintenantMs: T + 11 * MIN })).toBe(1);
  });
  it("une panne de creerNotification ne fait pas échouer l'appel, et l'alerte n'est pas marquée", async () => {
    await ecrireParametre(PARAM, { "p1|x": conv() });
    panne.active = true;
    await expect(S.surveillerRefusEnvoi({ maintenantMs: T })).resolves.toBe(0);
    expect(await lireParametre("parcours.alertes_refus", {})).toEqual({});
    panne.active = false;
    expect(await S.surveillerRefusEnvoi({ maintenantMs: T + 11 * MIN })).toBe(1);
  });
  it("un refusPrive invalide est ignoré", async () => {
    await ecrireParametre(PARAM, {
      "p1|x": conv({ refusPrive: { motif: "inventé", statut: 400, le: new Date(T - 1000).toISOString() } }),
      "p2|x": conv({ refusPrive: "texte libre" }),
      "p3|x": conv({ refusPrive: { ...raison("droits-manquants"), pseudo: "x" } }),
    });
    expect(await S.surveillerRefusEnvoi({ maintenantMs: T })).toBe(0);
    expect(await notifs()).toHaveLength(0);
  });
  it("ignore une conversation qui n'est pas refusée", async () => {
    await ecrireParametre(PARAM, { "p1|x": conv({ etat: "m2_envoye" }) });
    expect(await S.surveillerRefusEnvoi({ maintenantMs: T })).toBe(0);
  });
});
