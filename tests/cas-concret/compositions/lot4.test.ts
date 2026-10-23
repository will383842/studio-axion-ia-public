/**
 * Lot 4 des compositions « Cas concret MD » (R4) : types de la fin (`appel-mot`, `promesse`, `lien`) et leurs objets
 * (`champ-commentaire`, `bulle-lien`). Les tests appellent les plans purs et lisent les fichiers comme du texte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boitesEcran, controlerProprietes, imagesEcran, largeurTexte, type ProprietesEcran } from "../../../src/briques/ecrans-motion";
import { exempleEcran } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { lettresTapees, planAppelMot, type ProprietesAppelMot } from "../../../studio-rendu/compositions/cas-concret/plans/AppelMot";
import { planBulleLien } from "../../../studio-rendu/compositions/cas-concret/plans/BulleLien";
import { planChampCommentaire } from "../../../studio-rendu/compositions/cas-concret/plans/ChampCommentaire";
import { planLien, planSignature, SIGNATURE_AVANT_FIN_S, type ProprietesLien } from "../../../studio-rendu/compositions/cas-concret/plans/Lien";
import { planPromesse, type ProprietesPromesse } from "../../../studio-rendu/compositions/cas-concret/plans/Promesse";
import { DOSSIER } from "./outils";

const FPS = 25;
const appel = () => exempleEcran("appel-mot") as ProprietesAppelMot;
const promesse = () => exempleEcran("promesse") as ProprietesPromesse;
const lien = () => exempleEcran("lien") as ProprietesLien;
const avec = <T extends ProprietesEcran>(p: T, champs: Partial<T>): T => ({ ...p, ...champs });
/** Images de début, de milieu et de fin d'un écran. */
const troisImages = (p: ProprietesEcran) => {
  const n = imagesEcran(p);
  return [0, Math.floor(n / 2), n - 1];
};

describe("appel-mot", () => {
  it("rend ses textes au début, au milieu et à la fin", () => {
    const p = appel();
    const [debut, milieu, fin] = troisImages(p).map((i) => planAppelMot(p, i).textes);
    expect(debut.marque).toBe("axion-ia.com");
    expect(debut.mot).toBeUndefined();
    expect(milieu.invite).toBe("Écrivez");
    expect(fin).toEqual({ marque: "axion-ia.com", etiquette: "Pour la recevoir", invite: "Écrivez", mot: "IA", suite: "en commentaire." });
  });

  it("le mot se tape lettre par lettre, le curseur clignote", () => {
    const p = avec(appel(), { mot: "ABCD" });
    const debut = 0.7;
    const tape = (s: number) => planAppelMot(p, Math.round(s * FPS)).mot.tape;
    expect(tape(debut - 0.1)).toBe("");
    expect(tape(debut + 0.01)).toBe("A");
    expect(tape(debut + 0.16)).toBe("AB");
    expect(tape(debut + 0.31)).toBe("ABC");
    expect(tape(debut + 0.5)).toBe("ABCD");
    expect(lettresTapees("ABCD", 99)).toBe(4);
    const etats = new Set(Array.from({ length: 25 }, (_, i) => planAppelMot(p, i).mot.curseur));
    expect(etats).toEqual(new Set([true, false]));
  });

  it("l'événement « mot » fixe le début de la frappe", () => {
    const p = avec(appel(), { evenements: [{ cible: "mot", ms: 1500 }] });
    expect(planAppelMot(p, Math.round(1.4 * FPS)).mot.tape).toBe("");
    expect(planAppelMot(p, Math.round(1.6 * FPS)).mot.tape).toBe("I");
  });

  it("« DIAGNOSTIC » (10 lettres) tient dans le champ, sous le plancher jamais", () => {
    const p = avec(appel(), { mot: "DIAGNOSTIC" });
    const plan = planAppelMot(p, imagesEcran(p) - 1);
    expect(plan.mot.tape).toBe("DIAGNOSTIC");
    const champ = planChampCommentaire(plan.champ.objet);
    expect(champ.texte.tient).toBe(true);
    expect(largeurTexte(champ.texte.complet, "anton", champ.texte.taille, champ.texte.approcheEm)).toBeLessThanOrEqual(champ.texte.zone.largeur + 0.01);
    expect(champ.texte.taille).toBeGreaterThanOrEqual(plan.mot.pose.plancher - 0.01);
    // La zone du mot reste dans le champ, avant le bouton d'envoi.
    expect(champ.texte.zone.x + champ.texte.zone.largeur).toBeLessThanOrEqual(champ.boite.largeur - champ.bouton.droite - champ.bouton.diametre);
  });

  it("aucun texte hors de sa boîte, déterministe", () => {
    const p = appel();
    expect(controlerProprietes(p)).toEqual([]);
    expect(planAppelMot(p, 40)).toEqual(planAppelMot(p, 40));
  });
});

