/** LOT A (08/11/2026) : le script de Will fait foi (remarques), un défaut de détail livre la vidéo (réserves). Purs, sans réseau. */
import { describe, expect, it } from "vitest";
import { reservesDuRapport } from "@/moteurs/montage-cas-concret";
import { REGLES_AVERTISSEMENTS, REGLES_REMARQUES } from "@/moteurs/montage-cas-concret/regles";
import { ecartsScriptValide } from "@/moteurs/montage-cas-concret/script-valide";

const ligne = (libelle: string, raison: string) => ({ cle: "ecran", libelle, bloquant: true, etat: "echoue" as const, raison });

describe("réserves d'une vidéo finie avec un défaut de détail", () => {
  it("chaque contrôle qui bloquait devient une alerte « attention » à vérifier, jamais un échec", () => {
    const r = reservesDuRapport({
      bloquants: [ligne("Mise en page", "texte hors zone sur l'écran 3")] as never,
      resume: "Bloqué : 1 contrôle échoué",
      phrases: ["Bloquant · Mise en page : texte hors zone sur l'écran 3", "À noter · Bruitages : aucun"],
    });
    expect(r.alertes).toEqual([{ code: "defaut-visuel", gravite: "attention", message: "À vérifier · Mise en page : texte hors zone sur l'écran 3" }]);
    expect(r.resume).toBe("Terminée, 1 point à vérifier");
    expect(r.phrases[0]).toBe("À vérifier · Mise en page : texte hors zone sur l'écran 3");
    expect(r.phrases.join(" ")).not.toContain("Bloqu");
  });

  it("sans défaut, rien ne change", () => {
    const r = reservesDuRapport({ bloquants: [], resume: "Vérifications passées", phrases: ["À noter · x"] });
    expect(r).toEqual({ alertes: [], resume: "Vérifications passées", phrases: ["À noter · x"] });
  });
});

describe("règles du script de Will", () => {
  it("durée, accroche, tutoiement, rythme, nombre d'écrans : remarques ; mots interdits, faux témoignage, chiffres douteux : avertissements", () => {
    for (const r of ["durée totale", "durée d'un écran", "accroche", "vouvoiement", "rythme", "nombre d'écrans"]) expect(REGLES_REMARQUES).toContain(r);
    for (const r of ["mots interdits", "aucun témoignage", "nombres des faits", "phrase de conformité"]) expect(REGLES_AVERTISSEMENTS).toContain(r);
    expect(REGLES_REMARQUES.filter((r) => REGLES_AVERTISSEMENTS.includes(r))).toEqual([]);
  });

  it("un script périmé est rejoué avec un écart dit en clair ; un script à jour n'a aucun écart ; un autre cas n'est pas un écart", () => {
    const script = { casId: "a", versionCas: 1 } as never;
    expect(ecartsScriptValide(script, { id: "a", version: 2 })[0]).toMatch(/version 1.*version 2.*rejoué tel quel/);
    expect(ecartsScriptValide(script, { id: "a", version: 1 })).toEqual([]);
    expect(ecartsScriptValide(script, { id: "b", version: 2 })).toEqual([]);
  });
});
