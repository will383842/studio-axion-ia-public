/**
 * L5-02d : un créneau déjà confié au diffuseur ne se décale ni ne se dévalide plus en silence.
 * Dépôts en mémoire, faux fournisseur de publication, faux client du diffuseur (compteur par méthode ; `promouvoir` contrôlable
 * à la main), `fetch` global qui lève, horloge injectée : aucun appel réel, aucun envoi réel. Données fictives.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./zernio/aides/faux-zernio";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({ id: "s1" })) }));

// Espion sur la cloche : chaque appel note si le verrou global était libre à cet instant (jamais de notification sous `sousVerrou`).
const cloche = vi.hoisted(() => ({ verrouLibre: [] as boolean[] }));
vi.mock("@/services/notifications", async (orig) => {
  const m = await orig<typeof import("@/services/notifications")>();
  return {
    ...m,
    creerNotification: async (...a: Parameters<typeof m.creerNotification>) => {
      const { sousVerrou } = await import("@/services/_commun");
      cloche.verrouLibre.push(await Promise.race([sousVerrou(async () => true), new Promise<boolean>((r) => setTimeout(() => r(false), 400))]));
      return m.creerNotification(...a);
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre, sousVerrou } = await import("@/services/_commun");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
const { tourEnvoisCalendrierServeur, reinitialiserTourEnvoisCalendrier, PREFIXE_ETATS_ENVOI_CALENDRIER } = await import("@/services/branchement-envoi-calendrier");
const garde = await import("@/services/garde-creneau-diffuseur");
const { transiterEnvoi } = await import("@/services/envois-planifies");
const { decalerEntree } = await import("../src/app/(studio)/calendrier/actions/decaler");
const { enregistrerFicheEntreeAction } = await import("../src/app/(studio)/calendrier/actions");
const { retirerDuCalendrier } = await import("../src/app/(studio)/calendrier/actions/retirer");
const { PHRASES_RETRAIT } = await import("@/services/plan-vers-publication");
const { heureAffichageParis } = await import("@/domaine/plan-editorial/statuts");
const { cleJour } = await import("@/lib/dates");
const { niveauDiffuseurDuCreneau, refusModificationCreneau, PHRASES_CRENEAU_CONFIE, AVERTISSEMENT_DECALAGE_BROUILLON } = garde;

const MIN = 60_000;
const JOUR = 24 * 60 * MIN;
const RACINE = join(__dirname, "..");
const COMPTES = { linkedin: "compte-1:li:42", instagram: "compte-2", facebook: "compte-1:fb:page-1" } as const;
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;
const arrondi = (t: number): number => Math.floor(t / MIN) * MIN;
const DEBUT = arrondi(Date.now());
const VALIDEE = "2026-11-12T10:00:00Z";
const CLE_ENVOI = "envoi:vis_1:linkedin:v0";
const CLE_ENVOI_FB = "envoi:vis_1:facebook:v0";

let appelsFournisseur: DemandePublication[] = [];
let posts: Map<string, PostZernio>;
let faux: ReturnType<typeof creerFauxClientZernio>["faux"];
let clientBrut: ReturnType<typeof creerFauxClientZernio>["client"];
let horloge: ReturnType<typeof creerFauxClientZernio>["horloge"];
let methodesClient: string[];
let notifications: { titre: string; message?: string; lien?: string }[];
let maintenant: number;

function fauxFournisseur(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [
      { id: COMPTES.linkedin, organisationId: "zernio", nom: "Page LinkedIn", service: "linkedin", genre: "page" },
      { id: COMPTES.instagram, organisationId: "zernio", nom: "Compte Instagram", service: "instagram" },
      { id: COMPTES.facebook, organisationId: "zernio", nom: "Page Facebook", service: "facebook", genre: "page" },
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
    if (a.methode === "PUT") {
      posts.set(id, { ...p, status: "scheduled", scheduledFor: (a.json as { scheduledFor: string }).scheduledFor });
      return { statut: 200, corps: { post: posts.get(id) } };
    }
    return { statut: 200, corps: { post: p } };
  };
  const c = creerFauxClientZernio(reponse);
  faux = c.faux;
  horloge = c.horloge;
  clientBrut = c.client;
  horloge.avancer(maintenant - horloge.maintenant());
}

interface Crochets {
  /** Remplace `promouvoir` (reçoit le vrai et la demande). */
  promouvoir?: (reel: (d: unknown) => Promise<unknown>, d: unknown) => Promise<unknown>;
  /** Appelé (une fois) juste avant la lecture des posts « programmés », donc avant la relecture du plan et avant tout PUT. */
  avantListeProgrammes?: () => Promise<void>;
}
const client = (c: Crochets = {}): ClientZernio => {
  let liste = false;
  return new Proxy(clientBrut, {
    get: (cible, nom: string) => {
      const v = (cible as never)[nom] as unknown;
      if (typeof v !== "function") return v;
      return async (...a: unknown[]) => {
        methodesClient.push(nom);
        if (nom === "listerPosts" && (a[0] as { status?: string } | undefined)?.status === "scheduled" && c.avantListeProgrammes && !liste) {
          liste = true;
          await c.avantListeProgrammes();
        }
        if (nom === "promouvoir" && c.promouvoir) return c.promouvoir((v as (d: unknown) => Promise<unknown>).bind(cible), a[0]);
        return (v as (...x: unknown[]) => unknown)(...a);
      };
    },
  }) as ClientZernio;
};

