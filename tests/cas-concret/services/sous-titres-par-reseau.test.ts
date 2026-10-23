/**
 * L0d (15/10, analyse A1) : le fichier .srt / .vtt d'un réseau porte SA fin (« Le lien est en premier commentaire. »
 * pour LinkedIn), plus seulement celle de Facebook. Fonctions pures.
 */
import { describe, expect, it } from "vitest";
import type { SegmentSousTitres } from "@/domaine/types";
import { liensSousTitresParReseau, sousTitresDuReseau } from "@/services/sous-titres-par-reseau";

const seg = (texte: string): SegmentSousTitres[] => [{ id: "g1", debutSec: 0, finSec: 1, mots: texte.split(" ").map((mot, i) => ({ mot, debutSec: i * 0.2, finSec: i * 0.2 + 0.2 })) }];

const projet = {
  moteur: "montage-cas-concret",
  casConcret: {
    fins: [
      { id: "fin-1", reseaux: ["facebook"], fichierCle: "a.mp4", sousTitres: seg("Le lien est en commentaire.") },
      { id: "fin-2", reseaux: ["instagram", "tiktok"], fichierCle: "b.mp4", sousTitres: seg("Le lien est dans mon profil.") },
      { id: "fin-3", reseaux: ["linkedin"], fichierCle: "c.mp4", sousTitres: seg("Le lien est en premier commentaire.") },
    ],
  },
};

describe("L0d · sous-titres par réseau", () => {
  it("chaque réseau reçoit les sous-titres de SA fin", () => {
    expect(sousTitresDuReseau(projet, "linkedin")).toEqual(seg("Le lien est en premier commentaire."));
    expect(sousTitresDuReseau(projet, "tiktok")).toEqual(seg("Le lien est dans mon profil."));
    expect(sousTitresDuReseau(projet, "facebook")).toEqual(seg("Le lien est en commentaire."));
  });

  it("réseau inconnu, ancienne vidéo sans sous-titres par fin, autre format : rien (l'export habituel reste)", () => {
    expect(sousTitresDuReseau(projet, "youtube")).toBeNull();
    expect(sousTitresDuReseau({ casConcret: { fins: [{ id: "fin-1", reseaux: ["facebook"] }] } }, "facebook")).toBeNull();
    expect(sousTitresDuReseau({ moteur: "montage-avocat" }, "facebook")).toBeNull();
    expect(sousTitresDuReseau(undefined, "facebook")).toBeNull();
  });

  it("liens : un .srt et un .vtt par réseau, dans l'ordre des fins ; aucun sans sous-titres par fin", () => {
    const liens = liensSousTitresParReseau("v-1", projet);
    expect(liens.map((l) => l.reseau)).toEqual(["facebook", "instagram", "tiktok", "linkedin"]);
    expect(liens[3]).toEqual({ reseau: "linkedin", nom: "LinkedIn", srt: "/api/sous-titres/v-1?format=srt&reseau=linkedin", vtt: "/api/sous-titres/v-1?format=vtt&reseau=linkedin" });
    expect(liensSousTitresParReseau("v-1", { moteur: "montage-avocat" })).toEqual([]);
  });
});
