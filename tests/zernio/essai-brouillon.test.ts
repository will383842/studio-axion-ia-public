/**
 * PR-B · ESSAI BORNÉ : UN créneau, UN compte, UN brouillon (jamais de promotion), 24 h au plus.
 * Dépôts en mémoire, faux client du diffuseur (aucun appel réel), horloge `Date` simulée, données fictives.
 * Le réglage `zernio.essai_brouillon` est lu fermé par défaut ; les trois réglages généraux ne sont JAMAIS ouverts ni simulés.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, Redirection, reinitialiserRequete } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import type { PostZernio } from "@/fournisseurs/publication/zernio-client";
import { cleEnvoi } from "@/domaine/envoi-planifie";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

const session = vi.hoisted(() => ({ active: true }));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", async (orig) => {
  const m = await orig<typeof import("@/services/auth")>();
  return { ...m, exigerSession: async () => { if (!session.active) throw new Redirection("/connexion"); return { id: "s1" } as never; } };
});
const espionPromotion = vi.hoisted(() => ({ appels: 0 }));
vi.mock("@/services/promotion-envois", async (orig) => {
  const m = await orig<typeof import("@/services/promotion-envois")>();
  return { ...m, promouvoirEnvoisPlanifies: (...a: Parameters<typeof m.promouvoirEnvoisPlanifies>) => { espionPromotion.appels++; return m.promouvoirEnvoisPlanifies(...a); } };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const zernio = await import("@/services/zernio");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO, injecterClientZernio, publicationEditorialeAutorisee } = zernio;
const essai = await import("@/services/essai-zernio");
const { PARAM_ESSAI_BROUILLON, lireEssai, essaiCouvre, dansEssai, essaiEnCours, porteCalendrierPour, porteClientEssai, verifierCorpsSousEssai, DUREE_MAX_ESSAI_MS, FENETRE_NETTOYAGE_MS } = essai;
const { tourEnvoisCalendrierServeur, reinitialiserTourEnvoisCalendrier } = await import("@/services/branchement-envoi-calendrier");
const { envoyerVisuelDuCreneau } = await import("@/services/envoi-visuel-creneau");
const { retirerProgrammationServeur, annulerRetraitServeur } = await import("@/services/retirer-programmation");
const { depsDeplacementServeur, deplacerProgrammation } = await import("@/services/deplacer-programmation");
const actions = await import("@/app/(studio)/reglages/actions-zernio");
const { raisonNonEligible } = essai;
const { programmerEnUnClic } = await import("@/components/visuels/BoutonProgrammerVisuel");
const { cleJour } = await import("@/lib/dates");

const MIN = 60_000;
const H = 60 * MIN;
const JOUR = 24 * H;
const RACINE = join(__dirname, "..", "..");
const source = (p: string): string => readFileSync(join(RACINE, p), "utf8");
const iso = (t: number): string => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
const T0 = Math.floor(Date.now() / MIN) * MIN;
const COMPTES = { a: "compte-1:li:42", b: "compte-3:li:77" } as const;
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;

const ESSAI = { version: 1, creneauId: "cA", compte: COMPTES.a, reseau: "linkedin", poseLe: iso(T0 - H), expireLe: iso(T0 + 3 * H) };

let appelsFournisseur: DemandePublication[];
let posts: Map<string, PostZernio>;
let faux: ReturnType<typeof creerFauxClientZernio>["faux"];
let clientBrut: ReturnType<typeof creerFauxClientZernio>["client"];
let methodesClient: string[];
let notifications: unknown[];

function fauxFournisseur(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [
      { id: COMPTES.a, organisationId: "zernio", nom: "Page A", service: "linkedin", genre: "page" },
      { id: COMPTES.b, organisationId: "zernio", nom: "Page B", service: "linkedin", genre: "page" },
    ],
    envoyer: async (d: DemandePublication) => {
      appelsFournisseur.push(d);
      posts.set(`post-${appelsFournisseur.length}`, postExemple({ _id: `post-${appelsFournisseur.length}`, status: "draft", metadata: { origine: "studio", studioCle: d.cleEnvoi } }));
      return { idExterne: `ext-${appelsFournisseur.length}`, via: "zernio", statut: "brouillon" };
    },
  } as unknown as FournisseurPublication;
}

function monterClient(): void {
  posts = new Map();
  methodesClient = [];
  const reponse = (a: AppelEnregistre): ReponsePreparee => {
    const chemin = new URL(a.url).pathname.replace(/^\/api/, "");
    if (a.methode === "GET" && chemin === "/v1/posts") {
      const statut = new URL(a.url).searchParams.get("status");
      return { statut: 200, corps: { posts: [...posts.values()].filter((p) => !statut || p.status === statut) } };
    }
    const id = chemin.split("/").pop() as string;
    const p = posts.get(id);
    if (!p) return { statut: 404, corps: { error: "introuvable" } };
    if (a.methode === "DELETE") { posts.delete(id); return { statut: 200, corps: {} }; }
    if (a.methode === "PUT") { posts.set(id, { ...p, status: "scheduled" }); return { statut: 200, corps: { post: posts.get(id) } }; }
    return { statut: 200, corps: { post: p } };
  };
  const c = creerFauxClientZernio(reponse);
  faux = c.faux;
  clientBrut = c.client;
  c.horloge.avancer(T0 - c.horloge.maintenant());
  injecterClientZernio(
    new Proxy(clientBrut, { get: (cible, nom: string) => (typeof (cible as never)[nom] === "function" ? (...a: unknown[]) => { methodesClient.push(nom); return ((cible as never)[nom] as (...x: unknown[]) => unknown)(...a); } : (cible as never)[nom]) }),
  );
}

async function creerVisuel(id = "vis_1", p: Record<string, unknown> = {}): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id, famille: "carrousel", titre: "Cinq erreurs courantes", entree: { type: "sujet", sujet: "exemple" }, statut: "valide",
    modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le, spec: { alt: "Cinq erreurs courantes à éviter" },
    rendu: { empreinte: "e1", pdfCle: `visuels/${id}/carrousel.pdf`, vignetteCle: `visuels/${id}/v.png`, pages: [1, 2, 3].map((i) => ({ index: i, x1Cle: `visuels/${id}/p${i}.png`, x2Cle: `visuels/${id}/p${i}@2x.png` })), renduLe: le },
    ...p,
  } as never);
}

async function creerCreneau(id: string, compte: string, visuelId: string, p: Record<string, unknown> = {}): Promise<void> {
  const quand = iso(Math.floor((T0 + 2 * JOUR) / MIN) * MIN);
  await depots().creneauxEditoriaux.enregistrer({
    id, jourVise: quand.slice(0, 10), heuresParReseau: { linkedin: quand }, compteCible: compte, visuelId,
    textes: { linkedin: { texte: `Texte ${id}`, premierCommentaire: "" } },
    statut: "valide", decalages: 0, valideeLe: "2026-11-12T10:00:00Z", valideePar: "le fondateur", ...p,
  } as never);
}

const poserEssai = (v: unknown = ESSAI): Promise<void> => ecrireParametre(PARAM_ESSAI_BROUILLON, v);
async function ouvrirTout(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
}
const options = (extra: Record<string, unknown> = {}) => ({
  service: () => fauxFournisseur(), maintenant: () => Date.now(), lireUrl, fichierExiste: async () => true,
  notifier: async (n: unknown) => { notifications.push(n); }, ...extra,
});
const tour = (extra: Record<string, unknown> = {}) => tourEnvoisCalendrierServeur(options(extra) as never) as Promise<Record<string, unknown>>;
const aller = (t: number): void => { vi.setSystemTime(t); };

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  appelsFournisseur = [];
  notifications = [];
  espionPromotion.appels = 0;
  session.active = true;
  reinitialiserDepots();
  reinitialiserRequete();
  reinitialiserTourEnvoisCalendrier();
  monterClient();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("appel réseau réel interdit")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await creerVisuel("vis_1");
  await creerVisuel("vis_2");
  await creerCreneau("cA", COMPTES.a, "vis_1");
  await creerCreneau("cB", COMPTES.b, "vis_2");
});
afterEach(() => {
  injecterClientZernio(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PR-B · lecture du réglage : toute anomalie = fermé, zéro requête", () => {
  it("valeur valide : lue", async () => {
    await poserEssai();
    expect(await lireEssai(T0)).toMatchObject({ creneauId: "cA", compte: COMPTES.a, reseau: "linkedin" });
  });
  const cas: [string, () => Promise<void>][] = [
    ["absent", async () => undefined],
    ["null", () => poserEssai(null)],
    ["chaîne", () => poserEssai("oui")],
    ["version 2", () => poserEssai({ ...ESSAI, version: 2 })],
    ["champ manquant", () => poserEssai({ ...ESSAI, compte: undefined })],
    ["expireLe illisible", () => poserEssai({ ...ESSAI, expireLe: "demain" })],
    ["durée 24 h + 1 s", () => poserEssai({ ...ESSAI, poseLe: iso(T0 - H), expireLe: iso(T0 - H + DUREE_MAX_ESSAI_MS + 1000) })],
    ["expireLe avant poseLe", () => poserEssai({ ...ESSAI, expireLe: iso(T0 - 2 * H) })],
    ["poseLe futur", () => poserEssai({ ...ESSAI, poseLe: iso(T0 + H), expireLe: iso(T0 + 2 * H) })],
    ["créneau inexistant", () => poserEssai({ ...ESSAI, creneauId: "inconnu" })],
    ["créneau vidéo", async () => { await poserEssai(); await depots().creneauxEditoriaux.enregistrer({ ...(await depots().creneauxEditoriaux.obtenir("cA")), videoId: "vid_1" } as never); }],
    ["compte différent", () => poserEssai({ ...ESSAI, compte: COMPTES.b })],
    ["deux réseaux", async () => { await poserEssai(); const c = await depots().creneauxEditoriaux.obtenir("cA"); await depots().creneauxEditoriaux.enregistrer({ ...c, heuresParReseau: { ...c!.heuresParReseau, instagram: c!.heuresParReseau.linkedin } } as never); }],
    ["Tout arrêter actif", async () => { await poserEssai(); await ecrireParametre(PARAM_ARRET_ZERNIO, false); }],
    ["lecture du dépôt qui lève", async () => { await poserEssai(); vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("lecture impossible")); }],
  ];
  it.each(cas)("%s → fermé", async (_n, preparer) => {
    await preparer();
    expect(await lireEssai(T0)).toBeNull();
    expect(await essaiCouvre("cA", "brouillon", T0)).toBe(false);
    expect(faux.appels).toHaveLength(0);
  });
  it("expiré d'une seconde → ne couvre plus la création ni le déplacement (le retrait garde sa fenêtre de nettoyage)", async () => {
    await poserEssai({ ...ESSAI, expireLe: iso(T0 - 1000) });
    expect(await essaiCouvre("cA", "brouillon", T0)).toBe(false);
    expect(await essaiCouvre("cA", "deplacement", T0)).toBe(false);
    expect(await essaiCouvre("cA", "retrait", T0)).toBe(true);
    expect(faux.appels).toHaveLength(0);
  });
  it("sans clé du diffuseur → fermé", async () => {
    await poserEssai();
    injecterClientZernio(null);
    delete process.env.ZERNIO_API_KEY;
    expect(await lireEssai(T0)).toBeNull();
  });
});

describe("PR-B · essaiCouvre : égalité stricte du créneau, fenêtres", () => {
  beforeEach(poserEssai.bind(null, ESSAI));
  it("couvre A, jamais B ni A-reprise", async () => {
    expect(await essaiCouvre("cA", "brouillon", T0)).toBe(true);
    expect(await essaiCouvre("cB", "brouillon", T0)).toBe(false);
    expect(await essaiCouvre("cA-reprise", "brouillon", T0)).toBe(false);
    expect(await essaiCouvre("cA-reprise", "retrait", T0)).toBe(false);
  });
  it("brouillon et déplacement : jusqu'à expireLe ; retrait : expireLe + 24 h", async () => {
    const e = Date.parse(ESSAI.expireLe);
    for (const g of ["brouillon", "deplacement"] as const) {
      expect(await essaiCouvre("cA", g, e - 1)).toBe(true);
      expect(await essaiCouvre("cA", g, e)).toBe(false);
    }
    expect(await essaiCouvre("cA", "retrait", e + FENETRE_NETTOYAGE_MS - 1)).toBe(true);
    expect(await essaiCouvre("cA", "retrait", e + FENETRE_NETTOYAGE_MS)).toBe(false);
  });
  it("le retrait n'est possible qu'avec un essai lisible (Tout arrêter l'emporte)", async () => {
    await ecrireParametre(PARAM_ARRET_ZERNIO, false);
    expect(await essaiCouvre("cA", "retrait", T0)).toBe(false);
  });
});

describe("PR-B · portée : un seul créneau, jamais de promotion", () => {
  beforeEach(poserEssai.bind(null, ESSAI));
  it("1. portes générales fermées, A et B validés : un tour crée UN brouillon, pour A ; B : aucune requête", async () => {
    const r = await tour();
    expect(r).toMatchObject({ essai: { creneauId: "cA", etat: "brouillon-cree" } });
    expect(appelsFournisseur).toHaveLength(1);
    expect(appelsFournisseur[0].cible).toBe(COMPTES.a);
    expect(appelsFournisseur.some((d) => d.cible === COMPTES.b)).toBe(false);
    expect(await depots().envoisPlanifies.lister((e) => e.creneauId === "cB")).toHaveLength(0);
    expect(faux.appels.filter((a) => a.methode !== "GET")).toHaveLength(0);
  });
  it("2. aucun appel à promouvoir, aucun PUT, même si le brouillon de A existe déjà", async () => {
    await tour();
    const cle = cleEnvoi("vis_1", "linkedin", 0);
    expect(await depots().parametres.obtenir(`envoi-calendrier:creation:${cle}`)).toMatchObject({ valeur: "cree" });
    vi.setSystemTime(T0 + 6 * MIN);
    const r2 = await tour();
    expect(r2).toMatchObject({ essai: { creneauId: "cA", etat: "deja-cree" } });
    expect(methodesClient).not.toContain("promouvoir");
    expect(faux.appels.some((a) => a.methode === "PUT")).toBe(false);
    expect(espionPromotion.appels).toBe(0);
  });
  it("3. publicationEditorialeAutorisee reste fermée avec un essai valide (import-buffer et promotion-envois en dépendent)", async () => {
    expect(await publicationEditorialeAutorisee()).toBe(false);
    await dansEssai("cA", async () => { expect(await publicationEditorialeAutorisee()).toBe(false); });
    for (const f of ["src/services/promotion-envois.ts", "src/services/import-buffer/promotion.ts"]) expect(source(f)).not.toMatch(/essai-zernio/);
  });
  it("4. isDraft:false sous essai : refus avant appel ; compte du corps différent : refus avant appel ; brouillon du bon compte : permis", async () => {
    const corps = (isDraft: unknown, accountId: string) => ({ isDraft, platforms: [{ platform: "linkedin", accountId, platformSpecificData: { organizationUrn: "urn:li:organization:42" } }] }) as never;
    await expect(dansEssai("cA", () => verifierCorpsSousEssai(corps(false, "compte-1")))).rejects.toThrow();
    await expect(dansEssai("cA", () => verifierCorpsSousEssai(corps(undefined, "compte-1")))).rejects.toThrow();
    await expect(dansEssai("cA", () => verifierCorpsSousEssai(corps(true, "compte-3")))).rejects.toThrow();
    await expect(dansEssai("cA", () => verifierCorpsSousEssai(corps(true, "compte-1")))).resolves.toBeUndefined();
    // hors essai : la garde ne dit rien (les chemins généraux sont inchangés)
    await expect(verifierCorpsSousEssai(corps(false, "compte-3"))).resolves.toBeUndefined();
    expect(faux.appels).toHaveLength(0);
  });
  it("4b. le fournisseur appelle la garde AVANT la création du post", () => {
    const s = source("src/fournisseurs/publication/zernio.ts");
    const garde = s.indexOf("verifierCorpsSousEssai");
    expect(garde).toBeGreaterThan(-1);
    expect(garde).toBeLessThan(s.indexOf("client.creerPost("));
  });
  it("5. envoyerVisuel pour B pendant que le contexte d'essai porte A : ENVOI_CALENDRIER_FERME, rien d'appelé", async () => {
    await expect(dansEssai("cA", () => envoyerVisuelDuCreneau(fauxFournisseur(), "cB", "linkedin", { lireUrl, fichierExiste: async () => true }))).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    await expect(envoyerVisuelDuCreneau(fauxFournisseur(), "cA", "linkedin", { lireUrl, fichierExiste: async () => true })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appelsFournisseur).toHaveLength(0);
  });
  it("5b. porteCalendrierPour : A sous contexte A seulement ; sans id, porte générale seule", async () => {
    expect(await porteCalendrierPour("cA")).toBe(false);
    await dansEssai("cA", async () => {
      expect(essaiEnCours()).toBe("cA");
      expect(await porteCalendrierPour("cA")).toBe(true);
      expect(await porteCalendrierPour("cB")).toBe(false);
      expect(await porteCalendrierPour(undefined)).toBe(false);
      expect(await porteClientEssai()).toBe(true);
    });
    expect(essaiEnCours()).toBeUndefined();
    expect(await porteClientEssai()).toBe(false);
  });
  it("5c. le proxy « promouvoir » du tour refuse sous essai (défense en profondeur)", () => {
    expect(source("src/services/branchement-envoi-calendrier.ts")).toMatch(/essaiEnCours\(\)/);
  });
  it("6. retrait de A sous essai : permis jusqu'à expireLe + 24 h, refusé ensuite ; retrait de B : éteint", async () => {
    await tour();
    aller(Date.parse(ESSAI.expireLe) + 23 * H);
    const ok = await retirerProgrammationServeur("cA");
    expect(ok).toMatchObject({ ok: true, etat: "retire" });
    // B : aucun post, mais un envoi avec clé ⇒ le retrait exige la porte
    await depots().envoisPlanifies.enregistrer({ id: "eB", cle: "eB", videoId: "vis_2", nature: "visuel", creneauId: "cB", cleDiffuseur: "b".repeat(64), reseau: "linkedin", versionCreneau: 0, jour: "2026-12-01", heure: "09:30", statut: "valide", creeLe: iso(T0), modifieLe: iso(T0) } as never);
    const refuseB = await retirerProgrammationServeur("cB");
    expect(refuseB).toMatchObject({ ok: false, etat: "reste-programme" });
  });
  it("6b. retrait de A refusé après expireLe + 24 h (aucune écriture)", async () => {
    await tour();
    aller(Date.parse(ESSAI.expireLe) + 25 * H);
    const avant = await depots().envoisPlanifies.lister();
    const r = await retirerProgrammationServeur("cA");
    expect(r).toMatchObject({ ok: false, etat: "reste-programme" });
    expect(await depots().envoisPlanifies.lister()).toEqual(avant);
    expect(methodesClient).not.toContain("retirer");
  });
  it("6c. déplacement : permis pour A jusqu'à expireLe, refusé ensuite ; refusé pour B", async () => {
    const d = await depsDeplacementServeur();
    expect(await d.reglagesOuverts("cA")).toBe(true);
    expect(await d.reglagesOuverts("cB")).toBe(false);
    aller(Date.parse(ESSAI.expireLe) + 1);
    expect(await d.reglagesOuverts("cA")).toBe(false);
  });
  it("6d. déplacement de bout en bout : A avec post → retrait puis version suivante avant expireLe ; refus « éteint » sans écriture après ; B refusé", async () => {
    await tour();
    const retraits: string[] = [];
    const port = { retirer: async (e: { cle: string }) => { retraits.push(e.cle); return "retire" as const; } };
    const nouveauJour = iso(T0 + 3 * JOUR).slice(0, 10);
    const deplacer = async (creneauId: string, cle: string) => deplacerProgrammation(await depsDeplacementServeur(port as never), { creneauId, nouveauJour, cle });
    // Après expireLe : refus sans écriture ni retrait.
    aller(Date.parse(ESSAI.expireLe) + 1);
    const avantCreneau = await depots().creneauxEditoriaux.obtenir("cA");
    const avantEnvois = await depots().envoisPlanifies.lister();
    const tard = await deplacer("cA", "k-tard");
    expect(tard).toMatchObject({ ok: false, etat: "reste" });
    expect(JSON.stringify(tard)).toMatch(/éteint|eteint/i);
    expect(retraits).toEqual([]);
    expect(await depots().creneauxEditoriaux.obtenir("cA")).toEqual(avantCreneau);
    expect(await depots().envoisPlanifies.lister()).toEqual(avantEnvois);
    // B : refusé, aucun retrait.
    aller(T0 + 2 * MIN);
    await depots().envoisPlanifies.enregistrer({ id: "eB", cle: "eB", videoId: "vis_2", nature: "visuel", creneauId: "cB", cleDiffuseur: "b".repeat(64), reseau: "linkedin", versionCreneau: 0, jour: "2026-12-01", heure: "09:30", statut: "valide", creeLe: iso(T0), modifieLe: iso(T0) } as never);
    expect(await deplacer("cB", "k-b")).toMatchObject({ ok: false, etat: "reste" });
    expect(retraits).toEqual([]);
    // Avant expireLe : retrait puis version suivante.
    const ok = await deplacer("cA", "k-ok");
    expect(ok).toMatchObject({ ok: true, etat: "deplace" });
    expect(retraits).toHaveLength(1);
    expect((await depots().creneauxEditoriaux.obtenir("cA") as { decalages: number }).decalages).toBe(1);
  });
  it("6e. écran : « expire » vrai dès expireLe (fenêtre de retrait), faux avant ; la pastille suit", async () => {
    await poserEssai();
    const lire = async () => { const r = await actions.lireEssaiZernioAction(); return r.ok ? r.donnees.essai : undefined; };
    expect(await lire()).toMatchObject({ creneauId: "cA", expire: false });
    aller(Date.parse(ESSAI.expireLe) + MIN);
    expect(await lire()).toMatchObject({ creneauId: "cA", expire: true });
    expect(source("src/components/reglages/EssaiBrouillon.tsx")).toMatch(/Essai expiré — retrait possible jusqu'à/);
    expect(source("src/components/calendrier/ApercuPublication.tsx")).toMatch(/Essai \(expiré\)/);
  });
  it("7. « Annuler » un retrait de A : A-reprise recréé ; le tour d'essai suivant ne crée aucun brouillon", async () => {
    await tour();
    const avant = appelsFournisseur.length;
    aller(T0 + 2 * MIN);
    expect(await retirerProgrammationServeur("cA")).toMatchObject({ ok: true });
    expect(await annulerRetraitServeur("cA")).toMatchObject({ ok: true, creneauId: "cA-reprise" });
    expect(await depots().creneauxEditoriaux.obtenir("cA-reprise")).toBeTruthy();
    aller(T0 + 10 * MIN);
    await tour();
    expect(appelsFournisseur).toHaveLength(avant);
    expect(await depots().envoisPlanifies.lister((e) => e.creneauId === "cA-reprise")).toHaveLength(0);
  });
  it("8. contexte hérité par une tâche détachée, exécutée après expiration : aucune porte ne s'ouvre", async () => {
    const tache = dansEssai("cA", () => new Promise<boolean[]>((res) => setTimeout(async () => res([await porteCalendrierPour("cA"), await porteClientEssai(), await essaiCouvre("cA", "brouillon")]), 0)));
    aller(Date.parse(ESSAI.expireLe) + 1);
    expect(await tache).toEqual([false, false, false]);
  });
  it("8b. réglage retiré pendant le contexte : fermé tout de suite", async () => {
    await dansEssai("cA", async () => {
      await poserEssai(null);
      expect(await porteCalendrierPour("cA")).toBe(false);
    });
  });
  it("9. portes générales ouvertes : tour actuel inchangé (pas de ligne d'essai), essai présent ou non", async () => {
    await ouvrirTout();
    const avec = await tour();
    expect(avec.essai).toBeUndefined();
    expect(avec).toHaveProperty("resultat");
    expect(appelsFournisseur.length).toBeGreaterThanOrEqual(2);
    reinitialiserDepots();
    reinitialiserTourEnvoisCalendrier();
    monterClient();
    appelsFournisseur = [];
    await creerVisuel("vis_1"); await creerVisuel("vis_2");
    await creerCreneau("cA", COMPTES.a, "vis_1"); await creerCreneau("cB", COMPTES.b, "vis_2");
    await ouvrirTout();
    const sans = await tour();
    expect(sans.essai).toBeUndefined();
    expect(appelsFournisseur.length).toBe(2);
  });
  it("9b. sans essai et portes fermées : porte fermée, rien d'appelé", async () => {
    await poserEssai(null);
    expect(await tour()).toEqual({ saute: "porte-fermee" });
    expect(appelsFournisseur).toHaveLength(0);
  });
  it("9c. un tour d'essai respecte le débit de 5 minutes", async () => {
    await tour();
    expect(await tour()).toEqual({ saute: "debit" });
  });
});

describe("PR-B · actions d'écran", () => {
  const futur = (id = "cA") => ({ creneauId: id, dureeHeures: 4 });
  it("lecture : sans session, refus", async () => {
    session.active = false;
    await expect(actions.lireEssaiZernioAction()).rejects.toThrow();
  });
  it("pose : sans session, refus ; rien d'écrit", async () => {
    session.active = false;
    await expect(actions.poserEssaiZernioAction(futur())).rejects.toThrow();
    expect((await depots().parametres.obtenir(PARAM_ESSAI_BROUILLON))?.valeur ?? null).toBeNull();
  });
  it("retrait : sans session, refus", async () => {
    session.active = false;
    await expect(actions.retirerEssaiZernioAction()).rejects.toThrow();
  });
  it("pose valide : compte et réseau lus du créneau, jamais saisis ; journalisée", async () => {
    // Pour l'écran : créneau entre J+1 et J+6 (cA est à J+2)
    const r = await actions.poserEssaiZernioAction({ ...futur(), compte: "x", reseau: "tiktok" } as never);
    expect(r.ok).toBe(true);
    const lu = (await depots().parametres.obtenir(PARAM_ESSAI_BROUILLON))?.valeur as Record<string, unknown>;
    expect(lu).toMatchObject({ version: 1, creneauId: "cA", compte: COMPTES.a, reseau: "linkedin" });
    expect(Date.parse(lu.expireLe as string) - Date.parse(lu.poseLe as string)).toBe(4 * H);
    expect(await lireEssai(Date.now())).toMatchObject({ creneauId: "cA" });
  });
  it("second essai pendant un essai actif : refus", async () => {
    expect((await actions.poserEssaiZernioAction(futur("cA"))).ok).toBe(true);
    const r = await actions.poserEssaiZernioAction(futur("cB"));
    expect(r.ok).toBe(false);
    expect(((await depots().parametres.obtenir(PARAM_ESSAI_BROUILLON))?.valeur as { creneauId: string }).creneauId).toBe("cA");
  });
  it("créneau non éligible (non validé, hors J+1…J+6, durée hors 1…24 h) : refus avec phrase", async () => {
    await creerCreneau("cC", COMPTES.a, "vis_1", { statut: "a_valider", valideeLe: undefined });
    await creerCreneau("cD", COMPTES.a, "vis_1", { heuresParReseau: { linkedin: iso(T0 + 12 * H) } });
    await creerCreneau("cE", COMPTES.a, "vis_1", { heuresParReseau: { linkedin: iso(T0 + 8 * JOUR) } });
    for (const id of ["cC", "cD", "cE", "inconnu"]) {
      const r = await actions.poserEssaiZernioAction(futur(id));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message.length).toBeGreaterThan(10);
    }
    for (const dureeHeures of [0, 25, 1.5, Number.NaN]) expect((await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures })).ok).toBe(false);
    expect((await depots().parametres.obtenir(PARAM_ESSAI_BROUILLON))?.valeur ?? null).toBeNull();
  });
  it("retirer l'essai écrit null ; le tour suivant est « porte fermée »", async () => {
    await actions.poserEssaiZernioAction(futur());
    const r = await actions.retirerEssaiZernioAction();
    expect(r.ok).toBe(true);
    expect((await depots().parametres.obtenir(PARAM_ESSAI_BROUILLON))?.valeur).toBeNull();
    expect(await tour()).toEqual({ saute: "porte-fermee" });
  });
  it("lecture : essai actif et créneaux éligibles seulement (validés, visuel, un réseau, J+1…J+6)", async () => {
    await creerCreneau("cC", COMPTES.a, "vis_1", { statut: "a_valider", valideeLe: undefined });
    const r = await actions.lireEssaiZernioAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.donnees.essai).toBeNull();
      expect(r.donnees.eligibles.map((c: { id: string }) => c.id).sort()).toEqual(["cA", "cB"]);
    }
  });
  it("les actions ne contactent jamais le diffuseur", async () => {
    await actions.lireEssaiZernioAction();
    await actions.poserEssaiZernioAction(futur());
    await actions.retirerEssaiZernioAction();
    expect(faux.appels).toHaveLength(0);
  });
});

describe("PR-B · ce qui ne bouge pas", () => {
  it("les trois réglages et leurs fonctions sont inchangés (pas de import de l'essai dans zernio.ts)", () => {
    expect(source("src/services/zernio.ts")).not.toMatch(/essai-zernio/);
  });
  it("la garde PUT du client n'est pas touchée", () => {
    expect(source("src/fournisseurs/publication/zernio-client.ts")).not.toMatch(/essai-zernio|essaiEnCours|essaiCouvre/);
  });
  it("la garde L5-02d et le chemin vidéo ne connaissent pas l'essai", () => {
    expect(source("src/services/garde-creneau-diffuseur.ts")).not.toMatch(/essai-zernio/);
    expect(source("src/services/envoi-depuis-creneau.ts")).toMatch(/porteEssai/);
  });
  it("un créneau vidéo ne peut pas être désigné (essai illisible)", async () => {
    await poserEssai();
    await depots().creneauxEditoriaux.enregistrer({ ...(await depots().creneauxEditoriaux.obtenir("cA")), videoId: "vid_1" } as never);
    expect(await essaiCouvre("cA", "brouillon", T0)).toBe(false);
  });
});

describe("Réserves de l'audit · marque d'essai, retrait d'abord, cible complète", () => {
  const cleA = () => cleEnvoi("vis_1", "linkedin", 0);
  const putsPromotion = () => faux.appels.filter((a) => a.methode === "PUT");

  it("1. un brouillon d'essai n'est jamais promu par la promotion générale ; un envoi normal l'est", async () => {
    await poserEssai(ESSAI);
    await tour();
    expect(await depots().parametres.obtenir(`envoi-calendrier:essai:${cleA()}`)).toMatchObject({ valeur: expect.any(String) });
    await poserEssai(null);
    await ouvrirTout();
    aller(T0 + 6 * MIN);
    await tour({ attendre: async () => undefined }); // crée le brouillon de B (promotion : pas avant 3 h de l'échéance)
    aller(T0 + 2 * JOUR - 2 * H);
    await tour({ attendre: async () => undefined });
    const envoiA = (await depots().envoisPlanifies.lister((e) => e.creneauId === "cA"))[0];
    expect(envoiA.statut).not.toBe("programme");
    expect(posts.get("post-1")?.status).toBe("draft");
    expect(putsPromotion().every((a) => !a.url.endsWith("/post-1"))).toBe(true);
    // B, envoi normal, a bien été promu (PUT sur son post) ; A, jamais
    expect(putsPromotion().map((a) => a.url.split("/").pop())).toEqual(["post-2"]);
  });

  it("2. retirer l'essai ou en poser un autre : refusé tant que le brouillon existe chez le diffuseur ; accepté après retrait", async () => {
    expect((await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures: 4 })).ok).toBe(true);
    await tour();
    const phrase = "Retirez d'abord le brouillon d'essai chez le diffuseur depuis le calendrier.";
    const r = await actions.retirerEssaiZernioAction();
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.message).toContain(phrase);
    expect((await depots().parametres.obtenir(PARAM_ESSAI_BROUILLON))?.valeur).not.toBeNull();
    // poser un autre essai après expiration : refusé aussi
    aller(Date.parse(iso(T0)) + 5 * H);
    const p = await actions.poserEssaiZernioAction({ creneauId: "cB", dureeHeures: 4 });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toContain(phrase);
    // retrait du brouillon depuis le calendrier, puis l'essai peut être retiré
    aller(T0 + 2 * MIN);
    expect(await retirerProgrammationServeur("cA")).toMatchObject({ ok: true });
    expect((await actions.retirerEssaiZernioAction()).ok).toBe(true);
    expect((await depots().parametres.obtenir(PARAM_ESSAI_BROUILLON))?.valeur).toBeNull();
  });

  it("2b. aucun brouillon créé : le retrait de l'essai est accepté", async () => {
    expect((await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures: 4 })).ok).toBe(true);
    expect((await actions.retirerEssaiZernioAction()).ok).toBe(true);
  });

  it("3. cible complète : même compte, autre page ou autre organisation = refus ; la bonne cible passe", async () => {
    await poserEssai(ESSAI);
    const corps = (specifique?: Record<string, unknown>, accountId = "compte-1") => ({ isDraft: true, platforms: [{ platform: "linkedin", accountId, ...(specifique ? { platformSpecificData: specifique } : {}) }] }) as never;
    await expect(dansEssai("cA", () => verifierCorpsSousEssai(corps({ organizationUrn: "urn:li:organization:99" })))).rejects.toThrow();
    await expect(dansEssai("cA", () => verifierCorpsSousEssai(corps()))).rejects.toThrow();
    await expect(dansEssai("cA", () => verifierCorpsSousEssai(corps({ pageId: "42" })))).rejects.toThrow();
    await expect(dansEssai("cA", () => verifierCorpsSousEssai(corps({ organizationUrn: "urn:li:organization:42" })))).resolves.toBeUndefined();
  });
});

/** Créneau « programmé en un clic » : construit par le VRAI code de la fiche carrousel (`programmerEnUnClic`), dépôts en mémoire. */
describe("Essai · créneau programmé en un clic (statut « programme »)", () => {
  const passerelle = () => {
    const d = depots();
    return { creneaux: d.creneauxEditoriaux, journal: d.journalDecalages, publications: d.publications, visuels: d.visuels } as never;
  };
  /** Le clic crée le créneau sans compte ni texte (ils viennent d'ailleurs) : on les ajoute, le statut reste celui du clic. */
  async function programmerLeVisuel(id: string, reseaux: string[] = ["linkedin"]): Promise<string> {
    await depots().visuels.modifier(id, { reseaux } as never);
    const jour = cleJour(iso(T0 + 3 * JOUR));
    const { creneauId } = await programmerEnUnClic(passerelle(), id, jour, iso(T0));
    await depots().creneauxEditoriaux.modifier(creneauId, { compteCible: COMPTES.a, textes: { linkedin: { texte: "Texte un clic", premierCommentaire: "" } } } as never);
    return creneauId;
  }

  it("1. éligible : le créneau du clic est « programme » et passe la désignation ; il figure dans les éligibles", async () => {
    const id = await programmerLeVisuel("vis_1");
    const c = await depots().creneauxEditoriaux.obtenir(id);
    expect(c?.statut).toBe("programme");
    expect(raisonNonEligible(c as never, T0)).toBeNull();
    const r = await actions.lireEssaiZernioAction();
    expect(r.ok && r.donnees.eligibles.map((e: { id: string }) => e.id)).toContain(id);
  });

  it("1b. contre-cas toujours refusés : sans validation datée, retiré, à renvoyer, deux réseaux, vidéo", async () => {
    const id = await programmerLeVisuel("vis_1");
    const c = (await depots().creneauxEditoriaux.obtenir(id)) as unknown as Record<string, unknown> & { heuresParReseau: Record<string, string> };
    const h = c.heuresParReseau.linkedin;
    for (const p of [{ valideeLe: undefined }, { retireLe: iso(T0) }, { aRenvoyer: true }, { heuresParReseau: { linkedin: h, instagram: h } }, { videoId: "vid_1" }]) {
      expect(raisonNonEligible({ ...c, ...p } as never, T0)).not.toBeNull();
    }
  });

  it("2. de bout en bout : pose, tour (portes générales fermées) = UN brouillon, zéro promotion, envoi non annulé ; second tour = deja-cree", async () => {
    const id = await programmerLeVisuel("vis_1");
    expect((await actions.poserEssaiZernioAction({ creneauId: id, dureeHeures: 2 })).ok).toBe(true);
    const r = await tour();
    expect(r).toMatchObject({ essai: { creneauId: id, etat: "brouillon-cree" } });
    expect(appelsFournisseur).toHaveLength(1);
    expect(appelsFournisseur[0]).toMatchObject({ mode: "brouillon", cible: COMPTES.a });
    const envois = await depots().envoisPlanifies.lister((e) => e.creneauId === id);
    expect(envois).toHaveLength(1);
    expect(envois[0].statut).not.toBe("annule");
    aller(T0 + 6 * MIN);
    expect(await tour()).toMatchObject({ essai: { creneauId: id, etat: "deja-cree" } });
    expect(appelsFournisseur).toHaveLength(1);
    expect(methodesClient).not.toContain("promouvoir");
    expect(espionPromotion.appels).toBe(0);
    expect(faux.appels.some((a) => a.methode === "PUT")).toBe(false);
  });

  it("3a. « Tout arrêter » : porte fermée, zéro appel", async () => {
    const id = await programmerLeVisuel("vis_1");
    await actions.poserEssaiZernioAction({ creneauId: id, dureeHeures: 2 });
    await ecrireParametre(PARAM_ARRET_ZERNIO, false);
    expect(await tour()).toEqual({ saute: "porte-fermee" });
    expect(appelsFournisseur).toHaveLength(0);
  });

  it("3b. après expireLe : zéro appel", async () => {
    const id = await programmerLeVisuel("vis_1");
    await actions.poserEssaiZernioAction({ creneauId: id, dureeHeures: 2 });
    aller(T0 + 3 * H);
    await tour();
    expect(appelsFournisseur).toHaveLength(0);
  });

  it("3c. retrait du brouillon sous essai : créneau archivé avec retireLe, visuel de nouveau « valide »", async () => {
    const id = await programmerLeVisuel("vis_1");
    await actions.poserEssaiZernioAction({ creneauId: id, dureeHeures: 2 });
    await tour();
    aller(T0 + 2 * MIN);
    expect(await retirerProgrammationServeur(id)).toMatchObject({ ok: true });
    const c = await depots().creneauxEditoriaux.obtenir(id);
    expect(c?.statut).toBe("archive");
    expect(c?.retireLe).toBeTruthy();
    expect((await depots().visuels.obtenir("vis_1"))?.statut).toBe("valide");
  });
});

