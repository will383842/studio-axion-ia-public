/**
 * Narration par phrases à trous (G4-05). DONNÉES ENTIÈREMENT FICTIVES : aucun chiffre réel.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { garderChiffres } from "../../../src/briques/donnees-video/garde-chiffres";
import { narrationModele } from "../../../src/briques/donnees-video/narration-modele";
import type { IndicateurTableau, TableauDeBord } from "../../../src/briques/donnees-video/types";

const ind = (id: string, libelle: string, valeur: number, unite = "€", precision = 0, sens: IndicateurTableau["sens"] = "hausse-bonne"): IndicateurTableau => ({ id, libelle, valeur, unite, precision, sens });

const base = (indicateurs: IndicateurTableau[], extra: Partial<TableauDeBord> = {}): TableauDeBord => ({
  version: "tableau-de-bord.v1",
  titre: "Tableau exemple",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "premier trimestre exemple" },
  source: "Outil exemple",
  indicateurs,
  series: [],
  comparaisons: [],
  alertes: [],
  calculs: [],
  ...extra,
});

const exemple = (): TableauDeBord =>
  base(
    [
      ind("ca-fevrier", "Chiffre d'affaires de février", 10200),
      ind("ca-mars", "Chiffre d'affaires de mars", 12480),
      ind("visites", "Visites du site", 3450, "visites"),
      ind("rebond", "Taux de rebond", 42, "%", 0, "baisse-bonne"),
      ind("clients", "Nouveaux clients", 87, "clients"),
    ],
    {
      comparaisons: [{ avant: "ca-fevrier", apres: "ca-mars" }],
      alertes: [{ texte: "Le taux de rebond reste à surveiller", indicateurId: "rebond" }],
      calculs: [{ id: "evolution", formule: "ca-mars / ca-fevrier * 100 - 100", resultat: (12480 / 10200) * 100 - 100 }],
    },
  );

const mots = (t: string) => t.split(/\s+/).filter(Boolean).length;

describe("narrationModele", () => {
  it("donnée exemple : entre 78 et 156 mots, garde des chiffres OK", () => {
    const d = exemple();
    const n = narrationModele(d);
    expect(mots(n.texte)).toBeGreaterThanOrEqual(78);
    expect(mots(n.texte)).toBeLessThanOrEqual(156);
    expect(n.dureeEstimeeSec).toBeGreaterThanOrEqual(30);
    expect(n.dureeEstimeeSec).toBeLessThanOrEqual(60);
    expect(n.texte).toBe(n.phrases.join(" "));
    expect(garderChiffres(d, { textesEcran: [], texteDit: n.texte }).ok).toBe(true);
  });

  it("comparaison 10 200 → 12 480 : « 22 % de plus »", () => {
    const n = narrationModele(exemple());
    expect(n.texte).toContain("passe de 10 200 euros à 12 480 euros, soit 22 pour cent de plus");
  });

  it("une baisse dit « de moins » quand le calcul est déclaré", () => {
    const d = base([ind("a", "Visites", 200, "visites"), ind("b", "Visites ensuite", 150, "visites")], {
      comparaisons: [{ avant: "a", apres: "b" }],
      calculs: [{ id: "baisse", formule: "100 - b / a * 100", resultat: 25 }],
    });
    expect(narrationModele(d).texte).toContain("soit 25 pour cent de moins");
  });

  it("comparaison sans calcul déclaré : dite sans pourcentage, garde OK sur la donnée reçue", () => {
    const d = base([ind("a", "Visites", 200, "visites"), ind("b", "Visites ensuite", 150, "visites")], { comparaisons: [{ avant: "a", apres: "b" }] });
    const n = narrationModele(d);
    expect(n.texte).toContain("passe de 200 visites à 150 visites");
    expect(n.texte).not.toContain("pour cent");
    expect(n.remarques.some((r) => r.includes("sans pourcentage"))).toBe(true);
    expect(garderChiffres(d, { textesEcran: [], texteDit: n.texte }).ok).toBe(true);
  });

  it("libellé de période daté : l'ouverture reste présente (sans la période)", () => {
    const d = base([ind("a", "Visites", 120, "visites")], { periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "premier trimestre 2026" } });
    const n = narrationModele(d);
    expect(n.phrases[0]).toBe("Voici le tableau de bord « Tableau exemple ».");
    expect(n.texte).not.toContain("2026");
    expect(garderChiffres(d, { textesEcran: [], texteDit: n.texte }).ok).toBe(true);
  });

  it("donnée minimale (1 indicateur) : remarque « donnée trop courte »", () => {
    const n = narrationModele(base([ind("a", "Visites", 120, "visites")]));
    expect(n.dureeEstimeeSec >= 30 || n.remarques.includes("donnée trop courte")).toBe(true);
    expect(n.remarques).toContain("donnée trop courte");
  });

  it("aucun nombre hors donnée sur 3 données différentes", () => {
    const d2 = base([ind("a", "Commandes", 1234.5, "commandes", 1), ind("b", "Panier moyen", 56, "€"), ind("c", "Retours", 7, "retours", 0, "baisse-bonne"), ind("d", "Avis", 4.8, "points", 1)], {
      comparaisons: [{ avant: "a", apres: "b" }],
    });
    const d3 = base(Array.from({ length: 12 }, (_, i) => ind(`i${i}`, `Mesure numéro ${["un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"][i]}`, 1000 + i * 37, "unités")), {
      comparaisons: [{ avant: "i0", apres: "i1" }, { avant: "i2", apres: "i3" }],
      alertes: [{ texte: "Une mesure baisse", indicateurId: "i4" }],
    });
    for (const d of [exemple(), d2, d3]) {
      const n = narrationModele(d);
      expect(n.texte.length).toBeGreaterThan(0);
      // Garde contre la donnée d'origine, sans aucun calcul ajouté par le test ni par le module.
      expect(garderChiffres(d, { textesEcran: [], texteDit: n.texte })).toMatchObject({ ok: true, horsDonnee: [] });
    }
  });

  it("grosse donnée : au plus 60 s, avec remarque sur ce qui est retiré", () => {
    const d = base(Array.from({ length: 12 }, (_, i) => ind(`i${i}`, `Indicateur de gestion détaillé numéro ${i}`, 100 + i, "unités")), {
      alertes: Array.from({ length: 6 }, () => ({ texte: "Un point demande une vérification attentive de l'équipe", indicateurId: "i0" })),
    });
    const n = narrationModele(d);
    expect(n.dureeEstimeeSec).toBeLessThanOrEqual(60);
    expect(n.remarques.some((r) => r.includes("retiré"))).toBe(true);
  });

  it("phrase au nombre inventé retirée avec remarque", () => {
    const d = base([ind("a", "Visites", 120, "visites"), ind("b", "Ventes", 30, "ventes"), ind("c", "Retours", 2, "retours")], {
      alertes: [{ texte: "Objectif de 77 clients", indicateurId: "a" }],
    });
    const n = narrationModele(d);
    expect(n.texte).not.toContain("77");
    expect(n.remarques.some((r) => r.includes("retirée"))).toBe(true);
  });

  it("ne modifie pas la donnée reçue", () => {
    const d = exemple();
    const copie = JSON.stringify(d);
    narrationModele(d);
    expect(JSON.stringify(d)).toBe(copie);
  });
});

describe("narration-modele : garde statique", () => {
  const racine = join(__dirname, "../../../src");
  const fichiers = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((nom) => {
      const p = join(dossier, nom);
      return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(nom) ? [p] : [];
    });

  it("rien dans src/ n'importe narration-modele", () => {
    const fautifs = fichiers(racine).filter((f) => !f.endsWith("narration-modele.ts") && /from\s+["'][^"']*narration-modele["']/.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("le module n'a ni « @/ », ni fournisseur, ni Claude", () => {
    const src = readFileSync(join(racine, "briques/donnees-video/narration-modele.ts"), "utf8");
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.filter((i) => i.startsWith("@/"))).toEqual([]);
    expect(imports.filter((i) => !i.startsWith("./") && !i.startsWith("../"))).toEqual([]);
    expect(imports.filter((i) => /anthropic|claude|fournisseur|openai|fetch/i.test(i))).toEqual([]);
    expect(/anthropic|openai|fetch\(/i.test(src)).toBe(false);
  });
});
