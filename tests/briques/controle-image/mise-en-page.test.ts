import { describe, expect, it } from "vitest";
import {
  controleBandeSousTitres,
  controleContraste,
  controlePremiereImage,
  controleTailleTexte,
  controleZoneSure,
  zoneSureDe,
  type Boite,
  type MiseEnPage,
} from "../../../src/briques/controle-image";
import { obtenirReseau } from "../../../src/reseaux";

const ENCRE = "#110A05";
const PAGE = "#E9DCC8";
const ORANGE = "#B44F29";

const ACCROCHE: Boite = { role: "accroche", texte: "Votre patron peut-il lire vos messages ?", taille: 0.058, couleur: ENCRE, fond: PAGE, x: 0.1, y: 0.2, largeur: 0.6, hauteur: 0.12, debutSec: 0 };
const CORPS: Boite = { role: "texte", texte: "Non, sauf exception", taille: 0.04, couleur: ENCRE, fond: PAGE, x: 0.1, y: 0.36, largeur: 0.6, hauteur: 0.08, debutSec: 2.5 };
const SOULIGNE: Boite = { role: "marque", couleur: ORANGE, fond: PAGE, x: 0.1, y: 0.45, largeur: 0.4, hauteur: 0.01, debutSec: 3 };
const BONNE: MiseEnPage = { boites: [ACCROCHE, CORPS, SOULIGNE] };
const ZONE = zoneSureDe("9:16", ["tiktok", "instagram"])!;

describe("contrôle de l'image finale — mise en page", () => {
  it("lit la zone sûre dans le registre des réseaux, en fractions", () => {
    const tt = obtenirReseau("tiktok").zonesProtegees["9:16"]!;
    const ig = obtenirReseau("instagram").zonesProtegees["9:16"]!;
    expect(ZONE.bas).toBeCloseTo(Math.max(tt.bas, ig.bas) / 100, 6);
    expect(ZONE.droite).toBeCloseTo(Math.max(tt.droite, ig.droite) / 100, 6);
    expect(zoneSureDe("16:9", ["tiktok"])).toBeNull();
  });

  it("zone sûre : réussie dedans, échouée dehors en nommant la boîte", () => {
    expect(controleZoneSure(BONNE, ZONE)).toMatchObject({ etat: "reussi", raison: "Tout est dans la zone sûre." });
    const dehors = { boites: [{ ...CORPS, x: 0.3, largeur: 0.6 }] };
    expect(controleZoneSure(dehors, ZONE)).toMatchObject({ etat: "echoue", raison: "Hors zone sûre, caché par les boutons du réseau : « Non, sauf exception »." });
    expect(controleZoneSure(BONNE, null).etat).toBe("non-fait");
  });

  it("bande des sous-titres : rien dedans réussit, une boîte qui la touche échoue", () => {
    expect(controleBandeSousTitres(BONNE, ZONE)).toMatchObject({ etat: "reussi", raison: "Rien dans la bande réservée aux sous-titres." });
    const bas = 1 - ZONE.bas;
    const dedans = { boites: [ACCROCHE, { ...SOULIGNE, y: bas - 0.05 }] };
    expect(controleBandeSousTitres(dedans, ZONE)).toMatchObject({ etat: "echoue", raison: "Dans la bande réservée aux sous-titres : la marque n° 2." });
  });

  it("taille du texte : 3 % de la hauteur au moins ; une marque n'a pas de taille", () => {
    expect(controleTailleTexte(BONNE)).toMatchObject({ etat: "reussi", raison: "Tout texte fait au moins 3 % de la hauteur." });
    const petit = { boites: [{ ...CORPS, taille: 0.025 }, SOULIGNE] };
    expect(controleTailleTexte(petit)).toMatchObject({ etat: "echoue", raison: "Texte trop petit (moins de 3 % de la hauteur) : « Non, sauf exception » (2,5 %)." });
  });

  it("contraste : 7 pour 1 pour un texte, 3 pour 1 pour une marque", () => {
    expect(controleContraste(BONNE)).toMatchObject({ etat: "reussi" });
    // L'orange suffit pour une marque mais pas pour un texte.
    const texteOrange = { boites: [{ ...CORPS, couleur: ORANGE }] };
    const r = controleContraste(texteOrange);
    expect(r.etat).toBe("echoue");
    expect(r.raison).toMatch(/^Contraste insuffisant : « Non, sauf exception » \(\d,\d pour 1, il faut 7 pour 1\)\.$/);
    const marquePale = { boites: [{ ...SOULIGNE, couleur: "#D8C8B0" }] };
    expect(controleContraste(marquePale).raison).toMatch(/^Contraste insuffisant : la marque n° 1 \(1,\d pour 1, il faut 3 pour 1\)\.$/);
    expect(controleContraste({ boites: [{ ...CORPS, couleur: "rouge" }] }).raison).toBe("Contraste insuffisant : « Non, sauf exception » (couleur illisible).");
  });

  it("première image : accroche présente, ≤ 8 mots, lisible", () => {
    expect(controlePremiereImage(BONNE)).toMatchObject({ etat: "reussi", raison: "Accroche lisible dès la première image (7 mots)." });
    expect(controlePremiereImage({ boites: [CORPS] })).toMatchObject({ etat: "echoue", raison: "Aucune accroche sur la première image : sans le son, rien ne dit de quoi parle la vidéo." });
    expect(controlePremiereImage({ boites: [{ ...ACCROCHE, debutSec: 1 }] }).etat).toBe("echoue");
    const longue = { boites: [{ ...ACCROCHE, texte: "Votre patron peut-il vraiment lire tous vos messages privés ?" }] };
    expect(controlePremiereImage(longue)).toMatchObject({ etat: "echoue", raison: "Accroche trop longue pour être lue d'un coup d'œil : 10 mots, 8 au plus." });
    expect(controlePremiereImage({ boites: [{ ...ACCROCHE, taille: 0.02 }] }).raison).toBe("Accroche trop petite pour être lue : moins de 3 % de la hauteur.");
    expect(controlePremiereImage({ boites: [{ ...ACCROCHE, couleur: ORANGE }] }).raison).toMatch(/^Accroche peu lisible : contraste de \d,\d pour 1, il faut 7 pour 1\.$/);
  });
});
