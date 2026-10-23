/**
 * « Annuler cette vidéo » PARTOUT où « Reprendre » existe (demande de Will du 18/10). UN SEUL composant `BoutonAnnuler`,
 * réutilisé par tous les suivis ; « Annuler » = mettre à la corbeille (restaurable 30 jours), jamais un effacement.
 * Garde sur le modèle de `gabarit-fabrication.test.ts` : un suivi qui a Reprendre / Arrêter / Réessayer a Annuler, et
 * `EXCEPTIONS` ne peut que rétrécir (un nouvel écran de suivi doit avoir son bouton ou être justifié ici).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ACTIONS_FABRICATION, ANNULER_VIDEO } from "@/domaine/libelles";
import { statutAnnulable } from "@/domaine/corbeille";
import type { StatutVideo } from "@/domaine/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const { ActionsSuivi } = await import("@/components/fabrication/ActionsSuivi");

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
const noeud = (t: string) => createElement("p", null, t);

/** Suivis qui ont un geste de reprise / d'arrêt : chacun DOIT porter le bouton d'annulation. */
export const SUIVIS_AVEC_ANNULER = [
  "src/components/facecam/AttenteFacecam.tsx",
  "src/components/videos/SuiviTravail.tsx",
  "src/components/formats/tableau-anime/SuiviTableau.tsx",
  "src/components/formats/tableau-anime/SuiviTacheTableau.tsx",
  "src/components/formats/cas-concret/fiche-video/SuiviCasConcret.tsx",
  "src/assistant/etapes/Fabrication.tsx",
  "src/app/(studio)/videos/[id]/page.tsx",
  "src/components/videos/ActionsArret.tsx",
  "src/app/(studio)/_accueil/EnCours.tsx",
];

/** Écrans qui parlent de reprise sans être un suivi de vidéo : la raison est écrite, la liste ne peut que rétrécir. */
export const EXCEPTIONS: Record<string, string> = {
  "src/components/videos/BoutonReprendre.tsx": "le bouton lui-même",
  "src/components/videos/BoutonArreter.tsx": "le bouton lui-même",
  "src/components/videos/BoutonAnnuler.tsx": "le bouton lui-même",
  "src/components/creation/SuiviFabrication.tsx": "rendu générique : les actions sont rangées par ActionsSuivi dans chaque suivi",
  "src/components/formats/tableau-anime/EtapesTableau.tsx": "range les boutons par ActionsSuivi (annuler reçu de SuiviTableau)",
  "src/components/facecam/EncartFormatFacecam.tsx": "« Refaire l'effet » d'une vidéo prête : jamais annulable",
  "src/app/(studio)/styleguide/Vitrine.tsx": "vitrine du guide de style",
};
export const EXCEPTIONS_DEPART = Object.keys(EXCEPTIONS).length;

/** Image → vidéo : « Annuler cette vidéo » dépend de l'arrêt (lot argent séparé). Liste à part, ne peut que rétrécir. */
export const ANNULER_REPORTE_LOT_ARGENT: Record<string, string> = {
  "src/components/formats/image-video/Fabrication.tsx": "Annuler cette vidéo lié à l'arrêt : lot argent séparé",
  "src/components/formats/image-video/SuiviLot.tsx": "un lot n'est pas une vidéo : pas d'« Annuler cette vidéo »",
};
export const ANNULER_REPORTE_DEPART = Object.keys(ANNULER_REPORTE_LOT_ARGENT).length;

function fichiers(dir: string): string[] {
  return readdirSync(join(RACINE, dir)).flatMap((nom) => {
    const chemin = `${dir}/${nom}`;
    return statSync(join(RACINE, chemin)).isDirectory() ? fichiers(chemin) : chemin.endsWith(".tsx") ? [chemin] : [];
  });
}
const A_UN_GESTE = /BoutonReprendre|BoutonArreter|onReessayer=|<ActionsSuivi|reessayerTravailAction|reprendreVideoAction/;

