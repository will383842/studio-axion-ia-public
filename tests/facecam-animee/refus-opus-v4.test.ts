/**
 * FACE CAMÉRA ANIMÉE v4 — 3e cause de refus d'Opus (v-1830b06da6dc, 18/10) : durée arrondie vers le HAUT dans le message
 * (« 90.07 » pour 90,0667 s), mots affichés à l'infinitif alors que Will dit la forme conjuguée, consigne qui l'invite à
 * recopier « tels qu'écrits à l'écran », réessai qui ne renvoie pas le plan refusé. AUCUN appel réseau.
 */
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { messageAvecErreurs, messageRealisateur, realiser, type EntreeRealisateur, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { CATALOGUE_V4 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v4";
import { controlerSuiteV4, resoudreElementsV4, type ElementResoluV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";
import { MOTS } from "./plan-reference";

const fiche = (id: string) => CATALOGUE_V4.find((f) => f.id === id)!;
const el = (id: string, debut: number, duree: number, extra: Partial<ElementResoluV4> = {}): ElementResoluV4 =>
  ({ fiche: fiche(id), debut, fin: debut + duree, mots: [], lignes: [], instants: [], recherches: [], illustre: "x", rang: 1, ...extra });
const ctx = (duree = 60) => ({ duree, finDebut: duree });
const messages = (e: string[]) => e.filter((x) => x.startsWith("D15e")).join("\n");

const voix: MotTranscrit[] = [
  { w: "on", a: 14.0, f: 14.2 }, { w: "forme", a: 14.2, f: 14.6 }, { w: "les", a: 14.6, f: 14.7 }, { w: "équipes", a: 14.7, f: 15.1 },
  { w: "on", a: 15.2, f: 15.3 }, { w: "accompagne", a: 15.3, f: 15.9 }, { w: "les", a: 16.0, f: 16.1 }, { w: "dirigeants", a: 16.1, f: 16.6 },
];
const checklist = (lignes: string[]) => el("CarteChecklist", 15.9, 3, { mots: ["ÉQUIPES"], lignes: lignes.map((texte, i) => ({ texte, a: 14.2 + i })), illustre: "on forme les équipes" });

describe("refus d'Opus · durée envoyée", () => {
  it("la durée du message est arrondie vers le BAS : 2702 images à 30 i/s → 90.06, jamais 90.07 (qui dépasse la vraie fin)", () => {
    const entree: EntreeRealisateur = { mots: MOTS, dureeSec: 2702 / 30, prise: { src: "p.mp4", finSec: 88 }, fin: { debut: 88, marque: "A", adresse: "a.com", motCle: "X", tuiles: [] } };
    const m = messageRealisateur(entree);
    expect(m).toContain('duree="90.06"');
    expect(m).not.toContain('duree="90.07"');
    expect(Number(/debut_ecran_de_fin="([\d.]+)"/.exec(m)![1])).toBeLessThanOrEqual(2702 / 30);
  });
  it("une durée ronde reste intacte (22 → 22.00)", () => {
    const entree: EntreeRealisateur = { mots: MOTS, dureeSec: 22, prise: { src: "p.mp4", finSec: 20 }, fin: { debut: 20, marque: "A", adresse: "a.com", motCle: "X", tuiles: [] } };
    expect(messageRealisateur(entree)).toContain('duree="22.00"');
  });
  it("D0 : le message dit la fin avec 3 décimales, l'écart n'est plus caché par l'arrondi", () => {
    const e = resoudreElementsV4([{ id: "EtiquetteTete", debut: 88.9, fin: 90.1 }], 2702 / 30).erreurs.find((x) => x.includes("après la fin"));
    expect(e).toMatch(/90,100 s.*90,067 s/);
  });
});

describe("refus d'Opus · mots dits (D15e)", () => {
  it("« Former » refusé quand Will dit « forme » ; le message montre les mots dits et la forme dite la plus proche", () => {
    const m = messages(controlerSuiteV4([checklist(["FORMER LES ÉQUIPES"])], ctx(), voix).erreurs);
    expect(m).toContain("former");
    expect(m).toMatch(/dits ici.*forme/);
    expect(m).toMatch(/forme dite la plus proche.*« forme »/);
  });
  it("la forme exacte « Forme » passe (la règle n'est PAS assouplie)", () => {
    expect(messages(controlerSuiteV4([checklist(["FORME LES ÉQUIPES"])], ctx(), voix).erreurs)).toBe("");
  });
  it("un mot sans aucune forme proche : le message liste les mots dits, sans suggestion inventée", () => {
    const m = messages(controlerSuiteV4([checklist(["DIAGNOSTIC"])], ctx(), voix).erreurs);
    expect(m).toMatch(/dits ici/);
    expect(m).not.toMatch(/forme dite la plus proche/);
  });
  it("les mots dits gardent leurs accents (« équipes » jamais « equipes ») et la forme proche est trouvée même au-delà des 15 mots listés", () => {
    const longue: MotTranscrit[] = [...Array.from({ length: 20 }, (_, i) => ({ w: `mot${i}x`, a: 14 + i * 0.05, f: 14.04 + i * 0.05 })), { w: "équipes", a: 15.1, f: 15.4 }, { w: "Certifexemple", a: 15.5, f: 15.8 }];
    const m = messages(controlerSuiteV4([el("CarteChecklist", 15.9, 3, { mots: ["ÉQUIPERS"], illustre: "x" })], ctx(), longue).erreurs);
    expect(m).toContain("forme dite la plus proche : « équipes »");
    expect(m.split("(dits ici")[1] ?? "").not.toMatch(/certifexemple/i);
  });
  it("chaque erreur D15e reste courte (moins de 450 caractères) et le réessai ne renvoie que 20 erreurs", () => {
    expect(messageAvecErreurs("b", Array.from({ length: 30 }, () => "x".repeat(900))).split("\n- ").length - 1).toBe(20);
  });
  it("`bas` : 0.29 et 1.15 restent intacts (flottants), 22 → 22.00", () => {
    const f = (d: number) => /duree="([\d.]+)"/.exec(messageRealisateur({ mots: MOTS, dureeSec: d, prise: { src: "p.mp4", finSec: 1 }, fin: { debut: 0, marque: "A", adresse: "a.com", motCle: "X", tuiles: [] } }))![1];
    expect([f(0.29), f(1.15), f(22)]).toEqual(["0.29", "1.15", "22.00"]);
  });
  it("chaque erreur D15e reste courte (moins de 450 caractères)", () => {
    for (const ligne of messages(controlerSuiteV4([checklist(["FORMER LES ÉQUIPES"])], ctx(), voix).erreurs).split("\n")) expect(ligne.length).toBeLessThan(450);
  });
});

describe("refus d'Opus · consigne et réessai", () => {
  it("la consigne demande la forme EXACTE dite, conjugaison comprise, et de ne pas afficher un mot mal transcrit", () => {
    const c = consigneRealisateur([]);
    expect(c).toContain("forme EXACTE");
    expect(c).toContain("conjugaison");
    expect(c).toMatch(/Forme.*jamais « ?Former/);
    expect(c).not.toContain("tels qu'écrits à l'écran");
  });
  it("le réessai renvoie le plan refusé, et seulement s'il a été lu", () => {
    const plan = { cartes: [], elementsV4: [{ id: "EtiquetteTete" }] };
    const avec = messageAvecErreurs("base", ["D15e — x"], plan);
    expect(avec).toContain("<plan_precedent>");
    expect(avec).toContain('"EtiquetteTete"');
    expect(avec).toContain("seulement les éléments fautifs");
    expect(messageAvecErreurs("base", ["D15e — x"])).not.toContain("<plan_precedent>");
    expect(messageAvecErreurs("base", ["Réponse COUPÉE : max_tokens"], plan)).not.toContain("<plan_precedent>");
  });
  it("`realiser` : le 2e message contient le plan du 1er essai", async () => {
    const entree: EntreeRealisateur = { mots: MOTS, dureeSec: 22, prise: { src: "p.mp4", finSec: 20 }, fin: { debut: 20, marque: "A", adresse: "a.com", motCle: "X", tuiles: [] } };
    const vus: string[] = [];
    const mauvais = { cartes: [], fenetres: [], calques: [], zooms: [], elementsV4: [{ id: "EtiquetteTete", debut: 1, fin: 2.2, mots: ["ZZZ"], lignes: [], instants: [], recherches: [], illustre: "x" } satisfies Partial<ElementV4Plan>] };
    await realiser(entree, { appeler: async (req) => { vus.push(req.message); return { ok: true, donnees: mauvais } as never; } });
    expect(vus.length).toBeGreaterThan(1);
    expect(vus[1]).toContain("<plan_precedent>");
    expect(vus[1]).toContain("ZZZ");
  });
});
