/**
 * FIN-ZERNIO · finitions avant les essais réels (aucun réseau, aucune clé réelle) :
 * 1. présélection de compte traduite par outil (Zernio ET Buffer, jamais d'identifiant mêlé) ;
 * 2. refus pour doublon : phrase claire, `detailTechnique` jamais visible ;
 * 3. « Marquer comme vérifié » : sortie manuelle, écrite au journal, rien chez l'outil.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { fauxBuffer, CANAUX } from "../helpers/r1-buffer";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { CanalPublication, DemandePublication, FournisseurPublication } from "@/fournisseurs/types";

process.env.BUFFER_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0002";
process.env.ZERNIO_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0003";
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/** Le faux Zernio est rendu par `fournisseurParId("publication", "zernio")` ; tout le reste est le vrai registre. */
const etat: { zernio: FournisseurPublication | null } = { zernio: null };
vi.mock("@/fournisseurs", async (original) => {
  const reel = await original<typeof import("@/fournisseurs")>();
  return { ...reel, fournisseurParId: ((type: string, id: string) => (type === "publication" && id === "zernio" && etat.zernio ? etat.zernio : (reel.fournisseurParId as (t: string, i: string) => unknown)(type, id))) as typeof reel.fournisseurParId };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { PARAM_CANAUX, marquerEnvoiVerifie } = await import("@/services/buffer");
const { PARAM_ROUTAGE } = await import("@/services/routage-publication");
const { traduireSelectionVersZernio, SELECTION_NON_TRADUITE } = await import("@/services/zernio-cibles");

const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const ZERNIO_IG = "zernio-compte-ig-1";
const ANCIEN_IG = "buffer-canal-ig-1";
const canal = (id: string, nom: string, service = "instagram", organisationId = "zernio"): CanalPublication => ({ id, organisationId, nom, service, deconnecte: false });
const ANCIENNE_LISTE = [canal(ANCIEN_IG, "Exemple IG", "instagram", "org-buffer"), canal("buffer-canal-ig-2", "Autre IG", "instagram", "org-buffer")];

let demandes: DemandePublication[] = [];
let leve: ErreurZernio | null = null;
let canauxZernio: CanalPublication[] = [canal(ZERNIO_IG, "Exemple IG")];
function fauxZernio(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    async envoyer(d) {
      demandes.push(d);
      if (leve) throw leve;
      return { idExterne: `exemple-post-${demandes.length}`, via: "zernio" as const, statut: "brouillon" as const };
    },
    async listerCanaux() {
      return canauxZernio;
    },
  };
}

beforeAll(async () => {
  await preparerMotDePasse("essai-fin-zernio");
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter("essai-fin-zernio", false);
  etat.zernio = null;
  demandes = [];
  leve = null;
  canauxZernio = [canal(ZERNIO_IG, "Exemple IG")];
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("FIN-ZERNIO 1 · traduction de la présélection (pure)", () => {
  it("ancien identifiant, même avec un compte Zernio de même nom : jamais traduit, refus", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [ANCIEN_IG], ANCIENNE_LISTE)).toEqual([SELECTION_NON_TRADUITE]);
  });
  it("identifiant Zernio de la liste actuelle : pris tel quel", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [ZERNIO_IG], ANCIENNE_LISTE)).toEqual([ZERNIO_IG]);
  });
  it("rien de présélectionné : rien (le choix habituel de Zernio s'applique)", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", undefined, ANCIENNE_LISTE)).toBeUndefined();
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [], ANCIENNE_LISTE)).toBeUndefined();
  });
  it("un seul compte coché absent de la liste : refus, jamais de repli sur le seul compte du réseau", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", ["buffer-canal-ig-2"], ANCIENNE_LISTE)).toEqual([SELECTION_NON_TRADUITE]);
  });
  it("plusieurs comptes dont un absent de la liste : marqueur de refus", async () => {
    canauxZernio = [canal(ZERNIO_IG, "Exemple IG")];
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [ZERNIO_IG, "buffer-canal-ig-2"], ANCIENNE_LISTE)).toEqual([SELECTION_NON_TRADUITE]);
  });
  it("homonymes chez Zernio : l'ancien identifiant n'est pas traduit, refus (jamais un tirage)", async () => {
    canauxZernio = [canal("z-aaaaaa", "Exemple IG"), canal("z-bbbbbb", "Exemple IG")];
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [ANCIEN_IG], ANCIENNE_LISTE)).toEqual([SELECTION_NON_TRADUITE]);
  });
});

