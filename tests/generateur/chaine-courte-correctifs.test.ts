/**
 * Correctifs de la chaîne courte (audit du 17/10, § 5.5) : règles 14 mots et emphase lues du module de la prose,
 * relecture qui reçoit les matières, citation d'ancrage jamais perdue (C31), consignes neutres quant au format.
 * Simulation seulement : aucun appel.
 */
import { describe, expect, it } from "vitest";
import { executerChaineCourte, garderCitationsAncrage, garderAccrocheAncrage, CONSIGNE_COURT_ANGLE, CONSIGNE_COURT_RELECTURE, CONSIGNE_COURT_SCRIPT, roleCourtScript } from "@/generateur/chaine-courte";
import { MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import { MOTS_PAR_PHRASE_MAX, PART_EMPHASE_MAX, REGLE_EMPHASE, REGLE_PHRASES_COURTES } from "@/generateur/roles/prose";
import { CONTEXTE_BANC, SUJETS_BANC } from "./banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "../helpers/g4";

const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };

function donnees() {
  const z = etapeZeroBanc(SUJETS_BANC[0]);
  if (!z.ok) throw new Error(z.manque.ceQuIlFaudrait);
  return z.donnees;
}

describe("court-script : 14 mots et emphase, lus du module de la prose", () => {
  it("la consigne porte les deux règles, avec les chiffres du module partagé", () => {
    expect(MOTS_PAR_PHRASE_MAX).toBe(14);
    expect(PART_EMPHASE_MAX).toBe(0.4);
    expect(CONSIGNE_COURT_SCRIPT).toContain(REGLE_PHRASES_COURTES);
    expect(CONSIGNE_COURT_SCRIPT).toContain("14 mots au plus");
    expect(CONSIGNE_COURT_SCRIPT).toContain(REGLE_EMPHASE);
    expect(CONSIGNE_COURT_SCRIPT).toContain("40 % des segments au plus");
    expect(roleCourtScript.consigne).toBe(CONSIGNE_COURT_SCRIPT);
  });
});

