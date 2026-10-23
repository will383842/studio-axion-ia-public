/**
 * Lot C2 — style des cartes motion (« sobre » / « spectaculaire ») et placement plein écran.
 */
import { describe, expect, it } from "vitest";
import { carteExemple, IDS_MODELES_MOTION } from "@/briques/motion/catalogue";
import { miseEnPage, parametresCarteModele } from "@/briques/motion/demande";
import { carteExempleAxion, EXEMPLES_AXION } from "@/briques/motion/exemples-axion";
import { schemaCarteModele } from "@/briques/motion/schemas";
import { choisirStyleMotion, facteurTaille, lireDemandeStyle, placementDe, STYLE_MOTION_DEFAUT, ZONES_PLEIN } from "@/briques/motion/style";
import { taillePx } from "@/briques/motion/jetons";
import { CATALOGUE_MONTEUR, exemplesDemandes, STYLE_CARTE_MONTEUR } from "@/moteurs/montage-facecam/monteur/catalogue";

describe("choisirStyleMotion", () => {
  it("suit l'intensité : Sobre et Équilibré → sobre, Très dynamique → spectaculaire", () => {
    expect(choisirStyleMotion({ intensite: "sobre" })).toBe("sobre");
    expect(choisirStyleMotion({ intensite: "equilibre" })).toBe("sobre");
    expect(choisirStyleMotion({ intensite: "tres-dynamique" })).toBe("spectaculaire");
    expect(choisirStyleMotion({})).toBe(STYLE_MOTION_DEFAUT);
    expect(STYLE_MOTION_DEFAUT).toBe("sobre");
  });

  it("une demande explicite prime sur tout", () => {
    expect(choisirStyleMotion({ intensite: "sobre", demande: "Monteur, fais cette animation en spectaculaire" })).toBe("spectaculaire");
    expect(choisirStyleMotion({ intensite: "equilibre", demande: "plus spectaculaire !", habitude: "sobre" })).toBe("spectaculaire");
    expect(choisirStyleMotion({ intensite: "tres-dynamique", demande: "plus sobre", habitude: "spectaculaire" })).toBe("sobre");
    expect(choisirStyleMotion({ intensite: "tres-dynamique", demande: "sobre" })).toBe("sobre");
  });

  it("une habitude enregistrée prime sur l'intensité", () => {
    expect(choisirStyleMotion({ intensite: "sobre", habitude: "spectaculaire" })).toBe("spectaculaire");
    expect(choisirStyleMotion({ intensite: "tres-dynamique", habitude: ["Musique calme", "Les animations en sobre"] })).toBe("sobre");
    expect(choisirStyleMotion({ intensite: "sobre", habitude: ["Toujours en spectaculaire", "Zoom lent"] })).toBe("spectaculaire");
    // Une habitude qui ne parle pas de style laisse décider l'intensité.
    expect(choisirStyleMotion({ intensite: "tres-dynamique", habitude: ["Musique calme"] })).toBe("spectaculaire");
  });

  it("une demande qui ne parle pas de style ne change rien", () => {
    expect(choisirStyleMotion({ intensite: "tres-dynamique", demande: "montre les 3 étapes en orange" })).toBe("spectaculaire");
    expect(choisirStyleMotion({ intensite: "sobre", demande: "montre les 3 étapes en orange" })).toBe("sobre");
  });

  it("lit les phrases de Will", () => {
    expect(lireDemandeStyle("Fais cette animation en spectaculaire")).toBe("spectaculaire");
    expect(lireDemandeStyle("C'est trop, plus sobre s'il te plaît")).toBe("sobre");
    expect(lireDemandeStyle("moins spectaculaire")).toBe("sobre");
    expect(lireDemandeStyle("un peu moins sobre")).toBe("spectaculaire");
    expect(lireDemandeStyle("pas sobre, en SPECTACULAIRE")).toBe("spectaculaire");
    expect(lireDemandeStyle("plus lent")).toBeNull();
    expect(lireDemandeStyle("")).toBeNull();
    expect(lireDemandeStyle(null)).toBeNull();
  });
});

describe("style absent = rendu Sobre inchangé", () => {
  it("les paramètres d'une carte sans style ne portent ni style ni placement (concordance avec avant le lot C2)", () => {
    const mp = miseEnPage("9:16", "plein-ecran", 5);
    expect(mp).toEqual({ ratio: "9:16", largeur: 1080, hauteur: 1920, hauteurVideo: 1920, disposition: "plein-ecran", fps: 25, images: 125 });
    for (const id of IDS_MODELES_MOTION) {
      const p = parametresCarteModele(carteExemple(id), mp);
      expect(p.proprietes).not.toHaveProperty("style");
      expect(p.proprietes).not.toHaveProperty("placement");
      // Sans style, la même carte avec style « sobre » explicite ne diffère que par ce champ.
      const { style, ...reste } = { ...p.proprietes, style: "sobre" as const };
      expect(style).toBe("sobre");
      expect(reste).toEqual(p.proprietes);
    }
  });

  it("le placement par défaut : plein en plein écran, haut en moitié haute (écran partagé inchangé)", () => {
    expect(placementDe(miseEnPage("9:16", "plein-ecran", 5))).toBe("plein");
    expect(placementDe(miseEnPage("9:16", "moitie-haute", 5))).toBe("haut");
    expect(placementDe({ disposition: "moitie-haute", placement: "plein" })).toBe("haut");
    expect(placementDe({ disposition: "plein-ecran", placement: "haut" })).toBe("haut");
    expect(facteurTaille("haut", "corps")).toBe(1);
  });

  it("plein écran : textes des listes ≥ 4 % de la hauteur, aucun texte sous 3 %, contenu sans grand vide en bas", () => {
    const corps = taillePx("corps", 1920) * facteurTaille("plein", "corps");
    expect(corps / 1920).toBeGreaterThanOrEqual(0.04);
    for (const n of ["affiche", "titre", "corps", "legende"] as const) expect((taillePx(n, 1920) * facteurTaille("plein", n)) / 1920).toBeGreaterThanOrEqual(0.03);
    expect(ZONES_PLEIN["9:16"].bas).toBeLessThanOrEqual(0.2);
  });
});

describe("exemples Axion des planches", () => {
  it("sont valides pour chaque modèle et parlent de temps perdu, pas d'eau", () => {
    for (const id of IDS_MODELES_MOTION) expect(schemaCarteModele.safeParse(carteExempleAxion(id)).success).toBe(true);
    const texte = JSON.stringify(EXEMPLES_AXION).toLowerCase();
    expect(texte).toContain("perdez-vous du temps");
    expect(texte).not.toMatch(/goutte|dégâts|plomb/);
  });
});

describe("catalogue du monteur", () => {
  it("expose le style et la phrase d'aide « Fais cette animation en spectaculaire »", () => {
    expect(STYLE_CARTE_MONTEUR.styles).toEqual(["sobre", "spectaculaire"]);
    expect(CATALOGUE_MONTEUR.find((e) => e.type === "ajouterCarte")?.exemples).toContain("Fais cette animation en spectaculaire");
    expect(exemplesDemandes()).toContain("Fais cette animation en spectaculaire");
    expect(choisirStyleMotion({ demande: STYLE_CARTE_MONTEUR.exemple })).toBe("spectaculaire");
  });
});
