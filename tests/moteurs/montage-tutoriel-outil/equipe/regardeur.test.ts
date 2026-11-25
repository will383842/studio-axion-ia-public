import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IMAGES_REGARD_MAX } from "../../../../src/briques/regardeur";
import type { ImageLue, LectureRegard } from "../../../../src/briques/regardeur";
import type { PlanValide } from "../../../../src/briques/plan-scenes/schema";
import { IMAGES_REGARD_TUTORIEL, instantsTutoriel, textesPermisDuRegistre, verdictRegardTutoriel } from "../../../../src/moteurs/montage-tutoriel-outil/equipe/regardeur";
import type { Travail } from "../../../../src/domaine/types";
import { creerMoteurTutorielOutil, noteSansGrille } from "../../../../src/moteurs/montage-tutoriel-outil";
import type { GrilleTutoriel } from "../../../../src/moteurs/montage-tutoriel-outil/grille-qualite";
import { commandeTutoriel, outilsDoubles, une } from "../../../tutoriel-outil/doubles";
import type { RegistreTextes } from "../../../../src/moteurs/montage-tutoriel-outil/equipe/registre-textes";

function plan(n: number, dureeMs = 47_000): PlanValide {
  const pas = Math.floor(dureeMs / n);
  const scenes = Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, debutMs: i * pas, finMs: (i + 1) * pas }));
  return { dureeMs, mots: [{ texte: "Ouvrez", debutMs: 0, finMs: 400 }], scenes } as unknown as PlanValide;
}
const registre = (textes: { id: string; texte: string; etapeId?: string; choisi?: boolean }[]): RegistreTextes => ({
  version: "registre-textes.v1",
  entrees: textes.map((t) => ({ id: t.id, texte: t.texte, ou: "ecran-studio" as const, origine: "proposition-studio" as const, etapeId: t.etapeId, choisi: t.choisi ?? true })),
});
const img = (nom: string, over: Partial<ImageLue> = {}): ImageLue => ({ nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false, ...over });
const rien = (instants: { nom: string }[]): LectureRegard => ({ images: instants.map((i) => img(i.nom)) });

describe("instantsTutoriel", () => {
  it("un instant avant 3 s (début, 0,5 s), un par scène, la fin", () => {
    const i = instantsTutoriel(plan(5), { finMs: 0 });
    expect(i).toHaveLength(7);
    expect(i[0]).toMatchObject({ sorte: "debut", instantSec: 0.5 });
    expect(i.filter((x) => x.instantSec < 3)).toHaveLength(1 + 0);
    expect(i.filter((x) => x.sorte === "partie")).toHaveLength(5);
    expect(i.at(-1)!.sorte).toBe("fin");
  });
  it("au plus 12, déterministe, ≤ IMAGES_REGARD_MAX", () => {
    const i = instantsTutoriel(plan(30), { finMs: 0 });
    expect(i.length).toBe(12);
    expect(IMAGES_REGARD_TUTORIEL).toBeLessThanOrEqual(IMAGES_REGARD_MAX);
    expect(instantsTutoriel(plan(30), { finMs: 0 })).toEqual(i);
  });
  it("fin « aucune » : l'instant de fin tombe dans le plan ; avec une fin choisie il tombe dans la carte", () => {
    const sans = instantsTutoriel(plan(3), { finMs: 0 }).at(-1)!;
    expect(sans.instantSec).toBeCloseTo(46.7, 3);
    const avec = instantsTutoriel(plan(3), { finMs: 4000 }).at(-1)!;
    expect(avec.instantSec).toBeCloseTo(50.7, 3);
  });
  it("texte attendu seulement si le registre porte un texte choisi pour la scène", () => {
    const r = registre([{ id: "a", texte: "Nouveau tableau", etapeId: "s2" }, { id: "b", texte: "Autre", etapeId: "s3", choisi: false }]);
    const parties = instantsTutoriel(plan(3), { finMs: 0, registre: r }).filter((x) => x.sorte === "partie");
    expect(parties.map((p) => [p.partieId, p.texteAttendu])).toEqual([["s1", false], ["s2", true], ["s3", false]]);
  });
});

describe("verdictRegardTutoriel", () => {
  const instants = instantsTutoriel(plan(3), { finMs: 4000 });
  const permis = ["Nouveau tableau de bord. Prendre rendez-vous"];
  it("lecture null : tous « non relus », aucun défaut bloquant inventé", () => {
    const v = verdictRegardTutoriel(instants, null, { textesPermis: permis });
    expect(v.relues).toBe(0);
    expect(v.nonRelues).toBe(instants.length);
    expect(v.defauts.every((d) => d.code === "non-relue" && !d.bloquantSiSur)).toBe(true);
  });
  it("texte lu hors registre : phrase non choisie", () => {
    const l = rien(instants);
    l.images[1] = img(instants[1]!.nom, { textes: [{ texte: "Gagnez trois heures par semaine", coupe: false, horsCadre: false }] });
    const v = verdictRegardTutoriel(instants, l, { textesPermis: permis });
    expect(v.defauts.map((d) => d.code)).toContain("phrase-non-choisie");
  });
  it("fin « rendez-vous » non lue : fin-absente ; lue : rien", () => {
    const fin = { texte: "Prendre rendez-vous" };
    const l = rien(instants);
    expect(verdictRegardTutoriel(instants, l, { textesPermis: permis, fin }).defauts.map((d) => d.code)).toContain("fin-absente");
    const dernier = instants.at(-1)!;
    l.images[l.images.length - 1] = img(dernier.nom, { textes: [{ texte: "Prendre rendez-vous", coupe: false, horsCadre: false }] });
    expect(verdictRegardTutoriel(instants, l, { textesPermis: permis, fin }).defauts.map((d) => d.code)).not.toContain("fin-absente");
  });
  it("sans fin choisie : jamais fin-absente", () => {
    expect(verdictRegardTutoriel(instants, rien(instants), { textesPermis: permis }).defauts.map((d) => d.code)).not.toContain("fin-absente");
  });
  it("textes permis = textes choisis du registre", () => {
    expect(textesPermisDuRegistre(registre([{ id: "a", texte: "Un" }, { id: "b", texte: "Deux", choisi: false }]))).toEqual(["Un"]);
  });
});

