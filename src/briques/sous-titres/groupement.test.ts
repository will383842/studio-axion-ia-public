import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { horodaterTexte, motsSousTitres } from "@/domaine/derivations";
import { grouperMots, grouperUnites, recalerSurCoupes, sansChevauchement, unitesDe } from "./groupement";
import { largeurLibrePct, largeurLibrePx, positionsVerticales } from "./largeur";
import { largeurLigne, largeurMot, tailleQuiTient } from "./mesure";
import { GABARITS } from "./style";
import { estMotOutil } from "./typographie";
import { optionsGroupement } from "./index";

const TEXTE =
  "Votre employeur vous doit 67 000 € de rappel de salaire. Il a gagné 35 heures par semaine pendant deux ans, sans le dire à personne. " +
  "Le juge a tranché : la somme de 2 500 € est due pour chaque mois de retard, et le salarié peut demander le reste de la prime de fin d'année.";

/** Mots du texte VALIDÉ (ponctuation collée, comme à l'écran), au débit de la voix. */
const motsDe = (texte: string, debit = 4.4): MotHorodate[] => {
  const t = horodaterTexte(motsSousTitres(texte).map((m) => m.replace(/[  ]/g, "")).join(" "), debit);
  const affiches = motsSousTitres(texte);
  return affiches.map((mot, i) => ({ ...t[i], mot }));
};
const texteGroupe = (mots: MotHorodate[]) => mots.map((m) => m.mot).join(" ");
const options = optionsGroupement({ base: "karaoke", reseaux: ["tiktok", "instagram"] });

describe("groupement des sous-titres (B.5)", () => {
  const segments = grouperMots(motsDe(TEXTE), options);

  it("« 67 000 € » et « 2 500 € » restent groupés (nombres et montants insécables)", () => {
    const textes = segments.map((s) => texteGroupe(s.mots));
    expect(textes.some((t) => t.includes("67 000 €"))).toBe(true);
    expect(textes.some((t) => t.includes("2 500 €"))).toBe(true);
    expect(unitesDe(motsDe("il touche 67 000 € net"))[2].mots.map((m) => m.mot)).toEqual(["67", "000", "€"]);
  });

  it("jamais de mot outil (« de », « le »…) seul en fin de groupe", () => {
    for (const s of segments.slice(0, -1)) expect(estMotOutil(s.mots[s.mots.length - 1].mot), texteGroupe(s.mots)).toBe(false);
    const piege = grouperMots(motsDe("le reste de la prime de fin de contrat de travail de votre salarié de la société"), options);
    for (const s of piege.slice(0, -1)) {
      const dernier = s.mots[s.mots.length - 1].mot;
      expect(["de", "le", "la"]).not.toContain(dernier);
    }
  });

  it("2 à 4 mots (unités insécables) par ligne ; un mot seul seulement pour un mot en valeur ou un montant", () => {
    const unites = grouperUnites(motsDe(TEXTE), options);
    for (const g of unites) {
      expect(g.length).toBeLessThanOrEqual(4);
      if (g.length === 1) expect(g[0].valeur || g[0].montant).toBe(true);
    }
  });

  it("un mot en valeur peut rester seul ; un mot ordinaire seulement s'il forme une phrase à lui seul (« Non. »)", () => {
    const mots = motsDe("Non. Le juge a dit oui.");
    const seuls = grouperUnites(mots, options).filter((g) => g.length === 1);
    for (const g of seuls) expect(g[0].valeur || g[0].montant || g[0].finPhrase).toBe(true);
    // Jamais deux phrases sur la même ligne.
    for (const g of grouperUnites(mots, options)) expect(g.slice(0, -1).some((u) => u.finPhrase)).toBe(false);
    const enValeur = mots.map((m, i) => (i === 0 ? { ...m, enValeur: true } : m));
    expect(grouperUnites(enValeur, options)[0].map((u) => u.mots[0].mot)).toEqual(["Non."]);
  });

  it("affichage de 0,4 à 0,9 s à 4,4 mots/s (cible 0,6 s) ; un groupe de moins de 200 ms est fusionné", () => {
    const durees = segments.map((s) => s.finSec - s.debutSec);
    for (const d of durees) expect(d).toBeGreaterThanOrEqual(0.2);
    const dansLaPlage = durees.filter((d) => d >= 0.4 - 1e-6 && d <= 0.9 + 0.25).length;
    expect(dansLaPlage / durees.length).toBeGreaterThan(0.85);
    const moyenne = durees.reduce((a, b) => a + b, 0) / durees.length;
    expect(moyenne).toBeGreaterThan(0.45);
    expect(moyenne).toBeLessThan(0.95);
  });

  it("un groupe de moins de 200 ms est fusionné avec le suivant", () => {
    const mots: MotHorodate[] = [
      { mot: "Bonjour", debutSec: 0, finSec: 0.12 },
      { mot: "à", debutSec: 0.13, finSec: 0.18 },
      { mot: "tous", debutSec: 0.19, finSec: 0.4 },
      { mot: "les", debutSec: 0.41, finSec: 0.5 },
      { mot: "salariés.", debutSec: 0.51, finSec: 0.9 },
    ];
    const s = grouperMots(mots, options);
    for (const x of s) expect(x.finSec - x.debutSec).toBeGreaterThanOrEqual(0.2);
  });

  it("rien pendant un blanc", () => {
    const mots: MotHorodate[] = [
      { mot: "Il", debutSec: 0, finSec: 0.2 },
      { mot: "a", debutSec: 0.22, finSec: 0.3 },
      { mot: "raison.", debutSec: 0.32, finSec: 0.7 },
      { mot: "Mais", debutSec: 1.9, finSec: 2.1 },
      { mot: "attention", debutSec: 2.12, finSec: 2.5 },
      { mot: "ici.", debutSec: 2.52, finSec: 2.8 },
    ];
    const s = grouperMots(mots, options);
    const auMilieuDuBlanc = s.filter((x) => x.debutSec <= 1.3 && x.finSec > 1.3);
    expect(auMilieuDuBlanc).toHaveLength(0);
    expect(s[1].debutSec).toBeCloseTo(1.9);
  });

  it("calage sur les coupes : une limite à moins de 0,2 s d'une coupe est recalée ; au-delà, rien ne bouge", () => {
    const base = grouperMots(motsDe(TEXTE), options);
    const limite = base[3].debutSec;
    const recale = recalerSurCoupes(base, [limite + 0.15], { dureeMinSec: 0.4 });
    const i = recale.findIndex((s) => s.id === base[3].id);
    if (base[3].finSec - (limite + 0.15) >= 0.4 && limite + 0.15 - base[2].debutSec >= 0.4) {
      expect(recale[i].debutSec).toBeCloseTo(limite + 0.15, 3);
      expect(recale[i - 1].finSec).toBeCloseTo(limite + 0.15, 3);
    }
    const intact = recalerSurCoupes(base, [limite + 0.45], { dureeMinSec: 0.4 });
    expect(intact[3].debutSec).toBe(base[3].debutSec);
  });

  it("calage sur les coupes : exemple chiffré (coupe à 1,13 s, limite à 1,0 s)", () => {
    const seg = [
      { id: "a", debutSec: 0, finSec: 1.0, mots: [{ mot: "un", debutSec: 0, finSec: 0.4 }] },
      { id: "b", debutSec: 1.0, finSec: 1.8, mots: [{ mot: "deux", debutSec: 1.0, finSec: 1.4 }] },
    ];
    const r = recalerSurCoupes(seg, [1.13]);
    expect(r[0].finSec).toBeCloseTo(1.13);
    expect(r[1].debutSec).toBeCloseTo(1.13);
    // Le groupe suivant deviendrait trop court (< 0,4 s) : pas de recalage.
    const court = recalerSurCoupes([seg[0], { ...seg[1], finSec: 1.45 }], [1.13]);
    expect(court[1].debutSec).toBe(1.0);
  });

  it("aucun chevauchement de minutage après correction", () => {
    const s = sansChevauchement([
      { id: "a", debutSec: 0, finSec: 1.2, mots: [] },
      { id: "b", debutSec: 1.0, finSec: 2, mots: [] },
    ]);
    expect(s[0].finSec).toBe(1.0);
  });
});