describe("court-relecture : matières reçues, citation d'ancrage gardée", () => {
  it("la relecture reçoit les <matiere> d'ancrage", async () => {
    const d = donnees();
    const { executeur, appels } = executeurSimule();
    const r = await executerChaineCourte(d, executeur, { tournures: TOURNURES_G4, contexteWill });
    expect(r.statut).toBe("terminee");
    const rel = appels.find((a) => a.role === "court-relecture")!;
    const ids = d.choix.ancrages.map((a) => a.matiereId);
    expect(ids.length).toBeGreaterThan(0);
    expect(rel.entree.variable).toContain("<matiere ");
    for (const id of ids) expect(rel.entree.variable).toContain(`id="${id}"`);
    expect(CONSIGNE_COURT_RELECTURE).toContain("<matiere>");
  });

  it("le modèle de la relecture ne change pas (Sonnet)", async () => {
    const { ROLES_CHAINE_COURTE } = await import("@/generateur/chaine-courte");
    expect(ROLES_CHAINE_COURTE.relecture.modele).toBe(MODELE_JUGE);
  });

  it("une correction qui supprime la citation d'ancrage est refusée et signalée", () => {
    const m = { id: "m1", texte: "Trois versions du même fichier en une semaine" };
    const segs = [{ texte: "On a trois versions du même fichier en une semaine, et personne ne sait laquelle est bonne." }, { texte: "Autre phrase." }];
    const r = garderCitationsAncrage(segs, [{ segmentIndex: 0, texte: "Plusieurs fichiers circulent.", motif: "resserrer" }, { segmentIndex: 1, texte: "Autre.", motif: "resserrer" }], [m]);
    expect(r.gardees.map((x) => x.segmentIndex)).toEqual([1]);
    expect(r.refusees).toHaveLength(1);
    expect(r.refusees[0]).toContain("C31");
    expect(r.refusees[0]).toContain("m1");
  });

  it("une correction qui garde la citation passe", () => {
    const m = { id: "m1", texte: "Trois versions du même fichier en une semaine" };
    const segs = [{ texte: "On a trois versions du même fichier en une semaine, et personne ne sait laquelle est bonne." }];
    const r = garderCitationsAncrage(segs, [{ segmentIndex: 0, texte: "Trois versions du même fichier en une semaine. Personne ne sait laquelle est bonne.", motif: "resserrer" }], [m]);
    expect(r.gardees).toHaveLength(1);
    expect(r.refusees).toEqual([]);
  });

  it("une accroche relue qui perd la citation d'ancrage est refusée (C31) ; celle qui la garde passe", () => {
    const m = { id: "m1", texte: "Trois versions du même fichier en une semaine" };
    const avant = "Trois versions du même fichier en une semaine";
    const r = garderAccrocheAncrage(avant, "Plusieurs versions circulent", [m]);
    expect(r.accroche).toBe(avant);
    expect(r.refus).toContain("C31 : correction de l'accroche refusée");
    expect(r.refus).toContain("m1");
    expect(garderAccrocheAncrage(avant, "Trois versions du même fichier en une semaine, déjà", [m])).toEqual({ accroche: "Trois versions du même fichier en une semaine, déjà" });
    expect(garderAccrocheAncrage(avant, "  ", [m]).accroche).toBe(avant);
  });

  it("un ancrage à nom sensible est protégé via sa version anonymisée", () => {
    const m = { id: "m1", texte: "Chez Garnier Transports, Martin relançait trois fois le même client" };
    const anonyme = { id: "m1", texte: "Chez un client, un collègue relançait trois fois le même client" };
    const segs = [{ texte: "Chez un client, un collègue relançait trois fois le même client, sans réponse." }];
    const corr = [{ segmentIndex: 0, texte: "Il relance, sans réponse.", motif: "resserrer" }];
    expect(garderCitationsAncrage(segs, corr, [m]).refusees).toEqual([]);
    const r = garderCitationsAncrage(segs, corr, [m, anonyme]);
    expect(r.gardees).toEqual([]);
    expect(r.refusees).toHaveLength(1);
    expect(r.refusees[0]).toContain("m1");
  });

  it("de bout en bout : la correction refusée laisse le texte d'origine et laisse une trace au journal", async () => {
    const d = donnees();
    const base = executeurSimule();
    await executerChaineCourte(d, base.executeur, { tournures: TOURNURES_G4, contexteWill });
    const { executeur } = executeurSimule({
      "court-relecture": (entree) => {
        const corps = [...entree.variable.matchAll(/<segment index="(\d+)" marqueurs="([^"]*)">/g)].find((x) => x[2].split(",").includes("ancrage"));
        const a = /<accroche>([\s\S]*?)<\/accroche>/.exec(entree.variable)![1];
        // Appel imposé par le code (banque des fins) : la relecture le reçoit à part et le rend vide.
        expect(entree.variable).toMatch(/<appel_impose>[\s\S]+<\/appel_impose>/);
        expect(entree.variable).not.toMatch(/<appel>/);
        const appel = "";
        return { remarques: [], accroche: a, corrections: corps ? [{ segmentIndex: Number(corps[1]), texte: "Phrase sans la citation.", motif: "resserrer" }] : [], appel, boucle: "" };
      },
    });
    const r = await executerChaineCourte(d, executeur, { tournures: TOURNURES_G4, contexteWill });
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    const texte = r.etat.corps![0].blocs!.flatMap((b) => b.segments).map((s) => s.texte);
    expect(texte).not.toContain("Phrase sans la citation.");
    expect(r.etat.journal.find((j) => j.role === "court-relecture")?.echecs?.join(" ")).toContain("C31");
  });
});

describe("consignes courtes neutres quant au format", () => {
  it("aucune ne nomme « face caméra » : le format vient de la recette", () => {
    for (const c of [CONSIGNE_COURT_ANGLE, CONSIGNE_COURT_SCRIPT, CONSIGNE_COURT_RELECTURE]) expect(c).not.toMatch(/face cam[ée]ra|facecam/i);
    expect(CONSIGNE_COURT_ANGLE).toContain("<recette>");
    expect(CONSIGNE_COURT_SCRIPT).toContain("<recette>");
  });
});
