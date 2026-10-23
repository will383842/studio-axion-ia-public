/**
 * Règle d'or (relecture de #323) : tout ce que comptent les contrôles de la mise en scène — Q12 (le bloc est posé),
 * Q13 (le chiffre dit est montré), Q14 (un changement visible) — EXISTE dans le plan de rendu transmis aux compositions,
 * à son heure. Un événement « objet » que la ligne de temps compte mais qu'aucun composant ne reçoit ferait passer la
 * vidéo avec un bloc absent de l'écran.
 *
 * Lecture du plan, sans rien supposer des contrôles : pour chaque bloc, ses instants de rendu (tout champ d'heure, en
 * secondes depuis le début du bloc ; ms absolues pour un écran calé), ses textes, et pour la toile les nœuds qu'elle
 * fait parler. Un événement compté retrouve un instant de rendu de SON bloc (± 0,4 s) ; un nœud posé retrouve son
 * libellé (ou son détail, un de ses sous-éléments) dans son bloc, ou son id parmi les nœuds parlés de la toile ; un
 * chiffre montré retrouve sa valeur dans un texte de son bloc ou dans un nœud parlé de la toile.
 */
import { describe, expect, it, vi } from "vitest";
import type { FicheImage, Scene } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES, ficheSimuleeRecit } from "@/moteurs/montage-image-video/ecriture.simulation";
import { AXES_VARIETE, tirablesDe, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { RECETTE_REFERENCE_IV, recettePourVersion, tirerVarieteIV } from "@/moteurs/montage-image-video/variete/tirage";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { planAlerte, planEmail } from "@/briques/schema-motion/plan-objets";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV, type MomentIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { scenesPermises } from "@/moteurs/montage-image-video/recettes";
import { comptesNonDessines } from "./dessin-du-plan";
import { carteFixe } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 240_000 });

const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Image = keyof typeof IMAGES;

function entreeDe(nom: Image, fiche: FicheImage, reseau = "youtube-shorts"): EntreeMiseEnSceneIV {
  const carte = carteFixe(nom);
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau as never))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV };
}

describe("règle d'or : rien de compté qui ne soit dessiné (Q12, Q13, Q14)", () => {
  for (const nom of Object.keys(IMAGES) as Image[]) {
    it(`${nom} : fiche telle quelle, puis chaque scène permise forcée sur chaque écran citant des nœuds`, () => {
      const base = FICHES_SIMULEES[IMAGES[nom]];
      const carte = carteFixe(nom);
      const permises = [...scenesPermises(carte.types)].filter((s) => s !== "ensemble");
      const ids = new Set(carte.noeuds.filter((n) => !n.photoPersonnes).map((n) => n.id));
      const echecs: string[] = comptesNonDessines(mettreEnSceneIV(entreeDe(nom, base)), carte).map((m) => `telle quelle: ${m}`);
      for (const ecran of base.ecrans.filter((e) => e.refs.some((r) => ids.has(r)))) {
        for (const scene of permises) {
          const fiche = structuredClone(base);
          fiche.ecrans.find((e) => e.id === ecran.id)!.scene = scene as Scene;
          for (const m of comptesNonDessines(mettreEnSceneIV(entreeDe(nom, fiche)), carte)) echecs.push(`${ecran.id}→${scene}: ${m}`);
        }
      }
      expect([...new Set(echecs)]).toEqual([]);
    });
  }
});

/** Cas de la relecture de #323 (carte C, chatbot) : e12 « email » cite [n07, l07], e13 « alerte » cite [n08 action, n09 alerte, l08, l09]. */
function ficheChatbot(): FicheImage {
  const f = structuredClone(FICHES_SIMULEES["essai-c"]);
  const par = (id: string) => f.ecrans.find((e) => e.id === id)!;
  par("e11").scene = "toile";
  par("e11").refs = [];
  Object.assign(par("e12"), { scene: "email", refs: ["n07", "l07"] });
  Object.assign(par("e13"), { scene: "alerte", refs: ["n08", "n09", "l08", "l09"] });
  for (const e of f.ecrans) e.surMot = e.surMot.filter((s) => !s.ref || e.refs.includes(s.ref));
  return f;
}

