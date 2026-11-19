/**
 * S-09b-v19b · liste des modèles où les textes d'une carte tiennent (fonction pure, sans bouton).
 * Chemin réel : vraie `appliquerOperations` ; aucun objet monté à la main.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { entreesFacecamVides } from "@/domaine/facecam";
import { appliquerOperations, reglagesMonteurVides, type EtatMonteur, type OperationFacecam, type PassageMonteur } from "@/moteurs/montage-facecam/monteur";
import { MODELES_CARTE } from "@/moteurs/montage-facecam/monteur/operations";
import { carteDepuisTextesTous } from "@/briques/motion";
import type { IdModeleMotionTous } from "@/briques/motion/types-etendus";
import { modelesPossibles } from "@/moteurs/montage-facecam/monteur/modeles-possibles";

const MOTS = Array.from({ length: 100 }, (_, i) => ({ index: i, mot: `mot${i}`, debutPriseSec: 1 + i * 0.5, finPriseSec: 1.4 + i * 0.5, monteeSec: 1 + i * 0.5, retire: false }));
let n = 0;
const nouvelId = (p: string) => `${p}-${++n}`;
const appliquer = (ops: OperationFacecam[], etat: EtatMonteur) =>
  appliquerOperations(etat, ops, { mots: MOTS, dureePriseSec: 60, origine: "demande", consigneId: "k1", nouvelId });

const TEXTES = ["Les 3 étapes", "Écouter", "Former", "Mesurer"];
const carte: OperationFacecam = {
  type: "ajouterCarte", debutMot: 2, finMot: 10, modele: "liste", textes: TEXTES, html: null, disposition: "plein-ecran", description: "Les trois étapes", animationGardeeId: null,
};
const tient = (m: string) => carteDepuisTextesTous(m as IdModeleMotionTous, [...TEXTES]) !== null;

function etatAvecCarte() {
  const r = appliquer([carte], { facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() });
  expect(r.refusees).toEqual([]);
  return { etat: r.etat, p: (r.etat.facecam.passages as PassageMonteur[])[0] };
}

describe("S-09b-v19b · modelesPossibles", () => {
  it("a) carte « liste » à 3 lignes : check-list oui, liste (actuel) non, et rien qui ne tienne pas", () => {
    const l = modelesPossibles(TEXTES, "liste");
    expect(l).toContain("check-list");
    expect(l).not.toContain("liste");
    for (const m of MODELES_CARTE) expect(l.includes(m)).toBe(m !== "liste" && tient(m));
    // sans « actuel », la liste garde le modèle de départ ; l'ordre est celui de MODELES_CARTE
    expect(modelesPossibles(TEXTES)).toContain("liste");
    expect(modelesPossibles(TEXTES)).toEqual(MODELES_CARTE.filter(tient));
  });

  it("b) cohérence par le chemin réel : accepté si rendu, refusé « ne tiennent pas » sinon", () => {
    const { etat, p } = etatAvecCarte();
    const possibles = modelesPossibles(TEXTES, "liste");
    expect(possibles.length).toBeGreaterThan(0);
    for (const modele of MODELES_CARTE) {
      const r = appliquer([{ type: "modifierCarte", passageId: p.id, modele } as OperationFacecam], etat);
      if (possibles.includes(modele)) {
        expect(r.refusees, modele).toEqual([]);
        expect(r.appliquees, modele).toHaveLength(1);
      } else if (!tient(modele)) {
        expect(r.refusees, modele).toEqual([0]);
        expect(r.alertes.join(" "), modele).toContain("ne tiennent pas");
      }
    }
    expect(MODELES_CARTE.some((m) => !tient(m))).toBe(true);
  });

  it("c) textes vides : liste vide", () => {
    expect(modelesPossibles([])).toEqual([]);
    expect(modelesPossibles([], "liste")).toEqual([]);
    expect(modelesPossibles(TEXTES, null)).toContain("liste");
  });

  it("d) éteint = identique : seul src/components/facecam/CartesVideoFacecam.tsx importe modeles-possibles", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const e of readdirSync(d)) {
        const c = join(d, e);
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(e) && !c.endsWith("monteur/modeles-possibles.ts")) fichiers.push(c);
      }
    };
    parcourir(join(process.cwd(), "src"));
    expect(fichiers.length).toBeGreaterThan(100);
    const fautifs = fichiers.filter((f) => readFileSync(f, "utf8").includes("modeles-possibles"));
    expect(fautifs.map((f) => f.split(sep).join("/").replace(/^.*\/src\//, "src/"))).toEqual(["src/components/facecam/CartesVideoFacecam.tsx"]);
  });
});
