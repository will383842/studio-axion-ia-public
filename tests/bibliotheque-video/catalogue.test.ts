import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { COULISSE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { CATALOGUE_CAPACITES, ID, FAMILLES_CAPACITE, ligneCapacite, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import * as viaFichier from "@/briques/bibliotheque-video/catalogue";
import { familleDe, PREFIXE_COULISSE_V4 } from "@/briques/bibliotheque-video/noms";
import { LIGNES_TEXTE } from "@/briques/bibliotheque-video/catalogue/texte";
import { LIGNES_ARCHIVE } from "@/briques/bibliotheque-video/catalogue/archive";
import { LIGNES_ECRAN } from "@/briques/bibliotheque-video/catalogue/ecran";
import { LIGNES_CALQUES } from "@/briques/bibliotheque-video/catalogue/calques";
import { LIGNES_HABILLAGE } from "@/briques/bibliotheque-video/catalogue/habillage";
import { LIGNES_LOGOS_ZOOM_AVIS } from "@/briques/bibliotheque-video/catalogue/logos-zoom-avis";
import { LIGNES_OBJETS } from "@/briques/bibliotheque-video/catalogue/objets";
import { LIGNES_FINITION } from "@/briques/bibliotheque-video/catalogue/finition";
import { LIGNES_GENERIQUES } from "@/briques/bibliotheque-video/catalogue/generiques";
import { LIGNES_COUVERTURE } from "@/briques/bibliotheque-video/catalogue/couverture";
import { LIGNES_COULISSE_V4 } from "@/briques/bibliotheque-video/catalogue/coulisse-v4";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const estCoulisse = (id: string) => id.startsWith(PREFIXE_COULISSE_V4);
const racine = process.cwd();

describe("catalogue des capacités (C1-U1)", () => {
  it("identifiants uniques", () => {
    const ids = CATALOGUE_CAPACITES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("préfixe = famille admise (AM-12 : objet, accroche, rythme, mention, cadrage)", () => {
    for (const l of CATALOGUE_CAPACITES) expect(FAMILLES_CAPACITE).toContain(familleDe(l.id));
    for (const f of ["objet", "accroche", "rythme", "mention", "cadrage"]) expect(FAMILLES_CAPACITE).toContain(f);
  });

  it("une seule table de noms : égalité d'ensembles avec ID (hors coulisse)", () => {
    const duCatalogue = new Set(CATALOGUE_CAPACITES.filter((l) => !estCoulisse(l.id)).map((l) => l.id));
    expect(duCatalogue).toEqual(new Set(Object.values(ID)));
  });

  it("coulisse : 13 lignes motion.v4-coulisse.*, état coulisse, sans chantier", () => {
    const l = CATALOGUE_CAPACITES.filter((x) => estCoulisse(x.id));
    expect(l).toHaveLength(COULISSE_V4.length);
    expect(l).toHaveLength(13);
    for (const x of l) { expect(x.etat).toBe("coulisse"); expect(x.chantier).toBeNull(); }
    expect(l.map((x) => x.id)).toEqual(COULISSE_V4.map((f) => `${PREFIXE_COULISSE_V4}${f.id}`));
  });

  it("aucune autre ligne coulisse que texte.pastille-axion", () => {
    const autres = CATALOGUE_CAPACITES.filter((l) => l.etat === "coulisse" && !estCoulisse(l.id)).map((l) => l.id);
    expect(autres).toEqual([ID.textePastilleAxion]);
  });

  it("états de départ du § 3.3", () => {
    expect(etatCapacite(ID.planScenesFacecam)).not.toBe("prod");
    expect(etatCapacite(ID.planScenesFacecam)).toBe("eteint");
    expect(etatCapacite(ID.calqueTexteDerriereDouble)).toBe("absent");
    expect(ligneCapacite(ID.calqueTexteDerriereDouble)?.note).toBe("PAYANT, 2e rendu HeyGen par vidéo, 5.10 à 5.17 suspendues");
    for (const id of [ID.sonFamillesEtendues, ID.sonSurTransition]) {
      expect(etatCapacite(id)).toBe("prevu");
      expect(ligneCapacite(id)?.note).toContain("bloqué Q8");
    }
    // C2-U17b 18/11 : les 7 capacités de texte livrées passent de « prévu » à « éteint » (seconde lecture du pilote).
    expect(etatCapacite(ID.texteRepereEpaule)).toBe("eteint");
    expect(etatCapacite(ID.texteSortieAnimee)).toBe("eteint");
    expect(ligneCapacite(ID.texteSortieAnimee)?.chantier).toBe("2 (U19)");
    expect(ligneCapacite(ID.texteEscalier)?.chantier).toBe("2 (U20a, U20b)");
    expect(etatCapacite(ID.cadrageZoomV4)).toBe("eteint"); // C8-X01-b-v20j (seconde lecture du pilote)
    expect(etatCapacite(ID.cadrageZoomAvocat)).toBe("prod");
    expect(etatCapacite(ID.motionAvisClient)).toBe("prevu");
    expect(etatCapacite(ID.texteLogoOutil)).toBe("prevu");
  });

  it("aucune ligne etalonnage.* sur le chemin facecam-v4", () => {
    for (const l of CATALOGUE_CAPACITES.filter((x) => familleDe(x.id) === "etalonnage"))
      expect(JSON.stringify(l)).not.toContain("facecam-v4");
  });

  it("découpage K1 : chaque fichier n'a que ses familles", () => {
    const fam = (l: readonly { id: IdCapacite }[]) => l.map((x) => familleDe(x.id));
    expect(LIGNES_TEXTE.every((l) => familleDe(l.id) === "texte" && l.id !== ID.texteLogoOutil)).toBe(true);
    expect(LIGNES_ECRAN.every((l) => familleDe(l.id) === "ecran")).toBe(true);
    expect(new Set(fam(LIGNES_CALQUES))).toEqual(new Set(["calque", "plan-scenes"]));
    expect(LIGNES_HABILLAGE.every((l) => ["transition", "fond", "etalonnage", "son", "motion"].includes(familleDe(l.id)) && !estCoulisse(l.id) && l.id !== ID.motionAvisClient)).toBe(true);
    expect(LIGNES_LOGOS_ZOOM_AVIS.map((l) => l.id).sort()).toEqual(
      [ID.texteLogoOutil, ID.cadrageZoomClassique, ID.cadrageZoomAvocat, ID.cadrageZoomDemo, ID.cadrageCameraCasConcret, ID.cadrageZoomV4, ID.motionAvisClient].sort());
    expect(LIGNES_COULISSE_V4.every((l) => estCoulisse(l.id))).toBe(true);
  });

  it("fichiers vides : tableaux vides exportés et branchés dans index.ts", () => {
    // G2-02 : LIGNES_GENERIQUES n'est plus vide ; l'égalité exacte de ses 4 lignes remplace l'assertion « vide ».
    expect(LIGNES_GENERIQUES).toEqual(
      ["texte.sous-titres", "plan-scenes.generique", "son.pose", "etalonnage.lut"].map((id) => ({
        id, etat: "prevu", chantier: "E2 (G2-02, G2-03)", note: "générique : lit ses alias par format",
      })),
    );
    // C9-03 : LIGNES_OBJETS sort de la liste « vide » : égalité exacte de ses 12 lignes.
    expect(LIGNES_OBJETS).toEqual(
      ["trait", "marque", "etiquette", "appel", "chiffre", "etape", "cartes", "schema", "ecran", "reseau-schema", "manuscrit", "emoji"].map((o) => ({
        id: `objet.${o}`, etat: "prevu", chantier: "9", decision: "D3 § C", ...(o === "emoji" ? { note: "attend W-K / W-14" } : {}),
      })),
    );
    expect(Array.isArray(LIGNES_ARCHIVE)).toBe(true);
    expect(LIGNES_ARCHIVE).toHaveLength(0);
    // CATALOGUE-C10-C11-v21p : FINITION (chantier 10) et COUVERTURE (chantier 11) sortent de la liste « vide ».
    expect(LIGNES_FINITION.map((l) => ({ id: l.id, etat: l.etat, chantier: l.chantier }))).toEqual(
      ["accroche.script", "rythme.mesure", "etalonnage.noir-blanc", "texte.lueur", "texte.fond-clair"].map((id) => ({ id, etat: "prevu", chantier: "10" })),
    );
    expect(LIGNES_COUVERTURE.map((l) => ({ id: l.id, etat: l.etat, chantier: l.chantier }))).toEqual(
      [["texte.marques-au-mot", "eteint"], ["texte.selectif", "eteint"], ["texte.mode-carte", "prevu"], ["texte.effets", "prevu"], ["texte.accents-role", "prevu"],
        // C11-C2-a-v20k : 4 lignes ajoutées à la suite, rien retiré.
        ["cadrage.camera-couverture", "eteint"], ["ecran.carte-video-arrondie", "prevu"], ["ecran.grilles-archive", "prevu"], ["ecran.ecrans-composes", "prevu"]]
        .map(([id, etat]) => ({ id, etat, chantier: "11" })),
    );
    const index = readFileSync(join(racine, "src/briques/bibliotheque-video/catalogue/index.ts"), "utf8");
    for (const n of ["ARCHIVE", "OBJETS", "FINITION", "GENERIQUES", "COUVERTURE"]) expect(index).toContain(`...LIGNES_${n}`);
  });

  it("tableaux figés et catalogue.ts ré-exporte l'index", () => {
    expect(Object.isFrozen(CATALOGUE_CAPACITES)).toBe(true);
    for (const t of [LIGNES_TEXTE, LIGNES_ECRAN, LIGNES_CALQUES, LIGNES_HABILLAGE, LIGNES_LOGOS_ZOOM_AVIS, LIGNES_COULISSE_V4]) expect(Object.isFrozen(t)).toBe(true);
    expect(viaFichier.CATALOGUE_CAPACITES).toBe(CATALOGUE_CAPACITES);
    expect(ligneCapacite("texte.inconnu" as IdCapacite)).toBeUndefined();
  });
});

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("catalogue : gardes statiques", () => {
  const dir = join(racine, "src/briques/bibliotheque-video");
  const miens = [join(dir, "catalogue.ts"), ...fichiers(join(dir, "catalogue"))];
  const importsDe = (f: string) => [...readFileSync(f, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  const ARGENT = /(credits|budget-mensuel|mode-budget|autonomie-usine|couts|cle-depense-usine|depense-claude-[\w-]*|generation-claude)$/;

  it("aucun import de studio-rendu, @/services/, argent, ni CATALOGUE_V4", () => {
    for (const f of miens) {
      expect(readFileSync(f, "utf8")).not.toMatch(/CATALOGUE_V4/);
      for (const i of importsDe(f)) {
        expect(i).not.toMatch(/studio-rendu/);
        expect(i).not.toMatch(/^@\/services\//);
        expect(i).not.toMatch(ARGENT);
      }
    }
  });

  it("aucun fichier de studio-rendu/ n'importe bibliotheque-video", () => {
    const base = join(racine, "studio-rendu");
    for (const f of fichiers(base).filter((p) => !p.includes("node_modules")))
      expect(readFileSync(f, "utf8")).not.toMatch(/bibliotheque-video/);
  });
});
