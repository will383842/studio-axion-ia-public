/**
 * Intégration de la variété : les 4 défauts vus à l'œil sur les planches de la répétition générale
 * (`docs/formats/image-video/variete/integration/repetition/resume.md`), chacun mesuré ici (rouge avant le correctif).
 *  1. TYP-C : la ligne suivante glisse sous un cache et reste illisible ; écran vide avant le premier mot.
 *  2. Texte qui sort du cadre : en-tête trop long (« BON DE COMMANDE MARTIN »), carte d'OUV-E en 4:5.
 *  3. Repère « k/3 » de REC-D posé SUR l'en-tête.
 *  4. Contraste : sous-titres pâles sur ivoire, encre sur nuit (OUV-A), SOU-C en contour sur l'appoint de l'ouverture.
 */
import { describe, expect, it, vi } from "vitest";
import { TAILLES_DUO } from "@/briques/habillage/charte-duo";
import { BAS_TITRE, ECART_ETIQUETTE, HAUT_ENTETE, HAUT_REPERE, largeurLigneTitre, PLANCHER_PX, planTitre } from "@/briques/schema-motion/plan-objets";
import { MISE_EN_PAGE_IV } from "@/briques/schema-motion/types";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES, ficheSimuleeRecit } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { fondDessineIV, passagesIvoireIV, sousTitresVariesIV } from "@/moteurs/montage-image-video/sous-titres-varies";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { grosPlanOuvE } from "../../../studio-rendu/compositions/image-video/variete/ouverture/donnees";
import { REPERE_RECIT_D } from "../../../studio-rendu/compositions/image-video/variete/recit/etapes";
import { hautPastilleRecitB, PASTILLE_RECIT_B } from "../../../studio-rendu/compositions/image-video/variete/recit/resultat";
import { GLISSADE_TYP_C, heureGlissadeTypC, partVisibleTypC, rangeesTexte, zonesTexte, type DonneesTexte } from "../../../studio-rendu/compositions/image-video/variete/texte/donnees";
import { carteFixe } from "../doubles-fabrication";

vi.setConfig({ testTimeout: 240_000 });

const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Nom = keyof typeof IMAGES;
const NOMS = Object.keys(IMAGES) as Nom[];

function ligneDe(nom: Nom, sur: Partial<RecetteVarieteIV>, format: "9:16" | "4:5" = "9:16"): LigneDeTempsIV {
  const carte = carteFixe(nom);
  const recette = { ...RECETTE_REFERENCE_IV, ...sur } as RecetteVarieteIV;
  const fiche = ficheSimuleeRecit(carte.image.empreinte, recette.recit) ?? FICHES_SIMULEES[IMAGES[nom]];
  const reseau = format === "4:5" ? "linkedin" : "youtube-shorts";
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV, variete: recette, format }).ligne;
}
const varietes = (l: LigneDeTempsIV, axe: string, code?: string) => l.blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "variete" }> => b.sorte === "variete" && b.axe === axe && (!code || b.code === code));

describe("défaut 1 · TYP-C : jamais une ligne qui reste coupée sous son cache, jamais un écran vide au début", () => {
  /** Durée (s) pendant laquelle un mot est vu en partie seulement (entre 5 % et 95 % sorti de son cache). */
  const dureeCoupee = (heure: number) => {
    let n = 0;
    for (let t = heure; t < heure + 1; t += 0.002) {
      const p = partVisibleTypC(t, heure);
      if (p > 0.05 && p < 0.95) n++;
    }
    return n * 0.002;
  };

  it("un mot n'est coupé par son cache que 0,1 s au plus", () => {
    expect(GLISSADE_TYP_C).toBeLessThanOrEqual(0.15);
    expect(dureeCoupee(1)).toBeLessThanOrEqual(0.1);
  });

  it("sur les 6 cartes, chaque écran TYP-C montre sa première rangée dès son début (si elle est dite dans les 0,6 s, sans chiffre)", () => {
    let ecrans = 0;
    for (const nom of NOMS) {
      for (const b of varietes(ligneDe(nom, { texte: "TYP-C" }), "texte", "TYP-C")) {
        const d = b.donnees as DonneesTexte;
        const z = zonesTexte(1920);
        const rangees = rangeesTexte(d.lignes, z.haut, z.bas, 920, 280);
        const premiere = rangees[0].mots.map((i) => d.lignes[rangees[0].ligne].mots[i]);
        if (premiere[0].t > 0.6 || premiere.some((m) => /\d/.test(m.mot))) continue;
        ecrans++;
        // À 0,1 s du début de l'écran, les mots de la première rangée déjà dits (0,6 s) sont lisibles.
        for (const m of premiere.filter((x) => x.t <= 0.6)) expect(partVisibleTypC(0.1, heureGlissadeTypC(m, true)), `${nom} ${b.id} « ${m.mot} »`).toBeGreaterThanOrEqual(0.95);
      }
    }
    expect(ecrans).toBeGreaterThan(0);
  });

  it("un chiffre n'est jamais montré avant son mot (Q13), même dans la première rangée", () => {
    expect(heureGlissadeTypC({ mot: "20", t: 0.4 }, true)).toBe(0.4);
    expect(heureGlissadeTypC({ mot: "matin", t: 0.4 }, true)).toBe(0);
    expect(heureGlissadeTypC({ mot: "matin", t: 0.4 }, false)).toBe(0.4);
  });
});

