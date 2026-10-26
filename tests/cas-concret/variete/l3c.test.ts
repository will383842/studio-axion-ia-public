/**
 * L3c · fond fort, particules, lueur et barres proportionnelles : variations déterministes selon le tirage ; sans jeu
 * (ou tirage v4) : plans, fond et déclinaison IDENTIQUES à la v4 (empreintes épinglées depuis origin/master) ; jamais
 * de chiffre inventé (les textes des barres restent ceux de la fiche, seule leur longueur suit les nombres écrits).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enCapitales, type JeuEcran, type ProprietesEcran } from "@/briques/ecrans-motion";
import { COULEURS_DUO } from "@/briques/habillage/charte-duo";
import { estV4, mettre, miseDesEcrans, schemaMise, TIRAGE_V4, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import { exempleEcran, exemplesEcrans } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { lireNombreBarre, PART_MAINTENANT, partsBarres, planBarresAvantApres } from "../../../studio-rendu/compositions/cas-concret/plans/BarresAvantApres";
import { planChiffre } from "../../../studio-rendu/compositions/cas-concret/plans/Chiffre";
import { couleursDuFond } from "../../../studio-rendu/compositions/cas-concret/plans/commun";
import { couleursDeLEcran, couleursFortes, indiceLueur, LUEURS, proprietesFond, styleDuFond } from "../../../studio-rendu/compositions/cas-concret/plans/fond-fort";
import { planPreuve } from "../../../studio-rendu/compositions/cas-concret/plans/Preuve";
import { planResultat } from "../../../studio-rendu/compositions/cas-concret/plans/Resultat";
import { NB_PARTICULES, planTitre, reglageParticules } from "../../../studio-rendu/compositions/cas-concret/plans/Titre";
import { ECRANS_L3C, IMAGES, planDuCorps, serieL3c, TYPES_CORPS } from "./outils-l3c";

const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);
const avecJeu = <P extends ProprietesEcran>(p: P, jeu: JeuEcran): P => ({ ...p, jeu });
const resultat = (avant: string, maintenant: string, jeu?: JeuEcran) => {
  const p = exempleEcran("resultat") as Extract<ProprietesEcran, { type: "resultat" }>;
  return { ...p, avant, maintenant, ...(jeu ? { jeu } : {}) };
};

describe("L3c · la mise (variete.ts)", () => {
  it("estV4 : vrai pour TIRAGE_V4 (graine, sel, relâche et ordre des clés ignorés), faux dès qu'une dimension change", () => {
    expect(estV4(TIRAGE_V4)).toBe(true);
    expect(estV4({ ...TIRAGE_V4, graine: 7, sel: 2, relache: 3 })).toBe(true);
    const inverse = Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(TIRAGE_V4)) as Record<string, unknown>).reverse()) as Tirage;
    expect(estV4(inverse)).toBe(true);
    expect(estV4({ ...TIRAGE_V4, fondFort: 1 })).toBe(false);
    expect(estV4({ ...TIRAGE_V4, particules: { groupe: 2, densite: "v4" } })).toBe(false);
    expect(estV4({ ...TIRAGE_V4, miseEnPage: { ...TIRAGE_V4.miseEnPage, preuve: "gauche" } })).toBe(false);
    expect(estV4({ ...TIRAGE_V4, ouverture: "chiffre-choc" })).toBe(false);
  });

  it("aucun hasard ajouté : tirages et déclinaison (hors clés L3c et L7) EXACTEMENT ceux d'origin/master (empreinte épinglée)", () => {
    // Tirages ÉPINGLÉS dans un fichier (générés avant le lot C, quand `tirer` ne connaissait pas « v4 au plus 1 fois sur 4 ») :
    // la règle de tirage peut évoluer sans toucher à l'empreinte de la déclinaison.
    const tirages = JSON.parse(readFileSync(join(__dirname, "fixtures", "tirages-l3c.json"), "utf8")) as ReturnType<typeof serieL3c>;
    expect(tirages).toHaveLength(60);
    const mises = tirages.map((e) => {
      const m = mettre(e.tirage, ECRANS_L3C);
      const ecrans = Object.fromEntries(
        Object.entries(m.ecrans).map(([k, v]) => {
          const { groupeParticules: _g, densiteParticules: _d, barres: _b, animObjet: _a, ...reste } = v;
          void _a;
          void _g;
          void _d;
          void _b;
          return [k, reste];
        }),
      );
      return { ...m, ecrans };
    });
    // Empreinte mise à jour par le lot « variantes visibles » : poids de tirage rééquilibrés (sortie, mot par mot, fond fort), maquette d'ouverture et maquettes rares, pas de sortie sur le dernier écran, `habille`.
    expect(empreinte(mises)).toBe("271b09a100358c6b");
  });

  it("particules recopiées du tirage sur chaque écran, seulement hors v4 ; barres proportionnelles sur le résultat dès que le tirage n'est pas la v4", () => {
    for (const f of serieL3c(40)) {
      const m = miseDesEcrans(f.tirage, ECRANS_L3C);
      expect(schemaMise.safeParse({ version: "variete/1", tirage: f.tirage, ecrans: m }).success).toBe(true);
      for (const e of ECRANS_L3C) {
        const te = m[e.id]!;
        expect(te.groupeParticules).toBe(f.tirage.particules.groupe || undefined);
        expect(te.densiteParticules).toBe(f.tirage.particules.densite === "v4" ? undefined : f.tirage.particules.densite);
        expect(te.barres).toBe(e.type === "resultat" && !estV4(f.tirage) ? "proportionnelles" : undefined);
      }
      expect(miseDesEcrans(f.tirage, ECRANS_L3C)).toEqual(m);
    }
    // Variété réelle sur la série : plusieurs groupes et densités.
    const s = serieL3c(40);
    expect(new Set(s.map((e) => e.tirage.particules.groupe)).size).toBeGreaterThan(3);
    expect(new Set(s.map((e) => e.tirage.particules.densite)).size).toBe(3);
  });

  it("au plus 2 écrans forts par vidéo, jamais le premier, seulement sur résultat / chiffre / titre / preuve (100 vidéos)", () => {
    let forts = 0;
    for (const f of serieL3c(100)) {
      const m = miseDesEcrans(f.tirage, ECRANS_L3C);
      const ids = Object.entries(m).filter(([, v]) => v.fondFort).map(([k]) => k);
      expect(ids.length).toBeLessThanOrEqual(2);
      expect(ids.length).toBe(Math.min(2, f.tirage.fondFort));
      expect(ids).not.toContain("e01");
      for (const id of ids) expect(["resultat", "chiffre", "titre", "preuve"]).toContain(ECRANS_L3C.find((e) => e.id === id)!.type);
      forts += ids.length;
    }
    expect(forts).toBeGreaterThan(0);
  });
});

describe("L3c · sans jeu : la v4 exacte", () => {
  const EPINGLEES = JSON.parse(readFileSync(join(__dirname, "plans-v4.json"), "utf8")) as Record<string, string>;

  it("plans complets des 9 types du corps, deux fonds, 8 images : empreintes d'origin/master", () => {
    let n = 0;
    for (const p of exemplesEcrans().filter((x) => (TYPES_CORPS as readonly string[]).includes(x.type))) {
      for (const fond of ["sombre", "ivoire"] as const) {
        for (const i of IMAGES) {
          expect(empreinte(planDuCorps({ ...p, fond }, i)), `${p.type}/${fond}/${i}`).toBe(EPINGLEES[`${p.type}/${fond}/${i}`]);
          n++;
        }
      }
    }
    expect(n).toBe(Object.keys(EPINGLEES).length);
  });

  it("jeu sans valeur lue par le type (ou barres illisibles) : plan toEqual celui sans jeu, à chaque image", () => {
    for (const p of exemplesEcrans().filter((x) => (TYPES_CORPS as readonly string[]).includes(x.type))) {
      for (const i of IMAGES) expect(planDuCorps(avecJeu(p, { entree: "glissement" }), i)).toEqual(planDuCorps(p, i));
    }
    // Les particules ne changent que les plans qui en ont ; ailleurs, le plan est celui de la v4.
    for (const type of ["accroche", "question", "etape", "objet", "liste-avant", "preuve"] as const) {
      const p = exempleEcran(type);
      for (const i of IMAGES) expect(planDuCorps(avecJeu(p, { groupeParticules: 3, densiteParticules: "dense" }), i)).toEqual(planDuCorps(p, i));
    }
    // Barres demandées mais nombres illisibles / ambigus : retour EXACT à la v4.
    for (const [a, m] of [
      ["Tout à la main", "Automatique"],
      ["3 h", "200 articles"],
      ["2 à 3 h", "10 min"],
      ["1.5 h", "10 min"],
      ["0", "0"],
    ] as const) {
      for (const i of IMAGES) expect(planResultat(resultat(a, m, { barres: "proportionnelles" }), i)).toEqual(planResultat(resultat(a, m), i));
    }
  });

  it("fond : sans lueur ni fort (ou lueur ≡ 0), le style v4 au caractère près ; le composant garde son chemin v4", () => {
    for (const [l, h] of [
      [1080, 1920],
      [720, 1280],
      [1080, 1350],
    ] as const) {
      for (const fond of ["sombre", "ivoire"] as const) {
        const c = couleursDuFond(fond).degrade;
        const v4 = {
          backgroundColor: c.bord,
          backgroundImage:
            fond === "sombre"
              ? `radial-gradient(${l * 0.83}px ${h * 0.36}px at 50% 78%, ${c.centre} 0%, ${c.milieu} 45%, ${c.bord} 80%)`
              : `radial-gradient(${l * 0.93}px ${h * 0.47}px at 50% 45%, ${c.centre} 0%, ${c.milieu} 75%)`,
        };
        expect(styleDuFond(fond, l, h)).toEqual(v4);
        expect(styleDuFond(fond, l, h, { lueur: 0, fort: false })).toEqual(v4);
        expect(styleDuFond(fond, l, h, { lueur: LUEURS[fond].length })).toEqual(v4);
      }
    }
    expect(proprietesFond(undefined)).toEqual({});
    expect(proprietesFond({ entree: "glissement" })).toEqual({});
    // Le composant (emprunté par l'image → vidéo) : props facultatives, chemin v4 inchangé au caractère près.
    const source = readFileSync(join(process.cwd(), "studio-rendu/compositions/cas-concret/socle/Fond.tsx"), "utf8");
    expect(source).toContain("export function Fond({ fond, largeur, hauteur, lueur, fort }: { fond: NomFond; largeur: number; hauteur: number; lueur?: number; fort?: boolean })");
    expect(source).toContain("if (fort || indiceLueur(fond, lueur) !== 0) return");
    for (const ligne of [
      "  const c = couleursDuFond(fond).degrade;",
      "      ? `radial-gradient(${largeur * 0.83}px ${hauteur * 0.36}px at 50% 78%, ${c.centre} 0%, ${c.milieu} 45%, ${c.bord} 80%)`",
      "      : `radial-gradient(${largeur * 0.93}px ${hauteur * 0.47}px at 50% 45%, ${c.centre} 0%, ${c.milieu} 75%)`;",
      "  return <AbsoluteFill style={{ backgroundColor: c.bord, backgroundImage: image }} />;",
    ])
      expect(source).toContain(ligne);
  });
});

describe("L3c · fond : lueur et fond fort", () => {
  it("5 lueurs en sombre, 3 en ivoire, distinctes, indice pris modulo ; déterministes", () => {
    for (const fond of ["sombre", "ivoire"] as const) {
      const n = LUEURS[fond].length;
      expect(n).toBe(fond === "sombre" ? 5 : 3);
      const images = Array.from({ length: n }, (_, i) => styleDuFond(fond, 1080, 1920, { lueur: i }).backgroundImage);
      expect(new Set(images).size).toBe(n);
      for (let g = 1; g <= 5; g++) expect(styleDuFond(fond, 1080, 1920, { lueur: g })).toEqual(styleDuFond(fond, 1080, 1920, { lueur: g % n }));
      expect(indiceLueur(fond, -1)).toBe(n - 1);
    }
    expect(proprietesFond({ groupeParticules: 4 })).toEqual({ lueur: 4 });
    expect(proprietesFond({ groupeParticules: 4, fondFort: true })).toEqual({ lueur: 4, fort: true });
  });

  it("fond fort : dégradé terracotta plein de la maquette validée, couleurs de la charte, même rendu sur les deux fonds", () => {
    const s = styleDuFond("sombre", 1080, 1920, { fort: true, lueur: 3 });
    expect(s).toEqual(styleDuFond("ivoire", 1080, 1920, { fort: true }));
    expect(s.backgroundColor).toBe(COULEURS_DUO.orange);
    expect(s.backgroundImage).toBe(`radial-gradient(1000px 1100px at 50% 42%, ${COULEURS_DUO.orangeVif} 0%, ${COULEURS_DUO.orange} 62%, ${COULEURS_DUO.nuitLueur}ff 120%)`);
    const c = couleursFortes();
    expect([c.texte, c.accent, c.secondaire, c.marque]).toEqual([COULEURS_DUO.ivoireHaut, COULEURS_DUO.nuit, COULEURS_DUO.ivoire, COULEURS_DUO.blanc]);
    // Aucune lueur orange : transparente.
    expect(c.lueur.endsWith("00")).toBe(true);
    expect(couleursDeLEcran("sombre", undefined)).toEqual(couleursDuFond("sombre"));
    expect(couleursDeLEcran("ivoire", { fondFort: true })).toEqual(c);
  });

  it("types forts : couleurs du fond fort dans les plans (résultat, chiffre, titre, preuve), sans particules", () => {
    const fort = { fondFort: true } as const;
    const r = planResultat(avecJeu(exempleEcran("resultat") as Extract<ProprietesEcran, { type: "resultat" }>, fort), 50);
    expect(r.couleurs.texte).toBe(COULEURS_DUO.ivoireHaut);
    expect(r.etiquetteAvant?.couleur).toBe(COULEURS_DUO.ivoire);
    expect(r.etiquetteMaintenant?.couleur).toBe(COULEURS_DUO.nuit);
    expect(r.ligne.couleur).toBe(COULEURS_DUO.ivoire);
    // Barres lisibles : « avant » ivoire / encre ; « maintenant » nuit / ivoire haut.
    expect([r.avant.plan.barre.couleur, r.avant.plan.texte.couleur]).toEqual([COULEURS_DUO.ivoire, COULEURS_DUO.encre]);
    expect([r.maintenant.plan.barre.couleur, r.maintenant.plan.texte.couleur]).toEqual([COULEURS_DUO.nuit, COULEURS_DUO.ivoireHaut]);
    const sombre = (p: ProprietesEcran) => ({ ...p, fond: "sombre" as const });
    const c = planChiffre(avecJeu(sombre(exempleEcran("chiffre")) as Extract<ProprietesEcran, { type: "chiffre" }>, fort), 30);
    expect(c.couleurs.accent).toBe(COULEURS_DUO.nuit);
    expect(c.particules).toEqual([]);
    expect(planChiffre(sombre(exempleEcran("chiffre")) as Extract<ProprietesEcran, { type: "chiffre" }>, 30).particules).toHaveLength(NB_PARTICULES);
    const t = planTitre(avecJeu(sombre(exempleEcran("titre")) as Extract<ProprietesEcran, { type: "titre" }>, fort), 30);
    expect(t.particules).toEqual([]);
    expect(t.couleurs.marque).toBe(COULEURS_DUO.blanc);
    expect(planPreuve(avecJeu(exempleEcran("preuve") as Extract<ProprietesEcran, { type: "preuve" }>, fort), 30).couleurs.accent).toBe(COULEURS_DUO.nuit);
  });
});

describe("L3c · particules (6 groupes, 3 densités)", () => {
  const titre = { ...exempleEcran("titre"), fond: "sombre" as const } as Extract<ProprietesEcran, { type: "titre" }>;

  it("groupe 0 = la v4 (titre : groupe codé 6 ; chiffre : 0), densité v4 = 16", () => {
    expect(reglageParticules(undefined, 6)).toEqual({ groupe: 6, nombre: 16 });
    expect(reglageParticules(undefined, 0)).toEqual({ groupe: 0, nombre: 16 });
    expect(reglageParticules({ densiteParticules: "legere" }, 6)).toEqual({ groupe: 6, nombre: 10 });
    expect(reglageParticules({ densiteParticules: "dense", groupeParticules: 2 }, 6).nombre).toBe(24);
  });

  it("6 groupes de positions distincts, densités légère / dense ; déterministe", () => {
    const positions = [0, 1, 2, 3, 4, 5].map((g) => JSON.stringify(planTitre(g ? avecJeu(titre, { groupeParticules: g }) : titre, 20).particules.map((q) => [Math.round(q.x), Math.round(q.y)])));
    expect(new Set(positions).size).toBe(6);
    expect(planTitre(avecJeu(titre, { densiteParticules: "legere" }), 20).particules).toHaveLength(10);
    expect(planTitre(avecJeu(titre, { densiteParticules: "dense" }), 20).particules).toHaveLength(24);
    expect(planTitre(avecJeu(titre, { groupeParticules: 3, densiteParticules: "dense" }), 20)).toEqual(planTitre(avecJeu(titre, { groupeParticules: 3, densiteParticules: "dense" }), 20));
    // Fond ivoire : jamais de particules (v4).
    expect(planTitre(avecJeu({ ...titre, fond: "ivoire" }, { groupeParticules: 3, densiteParticules: "dense" }), 20).particules).toEqual([]);
  });
});

describe("L3c · barres proportionnelles aux nombres écrits", () => {
  it("lecture d'un nombre de barre (pure)", () => {
    expect(lireNombreBarre("1 article, à la main")).toEqual({ valeur: 1, sorte: "simple" });
    expect(lireNombreBarre("jusqu'à 200 par jour")).toEqual({ valeur: 200, sorte: "simple" });
    expect(lireNombreBarre("2 000 visiteurs")).toEqual({ valeur: 2000, sorte: "simple" });
    expect(lireNombreBarre("2 000")).toEqual({ valeur: 2000, sorte: "simple" });
    expect(lireNombreBarre("1,5 jour")).toEqual({ valeur: 1.5 * 24 * 60, sorte: "duree" });
    expect(lireNombreBarre("3 h")).toEqual({ valeur: 180, sorte: "duree" });
    expect(lireNombreBarre("+1 H")).toEqual({ valeur: 60, sorte: "duree" });
    expect(lireNombreBarre("10 min")).toEqual({ valeur: 10, sorte: "duree" });
    expect(lireNombreBarre("15 MIN")).toEqual({ valeur: 15, sorte: "duree" });
    expect(lireNombreBarre("1 h 30")).toEqual({ valeur: 90, sorte: "duree" });
    expect(lireNombreBarre("1h30")).toEqual({ valeur: 90, sorte: "duree" });
    expect(lireNombreBarre("30 s")).toEqual({ valeur: 0.5, sorte: "duree" });
    expect(lireNombreBarre("100 %")).toEqual({ valeur: 100, sorte: "pourcent" });
    expect(lireNombreBarre("10 sites")).toEqual({ valeur: 10, sorte: "simple" });
    // Rien, plusieurs nombres, écriture ambiguë : null.
    for (const t of ["À la main", "2 à 3 h", "entre 10 et 20", "1.5", "24/7", "3 h et 10 min"]) expect(lireNombreBarre(t), t).toBeNull();
  });

  it("parts : la plus grande pleine, plancher 3 % ; sortes différentes ou nombre manquant → null (v4)", () => {
    expect(partsBarres("1 article, à la main", "jusqu'à 200 par jour")).toEqual({ avant: 0.03, maintenant: 1 });
    expect(partsBarres("+1 H", "15 MIN")).toEqual({ avant: 1, maintenant: 0.25 });
    expect(partsBarres("3 h", "10 min")).toEqual({ avant: 1, maintenant: 10 / 180 });
    expect(partsBarres("2 jours", "3 h")).toEqual({ avant: 1, maintenant: 180 / 2880 });
    expect(partsBarres("3 h", "200 articles")).toBeNull();
    expect(partsBarres("50 %", "3 h")).toBeNull();
    expect(partsBarres("Tout à la main", "200")).toBeNull();
    expect(partsBarres("0", "0")).toBeNull();
  });

  it("le plan du résultat : longueurs proportionnelles, textes de la fiche inchangés, barres dans leur boîte, déterministe", () => {
    const jeu = { barres: "proportionnelles" } as const;
    const p = resultat("1 article, à la main", "jusqu'à 200 par jour", jeu);
    for (const i of IMAGES) {
      const r = planResultat(p, i);
      expect(r.avant.plan.largeurFinale / r.avant.boite.largeur).toBeCloseTo(0.03, 9);
      expect(r.maintenant.plan.largeurFinale / r.maintenant.boite.largeur).toBeCloseTo(1, 9);
      expect(r.avant.plan.texte.texte).toBe(enCapitales("1 article, à la main"));
      expect(r.maintenant.plan.texte.texte).toBe(enCapitales("jusqu'à 200 par jour"));
      expect(r.avant.plan.barre.boite.largeur).toBeLessThanOrEqual(r.avant.boite.largeur);
      expect(r.maintenant.plan.barre.boite.largeur).toBeLessThanOrEqual(r.maintenant.boite.largeur + 1e-9);
      expect(planResultat(p, i)).toEqual(r);
    }
    // La barre de 3 % porte son texte JUSTE APRÈS elle, lisible (grand, et qui tient).
    const fin = planResultat(p, 74);
    const tx = fin.avant.plan.texte as typeof fin.avant.plan.texte & { dehors?: true };
    expect(tx.dehors).toBe(true);
    expect(tx.boite.x).toBeGreaterThan(fin.avant.plan.largeurFinale);
    expect(tx.tient).toBe(true);
    expect(fin.avant.tient && fin.maintenant.tient).toBe(true);
    // Sans jeu : 900 / 520 de la v4.
    const v4 = planResultat(resultat("1 article, à la main", "jusqu'à 200 par jour"), 74);
    expect(v4.maintenant.plan.largeurFinale / v4.maintenant.boite.largeur).toBeCloseTo(PART_MAINTENANT, 9);
    expect(v4.avant.plan.largeurFinale).toBe(v4.avant.boite.largeur);
  });

  it("l'objet barre sans part : la v4 ; avec part : bornée à sa boîte", () => {
    const base = { boite: { x: 0, y: 0, largeur: 900, hauteur: 190 }, t: 0, tVideo: 0, fond: "ivoire" as const, textes: ["15 MIN"], variante: "maintenant" as const };
    expect(planBarresAvantApres(base, 30).largeurFinale).toBeCloseTo(520, 9);
    for (let i = 0; i < 75; i++) expect(planBarresAvantApres({ ...base, part: 1 }, i).barre.boite.largeur).toBeLessThanOrEqual(900);
  });
});
