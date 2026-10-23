/**
 * Formats par réseau, T5 (fonctions pures) : `format.ratios` ne bride plus la sortie.
 *  - `formatsVoulus` : les formats déjà choisis, plus le format préféré de chaque réseau, limités à ce que le moteur sait
 *    faire ; jamais de 16:9 ajouté d'office à un générateur au format maître vertical (décision 3 du 18/10) ;
 *  - `ratiosDeLaMere` : la mère reçoit le 4:5 de LinkedIn quand LinkedIn est dans le sujet (et que le moteur le sait faire) ;
 *  - tableau animé : LinkedIn passe du carré au 4:5 SANS la fin au mot (décision 1), nouvelle sortie `portrait-linkedin`
 *    à côté du portrait du fil, comme le vertical « liens ».
 */
import { describe, expect, it } from "vitest";
import type { Ratio } from "@/domaine/types";
import { formatsVoulus, meilleureSortie } from "@/reseaux/sorties";
import { ratiosDeLaMere, zoneAuMoins } from "@/briques/declinaison";
import {
  descriptionSortie,
  formatImage,
  lireSorties,
  PORTRAIT_LINKEDIN,
  reseauxDeLaSortie,
  sansAppelAuMot,
  sortiesDesReseaux,
  zoneSureFormat,
  IDS_SORTIES,
  SORTIES_SANS_APPEL_AU_MOT,
} from "@/moteurs/montage-tableau/formats-sortie";
import { destinationDeLaSortie } from "@/moteurs/montage-tableau";
import { RESEAUX_SCRIPT_INFOS } from "@/domaine/scripts-tableau";
import { reseauDeLaSortie } from "@/services/tableau-fin";

const TOUS: Ratio[] = ["9:16", "4:5", "1:1", "16:9"];

describe("T5 · formatsVoulus", () => {
  it("LinkedIn (9:16, décision de Will du 19/10) n'ajoute aucun 4:5 aux formats déjà choisis", () => {
    expect(formatsVoulus(["9:16"], ["linkedin", "instagram", "tiktok"], ["9:16", "4:5", "1:1"])).toEqual(["9:16"]);
  });

  it("le moteur ne sait pas faire le 4:5 : rien n'est ajouté", () => {
    expect(formatsVoulus(["9:16"], ["linkedin"], ["9:16"])).toEqual(["9:16"]);
  });

  it("aucun format déjà choisi n'est retiré ni déplacé", () => {
    expect(formatsVoulus(["9:16", "1:1"], ["linkedin"], ["9:16", "4:5", "1:1"])).toEqual(["9:16", "1:1"]);
    expect(formatsVoulus(["4:5"], ["tiktok"], ["9:16", "4:5"])).toEqual(["4:5", "9:16"]);
  });

  it("décision 3 : jamais de 16:9 ajouté d'office quand le format maître est vertical, même si le moteur sait le faire", () => {
    expect(formatsVoulus(["9:16"], ["youtube", "linkedin"], TOUS, "9:16")).toEqual(["9:16"]);
  });

  it("format maître horizontal : le 16:9 de YouTube est permis", () => {
    expect(formatsVoulus(["16:9"], ["youtube", "tiktok"], TOUS, "16:9")).toEqual(["16:9", "9:16"]);
  });

  it("relecture n° 8 : sans format maître donné, le 9:16 vaut par défaut : jamais de 16:9 ajouté d'office", () => {
    expect(formatsVoulus(["9:16"], ["youtube"], TOUS)).toEqual(["9:16"]);
    expect(formatsVoulus(["9:16"], ["youtube", "linkedin"], TOUS)).toEqual(["9:16"]);
  });

  it("aucun réseau : la base, telle quelle, sans doublon", () => {
    expect(formatsVoulus(["9:16", "9:16"], [], TOUS)).toEqual(["9:16"]);
  });
});

describe("T5 · mère et versions du générateur de déclinaisons", () => {
  it("sans réseau : comportement d'avant (9:16 + options)", () => {
    expect(ratiosDeLaMere()).toEqual(["9:16"]);
    expect(ratiosDeLaMere(["1:1"])).toEqual(["9:16", "1:1"]);
    expect(ratiosDeLaMere(["4:5", "1:1"])).toEqual(["9:16", "4:5", "1:1"]);
  });

  it("LinkedIn dans le sujet : la mère reste en 9:16, les options cochées gardent l'ordre 9:16, 4:5, 1:1", () => {
    expect(ratiosDeLaMere([], ["instagram", "linkedin", "tiktok"], ["9:16", "4:5", "1:1"])).toEqual(["9:16"]);
    expect(ratiosDeLaMere(["1:1"], ["linkedin"], ["9:16", "4:5", "1:1"])).toEqual(["9:16", "1:1"]);
  });

  it("moteur sans 4:5 : rien n'est ajouté ; une option cochée reste (comportement d'avant)", () => {
    expect(ratiosDeLaMere([], ["linkedin"], ["9:16"])).toEqual(["9:16"]);
    expect(ratiosDeLaMere(["1:1"], ["linkedin"], ["9:16"])).toEqual(["9:16", "1:1"]);
  });

  it("jamais de 16:9 (prise verticale, décision 3), même pour YouTube et un moteur qui le sait faire", () => {
    expect(ratiosDeLaMere([], ["youtube"], TOUS)).toEqual(["9:16"]);
  });

  it("version d'un réseau dans le format de son réseau : tous les réseaux, LinkedIn compris → 9:16", () => {
    expect(ratiosDeLaMere([], ["linkedin"], ["9:16", "4:5", "1:1"])).toEqual(["9:16"]);
    expect(ratiosDeLaMere([], ["instagram"], ["9:16", "4:5", "1:1"])).toEqual(["9:16"]);
    expect(ratiosDeLaMere([], ["facebook"], ["9:16", "4:5", "1:1"])).toEqual(["9:16"]);
  });
});

