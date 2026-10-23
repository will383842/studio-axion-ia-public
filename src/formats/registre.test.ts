/** Chaque format inscrit est complet et cohérent (PLAN B.6.1). */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESSINS } from "@/briques/dessins";
import { CLES_ETAPES } from "@/assistant/etapes/meta";
import { moteurExiste } from "@/moteurs";
import { BRIQUES_FACULTATIVES } from "@/domaine/types";
import { briquesCoupables, briquesEffectives, conseilSite, dureeParDefaut, listerFormats, regleChapitresWeb, reglagesParDefaut, valeursDuree } from "./index";
import { resoudreRecette } from "./familles";
import { formatAvocat } from "./avocat";
import type { PiecesFormat } from "./types";

describe("registre des formats", () => {
  const formats = listerFormats({ inclureMasques: true });

  it("a des identifiants uniques et au moins un format actif", () => {
    expect(new Set(formats.map((f) => f.id)).size).toBe(formats.length);
    expect(formats.some((f) => f.statut === "actif")).toBe(true);
  });

  it("accepte un format sans aucune brique facultative (« Vidéo brute ») — AV2.7", () => {
    const brute = { ...formatAvocat, id: "brute", briques: {} };
    expect(briquesCoupables(brute)).toEqual([]);
    expect(Object.values(briquesEffectives(brute)).every((v) => v === false)).toBe(true);
  });

  it("une brique coupée pour une vidéo est désactivée", () => {
    const b = briquesEffectives(formatAvocat, ["sous-titres"]);
    expect(b["sous-titres"]).toBe(false);
    expect(b.etalonnage).toBe(true);
  });

  for (const f of formats) {
    describe(f.id, () => {
      it("ratios non vides, ratio maître inclus", () => {
        expect(f.ratios.length).toBeGreaterThan(0);
        expect(f.ratios).toContain(f.ratioMaitre);
      });
      it("durées triées et défaut valide (liste), ou zones cohérentes (depuis le script)", () => {
        const d = valeursDuree(f);
        expect([...d].sort((a, b) => a - b)).toEqual(d);
        expect(d).toContain(dureeParDefaut(f));
        if (f.durees.mode === "depuis-script") {
          expect(f.durees.zoneSec[0]).toBeLessThan(f.durees.zoneSec[1]);
          expect(f.durees.zoneOrangeSec[0]).toBe(f.durees.zoneSec[1]);
        }
      });
      it("étapes connues, finissant par apercu (ou l'écran « Votre vidéo ») puis fabrication", () => {
        for (const e of f.etapes) expect(CLES_ETAPES).toContain(e);
        // Parcours classique : … → apercu → fabrication ; écran « Votre vidéo » (lot M3) : express → fabrication.
        expect([["apercu", "fabrication"], ["express", "fabrication"]]).toContainEqual(f.etapes.slice(-2));
      });
      it("briques facultatives connues", () => {
        for (const b of Object.keys(f.briques)) expect(BRIQUES_FACULTATIVES).toContain(b);
      });
      it("moteur existant", () => expect(moteurExiste(f.moteur)).toBe(true));
      it("réglages : le schéma fournit des défauts et chaque champ a une clé du schéma", () => {
        const defauts = reglagesParDefaut(f);
        for (const c of f.reglages.champs) expect(defauts).toHaveProperty(c.cle);
      });
      it("recette : au moins deux blocs, critères pondérés", () => {
        expect(f.recetteScript.blocs.length).toBeGreaterThanOrEqual(2);
        expect(f.recetteScript.criteres.every((c) => c.poids > 0)).toBe(true);
        expect(f.recetteScript.motsParSeconde).toBeGreaterThan(0);
      });
      it("personnages cohérents", () => {
        expect(f.personnages.min).toBeLessThanOrEqual(f.personnages.max);
        // Qui parle : l'étape « distribution », ou le bloc Plateau de l'écran « Votre vidéo ».
        if (f.personnages.max > 0) expect(f.etapes.includes("distribution") || f.etapes.includes("express")).toBe(true);
      });
    });
  }
});

