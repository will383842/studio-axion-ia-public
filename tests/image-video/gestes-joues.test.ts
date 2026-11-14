/**
 * GV2-50 · Image → vidéo : les gestes écrits dans la fiche (« coche », « compte ») sont joués ; les autres restent
 * ignorés sans erreur ; la consigne d'écriture ne propose que ce qui est joué ; le script collé choisit sa scène par les faits.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { calerFiche, pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { CONSIGNE_ECRITURE_IV } from "@/moteurs/montage-image-video/ecriture";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { ficheDuScriptColle } from "@/moteurs/montage-image-video/script-colle";

const carteC: CarteImage = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/C.json"), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const BASE: FicheImage = FICHES_SIMULEES["essai-c"];

function jouer(fiche: FicheImage) {
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carteC.offre, numeroVersion: 1, appelCommentaire: "question-puis-fin", questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  const voix = pisteSimulee(fiche, fin.muet ? null : fin);
  const res = mettreEnSceneIV({ carte: carteC, fiche, voix, fin, reseaux: fin.reseaux, bruitagesValides: VALIDES });
  const cale = calerFiche(fiche, voix, fin.muet ? null : fin);
  return { res, heureDuMot: (id: string, k: number) => cale.ecrans.find((x) => x.id === id)!.mots[k].debutSec };
}

/** Écran « douleur » de l'image C réécrit en écran « chiffre » : « Avant, quarante clients attendaient chaque soir. » */
function ficheChiffre(action: "compte" | "apparait" | "tombe", mot: number): FicheImage {
  const ecrans = BASE.ecrans.map((e, i) =>
    i === 1 ? { ...e, scene: "chiffre" as const, refs: [], texteDit: "Avant, quarante clients attendaient chaque soir.", textesEcran: ["*40* clients"], surMot: [{ mot, action }] } : e,
  );
  return { ...BASE, ecrans };
}

const ecransRendus = (blocs: BlocRenduIV[]) => blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "ecran" }> => b.sorte === "ecran");
const departLigne = (res: ReturnType<typeof jouer>["res"], id: string) => {
  const b = ecransRendus(res.ligne.blocs).find((x) => x.ecran.id === id)!;
  return b.ecran.evenements.find((ev) => ev.cible.startsWith("ligne-"))!.ms / 1000;
};

describe("« compte » : le compteur d'un écran chiffre démarre sur le mot", () => {
  it("sur le mot « quarante » (rang 2), à 0,05 s près", () => {
    const { res, heureDuMot } = jouer(ficheChiffre("compte", 2));
    expect(Math.abs(departLigne(res, "e02") - (heureDuMot("e02", 2) - 0.15))).toBeLessThanOrEqual(0.05);
  });
  it("sur un autre mot de la fiche (« attendaient », rang 3), le départ suit la fiche", () => {
    const a = jouer(ficheChiffre("compte", 2));
    const b = jouer(ficheChiffre("compte", 3));
    expect(departLigne(b.res, "e02")).toBeGreaterThan(departLigne(a.res, "e02") + 0.1);
    expect(Math.abs(departLigne(b.res, "e02") - (b.heureDuMot("e02", 3) - 0.15))).toBeLessThanOrEqual(0.05);
  });
  it("« tombe » : même mise en scène qu'avec « apparait », sans erreur", () => {
    const t = jouer(ficheChiffre("tombe", 3));
    const a = jouer(ficheChiffre("apparait", 3));
    expect(JSON.stringify(t.res.ligne)).toBe(JSON.stringify(a.res.ligne));
  });
});

