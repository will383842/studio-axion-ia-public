/**
 * LOT C4 · mémoire commune branchée dans l'écriture du CAS CONCRET. Doubles, aucun appel réel.
 * (b) bloc « à ne pas redire » dans la partie VARIABLE seulement, consigne intacte ; (c) ressemblance = ALERTE (aucune relance,
 * aucun appel de plus) ; (d) script de Will jamais contrôlé ; (f) échec silencieux ; (g) sans mémoire, octet pour octet.
 * Phrases IMPOSÉES du format (bascule, question finale…) : ni alerte ni ligne du bloc.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { recettePour } from "@/formats/cas-concret/recette";
import type { CasConcret } from "@/formats/cas-concret/cas";
import type { MemoireCentrale } from "@/domaine/ecriture-commune/memoire-centrale";
import { ENTETE_BLOC_MEMOIRE } from "@/domaine/ecriture-commune/memoire";
import { anonymiserPourMemoire, blocMemoire, memoireAntiCopie } from "@/domaine/ecriture-commune/memoire";
import { ecrireFiche, roleEcritureCasConcret, variableEcriture, CONSIGNE_ECRITURE, type EntreeEcriture } from "@/moteurs/montage-cas-concret/ecriture";
import { texteDuCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import type { OutilsEcriture, ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import { figerMemoireCommune, PHRASES_FIXES_CAS_CONCRET, type MemoireCommuneEcriture } from "@/moteurs/montage-cas-concret/memoire-commune";
import { ecritureDetachee, type AppelSuivi } from "@/moteurs/montage-cas-concret/appels";
import { PHRASES_BANQUE_FINS } from "@/briques/fins/banque";
import { validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";

const FIXE = { videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", origine: "porte-a" } as const;
const cas: CasConcret = CATALOGUE.find((c) => c.id !== "recrutement-apporteurs")!;
const entree = (extra: Partial<EntreeEcriture> = {}): EntreeEcriture => ({ ...FIXE, cas, ...extra });

function ficheSimulee(c: CasConcret): FicheEcrans {
  const sortie = roleEcritureCasConcret.simuler({ contexte: {}, variable: variableEcriture(c, recettePour(c), FIXE) });
  if (typeof sortie === "string") throw new Error("aucune fiche simulée");
  return sortie;
}

interface Double extends OutilsEcriture {
  appels: EntreeRole[];
}
function double(reponses: (FicheEcrans | string)[], extra: Partial<OutilsEcriture> = {}, simule = false): Double {
  const d: Double = {
    appels: [],
    async appeler(_role: DefinitionRole, e: EntreeRole): Promise<ReponseAppelEcriture> {
      d.appels.push(e);
      const r = reponses[d.appels.length - 1];
      if (r === undefined) throw new Error("appel de trop");
      return { ok: true, simule, texte: typeof r === "string" ? r : JSON.stringify(r), stopReason: "end_turn" };
    },
    budget: { reserver: async () => ({ ok: true }) },
    ...extra,
  };
  return d;
}

interface Hook extends MemoireCommuneEcriture {
  tolerees: (readonly string[])[];
  gardes: string[];
}
function hook(memoire: Awaited<ReturnType<MemoireCommuneEcriture["preparer"]>>, options: { echecPreparer?: boolean; echecEnregistrer?: boolean } = {}): Hook {
  const h: Hook = {
    tolerees: [],
    gardes: [],
    async preparer(tolere) {
      h.tolerees.push(tolere);
      if (options.echecPreparer) throw new Error("base indisponible");
      return memoire;
    },
    async enregistrer(texte) {
      h.gardes.push(texte);
      if (options.echecEnregistrer) throw new Error("base indisponible");
    },
  };
  return h;
}

const base = ficheSimulee(cas);
/** Scripts RÉALISTES : la fiche gabarit de chaque autre cas du catalogue (tous finissent par la même question, ouvrent la méthode par la même bascule). */
const AUTRES = CATALOGUE.filter((c) => c.id !== cas.id).slice(0, 6).map((c) => texteDuCorps(ficheSimulee(c)));
const memoireDe = (anciens: string[], extra: Record<string, unknown> = {}) => {
  const sequences = memoireAntiCopie(anciens, { tolere: PHRASES_FIXES_CAS_CONCRET });
  return { bloc: blocMemoire(sequences), anciens, ...extra };
};

