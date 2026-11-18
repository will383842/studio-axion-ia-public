/**
 * INSTANTANÉ DES TROIS TABLES DE FORMATS D'AUJOURD'HUI (plan « formats par réseau », tâche T1).
 *
 * Fige, avant tout changement, les valeurs que rendent aujourd'hui :
 *  1. le registre des réseaux (`src/reseaux/index.ts`) : chaque champ d'avant T1, réseau par réseau ;
 *  2. la table du tableau animé (`src/moteurs/montage-tableau/formats-sortie.ts`) ;
 *  3. `DIMENSIONS_FACECAM` et les zones sûres du face caméra (`src/briques/formats-facecam`).
 *
 * Les tâches T2 et T3 feront lire ces tables dans le registre : elles ne sont acceptées que si ce test reste vert
 * sans le modifier. Les champs AJOUTÉS au registre par T1 (zones complémentaires, emplacements, règle de fin) sont
 * laissés de côté ici : seules les valeurs d'avant sont figées.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Ratio } from "@/domaine/types";
import { comptesPourReseau, libellePublication, nomService, statutDepuisBuffer } from "@/domaine/buffer";
import { estAncienOutil, estChezUnOutil, OUTILS, OUTILS_ENVOI, outilDe, outilPour } from "@/domaine/outil-publication";
import type { CanalPublication } from "@/fournisseurs/types";
import { obtenirReseau, RESEAUX, zoneProtegeeCombinee } from "@/reseaux";
import {
  FORMATS_SORTIE,
  FORMAT_DU_RESEAU,
  IDS_FORMATS_SORTIE,
  IDS_SORTIES,
  SORTIES_DU_RESEAU,
  SORTIES_PAR_DEFAUT,
  SORTIES_SANS_APPEL_AU_MOT,
  ZONE_VERTICAL_BLOCS_2,
  ZONE_VERTICAL_REFERENCE,
  descriptionSortie,
  referenceFormat,
  zoneSureBlocs2,
  zoneSureFormat,
  zoneSureReference,
} from "@/moteurs/montage-tableau/formats-sortie";
import { DIMENSIONS_FACECAM, PASTILLES_FORMATS, RATIOS_FACECAM } from "@/briques/formats-facecam/ratios";
import { PLANCHER_ZONES, reseauxDuFormat, zoneSure as zoneSureFacecam } from "@/briques/formats-facecam/zones";

const RATIOS: Ratio[] = ["9:16", "4:5", "1:1", "16:9"];

/** Champs du registre qui existaient avant T1 (les champs ajoutés par T1 n'y figurent pas). */
const CHAMPS_D_AVANT = [
  "id",
  "nom",
  "monogramme",
  "codeClassement",
  "ratios",
  "ratioPrefere",
  "dureeMaxSec",
  "export",
  "niveauSonoreLufs",
  "zonesProtegees",
  "legende",
  "miniature",
  "etiquetteIA",
] as const;

