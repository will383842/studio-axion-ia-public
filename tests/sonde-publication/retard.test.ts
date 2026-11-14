/** L5-07 · sonde de publication : horloge simulée, aucun appel réel, aucun envoi. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { depots, ecrireParametre } = await import("@/services/_commun");
const S = await import("@/services/sonde-publication");
const I = await import("@/services/publication-editoriale-interrupteurs");
const R = await import("@/domaine/interrupteurs/registre");
const { etatSante } = await import("@/services/sante");
const { instantParis } = await import("@/lib/horloge-paris");

const JOUR = "2027-03-10";
const HEURE = "10:00";
const H = Date.parse(instantParis(JOUR, HEURE));
const MIN = 60_000;

async function poser(statut: "brouillon" | "valide" | "programme" | "envoye" = "programme", cle = "envoi:v1:instagram:v1") {
  const m = new Date(0).toISOString();
  await depots().envoisPlanifies.enregistrer({ id: cle, cle, videoId: "v1", reseau: "instagram", versionCreneau: 1, jour: JOUR, heure: HEURE, statut, creeLe: m, modifieLe: m } as never);
}
const alertes = () => depots().notifications.lister((n) => n.titre === S.TEXTE_SONDE_PUBLICATION.titre);
const ouvrir = () => ecrireParametre(R.CLE_ENVOI_AUTOMATIQUE, true);

beforeEach(() => reinitialiserDepots());

describe("L5-07 · sonde de publication", () => {
  it("seuil de 20 minutes", () => expect(S.SEUIL_RETARD_PUBLICATION_MS).toBe(20 * MIN));
  it("pur : échue depuis moins de 20 min = rien ; 20 min ou plus = à vérifier ; déjà envoyée = rien", () => {
    const e = (statut: string) => ({ cle: "c", jour: JOUR, heure: HEURE, statut }) as never;
    expect(S.envoisEnRetard([e("programme")], H + 19 * MIN)).toHaveLength(0);
    expect(S.envoisEnRetard([e("programme")], H + 20 * MIN)).toHaveLength(1);
    expect(S.envoisEnRetard([e("envoye"), e("annule"), e("echec")], H + 90 * MIN)).toHaveLength(0);
  });
  it("arrêt d'urgence (envoi automatique éteint, défaut) : aucune alerte, rien d'écrit, aucun envoi", async () => {
    await poser();
    const r = await S.sonderPublication({ maintenant: () => H + 30 * MIN });
    expect(r).toMatchObject({ etat: "arret", alertes: 0 });
    expect(await alertes()).toHaveLength(0);
  });
  it("échue depuis 20 min : à vérifier + UNE seule alerte, même si la sonde repasse", async () => {
    await ouvrir();
    await poser();
    expect((await S.sonderPublication({ maintenant: () => H + 10 * MIN })).etat).toBe("ok");
    expect(await S.sonderPublication({ maintenant: () => H + 20 * MIN })).toMatchObject({ etat: "a-verifier", retards: 1, alertes: 1 });
    expect(await S.sonderPublication({ maintenant: () => H + 25 * MIN })).toMatchObject({ etat: "a-verifier", alertes: 0 });
    expect(await S.sonderPublication({ maintenant: () => H + 40 * MIN })).toMatchObject({ alertes: 0 });
    expect(await alertes()).toHaveLength(1);
  });
  it("une erreur de lecture ne casse rien : état inconnu, aucune alerte", async () => {
    const r = await S.sonderPublication({ maintenant: () => H, autorisee: async () => { throw new Error("x"); } });
    expect(r).toMatchObject({ etat: "inconnu", alertes: 0 });
  });
  it("/api/sante reste à 200 si la lecture de la sonde est lente ou en échec (la sonde n'agit pas sur le statut)", async () => {
    const lent = new Promise<never>(() => undefined);
    const etat = await etatSante(50, { sonde: () => lent });
    expect(etat.ok).toBe(true);
    expect(etat.publication).toBe("inconnu");
    const casse = await etatSante(50, { sonde: async () => { throw new Error("x"); } });
    expect(casse.ok).toBe(true);
  });
});

describe("L5-07 · interrupteurs en clair", () => {
  it("par défaut : envoi automatique éteint ; premier commentaire allumé (il part comme aujourd'hui) ; réglage coupé faux/absent", async () => {
    const e = await I.lireInterrupteursPublication();
    expect(e.find((x) => x.id === "envoi-automatique")?.allume).toBe(false);
    expect(e.find((x) => x.id === "premier-commentaire")?.allume).toBe(true);
    expect(e.every((x) => x.phrase.length > 10 && !/publication\.|zernio|_|booléen/i.test(x.phrase))).toBe(true);
  });
  it("sens inverse : éteindre « Premier commentaire » écrit premier_commentaire_coupe = true ; le rallumer l'écrit à false", () => {
    const def = R.INTERRUPTEURS_PUBLICATION.find((i) => i.id === "premier-commentaire")!;
    expect(R.valeurReglage(def, false)).toBe(true);
    expect(R.valeurReglage(def, true)).toBe(false);
    for (const v of [undefined, null, false, "true", 1]) expect(R.interrupteurAllume(def, v)).toBe(true);
    expect(R.interrupteurAllume(def, true)).toBe(false);
  });
  it("seul le booléen exact true allume l'envoi automatique", () => {
    const def = R.INTERRUPTEURS_PUBLICATION.find((i) => i.id === "envoi-automatique")!;
    for (const v of [undefined, null, false, "true", 1]) expect(R.interrupteurAllume(def, v)).toBe(false);
    expect(R.interrupteurAllume(def, true)).toBe(true);
  });
});
