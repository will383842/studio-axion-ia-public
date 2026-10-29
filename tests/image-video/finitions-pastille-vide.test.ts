/**
 * Finitions 4:5 : la pastille de rang ne recouvre jamais le surtitre (étiquette) d'un écran « chiffres » — elle reste à
 * droite et c'est l'étiquette qui se réduit, sans jamais descendre sur le contenu —, et un écran de script collé (corps,
 * accroche, phrase-choc) n'a pas de texte plus long que le plafond de lisibilité (Q21). Le 9:16 est inchangé.
 */
import { describe, expect, it } from "vitest";
import { decalageRepereSurEtiquette, HAUT_REPERE, largeurRepereIV, PLANCHER_PX } from "@/briques/schema-motion/plan-objets";
import { REGLES_SCENE_IV } from "@/moteurs/montage-image-video/regles-scene";
import { ECRAN_CARACTERES_MAX, ECRAN_MOTS_MAX, ecransDuScript, ficheDuScriptColle } from "@/moteurs/montage-image-video/script-colle";
import { decalageRepere } from "../../studio-rendu/compositions/image-video/variete/decalage-repere";
import { carteFixe } from "./doubles-fabrication";

const HAUT = HAUT_REPERE * 1920 - 60;
const Y_ETIQUETTE = 96;

/** Boîtes en pixels, avec des valeurs écrites en dur (marge 72, espace de 24 px, 28 px de capitales) et non les formules du code. */
function boites(etiquette: string, total = 3) {
  const d = decalageRepereSurEtiquette({ etiquette, yEtiquette: Y_ETIQUETTE, hautRepere: HAUT, total });
  const l = largeurRepereIV(total);
  const x = (1080 - l) / 2 + d.dx;
  const largeurTexte = etiquette.length * 28;
  const droite = 72 + (d.largeurEtiquette === undefined ? largeurTexte : Math.min(largeurTexte, d.largeurEtiquette));
  return { d, repere: { x0: x, x1: x + l, y0: HAUT + d.dy, y1: HAUT + d.dy + PLANCHER_PX * 1.3 }, etiquette: { x0: 72, x1: droite, y0: Y_ETIQUETTE, y1: Y_ETIQUETTE + 28 * 1.15 } };
}
const seRecouvrent = (a: { x0: number; x1: number; y0: number; y1: number }, b: typeof a) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe("pastille de rang 4:5 et surtitre", () => {
  it("sans étiquette : aucun décalage", () => {
    expect(decalageRepereSurEtiquette({ yEtiquette: Y_ETIQUETTE, hautRepere: HAUT, total: 3 })).toEqual({ dx: 0, dy: 0 });
  });
  it("étiquette longue ou courte : jamais de recouvrement", () => {
    for (const e of ["TEMPS GAGNÉ", "COMBIEN ÇA COÛTE", "CE QUE VOUS PERDEZ CHAQUE SEMAINE", "A"]) {
      const b = boites(e);
      expect(seRecouvrent(b.repere, b.etiquette), e).toBe(false);
    }
  });
  it("étiquette courte : la pastille va à droite, étiquette entière ; longue : la pastille reste à droite et l'étiquette est réduite, jamais descendue sur le contenu", () => {
    const courte = boites("TEMPS GAGNÉ").d;
    expect(courte.dy).toBe(0);
    expect(courte.dx).toBeGreaterThan(0);
    expect(courte.largeurEtiquette).toBeUndefined();
    const longue = boites("CE QUE VOUS PERDEZ CHAQUE SEMAINE").d;
    expect(longue.dy).toBe(0);
    expect(longue.dx).toBeGreaterThan(0);
    expect(longue.largeurEtiquette).toBeGreaterThan(0);
    expect(longue.largeurEtiquette!).toBeLessThan("CE QUE VOUS PERDEZ CHAQUE SEMAINE".length * 28);
  });
  it("l'étiquette réduite laisse au moins 24 px avant la pastille", () => {
    const b = boites("CE QUE VOUS PERDEZ CHAQUE SEMAINE");
    expect(b.repere.x0 - b.etiquette.x1).toBeGreaterThanOrEqual(24);
  });
  it("la pastille reste dans le cadre (marges de 72 px)", () => {
    const b = boites("TEMPS GAGNÉ").repere;
    expect(b.x1).toBeLessThanOrEqual(1080 - 72 + 0.5);
    expect(b.x0).toBeGreaterThanOrEqual(0);
  });
});

