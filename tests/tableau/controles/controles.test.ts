/**
 * Contrôles propres au tableau animé (TB-22, plan § 12) : un cas livrable, un refus par famille de contrôle, la
 * relecture absente (« 1 élément non fait »), la variété levée par un motif.
 */
import { describe, expect, it } from "vitest";
import type { ResumeVisuel } from "../../../src/briques/variete";
import { controlerVideoTableau, miseEnPageBrique, type EntreeControleTableau, type OutilsControleTableau } from "../../../src/moteurs/montage-tableau/controles";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, ficheQuestionAbonne, texteScriptDe } from "../regles/exemples";
import { scene } from "../regles/outils";

const MESURES_BONNES = { lufs: -14, creteVraieDbtp: -2, imageNoireTete: 0, imagesNoiresHorsFin: 0, imagesFigeesHorsFin: 0, dureeSec: 60, vmaf: 95, vmafSeuil: 90 };
const RELECTURE_RAS: OutilsControleTableau = { relireImagesCles: () => ({ imagesLues: 6, remarques: [] }) };

const entree = (fiche = copie(ficheErreurCorrigee), extra: Partial<EntreeControleTableau> = {}): EntreeControleTableau => ({
  fiche,
  contexte: contexteExemple(fiche),
  historique: [],
  dejaVu: { coche: true, le: "2026-10-10" },
  mesures: MESURES_BONNES,
  ...extra,
});

const famillesEchouees = (r: Awaited<ReturnType<typeof controlerVideoTableau>>) => [...new Set(r.bloquants.map((l) => l.famille))];

describe("cas livrable", () => {
  it.each(Object.entries(EXEMPLES))("la fiche d'exemple « %s » est livrable, sans élément non fait", async (_nom, fiche) => {
    const r = await controlerVideoTableau(entree(copie(fiche)), RELECTURE_RAS);
    expect(r.bloquants.map((l) => l.raison)).toEqual([]);
    expect(r.verdict).toBe("livrable");
    expect(r.resume).toBe("Livrable");
    expect(r.nonFaits).toEqual([]);
    expect(r.phrases).toEqual([]);
  });

  it("le rapport couvre toutes les familles du plan § 12", async () => {
    const r = await controlerVideoTableau(entree(), RELECTURE_RAS);
    expect(new Set(r.lignes.map((l) => l.famille))).toEqual(new Set(["fiche", "variete", "deja-vu", "mise-en-page", "fichier", "relecture"]));
  });

  it("l'adaptation à la brique commune : fractions de l'image, une accroche sur la première image", () => {
    const fiche = copie(ficheErreurCorrigee);
    const boites = miseEnPageBrique(fiche, mettreEnPage(fiche)).boites;
    expect(boites.length).toBeGreaterThan(0);
    for (const b of boites) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.largeur).toBeLessThanOrEqual(1);
      expect(b.y + b.hauteur).toBeLessThanOrEqual(1);
    }
    expect(boites.filter((b) => b.role === "accroche" && b.debutSec === 0).length).toBeGreaterThan(0);
  });
});

describe("relecture des images clés : indicative", () => {
  it("absente : livrable avec « 1 élément non fait »", async () => {
    const r = await controlerVideoTableau(entree());
    expect(r.verdict).toBe("livrable");
    expect(r.resume).toBe("Livrable — 1 élément non fait");
    expect(r.nonFaits.map((l) => l.famille)).toEqual(["relecture"]);
    expect(r.phrases).toHaveLength(1);
    expect(r.phrases[0]).toMatch(/^Non fait · Relecture des images clés/);
  });

  it("en erreur : « non fait », sans bloquer", async () => {
    const r = await controlerVideoTableau(entree(), {
      relireImagesCles: () => {
        throw new Error("délai dépassé");
      },
    });
    expect(r.verdict).toBe("livrable");
    expect(r.nonFaits[0].raison).toContain("délai dépassé");
  });

  it("remarques : indicatives avec leur raison, jamais bloquantes", async () => {
    const r = await controlerVideoTableau(entree(), { relireImagesCles: async () => ({ imagesLues: 6, remarques: [{ image: 3, raison: "le dessin chevauche le titre." }] }) });
    expect(r.verdict).toBe("livrable");
    expect(r.bloquants).toEqual([]);
    expect(r.indicatifs).toHaveLength(1);
    expect(r.indicatifs[0].raison).toBe("Image clé n° 3 : le dessin chevauche le titre.");
  });
});