describe("chatbot (relecture de #323) : l'action, l'alerte et la relance de rythme sont dessinées", () => {
  for (const reseau of RESEAUX_IV) {
    it(`${reseau} : rien de compté qui ne soit dessiné`, () => {
      expect(comptesNonDessines(mettreEnSceneIV(entreeDe("C", ficheChatbot(), reseau)), carteFixe("C"))).toEqual([]);
    });
  }
});

const momentsDe = (r: ResultatMiseEnSceneIV) => r.ligne.blocs.flatMap((b) => (b.sorte === "moments" ? b.moments.map((m) => ({ b, m })) : []));
const alerteDe = (r: ResultatMiseEnSceneIV) => momentsDe(r).find(({ m }) => m.sorte === "alerte") as { b: { debut: number }; m: Extract<MomentIV, { sorte: "alerte" }> } | undefined;
const emailDe = (r: ResultatMiseEnSceneIV) => momentsDe(r).find(({ m }) => m.sorte === "email") as { b: { debut: number }; m: Extract<MomentIV, { sorte: "email" }> } | undefined;

describe("alerte : le nœud d'action cité est DESSINÉ (déclencheur sous la notification), la notification reste l'alerte", () => {
  for (const reseau of RESEAUX_IV) {
    it(`${reseau} : chatbot, e13 [n08 action, n09 alerte] → notification Telegram + déclencheur « Envoyé équipe concernée » sur son mot`, () => {
      const r = mettreEnSceneIV(entreeDe("C", ficheChatbot(), reseau));
      const a = alerteDe(r)!;
      expect(a.m).toMatchObject({ source: "Telegram", message: "Intervention requise" });
      expect(a.m.declencheurs?.map((d) => d.texte)).toContain("Envoyé équipe concernée");
      const ev = r.ligne.evenements.find((e) => e.ref === "n08" && e.ecran === "e13")!;
      expect(a.m.declencheurs!.find((d) => d.texte === "Envoyé équipe concernée")!.t + a.b.debut).toBeCloseTo(ev.instantSec, 3);
      // Le téléphone tient la notification sous son déclencheur (aucune phrase de mise en page).
      expect(planAlerte({ source: a.m.source, message: a.m.message, t: a.m.t0, declencheurs: a.m.declencheurs }, a.m.t0 + 1).alertes).toEqual([]);
    });
  }

  it("plan : le déclencheur est invisible avant son mot, entier sur le téléphone après, la notification tient dessous", () => {
    const p = { source: "Telegram", message: "Intervention requise", t: 1.5, declencheurs: [{ texte: "Le client écrit à 23h14", t: 0.6 }] };
    expect(planAlerte(p, 0.5).declencheurs[0].opacite).toBe(0);
    const d = planAlerte(p, 2).declencheurs[0];
    const tel = planAlerte(p, 2).telephone;
    expect(d.opacite).toBe(1);
    expect(d.decalageY).toBeCloseTo(0, 6);
    expect(d.x).toBeGreaterThanOrEqual(tel.x);
    expect(d.x + d.largeur).toBeLessThanOrEqual(tel.x + tel.largeur);
    const a = planAlerte(p, 2);
    expect(d.y).toBeGreaterThan(tel.y + 60);
    // La notification tombe sous le déclencheur et tient sur le téléphone ; la cloche n'a plus la place.
    expect(a.notification.y).toBeGreaterThanOrEqual(d.y + d.hauteur);
    expect(a.notification.y + a.hauteurNotification).toBeLessThanOrEqual(tel.y + tel.hauteur - 30);
    expect(a.cloche).toBe(false);
    expect(a.alertes).toEqual([]);
    expect(planAlerte({ ...p, declencheurs: [] }, 2).cloche).toBe(true);
    // Trop de déclencheurs : une phrase pour Will, jamais un débordement muet.
    expect(planAlerte({ ...p, declencheurs: [p.declencheurs[0], p.declencheurs[0], p.declencheurs[0]] }, 2).alertes.length).toBeGreaterThan(0);
  });
});

describe("email : un nœud cité sans sous-éléments devient un champ de l'e-mail, qui se remplit sur son mot", () => {
  for (const reseau of RESEAUX_IV) {
    it(`${reseau} : carte C telle quelle, e12 [n08] → champ « Envoyé équipe concernée »`, () => {
      const r = mettreEnSceneIV(entreeDe("C", FICHES_SIMULEES["essai-c"], reseau));
      expect(r.phrases).toEqual([]);
      const e = emailDe(r)!;
      const ev = r.ligne.evenements.find((x) => x.ref === "n08" && x.ecran === "e12")!;
      const champ = e.m.champs.find((c) => c.nom === "Envoyé équipe concernée")!;
      expect(champ.t + e.b.debut).toBeCloseTo(ev.instantSec, 3);
      expect(champ.libre).toBe(true);
    });
  }
});

