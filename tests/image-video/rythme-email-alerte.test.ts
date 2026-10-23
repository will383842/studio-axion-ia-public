/**
 * Rythme des écrans « email » et « alerte » (un seul objet sur ~4 s), par construction : jamais plus de 2,2 s sans un
 * changement visible DESSINÉ dans l'écran (Q14), sans rien compter qui ne soit dessiné (règle d'or, #323).
 *
 * Cas du vrai travail (chatbot) reproduit sur la carte C :
 *  (1) écran « email » [n07, l06] : n07 SANS sous-éléments (« Email structuré auto »), l'écran écrit « Objet · Contexte ·
 *      Demande · Urgence », le voisin du lien (n02) est déjà montré : le champ libre arrive, puis plus rien pendant ~3 s ;
 *  (2) écran « alerte » [n08 action, n09 alerte, l08] : déclencheur au début, notification au milieu, puis plus rien
 *      jusqu'à l'écran suivant.
 */
import { describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage, Scene } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { instantsVisibles } from "@/moteurs/montage-image-video/controles-scene";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type MomentIV, type ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { planAlerte, planEmail } from "@/briques/schema-motion/plan-objets";
import { comptesNonDessines } from "./dessin-du-plan";
import { carteFixe } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 240_000 });

const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Image = keyof typeof IMAGES;

function mettre(carte: CarteImage, fiche: FicheImage, reseau = "youtube-shorts"): ResultatMiseEnSceneIV {
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau as never))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV });
}

/** Carte C dont le nœud de l'e-mail n'a pas de sous-éléments (comme la carte du vrai travail). */
function carteChatbot(): CarteImage {
  const c = carteFixe("C");
  delete c.noeuds.find((n) => n.id === "n07")!.sousElements;
  return c;
}

function ficheChatbot(): FicheImage {
  const f = structuredClone(FICHES_SIMULEES["essai-c"]);
  const par = (id: string) => f.ecrans.find((e) => e.id === id)!;
  Object.assign(par("e11"), { scene: "email", refs: ["n07", "l06"] });
  Object.assign(par("e12"), { scene: "toile", refs: [] });
  Object.assign(par("e13"), { scene: "alerte", refs: ["n08", "n09", "l08"], texteDit: "L'équipe concernée est prévenue tout de suite. Une alerte Telegram tombe : intervention requise, sans attendre une seconde de plus.", surMot: [] });
  for (const e of f.ecrans) e.surMot = e.surMot.filter((s) => !s.ref || e.refs.includes(s.ref));
  return f;
}

/** Plus long temps sans changement compté DANS un écran (de son début à la fin de sa voix, au plus à sa fin). */
function plusLongTrouDans(r: ResultatMiseEnSceneIV, ecran: string): { duree: number; de: number; a: number } {
  const plans = r.ligne.plans.filter((p) => p.ecran === ecran);
  const debut = Math.min(...plans.map((p) => p.debut));
  const fin = Math.min(Math.max(...plans.map((p) => p.fin)), r.ligne.finVoixSec);
  const pts = [0, ...instantsVisibles(r.ligne.evenements, r.ligne.finVoixSec).filter((t) => t > 0), r.ligne.finVoixSec];
  let pire = { duree: 0, de: debut, a: debut };
  for (let k = 1; k < pts.length; k++) {
    const de = Math.max(debut, pts[k - 1]);
    const a = Math.min(fin, pts[k]);
    if (a - de > pire.duree) pire = { duree: Math.round((a - de) * 1000) / 1000, de, a };
  }
  return pire;
}

const q14 = (r: ResultatMiseEnSceneIV) => r.rapport.lignes.filter((l) => l.code === "Q14" && l.bloquant && !l.ok).map((l) => l.phrase);
const momentDe = <S extends MomentIV["sorte"]>(r: ResultatMiseEnSceneIV, sorte: S) =>
  r.ligne.blocs.flatMap((b) => (b.sorte === "moments" ? b.moments.map((m) => ({ b, m })) : [])).find(({ m }) => m.sorte === sorte) as { b: { debut: number }; m: Extract<MomentIV, { sorte: S }> } | undefined;

