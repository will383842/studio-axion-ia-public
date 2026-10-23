/**
 * INCIDENT DU 12/10 (tableau animé figé 30 min, aucune erreur à l'écran) : reproduction et reprise. Deux verticaux ; le
 * premier est fabriqué, la dernière scène du second (`vertical-liens`, fin propre à TikTok et Shorts) rate au rendu
 * (« Target closed »), puis rate encore au nouvel essai. Avant la correction : travail « en_cours » pour toujours,
 * étapes de la fiche au montage « terminées », « La vérification » en attente, `atteinte` = 7. Doubles seulement.
 */
import { describe, expect, it } from "vitest";
import { PHRASE_SCENE_RATEE } from "../../src/moteurs/montage-tableau";
import { bancDeuxVerticaux, ctx, estScene, horloge, TARGET_CLOSED, tourner } from "./banc";

describe("incident du 12/10 : la dernière scène du second vertical rate deux fois", { timeout: 120_000 }, () => {
  it("le travail passe en ÉCHEC, l'étape « Le dessin des scènes » en échec, avec une phrase simple", async () => {
    // Toute scène soumise APRÈS la première composition (= la scène propre au second vertical) rate, essai compris.
    const b = bancDeuxVerticaux((d, compositions) => (estScene(d) && compositions >= 1 ? TARGET_CLOSED : null));
    const { travail, tours } = await tourner(b.moteur, b.commande, await b.moteur.lancer(b.commande, ctx("t-incident")), 60);
    expect(tours).toBeLessThan(60);
    // Deux soumissions de la scène propre au TikTok : la première et UN nouvel essai sous un autre identifiant.
    const [premiere, essai] = b.scenesSoumises().slice(-2);
    expect(essai).toBe(`${premiere}-e1`);
    expect(travail.statut).toBe("echec");
    expect((travail.parametres as { tableau: { atteinte: number } }).tableau.atteinte).toBe(7);
    expect(travail.erreur).toMatchObject({ code: "TABLEAU_SCENE_RATEE", reessayable: true, messagePourWill: PHRASE_SCENE_RATEE });
    expect(travail.erreur?.detailTechnique).toMatch(/Target closed/);
    expect(travail.etapes.find((e) => e.cle === "scenes")).toMatchObject({ statut: "echec" });
    expect(travail.etapes.find((e) => e.cle === "controle")?.statut).toBe("en_attente");
  });

  it("« Relancer » reprend sans repayer la voix et termine les deux fichiers", async () => {
    const b = bancDeuxVerticaux((d, compositions) => (estScene(d) && compositions >= 1 ? TARGET_CLOSED : null));
    const echec = await tourner(b.moteur, b.commande, await b.moteur.lancer(b.commande, ctx("t-relance")), 60);
    expect(echec.travail.statut).toBe("echec");
    const lecturesAvant = b.d.lectures();
    expect(lecturesAvant).toBeGreaterThan(0);
    const compositionsAvant = b.compositionsSoumises().length;
    b.reparer();
    const relance = await b.moteur.reessayer!(echec.travail, horloge.t);
    expect(relance.statut).toBe("en_cours");
    const fin = await tourner(b.moteur, b.commande, relance, 60);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(lecturesAvant);
    expect(fin.resultat?.sorties).toHaveLength(2);
    // Le vertical n'est pas refait : seule la composition du TikTok part.
    expect(b.compositionsSoumises().length).toBe(compositionsAvant + 1);
    // La voix payée au premier passage reste UNE ligne (rien de payé à la relance).
    expect((b.moteur.lignesPayees?.(fin.travail, b.commande) ?? []).filter((l) => l.etape === "Voix")).toHaveLength(1);
  });
});
