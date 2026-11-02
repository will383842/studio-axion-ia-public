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
const BUFFER_IG = "buffer-canal-ig-1";
const canal = (id: string, nom: string, service = "instagram", organisationId = "zernio"): CanalPublication => ({ id, organisationId, nom, service, deconnecte: false });
const CANAUX_BUFFER = [canal(BUFFER_IG, "Exemple IG", "instagram", "org-buffer"), canal("buffer-canal-ig-2", "Autre IG", "instagram", "org-buffer")];

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
  it("compte de même nom : l'identifiant de Zernio, jamais celui de Buffer", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [BUFFER_IG], CANAUX_BUFFER)).toEqual([ZERNIO_IG]);
  });
  it("rien de présélectionné : rien (le choix habituel de Zernio s'applique)", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", undefined, CANAUX_BUFFER)).toBeUndefined();
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [], CANAUX_BUFFER)).toBeUndefined();
  });
  it("un seul compte sans homologue : rien (Zernio retombe sur son seul compte, ou refuse s'ils sont plusieurs)", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", ["buffer-canal-ig-2"], CANAUX_BUFFER)).toBeUndefined();
  });
  it("plusieurs comptes dont un sans homologue : marqueur de refus, jamais un identifiant de Buffer", async () => {
    canauxZernio = [canal(ZERNIO_IG, "Exemple IG")];
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [BUFFER_IG, "buffer-canal-ig-2"], CANAUX_BUFFER)).toEqual([SELECTION_NON_TRADUITE]);
  });
  it("homonymes chez Zernio : ambigu, donc pas deviné", async () => {
    canauxZernio = [canal("z-a", "Exemple IG"), canal("z-b", "Exemple IG")];
    expect(await traduireSelectionVersZernio(fauxZernio(), "instagram", [BUFFER_IG], CANAUX_BUFFER)).toBeUndefined();
  });
});

describe("FIN-ZERNIO 1 · bout en bout en simulation : Instagram présélectionné", () => {
  it("Publie par = Zernio + brouillon : un seul brouillon, « brouillon envoyé », ni programmé ni publié", async () => {
    etat.zernio = fauxZernio();
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    await ecrireParametre(PARAM_CANAUX, { lusLe: new Date().toISOString(), canaux: CANAUX_BUFFER });
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { instagram: [BUFFER_IG] } });
    expect(r.problemes ?? []).toEqual([]);
    expect(r.publications).toHaveLength(1);
    expect(r.publications[0]).toMatchObject({ via: "zernio", reseau: "instagram", etatEnvoi: "envoye", statut: "brouillon", canalId: ZERNIO_IG });
    expect(demandes).toHaveLength(1);
    expect(demandes[0].cible).toBe(ZERNIO_IG);
    expect(JSON.stringify(demandes)).not.toContain(BUFFER_IG);
    const toutes = await depots().publications.lister((p) => p.videoId === VIDEO);
    expect(toutes.filter((p) => p.via === "zernio")).toHaveLength(1);
    expect(toutes.some((p) => p.statut === "programmee" || p.statut === "publiee")).toBe(false);
  });

  it("même scénario, Zernio sans la liste Buffer en base : le seul compte Instagram de Zernio part (jamais un refus CIBLE_INCONNUE)", async () => {
    etat.zernio = fauxZernio();
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { instagram: [BUFFER_IG] } });
    expect(r.publications).toHaveLength(1);
    expect(demandes).toHaveLength(1);
    expect(demandes[0].cible).toBe(ZERNIO_IG);
  });

  it("plusieurs comptes Instagram chez Zernio et aucun homologue : refus clair, rien ne part", async () => {
    etat.zernio = fauxZernio();
    canauxZernio = [canal("z-a", "Premier"), canal("z-b", "Second")];
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "zernio" });
    await ecrireParametre(PARAM_CANAUX, { lusLe: new Date().toISOString(), canaux: CANAUX_BUFFER });
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { instagram: [BUFFER_IG] } })).rejects.toMatchObject({ code: "CIBLE_ZERNIO" });
    expect(demandes).toHaveLength(0);
  });

  it("Buffer inchangé : le canal présélectionné part tel quel, en brouillon, une seule création", async () => {
    const buffer = fauxBuffer({});
    vi.stubGlobal("fetch", buffer.appeler);
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN, { comptes: { instagram: [CANAUX.instagram] } });
    expect(r.problemes ?? []).toEqual([]);
    expect(r.publications).toHaveLength(1);
    expect(r.publications[0]).toMatchObject({ via: "buffer", etatEnvoi: "envoye", statut: "brouillon", canalId: CANAUX.instagram });
    const entrees = buffer.mutations().map((m) => m.variables.input as { channelId: string; saveToDraft: boolean });
    expect(entrees).toHaveLength(1);
    expect(entrees[0]).toMatchObject({ channelId: CANAUX.instagram, saveToDraft: true });
    expect(demandes).toHaveLength(0);
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
