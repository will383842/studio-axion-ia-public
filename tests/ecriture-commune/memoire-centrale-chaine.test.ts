/**
 * LOT C3 · mémoire commune branchée dans la chaîne COURTE (écriture centrale). Simulation : aucun appel réel.
 * (b) bloc « à ne pas redire » dans la partie VARIABLE seulement ; (c) ressemblance forte = alerte (aucune relance n'existe
 * dans la chaîne courte, aucun appel de plus) ; (d) script de Will jamais contrôlé ; (e) avocat jamais ; (f) appel sans récents ;
 * non-régression : sans mémoire, le prompt est identique octet pour octet.
 */
import { describe, expect, it } from "vitest";

const { executerChaineCourte } = await import("@/generateur/chaine-courte");
const { texteVersion } = await import("@/generateur/chaine");
const { CONTROLE_RESSEMBLANCE } = await import("@/domaine/ecriture-commune/memoire-centrale");
const { ENTETE_BLOC_MEMOIRE } = await import("@/domaine/ecriture-commune/memoire");
const { CONTEXTE_BANC, SUJETS_BANC } = await import("../generateur/banc/registre-banc-g4");
const { etapeZeroBanc, executeurSimule, TOURNURES_G4 } = await import("../helpers/g4");

const contexteWill = { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues };

/** Le sujet du banc est un sujet d'avocat : on le range sous un format central neutre, sauf demande contraire. */
async function ecrire(memoire?: Record<string, unknown>, formatId = "facecam", objectif?: string) {
  const z = etapeZeroBanc(SUJETS_BANC[0]);
  if (!z.ok) throw new Error("étape 0");
  const donnees = { ...z.donnees, sujet: { ...z.donnees.sujet, formatId, ...(objectif ? { objectif } : {}) } } as typeof z.donnees;
  const { executeur, appels } = executeurSimule({});
  const options = { tournures: TOURNURES_G4, contexteWill, ...(memoire ? { memoire } : {}) } as Parameters<typeof executerChaineCourte>[2];
  const r = await executerChaineCourte(donnees, executeur, options);
  if (r.statut !== "terminee") throw new Error(`statut ${r.statut}`);
  return { r, appels };
}
const memoire = (extra: Record<string, unknown> = {}) => ({ bloc: "- « un passage déjà dit plus tôt »", anciens: [] as string[], appelsRecents: [] as string[], ...extra });

describe("C3 · injection dans la partie variable", () => {
  it("le bloc va dans la variable du script, jamais dans le cache ni la consigne", async () => {
    const { appels } = await ecrire(memoire());
    const s = appels.find((a) => a.role === "court-script")!;
    expect(s.entree.variable).toContain(ENTETE_BLOC_MEMOIRE);
    expect(s.entree.variable).toContain("un passage déjà dit plus tôt");
    for (const a of appels) {
      expect(a.entree.contexte).not.toContain("un passage déjà dit plus tôt");
      expect(a.entree.contexte).not.toContain(ENTETE_BLOC_MEMOIRE);
    }
  });

  it("non-régression : sans mémoire (ou bloc vide), toutes les entrées sont identiques octet pour octet", async () => {
    const base = await ecrire();
    const vide = await ecrire(memoire({ bloc: "" }));
    expect(JSON.stringify(vide.appels.map((a) => a.entree))).toBe(JSON.stringify(base.appels.map((a) => a.entree)));
    expect(base.appels.some((a) => a.entree.variable.includes(ENTETE_BLOC_MEMOIRE))).toBe(false);
  });

  it("un format hors contrat (avocat) ne reçoit aucun bloc", async () => {
    const { appels } = await ecrire(memoire(), "avocat");
    expect(appels.some((a) => a.entree.variable.includes(ENTETE_BLOC_MEMOIRE))).toBe(false);
  });

  it("un script de Will (origine « will ») ne reçoit aucun bloc", async () => {
    const { appels } = await ecrire(memoire({ origine: "will" }));
    expect(appels.some((a) => a.entree.variable.includes(ENTETE_BLOC_MEMOIRE))).toBe(false);
  });
});

describe("C3 · ressemblance avec les récents", () => {
  it("ressemblance forte : alerte non bloquante, aucun appel de plus", async () => {
    const base = await ecrire();
    const texte = texteVersion(base.r.etat, base.r.version);
    const fort = await ecrire(memoire({ anciens: [texte] }));
    const v = fort.r.version.violations.find((x) => x.controle === CONTROLE_RESSEMBLANCE);
    expect(v).toBeTruthy();
    expect(v!.niveau).toBe("alerte");
    expect(v!.bloquant).toBe(false);
    expect(fort.appels.length).toBe(base.appels.length);
    expect(base.r.version.violations.some((x) => x.controle === CONTROLE_RESSEMBLANCE)).toBe(false);
  });

  it("deux scripts différents qui finissent par la même phrase de la banque : aucune alerte", async () => {
    const base = await ecrire();
    const fin = base.r.version.appel.texte;
    expect(fin.split(/\s+/).length).toBeGreaterThanOrEqual(5);
    const ancien = `Un tout autre sujet, une tout autre histoire de comptable débordé le vendredi soir. ${fin}`;
    const r = await ecrire(memoire({ anciens: [ancien] }));
    expect(r.r.version.violations.some((x) => x.controle === CONTROLE_RESSEMBLANCE)).toBe(false);
  });

  it("script de Will : jamais contrôlé, même identique à un récent", async () => {
    const base = await ecrire();
    const texte = texteVersion(base.r.etat, base.r.version);
    const will = await ecrire(memoire({ anciens: [texte], origine: "will" }));
    expect(will.r.version.violations.some((x) => x.controle === CONTROLE_RESSEMBLANCE)).toBe(false);
  });

  it("avocat : jamais contrôlé", async () => {
    const base = await ecrire();
    const texte = texteVersion(base.r.etat, base.r.version);
    const av = await ecrire(memoire({ anciens: [texte] }), "avocat");
    expect(av.r.version.violations.some((x) => x.controle === CONTROLE_RESSEMBLANCE)).toBe(false);
  });
});

describe("C3 · appel tiré sans récents (au lieu de g % n)", () => {
  it("les récents écartent la ligne tirée, sans eux le tirage est inchangé", async () => {
    // « conversation » : deux lignes de la banque pour TikTok (question), le tirage a donc un choix.
    const base = await ecrire(undefined, "facecam", "engagement");
    const code = /<appel_impose code="([^"]+)"/.exec(base.appels.find((a) => a.role === "court-script")!.entree.variable)?.[1];
    expect(code).toBeTruthy();
    const sans = await ecrire(memoire({ bloc: "", appelsRecents: [] }), "facecam", "engagement");
    expect(/<appel_impose code="([^"]+)"/.exec(sans.appels.find((a) => a.role === "court-script")!.entree.variable)?.[1]).toBe(code);
    const evite = await ecrire(memoire({ bloc: "", appelsRecents: [code] }), "facecam", "engagement");
    const autre = /<appel_impose code="([^"]+)"/.exec(evite.appels.find((a) => a.role === "court-script")!.entree.variable)?.[1];
    expect(autre).toBeTruthy();
    expect(autre).not.toBe(code);
  });
});