describe("un seul bouton, un seul libellé", () => {
  it("libellé et confirmation figés", () => {
    expect(ANNULER_VIDEO.libelle).toBe("Annuler cette vidéo");
    expect(ANNULER_VIDEO.confirmation).toBe("Elle ira à la corbeille, restaurable 30 jours.");
    expect(ACTIONS_FABRICATION.annuler).toBe(ANNULER_VIDEO.libelle);
  });

  it("le composant existe, appelle la corbeille (jamais une suppression) et n'écrit pas son libellé à la main", () => {
    const s = lire("src/components/videos/BoutonAnnuler.tsx");
    expect(s).toContain("annulerVideoAction");
    expect(s).not.toMatch(/supprimerVideosAction|viderCorbeilleAction|supprimerVideosDefinitivement/);
    expect(s).toContain("ANNULER_VIDEO");
  });

  it("la galerie et la fiche cachent le bouton d'une vidéo qui a une version finie", () => {
    expect(lire("src/components/videos/GalerieVideos.tsx")).toMatch(/aVersionFinie/);
    expect(lire("src/app/(studio)/videos/[id]/page.tsx")).toMatch(/versionChoisieId/);
  });

  it("l'action serveur passe par le service d'annulation (corbeille)", () => {
    const s = lire("src/app/(studio)/videos/actions.ts");
    expect(s).toMatch(/export async function annulerVideoAction/);
    expect(s).toMatch(/export async function nettoyerVideosAction/);
    expect(s).toMatch(/export async function listerANettoyerAction/);
  });
});

describe("quel statut peut être annulé", () => {
  it("non terminée : oui ; prête, archivée : jamais", () => {
    const oui: StatutVideo[] = ["brouillon", "maquette", "en_file", "en_fabrication", "echec", "annulee"];
    for (const s of oui) expect(statutAnnulable(s), s).toBe(true);
    for (const s of ["prete", "archivee"] as StatutVideo[]) expect(statutAnnulable(s), s).toBe(false);
  });
});

describe("ActionsSuivi · le slot « annuler »", () => {
  const rendre = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(ActionsSuivi, p as never));

  it("pendant la fabrication : Passer devant, Arrêter, puis Annuler", () => {
    const html = rendre({ etat: "en-cours", passerDevant: noeud("PASSER"), arreter: noeud("ARRETER"), annuler: noeud("ANNULER") });
    expect(html.indexOf("ARRETER")).toBeLessThan(html.indexOf("ANNULER"));
    expect(html.indexOf("PASSER")).toBeLessThan(html.indexOf("ARRETER"));
  });

  it("après un arrêt : Reprendre, actions propres, Annuler, puis Recommencer", () => {
    const html = rendre({ etat: "coincee", reprendre: noeud("REPRENDRE"), propres: noeud("PROPRE"), annuler: noeud("ANNULER"), recommencer: { href: "/x", libelle: "RECOMMENCER" } });
    const o = ["REPRENDRE", "PROPRE", "ANNULER", "RECOMMENCER"].map((m) => html.indexOf(m));
    expect(o.every((i) => i >= 0)).toBe(true);
    expect([...o].sort((a, b) => a - b)).toEqual(o);
  });

  it("vidéo prête : jamais de bouton Annuler, quel que soit le slot", () => {
    expect(rendre({ etat: "prete", reprendre: noeud("REPRENDRE"), annuler: noeud("ANNULER") })).not.toContain("ANNULER");
    expect(rendre({ etat: "prete", annuler: noeud("ANNULER") })).toBe("");
  });

  it("l'annulation seule suffit à montrer la barre ; sans elle, rien", () => {
    expect(rendre({ etat: "arretee", annuler: noeud("ANNULER") })).toContain("ANNULER");
    expect(rendre({ etat: "arretee" })).toBe("");
  });
});

