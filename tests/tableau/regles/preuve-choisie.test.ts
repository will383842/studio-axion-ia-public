/**
 * FIX-TABLEAU-PREUVE-CHOISIE (18/11, brouillon v-64a273d3580c) : aucune preuve n'est imposée ; une preuve n'écrit que ce
 * que le texte dit (règle de Williams du 17/11).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { valider } from "./outils"; // charge `fiche` avant le reste (ordre des imports du moteur)
import { contexteExemple, copie } from "./exemples";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { ligneDePreuveReprise, reglePreuveValidee } from "../../../src/moteurs/montage-tableau/regles";
import { CONSIGNE_DECOUPAGE } from "../../../src/moteurs/montage-tableau/decoupage";

const DOSSIER = join(__dirname, "..", "temoins");
const lire = (nom: string): FicheTableau => {
  const j = JSON.parse(readFileSync(join(DOSSIER, nom), "utf8")) as FicheTableau | { fiche: FicheTableau };
  return "fiche" in j ? j.fiche : j; // une trace de fabrication enveloppe la fiche
};
const TEMOIN = lire("fiche-temoin-v-667edcd8e3a8-reference-3.json");
const LIGNE_MIT = "Étude du MIT (projet NANDA) : aucun retour mesurable pour la plupart";

const manquementsPreuve = (f: FicheTableau) => reglePreuveValidee(f, contexteExemple(f, { preuves: [{ id: "preuve-compte-rendu", statut: "validee", perimeLe: "2027-01-09" }] })).map((m) => m.detail);

describe("preuve choisie", () => {
  it("(a) le témoin sans aucune preuve n'a plus de manquement de la règle 9", () => {
    const f = copie(TEMOIN);
    expect(f.scenes.some((s) => s.elements.some((e) => e.type === "preuve"))).toBe(false);
    expect(manquementsPreuve(f)).toEqual([]);
    const r = valider(f);
    const regle9 = r.ok ? [] : r.problemes.filter((p) => p.message.includes("preuve validée à l'écran"));
    expect(regle9).toEqual([]);
  });

  it("(b) une ligne de preuve que le texte dit ne dit pas est refusée, en citant la ligne", () => {
    const f = copie(TEMOIN);
    const s = f.scenes[1];
    s.role = "preuve";
    s.elements.push({ id: "ePreuveMit", type: "preuve", preuveId: "preuve-compte-rendu", lignes: [LIGNE_MIT], ancre: 0 } as never);
    const m = manquementsPreuve(f);
    expect(m.length).toBe(1);
    expect(m[0]).toContain(LIGNE_MIT);
  });

  it("(b2) même refus pour le texte de l'utilisateur (texteDeWill: true)", () => {
    const f = copie(TEMOIN);
    const s = f.scenes[1];
    s.role = "preuve";
    s.elements.push({ id: "ePreuveMit", type: "preuve", preuveId: "preuve-compte-rendu", lignes: [LIGNE_MIT], ancre: 0 } as never);
    const ctx = contexteExemple(f, { preuves: [{ id: "preuve-compte-rendu", statut: "validee", perimeLe: "2027-01-09" }] });
    const m = reglePreuveValidee(f, { ...ctx, texteDeWill: true }).map((x) => x.detail);
    expect(m.length).toBe(1);
    expect(m[0]).toContain(LIGNE_MIT);
  });

  it("(c) les témoins reference/3 qui ont une preuve : aucun manquement de ligne de preuve", () => {
    const noms = [
      "fiche-formation-v3-reference-3.json",
      "fiche-gabarit-cadre-reference-3.json",
      "fiche-gabarit-cadre-visuels-reference-3.json",
      "fiche-temoin-v-6616b3800357-reference-3.json",
      "fiche-temoin-v-f1739d6a4f51-reference-3.json",
      "fiche-temoin-v-fc3ac0c1d171-reference-3.json",
      "fabrication-arretee-ecriture-a-l-heure-2026-10-15.json",
    ];
    for (const nom of noms) {
      const f = lire(nom);
      // une preuve validée non périmée pour chaque preuveId du témoin : le contrôle des lignes s'exécute vraiment
      const ids = [...new Set(f.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "preuve" ? [e.preuveId] : []))))];
      expect(ids.length).toBeGreaterThan(0);
      const ctx = contexteExemple(f, { preuves: ids.map((id) => ({ id, statut: "validee", perimeLe: "2027-01-09" })) as never });
      const m = reglePreuveValidee(f, { ...ctx, texteDeWill: false }).filter((x) => x.detail.includes("que le texte dit ne dit pas"));
      expect({ nom, m }).toEqual({ nom, m: [] });
    }
  });

  it("(d) ligneDePreuveReprise", () => {
    expect(ligneDePreuveReprise("Après : la relance part seule", "la relance part seule pendant son chantier")).toBe(true);
    expect(ligneDePreuveReprise("Le MIT le prouve", "Un étude sans le sigle.")).toBe(false);
    expect(ligneDePreuveReprise("10 minutes plus tard", "dix minutes plus tard")).toBe(true);
    expect(ligneDePreuveReprise("Avant : 12", "rien")).toBe(true);
  });

  it("(e) la consigne n'impose plus de scène « preuve »", () => {
    expect(CONSIGNE_DECOUPAGE).not.toContain("Au moins une scène de rôle « preuve »");
    expect(CONSIGNE_DECOUPAGE).toContain("seulement si le texte dit cite cette preuve");
  });
});
