/**
 * DESSIN 3 · PREMIÈRE VIDÉO FABRIQUÉE (fiche réelle « relances de devis », `temoins/fiche-relances-prod.json`) : les
 * défauts vus sur les images, corrigés sans changer le style « blocs/2 ». Aucun appel.
 *  1. le récapitulatif n'écrit plus ses lignes deux fois (en gros en haut, puis dans la liste) ; aucun gabarit n'écrit
 *     deux fois la même ligne sur un écran ;
 *  2. plus d'écran presque vide : contrôle de remplissage (un tiers de vide au plus, hors marges) sur TOUS les gabarits,
 *     au minimum et au maximum de leurs bornes, dans les 5 formats ; les cartes des étapes montrent les pictogrammes
 *     de la fiche, celle de l'exemple ses panneaux remplis ;
 *  3. le texte annoncé (premier écran) est plein et atténué, plus en lettres creuses qui paraissaient dédoublées ;
 *  4. la page de la vidéo et l'écran de création ne montrent plus un arrêt ou un refus périmé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cadresVidesV2, controleRemplissageV2, partVideEcranV2, textesEnDoubleV2, VIDE_MAX_ECRAN } from "../../../src/briques/tableau-scene/v2/remplissage";
import type { EcranPlace } from "../../../src/briques/tableau-scene/v2/types";
import { refusDecoupagePerime } from "../../../src/components/formats/tableau-anime/vue";
import { GABARITS_ECRAN, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { IDS_FORMATS_SORTIE, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, type OptionsMiseEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { travailAffiche } from "../../../src/services/videos";
import { ficheAvec, ficheMin } from "../essai-3/gabarits-max";
import { EXEMPLES } from "../regles/exemples";
import { ficheFormation } from "../style-v2/temoin-formation";

const temoin = JSON.parse(readFileSync(new URL("../temoins/fiche-relances-prod.json", import.meta.url), "utf8")) as FicheTableau;
const RELANCE: OptionsMiseEnPage["appel"] = { mot: "RELANCE" };
const mise = (f: FicheTableau, format: IdFormatSortie, appel: OptionsMiseEnPage["appel"] = RELANCE) => mettreEnPage(f, { appel, ...(format === "vertical" ? {} : { format }) });
const ecrans = (f: FicheTableau, format: IdFormatSortie, appel?: OptionsMiseEnPage["appel"]) => {
  const m = mise(f, format, appel);
  return { ecrans: m.styleV2!.ecrans, g: m.styleV2!.geometrie };
};

describe("1. récapitulatif : chaque ligne écrite une seule fois", () => {
  for (const f of IDS_FORMATS_SORTIE) {
    it(`${f} : les trois lignes seulement dans la liste numérotée à cases, plus en gros au-dessus`, () => {
      const recap = ecrans(temoin, f).ecrans.find((e) => e.sceneId === "s07")!;
      expect(recap.gabarit).toBe("recapitulatif");
      // Aucun titre tiré des lignes e32 à e34 (avant : « Écrites une fois », « Programmées »… en haut).
      expect(recap.textes.filter((t) => /^e3[234]#/.test(t.id))).toEqual([]);
      for (const ligne of ["ÉCRITES UNE FOIS", "PROGRAMMÉES", "SUPPRIMÉES DÈS LA RÉPONSE"]) {
        const ecrit = recap.textes.filter((t) => t.id.includes("#rt")).map((t) => t.texte).join(" ");
        expect(ecrit).toContain(ligne.split(" ")[0]);
      }
      expect(recap.textes.filter((t) => /#rt\d+$/.test(t.id)).length).toBe(3);
    });
  }

  it("aucun écran n'écrit deux fois la même ligne (témoin, Formation, exemples, gabarits aux bornes), dans les 5 formats", () => {
    const fiches: [string, FicheTableau][] = [["témoin", temoin], ["Formation", ficheFormation()], ...Object.entries(EXEMPLES).map(([n, x]) => [n, { ...x, habillage: "blocs/2" }] as [string, FicheTableau]), ...GABARITS_ECRAN.flatMap((g) => [[`${g} max`, ficheAvec(g)], [`${g} min`, ficheMin(g)]] as [string, FicheTableau][])];
    for (const [nom, fiche] of fiches) for (const f of IDS_FORMATS_SORTIE) for (const e of ecrans(fiche, f).ecrans) expect.soft(textesEnDoubleV2(e), `${nom} · ${f} · ${e.id} (${e.gabarit})`).toEqual([]);
  }, 120_000);

  it("le contrôle repère une ligne écrite en titre puis dans le corps", () => {
    const t = (id: string, texte: string, source: string, y: number) => ({ id, texte, source, x: 0, y, largeur: 100, hauteur: 40, taille: 40, police: "titre" as const, couleur: "#000", fond: "#fff", entree: "gauche" as const });
    const e = { textes: [t("e32#0.0", "Écrites", "e32", 0), t("e32#0.1", "une", "e32", 0), t("e32#0.2", "fois", "e32", 0), t("s07~e0#rt0", "ÉCRITES UNE FOIS", "s07~e0~0", 200)] };
    expect(textesEnDoubleV2(e)).toEqual(["Écrites une fois"]);
    // Le mot tapé dans la bulle de l'appel reprend le mot du titre : ce n'est pas un doublon.
    expect(textesEnDoubleV2({ textes: [t("e37~mot#0.0", "RELANCE", "e37~mot", 0), t("s08~e0#frappe", "RELANCE", "e37", 300)] })).toEqual([]);
  });
});

describe("2. aucun écran presque vide (un tiers de la zone utile au plus, hors marges)", () => {
  it("témoin, Formation et fiches d'exemple : chaque écran, dans les 5 formats (et la fin « site » du vertical TikTok)", () => {
    const fiches: [string, FicheTableau][] = [["témoin", temoin], ["Formation", ficheFormation()], ...Object.entries(EXEMPLES).map(([n, x]) => [n, { ...x, habillage: "blocs/2" }] as [string, FicheTableau])];
    for (const [nom, fiche] of fiches) {
      for (const f of IDS_FORMATS_SORTIE) {
        const { ecrans: es, g } = ecrans(fiche, f);
        for (const e of es) expect.soft(controleRemplissageV2(e, g), `${nom} · ${f}`).toBeNull();
      }
      // La fin propre à TikTok et Shorts (axion-ia.com en grand), sans et avec sa phrase.
      for (const appel of [{ site: true as const }, { site: true as const, phrase: "Le lien est en bio" }]) {
        const { ecrans: es, g } = ecrans(fiche, "vertical", appel);
        for (const e of es) expect.soft(controleRemplissageV2(e, g), `${nom} · fin site`).toBeNull();
      }
    }
  }, 120_000);

  for (const g of GABARITS_ECRAN) {
    it(`${g} : au minimum (une ligne courte, deux éléments, aucun dessin) et au maximum de ses bornes, dans les 5 formats`, () => {
      for (const [quoi, fiche] of [["min", ficheMin(g)], ["max", ficheAvec(g)]] as const)
        for (const f of IDS_FORMATS_SORTIE) {
          const { ecrans: es, g: geo } = ecrans(fiche, f, g === "appel-commentaire" ? { mot: "RELANCES" } : RELANCE);
          for (const e of es) expect.soft(controleRemplissageV2(e, geo), `${g} ${quoi} · ${f}`).toBeNull();
        }
    }, 60_000);
  }

  it("le contrôle repère l'écran d'avant : une carte jusqu'en bas avec trois traits gris", () => {
    const { ecrans: es, g } = ecrans(temoin, "vertical");
    const e = es.find((x) => x.sceneId === "s05")!;
    const carte = e.formes.find((x) => x.id === `${e.id}#carte`)!;
    const avant: EcranPlace = {
      ...e,
      formes: [
        ...e.formes.filter((x) => x.sorte !== "rond" && x.sorte !== "dessin" && x.id !== carte.id),
        { ...carte, x: e.zoneCorps.x, y: e.zoneCorps.y, largeur: e.zoneCorps.largeur, hauteur: g.hauteur, horsZone: true },
        ...[1, 0.86, 0.94].map((w, i) => ({ id: `${e.id}#b.${i}`, sorte: "barre-sable" as const, x: e.zoneCorps.x + 34, y: e.zoneCorps.y + 34 + i * 54, largeur: 700 * w, hauteur: 24, rayon: 12, remplissage: "#BFA88B", contour: null, epaisseur: 0, source: e.id, entree: "barre" as const })),
      ],
    };
    expect(partVideEcranV2(avant, g)).toBeGreaterThan(VIDE_MAX_ECRAN);
    // Dessin 4 : la grande carte de traits gris est refusée comme cadre vide (le vide d'ensemble seul tolère désormais
    // un texte grandi et centré, sans bloc vide d'un seul tenant).
    expect(cadresVidesV2(avant, g).join(" ")).toMatch(/est vide aux/);
    expect(controleRemplissageV2(e, g)).toBeNull();
    expect(cadresVidesV2(e, g)).toEqual([]);
  });

  it("étapes du témoin : la carte montre les pictogrammes de la fiche en grand, plus aucun trait gris", () => {
    for (const f of ["vertical", "portrait"] as const) {
      const es = ecrans(temoin, f).ecrans;
      for (const [scene, dessins] of [["s03", ["crayon", "calendrier"]], ["s04", ["enveloppe", "horloge"]], ["s05", ["bulle", "gomme"]]] as const) {
        const e = es.find((x) => x.sceneId === scene)!;
        // Les dessins de la scène d'abord (un pictogramme du moment peut compléter une carte large).
        expect(e.formes.filter((x) => x.sorte === "dessin").map((x) => x.dessin).slice(0, 2)).toEqual(dessins);
        expect(e.formes.some((x) => x.sorte === "barre-sable")).toBe(false);
        const carte = e.formes.find((x) => x.sorte === "carte")!;
        // La carte est réduite à ses pictogrammes : elle ne descend plus jusqu'en bas de l'image.
        expect(carte.horsZone).toBeFalsy();
        expect(carte.y + carte.hauteur).toBeLessThanOrEqual(e.zoneCorps.y + e.zoneCorps.hauteur + 0.5);
      }
    }
  });

  it("exemple du témoin : avant et après remplis dès l'arrivée, carte réduite à ses panneaux", () => {
    for (const f of ["vertical", "portrait"] as const) {
      const e = ecrans(temoin, f).ecrans.find((x) => x.sceneId === "s06")!;
      expect(e.gabarit).toBe("exemple");
      const texte = (p: string) => e.textes.filter((t) => t.id.startsWith(`${e.id}#${p}`)).map((t) => t.texte).join(" ");
      expect(texte("avt")).toBe("Avant : il comptait sur sa mémoire");
      expect(texte("apt")).toBe("Après : la relance part seule");
      expect(e.textes.filter((t) => t.id.startsWith(`${e.id}#apt`)).every((t) => t.avant === "estompe")).toBe(true);
      expect(e.formes.find((x) => x.id === `${e.id}#carte`)!.horsZone).toBeFalsy();
    }
  });
});

describe("3. texte annoncé du premier écran : plein et atténué, jamais en lettres creuses dédoublées", () => {
  it("le rendu ne trace plus le contour des lettres d'un texte annoncé", () => {
    const rendu = readFileSync(join(process.cwd(), "studio-rendu/compositions/tableau/v2/EcranV2.tsx"), "utf8");
    expect(rendu).not.toMatch(/WebkitTextStroke: contour/);
    expect(rendu).toMatch(/color: contour \? COULEURS_V2\.sable : x\.couleur/);
    expect(rendu).toMatch(/opacity: contour \? OPACITE_ANNONCE : e\.opacite/);
  });
});

describe("4. page de la vidéo et écran de création : jamais un arrêt ou un refus périmé", () => {
  type T = { id: string; cibleId: string; statut: "en_cours" | "en_file" | "echec" | "termine"; type: "fabrication" | "reexport" };
  const t = (id: string, statut: T["statut"], type: T["type"] = "fabrication", cibleId = "v1"): T => ({ id, cibleId, statut, type });

  it("l'ancien essai arrêté n'est plus montré quand un essai suivant a fabriqué la vidéo (travaux du plus récent au plus ancien)", () => {
    expect(travailAffiche([t("t2", "termine"), t("t1", "echec")], "v1")).toBeNull();
    // Le dernier essai s'est arrêté : son panneau reste, avec « Corriger la fiche » et « Reprendre la fabrication ».
    expect(travailAffiche([t("t2", "echec"), t("t1", "termine")], "v1")?.id).toBe("t2");
    // Un essai relancé qui tourne passe avant l'ancien arrêt.
    expect(travailAffiche([t("t2", "en_cours"), t("t1", "echec")], "v1")?.id).toBe("t2");
    // Un format ajouté arrêté reste montré tant que la vidéo elle-même est finie ; jamais un arrêt d'une autre vidéo.
    expect(travailAffiche([t("r1", "echec", "reexport"), t("t2", "termine"), t("t1", "echec")], "v1")?.id).toBe("r1");
    expect(travailAffiche([t("x", "echec", "fabrication", "v2")], "v1")).toBeNull();
  });

  it("le bandeau « Découpage refusé » d'une ancienne tâche disparaît quand la dernière version de la fiche passe", () => {
    const tache = { type: "decoupage", statut: "refusee" };
    expect(refusDecoupagePerime({ tache, fiche: {}, problemes: [], ficheACorriger: false })).toBe(true);
    expect(refusDecoupagePerime({ tache, fiche: {}, problemes: [{}], ficheACorriger: false })).toBe(false);
    expect(refusDecoupagePerime({ tache, fiche: {}, problemes: [], ficheACorriger: true })).toBe(false);
    expect(refusDecoupagePerime({ tache, fiche: null, problemes: [], ficheACorriger: false })).toBe(false);
    expect(refusDecoupagePerime({ tache: { type: "decoupage", statut: "erreur" }, fiche: {}, problemes: [], ficheACorriger: false })).toBe(false);
    const ecran = readFileSync(join(process.cwd(), "src/components/formats/tableau-anime/NouvelleVideoTableau.tsx"), "utf8");
    expect(ecran).toMatch(/b\?\.tache && !refusDecoupagePerime\(b\)/);
  });
});
