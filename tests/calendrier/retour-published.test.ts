/**
 * RETOUR-PUBLISHED · quand Zernio CONFIRME « published », le Studio suit : créneau « publie », envoi planifié « envoye »,
 * Publication `pub_<clé>` « publiee », marque `promotion:<clé>` levée vers « parti ».
 * Un échec ou un statut ambigu ne lève rien (la marque reste « à vérifier », jamais « annulé » : CAL-23). Un 2e passage ne change rien.
 * Faux client uniquement : aucun appel réel, données fictives.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const MDP = "essai-retour-published-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio, PREFIXE_MARQUES_CALENDRIER } = await import("@/services/zernio");
const { creerFauxClientZernio, postExemple } = await import("../zernio/aides/faux-zernio");
type AppelEnregistre = import("../zernio/aides/faux-zernio").AppelEnregistre;

const T0 = Date.parse("2026-11-11T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const COMPTE = "exemple-compte-1";
const CLE_ENVOI = "envoi:vis_1:instagram:v0";
const CLE_DIFFUSEUR = "b".repeat(64);
const DATE = "2026-11-12T08:00:00.000Z";
const PREFIXE = "envoi-calendrier:";

type Issue = "published" | "failed" | "partial" | "introuvable" | "scheduled";

function diffuseur(issue: Issue) {
  const appels: AppelEnregistre[] = [];
  const { client } = creerFauxClientZernio((a) => {
    appels.push(a);
    const u = new URL(a.url);
    if (a.methode === "GET" && u.pathname.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: COMPTE, platform: "instagram", isActive: true }] } };
    if (a.methode === "GET" && /\/v1\/posts\/exemple-post-1$/.test(u.pathname)) {
      if (issue === "introuvable") return { statut: 404, corps: { error: "introuvable" } };
      const pf = issue === "published" ? { status: "published", platformPostUrl: "https://exemple.invalid/p/1" } : issue === "failed" ? { status: "failed", errorMessage: "Refus simulé du réseau" } : { status: "pending" };
      const global = issue === "published" ? "published" : issue === "failed" ? "failed" : issue === "partial" ? "partial" : "scheduled";
      return { statut: 200, corps: { post: postExemple({ _id: "exemple-post-1", status: global, platforms: [{ platform: "instagram", accountId: COMPTE, ...pf }] }) } };
    }
    return { statut: 500, corps: { error: "appel inattendu" } };
  });
  return { client, appels };
}

async function programmationManuelle(marque: string = "programme", opts: { envoi?: string; sansCleDiffuseur?: boolean; pubZernio?: string } = {}) {
  const d = depots();
  await d.visuels.enregistrer({ id: "vis_1", famille: "carrousel", titre: "Cinq erreurs", entree: { type: "sujet", sujet: "exemple" }, statut: "programme", modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: iso(T0), modifieLe: iso(T0), spec: { alt: "Cinq erreurs courantes à éviter" } } as never);
  await d.creneauxEditoriaux.enregistrer({
    id: "cre_1", jourVise: "2026-11-12", heuresParReseau: { instagram: DATE }, compteCible: `${COMPTE}:ig:1`, visuelId: "vis_1",
    textes: { instagram: { texte: "Texte instagram", premierCommentaire: "" } }, statut: "programme", decalages: 0, valideeLe: iso(T0), valideePar: "le fondateur",
  } as never);
  await d.envoisPlanifies.enregistrer({
    id: CLE_ENVOI, cle: CLE_ENVOI, videoId: "vis_1", nature: "visuel", creneauId: "cre_1", ...(opts.sansCleDiffuseur ? {} : { cleDiffuseur: CLE_DIFFUSEUR }), reseau: "instagram", versionCreneau: 0,
    jour: "2026-11-12", heure: "09:00", statut: opts.envoi ?? "programme", valideeLe: iso(T0), valideePar: "fondateur", creeLe: iso(T0), modifieLe: iso(T0),
  } as never);
  // La ligne du Studio créée par la programmation manuelle : « manuel », sans idExterne (jamais relue par la synchro).
  await d.publications.enregistrer({ id: `pub_${CLE_ENVOI}`, visuelId: "vis_1", reseau: "instagram", statut: "programmee", via: "manuel", date: DATE, texte: "Texte instagram", creeLe: iso(T0), modifieLe: iso(T0) } as never);
  // La ligne zernio créée à l'envoi : c'est elle que la synchro relit.
  await d.publications.enregistrer({ id: "pz_1", visuelId: "vis_1", reseau: "instagram", statut: (opts.pubZernio ?? "programmee"), via: "zernio", date: DATE, texte: "Texte instagram", ...(opts.pubZernio ? { urlPubliee: "https://exemple.invalid/p/1" } : {}), idExterne: "exemple-post-1", canalId: `${COMPTE}:ig:1`, cleEnvoi: opts.sansCleDiffuseur ? CLE_ENVOI : CLE_DIFFUSEUR, etatEnvoi: "envoye", envoiCommenceLe: iso(T0 - 3600_000), creeLe: iso(T0), modifieLe: iso(T0) } as never);
  await ecrireParametre(`${PREFIXE}promotion:${CLE_ENVOI}`, marque);
  if (marque === "a-verifier") await ecrireParametre(`${PREFIXE}a-verifier:${CLE_ENVOI}`, "a-verifier");
}

const marque = (k: string) => lireParametre<unknown>(`${PREFIXE}${k}:${CLE_ENVOI}`, undefined);
const etat = async () => ({
  creneau: (await depots().creneauxEditoriaux.obtenir("cre_1"))?.statut,
  envoi: (await depots().envoisPlanifies.obtenir(CLE_ENVOI))?.statut,
  pub: (await depots().publications.obtenir(`pub_${CLE_ENVOI}`))?.statut,
  promotion: await marque("promotion"),
  verifier: await marque("a-verifier"),
});

async function passer(issue: Issue, n = 1) {
  const { client, appels } = diffuseur(issue);
  injecterClientZernio(client);
  for (let i = 0; i < n; i++) await synchroniserEtatsZernio({ force: true, instant: T0 + i * 60_000 });
  return appels;
}

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
});

describe("RETOUR-PUBLISHED · published confirmé", () => {
  it("créneau publie, envoi envoye, pub_<clé> publiee, marque levée vers « parti » ; aucune écriture chez le diffuseur", async () => {
    await programmationManuelle("programme");
    const appels = await passer("published");
    expect(await etat()).toEqual({ creneau: "publie", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: undefined });
    expect((await depots().envoisPlanifies.obtenir(CLE_ENVOI))?.envoyeLe).toBeTruthy();
    expect(appels.filter((a) => a.methode !== "GET")).toHaveLength(0);
  });

  it("une marque « a-verifier » (et son état a-verifier:<clé>) est levée vers « parti » sur un published confirmé", async () => {
    await programmationManuelle("a-verifier");
    await passer("published");
    expect(await etat()).toEqual({ creneau: "publie", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: "parti" });
  });

  it("un deuxième passage ne change rien (idempotent)", async () => {
    await programmationManuelle("programme");
    await passer("published");
    const avant = { ...(await etat()), env: await depots().envoisPlanifies.obtenir(CLE_ENVOI), cre: await depots().creneauxEditoriaux.obtenir("cre_1"), pub: await depots().publications.obtenir(`pub_${CLE_ENVOI}`) };
    await passer("published", 2);
    expect({ ...(await etat()), env: await depots().envoisPlanifies.obtenir(CLE_ENVOI), cre: await depots().creneauxEditoriaux.obtenir("cre_1"), pub: await depots().publications.obtenir(`pub_${CLE_ENVOI}`) }).toEqual(avant);
  });
});

describe("RETOUR-PUBLISHED · échec ou ambigu : rien n'est levé (CAL-23)", () => {
  it.each(["failed", "partial", "introuvable", "scheduled"] as const)("%s : créneau, envoi, pub_<clé> et marque « a-verifier » restent tels quels, jamais « annule »", async (issue) => {
    await programmationManuelle("a-verifier");
    await passer(issue);
    expect(await etat()).toEqual({ creneau: "programme", envoi: "programme", pub: "programmee", promotion: "a-verifier", verifier: "a-verifier" });
  });
});

describe("RETOUR-PUBLISHED · marques levées seulement si l'envoi est « envoye »", () => {
  it.each(["annule", "confirme"] as const)("envoi « %s » : marques et envoi restent tels quels", async (statutEnvoi) => {
    await programmationManuelle("a-verifier", { envoi: statutEnvoi });
    await passer("published");
    const e = await etat();
    expect(e.envoi).toBe(statutEnvoi);
    expect(e.promotion).toBe("a-verifier");
    expect(e.verifier).toBe("a-verifier");
    expect(e.pub).toBe("programmee");
    expect(e.creneau).toBe("programme");
  });

  it("envoi sans cleDiffuseur : la jointure se fait sur la clé de l'envoi", async () => {
    await programmationManuelle("programme", { sansCleDiffuseur: true });
    await passer("published");
    expect(await etat()).toEqual({ creneau: "publie", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: undefined });
  });

  it("sans créneau ni pub_<clé> : l'envoi passe envoye, rien ne plante", async () => {
    await programmationManuelle("programme");
    await depots().creneauxEditoriaux.supprimer("cre_1");
    await depots().publications.supprimer(`pub_${CLE_ENVOI}`);
    await passer("published");
    expect((await etat()).envoi).toBe("envoye");
    expect((await etat()).promotion).toBe("parti");
  });

  it("la garde du créneau voit « parti » après le passage", async () => {
    const { niveauDiffuseurDuCreneau } = await import("@/services/garde-creneau-diffuseur");
    await programmationManuelle("programme");
    expect((await niveauDiffuseurDuCreneau("cre_1")).niveau).toBe("programme");
    await passer("published");
    expect((await niveauDiffuseurDuCreneau("cre_1")).niveau).toBe("parti");
  });

  it("le préfixe des marques est celui du calendrier", async () => {
    const { PREFIXE_ETATS_ENVOI_CALENDRIER } = await import("@/services/branchement-envoi-calendrier");
    expect(PREFIXE_MARQUES_CALENDRIER).toBe(PREFIXE_ETATS_ENVOI_CALENDRIER);
    expect(PREFIXE).toBe(PREFIXE_ETATS_ENVOI_CALENDRIER);
  }, 60_000);
});

describe("RETOUR-PUBLISHED · reprise après un passage interrompu", () => {
  it("Publication zernio déjà publiee, envoi resté programme : le passage suivant termine le suivi, puis ne change plus rien", async () => {
    await programmationManuelle("programme", { pubZernio: "publiee" });
    await passer("scheduled");
    expect(await etat()).toEqual({ creneau: "publie", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: undefined });
    const avant = [await depots().envoisPlanifies.obtenir(CLE_ENVOI), await depots().creneauxEditoriaux.obtenir("cre_1"), await depots().publications.obtenir(`pub_${CLE_ENVOI}`)];
    await passer("scheduled", 2);
    expect([await depots().envoisPlanifies.obtenir(CLE_ENVOI), await depots().creneauxEditoriaux.obtenir("cre_1"), await depots().publications.obtenir(`pub_${CLE_ENVOI}`)]).toEqual(avant);
  });
});

describe("RETOUR-PUBLISHED · créneau à plusieurs réseaux", () => {
  it("un seul réseau parti : le créneau reste « programme » (statut final), l'envoi et sa pub_<clé> suivent", async () => {
    await programmationManuelle("programme");
    await depots().envoisPlanifies.enregistrer({
      id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", videoId: "vis_1", nature: "visuel", creneauId: "cre_1", cleDiffuseur: "c".repeat(64), reseau: "facebook", versionCreneau: 0,
      jour: "2026-11-12", heure: "09:00", statut: "programme", valideeLe: iso(T0), valideePar: "fondateur", creeLe: iso(T0), modifieLe: iso(T0),
    } as never);
    await passer("published");
    expect(await etat()).toEqual({ creneau: "programme", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: undefined });
    expect((await depots().envoisPlanifies.obtenir("envoi:vis_1:facebook:v0"))?.statut).toBe("programme");
  });
});

describe("RETOUR-PUBLISHED · la reprise ne touche pas un envoi hors « programme »", () => {
  it.each(["confirme", "annule"] as const)("Publication publiee + envoi « %s » : rien ne change", async (statutEnvoi) => {
    await programmationManuelle("a-verifier", { envoi: statutEnvoi, pubZernio: "publiee" });
    await passer("scheduled");
    expect(await etat()).toEqual({ creneau: "programme", envoi: statutEnvoi, pub: "programmee", promotion: "a-verifier", verifier: "a-verifier" });
  });
});

describe("RETOUR-PUBLISHED · créneau à plusieurs réseaux (suite)", () => {
  const facebook = (statut: string) => ({
    id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", videoId: "vis_1", nature: "visuel", creneauId: "cre_1", cleDiffuseur: "c".repeat(64), reseau: "facebook", versionCreneau: 0,
    jour: "2026-11-12", heure: "09:00", statut, valideeLe: iso(T0), valideePar: "fondateur", creeLe: iso(T0), modifieLe: iso(T0),
  });
  it("l'autre réseau annulé : le créneau passe publie", async () => {
    await programmationManuelle("programme");
    await depots().envoisPlanifies.enregistrer(facebook("annule") as never);
    await passer("published");
    expect((await etat()).creneau).toBe("publie");
  });
  it("l'autre réseau déjà envoye (dernier published) : le créneau passe publie", async () => {
    await programmationManuelle("programme");
    await depots().envoisPlanifies.enregistrer(facebook("envoye") as never);
    await passer("published");
    expect((await etat()).creneau).toBe("publie");
  });
  it("un envoi d'une version périmée du créneau (décalé) ne fait pas publier la version courante", async () => {
    await programmationManuelle("programme");
    await depots().creneauxEditoriaux.modifier("cre_1", { decalages: 1 } as never);
    await passer("published");
    expect((await etat()).creneau).toBe("programme");
  });
});

describe("RETOUR-PUBLISHED · reprise après « envoye » (coupure entre deux écritures)", () => {
  it("envoi déjà envoye mais créneau, pub_<clé> et marque pas à jour : le passage suivant termine le suivi", async () => {
    await programmationManuelle("programme", { envoi: "envoye", pubZernio: "publiee" });
    await passer("scheduled");
    expect(await etat()).toEqual({ creneau: "publie", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: undefined });
  });
});

describe("RETOUR-PUBLISHED · réseau prévu sans envoi, reprise non saturée", () => {
  const envoiDe = (reseau: string, statut: string, n = reseau) => ({
    id: `envoi:vis_1:${n}:v0`, cle: `envoi:vis_1:${n}:v0`, videoId: "vis_1", nature: "visuel", creneauId: "cre_1", cleDiffuseur: n.padEnd(64, "d"), reseau, versionCreneau: 0,
    jour: "2026-11-12", heure: "09:00", statut, valideeLe: iso(T0), valideePar: "fondateur", creeLe: iso(T0), modifieLe: iso(T0),
  });
  it("créneau à deux réseaux dont l'un n'a aucun envoi : le créneau reste « programme »", async () => {
    await programmationManuelle("programme");
    await depots().creneauxEditoriaux.modifier("cre_1", { heuresParReseau: { instagram: DATE, linkedin: DATE } } as never);
    await passer("published");
    expect(await etat()).toEqual({ creneau: "programme", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: undefined });
  });
  it("le réseau sans envoi reçoit ensuite son envoi, lui aussi parti : le créneau passe « publie »", async () => {
    await programmationManuelle("programme");
    await depots().creneauxEditoriaux.modifier("cre_1", { heuresParReseau: { instagram: DATE, linkedin: DATE } } as never);
    await depots().envoisPlanifies.enregistrer(envoiDe("linkedin", "envoye") as never);
    await passer("published");
    expect((await etat()).creneau).toBe("publie");
  });
  it("21 envois « envoye » bloqués par un frère en échec + 1 coupure récente : la coupure est rattrapée", async () => {
    const d = depots();
    for (let i = 0; i < 21; i++) {
      const id = `cre_b${i}`, cle = `envoi:vis_1:instagram:b${i}`;
      await d.creneauxEditoriaux.enregistrer({ id, jourVise: "2026-11-12", heuresParReseau: { instagram: DATE, facebook: DATE }, compteCible: `${COMPTE}:ig:1`, visuelId: "vis_1", textes: {}, statut: "programme", decalages: 0, valideeLe: iso(T0), valideePar: "le fondateur" } as never);
      await d.envoisPlanifies.enregistrer({ ...envoiDe("instagram", "envoye", `b${i}`), id: cle, cle, creneauId: id } as never);
      await d.envoisPlanifies.enregistrer({ ...envoiDe("facebook", "echec", `f${i}`), id: `envoi:vis_1:facebook:b${i}`, cle: `envoi:vis_1:facebook:b${i}`, creneauId: id } as never);
      await d.publications.enregistrer({ id: `pz_b${i}`, visuelId: "vis_1", reseau: "instagram", statut: "publiee", via: "zernio", date: DATE, texte: "t", idExterne: `exemple-b${i}`, canalId: `${COMPTE}:ig:1`, cleEnvoi: `b${i}`.padEnd(64, "d"), etatLuLe: iso(T0 - 86_400_000), creeLe: iso(T0), modifieLe: iso(T0) } as never);
    }
    await programmationManuelle("programme", { envoi: "envoye", pubZernio: "publiee" });
    await d.publications.modifier("pz_1", { etatLuLe: iso(T0) } as never);
    await passer("scheduled");
    expect(await etat()).toEqual({ creneau: "publie", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: undefined });
  });
});

describe("RETOUR-PUBLISHED-2 · REC-V1 : envoi resté « valide » avec la marque à vérifier, constaté par le diffuseur", () => {
  const PARTI = { creneau: "publie", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: undefined } as const;
  it("REC-V1 (marque promotion seule + Publication zernio publiee) : le suivi du passage fait passer le créneau « publie »", async () => {
    await programmationManuelle("programme", { envoi: "valide" });
    await ecrireParametre(`${PREFIXE}promotion:${CLE_ENVOI}`, "a-verifier");
    const appels = await passer("published");
    expect(await etat()).toEqual(PARTI);
    expect((await depots().envoisPlanifies.obtenir(CLE_ENVOI))?.envoyeLe).toBeTruthy();
    expect(appels.filter((a) => a.methode !== "GET")).toHaveLength(0);
  });
  it("marque a-verifier:<clé> seule : même résultat", async () => {
    await programmationManuelle("programme", { envoi: "valide" });
    await ecrireParametre(`${PREFIXE}promotion:${CLE_ENVOI}`, "libre");
    await ecrireParametre(`${PREFIXE}a-verifier:${CLE_ENVOI}`, "a-verifier");
    await passer("published");
    expect((await etat()).envoi).toBe("envoye");
    expect((await etat()).creneau).toBe("publie");
  });
  it.each(["libre", "en-cours", "programme", "parti", undefined] as const)("valide SANS marque à vérifier (promotion = %s) : rien ne bouge, même sur published", async (m) => {
    await programmationManuelle("programme", { envoi: "valide" });
    if (m) await ecrireParametre(`${PREFIXE}promotion:${CLE_ENVOI}`, m);
    else await depots().parametres.supprimer(`${PREFIXE}promotion:${CLE_ENVOI}`);
    await passer("published");
    expect((await etat()).envoi).toBe("valide");
    expect((await etat()).creneau).toBe("programme");
    expect((await etat()).pub).toBe("programmee");
  });
  it.each(["failed", "partial", "introuvable", "scheduled"] as const)("valide + marque mais post %s : rien ne bouge, jamais « annule »", async (issue) => {
    await programmationManuelle("a-verifier", { envoi: "valide" });
    await passer(issue);
    expect(await etat()).toEqual({ creneau: "programme", envoi: "valide", pub: "programmee", promotion: "a-verifier", verifier: "a-verifier" });
  });
  it("valide + marque, Publication zernio d'une AUTRE clé publiee : rien ne bouge", async () => {
    await programmationManuelle("a-verifier", { envoi: "valide" });
    await depots().publications.modifier("pz_1", { cleEnvoi: "e".repeat(64) } as never);
    await passer("scheduled");
    expect((await etat()).envoi).toBe("valide");
  });
  it("reprise après coupure : Publication zernio déjà publiee, envoi valide + marque : le passage suivant termine le suivi", async () => {
    await programmationManuelle("a-verifier", { envoi: "valide", pubZernio: "publiee" });
    await passer("scheduled");
    expect(await etat()).toEqual({ creneau: "publie", envoi: "envoye", pub: "publiee", promotion: "parti", verifier: "parti" });
  });
  it("reprise : valide + marque mais Publication zernio seulement programmee : rien ne bouge", async () => {
    await programmationManuelle("a-verifier", { envoi: "valide" });
    await passer("scheduled", 2);
    expect(await etat()).toEqual({ creneau: "programme", envoi: "valide", pub: "programmee", promotion: "a-verifier", verifier: "a-verifier" });
  });
  it("2e passage idempotent", async () => {
    await programmationManuelle("a-verifier", { envoi: "valide" });
    await passer("published");
    const lire = async () => [await depots().envoisPlanifies.obtenir(CLE_ENVOI), await depots().creneauxEditoriaux.obtenir("cre_1"), await depots().publications.obtenir(`pub_${CLE_ENVOI}`), await marque("promotion"), await marque("a-verifier")];
    const avant = await lire();
    await passer("published", 2);
    expect(await lire()).toEqual(avant);
  });
  it("la transition valide → envoye reste fermée pour tout autre appelant", async () => {
    const { peutTransiter } = await import("@/domaine/envoi-planifie");
    const { transiterEnvoi } = await import("@/services/envois-planifies");
    expect(peutTransiter("valide", "envoye")).toBe(false);
    await programmationManuelle("a-verifier", { envoi: "valide" });
    await expect(transiterEnvoi(depots().envoisPlanifies, CLE_ENVOI, "envoye", iso(T0))).rejects.toThrow();
  });
});