describe("promesse", () => {
  it("rend ses textes au début, au milieu et à la fin, tous les mots opaques à la fin", () => {
    const p = promesse();
    const [debut, milieu, fin] = troisImages(p).map((i) => planPromesse(p, i));
    expect(debut.textes).toEqual({ marque: "axion-ia.com" });
    expect(milieu.textes.invite).toBe("On vous envoie");
    expect(fin.textes).toEqual({ marque: "axion-ia.com", invite: "On vous envoie", cadeau: "toute la structure", ligne: "de cette automatisation, à mettre en place chez vous" });
    for (const m of [...fin.invite.mots, ...fin.cadeau.mots]) expect(m.opacite).toBe(1);
    expect(fin.ligne.opacite).toBe(1);
  });

  it("le cadeau est en accent avec lueur ; l'invite ne l'est pas", () => {
    const fin = planPromesse(promesse(), imagesEcran(promesse()) - 1);
    expect(fin.cadeau.lueur).toBe(true);
    expect(fin.cadeau.mots.every((m) => m.accent)).toBe(true);
    expect(fin.invite.mots.some((m) => m.accent)).toBe(false);
  });

  it("le texte du cadeau vient des propriétés", () => {
    const p = avec(promesse(), { cadeau: "*le plan complet*" });
    expect(planPromesse(p, imagesEcran(p) - 1).textes.cadeau).toBe("le plan complet");
    expect(controlerProprietes(p)).toEqual([]);
  });
});

describe("lien", () => {
  it("rend ses textes au début, au milieu et à la fin", () => {
    const p = lien();
    const [debut, milieu, fin] = troisImages(p).map((i) => planLien(p, i).textes);
    expect(debut.marque).toBe("axion-ia.com");
    expect(debut.signature).toBeUndefined();
    expect(milieu.titre).toBe("Le lien est en commentaire");
    expect(fin).toEqual({ marque: "axion-ia.com", titre: "Le lien est en commentaire", lien: "Diagnostic gratuit · lien en commentaire", signature: "Axion-IA" });
  });

  it("« Diagnostic gratuit · lien en commentaire » tient dans la bulle", () => {
    const p = lien();
    expect(controlerProprietes(p)).toEqual([]);
    const plan = planLien(p, imagesEcran(p) - 1);
    expect(plan.bulle.tient).toBe(true);
    const bulle = planBulleLien(plan.bulle.objet);
    expect(bulle.texte.tient).toBe(true);
    expect(largeurTexte(bulle.texte.texte, "inter-gras", bulle.texte.taille)).toBeLessThanOrEqual(bulle.texte.zone.largeur + 0.01);
    expect(bulle.texte.zone.x + bulle.texte.zone.largeur).toBeLessThanOrEqual(bulle.boite.largeur);
  });

  it("la bulle ajuste elle-même un texte plus long, sans passer sous 60 % de sa taille", () => {
    const boite = boitesEcran(lien()).objets.find((o) => o.nom === "bulle")!.boite;
    const taille = boitesEcran(lien()).textes.find((t) => t.nom === "lien")!.taille;
    const long = planBulleLien({ boite, t: 3, tVideo: 3, fond: "sombre", textes: ["Lien en premier commentaire sous la vidéo"], tailleTexte: taille });
    const court = planBulleLien({ boite, t: 3, tVideo: 3, fond: "sombre", textes: ["Lien en bas"], tailleTexte: taille });
    expect(long.texte.taille).toBeLessThan(court.texte.taille);
    expect(long.texte.taille).toBeGreaterThanOrEqual(court.texte.taille * 0.6 - 0.01);
  });

  it("la signature tombe 1,55 s avant la fin de l'écran", () => {
    const p = lien();
    const duree = (p.finMs - p.debutMs) / 1000;
    expect(SIGNATURE_AVANT_FIN_S).toBe(1.55);
    const avant = planSignature(duree, duree - 1.55 - 0.02);
    const apres = planSignature(duree, duree - 1.55 + 0.3);
    expect(avant.opacite).toBe(0);
    expect(avant.echelle).toBeCloseTo(1.3, 5);
    expect(apres.opacite).toBe(1);
    expect(apres.echelle).toBeCloseTo(1, 5);
    const image = (s: number) => Math.round(s * FPS);
    expect(planLien(p, image(duree - 1.55 - 0.1)).signature.opacite).toBe(0);
    expect(planLien(p, image(duree - 0.5)).signature.opacite).toBe(1);
    expect(planLien(p, 0).signature.segments).toEqual([{ texte: "Axion-", accent: false }, { texte: "IA", accent: true }]);
  });
});

describe("fichiers du lot", () => {
  const fichiers = [
    "types/AppelMot.tsx",
    "types/Promesse.tsx",
    "types/Lien.tsx",
    "objets/ChampCommentaire.tsx",
    "objets/BulleLien.tsx",
    "plans/AppelMot.ts",
    "plans/Promesse.ts",
    "plans/Lien.ts",
    "plans/ChampCommentaire.ts",
    "plans/BulleLien.ts",
  ];
  const lire = (f: string) => readFileSync(join(DOSSIER, f), "utf8");

  it("aucun fichier ne contient les mots « commentaire », « bio », « diagnostic » (les textes viennent des propriétés)", () => {
    // Les noms de composants imposés par le registre (ChampCommentaire) portent une majuscule : seule la minuscule est cherchée.
    for (const f of fichiers) expect(lire(f).match(/commentaire|bio|diagnostic/g) ?? [], f).toEqual([]);
  });

  it("aucune couleur ni police en dur, aucun personnage ni silhouette", () => {
    for (const f of fichiers) {
      const t = lire(f);
      expect(t.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) ?? [], f).toEqual([]);
      expect(t.match(/["'`][^"'`\n]*\b(Anton|Inter|Arial|Helvetica|serif)\b/g) ?? [], f).toEqual([]);
      expect(t.match(/personnage|silhouette|visage/gi) ?? [], f).toEqual([]);
    }
  });

  it("les plans sont purs : ni remotion ni React", () => {
    for (const f of fichiers.filter((x) => x.startsWith("plans/"))) expect(lire(f).match(/from\s+["'](remotion|react)/g) ?? [], f).toEqual([]);
  });
});