async function ouvrirTout(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
}

async function creerVisuel(): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_1", famille: "carrousel", titre: "Cinq erreurs courantes", entree: { type: "sujet", sujet: "exemple" }, statut: "valide",
    modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le, spec: { alt: "Cinq erreurs courantes à éviter" },
    rendu: {
      empreinte: "e1", pdfCle: "visuels/vis_1/carrousel.pdf", vignetteCle: "visuels/vis_1/v.png",
      pages: [1, 2, 3].map((i) => ({ index: i, x1Cle: `visuels/vis_1/p${i}.png`, x2Cle: `visuels/vis_1/p${i}@2x.png` })), renduLe: le,
    },
  } as never);
}

const heureDu = (jours: number): string => new Date(arrondi(DEBUT + jours * JOUR)).toISOString().replace(/\.\d{3}Z$/, "Z");
const jourDu = (jours: number): string => heureDu(jours).slice(0, 10);
const jjmm = (iso: string): string => `${cleJour(iso).slice(8, 10)}/${cleJour(iso).slice(5, 7)} à ${heureAffichageParis(iso)}`;

async function creerCreneau(id: string, reseaux: ("linkedin" | "instagram" | "facebook")[] = ["linkedin"], p: Record<string, unknown> = {}): Promise<void> {
  await depots().creneauxEditoriaux.enregistrer({
    id, jourVise: jourDu(2), heuresParReseau: Object.fromEntries(reseaux.map((r) => [r, heureDu(2)])), compteCible: COMPTES[reseaux[0]], visuelId: "vis_1",
    textes: Object.fromEntries(reseaux.map((r) => [r, { texte: `Texte ${r}`, premierCommentaire: "" }])),
    statut: "valide", decalages: 0, valideeLe: VALIDEE, valideePar: "le fondateur", ...p,
  } as never);
}

const options = (extra: Record<string, unknown> = {}) => ({
  service: () => fauxFournisseur(), client: client(), maintenant: () => maintenant, lireUrl, fichierExiste: async () => true,
  notifier: async (n: { titre: string; message?: string; lien?: string }) => { notifications.push(n); }, ...extra,
});
const tour = (extra: Record<string, unknown> = {}) => tourEnvoisCalendrierServeur(options(extra) as never);
const tourSuivant = async (extra: Record<string, unknown> = {}) => { maintenant += 6 * MIN; horloge.avancer(6 * MIN); return tour(extra); };
/** Place l'horloge du tour à H-2 h : la promotion est dans sa fenêtre. */
const versLaFenetre = (): void => { maintenant = Date.parse(heureDu(2)) - 2 * 60 * MIN; horloge.avancer(maintenant - horloge.maintenant()); };

const marque = async (nom: string): Promise<unknown> => (await depots().parametres.obtenir(PREFIXE_ETATS_ENVOI_CALENDRIER + nom))?.valeur;
const lire = async (id: string) => (await depots().creneauxEditoriaux.obtenir(id)) as unknown as Record<string, unknown>;
const instantane = async (): Promise<string> => JSON.stringify({
  creneaux: await depots().creneauxEditoriaux.lister(), journal: await depots().journalDecalages.lister(),
  envois: await depots().envoisPlanifies.lister(), publications: await depots().publications.lister(),
});
const nbPut = (): number => faux.appels.filter((a) => a.methode === "PUT").length;
const decaler = (id: string, cle: string, jours = 5) => decalerEntree({ id, nouveauJour: jourDu(jours), raison: "Report demandé", cle });
const refus = (r: { ok: boolean; message?: string }): string => (r.ok ? "" : (r.message as string));

/** Un créneau « c1 » LinkedIn dont le brouillon est préparé chez le diffuseur (niveau « brouillon »). */
async function brouillonPrepare(): Promise<void> {
  await ouvrirTout();
  await creerVisuel();
  await creerCreneau("c1");
  await tour();
  expect(appelsFournisseur).toHaveLength(1);
}
/** Facebook : un envoi « valide » dont le brouillon est déjà chez le diffuseur (clé du diffuseur posée), sur le même créneau. */
async function ajouterEnvoiFacebook(): Promise<void> {
  await depots().envoisPlanifies.enregistrer({ id: CLE_ENVOI_FB, cle: CLE_ENVOI_FB, videoId: "vis_1", nature: "visuel", creneauId: "c1", cleDiffuseur: "a".repeat(64), reseau: "facebook", versionCreneau: 0, jour: jourDu(2), heure: "09:00", statut: "valide", valideeLe: VALIDEE, creeLe: VALIDEE, modifieLe: VALIDEE } as never);
}
/** Idem, puis promu : le post est programmé, l'envoi est « programme », le créneau reste « valide ». */
async function promu(): Promise<void> {
  await brouillonPrepare();
  versLaFenetre();
  await tour();
  expect((await depots().envoisPlanifies.lister())[0].statut).toBe("programme");
}