describe("défaut 2 · texte qui sort du cadre : réduit ou sur 2 lignes, jamais coupé", () => {
  it("« Bon de commande *Martin* » (vidéo 3, 33 s) tient dans 88 % de la largeur à la chasse réelle d'Anton", () => {
    const t = planTitre("Bon de commande *Martin*", 1080, 1920);
    expect(t.alerte).toBeNull();
    for (const l of t.lignes) expect(largeurLigneTitre(l, t.taille)).toBeLessThanOrEqual(0.88 * 1080 + 1e-6);
    expect(t.taille).toBeGreaterThanOrEqual(PLANCHER_PX - 1e-9);
  });

  it("tous les titres d'en-tête des 6 cartes, avec et sans variété, tiennent dans le cadre", () => {
    const titres = new Set<string>();
    for (const nom of NOMS) {
      for (const l of [ligneDe(nom, {}), ligneDe(nom, { recit: "REC-D" }), ligneDe(nom, { chiffres: "CHI-C" })]) {
        for (const x of JSON.stringify(l.blocs).matchAll(/"titre":"([^"]+)"/g)) titres.add(x[1]);
      }
    }
    expect(titres.size).toBeGreaterThan(10);
    for (const titre of titres) {
      const t = planTitre(titre, 1080, 1920);
      if (t.alerte) continue;
      for (const l of t.lignes) expect(largeurLigneTitre(l, t.taille), titre).toBeLessThanOrEqual(0.88 * 1080 + 1e-6);
    }
  });

  it("OUV-E en 4:5 : la carte du gros plan est fermée dans le cadre, son libellé y tient (« Alerte Telegram » et les plus longs)", () => {
    for (const libelle of ["Alerte Telegram", "IA classe et répond", "Résolu sans intervention humaine", "Ticket clôturé automatiquement"]) {
      const g = grosPlanOuvE(libelle, "4:5");
      expect(g.carte.x + g.carte.l, libelle).toBeLessThanOrEqual(1080 - 20);
      expect(g.texte.x + g.texte.largeur, libelle).toBeLessThanOrEqual(g.carte.x + g.carte.l - 16 - 40);
      expect(g.texte.taille, libelle).toBeGreaterThanOrEqual(58);
      expect(g.texte.lignes.join(" "), libelle).toBe(libelle);
    }
    // 9:16 : la maquette OUV-E-1 (carte qui déborde à droite) est gardée ; le libellé, lui, ne sort jamais.
    expect(grosPlanOuvE("Alerte Telegram", "9:16").carte.l).toBe(1200);
  });
});

describe("défaut 3 · repère « k/3 » de REC-D : jamais sur l'en-tête", () => {
  it("le repère posé sur une toile ne recouvre ni la marque, ni l'étiquette, ni le titre (une ou deux lignes)", () => {
    const { echelle, y } = REPERE_RECIT_D;
    const hautRepere = PLANCHER_PX * 1.3 * echelle;
    const m = MISE_EN_PAGE_IV["9:16"];
    const basMarque = (m.hautMarque + 0.03) * 1920;
    const hautEntete = HAUT_ENTETE * 1920;
    // Boîte du titre : de l'étiquette au bas du titre le plus haut possible (BAS_TITRE).
    expect(y).toBeGreaterThanOrEqual(basMarque);
    const disjoint = y + hautRepere <= hautEntete || y >= BAS_TITRE * 1920;
    expect(disjoint).toBe(true);
    // Les titres réels des toiles de REC-D (6 cartes) : leur bas ne descend jamais sur le repère.
    for (const nom of NOMS) {
      const l = ligneDe(nom, { recit: "REC-D" });
      for (const b of l.blocs) {
        if (b.sorte !== "toile") continue;
        for (const e of b.proprietes.entetes ?? []) {
          const t = planTitre(e.titre, 1080, 1920);
          const bas = hautEntete + (TAILLES_DUO.etiquette + ECART_ETIQUETTE) * 1920 + t.lignes.length * t.taille * 1.05;
          expect(y + hautRepere <= hautEntete || y >= bas, `${nom} « ${e.titre} »`).toBe(true);
        }
      }
    }
  });

  it("à sa place habituelle (écran d'objets), le repère tient entre la marque et l'étiquette", () => {
    expect(HAUT_REPERE * 1920 + PLANCHER_PX * 1.3).toBeLessThanOrEqual(HAUT_ENTETE * 1920);
  });
});

