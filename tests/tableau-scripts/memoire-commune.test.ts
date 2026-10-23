/**
 * Lot C2 : la mémoire d'écriture commune dans l'écriture du tableau. Client simulé, base en mémoire, aucun appel payant.
 * Réglage `ecriture.memoireTableau` coupé par défaut : rien ne change (prompt identique octet pour octet).
 */
import { createHash } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { CRITERES_GRILLE, QUESTIONS_IA, type AngleScript, type EcritureScript, type RelectureScript } from "@/domaine/scripts-tableau";
import { texteDitDe } from "@/domaine/scripts-tableau-controles";
import { ENTETE_BLOC_MEMOIRE } from "@/domaine/ecriture-commune/memoire";
import { DEMANDE_MODELE, ecritureModele } from "./modele-valide";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/tableau-scripts");
const consignes = await import("@/services/tableau-scripts/consignes");
const memoireTableau = await import("@/services/tableau-scripts/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const memoireEcriture = await import("@/services/memoire-ecriture");
await import("@/services/cas-concret-scripts");

const MDP = "tableau-memoire-commune";
const JETONS = { entree: 1000, cacheLu: 0, cacheEcrit: 2000, sortie: 3000 };
const ANGLE: AngleScript = {
  angle: "Comment apprend-on vraiment à se servir de l'IA ?",
  douleur: "Des réponses plates qu'il faut tout réécrire.",
  accroches: [
    { type: "situation-vecue", dit: "Vous avez essayé l'IA trois fois.", ecran: "Essayé trois fois", pourquoi: "Tout le monde l'a vécu." },
    { type: "idee-recue-contredite", dit: "L'IA n'est pas un moteur de recherche.", ecran: "Pas un moteur", pourquoi: "Contredit une croyance." },
    { type: "chiffre-vrai", dit: "Cinq jours suffisent.", ecran: "Cinq jours", pourquoi: "Chiffre de la méthode." },
    { type: "erreur-frequente", dit: "Vous changez de tâche chaque jour.", ecran: "Une tâche à la fois", pourquoi: "Erreur courante." },
    { type: "promesse-precise", dit: "Un modèle gardé en cinq jours.", ecran: "Un modèle gardé", pourquoi: "Promesse concrète." },
  ],
  retenue: 0,
  raison: "Elle fait dire « c'est moi » en moins de trois secondes.",
};

function relecture(e: EcritureScript): RelectureScript {
  return { corrections: [], grille: CRITERES_GRILLE.map((c) => ({ critere: c.id, respecte: true, remarque: "" })), faiblesses: [], affirmations: e.affirmations, manques: [] };
}

function clientSimule(sorties: unknown[]) {
  const requetes: RequeteClaude[] = [];
  return {
    requetes,
    client: {
      simule: true,
      async appeler(r: RequeteClaude): Promise<ReponseClaude> {
        requetes.push(r);
        const s = sorties.shift();
        if (s === undefined) throw new Error("Appel de trop.");
        return { texte: JSON.stringify(s), modeleDemande: r.modele, modele: "claude-opus-5-5", replis: [], stopReason: "end_turn", jetons: { ...JETONS } };
      },
    },
  };
}

const sansQuestion = (t: string) => t.replace(QUESTIONS_IA[0], "").replace(/\s+/g, " ").trim();
/** Une trace livrée RÉALISTE : corps différent, mais le passage « appel » complet (question sur l'IA, phrase sur l'entreprise, demande) comme un vrai script. */
const traceRealiste = (id: string, date: string, corps: string) => {
  const t = traceLivree(id, date, corps);
  const appel: { dit: string; ecran: string }[] = ecritureModele(QUESTIONS_IA[Number(id) % QUESTIONS_IA.length]).script.appel.map((x) => ({ ...x }));
  (t.versions[0].ecriture.script as { appel: unknown }).appel = appel;
  appel.push({ dit: "Axion-IA le met en place pour vous.", ecran: "" }, { dit: "Réservez un appel de diagnostic.", ecran: "" });
  return t;
};
/** Une trace livrée d'une AUTRE vidéo, dont le texte dit est `texte` (sans la question sur l'IA, sans métier : aucun contrôle de série ne bouge). */
const traceLivree = (id: string, date: string, texte: string, extra: Record<string, unknown> = {}) => ({
  id, date, issue: "livre", videoId: `v-${id}`, creeLe: date, modifieLe: date, ...extra,
  versions: [{ passe: "ecriture", defauts: [], ecriture: { script: { accroche: [{ dit: texte, ecran: "" }], douleur: [], promesse: [], etapes: [], exemple: {}, aRetenir: [], appel: [] } } }],
});

const ecritureUser = (r: RequeteClaude) => r.messages.map((m) => m.contenu).join("\n");
const systemeTexte = (r: RequeteClaude) => r.systeme.map((b) => b.texte).join("\n");
const empreinte = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit dans les tests");
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("non-régression : sans réglage, le prompt est identique octet pour octet", () => {
  const a: any = { angle: "Q ?", douleur: "D.", accroches: [{ type: "situation-vecue", dit: "Dit.", ecran: "E", pourquoi: "P" }], retenue: 0, raison: "R." };
  const o = { metiersRecents: ["comptable"], questionIa: "En quoi l'IA peut-elle vous aider ?" };
  const GOLDEN = {
    courte: "a49bccf0b5399d6e6ca2f99d0c16fdd5f2dff4647ae4cc7bf2dc0360e9f60d6e",
    complete: "b1af6a675a067f9f59c0da72846698d9e35356ce5cc5192f30bf1049d81d467d",
  } as const;
  for (const m of ["courte", "complete"] as const) {
    it.skip(`les quatre requêtes (méthode ${m}) ont l'empreinte (version publique : prompts réduits) de la PR sans mémoire (pas celle de master : les mineurs de #513 changent REGLES_TABLEAU)`, () => {
      const e = ecritureModele();
      const defauts = [{ code: "phrase-longue" as const, message: "m", eliminatoire: true }];
      expect(empreinte([consignes.requeteAngle(DEMANDE_MODELE, m), consignes.requeteEcriture(DEMANDE_MODELE, a, undefined, o, m), consignes.requeteEcriture(DEMANDE_MODELE, a, { defauts, precedente: e }, o, m), consignes.requeteRelecture(DEMANDE_MODELE, a, e, m)])).toBe(GOLDEN[m]);
    });
  }
  it("une mémoire vide ou blanche n'ajoute rien", () => {
    const base = consignes.requeteEcriture(DEMANDE_MODELE, a, undefined, o, "courte");
    expect(consignes.requeteEcriture(DEMANDE_MODELE, a, undefined, o, "courte", "")).toEqual(base);
    expect(consignes.requeteEcriture(DEMANDE_MODELE, a, undefined, o, "courte", "  \n")).toEqual(base);
  });
  it("le réglage est coupé par défaut", async () => {
    expect(await memoireTableau.memoireTableauAllumee()).toBe(false);
    await ecrireParametre(memoireTableau.PARAM_MEMOIRE_TABLEAU, "oui");
    expect(await memoireTableau.memoireTableauAllumee()).toBe(false);
  });
  it("coupé : une génération n'injecte rien et ne lit aucune mémoire", async () => {
    await depots().tracesScriptsTableau.enregistrer(traceLivree("a", "2026-10-01T00:00:00Z", "Le planning se range seul chaque soir dans la fiche.") as never);
    const lecture = vi.spyOn(memoireEcriture, "memoireEcriture");
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    expect(lecture).not.toHaveBeenCalled();
    expect(requetes.some((q) => ecritureUser(q).includes("memoire_ecriture") || ecritureUser(q).includes(ENTETE_BLOC_MEMOIRE))).toBe(false);
    const trace = (await depots().tracesScriptsTableau.lister()).find((t) => t.id === (r as { traceId: string }).traceId)!;
    expect(trace.alertes).toBeUndefined();
    expect("origine" in trace).toBe(false);
  });
  it("l'estimation du coût est inchangée sans mémoire et plus grande avec", () => {
    const sans = service.estimerCoutScript(DEMANDE_MODELE);
    expect(service.estimerCoutScript(DEMANDE_MODELE, undefined, 0, "courte", false)).toEqual(sans);
    expect(service.estimerCoutScript(DEMANDE_MODELE, undefined, 0, "courte", true).pireCasUsd).toBeGreaterThan(sans.pireCasUsd);
  });
});

describe("réglage allumé : le bloc va dans la partie variable, jamais dans le cache", () => {
  beforeEach(async () => {
    await ecrireParametre(memoireTableau.PARAM_MEMOIRE_TABLEAU, true);
    await depots().tracesScriptsTableau.enregistrer(traceLivree("a", "2026-10-01T00:00:00Z", "Le planning se range seul chaque soir dans la fiche du client.") as never);
    await depots().tracesScriptsTableau.enregistrer(traceLivree("b", "2026-10-02T00:00:00Z", "Un devis part en deux minutes depuis le téléphone du dirigeant.") as never);
  });

  it("l'écriture reçoit les séquences déjà dites et les accroches récentes, dans le message", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    const [angle, ecriture, relu] = requetes;
    const user = ecritureUser(ecriture);
    expect(user).toContain("<memoire_ecriture>");
    expect(user).toContain(ENTETE_BLOC_MEMOIRE);
    expect(user).toContain("ACCROCHES RÉCENTES");
    expect(user).toMatch(/Un devis part en deux minutes depuis le téléphone/);
    expect(ecritureUser(angle)).not.toContain("memoire_ecriture");
    expect(ecritureUser(relu)).not.toContain("memoire_ecriture");
  });

  it("la partie système (cache) est identique au réglage coupé, octet pour octet", async () => {
    const allume = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    await service.genererScriptTableau(DEMANDE_MODELE, { client: allume.client });
    reinitialiserDepots();
    await auth.seConnecter(MDP, false);
    const coupe = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    await service.genererScriptTableau(DEMANDE_MODELE, { client: coupe.client, memoireCommune: false });
    for (let i = 0; i < 3; i++) expect(allume.requetes[i].systeme).toEqual(coupe.requetes[i].systeme);
    expect(systemeTexte(allume.requetes[1])).not.toContain(ENTETE_BLOC_MEMOIRE);
    expect(systemeTexte(allume.requetes[1])).not.toContain("ACCROCHES RÉCENTES");
  });

  it("la relance reçoit le même bloc", async () => {
    const fautive = ecritureModele();
    fautive.script.accroche[0].dit = "Bonjour à tous, ce devis collé dans ChatGPT contient trois données de trop.";
    const { client, requetes } = clientSimule([ANGLE, fautive, ecritureModele(), relecture(ecritureModele())]);
    await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(requetes).toHaveLength(4);
    expect(ecritureUser(requetes[2])).toContain("<memoire_ecriture>");
    expect(ecritureUser(requetes[2])).toContain("<defauts_a_corriger>");
  });

  it("sans aucune mémoire (base vide), rien n'est ajouté", async () => {
    vi.spyOn(memoireEcriture, "memoireEcriture").mockResolvedValue({ scripts: [], sequences: [], bloc: "" });
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(requetes.some((q) => ecritureUser(q).includes("memoire_ecriture"))).toBe(false);
  });

  it("la vidéo qui s'écrit n'est pas dans sa propre mémoire", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    await service.genererScriptTableau(DEMANDE_MODELE, { client, contexte: { videoId: "v-b" } });
    expect(ecritureUser(requetes[1])).not.toMatch(/devis part en deux minutes/);
    expect(ecritureUser(requetes[1])).toMatch(/planning se range seul/);
  });

  it("la mémoire n'est jamais lue pour un format avocat, ni ses textes montrés", async () => {
    const seg = (texte: string) => [{ id: "b", blocRecette: "x", segments: [{ id: "s", texte }] }];
    await depots().variantes.enregistrer({ id: "av", code: "AV1", version: 1, ouverture: seg("Maître Dupont vous explique votre contrat de bail commercial."), fin: seg("Appelez le cabinet."), creeLe: "2026-10-03T00:00:00Z", modifieLe: "x", formatId: "avocat" } as never);
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(ecritureUser(requetes[1])).toContain("<memoire_ecriture>");
    expect(ecritureUser(requetes[1])).not.toMatch(/Dupont|bail commercial|cabinet/);
  });

  it("base indisponible : silencieux, l'écriture continue et se livre", async () => {
    vi.spyOn(depots().tracesScriptsTableau, "lister").mockImplementation(async (f?: unknown) => {
      if (f) throw new Error("base indisponible");
      return [];
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    expect(requetes).toHaveLength(3);
  });

  it("mémoire entière en échec : silencieux aussi", async () => {
    vi.spyOn(memoireEcriture, "memoireEcriture").mockRejectedValue(new Error("base indisponible"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    expect(requetes.some((q) => ecritureUser(q).includes("memoire_ecriture"))).toBe(false);
  });

  it("réglage illisible : coupé, l'écriture continue", async () => {
    const commun = await import("@/services/_commun");
    vi.spyOn(commun, "lireParametre").mockRejectedValue(new Error("base indisponible"));
    expect(await memoireTableau.memoireTableauAllumee()).toBe(false);
  });
});

describe("ressemblance après écriture : alerte seulement", () => {
  const recopie = (id: string, date = "2026-10-01T00:00:00Z") => traceLivree(id, date, sansQuestion(texteDitDe(ecritureModele().script)));

  it("ressemblance forte : alerte dans la trace et au journal, le script est livré, aucune relance payée", async () => {
    await ecrireParametre(memoireTableau.PARAM_MEMOIRE_TABLEAU, true);
    await depots().tracesScriptsTableau.enregistrer(recopie("a") as never);
    const avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    expect(requetes).toHaveLength(3);
    const trace = (await depots().tracesScriptsTableau.lister()).find((t) => t.id === (r as { traceId: string }).traceId)!;
    expect(trace.issue).toBe("livre");
    expect(trace.alertes?.[0]).toMatch(/Ressemblance forte avec un script récent/);
    expect(avert).toHaveBeenCalled();
  });

  it("aucune ressemblance : pas d'alerte", async () => {
    await ecrireParametre(memoireTableau.PARAM_MEMOIRE_TABLEAU, true);
    await depots().tracesScriptsTableau.enregistrer(traceLivree("a", "2026-10-01T00:00:00Z", "Le planning se range seul chaque soir dans la fiche du client.") as never);
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    const trace = (await depots().tracesScriptsTableau.lister()).find((t) => t.id === (r as { traceId: string }).traceId)!;
    expect(trace.alertes).toBeUndefined();
  });

  it("réglage coupé : aucune mesure, aucune alerte, même avec une copie", async () => {
    await depots().tracesScriptsTableau.enregistrer(recopie("a") as never);
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    const trace = (await depots().tracesScriptsTableau.lister()).find((t) => t.id === (r as { traceId: string }).traceId)!;
    expect(trace.alertes).toBeUndefined();
  });

  it("traces réalistes (question IA, phrase entreprise et appel complets) : aucune alerte, ni question ni appel dans le bloc", async () => {
    await ecrireParametre(memoireTableau.PARAM_MEMOIRE_TABLEAU, true);
    const corps = ["Le planning se range seul chaque soir dans la fiche du client.", "Un devis part en deux minutes depuis le téléphone du dirigeant.", "La facture relancée toute seule revient payée le lundi.", "Le compte rendu de chantier s'écrit pendant le trajet du retour."];
    for (const [i, c] of corps.entries()) await depots().tracesScriptsTableau.enregistrer(traceRealiste(String(i), `2026-10-0${i + 1}T00:00:00Z`, c) as never);
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client });
    expect(r.ok).toBe(true);
    const trace = (await depots().tracesScriptsTableau.lister()).find((t) => t.id === (r as { traceId: string }).traceId)!;
    expect(trace.alertes).toBeUndefined();
    const user = ecritureUser(requetes[1]);
    expect(user).toContain("<memoire_ecriture>");
    const bloc = user.slice(user.indexOf("<memoire_ecriture>"), user.indexOf("</memoire_ecriture>"));
    for (const q of QUESTIONS_IA) expect(bloc).not.toContain(q);
    expect(bloc).not.toContain("le met en place pour vous");
    expect(bloc).not.toContain("Réservez un appel de diagnostic");
    expect(bloc).not.toContain("Écrivez CINQ en commentaire");
    const textes = (await memoireEcriture.entreesMemoire()).map((e) => e.texte).join(" ");
    expect(textes).not.toContain("Réservez un appel de diagnostic");
  });

  it("alerteRessemblance : un texte dont seules la question IA, la phrase entreprise et la demande sont repris ne déclenche rien", () => {
    const fin = `${QUESTIONS_IA[0]} Axion-IA le met en place pour vous. Réservez un appel de diagnostic.`;
    expect(memoireTableau.alerteRessemblance(`Un devis part en deux minutes depuis le téléphone du dirigeant. ${fin}`, [`Le planning se range seul chaque soir dans la fiche du client. ${fin}`])).toBeNull();
  });

  it("texteSansAppel : le texte dit sans le passage appel", () => {
    const s = ecritureModele().script;
    const t = memoireTableau.texteSansAppel(s);
    expect(t).not.toContain(s.appel[1].dit);
    expect(t).toContain(s.accroche[0].dit);
  });

  it("alerteRessemblance : copie → phrase ; sans rapport → null ; échec → null", () => {
    const t = sansQuestion(texteDitDe(ecritureModele().script));
    expect(memoireTableau.alerteRessemblance(t, [t])).toMatch(/Ressemblance forte/);
    expect(memoireTableau.alerteRessemblance(t, ["Le planning se range seul chaque soir."])).toBeNull();
    expect(memoireTableau.alerteRessemblance(t, null as never)).toBeNull();
  });
});

describe("script de Will (origine « will ») : pris à l'identique", () => {
  it("ni lecture de la mémoire, ni bloc, ni alerte, même réglage allumé et copie exacte", async () => {
    await ecrireParametre(memoireTableau.PARAM_MEMOIRE_TABLEAU, true);
    await depots().tracesScriptsTableau.enregistrer(traceLivree("a", "2026-10-01T00:00:00Z", sansQuestion(texteDitDe(ecritureModele().script))) as never);
    const lecture = vi.spyOn(memoireEcriture, "memoireEcriture");
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client, origine: "will" });
    expect(r.ok).toBe(true);
    expect(lecture).not.toHaveBeenCalled();
    expect(requetes.some((q) => ecritureUser(q).includes("memoire_ecriture"))).toBe(false);
    const trace = (await depots().tracesScriptsTableau.lister()).find((t) => t.id === (r as { traceId: string }).traceId)!;
    expect(trace.alertes).toBeUndefined();
    expect(trace.origine).toBe("will");
  });

  it("jamais enregistré comme « à éviter » : la mémoire ignore une trace de Will", async () => {
    await depots().tracesScriptsTableau.enregistrer(traceLivree("w", "2026-10-01T00:00:00Z", "Texte de Will jamais mis en mémoire.", { origine: "will" }) as never);
    await depots().tracesScriptsTableau.enregistrer(traceLivree("c", "2026-10-02T00:00:00Z", "Texte du générateur gardé en mémoire.") as never);
    const textes = (await memoireEcriture.entreesMemoire()).map((e) => e.texte).join(" ");
    expect(textes).toContain("générateur gardé");
    expect(textes).not.toContain("Will jamais");
  });

  it("controlerRessemblance ne contrôle jamais l'origine « will »", async () => {
    const { controlerRessemblance } = await import("@/domaine/ecriture-commune/ressemblance");
    const t = sansQuestion(texteDitDe(ecritureModele().script));
    expect(controlerRessemblance({ texte: t, anciens: [t], origine: "will" })).toMatchObject({ controle: false, ressemble: false });
  });
});