describe("écrans d'un script collé : seuils cohérents", () => {
  it("les mots plafonnent au plafond de signes de la lisibilité", () => {
    expect(ECRAN_CARACTERES_MAX).toBe(REGLES_SCENE_IV.signesMax);
    expect(ECRAN_MOTS_MAX).toBeLessThanOrEqual(Math.ceil(REGLES_SCENE_IV.signesMax / 5.5));
  });
  const mots = (t: string) => t.split(/\s+/).filter(Boolean);
  const LONGUE = "Les responsables administratifs consacrent régulièrement plusieurs heures hebdomadaires à ressaisir manuellement des informations comptables."; // 14 mots, plus de 70 signes
  it("la phrase d'essai est bien longue : 13 à 16 mots, plus de 70 signes", () => {
    expect(mots(LONGUE).length).toBeGreaterThanOrEqual(13);
    expect(mots(LONGUE).length).toBeLessThanOrEqual(16);
    expect(LONGUE.length).toBeGreaterThan(REGLES_SCENE_IV.signesMax);
  });
  const script = ["Bonjour tout le monde.", LONGUE, "Un.", "Deux.", "Trois.", "Quatre. Voilà."].join(" ");
  it("une phrase de 14 mots longs est coupée sous 70 signes (corps, accroche et phrase-choc), sans changer un mot", () => {
    const ecrans = ecransDuScript(script).map((m) => m.join(" "));
    // Le corps contient la phrase longue (coupée) : elle n'est pas dans le premier ni le dernier écran.
    expect(ecrans.filter((e) => LONGUE.includes(e) && e !== LONGUE).length).toBeGreaterThanOrEqual(2);
    for (const e of ecrans) expect(e.length, e).toBeLessThanOrEqual(REGLES_SCENE_IV.signesMax);
    expect(ecrans.join(" ").split(/\s+/)).toEqual(script.split(/\s+/));
  });
  it("accroche et phrase-choc de plus de 70 signes (même sous 8 mots) sont bornées en signes, mots inchangés", () => {
    const accroche = "Responsabilités administratives hebdomadaires incompressibles quotidiennement malheureusement envahissantes."; // 7 mots, plus de 70 signes
    const choc = "Automatisation intelligente immédiatement rentable contractuellement garantie opérationnellement."; // 6 mots, plus de 70 signes
    expect(accroche.length).toBeGreaterThan(70);
    expect(choc.length).toBeGreaterThan(70);
    const long = [accroche, "Un.", "Deux.", "Trois.", "Quatre.", "Cinq.", choc].join(" ");
    const ecrans = ecransDuScript(long).map((m) => m.join(" "));
    for (const e of ecrans) expect(e.length, e).toBeLessThanOrEqual(REGLES_SCENE_IV.signesMax);
    expect(ecrans.join(" ").split(/\s+/)).toEqual(long.split(/\s+/));
  });
  it("la fiche : tout texte affiché (écrans, accroches) tient dans le plafond, les mots dits restent ceux du script", () => {
    const fiche = ficheDuScriptColle(script, carteFixe("C"));
    for (const e of fiche.ecrans) for (const t of e.textesEcran) expect(t.length, t).toBeLessThanOrEqual(REGLES_SCENE_IV.signesMax);
    for (const a of fiche.accroches) for (const t of a.textesEcran) expect(t.length, t).toBeLessThanOrEqual(REGLES_SCENE_IV.signesMax);
    expect(fiche.ecrans.map((e) => e.texteDit).join(" ").split(/\s+/)).toEqual(script.split(/\s+/));
  });
  it("la fusion au-delà de soixante écrans ne recrée pas d'écran de plus de 70 signes quand une paire courte existe", () => {
    const court = Array.from({ length: 70 }, (_, i) => (i % 2 ? "Oui." : "Voilà bien.")).join(" ");
    const ecrans = ecransDuScript(court).map((m) => m.join(" "));
    expect(ecrans.length).toBeLessThanOrEqual(60);
    for (const e of ecrans) expect(e.length, e).toBeLessThanOrEqual(REGLES_SCENE_IV.signesMax);
    expect(ecrans.join(" ").split(/\s+/)).toEqual(court.split(/\s+/));
  });
});

describe("decalageRepere (composition de variété)", () => {
  const bloc = (axe: string, code: string, etiquette?: string) => ({ axe, code, donnees: etiquette === undefined ? {} : { etiquette } }) as never;
  const repere = { changements: [], total: 3 };
  const LONGUE_ETIQ = "CE QUE VOUS PERDEZ CHAQUE SEMAINE";
  it("9:16 : zéro", () => {
    expect(decalageRepere({ bloc: bloc("chiffres", "CHI-B", LONGUE_ETIQ), hauteur: 1920, repere })).toEqual({ dx: 0, dy: 0 });
  });
  it("CHI-D (le géant n'a pas d'étiquette) : zéro", () => {
    expect(decalageRepere({ bloc: bloc("chiffres", "CHI-D", LONGUE_ETIQ), hauteur: 1350, repere })).toEqual({ dx: 0, dy: 0 });
  });
  it("sans repère : zéro", () => {
    expect(decalageRepere({ bloc: bloc("chiffres", "CHI-B", LONGUE_ETIQ), hauteur: 1350, repere: null })).toEqual({ dx: 0, dy: 0 });
  });
  it("un autre axe que « chiffres » : zéro", () => {
    expect(decalageRepere({ bloc: bloc("texte", "TXT-A", LONGUE_ETIQ), hauteur: 1350, repere })).toEqual({ dx: 0, dy: 0 });
  });
  it("sans étiquette : zéro", () => {
    expect(decalageRepere({ bloc: bloc("chiffres", "CHI-B"), hauteur: 1350, repere })).toEqual({ dx: 0, dy: 0 });
  });
  it("4:5, étiquette longue : la pastille va à droite, l'étiquette est réduite, rien ne descend", () => {
    const d = decalageRepere({ bloc: bloc("chiffres", "CHI-B", LONGUE_ETIQ), hauteur: 1350, repere });
    expect(d.dy).toBe(0);
    expect(d.dx).toBeGreaterThan(0);
    expect(d.largeurEtiquette).toBeGreaterThan(0);
    expect(d.largeurEtiquette!).toBeLessThan(LONGUE_ETIQ.length * 28);
  });
  it("4:5, étiquette courte : la pastille va à droite, étiquette entière", () => {
    const d = decalageRepere({ bloc: bloc("chiffres", "CHI-B", "TEMPS GAGNÉ"), hauteur: 1350, repere });
    expect(d.dx).toBeGreaterThan(0);
    expect(d.dy).toBe(0);
    expect(d.largeurEtiquette).toBeUndefined();
  });
});