describe("(g) interrupteur coupé : le prompt est identique octet pour octet", () => {
  it("CONSIGNE_ECRITURE n'a pas bougé d'un octet", () => {
    // B3 : consigne volontairement modifiée (R05 au débit prudent, liste-avant). B3-bis : modification voulue (débit de 3 à 3,9). 24/10 : modification voulue (cas sans fait chiffré, paragraphe SANS FAIT CHIFFRÉ). 24/10 : modification voulue (clarté, récit).
    expect(createHash("sha256").update(CONSIGNE_ECRITURE).digest("hex")).toBe("5c4e8b49b5bb3b5f2a08996dc4a334b4269867260d33c3f0f65c4054b4f1935e");
    expect(CONSIGNE_ECRITURE).not.toContain(ENTETE_BLOC_MEMOIRE);
    expect(CONSIGNE_ECRITURE).toContain("SANS FAIT CHIFFRÉ");
    expect(CONSIGNE_ECRITURE).toContain("jamais PREUVE_MANQUANTE pour cette raison");
  });
  it("sans outil de mémoire, avec un outil qui rend « rien » ou un bloc vide : les entrées sont identiques", async () => {
    const a = double([base]);
    await ecrireFiche(entree(), a);
    const b = double([base], { memoireCommune: hook(null) });
    await ecrireFiche(entree(), b);
    const c = double([base], { memoireCommune: hook({ bloc: "", anciens: [] }) });
    await ecrireFiche(entree(), c);
    expect(JSON.stringify(b.appels)).toBe(JSON.stringify(a.appels));
    expect(JSON.stringify(c.appels)).toBe(JSON.stringify(a.appels));
    expect(a.appels[0].variable).not.toContain(ENTETE_BLOC_MEMOIRE);
  });
  it("sans bloc, variableEcriture est inchangée", () => {
    expect(variableEcriture(cas, recettePour(cas), FIXE)).toBe(variableEcriture(cas, recettePour(cas), FIXE, [], {}));
  });
});

describe("(b) le bloc va dans la partie VARIABLE, jamais dans la consigne ni le contexte", () => {
  it("injecté en dernier dans la variable ; la consigne et le contexte ne le portent pas", async () => {
    const d = double([base], { memoireCommune: hook(memoireDe(["Chaque lundi matin votre équipe recopie les mêmes factures dans trois tableaux différents sans jamais se tromper"])) });
    await ecrireFiche(entree(), d);
    const v = d.appels[0].variable;
    expect(v).toContain(ENTETE_BLOC_MEMOIRE);
    expect(v).toContain("recopie les mêmes factures");
    expect(v.indexOf(ENTETE_BLOC_MEMOIRE)).toBeGreaterThan(v.indexOf("<objets>"));
    expect(JSON.stringify(d.appels[0].contexte)).not.toContain(ENTETE_BLOC_MEMOIRE);
    expect(roleEcritureCasConcret.consigne).toBe(CONSIGNE_ECRITURE);
  });
  it("la mémoire reçoit les phrases imposées du format ET celles du cas", async () => {
    const h = hook(memoireDe(AUTRES));
    await ecrireFiche(entree(), double([base], { memoireCommune: h }));
    const t = h.tolerees[0];
    for (const p of PHRASES_FIXES_CAS_CONCRET) expect(t).toContain(p);
    expect(t).toContain(cas.promesse);
    expect(t).toContain(cas.resteHumain);
  });
  it("la reprise (« Réessayer ») injecte aussi le bloc, dans la variable", async () => {
    const d = double([base], { memoireCommune: hook(memoireDe(["Chaque lundi matin votre équipe recopie les mêmes factures dans trois tableaux différents"])), relire: async () => null });
    await ecrireFiche(entree({ reprise: 1 }), d);
    expect(d.appels[0].variable).toContain(ENTETE_BLOC_MEMOIRE);
  });
});