describe("un refus par famille de contrôle", () => {
  it("fiche : une règle refusée bloque et nomme la scène et la règle", async () => {
    const fiche = copie(ficheErreurCorrigee);
    scene(fiche, "s03").texteDit = "Autre texte que le script validé.";
    const r = await controlerVideoTableau({ ...entree(fiche), contexte: contexteExemple(copie(ficheErreurCorrigee)) }, RELECTURE_RAS);
    expect(r.verdict).toBe("bloque");
    expect(famillesEchouees(r)).toEqual(["fiche"]);
    expect(r.bloquants[0].raison).toContain("Scène s03");
    // Les contrôles qui dépendent de la fiche sont « non faits », pas inventés.
    expect(r.nonFaits.map((l) => l.famille)).toContain("mise-en-page");
  });

  it("variété : la même structure que l'une des deux dernières vidéos bloque", async () => {
    const hist: ResumeVisuel[] = [{ structure: "erreur-corrigee", dessins: ["autre-1"], accroche: "Tout autre sujet ici", format: "tableau-anime" }];
    const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { historique: hist }), RELECTURE_RAS);
    expect(r.verdict).toBe("bloque");
    expect(famillesEchouees(r)).toEqual(["variete"]);
    expect(r.bloquants[0].raison).toContain("a déjà servi");
    expect(r.bloquants[0].raison).toContain("Structure conseillée");
  });

  it("déjà-vu : case non cochée, absente, sans date ou datée du futur bloque", async () => {
    for (const dejaVu of [{ coche: false }, undefined, { coche: true }, { coche: true, le: "2027-01-01" }, { coche: true, le: "hier" }]) {
      const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { dejaVu }), RELECTURE_RAS);
      expect(r.verdict).toBe("bloque");
      expect(famillesEchouees(r)).toEqual(["deja-vu"]);
    }
  });

  it("mise en page : un texte clair sur fond clair bloque (contraste)", async () => {
    // Le contraste vient de l'habillage ; on vérifie ici que le refus de la brique remonte avec un seuil relevé.
    const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { seuilsImage: { ...seuilsParDefaut(), contrasteTexteMin: 21 } }), RELECTURE_RAS);
    expect(r.verdict).toBe("bloque");
    expect(famillesEchouees(r)).toEqual(["mise-en-page"]);
    expect(r.bloquants.some((l) => l.libelle === "Contraste")).toBe(true);
  });

  it("première image : sans accroche de 8 mots au plus, bloque", async () => {
    const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { seuilsImage: { ...seuilsParDefaut(), accrocheMotsMax: 1 } }), RELECTURE_RAS);
    expect(r.bloquants.map((l) => l.libelle)).toContain("Première image");
  });

  it("fichier exporté : volume hors cible, crête trop haute ou durée trop longue bloquent", async () => {
    const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { mesures: { ...MESURES_BONNES, lufs: -20, creteVraieDbtp: 0, dureeSec: 95 } }), RELECTURE_RAS);
    expect(r.verdict).toBe("bloque");
    expect(famillesEchouees(r)).toEqual(["fichier"]);
    expect(r.bloquants.map((l) => l.libelle).sort()).toEqual(["Crête du son", "Durée", "Volume du son"]);
  });

  it("fichier exporté absent : « non fait », sans bloquer", async () => {
    const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { mesures: undefined }), RELECTURE_RAS);
    expect(r.verdict).toBe("livrable");
    expect(r.nonFaits.map((l) => l.famille)).toEqual(["fichier"]);
  });

  it("verdict : plusieurs bloquants sont comptés, phrases en français sans sigle", async () => {
    const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { dejaVu: { coche: false }, mesures: { ...MESURES_BONNES, lufs: -20 } }), RELECTURE_RAS);
    expect(r.resume).toBe("Bloqué : 2 contrôles échoués");
    for (const p of r.phrases) expect(p).not.toMatch(/\b(LUFS|dBTP|VMAF)\b/);
  });
});

describe("variété levée par un motif", () => {
  const hist: ResumeVisuel[] = [{ structure: "erreur-corrigee", dessins: ["autre-1"], accroche: "Tout autre sujet ici", format: "tableau-anime" }];

  it("avec motif : livrable, le refus reste visible comme indicatif avec son motif", async () => {
    const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { historique: hist, leveeVariete: { motif: "Série voulue : même structure.", auteur: "Will" } }), RELECTURE_RAS);
    expect(r.verdict).toBe("livrable");
    expect(r.bloquants).toEqual([]);
    expect(r.indicatifs).toHaveLength(1);
    expect(r.indicatifs[0].famille).toBe("variete");
    expect(r.indicatifs[0].raison).toContain("Série voulue : même structure.");
  });

  it("motif vide ou d'espaces : ne lève rien", async () => {
    for (const motif of ["", "   "]) {
      const r = await controlerVideoTableau(entree(copie(ficheErreurCorrigee), { historique: hist, leveeVariete: { motif } }), RELECTURE_RAS);
      expect(r.verdict).toBe("bloque");
    }
  });

  it("autre structure que celle de l'historique : aucun refus", async () => {
    const f = copie(ficheQuestionAbonne);
    const r = await controlerVideoTableau(entree(f, { historique: hist }), RELECTURE_RAS);
    expect(r.bloquants).toEqual([]);
    expect(texteScriptDe(f)).toBeTruthy();
  });
});

function seuilsParDefaut() {
  return { volumeCible: -14, volumeTolerance: 1, creteMax: -1.5, dureeMaxSec: 90, tailleTexteMin: 0.03, contrasteTexteMin: 7, contrasteMarqueMin: 3, accrocheMotsMax: 8, bandeSousTitres: 0.14 };
}
