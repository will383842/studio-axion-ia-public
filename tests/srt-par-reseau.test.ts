/**
 * GV2-25 : un fichier de sous-titres par réseau (cas concret, image → vidéo, tableau) lu par les téléchargements.
 * Un ancien projet sans ces champs garde la liste générique de la vidéo.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import type { SegmentSousTitres } from "@/domaine/types";

delete process.env.BUFFER_API_KEY;
process.env.FOURNISSEUR_PUBLICATION = "simulation";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/services/image-video-carte", () => ({ travailImageVideo: async () => null }));
vi.mock("@/services/_commun", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...m,
    fournisseur: async (nom: string) => {
      const f = await (m.fournisseur as (n: string) => Promise<Record<string, unknown>>)(nom);
      return nom === "stockage" ? { ...f, urlLecture: async (cle: string) => `https://stockage.test/${cle}` } : f;
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const tel = await import("@/services/telechargements");
const { sousTitresDuReseau } = await import("@/services/sous-titres-par-reseau");

const MDP = "essai-srt-par-reseau";
const seg = (texte: string): SegmentSousTitres[] => [{ id: "g1", debutSec: 0, finSec: 1, mots: texte.split(" ").map((mot, i) => ({ mot, debutSec: i * 0.2, finSec: i * 0.2 + 0.2 })) }];
const derniereLigne = (srt: string) => srt.trim().split(/\r?\n/).filter(Boolean).at(-1);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Ne garde qu'UNE vidéo validée, avec ce projet de montage sur sa version choisie, et rend le zip du réseau. */
async function zipAvec(reseau: "instagram" | "linkedin" | "facebook", projetMontage: Record<string, unknown>) {
  const toutes = await depots().videos.lister(() => true);
  const video = (await Promise.all(toutes.filter((v) => v.statut === "prete" && v.versionChoisieId && !v.corbeilleLe).map(async (v) => ((await tel.reseauxDeVideoStockee(v, [reseau])).reseaux.includes(reseau) ? v : null)))).find(Boolean)!;
  expect(video, "une vidéo d'essai pour ce réseau").toBeTruthy();
  for (const v of toutes) await depots().videos.modifier(v.id, { etapeEditoriale: v.id === video.id ? "validee" : "a_relire" });
  await depots().versions.modifier(video.versionChoisieId!, { projetMontage } as never);
  const contenu = await tel.contenuArchiveValidees(reseau);
  const srt = contenu.entrees.find((e) => e.nom.endsWith(".srt"));
  return srt && "contenu" in srt ? srt.contenu : undefined;
}

describe("GV2-25 · un .srt par réseau dans le zip", () => {
  it("cas concret à deux fins : le zip du second réseau finit par la phrase de SA fin", async () => {
    const srt = await zipAvec("linkedin", {
      moteur: "montage-cas-concret",
      casConcret: { fins: [{ id: "f1", reseaux: ["facebook"], sousTitres: seg("Le lien est en commentaire.") }, { id: "f2", reseaux: ["linkedin"], sousTitres: seg("Le lien est en premier commentaire.") }] },
    });
    expect(derniereLigne(srt!)).toBe("Le lien est en premier commentaire.");
  });

  it("tableau [vertical-liens, vertical] : le .srt d'Instagram porte la phrase d'appel", async () => {
    const srt = await zipAvec("instagram", {
      moteur: "montage-tableau",
      tableau: {
        sorties: [
          { format: "vertical-liens", ratio: "9:16", reseaux: ["tiktok", "youtube-shorts"], sousTitres: seg("Le lien est dans la description.") },
          { format: "vertical", ratio: "9:16", reseaux: ["instagram", "facebook"], sousTitres: seg("Écrivez GUIDE en commentaire.") },
        ],
      },
    });
    expect(derniereLigne(srt!)).toBe("Écrivez GUIDE en commentaire.");
  });

  it("image → vidéo à deux versions : chaque réseau a les sous-titres de sa version", async () => {
    const projet = (extra = {}) => ({
      moteur: "montage-image-video",
      imageVideo: {
        livraison: [
          { reseau: "linkedin", version: "longue", fichierCle: "studio/iv/li.mp4", sousTitres: seg("Version longue pour LinkedIn.") },
          { reseau: "facebook", version: "courte", fichierCle: "studio/iv/fb.mp4", sousTitres: seg("Version courte pour Facebook.") },
        ],
        ...extra,
      },
    });
    expect(derniereLigne((await zipAvec("linkedin", projet()))!)).toBe("Version longue pour LinkedIn.");
    expect(derniereLigne((await zipAvec("facebook", projet()))!)).toBe("Version courte pour Facebook.");
  });

  it("ancien projet sans ces champs : la liste générique de la vidéo reste", async () => {
    for (const projet of [{ moteur: "montage-tableau", tableau: { sorties: [{ format: "vertical", reseaux: ["instagram"] }] } }, { imageVideo: { livraison: [{ reseau: "instagram" }] } }, { casConcret: { fins: [{ reseaux: ["instagram"] }] } }]) {
      expect(sousTitresDuReseau(projet, "instagram")).toBeNull();
    }
    expect(sousTitresDuReseau(undefined, "instagram")).toBeNull();
    const avant = await zipAvec("instagram", { moteur: "montage-tableau", tableau: { sorties: [{ format: "vertical", reseaux: ["instagram"] }] } });
    const sans = await zipAvec("instagram", {});
    expect(avant).toBe(sans);
  });
});
