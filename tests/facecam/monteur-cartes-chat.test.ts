/**
 * T-MONTEUR-CARTES-CHAT-v20d : tests directs des fonctions pures de `monteur/cartes-chat.ts`
 * (nom des cartes, phrases, recalage de la réponse, plan des cartes automatiques, ménage). Entrées faites à la main.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { entreesFacecamVides } from "@/domaine/facecam";
import { reglagesMonteurVides, type EtatMonteur } from "@/moteurs/montage-facecam/monteur";
import {
  CARTE_MIN_SEC,
  DECALAGE_MAX_SEC,
  menagerCartesAuto,
  nomCarte,
  nommeCarte,
  phrasesDe,
  planCartesAuto,
  recalerReponse,
  type ContexteCartesChat,
} from "@/moteurs/montage-facecam/monteur/cartes-chat";

const MOTS = Array.from({ length: 120 }, (_, i) => ({ mot: `mot${i}`, debutSec: 1 + i * 0.5, finSec: 1.4 + i * 0.5 }));
/** Texte qui déclenche une carte automatique (liste numérotée « Un / Deux / Trois »), mots horodatés à la main. */
const QUESTIONS = "Bonjour à tous. Aujourd'hui trois questions simples. Un, où part votre temps ? Deux, qu'est-ce qui peut changer en premier ? Trois, de quoi avez-vous besoin pour avancer ? Voilà, merci à vous et à bientôt.";
const MOTS_REELS: MotHorodate[] = QUESTIONS.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(1 + i * 0.4).toFixed(2), finSec: +(1.35 + i * 0.4).toFixed(2) }));
const DUREE_REELLE = 30;
const etatVide = (): EtatMonteur => ({ facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() });
const ctx = (extra: Partial<ContexteCartesChat> = {}): ContexteCartesChat => ({ mots: MOTS, dureePriseSec: 60, approximatif: () => false, remises: [], ...extra });

describe("constantes", () => {
  it("décalage 3 s, carte minimale 2 s", () => {
    expect(DECALAGE_MAX_SEC).toBe(3);
    expect(CARTE_MIN_SEC).toBe(2);
  });
});

describe("nomCarte", () => {
  it("garde le titre avant « · »", () => {
    expect(nomCarte("3 questions · pour commencer")).toBe("3 questions");
  });
  it("retire les marqueurs *…*", () => {
    expect(nomCarte("Les *3* étapes")).toBe("Les 3 étapes");
  });
  it("coupe à 60 caractères", () => {
    expect(nomCarte("a".repeat(100))).toBe("a".repeat(60));
  });
  it("vide, absent ou espaces → « carte »", () => {
    expect(nomCarte("")).toBe("carte");
    expect(nomCarte(undefined)).toBe("carte");
    expect(nomCarte("   ")).toBe("carte");
  });
});

describe("phrasesDe", () => {
  it("sépare 3 phrases, dont une qui finit par « … »", () => {
    expect(phrasesDe("Première phrase. Deuxième phrase… Troisième phrase !")).toEqual(["Première phrase.", "Deuxième phrase…", "Troisième phrase !"]);
  });
  it("pas de coupe avant une minuscule ; texte vide → aucune phrase", () => {
    expect(phrasesDe("à 0:32. puis la suite")).toEqual(["à 0:32. puis la suite"]);
    expect(phrasesDe("")).toEqual([]);
  });
  it("coupe avant un guillemet français", () => {
    expect(phrasesDe("C'est fait. « Budget » est posée.")).toEqual(["C'est fait.", "« Budget » est posée."]);
  });
});