describe("T5 · tableau animé : LinkedIn en 4:5 sans la fin au mot", () => {
  it("la case LinkedIn donne la sortie `portrait-linkedin` (plus le carré)", () => {
    expect(PORTRAIT_LINKEDIN).toBe("portrait-linkedin");
    expect(sortiesDesReseaux(["linkedin"])).toEqual([PORTRAIT_LINKEDIN]);
    expect(sortiesDesReseaux(["verticaux", "fil-instagram-facebook", "linkedin", "youtube"])).toEqual(["vertical", "vertical-liens", "portrait", PORTRAIT_LINKEDIN, "horizontal"]);
  });

  it("nouvelle sortie à côté du portrait du fil, comme le vertical « liens » : format d'image portrait, jamais l'appel au mot", () => {
    expect(IDS_SORTIES).toEqual(["vertical", "vertical-liens", "portrait", PORTRAIT_LINKEDIN, "carre", "horizontal"]);
    expect(formatImage(PORTRAIT_LINKEDIN)).toBe("portrait");
    expect(sansAppelAuMot(PORTRAIT_LINKEDIN)).toBe(true);
    expect(SORTIES_SANS_APPEL_AU_MOT).toContain(PORTRAIT_LINKEDIN);
    expect(lireSorties("vertical,portrait-linkedin")).toEqual(["vertical", PORTRAIT_LINKEDIN]);
  });

  it("décision du 19/10 : le générateur de scripts dit « Vertical plein écran » pour LinkedIn (plus « Portrait 4:5 »)", () => {
    expect(RESEAUX_SCRIPT_INFOS.linkedin.dimensions).toBe("Vertical plein écran");
  });

  it("le carré reste connu et sans appel au mot (vidéos déjà faites)", () => {
    expect(sansAppelAuMot("carre")).toBe(true);
    expect(lireSorties("carre")).toEqual(["carre"]);
  });

  it("description : 1080 × 1350, LinkedIn seul", () => {
    const d = descriptionSortie(PORTRAIT_LINKEDIN, ["vertical", "portrait", PORTRAIT_LINKEDIN]);
    expect(d).toMatchObject({ sortie: PORTRAIT_LINKEDIN, ratio: "4:5", largeur: 1080, hauteur: 1350, libelle: "Portrait 4:5 · LinkedIn" });
    expect(d.reseaux.map((r) => r.libelle)).toEqual(["LinkedIn"]);
  });

  it("la zone sûre de la mise en page portrait (partagée) couvre celle de LinkedIn en 4:5", () => {
    expect(zoneAuMoins(zoneSureFormat("portrait"), descriptionSortie(PORTRAIT_LINKEDIN).reseaux[0].zone)).toBe(true);
  });

  it("réseaux du fichier : LinkedIn seul ; la fin est tirée pour LinkedIn", () => {
    expect(reseauxDeLaSortie(PORTRAIT_LINKEDIN, ["vertical", "portrait", PORTRAIT_LINKEDIN])).toEqual(["linkedin"]);
    expect(reseauDeLaSortie(PORTRAIT_LINKEDIN, { reseaux: ["instagram"] }, ["vertical", PORTRAIT_LINKEDIN])).toBe("linkedin");
  });

  it("le fichier dit LinkedIn et une fin propre ; en 4:5 il n'est plus le format préféré de LinkedIn : le carré d'une vidéo d'avant passe avant (ordre du registre)", () => {
    const faites = ["vertical", "portrait", PORTRAIT_LINKEDIN] as const;
    expect(destinationDeLaSortie(PORTRAIT_LINKEDIN, faites)).toEqual({ reseaux: ["linkedin"], appelAuMot: false });
    const fichiers = [
      { id: "p", ratio: "4:5" as Ratio, appelAuMot: true, reseaux: ["instagram", "facebook"] as const },
      { id: "c", ratio: "1:1" as Ratio, appelAuMot: false, reseaux: ["linkedin"] as const },
      { id: "pl", ratio: "4:5" as Ratio, ...destinationDeLaSortie(PORTRAIT_LINKEDIN, faites) },
    ];
    expect(meilleureSortie("linkedin", fichiers)?.id).toBe("c");
    expect(meilleureSortie("instagram", fichiers)?.id).toBe("p");
  });
});