describe("FIN-ZERNIO 1 · bout en bout en simulation : Instagram présélectionné", () => {
  it("Publie par = Zernio + brouillon : un seul brouillon, « brouillon envoyé », ni programmé ni publié", async () => {
    etat.zernio = fauxZernio();
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    await ecrireParametre(PARAM_CANAUX, { lusLe: new Date().toISOString(), canaux: ANCIENNE_LISTE });
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { instagram: [ZERNIO_IG] } });
    expect(r.problemes ?? []).toEqual([]);
    expect(r.publications).toHaveLength(1);
    expect(r.publications[0]).toMatchObject({ via: "zernio", reseau: "instagram", etatEnvoi: "envoye", statut: "brouillon", canalId: ZERNIO_IG });
    expect(demandes).toHaveLength(1);
    expect(demandes[0].cible).toBe(ZERNIO_IG);
    expect(JSON.stringify(demandes)).not.toContain(ANCIEN_IG);
    const toutes = await depots().publications.lister((p) => p.videoId === VIDEO);
    expect(toutes.filter((p) => p.via === "zernio")).toHaveLength(1);
    expect(toutes.some((p) => p.statut === "programmee" || p.statut === "publiee")).toBe(false);
  });

  it("identifiant inconnu de Zernio (même seul) : refus CIBLE_ZERNIO en français, rien ne part", async () => {
    etat.zernio = fauxZernio();
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { instagram: [ANCIEN_IG] } })).rejects.toMatchObject({ code: "CIBLE_ZERNIO", message: expect.stringMatching(/n'est plus relié à Zernio.*recochez-le/) });
    expect(demandes).toHaveLength(0);
  });

  it("plusieurs comptes Instagram chez Zernio et un identifiant inconnu coché : refus clair, rien ne part", async () => {
    etat.zernio = fauxZernio();
    canauxZernio = [canal("z-a", "Premier"), canal("z-b", "Second")];
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    await ecrireParametre(PARAM_CANAUX, { lusLe: new Date().toISOString(), canaux: ANCIENNE_LISTE });
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { instagram: [ANCIEN_IG] } })).rejects.toMatchObject({ code: "CIBLE_ZERNIO" });
    expect(demandes).toHaveLength(0);
  });

  it("Un ancien routage « buffer » est lu comme Zernio (compte Zernio coché), aucune création Buffer", async () => {
    // Valeur « buffer » déjà en base : lue comme absente (L0-13a), jamais réécrite.
    etat.zernio = fauxZernio();
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "buffer" });
    await ecrireParametre(PARAM_CANAUX, { lusLe: new Date().toISOString(), canaux: ANCIENNE_LISTE });
    const buffer = fauxBuffer({});
    vi.stubGlobal("fetch", buffer.appeler);
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { instagram: [ZERNIO_IG] } });
    expect(r.problemes ?? []).toEqual([]);
    expect(r.publications).toHaveLength(1);
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "envoye", statut: "brouillon", canalId: ZERNIO_IG });
    expect(demandes).toHaveLength(1);
    expect(buffer.mutations()).toHaveLength(0);
    await expect((await import("@/services/routage-publication")).lireRoutage()).resolves.toEqual({ instagram: "buffer" });
  });
});

describe("FIN-ZERNIO 2 · doublon : message clair, jamais de détail technique", () => {
  const SECRET_TECHNIQUE = "DETAIL-TECHNIQUE-INTERNE-8841";
  it("phrase française fixe à l'écran et au journal, sans le détail", async () => {
    etat.zernio = fauxZernio();
    leve = new ErreurZernio("doublon", "doublon relu", { statut: 409, detailTechnique: SECRET_TECHNIQUE } as never);
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r.problemes).toHaveLength(1);
    expect(r.problemes![0].message).toContain(pub.MESSAGE_DOUBLON);
    expect(r.problemes![0].message).toMatch(/déjà dans l'outil de publication/);
    const surEcran = JSON.stringify([r.problemes, r.publications]);
    expect(surEcran).not.toContain(SECRET_TECHNIQUE);
    expect(surEcran).not.toMatch(/réponse de .* s'est perdue/);
    const journal = JSON.stringify(await depots().evenements.lister(() => true));
    expect(journal).not.toContain(SECRET_TECHNIQUE);
  });
});

describe("FIN-ZERNIO 3 · « Marquer comme vérifié »", () => {
  async function envoiAVerifier() {
    etat.zernio = fauxZernio();
    leve = new ErreurZernio("a-verifier", "délai dépassé");
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r.publications[0].etatEnvoi).toBe("a-verifier");
    return r.publications[0];
  }

  it("sort l'envoi de « à vérifier », l'écrit au journal, n'appelle aucun outil", async () => {
    const p = await envoiAVerifier();
    const appelsAvant = demandes.length;
    const fetchAvant = vi.fn();
    vi.stubGlobal("fetch", fetchAvant);
    const apres = await marquerEnvoiVerifie(p.id);
    expect(apres.etatEnvoi).toBe("envoye");
    expect(demandes).toHaveLength(appelsAvant);
    expect(fetchAvant).not.toHaveBeenCalled();
    const journal = JSON.stringify(await depots().evenements.lister(() => true));
    expect(journal).toContain("marqué comme vérifié");
    // Plus rien n'est bloqué, et le même envoi n'est jamais refait.
    leve = null;
    const r2 = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(r2.publications).toHaveLength(1);
    expect(demandes).toHaveLength(appelsAvant);
  });

  it("refuse un envoi qui n'est pas « à vérifier » et un envoi inconnu", async () => {
    etat.zernio = fauxZernio();
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    await expect(marquerEnvoiVerifie(r.publications[0].id)).rejects.toMatchObject({ code: "PAS_A_VERIFIER" });
    await expect(marquerEnvoiVerifie("pub-inconnue")).rejects.toMatchObject({ code: "PUBLICATION_INCONNUE" });
  });
});
