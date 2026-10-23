/**
 * CHAÎNE COURTE · RÈGLES DE WILL (audit du 17/10) : les mêmes règles que la chaîne « équipe » (une seule source,
 * `REGLES_WILL`), dans la partie EN CACHE des consignes ; l'appel final IMPOSÉ par le code (banque des fins, base 7),
 * selon le réseau, jamais écrit ni réécrit par le modèle. Simulation : aucun appel, aucune dépense.
 */
import { describe, expect, it } from "vitest";
import { REGLES_WILL } from "@/donnees/generateur/regles-will";
import { appelImposeCourt, appelImposeDe, CONSIGNE_COURT_ANGLE, CONSIGNE_COURT_RELECTURE, CONSIGNE_COURT_SCRIPT, executerChaineCourte, ROLES_CHAINE_COURTE } from "@/generateur/chaine-courte";
import { appelEquipe, objectifEquipe, violationsReglesWill } from "@/generateur/roles/equipe-commun";
import { graine } from "@/generateur/roles/commun";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { CONTEXTE_BANC, SUJETS_BANC } from "./banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "../helpers/g4";

const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };

function donnees(n = 0) {
  const z = etapeZeroBanc(SUJETS_BANC[n]);
  if (!z.ok) throw new Error(z.manque.ceQuIlFaudrait);
  return z.donnees;
}

describe("chaîne courte : règles de Will dans les consignes (une seule source)", () => {
  it("angle, script et relecture portent REGLES_WILL, dans la consigne du rôle (partie en cache), jamais dans la variable", async () => {
    for (const c of [CONSIGNE_COURT_ANGLE, CONSIGNE_COURT_SCRIPT, CONSIGNE_COURT_RELECTURE]) {
      expect(c).toContain(REGLES_WILL);
      for (const r of ["faites-le vous-même", "vient de sortir", "nouvel outil", "nouvelle fonctionnalité", "dernière mise à jour", "l'annonce de", "UNE cible", "aucun gain garanti"]) expect(c, r).toContain(r);
    }
    for (const r of Object.values(ROLES_CHAINE_COURTE)) expect(r.consigne).toContain(REGLES_WILL);
    const { executeur, appels } = executeurSimule();
    await executerChaineCourte(donnees(), executeur, { tournures: TOURNURES_G4, contexteWill });
    for (const a of appels) expect(a.entree.variable, a.role).not.toContain("RÈGLES DE WILL");
  });

  it("le code de l'équipe refuse la certification Certifexemple dans les deux ordres (liste unique du socle)", () => {
    for (const t of ["Nous sommes certifiés Certifexemple.", "Organisme Certifexemple certifié.", "CERTIFIÉE CERTIFEXEMPLE", "Certification Certifexemple obtenue."]) expect(violationsReglesWill(t).map((x) => x.id), t).toEqual(["WILL-INTERDIT"]);
    expect(violationsReglesWill("Une formation finançable Certifexemple.")).toEqual([]);
  });
});

describe("chaîne courte : appel final imposé par le code (banque des fins)", () => {
  it("le script reçoit <appel_impose> du réseau ; la version garde ce texte même si la relecture propose un autre appel", async () => {
    const d = donnees();
    const reseau = d.sujet.reseaux[0];
    const attendu = appelEquipe(reseau, objectifEquipe(d.sujet), graine(d.sujet.idee, reseau));
    expect(attendu?.texte).toBeTruthy();
    const { executeur, appels } = executeurSimule({
      "court-relecture": (e) => ({ remarques: [], accroche: /<accroche>([\s\S]*?)<\/accroche>/.exec(e.variable)![1], corrections: [], appel: "Appel réécrit par le modèle.", boucle: "" }),
    });
    const r = await executerChaineCourte(d, executeur, { tournures: TOURNURES_G4, contexteWill });
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    const script = appels.find((a) => a.role === "court-script")!;
    expect(script.entree.variable).toContain(`<appel_impose code="${attendu!.code}"`);
    expect(script.entree.variable).not.toMatch(/<appel type=/);
    expect(appels.find((a) => a.role === "court-relecture")!.entree.variable).toContain(`<appel_impose>${attendu!.texte}</appel_impose>`);
    expect(r.avantRelecture.appel.texte).toBe(attendu!.texte);
    expect(r.version.appel.texte).toBe(attendu!.texte);
  });

  it("production : chaque réseau reçoit l'appel de la banque pour CE réseau", async () => {
    const d = donnees();
    const { executeur } = executeurSimule();
    const r = await executerChaineCourte(d, executeur, { tournures: TOURNURES_G4, contexteWill, reseaux: d.sujet.reseaux });
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    expect(r.etat.versions!.length).toBeGreaterThan(1);
    for (const v of r.etat.versions!) {
      const a = appelEquipe(v.reseau, objectifEquipe(d.sujet), graine(d.sujet.idee, v.reseau));
      expect(a, `${v.reseau} : la banque fournit une ligne`).not.toBeNull();
      expect(v.appel.texte, v.reseau).toBe(a!.texte);
    }
  });

  it("vidéo au « tu » : une ligne de la banque au « vous » n'est pas imposée (repli : le modèle écrit l'appel)", () => {
    const d = donnees();
    const p = { reseau: () => ({ appelsPermis: ["question-expert", "diagnostic", "envoi", "sauvegarde"] }) };
    const vous = { d, p } as unknown as Parameters<typeof appelImposeCourt>[0];
    const tu = { d: { ...d, sujet: { ...d.sujet, adresse: "tu" } }, p } as unknown as Parameters<typeof appelImposeCourt>[0];
    const ligne = { code: "X", objectif: "PARTAGER" as const, texte: "Envoyez-la à un collègue." };
    expect(appelImposeDe(vous, ligne, "tiktok", []).texte).toBe(ligne.texte);
    expect(appelImposeDe(tu, ligne, "tiktok", []).texte).toBeUndefined();
    expect(appelImposeDe(tu, ligne, "tiktok", []).balise).toMatch(/^<appel type=/);
  });

  it("même sujet, même réseau : même ligne de la banque ; un autre réseau lit SA banque", () => {
    const d = donnees();
    const c = { d, p: parametresGenerateur("avocat") };
    for (const r of ["tiktok", "instagram", "linkedin"] as const) {
      const a = appelImposeCourt(c, r, []);
      const attendu = appelEquipe(r, objectifEquipe(d.sujet), graine(d.sujet.idee, r));
      expect(attendu, r).not.toBeNull();
      expect(a.texte, r).toBe(attendu!.texte);
      expect(a.balise, r).toContain(`code="${attendu!.code}"`);
    }
  });
});

describe("tics filtrés cités dans la consigne (une seule source)", () => {
  it("chaque tic et chaque annonce du filtre apparaît dans REGLES_WILL, et le filtre les repère", async () => {
    const { ANNONCES_OUTIL_WILL, TICS_IA_WILL } = await import("@/donnees/generateur/regles-will");
    const { violationsReglesWill } = await import("@/generateur/roles/equipe-commun");
    for (const t of [...TICS_IA_WILL, ...ANNONCES_OUTIL_WILL]) {
      expect(REGLES_WILL).toContain(`« ${t} »`);
      expect(violationsReglesWill(`Ici ${t} ensuite`).length, t).toBeGreaterThan(0);
    }
  });
});
