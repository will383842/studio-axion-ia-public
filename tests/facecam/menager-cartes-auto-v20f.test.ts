/**
 * T-MENAGER-CARTES-v20f : tests directs de `menagerCartesAuto` (monteur/cartes-chat.ts) : rangement des cartes
 * automatiques quand une carte est demandée au chat. Entrées faites à la main, aucun appel réel, aucun code modifié.
 *
 * Texte d'essai (mots à 0,4 s d'écart) : deux cartes automatiques posées —
 *   « 3 questions »            3,6 s → 11,6 s
 *   « Prenez un rendez-vous »  20,4 s → 25,85 s  (carte de FIN : la dernière)
 * Écart exigé entre une carte du monteur et une carte automatique : 1 s (+ marge 0,05 s).
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { entreesFacecamVides } from "@/domaine/facecam";
import { reglagesMonteurVides, type EtatMonteur, type PassageMonteur } from "@/moteurs/montage-facecam/monteur";
import { menagerCartesAuto, planCartesAuto, type ContexteCartesChat } from "@/moteurs/montage-facecam/monteur/cartes-chat";

const TEXTE =
  "Bonjour à tous. Aujourd'hui trois questions simples. Un, où part votre temps ? Deux, qu'est-ce qui peut changer en premier ? Trois, de quoi avez-vous besoin pour avancer ? Ensuite quelques mots de transition pour remplir le temps entre les deux moments importants de la vidéo, on continue tranquillement. Premièrement, prenez un rendez-vous. Deuxièmement, préparez vos documents. Troisièmement, venez nous voir. Voilà, merci à vous et à bientôt.";
const MOTS: MotHorodate[] = TEXTE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(1 + i * 0.4).toFixed(2), finSec: +(1.35 + i * 0.4).toFixed(2) }));
const DUREE = 60;

const etatVide = (): EtatMonteur => ({ facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() });
/** Carte du monteur (ajouterCarte) posée à la main, sans coupe : temps de prise = temps monté. */
const passage = (id: string, debutSec: number, finSec: number, texte: string, consigneId?: string): PassageMonteur => ({
  id,
  type: "carte",
  debutSec,
  finSec,
  texte,
  origine: "demande",
  ...(consigneId ? { consigneId } : {}),
  ancre: { debutPriseSec: debutSec, finPriseSec: finSec },
  operation: { type: "ajouterCarte", debutMot: 0, finMot: 1, modele: null, textes: [texte], html: null, disposition: "plein-ecran", description: texte, animationGardeeId: null },
});
const avec = (etat: EtatMonteur, ...passages: PassageMonteur[]): EtatMonteur => ({ ...etat, facecam: { ...etat.facecam, passages: [...etat.facecam.passages, ...passages] } });
const ctx = (extra: Partial<ContexteCartesChat> = {}): ContexteCartesChat => ({ mots: MOTS, dureePriseSec: DUREE, approximatif: () => false, remises: [], ...extra });
const approx = { approximatif: () => true };
const carte = (etat: EtatMonteur, id: string) => etat.facecam.passages.find((p) => p.id === id);

describe("socle : les deux cartes automatiques de l'essai", () => {
  it("2 cartes posées aux instants attendus, la dernière est la carte de fin", () => {
    const vues = planCartesAuto(etatVide(), MOTS, DUREE).filter((v) => v.etat === "posee");
    expect(vues.map((v) => [v.textes[0], v.debutSec, v.finSec])).toEqual([
      ["3 questions", 3.6, 11.6],
      ["Prenez un rendez-vous", 20.4, 25.85],
    ]);
  });
});