/** Le registre tel qu'il était à `1d213458` (master du 18/10/2026), copié champ par champ. */
const REGISTRE_D_AVANT = [
  {
    id: "linkedin",
    nom: "LinkedIn",
    monogramme: "in",
    codeClassement: "LI",
    ratios: ["1:1", "4:5", "16:9", "9:16"],
    ratioPrefere: "9:16",
    dureeMaxSec: 600,
    export: { resolution: { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" }, fps: 30, debitMbps: 8, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: {
      "9:16": { haut: 8, droite: 4, bas: 14, gauche: 4 },
      "4:5": { haut: 4, droite: 4, bas: 10, gauche: 4 },
      "1:1": { haut: 4, droite: 4, bas: 10, gauche: 4 },
    },
    legende: { longueurMax: 3000, longueurVisible: 210, motsDieseMax: 5, motsDieseConseilles: 3 },
    miniature: { ratio: "16:9", modifiable: true },
    etiquetteIA: "LinkedIn : rien à cocher ; une mention dans le texte du post.",
  },
  {
    id: "instagram",
    nom: "Instagram",
    monogramme: "IG",
    codeClassement: "IG",
    ratios: ["9:16", "4:5", "1:1"],
    ratioPrefere: "9:16",
    dureeMaxSec: 180,
    export: { resolution: { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" }, fps: 30, debitMbps: 10, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "9:16": { haut: 14, droite: 16, bas: 30, gauche: 6 }, "4:5": { haut: 4, droite: 4, bas: 8, gauche: 4 } },
    legende: { longueurMax: 2200, longueurVisible: 125, motsDieseMax: 30, motsDieseConseilles: 3 },
    miniature: { ratio: "3:4", modifiable: true },
    etiquetteIA: "Activer « Étiquette IA » dans les paramètres avancés.",
  },
  {
    id: "facebook",
    nom: "Facebook",
    monogramme: "f",
    codeClassement: "FB",
    ratios: ["9:16", "4:5", "1:1", "16:9"],
    ratioPrefere: "9:16",
    dureeMaxSec: 90,
    export: { resolution: { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" }, fps: 30, debitMbps: 10, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "9:16": { haut: 14, droite: 16, bas: 30, gauche: 6 } },
    legende: { longueurMax: 2200, longueurVisible: 125, motsDieseMax: 10, motsDieseConseilles: 3 },
    miniature: { ratio: "9:16", modifiable: true },
    etiquetteIA: "Activer « Étiquette IA » avant de publier.",
  },
  {
    id: "tiktok",
    nom: "TikTok",
    monogramme: "TT",
    codeClassement: "TT",
    ratios: ["9:16"],
    ratioPrefere: "9:16",
    dureeMaxSec: 600,
    export: { resolution: { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" }, fps: 30, debitMbps: 10, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "9:16": { haut: 10, droite: 18, bas: 26, gauche: 4 } },
    legende: { longueurMax: 2200, longueurVisible: 100, motsDieseMax: 8, motsDieseConseilles: 4 },
    miniature: { ratio: "9:16", modifiable: true },
    etiquetteIA: "Cocher « Contenu généré par l'IA » dans les réglages de la publication.",
  },
  {
    id: "youtube",
    nom: "YouTube",
    monogramme: "YT",
    codeClassement: "YT",
    ratios: ["16:9"],
    ratioPrefere: "16:9",
    dureeMaxSec: 43200,
    export: { resolution: { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" }, fps: 30, debitMbps: 12, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "16:9": { haut: 6, droite: 4, bas: 12, gauche: 4 } },
    legende: { longueurMax: 5000, longueurVisible: 160, motsDieseMax: 15, motsDieseConseilles: 3 },
    miniature: { ratio: "16:9", modifiable: true },
    etiquetteIA: "Répondre « Oui » à « Contenu modifié ou synthétique ».",
  },
  {
    id: "youtube-shorts",
    nom: "YouTube Shorts",
    monogramme: "YS",
    codeClassement: "YS",
    ratios: ["9:16"],
    ratioPrefere: "9:16",
    dureeMaxSec: 180,
    export: { resolution: { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" }, fps: 30, debitMbps: 10, codec: "h264" },
    niveauSonoreLufs: -14,
    zonesProtegees: { "9:16": { haut: 10, droite: 16, bas: 20, gauche: 4 } },
    legende: { longueurMax: 100, longueurVisible: 60, motsDieseMax: 3, motsDieseConseilles: 2 },
    miniature: { ratio: "9:16", modifiable: false },
    etiquetteIA: "Répondre « Oui » à « Contenu modifié ou synthétique ».",
  },
];

describe("instantané · registre des réseaux (`src/reseaux`)", () => {
  it("chaque réseau garde exactement ses valeurs d'avant, dans le même ordre", () => {
    const aujourdhui = RESEAUX.map((r) => Object.fromEntries(CHAMPS_D_AVANT.map((c) => [c, r[c]])));
    expect(aujourdhui).toEqual(REGISTRE_D_AVANT);
  });

  it("la zone combinée de tous les réseaux (calque de l'Aperçu) ne bouge pas", () => {
    const tous = RESEAUX.map((r) => r.id);
    expect(Object.fromEntries(RATIOS.map((ratio) => [ratio, zoneProtegeeCombinee(ratio, tous)]))).toEqual({
      "9:16": { haut: 14, droite: 18, bas: 30, gauche: 6 },
      "4:5": { haut: 4, droite: 4, bas: 10, gauche: 4 },
      "1:1": { haut: 4, droite: 4, bas: 10, gauche: 4 },
      "16:9": { haut: 6, droite: 4, bas: 12, gauche: 4 },
    });
    // Facebook n'a toujours de zone qu'en 9:16 pour les lecteurs d'aujourd'hui.
    expect(zoneProtegeeCombinee("4:5", ["facebook"])).toBeNull();
    expect(zoneProtegeeCombinee("1:1", ["facebook"])).toBeNull();
    expect(zoneProtegeeCombinee("16:9", ["linkedin"])).toBeNull();
  });
});

describe("instantané · table du tableau animé (`formats-sortie.ts`)", () => {
  it("identifiants, ordre et défaut", () => {
    expect(IDS_FORMATS_SORTIE).toEqual(["vertical", "portrait", "carre", "horizontal"]);
    // T5 (décision 1 du 18/10) : le portrait de LinkedIn, sans la fin au mot, à côté du portrait du fil.
    expect(IDS_SORTIES).toEqual(["vertical", "vertical-liens", "portrait", "portrait-linkedin", "carre", "horizontal"]);
    expect(SORTIES_PAR_DEFAUT).toEqual(["vertical"]);
    expect(SORTIES_SANS_APPEL_AU_MOT).toEqual(["vertical-liens", "portrait-linkedin", "carre"]);
  });

  it("formats : libellé, ratio, dimensions, réseaux servis et leurs zones", () => {
    const resume = Object.values(FORMATS_SORTIE).map((f) => ({
      id: f.id,
      libelle: f.libelle,
      ratio: f.ratio,
      largeur: f.largeur,
      hauteur: f.hauteur,
      reseaux: f.reseaux.map((r) => ({ libelle: r.libelle, zone: r.zone })),
    }));
    expect(resume).toEqual([
      {
        id: "vertical",
        libelle: "Vertical 9:16",
        ratio: "9:16",
        largeur: 1080,
        hauteur: 1920,
        reseaux: [
          { libelle: "TikTok", zone: { haut: 10, droite: 18, bas: 26, gauche: 4 } },
          { libelle: "Reels Instagram", zone: { haut: 14, droite: 16, bas: 30, gauche: 6 } },
          { libelle: "Reels Facebook", zone: { haut: 14, droite: 16, bas: 30, gauche: 6 } },
          { libelle: "YouTube Shorts", zone: { haut: 10, droite: 16, bas: 20, gauche: 4 } },
          { libelle: "Stories Instagram et Facebook", zone: { haut: 14, droite: 6, bas: 20, gauche: 6 } },
        ],
      },
      {
        id: "portrait",
        libelle: "Portrait 4:5",
        ratio: "4:5",
        largeur: 1080,
        hauteur: 1350,
        reseaux: [
          { libelle: "Fil Instagram", zone: { haut: 4, droite: 4, bas: 8, gauche: 4 } },
          { libelle: "Fil Facebook", zone: { haut: 5, droite: 5, bas: 12, gauche: 5 } },
        ],
      },
      {
        id: "carre",
        libelle: "Carré 1:1",
        ratio: "1:1",
        largeur: 1080,
        hauteur: 1080,
        reseaux: [
          { libelle: "LinkedIn", zone: { haut: 4, droite: 4, bas: 10, gauche: 4 } },
          { libelle: "Fil Facebook", zone: { haut: 5, droite: 5, bas: 12, gauche: 5 } },
        ],
      },
      {
        id: "horizontal",
        libelle: "Horizontal 16:9",
        ratio: "16:9",
        largeur: 1920,
        hauteur: 1080,
        reseaux: [{ libelle: "YouTube", zone: { haut: 6, droite: 4, bas: 12, gauche: 4 } }],
      },
    ]);
  });

  it("zones sûres calculées (union, « blocs/2 », « reference/1 ») et image de référence", () => {
    const ids = IDS_FORMATS_SORTIE;
    expect(Object.fromEntries(ids.map((id) => [id, zoneSureFormat(id)]))).toEqual({
      vertical: { haut: 14, droite: 18, bas: 30, gauche: 6 },
      portrait: { haut: 5, droite: 5, bas: 12, gauche: 5 },
      carre: { haut: 5, droite: 5, bas: 12, gauche: 5 },
      horizontal: { haut: 6, droite: 4, bas: 12, gauche: 4 },
    });
    expect(zoneSureBlocs2("vertical")).toEqual({ haut: 14, droite: 18, bas: 20, gauche: 6 });
    expect(zoneSureReference("vertical")).toEqual({ haut: 6, droite: 18, bas: 20, gauche: 6 });
    expect(zoneSureBlocs2("portrait")).toEqual(zoneSureFormat("portrait"));
    expect(ZONE_VERTICAL_BLOCS_2.bas).toBe(20);
    expect(ZONE_VERTICAL_REFERENCE.haut).toBe(6);
    expect(Object.fromEntries(ids.map((id) => [id, referenceFormat(id)]))).toEqual({
      vertical: { largeur: 1080, hauteur: 1920 },
      portrait: { largeur: 1080, hauteur: 1920 },
      carre: { largeur: 1080, hauteur: 1920 },
      horizontal: { largeur: 1080, hauteur: 1920 },
    });
  });

  it("réseau coché → format et sorties (LinkedIn : 4:5 sans la fin au mot depuis T5, décision 1 du 18/10 ; avant : le carré)", () => {
    expect(FORMAT_DU_RESEAU).toEqual({ verticaux: "vertical", "fil-instagram-facebook": "portrait", linkedin: "portrait", youtube: "horizontal" });
    expect(SORTIES_DU_RESEAU).toEqual({
      verticaux: ["vertical", "vertical-liens"],
      "reels-stories": ["vertical"],
      "reels-instagram-facebook": ["vertical"],
      stories: ["vertical"],
      instagram: ["vertical"],
      facebook: ["vertical"],
      tiktok: ["vertical-liens"],
      "youtube-shorts": ["vertical-liens"],
      "tiktok-shorts": ["vertical-liens"],
      "fil-instagram-facebook": ["portrait"],
      linkedin: ["portrait-linkedin"],
      youtube: ["horizontal"],
    });
  });

  it("description des deux verticaux quand ils sont séparés", () => {
    const deux = ["vertical", "vertical-liens"] as const;
    const reels = descriptionSortie("vertical", deux);
    const liens = descriptionSortie("vertical-liens", deux);
    expect([reels.libelle, reels.reseaux.map((r) => r.libelle)]).toEqual([
      "Vertical 9:16 · Reels et stories",
      ["Reels Instagram", "Reels Facebook", "Stories Instagram et Facebook"],
    ]);
    expect([liens.libelle, liens.reseaux.map((r) => r.libelle)]).toEqual(["Vertical 9:16 · TikTok et Shorts", ["TikTok", "YouTube Shorts"]]);
  });
});

describe("instantané · face caméra (`DIMENSIONS_FACECAM`, zones)", () => {
  it("dimensions par format", () => {
    expect(RATIOS_FACECAM).toEqual(["9:16", "4:5", "1:1", "16:9"]);
    expect(DIMENSIONS_FACECAM).toEqual({
      "9:16": { largeur: 1080, hauteur: 1920 },
      "4:5": { largeur: 1080, hauteur: 1350 },
      "1:1": { largeur: 1080, hauteur: 1080 },
      "16:9": { largeur: 1920, hauteur: 1080 },
    });
  });

  it("pastilles de l'écran « Votre vidéo »", () => {
    expect(PASTILLES_FORMATS.map((p) => [p.ratio, p.nom, p.usage, p.verrouille])).toEqual([
      ["9:16", "Vertical", "TikTok, Reels, Shorts", true],
      ["4:5", "Portrait", "Instagram", false],
      ["1:1", "Carré", "LinkedIn, Facebook", false],
      ["16:9", "Horizontal", "YouTube, LinkedIn bureau", false],
    ]);
  });

  it("plancher, réseaux de chaque format et zone sûre (fractions)", () => {
    expect(PLANCHER_ZONES).toEqual({
      "9:16": { haut: 0.14, droite: 0.16, bas: 0.3, gauche: 0.07 },
      "4:5": { haut: 0.06, droite: 0.06, bas: 0.12, gauche: 0.06 },
      "1:1": { haut: 0.06, droite: 0.06, bas: 0.12, gauche: 0.06 },
      "16:9": { haut: 0.06, droite: 0.05, bas: 0.12, gauche: 0.05 },
    });
    expect(Object.fromEntries(RATIOS_FACECAM.map((r) => [r, reseauxDuFormat(r)]))).toEqual({
      "9:16": ["linkedin", "instagram", "facebook", "tiktok", "youtube-shorts"],
      "4:5": ["linkedin", "instagram"],
      "1:1": ["linkedin"],
      "16:9": ["youtube"],
    });
    expect(Object.fromEntries(RATIOS_FACECAM.map((r) => [r, zoneSureFacecam(r)]))).toEqual({
      "9:16": { haut: 0.14, droite: 0.18, bas: 0.3, gauche: 0.07 },
      "4:5": { haut: 0.06, droite: 0.06, bas: 0.12, gauche: 0.06 },
      "1:1": { haut: 0.06, droite: 0.06, bas: 0.12, gauche: 0.06 },
      "16:9": { haut: 0.06, droite: 0.05, bas: 0.12, gauche: 0.05 },
    });
  });
});

/**
 * BUF-02 · la table des réseaux ne décrit plus l'ancien outil comme voie d'envoi.
 * Faux comptes seulement ; aucun appel, aucun envoi. Les envois eux-mêmes sont gardés par
 * `tests/l0-13a-envoi-sans-buffer.test.ts`, `tests/services/envoyer-visuel.test.ts` et `tests/reprise-envois.test.ts` (inchangés).
 */
const lire = (chemin: string) => readFileSync(chemin, "utf8");
const IDS = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"] as const;
const COMPTE_DE = { linkedin: "linkedin", instagram: "instagram", facebook: "facebook", tiktok: "tiktok", youtube: "youtube", "youtube-shorts": "youtube" } as const;
const canal = (service: string): CanalPublication => ({ id: `c-${service}`, organisationId: "o", nom: `Compte ${service}`, service, deconnecte: false });

describe("BUF-02 · la table des réseaux", () => {
  it("aucun réseau ne porte plus de champ « voie d'envoi par l'ancien outil »", () => {
    for (const r of RESEAUX) {
      expect(Object.keys(r)).not.toContain("viaBuffer");
      expect(Object.keys(r)).not.toContain("serviceBuffer");
    }
    expect(RESEAUX.map((r) => r.id)).toEqual([...IDS]);
  });

  it("les mots ne sont plus écrits dans la table, le routage, le service et le fournisseur d'envoi", () => {
    for (const f of ["src/reseaux/index.ts", "src/services/publications.ts", "src/services/buffer.ts", "src/fournisseurs/publication/buffer.ts"]) {
      expect(lire(f), f).not.toMatch(/viaBuffer|serviceBuffer/);
    }
  });

  it("le seul reste est l'alias gardé pour reglages/actions-zernio.ts (zone Zernio, hors liste)", () => {
    const occurrences = lire("src/domaine/buffer.ts").split("\n").filter((l) => /viaBuffer|serviceBuffer/.test(l));
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]).toMatch(/^export (const|function) serviceBuffer\b/);
  });
});

describe("BUF-02 · garantie 1 : aucun envoi ne part vers l'ancien outil, quel que soit le réglage", () => {
  it("la liste d'envoi ne contient que le diffuseur actuel ; l'ancien reste reconnu en lecture seule", () => {
    expect([...OUTILS_ENVOI]).toEqual(["zernio"]);
    expect([...OUTILS]).toEqual(["buffer", "zernio"]);
  });
  it("le refus d'envoi par l'ancien outil est toujours posé avant toute préparation (envoyerReel)", () => {
    const src = lire("src/services/publications.ts");
    const garde = src.indexOf("OUTILS_ENVOI as readonly string[]).includes(outil)");
    expect(garde).toBeGreaterThan(0);
    expect(src.indexOf("OUTIL_RETIRE", garde)).toBeLessThan(garde + 250);
  });
  it("le fournisseur d'envoi n'est inscrit que pour le diffuseur actuel, même avec la clé de l'ancien outil", async () => {
    const { publicationBuffer } = await import("@/fournisseurs/publication/inscription");
    expect(Object.keys(publicationBuffer({ BUFFER_API_KEY: "cle-fictive-buf02", ZERNIO_API_KEY: "cle-fictive-z" } as never))).toEqual(["zernio"]);
    expect(Object.keys(publicationBuffer({ BUFFER_API_KEY: "cle-fictive-buf02" } as never))).toEqual([]);
  });
});

describe("BUF-02 · garantie 2 : le routage vers le diffuseur actuel est inchangé", () => {
  it("Facebook, LinkedIn et Instagram partent par le diffuseur actuel par défaut, avec ou sans compte", () => {
    for (const r of ["facebook", "linkedin", "instagram"]) {
      expect(outilPour(null, r)).toBe("zernio");
      expect(outilPour({}, r, "compte-1")).toBe("zernio");
      expect(outilPour({ [r]: "zernio" }, r)).toBe("zernio");
      expect(outilPour({ [`${r}:compte-1`]: "zernio", [r]: "buffer" }, r, "compte-1")).toBe("zernio");
    }
  });
  it("la table garde les mêmes six réseaux et leurs réglages d'envoi (aucun réseau ajouté ni retiré)", () => {
    expect(RESEAUX.map((r) => r.id)).toEqual([...IDS]);
    expect(RESEAUX.map((r) => r.codeClassement)).toEqual(["LI", "IG", "FB", "TT", "YT", "YS"]);
  });
  it("les portes (publication.editoriale_active, zernio.envoi_autorise) restent écrites dans leurs fichiers", () => {
    expect(lire("src/domaine/outil-publication.ts")).toContain('REGLAGE_ENVOI_CALENDRIER = "publication.editoriale_active"');
    expect(lire("src/fournisseurs/publication/inscription.ts")).toContain("publicationEditorialeAutorisee");
  });
});

describe("BUF-02 · garantie 4 : une publication ancienne envoyée par l'ancien outil reste lisible", () => {
  const ancienne = { via: "buffer" as const, reseau: "linkedin" as const, date: "2026-09-14T08:00:00.000Z", statut: "publiee" as const };
  it("elle est reconnue comme chez l'ancien outil, avec son réseau, sa date et son statut", () => {
    expect(outilDe(ancienne)).toBe("buffer");
    expect(estChezUnOutil(ancienne)).toBe(true);
    expect(estAncienOutil(outilDe(ancienne))).toBe(true);
    expect(obtenirReseau(ancienne.reseau).nom).toBe("LinkedIn");
  });
  it("son libellé s'affiche comme avant, selon son statut et l'état de son envoi", () => {
    const lib = (statut: "brouillon" | "programmee" | "publiee" | "echec", etatEnvoi?: "en-cours" | "a-verifier" | "refuse" | "absent" | "envoye") =>
      libellePublication({ via: "buffer", statut, ...(etatEnvoi ? { etatEnvoi } : {}) } as never).libelle;
    expect(lib("publiee")).toBe("Publiée");
    expect(lib("programmee")).toBe("Programmée");
    expect(lib("brouillon")).toBe("Brouillon chez le diffuseur");
    expect(lib("echec")).toBe("Échec");
    expect(lib("programmee", "refuse")).toBe("Échec");
    expect(lib("programmee", "absent")).toBe("Échec");
    expect(lib("programmee", "a-verifier")).toBe("À vérifier");
    expect(lib("programmee", "en-cours")).toBe("Envoi en cours");
  });
  it("la date de la ligne ancienne n'est ni lue ni réécrite par ces fonctions (elle reste telle quelle)", () => {
    const ligne = { ...ancienne };
    libellePublication(ligne as never);
    outilDe(ligne);
    expect(ligne).toEqual(ancienne);
  });
  it("les statuts relus de l'ancien outil se traduisent comme avant", () => {
    expect([undefined, "draft", "sent", "error", "scheduled", "sending", "needs_approval", "inconnu"].map((x) => statutDepuisBuffer(x))).toEqual([
      "programmee", "brouillon", "publiee", "echec", "programmee", "programmee", "programmee", "programmee",
    ]);
  });
  it("la lecture des comptes retrouve pour chaque réseau le même service et le même nom qu'avant", () => {
    for (const id of IDS) {
      const service = COMPTE_DE[id];
      const r = comptesPourReseau(id, [canal(service), canal("autre")]);
      expect(r).toMatchObject({ ok: true, source: "auto" });
      if (r.ok) expect(r.canaux.map((c) => c.service)).toEqual([service]);
      expect(comptesPourReseau(id, [canal("autre")])).toMatchObject({ ok: false, raison: "aucun" });
    }
    expect(nomService("youtube")).toBe("YouTube");
    expect(nomService("linkedin")).toBe("LinkedIn");
    expect(nomService("instagram")).toBe("Instagram");
    expect(nomService("facebook")).toBe("Facebook");
    expect(nomService("tiktok")).toBe("TikTok");
    expect(nomService("inconnu")).toBe("Autre compte");
  });
});
