/**
 * Un seul chemin pour créer une vidéo (18/10) : la barre latérale n'a plus aucun raccourci de création. Le menu est le même
 * quel que soit le statut des formats ; tout passe par « Nouvelle vidéo ».
 */
import { describe, expect, it } from "vitest";
import { NAV_LATERALE, navigationLaterale } from "../../../src/components/coquille/navigation";

type F = { id: string; statut: "actif" | "bientot" | "masque" };
const tableau = (statut: F["statut"]): F => ({ id: "tableau-anime", statut });
const cas = (statut: F["statut"]): F => ({ id: "cas-concret", statut });
const avocat: F = { id: "avocat", statut: "actif" };

// Menu à 7 rubriques (12/11, refonte R2 : « Tous mes contenus » et « Mes modèles » ont quitté la barre), pied « Réglages » ; Veille et Outils motion passent par la recherche et la Bibliothèque.
const LIBELLES = ["Accueil", "Nouvelle vidéo", "Écrire", "Vidéos", "Carrousels", "Calendrier", "Réponses automatiques", "Résultats", "Personnages", "Bibliothèque", "Réglages"];
const INTERDITS = ["/tableau/nouvelle", "/cas-concret", "/image-video", "/face-camera-animee"];

describe("navigationLaterale", () => {
  it("le menu est fixe : Accueil, Nouvelle vidéo, Écrire, Vidéos, Carrousels, puis le reste", () => {
    expect(NAV_LATERALE.map((e) => e.libelle)).toEqual(LIBELLES);
  });

  it("aucune entrée vers un générateur, quel que soit le statut des formats", () => {
    for (const statut of ["actif", "bientot", "masque"] as const) {
      const menu = navigationLaterale([avocat, tableau(statut), cas(statut), { id: "image-video", statut }, { id: "facecam-animee", statut }]);
      expect(menu).toBe(NAV_LATERALE);
      for (const e of menu) for (const interdit of INTERDITS) expect(e.href.startsWith(interdit)).toBe(false);
    }
    expect(navigationLaterale([])).toBe(NAV_LATERALE);
  });

  it("NAV_LATERALE n'est pas modifié par les appels", () => {
    navigationLaterale([tableau("actif"), cas("actif")]);
    expect(NAV_LATERALE.map((e) => e.libelle)).toEqual(LIBELLES);
  });
});
