/**
 * GV2-40 : les cartes automatiques n'affichent plus rien de faux (avant/après aux unités différentes,
 * sur-titre vide, étiquette écrite en dur).
 */
import { describe, expect, it } from "vitest";
import { choisirModele } from "@/briques/motion/choix";
import { choisirModeleTous } from "@/briques/motion/choix-etendu";
import { planifierCartesAuto, type MotCarte } from "@/briques/habillage-facecam/cartes-auto";

/** Mots horodatés fabriqués à 0,35 s par mot. */
function motsDe(texte: string, debut = 0): MotCarte[] {
  return texte.split(/\s+/).filter(Boolean).map((mot, i) => ({ mot, debutSec: debut + i * 0.35, finSec: debut + i * 0.35 + 0.3 }));
}
const cartesDe = (texte: string) => {
  const mots = motsDe(texte);
  return planifierCartesAuto(mots, Math.ceil(mots[mots.length - 1].finSec + 30)).map((c) => c.carte);
};
const FAMILLES: Record<string, string> = { h: "d", min: "d", s: "d", jours: "d", semaines: "d", mois: "d", ans: "d", "%": "p", "€": "a", clients: "c", fois: "f" };

describe("GV2-40 · avant / après", () => {
  it("« 30 % en trois mois » ne donne aucune carte avant-apres", () => {
    const t = "À Lyon, un restaurant de quarante couverts a réduit son gaspillage de 30 % en trois mois.";
    expect(choisirModele(t)?.modele).not.toBe("avant-apres");
    expect(choisirModeleTous(t)?.modele).not.toBe("avant-apres");
    expect(cartesDe(t).some((c) => c.modele === "avant-apres")).toBe(false);
  });
  it.each([
    ["On passe de 12 heures à 3 heures.", 12, 3, "h", "h"],
    ["on passe de 2 heures à 20 minutes", 2, 20, "h", "min"],
    ["On est passé de 40 % à 10 %.", 40, 10, "%", "%"],
  ])("« %s » reste une carte avant-apres", (t, avant, apres, u1, u2) => {
    const c = choisirModeleTous(t);
    expect(c?.modele).toBe("avant-apres");
    expect(c?.carte).toMatchObject({ donnees: { avant: { valeur: avant, unite: u1 }, apres: { valeur: apres, unite: u2 } } });
  });
});

describe("GV2-40 · sur-titre et étiquette", () => {
  it("« Le temps ne se trouve pas, il se gagne. » ne donne aucune carte icone-mot", () => {
    expect(cartesDe("Le temps ne se trouve pas, il se gagne.").some((c) => c.modele === "icone-mot")).toBe(false);
  });
  it("« pas un problème de temps » garde sa carte icone-mot", () => {
    const cartes = cartesDe("Écoutez bien : vous n'avez pas un problème de temps, vous avez une fuite.");
    const c = cartes.find((x) => x.modele === "icone-mot");
    expect(c).toBeTruthy();
    expect((c!.donnees as { surTitre: string }).surTitre.toLowerCase()).toBe("pas un problème de temps");
  });
  it("aucune carte probleme-solution ne porte etiquetteSolution", () => {
    const t = "On veut colmater en ajoutant un outil de plus, une embauche de plus, alors que la vraie première étape, c'est de mesurer le temps perdu.";
    for (const c of cartesDe(t)) if (c.modele === "probleme-solution") expect(c.donnees).not.toHaveProperty("etiquetteSolution");
  });
});

const SCRIPTS = [
  "Vous perdez deux heures par jour à répondre aux mêmes mails. Avec un assistant bien réglé, on passe de 2 heures à 20 minutes. Le secret tient en trois étapes : d'abord trier, ensuite répondre, enfin classer. Essayez dès lundi.",
  "Un artisan sur deux ne rappelle jamais ses prospects. Résultat : 40 % des devis partent chez le concurrent. La différence entre un artisan débordé et un artisan organisé, c'est un simple rappel automatique. Mettez-le en place aujourd'hui.",
  "Hier, une cliente m'a dit : je n'ai pas le temps de m'occuper de l'intelligence artificielle. Je lui ai répondu que c'est justement pour ça qu'il faut s'y mettre. Le temps ne se trouve pas, il se gagne.",
  "Les 4 erreurs qui ruinent votre fiche Google : pas de photos, pas d'horaires, aucun avis, aucune réponse. Corrigez-les cette semaine et regardez vos appels remonter.",
  "À Lyon, un restaurant de quarante couverts a réduit son gaspillage de 30 % en trois mois. Comment ? En prévoyant ses commandes avec ses ventes passées. Pas de magie, juste des chiffres bien lus.",
  "Avant, je passais mes dimanches sur ma comptabilité. Aujourd'hui, tout est rangé le vendredi soir. Ce qui a changé : une photo de chaque facture, envoyée au bon endroit, au bon moment.",
  "Faut-il un site internet en 2026 ? Oui, mais pas pour les raisons que vous croyez. Votre site rassure, il ne vend pas. Ce qui vend, c'est la réponse rapide. Répondez en moins de cinq minutes et vous signez deux fois plus.",
  "D'un côté, le bouche à oreille, lent mais solide. De l'autre, la publicité, rapide mais chère. Entre les deux, il y a vos anciens clients. Écrivez-leur une fois par mois.",
  "Trois questions à poser avant de signer avec une agence : qui fait le travail, combien de temps ça dure, et comment on arrête. Si la réponse est floue, fuyez.",
  "Votre téléphone sonne pendant que vous êtes sur un chantier. Vous ne décrochez pas. Le client appelle le suivant. Un répondeur intelligent prend le message, propose un créneau et vous prévient par SMS. Vous ne perdez plus un seul appel.",
];

describe("GV2-40 · les dix scripts de contrôle", () => {
  it.each(SCRIPTS.map((s, i) => [i + 1, s] as const))("script %i : rien de faux", (_i, texte) => {
    const phrases = texte.split(/(?<=[.?!])\s+/);
    const cartes = [...cartesDe(texte), ...phrases.flatMap((p) => [choisirModele(p)?.carte, choisirModeleTous(p)?.carte]).filter((c) => !!c)];
    for (const c of cartes) {
      if (c!.modele === "avant-apres") {
        const d = c!.donnees as { avant: { unite: string }; apres: { unite: string } };
        expect(FAMILLES[d.avant.unite] ?? d.avant.unite).toBe(FAMILLES[d.apres.unite] ?? d.apres.unite);
      }
      if (c!.modele === "icone-mot") expect((c!.donnees as { surTitre: string }).surTitre.trim()).not.toMatch(/^pas$/i);
      if (c!.modele === "probleme-solution") expect(c!.donnees).not.toHaveProperty("etiquetteSolution");
    }
  });
});