describe("nommeCarte", () => {
  it("reconnaît « Budget » entre guillemets", () => {
    expect(nommeCarte("La carte « Budget » est posée.", "Budget")).toBe(true);
  });
  it("ignore casse et marqueurs", () => {
    expect(nommeCarte("La carte « BUDGET » est posée.", "budget")).toBe(true);
    expect(nommeCarte("La carte « Les 3 étapes » est posée.", "Les *3* étapes")).toBe(true);
  });
  it("« carte » n'est jamais reconnue", () => {
    expect(nommeCarte("La carte « carte » est posée.", "carte")).toBe(false);
  });
  it("« Formation » n'est pas « Une formation pour vos équipes »", () => {
    expect(nommeCarte("La carte « Une formation pour vos équipes » est posée.", "Formation")).toBe(false);
  });
  it("sans guillemet, pas reconnue ; métacaractères échappés", () => {
    expect(nommeCarte("Le budget est posé.", "Budget")).toBe(false);
    expect(nommeCarte("La carte « Quoi ? » est posée.", "Quoi ?")).toBe(true);
    expect(nommeCarte("La carte « Quoi » est posée.", "Quoi.*")).toBe(false);
  });
});

describe("planCartesAuto", () => {
  it("sans mots ou durée nulle → aucune carte", () => {
    expect(planCartesAuto(etatVide(), [], 60)).toEqual([]);
    expect(planCartesAuto(etatVide(), MOTS, 0)).toEqual([]);
    expect(planCartesAuto(etatVide(), MOTS, Number.NaN)).toEqual([]);
  });
  it("les cartes posées durent au moins CARTE_MIN_SEC et finissent après leur début", () => {
    const vues = planCartesAuto(etatVide(), MOTS_REELS, DUREE_REELLE);
    expect(vues.filter((x) => x.etat === "posee")).toHaveLength(1);
    expect(vues[0].textes).toContain("Où part votre temps ?");
    for (const v of vues.filter((x) => x.etat === "posee")) {
      expect(v.finSec - v.debutSec).toBeGreaterThanOrEqual(CARTE_MIN_SEC);
    }
  });
  it("est déterministe", () => {
    expect(planCartesAuto(etatVide(), MOTS_REELS, DUREE_REELLE)).toEqual(planCartesAuto(etatVide(), MOTS_REELS, DUREE_REELLE));
  });
});

describe("menagerCartesAuto", () => {
  it("sans mots : rend l'état d'après tel quel, sans phrase ni instant", () => {
    const apres = etatVide();
    const r = menagerCartesAuto(etatVide(), apres, ctx({ mots: [] }));
    expect(r.etat).toBe(apres);
    expect(r.phrases).toEqual([]);
    expect(r.instants).toEqual([]);
  });
  it("avant = après : aucun changement, aucune phrase", () => {
    const avant = etatVide();
    const apres = etatVide();
    const r = menagerCartesAuto(avant, apres, ctx({ mots: MOTS_REELS, dureePriseSec: DUREE_REELLE }));
    expect(planCartesAuto(avant, MOTS_REELS, DUREE_REELLE).filter((v) => v.etat === "posee")).toHaveLength(1);
    expect(r.phrases).toEqual([]);
    expect(r.instants).toEqual([]);
    expect(r.etat.facecam.passages).toEqual(apres.facecam.passages);
  });
});

describe("recalerReponse", () => {
  const vide = { phrases: [], instants: [] };
  it("texte sans carte : inchangé", () => {
    expect(recalerReponse("C'est fait. Autre chose ?", vide)).toBe("C'est fait. Autre chose ?");
  });
  it("retire les marqueurs *…*", () => {
    expect(recalerReponse("Les *3* étapes sont là.", vide)).toBe("Les 3 étapes sont là.");
  });
  it("retire la phrase qui nomme une carte effacée", () => {
    const r = { phrases: [{ texte: "x", carte: "Budget", remplace: true }], instants: [] };
    expect(recalerReponse("Carte « Budget » posée à 0:10. Le reste est inchangé.", r)).toBe("Le reste est inchangé.");
  });
  it("recale l'instant qui suit le nom d'une carte déplacée", () => {
    const r = { phrases: [], instants: [{ carte: "Budget", de: 10, a: 12 }] };
    expect(recalerReponse("Carte « Budget » posée à 0:10.", r)).toBe("Carte « Budget » posée à 0:12.");
  });
});