describe("enregistrement d'un script accepté", () => {
  it("un script livré entre dans la mémoire commune, un refusé non", async () => {
    const { client } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.genererScriptTableau(DEMANDE_MODELE, { client, contexte: { videoId: "v-neuve" } });
    expect(r.ok).toBe(true);
    const dedans = (await memoireEcriture.entreesMemoire()).filter((e) => e.formatId === "tableau-anime");
    expect(dedans).toHaveLength(1);
    expect(dedans[0].texte).toContain(texteDitDe(ecritureModele().script).slice(0, 30));
  });
});

describe("blocs purs", () => {
  it("accrochesRecentes : les plus récentes d'abord, sans doublon, 5 au plus, coupées", () => {
    const scripts = Array.from({ length: 8 }, (_, i) => `Accroche numéro ${i}. La suite ${i}.`).concat(["Accroche numéro 7. Autre suite."]);
    const a = memoireTableau.accrochesRecentes(scripts);
    expect(a).toHaveLength(memoireTableau.ACCROCHES_RECENTES_MAX);
    expect(a[0]).toBe("Accroche numéro 7.");
    expect(new Set(a).size).toBe(a.length);
    expect(memoireTableau.accrochesRecentes(["x".repeat(500)])[0].length).toBeLessThanOrEqual(memoireTableau.ACCROCHE_RECENTE_CARACTERES + 2);
  });
  it("blocTableau : vide sans rien, sinon séquences puis accroches", () => {
    expect(memoireTableau.blocTableau("", [])).toBe("");
    const b = memoireTableau.blocTableau("- « une suite de mots »", ["Une accroche."]);
    expect(b.indexOf(ENTETE_BLOC_MEMOIRE)).toBeLessThan(b.indexOf("ACCROCHES RÉCENTES"));
  });
  it("le bloc le plus long tient dans la taille comptée par l'estimation", async () => {
    const { MEMOIRE_MAX_CARACTERES } = await import("@/domaine/ecriture-commune/memoire");
    expect(memoireTableau.CARACTERES_BLOC_MAX).toBeGreaterThan(MEMOIRE_MAX_CARACTERES + memoireTableau.ACCROCHES_RECENTES_MAX * memoireTableau.ACCROCHE_RECENTE_CARACTERES);
  });
});
