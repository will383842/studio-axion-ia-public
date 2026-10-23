/**
 * Chaîne courte : une phrase REDITE à deux ou trois mots près en fin de script est vue par le code (RP-01, `repetitions.ts`),
 * signalée au relecteur dans <alertes_code>, et sa correction (suppression) est appliquée. Exécuteur simulé : aucun appel.
 * Correctif du 18/10/2026 (banc à l'aveugle : la courte laissait passer ces quasi-répétitions).
 */
import { describe, expect, it } from "vitest";
import { executerChaineCourte, ROLES_CHAINE_COURTE } from "@/generateur/chaine-courte";
import { CONTEXTE_BANC, SUJETS_BANC } from "./banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "../helpers/g4";

const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };

const PREMIERE = "Le délai d'envoi passe de plusieurs jours à une demi-journée.";
/** La même phrase, la fin changée (« une demi-journée » → « quelques heures »), redite en fin de script. */
const REDITE = "Le délai d'envoi passe de plusieurs jours à quelques heures.";

function donnees() {
  const z = etapeZeroBanc(SUJETS_BANC[0]);
  if (!z.ok) throw new Error(z.manque.ceQuIlFaudrait);
  return z.donnees;
}

/** Le script simulé de la courte : le segment 1 est la phrase, un segment ajouté en toute fin en est la redite (non voisine). */
function scriptAvecRedite(entree: Parameters<typeof ROLES_CHAINE_COURTE.script.simuler>[0]) {
  const sortie = ROLES_CHAINE_COURTE.script.simuler(entree) as unknown as { segments: { id: string; texte: string; marqueurs?: string[] }[] };
  const segments = sortie.segments.map((s, i) => (i === 1 ? { ...s, texte: PREMIERE } : s));
  return { ...sortie, segments: [...segments, { ...segments[segments.length - 1], id: "s-redite", texte: REDITE, marqueurs: [], matiereIds: [], sourceTexte: undefined }] };
}

describe("chaîne courte : quasi-répétition en fin de script", () => {
  it("le relecteur reçoit l'alerte REPETITION, et sa suppression de la redite est appliquée", async () => {
    let alertes = "";
    const { executeur, appels } = executeurSimule({
      "court-script": scriptAvecRedite,
      "court-relecture": (entree) => {
        alertes = /<alertes_code>([\s\S]*?)<\/alertes_code>/.exec(entree.variable)![1];
        const a = /<accroche>([\s\S]*?)<\/accroche>/.exec(entree.variable)![1];
        const redite = [...entree.variable.matchAll(/<segment index="(\d+)"[^>]*>([^<]*)<\/segment>/g)].find((x) => x[2] === REDITE);
        return { remarques: [], accroche: a, corrections: redite ? [{ segmentIndex: Number(redite[1]), texte: "", motif: "redite" }] : [], appel: "", boucle: "" };
      },
    });
    const r = await executerChaineCourte(donnees(), executeur, { tournures: TOURNURES_G4, contexteWill });
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    // 1. Le code a vu la quasi-répétition et l'a dite au relecteur, avec la consigne de la supprimer.
    expect(appels.find((a) => a.role === "court-relecture")).toBeDefined();
    
    expect(alertes).toContain("REPETITION");
    expect(alertes).toContain(REDITE);
    expect(alertes).toContain("supprime la répétition, ne réécris pas le reste");
    // 2. La suppression du relecteur est appliquée : la première phrase reste, la redite a disparu.
    const textes = r.etat.corps![0].blocs!.flatMap((b) => b.segments).map((s) => s.texte);
    expect(textes).toContain(PREMIERE);
    expect(textes).not.toContain(REDITE);
    expect(r.etat.reecritures).toBe(1);
  });

  it("sans redite, l'alerte est « aucune » (pas de fausse alarme sur le script simulé)", async () => {
    let alertes = "";
    const { executeur } = executeurSimule({
      "court-relecture": (entree) => {
        alertes = /<alertes_code>([\s\S]*?)<\/alertes_code>/.exec(entree.variable)![1];
        const a = /<accroche>([\s\S]*?)<\/accroche>/.exec(entree.variable)![1];
        return { remarques: [], accroche: a, corrections: [], appel: "", boucle: "" };
      },
    });
    const r = await executerChaineCourte(donnees(), executeur, { tournures: TOURNURES_G4, contexteWill });
    expect(r.statut).toBe("terminee");
    expect(alertes.trim()).toBe("- aucune");
  });
});