describe("largeur depuis les zones protégées (B.5)", () => {
  it("TikTok + Instagram : 64 % ≈ 691 px sur 1080", () => {
    expect(largeurLibrePct("9:16", ["tiktok", "instagram"])).toBe(64);
    expect(largeurLibrePx("9:16", ["tiktok", "instagram"])).toBe(691);
  });

  it("positions haut / bas à l'intérieur des zones protégées ; milieu à 48 %", () => {
    const p = positionsVerticales("9:16", ["tiktok", "instagram"]);
    expect(p.milieuPct).toBe(48);
    expect(p.hautPct).toBeGreaterThan(14);
    expect(p.basPct).toBeLessThan(70);
  });

  it("mesure réelle : chasse lue dans la police (écart < 3 % avec le rendu de Pillow)", () => {
    // Références mesurées avec Pillow sur les mêmes fichiers de police (outils/captures-sous-titres).
    const somme = (mots: string[], police: Parameters<typeof largeurMot>[1], t: number) => mots.reduce((s, m) => s + largeurMot(m, police, t), 0);
    expect(Math.abs(somme(["Lors", "d'un", "contrôle"], "Poppins ExtraBold", 70) - 620) / 620).toBeLessThan(0.03);
    expect(Math.abs(somme(["67", "000", "€"], "Montserrat Black", 126) - 529) / 529).toBeLessThan(0.03);
    expect(Math.abs(somme(["il", "a", "gagné", "35", "heures"], "Poppins Medium", 60) - 551) / 551).toBeLessThan(0.03);
  });

  it("aucun groupe ne dépasse la zone libre combinée (mesure réelle), même avec des mots longs", () => {
    const long = "Les dispositions anticonstitutionnellement interprétées ont été désapprouvées par l'administration départementale compétente.";
    for (const texte of [TEXTE, long]) {
      for (const s of grouperMots(motsDe(texte), options)) {
        const l = largeurLigne(
          s.mots.map((m) => m.mot),
          GABARITS.karaoke.police,
          GABARITS.karaoke.taillePx,
          { chiffresTabulaires: true },
        );
        // Un mot seul plus large que la zone est rendu plus petit (tailleQuiTient) ; sinon la ligne tient.
        if (s.mots.length > 1) expect(l).toBeLessThanOrEqual(691);
        else expect(tailleQuiTient([s.mots[0].mot], GABARITS.karaoke.police, 70, 691)).toBeLessThanOrEqual(70);
      }
    }
  });
});