describe("pas de second regardeur", () => {
  it("aucune consigne, aucun schéma, aucun simuler dans l'adaptateur", () => {
    const src = readFileSync("src/moteurs/montage-tutoriel-outil/equipe/regardeur.ts", "utf8").replace(/^\/\/.*$/gm, "");
    expect(src).not.toMatch(/consigne|z\.object|simuler|executerRole|appelerAvecRotation/);
  });
});

describe("résultat du moteur : avec ou sans grille (doubles, 0 €)", () => {
  const T0 = Date.UTC(2026, 10, 8, 9);
  async function fabriquer(grille?: GrilleTutoriel) {
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles({ voix: [], claude: [], rendus: [] })) });
    const c = commandeTutoriel();
    let t: Travail = await moteur.lancer(c, { travailId: "t-g", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    for (let i = 0; i < 400; i++) {
      if (grille) t = { ...t, parametres: { ...t.parametres, tutoriel: { ...(t.parametres?.tutoriel as object), grille } } };
      const r = await moteur.avancer(t, c, T0 + i * 1000);
      t = r.travail;
      if (r.resultat) return r.resultat;
      if (["echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
    }
    throw new Error("fabrication non terminée");
  }
  const grille = (note: number, marque: "reussi" | "echoue"): GrilleTutoriel => ({
    note,
    proposable: false,
    criteres: [{ id: "marque", libelle: "Marque Axion IA", etat: marque, gravite: "bloquant", mesure: "un mot interdit", seuil: "aucun écart" }, { id: "duree", libelle: "Durée de la vidéo", etat: "echoue", gravite: "bloquant", mesure: "60 s", seuil: "40 à 55 s" }],
  });

  it("sans grille : comportement de master (note ≥ 50, droits non écrits à true)", async () => {
    const r = await fabriquer();
    expect(r.sorties[0]!.rapportQualite.verifie.droits).toBe(false);
    expect(r.sorties[0]!.rapportQualite.note).toBe(r.noteQualite.globale);
    expect(r.noteQualite.alertes.some((a) => a.message.startsWith("À vérifier · Durée"))).toBe(false);
  });
  it("sans grille : résultat identique, champ par champ, à la logique de master", async () => {
    const r = await fabriquer();
    const r2 = await fabriquer();
    // déterministe : deux fabrications avec les mêmes doubles donnent exactement le même résultat
    expect(r2).toEqual(r);
    // Changement VOULU (QUAL-4) : sans grille, la note passe par `noteSansGrille` (−10 par « attention », comme master) ET
    // la composition non vérifiée (ici : le pas qui la calcule n'a pas tourné) compte « à corriger » (−8) : jamais 100
    // sans contrôle passé. Le plancher de 50 de master n'existe plus (plancher 0).
    const notes = (alertes: { gravite: string }[]) => noteSansGrille({ bloquants: 0, aCorriger: 1, attention: alertes.filter((a) => a.gravite === "attention").length });
    for (const s of r.sorties) {
      expect(s.rapportQualite.note).toBe(notes(s.rapportQualite.alertes));
      expect(s.rapportQualite.verifie).toEqual({ image: true, son: s.rapportQualite.verifie.son, sousTitres: true, mentionIA: false, droits: false });
      expect(s.rapportQualite.alertes.some((a) => a.message.includes("(seuil "))).toBe(false);
    }
    expect(r.noteQualite.globale).toBe(notes(r.noteQualite.alertes));
    expect(Object.keys(r.sorties[0]!.rapportQualite).sort()).toEqual(["alertes", "niveauSonoreLufs", "note", "verifie"]);
  });
  it("avec grille : la note et les alertes viennent de la grille ; droits = critère « Marque »", async () => {
    const r = await fabriquer(grille(37, "echoue"));
    expect(r.noteQualite.globale).toBe(37);
    for (const s of r.sorties) {
      expect(s.rapportQualite.note).toBe(37);
      expect(s.rapportQualite.verifie.droits).toBe(false);
      expect(s.rapportQualite.alertes.map((a) => a.message)).toContain("À vérifier · Durée de la vidéo : 60 s (seuil 40 à 55 s)");
    }
    expect(r.noteQualite.alertes.filter((a) => a.message.startsWith("À vérifier · Durée"))).toHaveLength(1);
    const ok = await fabriquer(grille(88, "reussi"));
    expect(ok.sorties[0]!.rapportQualite.verifie.droits).toBe(true);
  });
});
