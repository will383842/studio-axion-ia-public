/**
 * L4-14 : toute vidéo programmée entre UNE fois au calendrier ; le rejeu ne crée pas de doublon ; aucun appel de plus
 * vers le diffuseur ; si le crochet échoue, l'envoi se comporte comme avant. Dépôts en mémoire, diffuseur doublé, aucun réseau.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import type { CanalPublication, DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { listerEntrees } from "@/services/calendrier";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";
process.env.ZERNIO_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0004";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const planVideo = await import("@/services/plan-video");

const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const CANAUX: CanalPublication[] = [
  { id: "exemple-ig", organisationId: "zernio", nom: "Exemple IG", service: "instagram", deconnecte: false },
  { id: "exemple-li", organisationId: "zernio", nom: "Exemple LI", service: "linkedin", deconnecte: false },
];

let demandes: DemandePublication[] = [];
let comportement: "ok" | "a-verifier" = "ok";
function faux(): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    async envoyer(d) {
      demandes.push(d);
      if (comportement === "a-verifier") throw new (await import("@/fournisseurs/publication/zernio-erreurs")).ErreurZernio("a-verifier", "délai dépassé");
      return { idExterne: `exemple-post-${demandes.length}`, via: "zernio" as const, statut: "brouillon" as const };
    },
    async listerCanaux() {
      return CANAUX;
    },
  };
}

async function envoyer(reseaux: ("instagram" | "linkedin")[] = ["instagram"]) {
  const kit = (await pub.obtenirKit(VIDEO))!;
  return pub.envoyerReel("zernio", faux(), kit, reseaux, DEMAIN, {}, {}, false);
}
const creneauxDeLaVideo = () => depots().creneauxEditoriaux.lister((c) => c.videoId === VIDEO);

beforeAll(async () => {
  await preparerMotDePasse("essai-l4-14");
});

beforeEach(async () => {
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  vi.restoreAllMocks();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter("essai-l4-14", false);
  demandes = [];
  comportement = "ok";
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("L4-14 · une vidéo programmée entre une fois au calendrier", () => {
  it("un envoi confirmé inscrit un créneau « programme » de la vidéo, au jour et à l'heure de l'envoi", async () => {
    const r = await envoyer();
    const liste = await creneauxDeLaVideo();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ statut: "programme", videoId: VIDEO, decalages: 0 });
    expect(liste[0].heuresParReseau.instagram).toBe(r.publications[0].date);
    expect(liste[0].id.startsWith("cmd-")).toBe(false);
  });

  it("deux réseaux le même jour : un seul créneau, les deux heures dedans", async () => {
    await envoyer(["instagram", "linkedin"]);
    const liste = await creneauxDeLaVideo();
    expect(liste).toHaveLength(1);
    expect(Object.keys(liste[0].heuresParReseau).sort()).toEqual(["instagram", "linkedin"]);
  });

  it("rejouer l'action : aucun doublon (créneau, publication) et aucun appel de plus vers le diffuseur", async () => {
    await envoyer();
    await envoyer();
    await envoyer();
    expect(demandes).toHaveLength(1);
    expect(await creneauxDeLaVideo()).toHaveLength(1);
    expect(await depots().publications.lister((p) => p.videoId === VIDEO)).toHaveLength(1);
  });

  it("le calendrier montre l'entrée UNE seule fois (la publication fait foi)", async () => {
    await envoyer();
    const jour = (await depots().publications.lister((p) => p.videoId === VIDEO))[0].date.slice(0, 10);
    const d = depots();
    const vue = await listerEntrees({ creneaux: d.creneauxEditoriaux, publications: d.publications, videos: d.videos, visuels: d.visuels }, "2000-01-01", "2100-01-01");
    expect(vue.filter((e) => e.mediaId === VIDEO)).toHaveLength(1);
    expect(jour).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("l'inscription ne déclenche aucun envoi et ne touche pas au diffuseur", async () => {
    const d = depots();
    const p = { id: "pub-x", videoId: VIDEO, reseau: "instagram", statut: "programmee", via: "zernio", date: DEMAIN, texte: "t", etatEnvoi: "envoye", canalId: "exemple-ig", creeLe: DEMAIN, modifieLe: DEMAIN } as never;
    await planVideo.inscrireVideoAuCalendrier(d.creneauxEditoriaux as never, [p]);
    await planVideo.inscrireVideoAuCalendrier(d.creneauxEditoriaux as never, [p]);
    expect(demandes).toHaveLength(0);
    expect(await creneauxDeLaVideo()).toHaveLength(1);
  });

  it("envoi à vérifier ou refusé : rien n'entre au calendrier", async () => {
    comportement = "a-verifier";
    await envoyer();
    expect(await creneauxDeLaVideo()).toHaveLength(0);
  });

  it("un créneau archivé ou publié du même jour n'est ni rouvert ni modifié", async () => {
    await envoyer();
    const [c] = await creneauxDeLaVideo();
    await depots().creneauxEditoriaux.enregistrer({ ...c, statut: "archive" });
    const p = (await depots().publications.lister((x) => x.videoId === VIDEO))[0];
    await planVideo.inscrireVideoAuCalendrier(depots().creneauxEditoriaux as never, [{ ...p, reseau: "linkedin" }]);
    expect((await creneauxDeLaVideo())[0]).toMatchObject({ statut: "archive", heuresParReseau: c.heuresParReseau });
  });

  it("si le crochet échoue, l'envoi programmé se comporte exactement comme avant", async () => {
    vi.spyOn(depots().creneauxEditoriaux, "enregistrer").mockRejectedValue(new Error("panne du plan"));
    const r = await envoyer();
    expect(r.publications).toHaveLength(1);
    expect(r.publications[0]).toMatchObject({ via: "zernio", etatEnvoi: "envoye" });
    expect(r.problemes ?? []).toEqual([]);
    expect(demandes).toHaveLength(1);
  });
});