describe("Lot D · raison du refus visible sur l'écran d'essai", () => {
  const cleRefus = (id: string) => cleEnvoi(id, "linkedin", 0);
  const noterRefus = async (cle: string, raison: string, le: string) => {
    await ecrireParametre(`envoi-calendrier:dernier-refus-le:${cle}`, le);
    await ecrireParametre(`envoi-calendrier:dernier-refus:${cle}`, raison);
  };

  it("rend dernierRefus pour le créneau de l'essai", async () => {
    await poserEssai();
    await noterRefus(cleRefus("vis_1"), "Aucune page LinkedIn reliée.", iso(T0 - MIN));
    const r = await actions.lireEssaiZernioAction();
    expect(r.ok && r.donnees.essai?.dernierRefus).toEqual({ raison: "Aucune page LinkedIn reliée.", le: iso(T0 - MIN) });
    expect(r.ok && r.donnees.essai?.aCompleter).toBeUndefined();
  });

  it("rend aCompleter pour l'essai et pour chaque éligible sans texte ; jamais pour un créneau avec texte", async () => {
    await poserEssai();
    await depots().creneauxEditoriaux.modifier("cA", { textes: {} } as never);
    const r = await actions.lireEssaiZernioAction();
    expect(r.ok && r.donnees.essai?.aCompleter).toMatch(/^Légende à écrire/);
    const el = r.ok ? r.donnees.eligibles : [];
    const a = el.find((e: { id: string }) => e.id === "cA") as { aCompleter?: string } | undefined;
    const b = el.find((e: { id: string }) => e.id === "cB") as { aCompleter?: string } | undefined;
    if (a) expect(a.aCompleter).toMatch(/^Légende à écrire/);
    if (b) expect(b.aCompleter).toBeUndefined();
  });

  it("une erreur de lecture de la raison ne bloque pas la lecture de l'essai", async () => {
    await poserEssai();
    const r = await actions.lireEssaiZernioAction();
    expect(r.ok && r.donnees.essai?.creneauId).toBe("cA");
  });

  it("EssaiBrouillon affiche la raison et « à compléter » dans un role=status", () => {
    const src = source("src/components/reglages/EssaiBrouillon.tsx");
    expect(src).toMatch(/dernierRefus/);
    expect(src).toMatch(/aCompleter/);
    expect(src).toMatch(/role="status"/);
  });
});