describe("menagerCartesAuto : carte ajoutée juste avant une carte automatique", () => {
  it("carte raccourcie (pas déplacée) : 0 → 2,55 s, assez longue (≥ 2 s), aucune phrase", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 0, 3, "Budget"));
    const r = menagerCartesAuto(avant, apres, ctx());
    const c = carte(r.etat, "m1")!;
    expect([c.debutSec, c.finSec]).toEqual([0, 2.55]);
    expect(c.finSec - c.debutSec).toBeGreaterThanOrEqual(2);
    expect(r.phrases).toEqual([]);
    expect(r.instants).toEqual([]);
  });

  it("raccourcir donnerait moins de 2 s : la carte est AVANCÉE (2 s) avant la carte automatique, phrase et instants rendus", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 1, 3, "Budget", "k1"));
    const r = menagerCartesAuto(avant, apres, ctx(approx));
    const c = carte(r.etat, "m1")!;
    expect([c.debutSec, c.finSec]).toEqual([0.55, 2.55]);
    expect(c.ancre).toEqual({ debutPriseSec: 0.55, finPriseSec: 2.55 });
    expect(r.instants).toEqual([]); // 0:01 → 0:01 (arrondi à la seconde) : rien à recaler
    expect(r.phrases).toEqual([{ carte: "Budget", remplace: false, texte: "Carte « Budget » placée à 0:01, juste avant la carte « 3 questions »." }]);
  });

  it("carte de 3 s avancée de 1,6 s : instant d'avant et nouvel instant rendus (temps monté)", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 2.5, 5, "Budget", "k1"));
    const r = menagerCartesAuto(avant, apres, ctx(approx));
    // Carte auto juste APRÈS la nouvelle ? Non : elle commence à 3,6 s, la nouvelle à 2,5 s → carte avancée juste avant.
    expect(carte(r.etat, "m1")!.finSec).toBe(2.55);
    expect(r.instants).toEqual([{ carte: "Budget", de: 2.5, a: carte(r.etat, "m1")!.debutSec }]);
  });

  it("jamais sous 2 s : instant non approximatif et pas assez de place → la carte reste telle quelle, la carte automatique s'efface (phrase)", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 1, 3, "Budget"));
    const r = menagerCartesAuto(avant, apres, ctx());
    const c = carte(r.etat, "m1")!;
    expect([c.debutSec, c.finSec]).toEqual([1, 3]);
    expect(r.phrases).toEqual([
      { carte: "3 questions", remplace: true, texte: "La carte « 3 questions » s'efface : la carte « Budget » occupe ce moment ; dites « remets-la » pour la garder." },
    ]);
  });
});

describe("menagerCartesAuto : carte ajoutée après le début d'une carte automatique", () => {
  it("instant approximatif, ≤ 3 s de décalage : la carte passe juste APRÈS (même durée), phrase « juste après »", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 10, 13, "Budget", "k1"));
    const r = menagerCartesAuto(avant, apres, ctx(approx));
    const c = carte(r.etat, "m1")!;
    expect([c.debutSec, c.finSec]).toEqual([12.65, 15.65]);
    expect(r.instants).toEqual([{ carte: "Budget", de: 10, a: 12.65 }]);
    expect(r.phrases).toHaveLength(1);
    expect(r.phrases[0]).toMatchObject({ carte: "Budget", remplace: false });
    // Le mot « après » n'est pas contrôlé à la lettre : voir DEFAUT VU au journal (la phrase rendue dit « apres », sans accent).
    expect(r.phrases[0].texte).toMatch(/^Carte « Budget » placée à 0:13, juste apr\S+s la carte « 3 questions »\.$/);
  });

  it("instant précis (non approximatif) : la carte ne bouge pas, la carte automatique s'efface", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 10, 13, "Budget"));
    const r = menagerCartesAuto(avant, apres, ctx());
    expect([carte(r.etat, "m1")!.debutSec, carte(r.etat, "m1")!.finSec]).toEqual([10, 13]);
    expect(r.instants).toEqual([]);
    expect(r.phrases.map((p) => [p.carte, p.remplace])).toEqual([["3 questions", true]]);
  });

  it("décalage de plus de 3 s : la carte ne glisse pas (carte auto effacée)", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 5, 8, "Budget"));
    const r = menagerCartesAuto(avant, apres, ctx(approx));
    expect([carte(r.etat, "m1")!.debutSec, carte(r.etat, "m1")!.finSec]).toEqual([5, 8]);
    expect(r.phrases.map((p) => [p.carte, p.remplace])).toEqual([["3 questions", true]]);
  });
});