describe("email : plan d'un champ libre", () => {
  const champs = [
    { nom: "Objet", t: 0.5 },
    { nom: "Contexte", t: 0.9 },
    { nom: "Envoyé équipe concernée", t: 2, libre: true as const },
  ];
  it("son libellé s'écrit sur son mot, en entier en 0,2 s, sans élargir la colonne des noms des autres champs", () => {
    expect(planEmail({ champs, debut: 0 }, 1.9).champs[2].frappeLibre?.texte).toBe("");
    expect(planEmail({ champs, debut: 0 }, 2.2).champs[2].frappeLibre).toMatchObject({ texte: "Envoyé équipe concernée", fini: true });
    const sans = planEmail({ champs: champs.slice(0, 2), debut: 0 }, 3);
    const avec = planEmail({ champs, debut: 0 }, 3);
    expect(avec.largeurNom).toBe(sans.enLigne ? sans.largeurNom : avec.largeurNom);
    expect(avec.champs[2].libre?.taille).toBeGreaterThan(0);
    expect(avec.alertes).toEqual([]);
  });
});

/**
 * Intégration de la variété (PR image-video/variete-integration) : la règle d'or tient AUSSI quand une recette
 * transforme les blocs (blocs `variete`, calques des axes). Chaque variante gardée est forcée seule sur la référence,
 * sur les 6 cartes, avec la fiche écrite selon le récit ; puis les recettes tirées de 6 graines par carte.
 */
describe("règle d'or avec la variété : blocs `variete` compris", () => {
  const entreeVariete = (nom: Image, recette: RecetteVarieteIV): EntreeMiseEnSceneIV => {
    const carte = carteFixe(nom);
    const fiche = ficheSimuleeRecit(carte.image.empreinte, recette.recit) ?? FICHES_SIMULEES[IMAGES[nom]];
    return { ...entreeDe(nom, fiche), variete: recette, format: "9:16", graine: `regle-or-${nom}` };
  };
  for (const nom of Object.keys(IMAGES) as Image[]) {
    it(`${nom} : chaque variante gardée forcée seule, puis 6 recettes tirées`, () => {
      const carte = carteFixe(nom);
      const echecs: string[] = [];
      for (const axe of AXES_VARIETE) {
        for (const code of tirablesDe(axe)) {
          const recette = { ...RECETTE_REFERENCE_IV, [axe]: code } as RecetteVarieteIV;
          for (const m of comptesNonDessines(mettreEnSceneIV(entreeVariete(nom, recette)), carte)) echecs.push(`${code}: ${m}`);
        }
      }
      for (let k = 0; k < 6; k++) {
        const recette = tirerVarieteIV({ graine: `video-${nom}-${k}`, carte, format: "9:16" });
        const tiree = recettePourVersion(recette, ["youtube-shorts"], "9:16");
        for (const m of comptesNonDessines(mettreEnSceneIV(entreeVariete(nom, tiree)), carte)) echecs.push(`${Object.values(tiree).join("·")}: ${m}`);
      }
      expect([...new Set(echecs)]).toEqual([]);
    });
  }

  it("le balayage lit bien un bloc `variete` : l'ouverture OUV-D vidée de ses mots, le chiffre dit n'est plus dessiné", () => {
    const r = mettreEnSceneIV(entreeVariete("C", RECETTE_REFERENCE_IV));
    expect(comptesNonDessines(r, carteFixe("C"))).toEqual([]);
    const b = r.ligne.blocs[0] as Extract<BlocRenduIV, { sorte: "variete" }>;
    expect(b).toMatchObject({ sorte: "variete", axe: "ouverture", code: "OUV-D" });
    const vide = { ...r, ligne: { ...r.ligne, blocs: [{ ...b, donnees: { ...(b.donnees as object), mots: [] } }, ...r.ligne.blocs.slice(1)] } };
    expect(comptesNonDessines(vide, carteFixe("C"))).toContain("e01 chiffre à 0.05 s : « *23:14* » n'est pas dans le plan");
  });
});
