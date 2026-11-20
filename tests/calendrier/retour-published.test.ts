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

const { injecterClientZernio, synchroniserEtatsZernio } = await import("@/services/zernio");
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

async function programmationManuelle(marque: string = "programme") {
  const d = depots();
  await d.visuels.enregistrer({ id: "vis_1", famille: "carrousel", titre: "Cinq erreurs", entree: { type: "sujet", sujet: "exemple" }, statut: "programme", modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: iso(T0), modifieLe: iso(T0), spec: { alt: "Cinq erreurs courantes à éviter" } } as never);
  await d.creneauxEditoriaux.enregistrer({
    id: "cre_1", jourVise: "2026-11-12", heuresParReseau: { instagram: DATE }, compteCible: `${COMPTE}:ig:1`, visuelId: "vis_1",
    textes: { instagram: { texte: "Texte instagram", premierCommentaire: "" } }, statut: "programme", decalages: 0, valideeLe: iso(T0), valideePar: "le fondateur",
  } as never);
  await d.envoisPlanifies.enregistrer({
    id: CLE_ENVOI, cle: CLE_ENVOI, videoId: "vis_1", nature: "visuel", creneauId: "cre_1", cleDiffuseur: CLE_DIFFUSEUR, reseau: "instagram", versionCreneau: 0,
    jour: "2026-11-12", heure: "09:00", statut: "programme", valideeLe: iso(T0), valideePar: "fondateur", creeLe: iso(T0), modifieLe: iso(T0),
  } as never);
  // La ligne du Studio créée par la programmation manuelle : « manuel », sans idExterne (jamais relue par la synchro).
  await d.publications.enregistrer({ id: `pub_${CLE_ENVOI}`, visuelId: "vis_1", reseau: "instagram", statut: "programmee", via: "manuel", date: DATE, texte: "Texte instagram", creeLe: iso(T0), modifieLe: iso(T0) } as never);
  // La ligne zernio créée à l'envoi : c'est elle que la synchro relit.
  await d.publications.enregistrer({ id: "pz_1", visuelId: "vis_1", reseau: "instagram", statut: "programmee", via: "zernio", date: DATE, texte: "Texte instagram", idExterne: "exemple-post-1", canalId: `${COMPTE}:ig:1`, cleEnvoi: CLE_DIFFUSEUR, etatEnvoi: "envoye", envoiCommenceLe: iso(T0 - 3600_000), creeLe: iso(T0), modifieLe: iso(T0) } as never);
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