describe("phrases IMPOSÉES du format : ni fausse alerte ni ligne « à ne pas redire »", () => {
  it("les phrases fixes sont bien celles que le gabarit écrit (jamais deux versions qui divergent)", () => {
    const tout = texteDuCorps(base).toLowerCase();
    const trouvees = PHRASES_FIXES_CAS_CONCRET.filter((p) => tout.includes(p.toLowerCase().replace(/\s*\?$/, "").replace(/\.$/, "")));
    expect(trouvees.length).toBeGreaterThanOrEqual(2);
  });
  it("des scripts DIFFÉRENTS finissant par la même question imposée : aucune alerte, rien de ce genre dans le bloc", async () => {
    // plusieurs scripts gardés qui finissent tous par la même question et ouvrent la méthode par la même bascule
    expect(new Set(AUTRES.map((t) => t.split(/(?<=[.?])\s+/).at(-1))).size).toBe(1);
    const m = memoireDe(AUTRES);
    expect(m.bloc.toLowerCase()).not.toContain("tâche pourrait tourner toute seule");
    expect(m.bloc.toLowerCase()).not.toContain("la méthode, étape par étape");
    expect(m.bloc.toLowerCase()).not.toContain("votre entreprise, quelle tâche");
    const d = double([base], { memoireCommune: hook(m) });
    const r = await ecrireFiche(entree(), d);
    if (!r.ok) throw new Error("écriture refusée");
    expect(r.notes.some((n) => /Ressemble à un script récent/.test(n))).toBe(false);
    expect(d.appels).toHaveLength(1);
  });
});

describe("(c) ressemblance : ALERTE seulement, jamais de relance ni de refus", () => {
  it("une vraie reprise d'un script récent : note d'alerte, UN seul appel, la fiche est rendue", async () => {
    const copie = texteDuCorps(base).replace(/ [^ ]+$/, "");
    const d = double([base], { memoireCommune: hook(memoireDe([copie, ...AUTRES])) });
    const r = await ecrireFiche(entree(), d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(d.appels).toHaveLength(1);
    expect(r.relance).toBe(false);
    expect(r.notes.filter((n) => /Ressemble à un script récent/.test(n))).toHaveLength(1);
    expect(validerFicheEcrans(r.fiche, { cas, texteScript: texteDuCorps(r.fiche) }).ok).toBe(true);
  });
  it("une réponse SIMULÉE n'est ni mesurée ni enregistrée", async () => {
    const h = hook(memoireDe([texteDuCorps(base)]));
    const r = await ecrireFiche(entree(), double([base], { memoireCommune: h }, true));
    expect(r.ok && r.notes.some((n) => /Ressemble/.test(n))).toBe(false);
    expect(h.gardes).toEqual([]);
  });
  it("un script de Will (origine « will ») n'est jamais contrôlé ni lu", async () => {
    const copie = texteDuCorps(base);
    const d = double([base], { memoireCommune: hook(memoireDe([copie], { origine: "will" })) });
    const r = await ecrireFiche(entree(), d);
    expect(r.ok && r.notes.some((n) => /Ressemble/.test(n))).toBe(false);
    expect(d.appels[0].variable).not.toContain(ENTETE_BLOC_MEMOIRE);
  });
});

describe("(a) enregistrement du script accepté", () => {
  it("le texte dit du corps est enregistré une fois, anonymisé à la lecture seulement", async () => {
    const h = hook(null);
    const r = await ecrireFiche(entree(), double([base], { memoireCommune: h }));
    expect(r.ok).toBe(true);
    expect(h.gardes).toEqual([texteDuCorps(base)]);
  });
  it("un refus d'écriture n'enregistre rien", async () => {
    const h = hook(null);
    const r = await ecrireFiche(entree(), double(["pas du JSON", "toujours pas"], { memoireCommune: h }));
    expect(r.ok).toBe(false);
    expect(h.gardes).toEqual([]);
  });
});

describe("(f) tout échec de la mémoire est silencieux", () => {
  it("préparation en panne : l'écriture se fait comme avant, prompt identique", async () => {
    const a = double([base]);
    await ecrireFiche(entree(), a);
    const d = double([base], { memoireCommune: hook(null, { echecPreparer: true }) });
    const r = await ecrireFiche(entree(), d);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(d.appels)).toBe(JSON.stringify(a.appels));
  });
  it("enregistrement en panne : la fiche est rendue quand même", async () => {
    const r = await ecrireFiche(entree(), double([base], { memoireCommune: hook(null, { echecEnregistrer: true }) }));
    expect(r.ok).toBe(true);
  });
});