describe("« coche » : la coche d'un nœud tombe sur le mot", () => {
  const ecranN06 = BASE.ecrans.find((e) => e.refs.includes("n06") && e.scene === "toile")!;
  const nbMots = ecranN06.texteDit.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
  const avecCoche = (mot: number): FicheImage => ({ ...BASE, ecrans: BASE.ecrans.map((e) => (e.id === ecranN06.id ? { ...e, surMot: [...e.surMot, { mot, action: "coche" as const, ref: "n06" }] } : e)) });
  const cocheDe = (res: ReturnType<typeof jouer>["res"]) => {
    for (const b of res.ligne.blocs) if (b.sorte === "toile") for (const c of b.proprietes.coches ?? []) if (c.noeud === "n06") return b.debut + c.t;
    return null;
  };
  it("l'instant de coche de n06 est l'instant du mot de la fiche", () => {
    const mot = nbMots - 1;
    const { res, heureDuMot } = jouer(avecCoche(mot));
    const t = cocheDe(res);
    expect(t).not.toBeNull();
    expect(Math.abs(t! - (heureDuMot(ecranN06.id, mot) - 0.15))).toBeLessThanOrEqual(0.05);
  });
  it("sans geste, la coche garde son heure d'aujourd'hui (le geste la déplace donc vraiment)", () => {
    const sans = cocheDe(jouer(BASE).res);
    const avec = cocheDe(jouer(avecCoche(nbMots - 1)).res);
    expect(sans).not.toBeNull();
    expect(avec).not.toBeCloseTo(sans!, 1);
  });
  it("« coche » sur un nœud qui n'a pas de coche, ou « tombe » : ignoré, aucune erreur", () => {
    const f: FicheImage = { ...BASE, ecrans: BASE.ecrans.map((e) => (e.id === ecranN06.id ? { ...e, surMot: [...e.surMot, { mot: 0, action: "tombe" as const, ref: "n05" }, { mot: 0, action: "coche" as const, ref: "n05" }] } : e)) };
    expect(JSON.stringify(jouer(f).res.ligne)).toBe(JSON.stringify(jouer(BASE).res.ligne));
  });
});

describe("la consigne d'écriture ne propose que ce qui est joué", () => {
  const ligneAction = CONSIGNE_ECRITURE_IV.split("\n").find((l) => l.includes('"action"'))!;
  it("cite coche et compte", () => {
    expect(ligneAction).toContain("coche");
    expect(ligneAction).toContain("compte");
    expect(CONSIGNE_ECRITURE_IV).toContain("coche");
    expect(CONSIGNE_ECRITURE_IV).toContain("compte");
  });
  it("ne propose pas « bascule » comme action", () => {
    expect(ligneAction).not.toContain("bascule");
    expect(CONSIGNE_ECRITURE_IV).not.toMatch(/"bascule"/);
  });
});

describe("script collé : la scène vient des faits du script", () => {
  const script = [
    "Chaque soir, vous fermez la boutique tard.",
    "Les messages s'accumulent sur votre téléphone.",
    "Vous répondez un par un, à la main.",
    "Et ça prend du temps.",
    "On passe de 2 heures à 20 minutes.",
    "Le chatbot lit chaque demande.",
    "Il répond tout de suite.",
    "Votre soirée vous appartient.",
  ].join(" ");
  const fiche = ficheDuScriptColle(script, carteC);
  it("un écran « on passe de 2 heures à 20 minutes » prend la scène chiffre, avec un compteur sur le nombre", () => {
    const e = fiche.ecrans.find((x) => x.texteDit.includes("2 heures"))!;
    expect(e.scene).toBe("chiffre");
    expect(e.surMot.some((s) => s.action === "compte")).toBe(true);
    expect(e.textesEcran[0]).toContain("*20*");
    expect(e.textesEcran[0].replace(/\*/g, "")).toBe(e.texteDit.replace(/\*/g, ""));
  });
  it("un écran sans fait garde la scène d'aujourd'hui", () => {
    for (const e of fiche.ecrans.filter((x) => !/\d/.test(x.texteDit))) expect(["accroche", "phrase-choc", "toile", "titre"]).toContain(e.scene);
  });
  it("les mots dits des écrans, bout à bout, sont ceux du script", () => {
    expect(fiche.ecrans.map((e) => e.texteDit).join(" ").replace(/\s+/g, " ")).toBe(script);
  });
});

describe("mise en page (Q21) toujours réussie", () => {
  it("fiche chiffre avec « compte » : Q21 n'est pas en échec", () => {
    const { res } = jouer(ficheChiffre("compte", 2));
    const q21 = res.rapport.lignes.filter((l) => l.code === "Q21");
    expect(q21.length).toBeGreaterThan(0);
    expect(q21.every((l) => l.ok)).toBe(true);
  });
  it("fiche avec « coche » : Q21 n'est pas en échec", () => {
    const e = BASE.ecrans.find((x) => x.refs.includes("n06") && x.scene === "toile")!;
    const f: FicheImage = { ...BASE, ecrans: BASE.ecrans.map((x) => (x.id === e.id ? { ...x, surMot: [...x.surMot, { mot: 5, action: "coche" as const, ref: "n06" }] } : x)) };
    expect(jouer(f).res.rapport.lignes.filter((l) => l.code === "Q21").every((l) => l.ok)).toBe(true);
  });
});