beforeEach(async () => {
  appelsFournisseur = [];
  notifications = [];
  cloche.verrouLibre = [];
  maintenant = DEBUT;
  monterClient();
  reinitialiserDepots();
  reinitialiserRequete();
  reinitialiserTourEnvoisCalendrier();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("appel réseau réel interdit")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("L5-02d · la garde : niveaux", () => {
  it("aucun envoi : « libre », sans lire aucun paramètre", async () => {
    await creerCreneau("c1");
    const lecture = vi.spyOn(depots().parametres, "obtenir");
    expect(await niveauDiffuseurDuCreneau("c1")).toEqual({ niveau: "libre" });
    expect(lecture).not.toHaveBeenCalled();
  });

  it("brouillon préparé : « brouillon » ; après promotion : « programme » avec le jour et l'heure de Paris", async () => {
    await brouillonPrepare();
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "brouillon" });
    versLaFenetre();
    await tour();
    expect(await niveauDiffuseurDuCreneau("c1")).toEqual({ niveau: "programme", jour: cleJour(heureDu(2)), heure: heureAffichageParis(heureDu(2)), reseau: "linkedin" });
  });

  it.each([
    ["envoi « confirme »", "confirme", "programme"],
    ["envoi « a-envoyer »", "a-envoyer", "programme"],
    ["envoi « envoye »", "envoye", "parti"],
  ])("%s", async (_n, statut, attendu) => {
    await creerCreneau("c1");
    await depots().envoisPlanifies.enregistrer({ id: CLE_ENVOI, cle: CLE_ENVOI, videoId: "vis_1", creneauId: "c1", reseau: "linkedin", versionCreneau: 0, jour: jourDu(2), heure: "09:00", statut, creeLe: VALIDEE, modifieLe: VALIDEE } as never);
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: attendu });
  });

  it("priorité : programmé (un réseau) l'emporte sur un brouillon (autre réseau) ; « parti » sur tout", async () => {
    await brouillonPrepare();
    await ajouterEnvoiFacebook();
    const [li] = await depots().envoisPlanifies.lister((e) => e.reseau === "linkedin");
    await transiterEnvoi(depots().envoisPlanifies, li.id, "programme", VALIDEE);
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "programme", reseau: "linkedin" });
    const [fb] = await depots().envoisPlanifies.lister((e) => e.reseau === "facebook");
    await depots().envoisPlanifies.modifier(fb.id, { statut: "envoye" } as never);
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "parti" });
  });

  it("marques : promotion « programme » sur un envoi annulé = programmé ; « a-verifier » ; « en-cours » ; création « en-cours »", async () => {
    await brouillonPrepare();
    const [e] = await depots().envoisPlanifies.lister();
    await depots().envoisPlanifies.modifier(e.id, { statut: "annule" } as never);
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "libre" });
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}promotion:${CLE_ENVOI}`, "en-cours");
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "en-cours" });
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}promotion:${CLE_ENVOI}`, "a-verifier");
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "a-verifier" });
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}promotion:${CLE_ENVOI}`, "programme");
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "programme", jour: e.jour });
    // Un envoi annulé ne compte que par sa marque de promotion : les marques de création ne comptent que pour un envoi encore actif.
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}creation:${CLE_ENVOI}`, "en-cours");
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}a-verifier:${CLE_ENVOI}`, "a-verifier");
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}promotion:${CLE_ENVOI}`, "libre");
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "libre" });
    await depots().envoisPlanifies.modifier(e.id, { statut: "valide" } as never);
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}a-verifier:${CLE_ENVOI}`, "libre");
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "en-cours" });
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}creation:${CLE_ENVOI}`, "refuse");
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}a-verifier:${CLE_ENVOI}`, "a-verifier");
    expect(await niveauDiffuseurDuCreneau("c1")).toMatchObject({ niveau: "a-verifier" });
  });

  it("le préfixe recopié dans la garde est celui du branchement", () => {
    expect(garde.PREFIXE_ETATS_GARDE).toBe(PREFIXE_ETATS_ENVOI_CALENDRIER);
    expect(PREFIXE_ETATS_ENVOI_CALENDRIER).toBe("envoi-calendrier:");
  });
});

describe("L5-02d · décalage pendant un tour (promotion en vol)", () => {
  it("PUT en attente : refus « en cours », rien ne change, moins de 2 s ; puis refus « programmée » avec la date", async () => {
    await brouillonPrepare();
    versLaFenetre();
    let entree!: () => void;
    const entre = new Promise<void>((r) => { entree = r; });
    let ouvrir!: () => void;
    const porte = new Promise<void>((r) => { ouvrir = r; });
    const enVol = tour({ client: client({ promouvoir: async (reel, d) => { entree(); await porte; return reel(d); } }) });
    await entre;
    expect(await marque(`promotion:${CLE_ENVOI}`)).toBe("en-cours");
    const avant = await instantane();
    const t0 = performance.now();
    const r = await decaler("c1", "k1");
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.ok).toBe(false);
    expect(refus(r)).toBe(PHRASES_CRENEAU_CONFIE["en-cours"]);
    expect(refus(r)).toMatch(/en cours/);
    expect(await instantane()).toBe(avant);
    expect(await depots().journalDecalages.lister()).toHaveLength(0);
    expect(await lire("c1")).toMatchObject({ decalages: 0, jourVise: jourDu(2) });
    ouvrir();
    await enVol;
    expect(await marque(`promotion:${CLE_ENVOI}`)).toBe("programme");
    expect((await depots().envoisPlanifies.lister())[0].statut).toBe("programme");
    const apres = await decaler("c1", "k2");
    expect(apres.ok).toBe(false);
    expect(refus(apres)).toContain(`pour le ${jjmm(heureDu(2))} (heure de Paris)`);
    expect(refus(apres)).toMatch(/déjà programmée/);
    expect(await lire("c1")).toMatchObject({ decalages: 0 });
    expect(await depots().journalDecalages.lister()).toHaveLength(0);
  });

  it("course, ordre (i) : le décalage passe avant la relecture : la promotion est abandonnée (0 appel), l'envoi est annulé", async () => {
    await brouillonPrepare();
    versLaFenetre();
    const promouvoirAppels = vi.fn();
    let decalage: Awaited<ReturnType<typeof decaler>> | undefined;
    await tour({
      client: client({
        avantListeProgrammes: async () => { decalage = await decaler("c1", "k1"); },
        promouvoir: async (reel, d) => { promouvoirAppels(d); return reel(d); },
      }),
    });
    expect(decalage).toMatchObject({ ok: true });
    expect(promouvoirAppels).not.toHaveBeenCalled();
    expect(nbPut()).toBe(0);
    expect((await depots().envoisPlanifies.lister())[0].statut).toBe("annule");
    expect(await lire("c1")).toMatchObject({ decalages: 1 });
    // Jamais un post programmé ET un créneau décalé.
    expect([...posts.values()].some((p) => p.status === "scheduled")).toBe(false);
  });

  it("course, ordre (ii) : la relecture passe avant : le décalage est refusé ; le post est programmé, le créneau n'est pas décalé", async () => {
    await brouillonPrepare();
    versLaFenetre();
    let ouvrir!: () => void;
    const porte = new Promise<void>((r) => { ouvrir = r; });
    let entree!: () => void;
    const entre = new Promise<void>((r) => { entree = r; });
    const enVol = tour({ client: client({ promouvoir: async (reel, d) => { entree(); await porte; return reel(d); } }) });
    await entre;
    const r = await decaler("c1", "k1");
    expect(r.ok).toBe(false);
    ouvrir();
    await enVol;
    expect(nbPut()).toBe(1);
    expect([...posts.values()].some((p) => p.status === "scheduled")).toBe(true);
    expect(await lire("c1")).toMatchObject({ decalages: 0, jourVise: jourDu(2) });
  });
});

describe("L5-02d · décalage après promotion", () => {
  it("refus, 0 appel au diffuseur, créneau, journal et envois inchangés", async () => {
    await promu();
    const avant = await instantane();
    const appels = faux.appels.length;
    const methodes = methodesClient.length;
    const r = await decaler("c1", "k1");
    expect(r.ok).toBe(false);
    expect(refus(r)).toBe(PHRASES_CRENEAU_CONFIE.programme(cleJour(heureDu(2)), heureAffichageParis(heureDu(2))));
    expect(refus(r)).toContain("faites-le dans l'outil de publication");
    expect(await instantane()).toBe(avant);
    expect(faux.appels).toHaveLength(appels);
    expect(methodesClient).toHaveLength(methodes);
    expect(appelsFournisseur).toHaveLength(1);
  });

  it("multi-réseau : LinkedIn programmé, Facebook encore « valide » avec brouillon : refus « programmée »", async () => {
    await brouillonPrepare();
    await ajouterEnvoiFacebook();
    const [li] = await depots().envoisPlanifies.lister((e) => e.reseau === "linkedin");
    await transiterEnvoi(depots().envoisPlanifies, li.id, "programme", VALIDEE);
    const r = await decaler("c1", "k1");
    expect(r.ok).toBe(false);
    expect(refus(r)).toMatch(/déjà programmée chez le diffuseur pour le/);
    expect(await lire("c1")).toMatchObject({ decalages: 0 });
  });

  it("le rejeu d'une clé déjà journalisée ne contourne pas la garde", async () => {
    await brouillonPrepare();
    expect((await decaler("c1", "k1")).ok).toBe(true);
    // Le créneau a bougé (version 1) ; une marque « programme » apparaît ensuite : même la clé déjà jouée est refusée.
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}promotion:${CLE_ENVOI}`, "programme");
    const r = await decaler("c1", "k1");
    expect(r.ok).toBe(false);
    expect(await depots().journalDecalages.lister()).toHaveLength(1);
  });
});

