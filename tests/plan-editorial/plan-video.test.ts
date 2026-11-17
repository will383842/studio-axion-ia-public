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
import { creneauxOccupes } from "@/services/cadence";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";
process.env.ZERNIO_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0004";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Le diffuseur de l'outil « zernio » est la doublure du test : aucun réseau, aucun fournisseur réel.
const doublure = vi.hoisted(() => ({ service: null as unknown }));
vi.mock("@/fournisseurs", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/fournisseurs")>();
  return { ...reel, fournisseurParId: (type: string, id: string) => (type === "publication" && id === "zernio" && doublure.service ? doublure.service : reel.fournisseurParId(type as never, id as never)) };
});

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
  return pub.envoyerReel("zernio", faux(), kit, reseaux, DEMAIN, { linkedin: ["exemple-li"] }, {}, false);
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
  doublure.service = faux();
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});

describe("L4-14 · une vidéo programmée entre une fois au calendrier", () => {
  it("un envoi confirmé inscrit un créneau de la vidéo (statut du plan suivant celui de la publication), au jour et à l'heure de l'envoi", async () => {
    const r = await envoyer();
    const liste = await creneauxDeLaVideo();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ statut: "propose", videoId: VIDEO, decalages: 0 });
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

  it("le calendrier montre l'entrée UNE seule fois, et le plan la compte une fois comme occupée (échoue sans le crochet)", async () => {
    await envoyer();
    const d = depots();
    const vue = await listerEntrees({ creneaux: d.creneauxEditoriaux, publications: d.publications, videos: d.videos, visuels: d.visuels }, "2000-01-01", "2100-01-01");
    expect(vue.filter((e) => e.mediaId === VIDEO)).toHaveLength(1);
    const occupes = await creneauxOccupes(d.creneauxEditoriaux, "2000-01-01", "2100-01-01", { reseau: "instagram" });
    expect(occupes.filter((o) => o.creneauId.includes(VIDEO))).toHaveLength(1);
  });

  it("le statut du créneau suit celui de la publication : un brouillon chez le diffuseur n'est jamais « programme »", async () => {
    await envoyer();
    expect((await creneauxDeLaVideo())[0].statut).toBe("propose");
    const p = (await depots().publications.lister((x) => x.videoId === VIDEO))[0];
    const jour = p.date.slice(0, 10);
    await planVideo.inscrireVideoAuCalendrier(depots().creneauxEditoriaux as never, [{ ...p, videoId: "v-02", statut: "programmee" }]);
    expect((await depots().creneauxEditoriaux.lister((c) => c.videoId === "v-02"))[0]).toMatchObject({ statut: "programme", jourVise: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(jour).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("un créneau du plan (autre identifiant, ex. « cmd- ») qui porte déjà cette vidéo, ce jour et ce réseau : aucun second créneau", async () => {
    const jourVise = DEMAIN.slice(0, 10);
    await depots().creneauxEditoriaux.enregistrer({ id: "cmd-existant", jourVise, heuresParReseau: { instagram: DEMAIN }, compteCible: "exemple-ig", videoId: VIDEO, statut: "valide", decalages: 0 });
    const { cleJour } = await import("@/lib/dates");
    await depots().creneauxEditoriaux.enregistrer({ ...(await depots().creneauxEditoriaux.obtenir("cmd-existant"))!, jourVise: cleJour(DEMAIN) });
    await envoyer();
    const liste = await creneauxDeLaVideo();
    expect(liste.map((c) => c.id)).toEqual(["cmd-existant"]);
  });

  it("deux envois parallèles de deux réseaux le même jour : les deux heures sont gardées dans un seul créneau", async () => {
    const kit = (await pub.obtenirKit(VIDEO))!;
    await Promise.all([
      pub.envoyerReel("zernio", faux(), kit, ["instagram"], DEMAIN, {}, {}, false),
      pub.envoyerReel("zernio", faux(), kit, ["linkedin"], DEMAIN, { linkedin: ["exemple-li"] }, {}, false),
    ]);
    const liste = await creneauxDeLaVideo();
    expect(liste).toHaveLength(1);
    expect(Object.keys(liste[0].heuresParReseau).sort()).toEqual(["instagram", "linkedin"]);
  });

  it("une date illisible ou sans « Z » est normalisée en instant UTC ; une date illisible n'écrit rien", async () => {
    const p = { id: "pub-n", videoId: VIDEO, reseau: "instagram", statut: "programmee", via: "zernio", texte: "t", etatEnvoi: "envoye", canalId: "exemple-ig", creeLe: DEMAIN, modifieLe: DEMAIN } as const;
    await planVideo.inscrireVideoAuCalendrier(depots().creneauxEditoriaux as never, [{ ...p, date: "2031-03-05T10:00:00+01:00" } as never]);
    await planVideo.inscrireVideoAuCalendrier(depots().creneauxEditoriaux as never, [{ ...p, date: "pas une date" } as never]);
    const liste = await creneauxDeLaVideo();
    expect(liste).toHaveLength(1);
    expect(liste[0].heuresParReseau.instagram).toBe("2031-03-05T09:00:00.000Z");
  });

  it("entrée « fiche vidéo » (envoyerVersBufferAction) : un seul créneau, un seul appel au diffuseur, même après un second clic", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("buffer.gele", false);
    const actions = await import("@/app/(studio)/videos/actions");
    const a = await actions.envoyerVersBufferAction(VIDEO, ["instagram"], DEMAIN);
    const b = await actions.envoyerVersBufferAction(VIDEO, ["instagram"], DEMAIN);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(demandes).toHaveLength(1);
    expect(await creneauxDeLaVideo()).toHaveLength(1);
  });

  it("entrée « Programmer les N » (envoyerVersBuffer, appelé pour chaque créneau par programmerSujet) : un seul créneau, aucun appel de plus au rejeu", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("buffer.gele", false);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN);
    expect(demandes).toHaveLength(1);
    expect(await creneauxDeLaVideo()).toHaveLength(1);
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
