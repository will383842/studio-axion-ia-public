/**
 * BANC D'ÉCRITURE · la chaîne COURTE (3 appels) en simulation : aucune clé, aucun appel, aucune dépense.
 * Elle produit un script assemblé et contrôlé par le code (note /100, voyant), avec les mêmes 4 blocs en cache que la
 * grande chaîne, et ne refait aucun appel après la relecture.
 */
import { describe, expect, it } from "vitest";
import { blocsEnCache } from "@/generateur/contexte";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { EXTRAITS_WILL } from "@/donnees/generateur/modeles-will";
import { executerChaine, texteVersion } from "@/generateur/chaine";
import { executerChaineCourte, ROLES_CHAINE_COURTE } from "@/generateur/chaine-courte";
import { MODELE_ECRITURE, MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import { CONTEXTE_BANC, SUJETS_BANC } from "../generateur/banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "../helpers/g4";

const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };

function donnees(n = 0) {
  const z = etapeZeroBanc(SUJETS_BANC[n]);
  if (!z.ok) throw new Error(z.manque.ceQuIlFaudrait);
  return z.donnees;
}

describe("Chaîne courte (banc d'écriture), en simulation", () => {
  it("3 appels exactement (Opus, Opus, Sonnet ; jamais Haiku), puis un script contrôlé par le code", async () => {
    const { executeur, appels } = executeurSimule();
    const r = await executerChaineCourte(donnees(), executeur, { tournures: TOURNURES_G4, contexteWill });
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    expect(appels.map((a) => a.role)).toEqual(["court-angle", "court-script", "court-relecture"]);
    const roles = Object.values(ROLES_CHAINE_COURTE);
    expect(roles.map((x) => x.modele)).toEqual([MODELE_ECRITURE, MODELE_ECRITURE, MODELE_JUGE]);
    expect(roles.slice(0, 2).map((x) => x.effort)).toEqual(["medium", "medium"]);
    expect(roles.some((x) => /haiku/i.test(x.modele))).toBe(false);
    const v = r.version;
    expect(r.etat.versions).toEqual([v]);
    expect(v.reseau).toBe(SUJETS_BANC[0].reseaux[0]);
    expect(texteVersion(r.etat, v).split("\n").length).toBeGreaterThan(3);
    expect(v.note.globale).toBeGreaterThan(0);
    expect(v.note.globale).toBeLessThanOrEqual(100);
    expect(["vert", "ambre", "rouge"]).toContain(v.note.voyant);
    expect(Array.isArray(v.violations)).toBe(true);
    expect(r.etat.journal.map((j) => j.etape)).toEqual([1, 2, 3]);
  });

  it("mêmes 4 blocs en cache que la grande chaîne, à chaque appel (modèles de ton et cadre du format compris)", async () => {
    const d = donnees(1);
    const courte = executeurSimule();
    await executerChaineCourte(d, courte.executeur, { tournures: TOURNURES_G4 });
    const grande = executeurSimule();
    await executerChaine(d, grande.executeur, { tournures: TOURNURES_G4 });
    const p = parametresGenerateur(d.sujet.formatId);
    const attendu = blocsEnCache(d, p);
    // Le socle commun de la PR #187 : la v4 de Will en tête des modèles de ton ; le cadre propre au format dans la
    // recette, APRÈS le socle (cache partagé, 15/10).
    expect(p.modelesDeTon[0]).toBe("will");
    expect(attendu.gagnants).toContain(EXTRAITS_WILL[0].extrait);
    if (p.cadreFormat) expect(attendu.recette).toContain(p.cadreFormat);
    if (p.cadreFormat) expect(attendu.contexteAxion).not.toContain(p.cadreFormat);
    for (const a of [...courte.appels, ...grande.appels]) expect(a.entree.contexte).toEqual(attendu);
    expect(grande.appels.length).toBeGreaterThan(courte.appels.length);
  });

  it("une sortie inutilisable arrête la chaîne : aucun appel de plus (ni reprise, ni boucle)", async () => {
    const { executeur, appels } = executeurSimule({ "court-angle": () => ({ arret: { code: "ANCRAGE_MANQUANT", raison: "rien ne tient" }, accroches: [], retenue: 0, raison: "" }) });
    const r = await executerChaineCourte(donnees(), executeur);
    expect(r.statut).toBe("arretee");
    expect(r.etat.arret?.message).toBe("rien ne tient");
    expect(appels).toHaveLength(1);
  });
});
