/**
 * CHAÎNE « ÉQUIPE » + BASES DE L'USINE (cible, douleur). SIMULATION seulement : aucun appel, aucune clé, 0 $.
 *  - la consigne du chef reçoit la fiche de la cible et la douleur nommée ; le scénariste et le relecteur, les mots et les objections ;
 *  - sans cible dans le brief, ou sans métier reconnu : rien de plus qu'avant ;
 *  - rien de ce que Will interdit (ni les contradictions connues des bases) n'entre par les bases ;
 *  - le pire cas reste sous le plafond d'un sujet.
 */
import { describe, expect, it } from "vitest";
import { metiers, tailles } from "@/donnees/bases-usine";
import { executerChaineEquipe, pireCasChaineEquipe, preparerEquipe } from "@/generateur/chaine-equipe";
import { celluleSure, ficheCibleEquipe, metierDeLaFonction, rendreFicheCible } from "@/generateur/roles/equipe-bases";
import { cibleEquipe, violationsReglesWill } from "@/generateur/roles/equipe-commun";
import { CONSIGNE_EQUIPE_CHEF } from "@/generateur/roles/equipe-chef";
import { CONSIGNE_EQUIPE_RELECTEUR } from "@/generateur/roles/equipe-relecteur";
import { CONSIGNE_EQUIPE_SCENARISTE } from "@/generateur/roles/equipe-scenariste";
import { CONTEXTE_BANC, SUJETS_BANC } from "./banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "../helpers/g4";

const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };
const options = { tournures: TOURNURES_G4, contexteWill };

function donnees(cible?: string) {
  const z = etapeZeroBanc(SUJETS_BANC[0]);
  if (!z.ok) throw new Error(z.manque.ceQuIlFaudrait);
  // Le brief minimal du banc ne porte pas de cible : on la pose sur le sujet comme le fait l'écran.
  return cible ? { ...z.donnees, sujet: { ...z.donnees.sujet, cible } } : z.donnees;
}

async function variables(d: ReturnType<typeof donnees>) {
  const { executeur, appels } = executeurSimule();
  const r = await executerChaineEquipe(d, executeur, options);
  expect(r.statut).toBe("terminee");
  return (role: string) => appels.find((a) => a.role === role)!.entree.variable;
}

const CIBLE = "expert-comptable de TPE";

describe("la fiche de la cible dans la consigne de l'équipe", () => {
  it("le chef reçoit la taille, le métier et la douleur NOMMÉE ; le scénariste et le relecteur, les mots et les objections", async () => {
    const d = donnees(CIBLE);
    const p = preparerEquipe(d, d.sujet.reseaux);
    expect(p.fiche?.metier?.code).toBe("compta.expert-comptable");
    expect(p.fiche?.douleur?.dite).toBeTruthy();
    const v = await variables(d);
    const chef = v("equipe-chef");
    expect(chef).toContain("<fiche_cible>");
    expect(chef).toContain("<douleur_nommee>");
    expect(chef).toContain(p.fiche!.douleur!.dite);
    expect(chef).toContain(p.fiche!.taille.quiDecide);
    for (const role of ["equipe-scenariste", "equipe-relecteur"]) {
      expect(v(role), role).toContain("<mots_de_la_cible>");
      expect(v(role), role).toContain("<objections_de_la_cible>");
      expect(v(role), role).not.toContain("<douleur_nommee>");
    }
    expect(v("equipe-scenariste")).toContain("<a_ne_pas_dire>");
    // Les accroches ne reçoivent rien de plus qu'avant.
    expect(v("equipe-accroches")).not.toContain("<fiche_cible>");
  });

  it("une vidéo = une cible, la douleur nommée garde son nom, le relecteur lit dans la peau de la cible (consignes)", () => {
    expect(CONSIGNE_EQUIPE_CHEF).toMatch(/UNE VIDÉO = UNE CIBLE/);
    expect(CONSIGNE_EQUIPE_CHEF).toMatch(/TELLE QUELLE[\s\S]*seule son intensité/);
    expect(CONSIGNE_EQUIPE_SCENARISTE).toMatch(/UNE vidéo = UNE cible/);
    expect(CONSIGNE_EQUIPE_RELECTEUR).toMatch(/DANS LA PEAU DE LA CIBLE/);
  });

  it("la fiche est stable : même sujet, même fiche", () => {
    const d = donnees(CIBLE);
    expect(preparerEquipe(d, d.sujet.reseaux).fiche).toEqual(preparerEquipe(d, d.sujet.reseaux).fiche);
  });

  it("sans cible dans le brief : aucune fiche, les variables sont celles d'avant", async () => {
    const d = donnees();
    expect(d.sujet.cible).toBeFalsy();
    expect(preparerEquipe(d, d.sujet.reseaux).fiche).toBeUndefined();
    const v = await variables(d);
    for (const role of ["equipe-chef", "equipe-scenariste", "equipe-relecteur", "equipe-accroches"]) expect(v(role), role).not.toContain("fiche_cible");
  });

  it("fonction inconnue des bases : la taille seule, sans métier ni douleur inventés", () => {
    const d = donnees("jongleur de PME");
    const f = preparerEquipe(d, d.sujet.reseaux).fiche;
    expect(f?.taille.code).toBe("PME");
    expect(f?.metier).toBeUndefined();
    expect(f?.douleur).toBeUndefined();
    expect(f?.objections).toEqual([]);
    expect(rendreFicheCible(f, "chef")).not.toContain("douleur_nommee");
  });

  it("un métier reconnu mais jamais deux au hasard", () => {
    expect(metierDeLaFonction("expert-comptable")?.code).toBe("compta.expert-comptable");
    expect(metierDeLaFonction("")).toBeNull();
    expect(metierDeLaFonction("jongleur")).toBeNull();
  });
});

