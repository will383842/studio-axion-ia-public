/**
 * R4-03-b1 : lire une demande « changer l'extrait du téléphone » et l'appliquer au projet gardé (pur, branché nulle part).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appliquerDemandeExtraitV4,
  CLE_ENTREE_RETOUCHE_EXTRAIT_V4,
  lireDemandeExtraitV4,
  MESSAGES_REFUS_EXTRAIT_V4,
  rechercheAxionDe,
  type ClipRetoucheV4,
  type DemandeExtraitV4,
} from "@/moteurs/montage-facecam-animee/retouche-extrait-v4";
import { lireProjetGardeV4, manquesRetoucheGratuiteV4, type ProjetGardeV4 } from "@/moteurs/montage-facecam-animee/retouche-gratuite";
import { planValide } from "./plan-reference";

function projet(): ProjetGardeV4 {
  const plan = {
    ...planValide(),
    elementsV4: [
      { id: "Chiffre", debut: 0.5, fin: 1.8, mots: ["12"] },
      { id: "telephone-video", debut: 2, fin: 6, recherches: ["axion:mardi"], medias: ["broll/v4-1-0.mp4"], instants: [2.5, 4], lignes: [{ texte: "a", a: 3 }], motIndex: 4 },
      { id: "AvantApres", debut: 7, fin: 9, mots: ["a", "b", "c"] },
      { id: "telephone-video", debut: 10, fin: 14, recherches: ["axion:jeudi"], medias: ["broll/v4-3-0.mp4"] },
    ],
  };
  const p = lireProjetGardeV4({
    priseCle: "prises/brute.mp4",
    plan,
    gardes: [{ debutSec: 0, finSec: 10 }],
    videos: {
      fichiers: [
        { nom: "v4-1-0.mp4", cle: "videos/v4-1-0.mp4" },
        { nom: "v4-3-0.mp4", cle: "videos/v4-3-0.mp4" },
      ],
      choix: [
        { fichier: "v4-1-0.mp4", source: "archive-axion", id: "a1", scene: "s1" },
        { fichier: "v4-3-0.mp4", source: "archive-axion", id: "a3", scene: "s3" },
      ],
    },
  });
  if (!p) throw new Error("fixture illisible");
  return p;
}

const clip = (nom = "v4-1-r1.mp4"): ClipRetoucheV4 => ({ nom, cle: `videos/${nom}`, choix: { fichier: nom, source: "archive-axion", id: "n1", scene: "s1" } });
const succes = (r: ReturnType<typeof appliquerDemandeExtraitV4>) => {
  if (!("projet" in r)) throw new Error(`refus inattendu : ${r.refus.code}`);
  return r.projet;
};
const code = (r: ReturnType<typeof appliquerDemandeExtraitV4>) => ("refus" in r ? r.refus.code : "SUCCES");

describe("R4-03-b1 · remplacer", () => {
  it("pose le nouvel extrait, remplace l'ancien choix, garde les anciens fichiers", () => {
    const sortie = succes(appliquerDemandeExtraitV4(projet(), { action: "remplacer", rang: 1, recherche: "ma vidéo de mardi" }, clip()));
    const el = sortie.plan.elementsV4![1];
    expect(el.medias).toEqual(["broll/v4-1-r1.mp4"]);
    expect(el.recherches![0].startsWith("axion:")).toBe(true);
    expect(sortie.videos!.fichiers.map((f) => f.nom)).toEqual(["v4-1-0.mp4", "v4-3-0.mp4", "v4-1-r1.mp4"]);
    const choix = sortie.videos!.choix as { fichier: string }[];
    expect(choix.map((c) => c.fichier)).toEqual(["v4-3-0.mp4", "v4-1-r1.mp4"]);
    expect(manquesRetoucheGratuiteV4(sortie)).toEqual([]);
  });
  it("une recherche déjà préfixée n'est pas doublée", () => {
    const sortie = succes(appliquerDemandeExtraitV4(projet(), { action: "remplacer", rang: 1, recherche: "axion:mardi plage" }, clip()));
    expect(sortie.plan.elementsV4![1].recherches).toEqual(["axion:mardi plage"]);
    expect(rechercheAxionDe("  Axion:abc ")).toBe("Axion:abc");
  });
});

describe("R4-03-b1 · retirer", () => {
  it("ôte le téléphone, garde les autres à l'identique, ôte ses fichiers seuls", () => {
    const sortie = succes(appliquerDemandeExtraitV4(projet(), { action: "retirer", rang: 1 }));
    expect(sortie.plan.elementsV4).toHaveLength(3);
    expect(sortie.plan.elementsV4![2].medias).toEqual(["broll/v4-3-0.mp4"]);
    expect(sortie.videos!.fichiers.map((f) => f.nom)).toEqual(["v4-3-0.mp4"]);
    expect((sortie.videos!.choix as { fichier: string }[]).map((c) => c.fichier)).toEqual(["v4-3-0.mp4"]);
  });
});

describe("R4-03-b1 · déplacer", () => {
  it("refuse hors durée, fin <= début, plus long que l'ancien, et chevauchement", () => {
    expect(code(appliquerDemandeExtraitV4(projet(), { action: "deplacer", rang: 1, debut: 20, fin: 23 }))).toBe("HORS_DUREE");
    expect(code(appliquerDemandeExtraitV4(projet(), { action: "deplacer", rang: 1, debut: 5, fin: 5 }))).toBe("HORS_DUREE");
    expect(code(appliquerDemandeExtraitV4(projet(), { action: "deplacer", rang: 1, debut: 2, fin: 9 }))).toBe("HORS_DUREE");
    expect(code(appliquerDemandeExtraitV4(projet(), { action: "deplacer", rang: 1, debut: 11, fin: 14 }))).toBe("CHEVAUCHEMENT");
  });
  it("déplacement valide : instants et lignes décalés, motIndex retiré", () => {
    const sortie = succes(appliquerDemandeExtraitV4(projet(), { action: "deplacer", rang: 1, debut: 16, fin: 20 }));
    const el = sortie.plan.elementsV4![1];
    expect([el.debut, el.fin]).toEqual([16, 20]);
    expect(el.instants).toEqual([16.5, 18]);
    expect(el.lignes![0].a).toBe(17);
    expect(el.motIndex).toBeUndefined();
    expect("motIndex" in el).toBe(false);
  });
});

describe("R4-03-b1 · refus", () => {
  it("élément introuvable", () => {
    for (const rang of [0, 9]) expect(code(appliquerDemandeExtraitV4(projet(), { action: "retirer", rang }))).toBe("ELEMENT_INTROUVABLE");
    expect(MESSAGES_REFUS_EXTRAIT_V4.ELEMENT_INTROUVABLE).toBe("Ce téléphone n'existe plus dans cette version : rien n'a changé.");
  });
  it("sans clip : AUCUN_EXTRAIT ; nom pris ou mal formé : NOM_PRIS", () => {
    const d: DemandeExtraitV4 = { action: "remplacer", rang: 1, recherche: "x" };
    expect(code(appliquerDemandeExtraitV4(projet(), d))).toBe("AUCUN_EXTRAIT");
    expect(MESSAGES_REFUS_EXTRAIT_V4.AUCUN_EXTRAIT).toContain("rien n'a changé.");
    expect(code(appliquerDemandeExtraitV4(projet(), d, clip("v4-1-0.mp4")))).toBe("NOM_PRIS");
    expect(code(appliquerDemandeExtraitV4(projet(), d, clip("v4-3-r1.mp4")))).toBe("NOM_PRIS");
    const deja = succes(appliquerDemandeExtraitV4(projet(), d, clip()));
    expect(code(appliquerDemandeExtraitV4(deja, d, clip()))).toBe("NOM_PRIS");
  });
  it("toute phrase de refus finit par « rien n'a changé. »", () => {
    for (const m of Object.values(MESSAGES_REFUS_EXTRAIT_V4)) expect(m.endsWith("rien n'a changé.")).toBe(true);
    expect(MESSAGES_REFUS_EXTRAIT_V4.ARCHIVE_VIDE).toBe("Votre archive n'a encore aucune vidéo utilisable : rien n'a changé.");
  });
});

describe("R4-03-b1 · éteint = identique", () => {
  it("lireDemandeExtraitV4 rend null pour tout ce qui est invalide", () => {
    const mauvais: unknown[] = [
      undefined, null, {}, { action: "ajouter" },
      { action: "retirer", rang: 1, en: "trop" },
      { action: "retirer", rang: -1 }, { action: "retirer", rang: 1.5 },
      { action: "remplacer", rang: 1, recherche: "x".repeat(55) }, { action: "remplacer", rang: 1, recherche: "   " },
      { action: "remplacer", rang: 1, recherche: "ok", sourceVideoId: "" },
      { action: "deplacer", rang: 1, debut: -1, fin: 3 }, { action: "deplacer", rang: 1, debut: 1, fin: Number.NaN },
    ];
    for (const m of mauvais) expect(lireDemandeExtraitV4(m)).toBeNull();
    expect(CLE_ENTREE_RETOUCHE_EXTRAIT_V4).toBe("retoucheExtraitV4");
  });
  it("lit les demandes valides, recherche nettoyée", () => {
    expect(lireDemandeExtraitV4({ action: "remplacer", rang: 1, recherche: "  mardi  ", sourceVideoId: "v9" })).toEqual({ action: "remplacer", rang: 1, recherche: "mardi", sourceVideoId: "v9" });
    expect(lireDemandeExtraitV4({ action: "remplacer", rang: 0, recherche: "x".repeat(54) })).not.toBeNull();
    expect(lireDemandeExtraitV4({ action: "retirer", rang: 0 })).toEqual({ action: "retirer", rang: 0 });
    expect(lireDemandeExtraitV4({ action: "deplacer", rang: 3, debut: 1, fin: 4 })).toEqual({ action: "deplacer", rang: 3, debut: 1, fin: 4 });
  });
  it("le projet d'entrée n'est jamais muté (succès ou refus), même gelé", () => {
    const demandes: [DemandeExtraitV4, ClipRetoucheV4 | undefined][] = [
      [{ action: "remplacer", rang: 1, recherche: "x" }, clip()],
      [{ action: "remplacer", rang: 1, recherche: "x" }, undefined],
      [{ action: "retirer", rang: 1 }, undefined],
      [{ action: "retirer", rang: 0 }, undefined],
      [{ action: "deplacer", rang: 1, debut: 16, fin: 20 }, undefined],
      [{ action: "deplacer", rang: 1, debut: 11, fin: 14 }, undefined],
    ];
    for (const [d, c] of demandes) {
      const p = projet();
      const copie = structuredClone(p);
      const gel = (x: unknown): void => {
        if (x && typeof x === "object") {
          Object.values(x).forEach(gel);
          Object.freeze(x);
        }
      };
      gel(p);
      appliquerDemandeExtraitV4(p, d, c);
      expect(p).toEqual(copie);
    }
  });
});

describe("R4-03-b1 · gardes statiques", () => {
  const racine = process.cwd();
  const chemin = join(racine, "src/moteurs/montage-facecam-animee/retouche-extrait-v4.ts");
  it("le fichier reste pur", () => {
    const src = readFileSync(chemin, "utf8");
    expect(src).not.toMatch(/from\s+["']@\/services\//);
    expect(src).not.toContain("telephone-extrait-v4");
    expect(src).not.toMatch(/credits|budget|depense|couts|plafond|lireParametre/);
    expect(src).not.toMatch(/\bDate\b|Math\.random/);
  });
  it("seul src/services/retouche-extrait-v4-demande.ts importe retouche-extrait-v4", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (statSync(c).isDirectory()) parcourir(c);
        else if (/\.(ts|tsx)$/.test(n)) fichiers.push(c);
      }
    };
    parcourir(join(racine, "src"));
    const autorise = join(racine, "src/services/retouche-extrait-v4-demande.ts");
    const importeurs = fichiers.filter((f) => f !== chemin && /(?<!sources-)retouche-extrait-v4["']/.test(readFileSync(f, "utf8")));
    expect(importeurs).toEqual([autorise]);
  });
});
