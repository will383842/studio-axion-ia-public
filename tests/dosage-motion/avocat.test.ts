/**
 * X3-04 : avocat au cran « aucun » appliqué dans la commande (sans toucher fabrication.ts ni avocat-branchements.ts).
 * Pur : branche « avocat · aucun » de `appliquerDosage`. Éteint = rien ne change.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appliquerDosage } from "@/briques/dosage-motion/commande";
import { NIVEAU_DU_DOSAGE } from "@/briques/dosage-motion/crans";
import { orchestrerMontage } from "@/briques/intensite/montage";
import { ENTREE_MOTION_AVOCAT } from "@/moteurs/montage-avocat/motion";
import type { CommandeFabrication, SegmentSousTitres } from "@/domaine/types";
import type { PlanProduit } from "@/moteurs/types";

const plan = (ordre: number, sourceImage: "double" | "illustration", avecEffets: boolean) =>
  ({
    id: `p${ordre}`,
    ordre,
    debutSec: ordre * 4,
    finSec: ordre * 4 + 4,
    texte: `phrase ${ordre}`,
    sourceImage,
    angle: "face",
    motsEnValeur: [],
    cadrage: { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1, ...(avecEffets ? { zoomFin: 1.06 } : {}), valeur: "large" },
    illustration: avecEffets && sourceImage === "illustration" ? { requete: "un tribunal vide" } : undefined,
    texteEcran: avecEffets ? { texte: "Titre", position: "haut", style: "grand-titre" } : undefined,
  }) as unknown as PlanProduit;

const plansAvecEffets = () => [plan(0, "double", true), plan(1, "illustration", true), plan(2, "double", true), plan(3, "double", true)];

const commande = (): CommandeFabrication =>
  ({
    moteurId: "montage-avocat",
    formatId: "avocat",
    intensite: { niveau: "equilibre", bruitages: "aucun" },
    sousTitres: { base: "karaoke", intensite: "equilibre" },
    plans: plansAvecEffets(),
    entrees: { [ENTREE_MOTION_AVOCAT]: true, avocatConsignes: "une carte en intro", autre: 1 },
    styles: { habillage: { carteFin: { texte: "Merci" } } },
  }) as unknown as CommandeFabrication;

const segments = (): SegmentSousTitres[] =>
  [0, 1, 2, 3].map((i) => ({ id: `s${i}`, debutSec: i * 4, finSec: i * 4 + 4, style: "base", souligne: null, mots: [{ mot: "bonjour", debutSec: i * 4, finSec: i * 4 + 1 }] })) as unknown as SegmentSousTitres[];

const orchestre = (c: CommandeFabrication) =>
  orchestrerMontage({ niveau: c.intensite!.niveau, dureeSec: 16, plans: c.plans as unknown as PlanProduit[], segments: segments(), angleSecond: "profil" });
const types = (c: CommandeFabrication) => orchestre(c).decisions.map((d) => d.id.split(":")[1]);

describe("X3-04 · avocat · cran aucun", () => {
  const entree = commande();
  const sortie = appliquerDosage(entree, { cran: "aucun", choisiPar: "video" });

  it("plans sans illustration, sans texte à l'écran, sans zoom fin ; plan illustration ramené à un plan normal", () => {
    for (const p of sortie.plans as unknown as PlanProduit[]) {
      expect(p.illustration).toBeUndefined();
      expect(p.texteEcran).toBeUndefined();
      expect(p.cadrage?.zoomFin).toBeUndefined();
      expect(p.sourceImage).not.toBe("illustration");
    }
  });

  it("pas d'entrée avocatMotionCommune ; consignes du monteur et autres entrées gardées (règle 7)", () => {
    expect(ENTREE_MOTION_AVOCAT in (sortie.entrees as object)).toBe(false);
    expect(sortie.entrees).toStrictEqual({ avocatConsignes: "une carte en intro", autre: 1 });
  });

  it("niveau sobre, cran figé, carte de fin gardée, sous-titres gardés", () => {
    expect(sortie.dosageMotion).toStrictEqual({ cran: "aucun", choisiPar: "video" });
    expect(sortie.intensite?.niveau).toBe("sobre");
    expect(sortie.sousTitres).toStrictEqual({ base: "karaoke", intensite: "sobre" });
    expect(sortie.styles).toStrictEqual(entree.styles);
  });

  it("l'entrée n'est pas modifiée (pure)", () => {
    expect(entree).toStrictEqual(commande());
  });

  it("orchestrerMontage : 0 zoom-lent, 0 illustration, 0 impact, 0 bandeau ; sous-titres non vides", () => {
    const avant = types(entree);
    expect(avant).toContain("zoom-lent");
    expect(avant).toContain("illustration");
    const apres = types(sortie);
    for (const t of ["zoom-lent", "illustration", "impact", "bandeau"]) expect(apres).not.toContain(t);
    expect(orchestre(sortie).segments.length).toBeGreaterThan(0);
  });

  it("commande v1 (sans moteurId) du format avocat : même effet", () => {
    const { moteurId: _m, ...v1 } = commande();
    const s = appliquerDosage(v1 as CommandeFabrication, { cran: "aucun", choisiPar: "generateur" });
    expect(ENTREE_MOTION_AVOCAT in (s.entrees as object)).toBe(false);
  });

  it("une commande sans plans ni entrées ne casse pas", () => {
    const s = appliquerDosage({ moteurId: "montage-avocat", formatId: "avocat" } as unknown as CommandeFabrication, { cran: "aucun", choisiPar: "video" });
    expect(s.dosageMotion?.cran).toBe("aucun");
  });
});

describe("X3-04 · autres crans et autres formats : seul le niveau change", () => {
  it.each(["sobre", "equilibre", "dynamique"] as const)("avocat · %s : plans et entrées identiques", (cran) => {
    const e = commande();
    const s = appliquerDosage(e, { cran, choisiPar: "video" });
    expect(s.plans).toStrictEqual(e.plans);
    expect(s.entrees).toStrictEqual(e.entrees);
    expect(s.intensite?.niveau).toBe(NIVEAU_DU_DOSAGE[cran]);
  });

  it("facecam · aucun : plans et entrées inchangés (X3-04 ne concerne que l'avocat)", () => {
    const e = { ...commande(), moteurId: "montage-facecam", formatId: "facecam" } as CommandeFabrication;
    const s = appliquerDosage(e, { cran: "aucun", choisiPar: "video" });
    expect(s.plans).toStrictEqual(e.plans);
    expect(s.entrees).toStrictEqual(e.entrees);
  });

  it("éteint : l'enrobage du service rend la commande par référence (X3-03) et ne touche pas à ces branches", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/dosage-motion/commande.ts"), "utf8");
    expect(src).not.toMatch(/from "@\/(services|moteurs)/);
  });
});

describe("X3-04 · garde de périmètre", () => {
  it("la clé figée en dur dans la brique est celle du moteur avocat", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/dosage-motion/commande.ts"), "utf8");
    expect(src).toContain(`"${ENTREE_MOTION_AVOCAT}"`);
  });
});
