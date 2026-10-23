/**
 * DÉFAUT DE PRODUCTION DU 15/10 : Écrire › Nouveau sujet, format « Face caméra » en « Je lis », répondait TOUJOURS
 * « Pas assez de matière pour une vidéo — Aucune structure ne s'écrit avec ces matières » : le face caméra n'avait
 * aucune structure (chemin non-v4 de `parametresGenerateur`). Le face caméra reprend la recette v4 de l'avocat
 * (mêmes règles d'écriture, la v4 de Will en référence) avec ses propres blocs et son débit téléprompteur.
 */
import { describe, expect, it } from "vitest";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { STRUCTURES_AVOCAT } from "@/donnees/generateur/recette-avocat-v4";
import { formatGenerateur } from "@/formats";
import { briefMinimal, etapeZero } from "@/generateur/etape-zero";
import { matiere } from "../helpers/g3";
import { CONTEXTE_BANC, MAINTENANT_BANC } from "./banc/registre-banc-g4";

const avis1 = matiere("avis-will", "Un tableur partagé par mail, c'est trois versions du même fichier en une semaine, parce que personne ne sait laquelle est la bonne, donc on perd des heures à vérifier.", { id: "fc-avis-1", pilier: "donnees", motsCles: ["excel", "donnees"] });
const avis2 = matiere("avis-will", "Je conseille une seule source de données, ouverte à toute l'équipe.", { id: "fc-avis-2", pilier: "donnees", motsCles: ["excel", "donnees"] });

function ecrire(formatId: string) {
  const brief = briefMinimal({ idee: "La fin des fichiers Excel envoyés par mail", reseaux: ["tiktok"], formatId, pilier: "donnees", mode: "teleprompteur", matiereIdsImposees: [avis1.id, avis2.id] });
  return etapeZero({ maintenant: MAINTENANT_BANC, brief, mode: "teleprompteur", matieres: [avis1, avis2], preuves: [], contexteAxion: CONTEXTE_BANC });
}

describe("face caméra en « Je lis » : des structures réelles (défaut du 15/10)", () => {
  it("deux avis de Will, dont un avec une cause, imposés : une combinaison est trouvée", () => {
    const r = ecrire("facecam");
    expect(r.ok ? null : r.manque).toBeNull();
    if (!r.ok) return;
    expect(STRUCTURES_AVOCAT.map((s) => s.id)).toContain(r.choix.retenue.structure);
  });

  it("le même sujet s'écrit aussi en avocat (comportement inchangé)", () => {
    expect(ecrire("avocat").ok).toBe(true);
  });

  it("paramètres : structures, contrôles et plafonds de l'avocat v4 ; blocs, débit et ton propres au face caméra", () => {
    const fc = parametresGenerateur("facecam");
    const av = parametresGenerateur("avocat");
    expect(fc.formatId).toBe("facecam");
    expect(fc.recette.structures).toBe(STRUCTURES_AVOCAT);
    expect(fc.recette.structures.length).toBeGreaterThan(0);
    const { roles: _r, ...controlesFc } = fc.recette;
    const { roles: _a, ...controlesAv } = av.recette;
    void _r;
    void _a;
    expect(controlesFc).toEqual(controlesAv);
    // Les rôles ne nomment que les blocs du face caméra (accroche, corps, appel) : ni promesse ni boucle à part.
    const blocs = formatGenerateur("facecam").recette.blocs.map((b) => b.id);
    expect(fc.recette.roles).toEqual({ accroche: "accroche", appel: "appel" });
    for (const id of Object.values(fc.recette.roles)) expect(blocs).toContain(id);
    // Débit : celui du téléprompteur du format, jamais le débit d'avatar mesuré sur l'avocat de référence.
    expect(fc.debitParMode).toBeUndefined();
    expect(fc.modelesDeTon).toEqual(["will"]);
    expect(fc.cadreFormat).toBeUndefined();
    expect(fc.reseau("tiktok").doubleDeconseille).toBe(false);
  });
});