/**
 * Pièces déclarées (ORG-02, plan 01 § 4) : toute pièce qu'un format demande existe. Les registres des dessins et des
 * droits sont sur cette base. Habillage et stylo arrivent par une autre PR : tant que leur dossier `src/briques/<pièce>`
 * n'existe pas, seule la forme de l'identifiant (« nom/version ») est vérifiée. Les déclencheurs de sons n'ont pas encore
 * de registre : seule leur forme (identifiant en minuscules) est vérifiée.
 */
const IDENTIFIANT_PIECE = /^[a-z0-9]+(-[a-z0-9]+)*\/[1-9][0-9]*$/;
const DECLENCHEUR_SON = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const dossierBrique = (nom: string) => existsSync(join(process.cwd(), "src", "briques", nom));

function piecesManquantes(pieces: PiecesFormat | undefined): string[] {
  const manques: string[] = [];
  if (!pieces) return manques;
  if (pieces.habillage !== undefined && !IDENTIFIANT_PIECE.test(pieces.habillage)) manques.push(`habillage ${pieces.habillage}`);
  if (pieces.stylo !== undefined && !IDENTIFIANT_PIECE.test(pieces.stylo)) manques.push(`stylo ${pieces.stylo}`);
  if (pieces.dessins && DESSINS.length === 0) manques.push("dessins (banque vide)");
  for (const son of pieces.sons ?? []) if (!DECLENCHEUR_SON.test(son)) manques.push(`son ${son}`);
  return manques;
}

describe("pièces déclarées par les formats", () => {
  it("la vérification refuse une pièce mal formée ou absente", () => {
    expect(piecesManquantes({ habillage: "charte-video", stylo: "Crayon/1", sons: ["Page"] })).toEqual(["habillage charte-video", "stylo Crayon/1", "son Page"]);
    expect(piecesManquantes({ habillage: "charte-video/1", stylo: "crayon/1", dessins: true, sons: ["page"] })).toEqual([]);
  });

  it("la banque des dessins existe sur cette base", () => {
    expect(dossierBrique("dessins")).toBe(true);
    expect(DESSINS.length).toBeGreaterThan(0);
  });

  for (const f of listerFormats({ inclureMasques: true })) {
    it(`${f.id} : toute pièce déclarée existe`, () => {
      expect(piecesManquantes(f.pieces)).toEqual([]);
    });
  }
});

describe("vidéos sur le site (lot S1.4)", () => {
  for (const f of listerFormats({ inclureMasques: true })) {
    if (f.statut === "actif") {
      it(`${f.id} (actif) : déclare son conseil « site »`, () => {
        expect(f.site).toBeDefined();
        expect(["oui", "au-cas-par-cas", "non"]).toContain(conseilSite(f));
      });
    }
    it(`${f.id} : chaque bloc cité dans chapitresWeb existe dans sa recette`, () => {
      const ids = resoudreRecette(f).blocs.map((b) => b.id);
      const r = regleChapitresWeb(f);
      for (const b of r.rattaches ?? []) expect(ids).toContain(b);
      for (const b of Object.keys(r.libelles ?? {})) expect(ids).toContain(b);
    });
  }

  it("conseils du plan (§ 3.3) et défaut « non » pour un format qui ne déclare rien", () => {
    const attendu: Record<string, string> = { avocat: "oui", facecam: "au-cas-par-cas", "facecam-animee": "au-cas-par-cas", "tableau-anime": "oui", "cas-concret": "oui", "image-video": "non", podcast: "oui" };
    for (const [id, conseil] of Object.entries(attendu)) {
      const f = listerFormats({ inclureMasques: true }).find((x) => x.id === id)!;
      expect(conseilSite(f), id).toBe(conseil);
    }
    expect(conseilSite({ ...formatAvocat, site: undefined })).toBe("non");
    expect(regleChapitresWeb({ ...formatAvocat, chapitresWeb: undefined })).toEqual({});
    expect(regleChapitresWeb(formatAvocat)).toEqual({ rattaches: ["boucle"] });
  });
});
