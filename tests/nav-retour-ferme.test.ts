import { describe, expect, it } from "vitest";
import { CLE_FEUILLE, creerGardeRetour, type GardeRetour } from "@/lib/retour-ferme";

/**
 * Navigation (03/10/2026, E2E-2 parcours n° 24) : le retour du navigateur ferme d'abord la feuille ouverte.
 * Faux historique : une pile d'entrées, un index ; `back()` déclenche `popstate` comme le navigateur.
 */
function navigateur() {
  const entrees: { adresse: string; etat: unknown }[] = [{ adresse: "/precedente", etat: { __NA: true } }];
  let i = 0;
  const lien: { garde?: GardeRetour } = {};
  const historique = {
    get state() {
      return entrees[i].etat;
    },
    pushState(etat: unknown, _t: string, adresse?: string) {
      entrees.splice(i + 1);
      entrees.push({ adresse: adresse ?? entrees[i].adresse, etat });
      i++;
    },
    back() {
      if (i === 0) return;
      i--;
      lien.garde?.surRetour();
    },
  };
  const garde = creerGardeRetour(historique, () => entrees[i].adresse);
  lien.garde = garde;
  return {
    garde,
    historique,
    /** Navigation ordinaire (lien, router.push) : Next ajoute une entrée sans la marque. */
    aller(adresse: string) {
      historique.pushState({ __NA: true }, "", adresse);
      garde.surNavigation();
    },
    get adresse() {
      return entrees[i].adresse;
    },
    get longueur() {
      return entrees.length;
    },
  };
}

describe("le retour ferme d'abord la feuille", () => {
  it("feuille ouverte : le retour la ferme et la page reste", () => {
    const n = navigateur();
    n.aller("/videos/v-1");
    let ouverte = true;
    n.garde.ouvrir("f1", () => (ouverte = false));
    expect(n.adresse).toBe("/videos/v-1");
    n.historique.back();
    expect(ouverte).toBe(false);
    expect(n.adresse).toBe("/videos/v-1");
    // Le retour suivant quitte la page, normalement.
    n.historique.back();
    expect(n.adresse).toBe("/precedente");
  });

  it("l'état de Next est recopié dans l'entrée ajoutée (le routeur reste sur la même page)", () => {
    const n = navigateur();
    n.aller("/ecrire");
    n.garde.ouvrir("f1", () => {});
    expect(n.historique.state).toMatchObject({ __NA: true, [CLE_FEUILLE]: "f1" });
  });

  it("feuille fermée à l'écran : le retour suivant quitte la page en UN geste (aucun retour « pour rien »)", () => {
    const n = navigateur();
    n.aller("/nouvelle/avocat");
    n.garde.ouvrir("f1", () => {});
    n.garde.fermeParEcran("f1");
    n.historique.back();
    expect(n.adresse).toBe("/precedente");
  });

  it("lien suivi depuis la feuille : rien n'est annulé, puis deux retours ramènent à la page d'avant", () => {
    const n = navigateur();
    n.aller("/");
    n.garde.ouvrir("plus", () => {});
    n.garde.fermeParEcran("plus"); // la tuile ferme la feuille…
    n.aller("/personnages"); // …puis la navigation part : elle n'est pas annulée
    expect(n.adresse).toBe("/personnages");
    n.historique.back(); // retour sur l'Accueil (entrée de la feuille)
    expect(n.adresse).toBe("/");
    n.historique.back(); // le doublon est sauté : on quitte l'Accueil
    expect(n.adresse).toBe("/precedente");
  });

  it("une même adresse rejointe plus tard par un lien n'est pas sautée", () => {
    const n = navigateur();
    n.aller("/videos");
    n.garde.ouvrir("f1", () => {});
    n.garde.fermeParEcran("f1");
    n.aller("/calendrier");
    n.aller("/videos");
    n.aller("/reglages");
    n.historique.back();
    expect(n.adresse).toBe("/videos");
    n.historique.back();
    expect(n.adresse).toBe("/calendrier");
  });

  it("rouvrir après une fermeture à l'écran reprend l'entrée (pas d'entrée en double)", () => {
    const n = navigateur();
    n.aller("/videos/v-1");
    n.garde.ouvrir("f1", () => {});
    n.garde.fermeParEcran("f1");
    const avant = n.longueur;
    let ouverte = true;
    n.garde.ouvrir("f1", () => (ouverte = false));
    expect(n.longueur).toBe(avant);
    n.historique.back();
    expect(ouverte).toBe(false);
    expect(n.adresse).toBe("/videos/v-1");
  });

  it("fermer par le retour n'est pas compté deux fois (le démontage qui suit est sans effet)", () => {
    const n = navigateur();
    n.aller("/ecrire");
    n.garde.ouvrir("f1", () => n.garde.fermeParEcran("f1"));
    n.historique.back();
    expect(n.garde.ouvertes).toBe(0);
    n.historique.back();
    expect(n.adresse).toBe("/precedente");
  });
});
