/**
 * FIX-CIBLE · réessai « Envoi par Zernio » avec les comptes cochés (Zernio simulé, aucun réseau, clé fictive).
 * Ancien en-tête : FIN-ZERNIO · finitions avant les essais réels (aucun réseau, aucune clé réelle) :
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
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
// Précondition L7-08 : l'envoi du calendrier a son propre réglage, fermé par défaut ; ce fichier teste l'envoi, il l'ouvre.
const { ecrireParametre: ecrireReglageCalendrier } = await import("@/services/_commun");
const { PARAM_ENVOI_CALENDRIER } = await import("@/services/zernio");


const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const canal = (id: string, nom: string, service = "facebook", organisationId = "zernio"): CanalPublication => ({ id, organisationId, nom, service, deconnecte: false });
const BUF_AXION = "buffer-fb-axion";
const BUF_AUTRE = "buffer-fb-autre";
const CANAUX_BUFFER = [canal(BUF_AXION, "Axion-IA.com", "facebook", "org-buffer"), canal(BUF_AUTRE, "Autre Page", "facebook", "org-buffer")];

let demandes: DemandePublication[] = [];
let canauxZernio: CanalPublication[] = [];
function fauxZernio(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    async envoyer(d) {
      demandes.push(d);
      return { idExterne: `exemple-post-${demandes.length}`, via: "zernio" as const, statut: "brouillon" as const };
    },
    async listerCanaux() {
      return canauxZernio;
    },
  };
}

beforeAll(async () => {
  await preparerMotDePasse("essai-fix-cible");
});

beforeEach(async () => {
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  await ecrireReglageCalendrier(PARAM_ENVOI_CALENDRIER, true);
  reinitialiserRequete();
  await auth.seConnecter("essai-fix-cible", false);
  etat.zernio = fauxZernio();
  demandes = [];
  canauxZernio = [canal("zernio-fb-axion-111111", "Axion-IA.com"), canal("zernio-fb-exemple-222222", "Williams")];
  await ecrireParametre(PARAM_CANAUX, { lusLe: new Date().toISOString(), canaux: CANAUX_BUFFER });
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("FIX-CIBLE · réessai par Zernio avec la page cochée", () => {
  it("page cochée de nom unique chez Zernio : un brouillon, sur le compte Zernio traduit", async () => {
    const r = await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [BUF_AXION] });
    expect(r.ok).toBe(true);
    expect(demandes).toHaveLength(1);
    expect(demandes[0].cible).toBe("zernio-fb-axion-111111");
    expect(JSON.stringify(demandes)).not.toContain(BUF_AXION);
    const toutes = await depots().publications.lister((p) => p.videoId === VIDEO && p.via === "zernio");
    expect(toutes).toHaveLength(1);
    expect(toutes[0].statut).toBe("brouillon");
  });

  it("deux comptes Zernio du même nom : refus clair qui nomme les choix, rien ne part", async () => {
    canauxZernio = [canal("zernio-fb-axion-111111", "Axion-IA.com"), canal("zernio-fb-axion-333333", "Axion-IA.com"), canal("zernio-fb-exemple-222222", "Williams")];
    const r = await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio", comptes: [BUF_AXION] });
    const texte = JSON.stringify(r);
    expect(texte).toContain("Axion-IA.com");
    expect(texte).toContain("…111111");
    expect(texte).toContain("…333333");
    expect(texte).not.toContain("aucune cible par défaut");
    expect(demandes).toHaveLength(0);
    expect(await depots().publications.lister((p) => p.videoId === VIDEO && p.via === "zernio")).toHaveLength(0);
  });

  it("rien de coché : le message dit quoi faire et nomme les pages reliées", async () => {
    const r = await envoyerParOutilAction(VIDEO, "facebook", DEMAIN, { outil: "zernio" });
    const texte = JSON.stringify(r);
    expect(texte).toContain("Cochez la page");
    expect(texte).toContain("Axion-IA.com");
    expect(texte).toContain("Williams");
    expect(demandes).toHaveLength(0);
  });
});