describe("chatbot du vrai travail : e-mail sans sous-éléments puis alerte, Q14 tenu sur les 5 réseaux", () => {
  for (const reseau of RESEAUX_IV) {
    it(`${reseau} : Q14 accepté, rien de compté qui ne soit dessiné, jamais plus de 2,2 s sans changement dans l'e-mail et l'alerte`, () => {
      const r = mettre(carteChatbot(), ficheChatbot(), reseau);
      expect(q14(r)).toEqual([]);
      expect(comptesNonDessines(r, carteChatbot())).toEqual([]);
      expect(plusLongTrouDans(r, "e11").duree).toBeLessThanOrEqual(2.2);
      expect(plusLongTrouDans(r, "e13").duree).toBeLessThanOrEqual(2.2);
    });
  }

  it("e-mail : les champs écrits à l'écran (Objet, Contexte, Demande, Urgence) deviennent de vrais champs, chacun sur son mot", () => {
    const r = mettre(carteChatbot(), ficheChatbot());
    const e = momentDe(r, "email")!;
    expect(e.m.champs.map((c) => c.nom)).toEqual(["Email structuré auto", "Objet", "Contexte", "Demande", "Urgence"]);
    expect(e.m.champs.map((c) => !!c.libre)).toEqual([true, false, false, false, false]);
    for (const c of e.m.champs.slice(1)) {
      const ev = r.ligne.evenements.find((x) => x.ecran === "e11" && x.texte === c.nom)!;
      expect(ev.visible).toBe(true);
      expect(c.t + e.b.debut).toBeCloseTo(ev.instantSec, 3);
    }
    expect(planEmail({ champs: e.m.champs, debut: 0 }, 4).alertes).toEqual([]);
  });

  it("alerte : un tampon « Lu ✓ » dessiné sur la notification relance le rythme, à son heure dans le plan", () => {
    const r = mettre(carteChatbot(), ficheChatbot());
    const a = momentDe(r, "alerte")!;
    expect(a.m.tampon?.map((x) => x.texte)).toEqual(["Lu"]);
    const lu = a.m.tampon![0];
    expect(lu.t).toBeGreaterThan(a.m.t0 + 0.6);
    const ev = r.ligne.evenements.find((x) => x.ecran === "e13" && x.genre === "coche")!;
    expect(ev).toMatchObject({ texte: "Lu", visible: true });
    expect(lu.t + a.b.debut).toBeCloseTo(ev.instantSec, 3);
    const p = { source: a.m.source, message: a.m.message, t: a.m.t0, declencheurs: a.m.declencheurs, tampon: a.m.tampon };
    expect(planAlerte(p, lu.t - 0.05).tampon?.opacite).toBe(0);
    expect(planAlerte(p, lu.t + 0.5).tampon).toMatchObject({ texte: "Lu", opacite: 1 });
    expect(planAlerte(p, lu.t + 0.5).alertes).toEqual([]);
  });

  it("plan : un tampon en deux étapes remplace la première par la seconde, jamais avant que l'objet soit là", () => {
    const p = { source: "Telegram", message: "Intervention requise", t: 1, tampon: [{ texte: "Reçu", t: 2 }, { texte: "Lu", t: 3.5 }] };
    expect(planAlerte(p, 1.9).tampon?.opacite).toBe(0);
    expect(planAlerte(p, 2.5).tampon).toMatchObject({ texte: "Reçu", opacite: 1 });
    expect(planAlerte(p, 4).tampon).toMatchObject({ texte: "Lu", opacite: 1 });
    // Posé avant la chute de la notification, il attend qu'elle soit tombée.
    expect(planAlerte({ ...p, tampon: [{ texte: "Lu", t: 0.5 }] }, 1.2).tampon?.opacite).toBe(0);
    expect(planEmail({ champs: [{ nom: "Objet", t: 0.5 }], debut: 0, tampon: [{ texte: "Envoyé", t: 2 }] }, 1.9).tampon?.opacite).toBe(0);
    expect(planEmail({ champs: [{ nom: "Objet", t: 0.5 }], debut: 0, tampon: [{ texte: "Envoyé", t: 2 }] }, 2.5).tampon).toMatchObject({ texte: "Envoyé", opacite: 1 });
  });

  it("alerte nommée tard : la notification tombe tôt, son message s'écrit sur son mot (il montre ses chiffres)", () => {
    const f = ficheChatbot();
    Object.assign(f.ecrans.find((e) => e.id === "e13")!, { refs: ["n09"], texteDit: "Et là, au milieu de la nuit, sans prévenir, tombe une alerte Telegram." });
    const r = mettre(carteChatbot(), f);
    const a = momentDe(r, "alerte")!;
    const message = r.ligne.evenements.find((x) => x.ecran === "e13" && x.genre === "frappe" && x.ref === "n09")!;
    expect(a.m.frappe).toBeDefined();
    expect(a.m.frappe! + a.b.debut).toBeCloseTo(message.instantSec, 3);
    expect(a.m.t0).toBeLessThan(a.m.frappe! - 0.5);
    const p = { source: a.m.source, message: a.m.message, t: a.m.t0, frappe: a.m.frappe };
    expect(planAlerte(p, a.m.frappe! - 0.1).opaciteMessage).toBe(0);
    expect(planAlerte(p, a.m.frappe! + 0.3).opaciteMessage).toBe(1);
    expect(plusLongTrouDans(r, "e13").duree).toBeLessThanOrEqual(2.2);
    expect(comptesNonDessines(r, carteChatbot())).toEqual([]);
  });
});

describe("balayage : toute scène email / alerte forcée sur un écran citant des nœuds, fixtures A-F", () => {
  for (const nom of Object.keys(IMAGES) as Image[]) {
    it(`${nom} : aucun trou de plus de 2,4 s dans l'écran forcé, rien de compté qui ne soit dessiné`, () => {
      const base = FICHES_SIMULEES[IMAGES[nom]];
      const carte = carteFixe(nom);
      const ids = new Set(carte.noeuds.filter((n) => !n.photoPersonnes).map((n) => n.id));
      const echecs: string[] = [];
      for (const ecran of base.ecrans.filter((e) => e.refs.some((r) => ids.has(r)))) {
        for (const scene of ["email", "alerte"] as Scene[]) {
          const fiche = structuredClone(base);
          fiche.ecrans.find((e) => e.id === ecran.id)!.scene = scene;
          const r = mettre(carte, fiche);
          for (const m of comptesNonDessines(r, carte)) echecs.push(`${ecran.id}→${scene}: ${m}`);
          // L'écran resté un moment (pas repassé sur la toile faute de pouvoir dessiner un bloc) tient son rythme.
          if (!r.ligne.plans.some((p) => p.ecran === ecran.id && p.sorte === "moment")) continue;
          const trou = plusLongTrouDans(r, ecran.id);
          if (trou.duree > 2.4) echecs.push(`${ecran.id}→${scene}: ${trou.duree} s sans changement (${trou.de} → ${trou.a})`);
        }
      }
      expect([...new Set(echecs)]).toEqual([]);
    });
  }
});