describe("garde : chaque suivi qui a Reprendre a Annuler", () => {
  for (const f of SUIVIS_AVEC_ANNULER) {
    it(`${f} porte BoutonAnnuler`, () => {
      expect(lire(f), f).toMatch(/<BoutonAnnuler\b/);
    });
  }

  it("EtapesTableau range le slot annuler dans ActionsSuivi", () => {
    expect(lire("src/components/formats/tableau-anime/EtapesTableau.tsx")).toMatch(/<ActionsSuivi[^>]*annuler=/);
  });

  it("aucun autre écran avec un geste de reprise ou d'arrêt sans être listé (ni justifié)", () => {
    const inconnus = [...fichiers("src/components"), ...fichiers("src/app"), ...fichiers("src/assistant")].filter(
      (f) => A_UN_GESTE.test(lire(f)) && !SUIVIS_AVEC_ANNULER.includes(f) && !(f in EXCEPTIONS) && !(f in ANNULER_REPORTE_LOT_ARGENT),
    );
    expect(inconnus, "un nouveau suivi doit avoir BoutonAnnuler (puis rejoindre SUIVIS_AVEC_ANNULER) ou être justifié dans EXCEPTIONS").toEqual([]);
  });

  it("les exceptions existent encore et ne grossissent pas", () => {
    expect(EXCEPTIONS_DEPART).toBeLessThanOrEqual(7);
    for (const f of Object.keys(EXCEPTIONS)) expect(() => lire(f), f).not.toThrow();
  });

  it("le report « lot argent » ne dépasse pas 2 écrans et ne peut que rétrécir", () => {
    // Liste figée des 2 écrans d'aujourd'hui : on ne peut que RETIRER une entrée, jamais en ajouter ni en échanger une.
    const FIGES = ["src/components/formats/image-video/Fabrication.tsx", "src/components/formats/image-video/SuiviLot.tsx"];
    const intrus = Object.keys(ANNULER_REPORTE_LOT_ARGENT).filter((f) => !FIGES.includes(f));
    expect(intrus, "une entrée nouvelle ou échangée n'est pas permise : la liste ne peut que rétrécir").toEqual([]);
    expect(ANNULER_REPORTE_DEPART).toBeLessThanOrEqual(FIGES.length);
    for (const f of Object.keys(ANNULER_REPORTE_LOT_ARGENT)) {
      expect(() => lire(f), f).not.toThrow();
      // Une entrée devenue inutile (plus de geste, ou déjà dans SUIVIS_AVEC_ANNULER) doit sortir de la liste.
      expect(A_UN_GESTE.test(lire(f)) && !SUIVIS_AVEC_ANNULER.includes(f), f).toBe(true);
    }
  });

  it("jamais un montant pour une face caméra : BoutonAnnuler ne montre le montant que si `depense` est donné", () => {
    const s = lire("src/components/videos/BoutonAnnuler.tsx");
    expect(s).toMatch(/depense\s*\?/);
    expect(lire("src/components/facecam/AttenteFacecam.tsx")).not.toMatch(/<BoutonAnnuler[^>]*depense=/);
  });
});

describe("Nettoyer les vidéos non terminées", () => {
  it("le composant existe, liste d'abord (cases cochées par défaut, compteur) et ne s'exécute jamais seul", () => {
    const s = lire("src/components/videos/NettoyerNonTerminees.tsx");
    expect(s).toContain("listerANettoyerAction");
    expect(s).toContain("nettoyerVideosAction");
    expect(s).toMatch(/setCochees\(new Set\(liste\.map\(/); // cochées par défaut
    expect(s).not.toMatch(/useEffect\([^)]*nettoyerVideosAction/);
  });

  it("présent dans Mes vidéos et sur chaque page de générateur", () => {
    expect(lire("src/app/(studio)/videos/page.tsx")).toMatch(/<NettoyerNonTerminees\b/);
    expect(lire("src/app/(studio)/formats/[id]/page.tsx")).toMatch(/<NettoyerNonTerminees\b/);
  });
});
