/**
 * v-6e4a06b9c718 (23/10/2026) : depuis la correction de l'ordre « Envoyé équipe concernée » avant l'alerte, la scène `dossiers`
 * peut n'avoir qu'UN dossier. Plafonné à 400 px, il ne remplissait que 68 % de la zone (< 70 %) : le contrôle « Mise en page »
 * refusait la vidéo. Le seuil de 70 % n'est PAS assoupli : le plafond de taille est relevé seulement quand il l'empêcherait.
 */
import { describe, expect, it } from "vitest";
import { planDossiers, ZONE_OBJETS_IV } from "@/briques/schema-motion/plan-objets";
import { REMPLISSAGE_MIN_IV, tauxRemplissage } from "@/briques/schema-motion/mise-en-page";

const dossiers = (...noms: string[]) => noms.map((nom, i) => ({ nom, t: i * 0.1 }));
const blocsA = (noms: string[]) => planDossiers({ dossiers: dossiers(...noms), debut: 0 }, 5).dossiers.map((d) => ({ x: d.cx - d.cote / 2, y: d.y, largeur: d.cote, hauteur: d.hauteur }));

describe("dossiers : le remplissage vertical exigé est atteint", () => {
  it("seuil toujours à 70 %", () => expect(REMPLISSAGE_MIN_IV).toBe(0.7));
  it("un dossier seul (« Envoyé équipe concernée ») remplit au moins 70 % de la zone", () => {
    expect(tauxRemplissage(blocsA(["Envoyé équipe concernée"]), ZONE_OBJETS_IV)).toBeGreaterThanOrEqual(REMPLISSAGE_MIN_IV);
  });
  it("deux dossiers aux noms courts remplissent au moins 70 %", () => {
    expect(tauxRemplissage(blocsA(["Devis", "Client"]), ZONE_OBJETS_IV)).toBeGreaterThanOrEqual(REMPLISSAGE_MIN_IV);
  });
  it("le dossier seul reste dans les marges latérales de la zone", () => {
    const [b] = blocsA(["Envoyé équipe concernée"]);
    expect(b.x).toBeGreaterThanOrEqual(ZONE_OBJETS_IV.x);
    expect(b.x + b.largeur).toBeLessThanOrEqual(ZONE_OBJETS_IV.x + ZONE_OBJETS_IV.largeur);
    expect(b.y + b.hauteur).toBeLessThanOrEqual(ZONE_OBJETS_IV.y + ZONE_OBJETS_IV.hauteur);
  });
  it("à 3 dossiers ou plus, la taille ne change pas (plafond de 400 px conservé)", () => {
    for (const d of planDossiers({ dossiers: dossiers("A", "B", "C", "D"), debut: 0 }, 5).dossiers) expect(d.cote).toBeLessThanOrEqual(400);
  });
});