describe("le bloc ne change pas entre deux passages (appel détaché, pas de double paiement)", () => {
  it("figerMemoireCommune garde le premier bloc au journal et le rend ensuite, même si la mémoire a grossi", async () => {
    let n = 0;
    const source: MemoireCommuneEcriture = { preparer: async () => ({ bloc: `- « bloc numéro ${++n} »`, anciens: [`ancien ${n}`] }), enregistrer: async () => undefined };
    const journal: { memoireCommune?: string } = {};
    let ecritures = 0;
    const figee = figerMemoireCommune(source, journal, async () => void ecritures++);
    const a = await figee.preparer([]);
    const b = await figee.preparer([]);
    expect(a?.bloc).toBe("- « bloc numéro 1 »");
    expect(b?.bloc).toBe("- « bloc numéro 1 »");
    expect(journal.memoireCommune).toBe("- « bloc numéro 1 »");
    expect(ecritures).toBe(1);
  });
  it("mémoire coupée : le premier résultat vide est figé (\"\") et rendu tel quel ensuite", async () => {
    const journal: { memoireCommune?: string } = {};
    let ecritures = 0;
    const figee = figerMemoireCommune({ preparer: async () => null, enregistrer: async () => undefined }, journal, async () => void ecritures++);
    expect(await figee.preparer([])).toBeNull();
    expect(journal.memoireCommune).toBe("");
    expect(ecritures).toBe(1);
    expect((await figee.preparer([]))?.bloc).toBe("");
    expect(ecritures).toBe(1);
  });
  it("non-régression : `preparer` rend null puis un bloc => UN SEUL lancement et UNE réservation (pas de double paiement)", async () => {
    const reponses: (MemoireCentrale | null)[] = [null, { bloc: "- « un script récent »", anciens: ["un script récent"] }];
    let n = 0;
    const source: MemoireCommuneEcriture = { preparer: async () => reponses[Math.min(n++, 1)], enregistrer: async () => undefined };
    const journal: { memoireCommune?: string; appels?: Record<string, AppelSuivi> } = {};
    const stock = new Map<string, ReponseAppelEcriture>();
    let lancements = 0;
    let reservations = 0;
    const brut = double([base], {
      budget: { reserver: async () => (reservations++, { ok: true }) },
      detache: { lancer: async (cle, faire) => { lancements++; stock.set(cle, await faire()); }, lire: async (cle) => stock.get(cle) ?? null },
    });
    const options = { journal, garder: async () => undefined, horloge: () => 0, libelle: "L'écriture", attente: () => new Error("attente"), expire: (p: string) => new Error(p) };
    const passage = () => {
      const outils = ecritureDetachee({ ...brut, memoireCommune: figerMemoireCommune(source, journal, async () => undefined) }, options);
      return ecrireFiche(entree(), outils);
    };
    await passage().catch(() => undefined);
    const r = await passage();
    expect(r.ok).toBe(true);
    expect(lancements).toBe(1);
    expect(reservations).toBe(1);
    expect(brut.appels).toHaveLength(1);
    expect(brut.appels[0].variable).not.toContain(ENTETE_BLOC_MEMOIRE);
  });
  it("les appels détachés gardent l'outil de mémoire", () => {
    const h = hook(null);
    const detachee = ecritureDetachee({ ...double([base]), memoireCommune: h, detache: { lancer: async () => undefined, lire: async () => null } }, { journal: {}, garder: async () => undefined, horloge: () => 0, libelle: "L'écriture", attente: () => new Error("a"), expire: () => new Error("e") });
    expect(detachee.memoireCommune).toBe(h);
  });
});

describe("sanity : le mot « anonymiser » reste branché", () => {
  it("l'anonymisation de la mémoire ne casse pas un texte sans nom", () => {
    expect(anonymiserPourMemoire("Le devis part ce soir.", [])).toContain("devis");
  });
});