describe("défaut 3 bis · pastille « 80 % » de REC-B : jamais sur le titre de l'en-tête ni sur l'étiquette", () => {
  // Répétition générale du 17/10/2026 : la pastille (haut 414, hauteur 112, bas 526) mordait le titre (bas à 470) et touchait « CHATBOT IA ».
  for (const format of ["9:16", "4:5"] as const) {
    it(`${format} : la pastille tient dans la bande entre le bas de la marque et le haut de l'étiquette`, () => {
      const m = MISE_EN_PAGE_IV[format];
      const H = format === "4:5" ? 1350 : 1920;
      const basMarque = (m.hautMarque + 0.03) * H;
      const hautEtiquette = (format === "9:16" ? HAUT_ENTETE : m.entete.haut) * H;
      const haut = hautPastilleRecitB(format);
      expect(haut).toBeGreaterThanOrEqual(basMarque);
      expect(haut + PASTILLE_RECIT_B.hauteur).toBeLessThanOrEqual(hautEtiquette);
      // La bande est la plus étroite en 4:5 (104 px pour 92 px) : la pastille y tient, sans marge de reste.
      expect(hautEtiquette - basMarque).toBeGreaterThanOrEqual(PASTILLE_RECIT_B.hauteur);
    });
  }

  it("9:16 : la pastille est posée à 156 px, au-dessus de l'étiquette (259 px) ; le bas du titre est à 470 px", () => {
    expect(hautPastilleRecitB("9:16")).toBe(156);
    expect(hautPastilleRecitB("9:16") + PASTILLE_RECIT_B.hauteur).toBeLessThan(BAS_TITRE * 1920);
  });

  it("9:16 : le bord droit de la pastille reste hors de la zone protégée de droite (18 % de 1080)", () => {
    expect(PASTILLE_RECIT_B.droite).toBeGreaterThanOrEqual(0.18 * 1080);
  });
});

describe("défaut 4 · contraste : sous-titres lisibles sur le fond que l'écran DESSINE", () => {
  const recouvre = (p: { debutSec: number; finSec: number }[], b: { debut: number; fin: number }) => p.filter((x) => x.debutSec < b.fin - 1e-6 && x.finSec > b.debut + 1e-6).reduce((s, x) => s + Math.min(x.finSec, b.fin) - Math.max(x.debutSec, b.debut), 0);

  it("chaque écran de variété : encre sur ivoire pendant tout l'écran ivoire, style clair pendant tout l'écran nuit", () => {
    const recettes: Partial<RecetteVarieteIV>[] = [{ ouverture: "OUV-A" }, { ouverture: "OUV-C" }, { fin: "FIN-C" }, { fin: "FIN-D" }, { chiffres: "CHI-C" }, { chiffres: "CHI-D" }, { texte: "TYP-B" }, { texte: "TYP-C" }];
    let vus = 0;
    for (const nom of NOMS) {
      for (const r of recettes) {
        const l = ligneDe(nom, r);
        const passages = passagesIvoireIV(l);
        for (const b of l.blocs) {
          const fond = fondDessineIV(b, l.hauteur);
          if (!fond) continue;
          vus++;
          const ivoire = recouvre(passages, b);
          if (fond === "ivoire") expect(ivoire, `${nom} ${JSON.stringify(r)} ${b.id} ivoire`).toBeCloseTo(b.fin - b.debut, 3);
          else expect(ivoire, `${nom} ${JSON.stringify(r)} ${b.id} nuit`).toBeCloseTo(0, 3);
        }
      }
    }
    expect(vus).toBeGreaterThan(20);
  });

  it("cas vus : OUV-A (carte E) nuit → sous-titres clairs ; FIN-C (carte C) ivoire → sous-titres à l'encre", () => {
    const e = ligneDe("E", { ouverture: "OUV-A" });
    const ouv = varietes(e, "ouverture", "OUV-A")[0];
    expect(ouv).toBeDefined();
    expect(recouvre(passagesIvoireIV(e), ouv)).toBe(0);
    const c = ligneDe("C", { fin: "FIN-C" });
    const fin = varietes(c, "fin", "FIN-C")[0];
    expect(fin).toBeDefined();
    expect(recouvre(passagesIvoireIV(c), fin)).toBeCloseTo(fin.fin - fin.debut, 3);
  });

  it("SOU-C : aucun accent (contour, bandeau) pendant l'ouverture, au-dessus de ses objets d'appoint (6 cartes, 9:16)", () => {
    for (const nom of NOMS) {
      const l = ligneDe(nom, { sousTitres: "SOU-C" });
      const ouv = varietes(l, "ouverture")[0];
      if (!ouv) continue;
      const accents = sousTitresVariesIV(l).filter((s) => (s.style === "impact" || s.style === "bandeau") && s.debutSec < ouv.fin - 1e-6 && s.finSec > ouv.debut + 1e-6);
      expect(accents.map((s) => s.mots.map((m) => m.mot).join(" ")), nom).toEqual([]);
    }
  });
});
