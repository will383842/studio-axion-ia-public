/**
 * L7-06 (relecture 440, R3) : comptes Zernio cochés dans « À publier », sans Buffer relié.
 * (a) identifiant Zernio accepté tel quel, identifiant périmé refusé ; (b) envoi de bout en bout depuis la liste Zernio ;
 * (c) état par compte (point 4.2). Aucun réseau : faux fournisseur Zernio, clé fictive.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import type { CanalPublication, DemandePublication, FournisseurPublication } from "@/fournisseurs/types";

delete process.env.BUFFER_API_KEY;
process.env.ZERNIO_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0003";
process.env.FOURNISSEUR_PUBLICATION = "simulation";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const etat: { zernio: FournisseurPublication | null } = { zernio: null };
vi.mock("@/fournisseurs", async (original) => {
  const reel = await original<typeof import("@/fournisseurs")>();
  return { ...reel, fournisseurParId: ((type: string, id: string) => (type === "publication" && id === "zernio" && etat.zernio ? etat.zernio : (reel.fournisseurParId as (t: string, i: string) => unknown)(type, id))) as typeof reel.fournisseurParId };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const apub = await import("@/services/a-publier");
const { ecrireParametre } = await import("@/services/_commun");
const { PARAM_CANAUX_ZERNIO } = await import("@/services/comptes-envoi-zernio");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const { traduireSelectionVersZernio, SELECTION_NON_TRADUITE } = await import("@/services/zernio-cibles");
const { PARAM_ENVOI_CALENDRIER } = await import("@/services/zernio");
const { REGLAGE_EDITORIALE_ACTIVE } = await import("@/services/promotion-envois");

const MDP = "essai-envoi-comptes-zernio";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const canal = (id: string, nom: string, service = "facebook"): CanalPublication => ({ id, organisationId: "zernio", nom, service, deconnecte: false, ...(service === "facebook" ? { genre: "page" } : {}) });
const P1 = "exemple-fb-1:fb:p1";
const P2 = "exemple-fb-1:fb:p2";
const CANAUX = [canal(P1, "Page exemple 1"), canal(P2, "Page exemple 2")];

let demandes: DemandePublication[] = [];
function fauxZernio(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    async envoyer(d) {
      demandes.push(d);
      return { idExterne: `exemple-post-${demandes.length}`, via: "zernio" as const, statut: "brouillon" as const };
    },
    async listerCanaux() {
      return CANAUX;
    },
  };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(REGLAGE_EDITORIALE_ACTIVE, true);
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  etat.zernio = fauxZernio();
  demandes = [];
  await ecrireParametre(PARAM_CANAUX_ZERNIO, { lusLe: "2026-11-01T08:00:00Z", canaux: CANAUX });
  await ecrireParametre("reseaux.parDefaut", ["linkedin", "instagram", "facebook"]);
  for (const v of await depots().videos.lister(() => true)) await depots().videos.modifier(v.id, { etapeEditoriale: "validee" });
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("L7-06 R3 (a) · identifiant Zernio coché, ou périmé", () => {
  it("un identifiant de la liste Zernio passe tel quel", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "facebook", [P2], [])).toEqual([P2]);
  });

  it("plusieurs identifiants Zernio : tous gardés, sans doublon", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "facebook", [P1, P2, P1], [])).toEqual([P1, P2]);
  });

  it("identifiant périmé seul : jamais pris tel quel (retombée habituelle)", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "facebook", ["ancien-compte"], [])).toBeUndefined();
  });

  it("identifiant périmé avec un bon : refus net, rien ne part sur un autre compte", async () => {
    expect(await traduireSelectionVersZernio(fauxZernio(), "facebook", [P1, "ancien-compte"], [])).toEqual([SELECTION_NON_TRADUITE]);
  });

  it("un compte déconnecté n'est plus accepté tel quel", async () => {
    const service = { ...fauxZernio(), listerCanaux: async () => [{ ...CANAUX[0], deconnecte: true }, CANAUX[1]] } as FournisseurPublication;
    expect(await traduireSelectionVersZernio(service, "facebook", [P1, P2], [])).toEqual([SELECTION_NON_TRADUITE]);
  });

  it("envoi avec un identifiant périmé parmi d'autres : refus, aucune création", async () => {
    const r = await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [P1, "ancien-compte"] });
    expect(r.ok).toBe(false);
    expect(demandes).toHaveLength(0);
  });
});

describe("L7-06 R3 (b) · envoi de bout en bout depuis la liste Zernio", () => {
  it("Facebook, page cochée : une seule création, sur cette page", async () => {
    const ligne = (await apub.vueAPublier()).lignes.find((l) => l.reseau === "facebook" && l.videoId === VIDEO);
    expect(ligne?.compte.choix?.map((c) => c.id)).toEqual([P1, P2]);
    const r = await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [P2] });
    expect(r.ok).toBe(true);
    expect(demandes).toHaveLength(1);
    expect(demandes[0].cible).toBe(P2);
    expect(await depots().publications.lister((p) => p.videoId === VIDEO && p.via === "zernio")).toHaveLength(1);
  });

  it("Facebook sans page cochée : refusé, aucune création", async () => {
    const r = await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio" });
    expect(r.ok).toBe(false);
    expect(demandes).toHaveLength(0);
  });
});

describe("L7-06 R3 (c) · état par compte (point 4.2)", () => {
  it("une page envoyée : elle est prise, l'autre reste libre, la ligne n'est pas « envoyée »", async () => {
    await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [P1] });
    const l = (await apub.vueAPublier()).lignes.find((x) => x.reseau === "facebook" && x.videoId === VIDEO);
    expect(l?.etat?.comptesPris).toEqual([P1]);
    expect(l?.etat?.envoye).toBe(false);
  });

  it("les deux pages envoyées : la ligne est « envoyée »", async () => {
    await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [P1] });
    await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [P2] });
    const l = (await apub.vueAPublier()).lignes.find((x) => x.reseau === "facebook" && x.videoId === VIDEO);
    expect([...(l?.etat?.comptesPris ?? [])].sort()).toEqual([P1, P2]);
    expect(l?.etat?.envoye).toBe(true);
  });
});