describe("L5-02d · retrait après promotion (retirer.ts non modifié)", () => {
  it("refusé avec PHRASES_RETRAIT.confiee, publication, créneau et visuel inchangés", async () => {
    await promu();
    const [p] = await depots().publications.lister((x) => x.visuelId === "vis_1");
    expect(p).toBeTruthy();
    const avant = await instantane();
    const visuel = JSON.stringify(await depots().visuels.obtenir("vis_1"));
    const r = await retirerDuCalendrier(`publication:${p.id}|linkedin`, "retirer");
    expect(r).toMatchObject({ ok: false, message: PHRASES_RETRAIT.confiee });
    expect(await instantane()).toBe(avant);
    expect(JSON.stringify(await depots().visuels.obtenir("vis_1"))).toBe(visuel);
  });
});

describe("L5-02d · modification du texte (dévalidation)", () => {
  const ecritures = async (): Promise<string> => JSON.stringify({ fiches: (await depots().parametres.lister((p) => p.id.startsWith("calendrier.fiche."))).map((p) => [p.id, p.valeur]), creneaux: await depots().creneauxEditoriaux.lister() });

  it("après promotion : refus avec la phrase « programmée », aucune écriture, statut toujours « valide »", async () => {
    await promu();
    const avant = await ecritures();
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Nouveau texte." });
    expect(r.ok).toBe(false);
    expect(refus(r)).toBe(PHRASES_CRENEAU_CONFIE.programme(cleJour(heureDu(2)), heureAffichageParis(heureDu(2))));
    expect(await ecritures()).toBe(avant);
    expect(await lire("c1")).toMatchObject({ statut: "valide" });
  });

  it("brouillon seulement : refus avec la phrase « brouillon », aucune écriture, statut toujours « valide »", async () => {
    await brouillonPrepare();
    const avant = await ecritures();
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Nouveau texte." });
    expect(r).toMatchObject({ ok: false, message: PHRASES_CRENEAU_CONFIE.brouillon });
    expect(await ecritures()).toBe(avant);
    expect(await lire("c1")).toMatchObject({ statut: "valide" });
  });

  it("niveau « libre » : comportement d'avant (repasse « à valider », aRevalider)", async () => {
    await creerCreneau("c1");
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Nouveau texte." });
    expect(r).toMatchObject({ ok: true, donnees: { modifie: true, aRevalider: true } });
    expect(await lire("c1")).toMatchObject({ statut: "a_valider" });
  });

  it("une fiche d'origine « publication » n'est pas concernée par la garde du créneau", async () => {
    await promu();
    const [p] = await depots().publications.lister((x) => x.visuelId === "vis_1");
    const lecture = vi.spyOn(depots().envoisPlanifies, "lister");
    await enregistrerFicheEntreeAction(`publication:${p.id}|linkedin`, { texte: "Autre texte." });
    expect(lecture).not.toHaveBeenCalled();
  });
});