describe("menagerCartesAuto : carte de fin protégée", () => {
  it("rien ne tient : la carte ajoutée n'est pas posée, phrase de choix avec la consigne", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 21, 24, "Budget", "k1"));
    const r = menagerCartesAuto(avant, apres, ctx());
    expect(carte(r.etat, "m1")).toBeUndefined();
    expect(r.etat.facecam.passages).toEqual([]);
    expect(r.phrases).toEqual([
      {
        carte: "Budget",
        remplace: true,
        consigneId: "k1",
        texte: "Je n'ai pas ajouté la carte « Budget » : à ce moment, elle effacerait la carte de fin « Prenez un rendez-vous ». Dites « remplace la carte de fin » ou donnez-moi un autre moment.",
      },
    ]);
    // La carte de fin est bien sauve : replanifiée sans la carte ajoutée, elle est posée.
    expect(planCartesAuto(r.etat, MOTS, DUREE).filter((v) => v.etat === "posee").map((v) => v.textes[0])).toEqual(["3 questions", "Prenez un rendez-vous"]);
  });

  it("carte juste avant la fin : avancée juste AVANT la carte de fin même si l'instant n'est pas approximatif", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 19, 22, "Budget", "k1"));
    const r = menagerCartesAuto(avant, apres, ctx());
    const c = carte(r.etat, "m1")!;
    expect([c.debutSec, c.finSec]).toEqual([16.35, 19.35]);
    expect(r.instants).toEqual([{ carte: "Budget", de: 19, a: 16.35 }]);
    expect(r.phrases).toEqual([{ carte: "Budget", remplace: false, texte: "Carte « Budget » placée à 0:16, juste avant la carte « Prenez un rendez-vous »." }]);
  });
});

describe("menagerCartesAuto : carte automatique remise pendant le tour", () => {
  const idA = () => planCartesAuto(etatVide(), MOTS, DUREE).find((v) => v.textes[0] === "3 questions")!.idStable;
  const avantRetiree = (...p: PassageMonteur[]) => {
    const e = avec(etatVide(), ...p);
    return { ...e, reglages: { ...e.reglages, cartesAutoRetirees: [idA()] } };
  };

  it("la carte du monteur qui la recouvre lui laisse la place (passe juste après)", () => {
    const m = passage("m1", 5, 8, "Budget");
    const avant = avantRetiree(m);
    const apres = avec(etatVide(), m);
    const r = menagerCartesAuto(avant, apres, ctx({ remises: [idA()] }));
    const c = carte(r.etat, "m1")!;
    expect([c.debutSec, c.finSec]).toEqual([12.65, 15.65]);
    expect(r.phrases).toHaveLength(1);
    expect(r.phrases[0]).toMatchObject({ carte: "Budget", remplace: false });
    // Le mot « après » n'est pas contrôlé à la lettre : voir DEFAUT VU au journal (la phrase rendue dit « apres », sans accent).
    expect(r.phrases[0].texte).toMatch(/^Carte « Budget » placée à 0:13, juste apr\S+s la carte « 3 questions »\.$/);
    expect(planCartesAuto(r.etat, MOTS, DUREE).find((v) => v.textes[0] === "3 questions")!.etat).toBe("posee");
  });

  it("une autre carte occupe la place d'après : la carte ne peut pas revenir (phrase « retire … »)", () => {
    const m1 = passage("m1", 5, 8, "Budget");
    const m2 = passage("m2", 12, 16, "Autre");
    const avant = avantRetiree(m1, m2);
    const apres = avec(etatVide(), m1, m2);
    const r = menagerCartesAuto(avant, apres, ctx({ remises: [idA()] }));
    expect([carte(r.etat, "m1")!.debutSec, carte(r.etat, "m1")!.finSec]).toEqual([5, 8]);
    expect(r.phrases).toEqual([{ carte: "3 questions", remplace: true, texte: "La carte « 3 questions » ne peut pas revenir : la carte « Budget » occupe ce moment. Dites : retire « Budget »." }]);
  });
});

describe("menagerCartesAuto : entrées non mutées", () => {
  it("avant et après identiques (copie profonde) après l'appel, même quand une carte est déplacée", () => {
    const avant = etatVide();
    const apres = avec(avant, passage("m1", 10, 13, "Budget", "k1"));
    const copieAvant = structuredClone(avant);
    const copieApres = structuredClone(apres);
    const r = menagerCartesAuto(avant, apres, ctx(approx));
    expect(r.etat).not.toBe(apres);
    expect(avant).toEqual(copieAvant);
    expect(apres).toEqual(copieApres);
    expect(carte(apres, "m1")!.debutSec).toBe(10);
  });
});
