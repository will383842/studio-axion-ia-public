/**
 * FIX-ACCENT-APRES-v20g : la phrase du monteur écrit « juste après » avec son accent (« juste avant » inchangé).
 * Même texte d'essai que menager-cartes-auto-v20f : « 3 questions » 3,6 → 11,6 s ; carte de fin 20,4 → 25,85 s.
 */
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { entreesFacecamVides } from "@/domaine/facecam";
import { reglagesMonteurVides, type EtatMonteur, type PassageMonteur } from "@/moteurs/montage-facecam/monteur";
import { menagerCartesAuto, type ContexteCartesChat } from "@/moteurs/montage-facecam/monteur/cartes-chat";

const TEXTE =
  "Bonjour à tous. Aujourd'hui trois questions simples. Un, où part votre temps ? Deux, qu'est-ce qui peut changer en premier ? Trois, de quoi avez-vous besoin pour avancer ? Ensuite quelques mots de transition pour remplir le temps entre les deux moments importants de la vidéo, on continue tranquillement. Premièrement, prenez un rendez-vous. Deuxièmement, préparez vos documents. Troisièmement, venez nous voir. Voilà, merci à vous et à bientôt.";
const MOTS: MotHorodate[] = TEXTE.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(1 + i * 0.4).toFixed(2), finSec: +(1.35 + i * 0.4).toFixed(2) }));

const etatVide = (): EtatMonteur => ({ facecam: entreesFacecamVides(), reglages: reglagesMonteurVides() });
const passage = (id: string, debutSec: number, finSec: number, texte: string): PassageMonteur => ({
  id,
  type: "carte",
  debutSec,
  finSec,
  texte,
  origine: "demande",
  consigneId: "k1",
  ancre: { debutPriseSec: debutSec, finPriseSec: finSec },
  operation: { type: "ajouterCarte", debutMot: 0, finMot: 1, modele: null, textes: [texte], html: null, disposition: "plein-ecran", description: texte, animationGardeeId: null },
});
const ctx: ContexteCartesChat = { mots: MOTS, dureePriseSec: 60, approximatif: () => true, remises: [] };
const lancer = (p: PassageMonteur) => {
  const avant = etatVide();
  const apres: EtatMonteur = { ...avant, facecam: { ...avant.facecam, passages: [p] } };
  return menagerCartesAuto(avant, apres, ctx);
};

describe("phrase du monteur : « juste après » / « juste avant »", () => {
  it("carte 10–13 s sur « 3 questions » : poussée après, avec l'accent", () => {
    const r = lancer(passage("m1", 10, 13, "Budget"));
    expect(r.phrases).toHaveLength(1);
    expect(r.phrases[0]!.texte).toBe("Carte « Budget » placée à 0:13, juste après la carte « 3 questions ».");
    expect(r.phrases[0]!.texte).not.toContain("apres");
  });

  it("instants de déplacement inchangés (10 s → 12,65 s)", () => {
    const r = lancer(passage("m1", 10, 13, "Budget"));
    expect(r.instants).toEqual([{ carte: "Budget", de: 10, a: 12.65 }]);
  });

  it("cas « avant » inchangé", () => {
    const r = lancer(passage("m1", 1, 3, "Budget"));
    expect(r.phrases[0]!.texte).toBe("Carte « Budget » placée à 0:01, juste avant la carte « 3 questions ».");
  });
});