describe("L5-02d · niveau « brouillon » : décalage accepté avec avertissement", () => {
  it("avertissement ; tour suivant : ancienne version annulée, jamais promue, aucun second brouillon, une notification (une fois)", async () => {
    await brouillonPrepare();
    const r = await decaler("c1", "k1");
    expect(r).toMatchObject({ ok: true, avertissement: AVERTISSEMENT_DECALAGE_BROUILLON });
    expect(AVERTISSEMENT_DECALAGE_BROUILLON).toContain("ne partira pas seule");
    expect(await lire("c1")).toMatchObject({ decalages: 1 });
    const promouvoirAppels = vi.fn();
    const c = client({ promouvoir: async (reel, d) => { promouvoirAppels(d); return reel(d); } });
    await tourSuivant({ client: c });
    expect((await depots().envoisPlanifies.lister((e) => e.versionCreneau === 0))[0].statut).toBe("annule");
    expect(appelsFournisseur).toHaveLength(1);
    const partira = (): number => notifications.filter((n) => /ne partira pas seule/.test(n.message ?? "")).length;
    expect(notifications).toHaveLength(1);
    expect(partira()).toBe(1);
    // Un troisième tour, puis la fenêtre de promotion : ni appel de promotion, ni nouvelle notification.
    await tourSuivant({ client: c });
    maintenant = Date.parse(heureDu(7)) - 2 * 60 * MIN;
    horloge.avancer(maintenant - horloge.maintenant());
    await tour({ client: c });
    expect(promouvoirAppels).not.toHaveBeenCalled();
    expect(nbPut()).toBe(0);
    expect(appelsFournisseur).toHaveLength(1);
    expect(notifications).toHaveLength(1);
  });

  it("ancienne version programmée (cas hérité) : message « programmée … l'ancienne date » ; sinon message « en dehors de ce créneau »", async () => {
    await brouillonPrepare();
    await decaler("c1", "k1");
    const [v0] = await depots().envoisPlanifies.lister((e) => e.versionCreneau === 0);
    await depots().envoisPlanifies.modifier(v0.id, { statut: "programme" } as never);
    await tourSuivant();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toMatch(/déjà programmée chez le diffuseur pour le \d{2}\/\d{2} à \d{2}:\d{2} \(heure de Paris\), l'ancienne date, et partira à cette heure-là/);
    // Publication d'un autre créneau (même visuel) : troisième message.
    reinitialiserDepots();
    notifications = [];
    appelsFournisseur = [];
    reinitialiserTourEnvoisCalendrier();
    await ouvrirTout();
    await creerVisuel();
    await creerCreneau("c1");
    await depots().publications.enregistrer({ id: "pub-x", visuelId: "vis_1", reseau: "linkedin", via: "zernio", statut: "brouillon", etatEnvoi: "envoye", cleEnvoi: "f".repeat(64), date: heureDu(4), texte: "t", canalId: COMPTES.linkedin, creeLe: VALIDEE, modifieLe: VALIDEE } as never);
    await tour();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toMatch(/en dehors de ce créneau/);
    expect(appelsFournisseur).toHaveLength(0);
  });
});

describe("L5-02d · plantage entre le PUT et l'écriture locale", () => {
  it("marque « en-cours » restée : 0 appel à promouvoir, « a-verifier » noté, décalage refusé « vérifiez-la dans l'outil de publication »", async () => {
    await brouillonPrepare();
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}promotion:${CLE_ENVOI}`, "en-cours");
    versLaFenetre();
    const promouvoirAppels = vi.fn();
    await tour({ client: client({ promouvoir: async (reel, d) => { promouvoirAppels(d); return reel(d); } }) });
    expect(promouvoirAppels).not.toHaveBeenCalled();
    expect(nbPut()).toBe(0);
    expect(await marque(`a-verifier:${CLE_ENVOI}`)).toBe("a-verifier");
    expect((await depots().envoisPlanifies.lister())[0].statut).toBe("valide");
    const r = await decaler("c1", "k1");
    expect(r.ok).toBe(false);
    expect(refus(r)).toBe(PHRASES_CRENEAU_CONFIE["a-verifier"]);
    expect(refus(r)).toMatch(/Vérifiez-la dans l'outil de publication/);
    // Le tour suivant n'appelle toujours rien.
    await tourSuivant({ client: client({ promouvoir: async (reel, d) => { promouvoirAppels(d); return reel(d); } }) });
    expect(promouvoirAppels).not.toHaveBeenCalled();
    expect(nbPut()).toBe(0);
  });

  it("plantage APRÈS le PUT (post déjà programmé, marque « en-cours », envoi « valide ») : 0 appel, « a-verifier » noté, décalage refusé « vérifiez-la »", async () => {
    await brouillonPrepare();
    for (const [id, p] of posts) posts.set(id, { ...p, status: "scheduled", scheduledFor: heureDu(2) });
    await ecrireParametre(`${PREFIXE_ETATS_ENVOI_CALENDRIER}promotion:${CLE_ENVOI}`, "en-cours");
    versLaFenetre();
    const promouvoirAppels = vi.fn();
    await tour({ client: client({ promouvoir: async (reel, d) => { promouvoirAppels(d); return reel(d); } }) });
    expect(promouvoirAppels).not.toHaveBeenCalled();
    expect(nbPut()).toBe(0);
    expect(await marque(`promotion:${CLE_ENVOI}`)).toBe("a-verifier");
    expect(await marque(`a-verifier:${CLE_ENVOI}`)).toBe("a-verifier");
    expect((await depots().envoisPlanifies.lister())[0].statut).toBe("valide");
    const r = await decaler("c1", "k1");
    expect(r.ok).toBe(false);
    expect(refus(r)).toBe(PHRASES_CRENEAU_CONFIE["a-verifier"]);
  });

  it("une promotion qui n'a pas encore commencé ne pose aucune marque « en-cours » orpheline : marque « programme » après succès", async () => {
    await promu();
    expect(await marque(`promotion:${CLE_ENVOI}`)).toBe("programme");
  });
});

describe("L5-02d · issue de la promotion : marque", () => {
  it.each([
    ["erreur « avant le réseau » (envoi-coupe)", async () => { throw new ErreurZernio("envoi-coupe", "envoi coupé"); }, "libre"],
    ["état « a-reprogrammer »", async () => ({ etat: "a-reprogrammer", raison: "trop tard" }), "libre"],
    ["état « a-verifier »", async () => ({ etat: "a-verifier", raison: "doute" }), "a-verifier"],
    ["refus net (« refuse », par prudence)", async () => ({ etat: "refuse", raison: "refus" }), "a-verifier"],
    ["erreur inconnue", async () => { throw new Error("coupure"); }, "a-verifier"],
    ["erreur du diffuseur après le réseau", async () => { throw new ErreurZernio("indisponible", "indisponible", { statut: 503 }); }, "a-verifier"],
  ])("%s : marque « %s »", async (_n, resultat, attendu) => {
    await brouillonPrepare();
    versLaFenetre();
    await tour({ client: client({ promouvoir: resultat as never }) });
    expect(await marque(`promotion:${CLE_ENVOI}`)).toBe(attendu);
    expect(nbPut()).toBe(0);
  });

  it("refus net avant le réseau : le décalage est de nouveau possible (niveau « brouillon », avec avertissement)", async () => {
    await brouillonPrepare();
    versLaFenetre();
    await tour({ client: client({ promouvoir: async () => { throw new ErreurZernio("envoi-coupe", "envoi coupé"); } }) });
    const r = await decaler("c1", "k1");
    expect(r).toMatchObject({ ok: true, avertissement: AVERTISSEMENT_DECALAGE_BROUILLON });
  });

  it("l'erreur levée est relancée telle quelle au tour (aucune erreur avalée)", async () => {
    await brouillonPrepare();
    versLaFenetre();
    const erreur = new ErreurZernio("envoi-coupe", "envoi coupé");
    let vue: unknown;
    await tour({ client: client({ promouvoir: async () => { try { throw erreur; } catch (e) { vue = e; throw e; } } }) });
    expect(vue).toBe(erreur);
  });
});

describe("L5-02d · version courante annulée puis revalidée", () => {
  it("exclue, notifiée une fois, 0 appel de plus", async () => {
    await brouillonPrepare();
    const [e] = await depots().envoisPlanifies.lister();
    // Dévalidation : le tour annule l'envoi de la version (plus « valide »).
    await depots().creneauxEditoriaux.enregistrer({ ...(await lire("c1")), statut: "a_valider" } as never);
    await tourSuivant();
    expect((await depots().envoisPlanifies.obtenir(e.id))?.statut).toBe("annule");
    // Revalidation : même version, même clé.
    await depots().creneauxEditoriaux.enregistrer({ ...(await lire("c1")), statut: "valide" } as never);
    for (let i = 0; i < 3; i++) await tourSuivant();
    expect(appelsFournisseur).toHaveLength(1);
    expect(nbPut()).toBe(0);
    const messages = notifications.filter((n) => /modifiée après une première préparation/.test(n.message ?? ""));
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("Pour qu'elle parte seule, décalez-la");
    expect(notifications).toHaveLength(1);
  });
});

describe("L5-02d · le manuel n'est jamais bloqué sans message clair", () => {
  const niveaux = [
    { niveau: "programme", jour: "2026-12-03", heure: "09:30", reseau: "linkedin" },
    { niveau: "a-verifier" },
    { niveau: "en-cours" },
    { niveau: "brouillon" },
    { niveau: "parti" },
  ] as const;

  it.each(niveaux)("niveau %o : chaque refus dit quoi faire, sans nom d'outil", (n) => {
    for (const geste of ["decaler", "texte"] as const) {
      const m = refusModificationCreneau(n as never, geste);
      if (n.niveau === "brouillon" && geste === "decaler") { expect(m).toBeNull(); continue; }
      expect(typeof m).toBe("string");
      expect((m as string).length).toBeGreaterThan(20);
      expect(m).not.toContain("Un souci est survenu");
      expect(m).not.toMatch(/zernio|buffer/i);
      if (n.niveau !== "parti") {
        expect(m).toMatch(/rien n'a été changé/i);
        expect(m).toMatch(/faites-le|Vérifiez|Réessayez|modifiez-le|Programmez/);
      }
    }
  });

  it("« libre » : jamais de refus ; « brouillon » : décalage permis, texte refusé", () => {
    expect(refusModificationCreneau({ niveau: "libre" }, "decaler")).toBeNull();
    expect(refusModificationCreneau({ niveau: "libre" }, "texte")).toBeNull();
    expect(refusModificationCreneau({ niveau: "brouillon" }, "decaler")).toBeNull();
    expect(refusModificationCreneau({ niveau: "brouillon" }, "texte")).toBe(PHRASES_CRENEAU_CONFIE.brouillon);
  });

  it("la phrase « programmée » donne JJ/MM et HH:MM de l'envoi, sans conversion", () => {
    expect(PHRASES_CRENEAU_CONFIE.programme("2026-12-03", "09:30")).toBe(
      "Cette publication est déjà programmée chez le diffuseur pour le 03/12 à 09:30 (heure de Paris) : elle partira à cette heure-là. Rien n'a été changé ici. Pour la déplacer, la modifier ou l'annuler, faites-le dans l'outil de publication.",
    );
    expect(PHRASES_CRENEAU_CONFIE.parti).toBe("Cette publication est déjà partie : elle ne se modifie plus ici.");
  });

  it("envoi « envoye » : le décalage et le texte sont refusés avec la phrase « partie »", async () => {
    await creerCreneau("c1");
    await depots().envoisPlanifies.enregistrer({ id: CLE_ENVOI, cle: CLE_ENVOI, videoId: "vis_1", creneauId: "c1", reseau: "linkedin", versionCreneau: 0, jour: jourDu(2), heure: "09:00", statut: "envoye", creeLe: VALIDEE, modifieLe: VALIDEE } as never);
    expect(await decaler("c1", "k1")).toMatchObject({ ok: false, message: PHRASES_CRENEAU_CONFIE.parti });
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "x" })).toMatchObject({ ok: false, message: PHRASES_CRENEAU_CONFIE.parti });
  });
});

describe("L5-02d · interrupteurs éteints = aucun changement visible", () => {
  const cas: [string, () => Promise<void>][] = [
    ["aucun réglage écrit", async () => undefined],
    ["les trois réglages à faux", async () => { await ecrireParametre(PARAM_EDITORIALE_ACTIVE, false); await ecrireParametre(PARAM_ENVOI_CALENDRIER, false); await ecrireParametre(PARAM_ARRET_ZERNIO, false); }],
  ];
  it.each(cas)("%s : décaler (propose, a_valider, valide) et modifier le texte donnent les résultats et écritures d'avant", async (_n, preparer) => {
    await preparer();
    const reglages = (await depots().parametres.lister()).length;
    const lecture = vi.spyOn(depots().parametres, "obtenir");
    for (const statut of ["propose", "a_valider", "valide"] as const) {
      const id = `c-${statut}`;
      await creerCreneau(id, ["linkedin"], { statut });
      const r = await decaler(id, `k-${statut}`);
      expect(r.ok).toBe(true);
      expect("avertissement" in r).toBe(false);
      expect(await lire(id)).toMatchObject({ jourVise: jourDu(5), decalages: 1 });
      expect(Date.parse(((await lire(id)).heuresParReseau as { linkedin: string }).linkedin)).toBe(Date.parse(heureDu(5).replace(/^\d{4}-\d{2}-\d{2}/, jourDu(5))));
    }
    expect(await depots().journalDecalages.lister()).toHaveLength(3);
    // Texte : « valide » repasse « à valider » ; « a_valider » reste « a_valider ».
    await creerCreneau("t1", ["linkedin"], { statut: "valide" });
    expect(await enregistrerFicheEntreeAction("creneau:t1|linkedin", { texte: "Autre texte." })).toMatchObject({ ok: true, donnees: { modifie: true, aRevalider: true } });
    expect(await lire("t1")).toMatchObject({ statut: "a_valider" });
    await creerCreneau("t2", ["linkedin"], { statut: "a_valider" });
    expect(await enregistrerFicheEntreeAction("creneau:t2|linkedin", { texte: "Autre texte." })).toMatchObject({ ok: true, donnees: { modifie: true, aRevalider: false } });
    // Aucun envoi, aucune marque, aucune lecture « envoi-calendrier: », aucun appel réseau.
    expect(await depots().envoisPlanifies.compter()).toBe(0);
    expect((await depots().parametres.lister((p) => p.id.startsWith(PREFIXE_ETATS_ENVOI_CALENDRIER))).length).toBe(0);
    expect(lecture.mock.calls.filter(([id]) => String(id).startsWith(PREFIXE_ETATS_ENVOI_CALENDRIER))).toHaveLength(0);
    expect((await depots().parametres.lister((p) => !p.id.startsWith("calendrier.fiche."))).length).toBe(reglages);
    expect(faux.appels).toHaveLength(0);
    expect(appelsFournisseur).toHaveLength(0);
  });

  it("la garde ne lit aucun réglage et n'importe ni ./zernio, ni @/fournisseurs, ni ./notifications", () => {
    const src = readFileSync(join(RACINE, "src/services/garde-creneau-diffuseur.ts"), "utf8");
    expect(src).toContain('import "server-only"');
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join("\n");
    expect(imports).not.toMatch(/zernio/i);
    expect(imports).not.toMatch(/@\/fournisseurs/);
    expect(imports).not.toMatch(/notifications/);
    expect(src).not.toMatch(/envoiCalendrierAutorise|publicationEditorialeAutorisee|editorialeActive|PARAM_[A-Z_]+/);
  });

  it("créneau sans aucun envoi : aucune lecture « envoi-calendrier:* » (la garde rend « libre »)", async () => {
    await creerCreneau("c1");
    const lecture = vi.spyOn(depots().parametres, "obtenir");
    await decaler("c1", "k1");
    expect(lecture.mock.calls.filter(([id]) => String(id).startsWith(PREFIXE_ETATS_ENVOI_CALENDRIER))).toHaveLength(0);
  });

  it("garde allumée ou non : un post programmé reste programmé si l'on éteint tout (la garde ne lit pas les réglages)", async () => {
    await promu();
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, false);
    await ecrireParametre(PARAM_ENVOI_CALENDRIER, false);
    await ecrireParametre(PARAM_ARRET_ZERNIO, false);
    expect((await decaler("c1", "k1")).ok).toBe(false);
  });
});

describe("L5-02d · aucun interblocage", () => {
  it("un décalage pendant un tour se termine en moins de 2 s ; aucune notification n'est faite sous le verrou", async () => {
    await brouillonPrepare();
    // Notification par la cloche réelle (sans injection) : brouillon puis décalage puis tour suivant.
    const t0 = performance.now();
    const r = await decaler("c1", "k1");
    expect(r.ok).toBe(true);
    expect(performance.now() - t0).toBeLessThan(2000);
    maintenant += 6 * MIN;
    horloge.avancer(6 * MIN);
    await tourEnvoisCalendrierServeur({ ...options(), notifier: undefined } as never);
    expect(cloche.verrouLibre.length).toBeGreaterThan(0);
    expect(cloche.verrouLibre.every(Boolean)).toBe(true);
  });

  it("le verrou global reste utilisable après un refus de décalage", async () => {
    await promu();
    expect((await decaler("c1", "k1")).ok).toBe(false);
    await expect(Promise.race([sousVerrou(async () => "libre"), new Promise((r) => setTimeout(() => r("bloque"), 1000))])).resolves.toBe("libre");
  });
});
