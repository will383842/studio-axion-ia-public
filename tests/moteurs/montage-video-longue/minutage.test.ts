/** QUALL-1 : minutage sans voix (cartons, phrases, fin) et test d'ensemble sur le script d'essai. */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { estimerMotsSansVoix, avancerVideoLongue } from "@/moteurs/montage-video-longue/chaine";
import { definitionVideoLongue } from "@/moteurs/montage-video-longue";
import { chapitresDuScript, decouperEnPhrases } from "@/moteurs/montage-video-longue/decoupage";
import { lireEntreesVideoLongue } from "@/moteurs/montage-video-longue/entrees";
import { dureeChapitreSansVoixMs, minuterSansVoix } from "@/moteurs/montage-video-longue/minutage";
import { SCRIPT_ESSAI } from "./script-essai";

const dix = (n: string) => Array.from({ length: 10 }, (_, i) => `${n}${i}`).join(" ");

describe("QUALL-1 minutage", () => {
  it("sans question : carton de chapitre 2,5 s, phrase = max(2 s, mots/2,6), respiration 0,3 s, fin 5 s", () => {
    const r = minuterSansVoix({ chapitres: [{ titre: "A", texte: "Un deux." }] });
    // 2,5 + 2 + 0,3 + 5 = 9,8
    expect(r.dureeSec).toBe(9.8);
    expect(r.mots.map((m) => [m.mot, m.debutSec, m.finSec])).toEqual([["Un", 2.5, 3.5], ["deux.", 3.5, 4.5]]);
    expect(r.chapitres).toEqual([{ debutSec: 0, finSec: 9.8, libelle: "A", blocRecette: "chapitres" }]);
  });
  it("une phrase longue dure mots / 2,6", () => {
    const r = minuterSansVoix({ chapitres: [{ titre: "A", texte: `${dix("a")} ${dix("b")}.` }] });
    expect(r.dureeSec).toBe(Math.round((2.5 + 20 / 2.6 + 0.3 + 5) * 10) / 10);
  });
  it("la question ajoute 4 s de carton de titre ; le chapitre 1 commence quand même à 0", () => {
    const sans = minuterSansVoix({ chapitres: [{ titre: "A", texte: "Un deux." }] });
    const avec = minuterSansVoix({ chapitres: [{ titre: "A", texte: "Un deux." }], question: "Comment faire ?" });
    expect(avec.dureeSec).toBeCloseTo(sans.dureeSec + 4, 5);
    expect(avec.chapitres[0].debutSec).toBe(0);
    expect(avec.mots[0].debutSec).toBe(6.5);
  });
  it("chapitres suivants : début de leur carton ; le dernier finit à la durée ; titre manquant déduit", () => {
    const r = minuterSansVoix({ chapitres: [{ titre: "A", texte: "Un deux." }, { titre: "", texte: "Bonjour tout le monde, voilà." }] });
    expect(r.chapitres.map((c) => [c.debutSec, c.finSec])).toEqual([[0, 4.8], [4.8, r.dureeSec]]);
    expect(r.chapitres[1].libelle).toBe("Bonjour tout le monde");
    expect(r.mots.find((m) => m.mot === "Bonjour")!.debutSec).toBe(7.3);
  });
  it("aucun chapitre : rien (ni titre, ni fin)", () => expect(minuterSansVoix({ chapitres: [], question: "Q ?" })).toEqual({ mots: [], dureeSec: 0, chapitres: [] }));
  it("mots dans l'ordre, sans chevauchement", () => {
    const { mots } = minuterSansVoix({ chapitres: chapitresDuScript(SCRIPT_ESSAI) });
    for (let i = 1; i < mots.length; i++) expect(mots[i].debutSec).toBeGreaterThanOrEqual(mots[i - 1].finSec - 0.002);
  });
  it("dureeChapitreSansVoixMs = carton + phrases", () => {
    expect(dureeChapitreSansVoixMs("Un deux. Trois quatre.")).toBe(2500 + 2 * 2300);
    expect(dureeChapitreSansVoixMs("")).toBe(2500);
  });
});

const commandeEssai = (chapitres: unknown[], question?: string) =>
  ({ videoId: "v", ratios: ["16:9"], distribution: [], entrees: { videoLongue: { chapitres, sansVoix: true, ...(question ? { question } : {}) } } }) as unknown as CommandeFabrication;

describe("QUALL-1 ensemble : script d'essai", () => {
  const question = "Comment suivre mon stock sans compter à la main ?";
  const valide = chapitresDuScript(SCRIPT_ESSAI).map((c) => ({ id: c.id, titre: c.titre, texte: decouperEnPhrases(c.texte).join(" ") }));

  it("4 chapitres YouTube, chacun sur son carton, ≈ 1 min 50 à 2 min 05", async () => {
    const commande = commandeEssai(valide, question);
    const entrees = lireEntreesVideoLongue(commande);
    expect(entrees.question).toBe(question);
    expect(entrees.chapitres).toHaveLength(4);
    const voix = estimerMotsSansVoix(entrees);
    expect(voix.dureeSec).toBeGreaterThanOrEqual(110);
    expect(voix.dureeSec).toBeLessThanOrEqual(125);

    const def = definitionVideoLongue(() => ({ voix: { lire: async () => { throw new Error("jamais"); } }, monter: async () => ({ fichierCle: "k" }) }));
    const deps = { voix: { lire: async () => { throw new Error("jamais"); } }, monter: async () => ({ fichierCle: "k" }) };
    const ctx = { commande, entrees, travailId: "t", versionId: "v", tentative: 1, etapes: def.etapesFabrication };
    let etat = def.etatInitial(entrees, commande);
    for (let i = 0; i < 3; i++) etat = await avancerVideoLongue(etat, ctx, deps as never);
    const ch = etat.chapitres!;
    expect(ch.map((c) => c.libelle)).toEqual(valide.map((c) => c.titre));
    expect(ch[0].debutSec).toBe(0);
    expect(ch[3].finSec).toBe(voix.dureeSec);
    const minute = minuterSansVoix(entrees);
    // Chaque chapitre (après le premier) commence 2,5 s avant son premier mot, sur le carton.
    ch.slice(1).forEach((c, k) => {
      const premier = entrees.chapitres[k + 1].texte.split(/\s+/)[0];
      const mot = minute.mots.find((m) => m.debutSec >= c.debutSec)!;
      expect(mot.mot).toBe(premier);
      expect(mot.debutSec - c.debutSec).toBeCloseTo(2.5, 1);
    });
    for (const c of ch) expect(c.finSec - c.debutSec).toBeGreaterThanOrEqual(10);
  });

  it("les 8 chapitres déjà créés (titre vide, texte = ligne-titre) redeviennent 4 avec les mêmes titres", () => {
    const huit = valide.flatMap((c, i) => [{ id: `a${i}`, titre: "", texte: c.titre }, { id: `b${i}`, titre: "", texte: c.texte }]);
    const entrees = lireEntreesVideoLongue(commandeEssai(huit));
    expect(entrees.chapitres.map((c) => c.titre)).toEqual(valide.map((c) => c.titre));
    expect(entrees.question).toBeUndefined();
  });

  it("la question est tronquée à 200 caractères ; vide ou absente : aucune", () => {
    expect(lireEntreesVideoLongue(commandeEssai(valide, "q".repeat(300))).question).toHaveLength(200);
    expect(lireEntreesVideoLongue(commandeEssai(valide, "   ")).question).toBeUndefined();
  });
});