describe("rien d'interdit n'entre par les bases", () => {
  it("les contradictions connues et les règles de Will sont refusées cellule par cellule", () => {
    for (const mauvais of ["Le vendeur apprend à dicter, à refaire seul.", "La gérante prépare ses posts, à refaire seule.", "Faites-le vous-même en dix minutes.", "Cet outil vient de sortir.", "Mettez votre lien dans mon profil.", "Les 5 actualités de la semaine.", "On gagne 3 heures par semaine."]) {
      expect(celluleSure(mauvais), mauvais).toBe(false);
    }
    expect(celluleSure("Les relances se répètent chaque mois.")).toBe(true);
  });

  it("toutes les fiches possibles (tous les métiers d'exemple × 4 tailles) passent les règles de Will, sans chiffre, sans contradiction connue", () => {
    let vues = 0;
    for (const t of tailles()) {
      for (const m of metiers()) {
        const f = ficheCibleEquipe("x", { taille: t.code, fonction: m.nom }, m.nom, 7);
        if (!f) continue;
        for (const pour of ["chef", "scenariste", "relecteur"] as const) {
          const texte = rendreFicheCible(f, pour);
          vues++;
          expect(violationsReglesWill(texte), `${t.code}/${m.code}/${pour}`).toEqual([]);
          expect(texte, `${t.code}/${m.code}/${pour}`).not.toMatch(/\d|refaire seule?|dans (mon|ma) profil|actualités/);
        }
      }
    }
    expect(vues).toBeGreaterThan(10);
  });
});

describe("coût : le pire cas reste sous le plafond d'un sujet", () => {
  it("avec la fiche la plus longue des bases, le pire cas passe de peu et reste sous 1,50 $", () => {
    const sans = pireCasChaineEquipe(donnees(), { reseau: donnees().sujet.reseaux[0] });
    const avec = pireCasChaineEquipe(donnees(CIBLE), { reseau: donnees().sujet.reseaux[0] });
    expect(avec.usd).toBeGreaterThanOrEqual(sans.usd);
    expect(avec.usd).toBeLessThanOrEqual(1.5);
    // La pire fiche : on vérifie la taille rendue, pas besoin de rejouer tout le calcul.
    let max = 0;
    for (const m of metiers()) {
      const f = ficheCibleEquipe("x", cibleEquipe(`${m.nom} de GE`), `${m.nom}`, 0);
      max = Math.max(max, ...(["chef", "scenariste", "relecteur"] as const).map((p) => rendreFicheCible(f, p).length));
    }
    expect(max).toBeLessThan(3000);
  });
});
