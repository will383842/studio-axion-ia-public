/**
 * T-EXT-30 : Claude relié au tutoriel d'outil par le chemin gardé de l'argent, ÉTEINT par défaut.
 * Aucun appel réel : `executerRolePourVideo` est remplacé par un double ; voix, rendu et stockage sont des doubles.
 */
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ErreurClaude, type RequeteClaude } from "@/fournisseurs/claude/client";
import { creerMoteurTutorielOutil, validerScriptTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { Travail } from "@/domaine/types";
import { appelClaudeTutoriel, appelLecteurTutoriel, claudeTutorielActif, ETAPE_LECTURE_RETOUCHE_TUTORIEL, lecteurClaudeTutorielActif, PARAM_LECTEUR_CLAUDE_RETOUCHE, entreeDepuisRequete, ETAPE_REGARD_TUTORIEL, IMAGES_REGARD_TUTORIEL, PARAM_REGARD_TUTORIEL, detailPlafondTutorielUsd, plafondPropreTutoriel, plafondTutorielParDefautUsd, regardTutorielActif, roleDepuisRequete } from "@/services/tutoriel-claude";
import { coutPireRegardUsd, IMAGES_REGARD_MAX } from "@/briques/regardeur";
import { construireRequetePlan, MAX_JETONS_PLAN_SCENES } from "@/briques/plan-scenes/generateur";
import type { MotMinute } from "@/briques/plan-scenes/schema";
import { formatDuRatio } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { pireCasRequete } from "@/generateur/roles/types";
import { ROLES_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { commandeTutoriel, outilsDoubles, SCRIPT, une, type Journal } from "./doubles";

const reglage: { valeur: unknown } = { valeur: undefined };
vi.mock("@/services/_commun", async (importOriginal) => ({ ...(await importOriginal<object>()), lireParametre: async (_id: string, defaut: unknown) => (reglage.valeur === undefined ? defaut : reglage.valeur) }));
const appelsReels: unknown[] = [];
const dernierDouble: { fn: ((...a: unknown[]) => Promise<unknown>) | null } = { fn: null };
vi.mock("@/services/depense-claude-video", () => ({
  executerRolePourVideo: async (...a: unknown[]) => {
    appelsReels.push(a);
    throw new Error("appel réel interdit dans les tests");
  },
}));
vi.mock("@/services/tableau-outils", () => ({
  TARIF_VOIX_CENTIMES_PAR_CARACTERE: 0,
  branchementsReels: async () => ({ voix: {}, montage: { rendu: () => ({}), signer: async () => ({ lectures: {}, depots: {} }) }, env: "test" }),
}));

const T0 = Date.UTC(2026, 10, 8, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
const REQ_PLAN: RequeteClaude = { modele: "claude-opus-5-5", maxTokens: 10, effort: "high", systeme: [{ texte: "consigne" }], messages: [{ role: "user", contenu: "demande" }], json: true };
/** Requête SANS `json` (celle d'un texte libre) : le service la reconnaît comme « script ». Construite ici : l'ancien écrivain est retiré (T-EXT-55). */
const REQ_SANS_JSON: RequeteClaude = { modele: "claude-opus-5-5", maxTokens: 10, effort: "medium", systeme: [{ texte: "consigne" }], messages: [{ role: "user", contenu: "une idée" }] };
const OK = { ok: true as const, simule: false, texte: "{}", modele: "claude-opus-5-5", coutUsd: 0, jetons: { entree: 1, cacheLu: 0, cacheEcrit: 0, sortie: 1 }, stopReason: "end_turn" };

beforeAll(async () => {
  await import("@/services/tutoriel-branchements");
});

beforeEach(() => {
  reglage.valeur = undefined;
  appelsReels.length = 0;
  dernierDouble.fn = null;
});

describe("T-EXT-30 : éteint par défaut", () => {
  it.each([undefined, false, "true", 1])("réglage %s : Claude reste « pas encore relié », rien n'est appelé", async (v) => {
    reglage.valeur = v;
    expect(await claudeTutorielActif()).toBe(false);
    const { servicesTutoriel } = await import("@/moteurs/montage-tutoriel-outil");
    const o = (await servicesTutoriel().outils!(commandeTutoriel(), "t1")) as OutilsTutoriel;
    await expect(o.claude(REQ_PLAN)).rejects.toThrow("Claude n'est pas encore relié au tutoriel d'outil.");
    await expect(o.claude(REQ_PLAN)).rejects.toBeInstanceOf(ErreurClaude);
    expect(appelsReels).toHaveLength(0);
  });

  it("réglage exactement true : le raccord rend l'appel gardé (le double d'argent seul est joignable)", async () => {
    reglage.valeur = true;
    expect(await claudeTutorielActif()).toBe(true);
    const { servicesTutoriel } = await import("@/moteurs/montage-tutoriel-outil");
    const o = (await servicesTutoriel().outils!(commandeTutoriel(), "t1")) as OutilsTutoriel;
    // Le module d'argent est remplacé et lève : preuve que le chemin passe par lui, jamais par un appel direct.
    await expect(o.claude(REQ_PLAN)).rejects.toThrow("appel réel interdit");
    expect(appelsReels).toHaveLength(1);
  });
});

describe("T-EXT-30 : appel gardé", () => {
  it.each(["usine", undefined] as const)("origine %s : transmise telle quelle, étape et plafond propres", async (origine) => {
    const recu: unknown[] = [];
    const executer = (async (...a: unknown[]) => {
      recu.push(a);
      return OK;
    }) as never;
    const r = await appelClaudeTutoriel("v-to", origine, { executer, plafondUsd: () => 1 })(REQ_PLAN);
    expect(r.texte).toBe("{}");
    expect(r.stopReason).toBe("end_turn");
    expect(recu).toHaveLength(1);
    const [videoId, , entree, options] = recu[0] as [string, unknown, { variable: string }, { etape: string; origine?: string; plafondPropre: { id: string; prefixeEtape: string; defautUsd: number } }];
    expect(videoId).toBe("v-to");
    expect(options.origine).toBe(origine);
    expect(options.etape.startsWith("Tutoriel ·")).toBe(true);
    expect(options.plafondPropre.id).toBe("tuto");
    expect(options.plafondPropre.prefixeEtape).toBe("Tutoriel ·");
    expect(options.plafondPropre.defautUsd).toBe(1);
    expect(entree.variable).toBe("demande");
  });

  it.each(["plafond-video", "en-attente-credit", "budget-usine", "indisponible"] as const)("arrêt %s : ErreurClaude, aucun montant dans le message", async (arret) => {
    const executer = (async () => ({ ok: false, arret, message: "12 € dépassés" })) as never;
    const p = appelClaudeTutoriel("v", "usine", { executer, plafondUsd: () => 1 })(REQ_PLAN);
    await expect(p).rejects.toBeInstanceOf(ErreurClaude);
    await expect(p).rejects.not.toThrow(/\d|€|\$/);
  });

  it("simulation, texte vide ou absent : ErreurClaude (jamais un faux plan)", async () => {
    for (const r of [{ ...OK, simule: true, texte: undefined }, { ...OK, simule: true }, { ...OK, texte: "  " }, { ...OK, texte: undefined }]) {
      const executer = (async () => r) as never;
      await expect(appelClaudeTutoriel("v", "usine", { executer, plafondUsd: () => 1 })(REQ_PLAN)).rejects.toThrow("Claude n'est pas choisi pour les textes : plan simple.");
    }
  });

  it("le script (sans json) passe aussi par l'étape « Tutoriel · script »", async () => {
    let etape = "";
    const executer = (async (_v: unknown, _r: unknown, _e: unknown, o: { etape: string }) => {
      etape = o.etape;
      return OK;
    }) as never;
    await appelClaudeTutoriel("v", "usine", { executer, plafondUsd: () => 1 })(REQ_SANS_JSON);
    expect(etape).toBe("Tutoriel · script");
  });

  it("entrée : un essai simple = le texte du message ; 2e essai = réponse précédente et consigne de reprise", () => {
    expect(entreeDepuisRequete(REQ_PLAN).variable).toBe("demande");
    const e2 = entreeDepuisRequete({ ...REQ_PLAN, messages: [...REQ_PLAN.messages, { role: "assistant", contenu: "bof" }, { role: "user", contenu: "Réponse inutilisable : x." }] });
    expect(e2.variable).toContain("<reponse_precedente>bof</reponse_precedente>");
    expect(e2.variable).toContain("<consigne_reprise>Réponse inutilisable : x.</consigne_reprise>");
    expect(e2.contexte).toEqual({});
  });
});

describe("T-EXT-30 : bout en bout avec doubles", () => {
  const executerPlan = (texteDe: (n: number) => string) => {
    const entrees: string[] = [];
    const executer = (async (_v: unknown, _r: unknown, e: { variable: string }) => {
      entrees.push(e.variable);
      return { ...OK, texte: texteDe(entrees.length) };
    }) as never;
    return { executer, entrees };
  };
  async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: ReturnType<typeof commandeTutoriel>, t: Travail) {
    let resultat;
    for (let i = 0; i < 400; i++) {
      const r = await moteur.avancer(t, c, T0 + i * 1000);
      t = r.travail;
      resultat = r.resultat ?? resultat;
      if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
    }
    return { travail: t, resultat };
  }
  const outilsAvec = (j: Journal, claude: OutilsTutoriel["claude"]): OutilsTutoriel => ({ ...outilsDoubles(j), claude });
  const planJson = async (j: Journal) => (await outilsDoubles(j).claude({ ...REQ_PLAN, messages: [{ role: "user", contenu: gabarit }] })).texte;
  const gabarit = SCRIPT.split(/\s+/).map((m, i) => `${i}\t${m}\t${i * 400}\t${i * 400 + 350}`).join("\n");

  it("plan « llm » compté une fois ; ligne réelle « Plan de scènes » avec la quantité", async () => {
    const j = journalVide();
    const json = await planJson(j);
    const { executer } = executerPlan(() => json);
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsAvec(j, appelClaudeTutoriel("v-to", "usine", { executer, plafondUsd: () => 1 }))) });
    const c = commandeTutoriel();
    const { travail, resultat } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t", versionId: "ver", titre: "T", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    const l = resultat!.lignesReelles.find((x) => x.etape === "Plan de scènes");
    expect(l?.quantite).toBe(1);
  });

  it("Claude refusé : plan de repli, réserve « À vérifier · Plan de scènes », aucune ligne réelle de plan", async () => {
    const j = journalVide();
    const executer = (async () => ({ ok: false, arret: "plafond-video", message: "x" })) as never;
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsAvec(j, appelClaudeTutoriel("v-to", "usine", { executer, plafondUsd: () => 1 }))) });
    const c = commandeTutoriel();
    const { travail, resultat } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t", versionId: "ver", titre: "T", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    expect(JSON.stringify(travail)).toContain("À vérifier · Plan de scènes");
    expect(resultat!.lignesReelles.some((x) => x.etape === "Plan de scènes" || x.etape === "Script")).toBe(false);
  });

  it("1re réponse illisible : 2 appels comptés, la 2e entrée contient la réponse précédente", async () => {
    const j = journalVide();
    const json = await planJson(j);
    const { executer, entrees } = executerPlan((n) => (n === 1 ? "pas du json" : json));
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsAvec(j, appelClaudeTutoriel("v-to", "usine", { executer, plafondUsd: () => 1 }))) });
    const c = commandeTutoriel();
    const { resultat } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t", versionId: "ver", titre: "T", maintenant: T0 }));
    expect(entrees).toHaveLength(2);
    expect(entrees[1]).toContain("<reponse_precedente>pas du json</reponse_precedente>");
    expect(resultat!.lignesReelles.find((x) => x.etape === "Plan de scènes")?.quantite).toBe(2);
  });

  it("idée seule, équipe éteinte (T-EXT-55) : pause TO_SCRIPT_NON_ECRIT sans échec, 0 appel, 0 voix (la garantie « aucune voix avant validation » est reprise par equipe-integree.test.ts, équipe allumée)", async () => {
    const j = journalVide();
    const { executer, entrees } = executerPlan(() => SCRIPT);
    const moteur = creerMoteurTutorielOutil({ outils: une(outilsAvec(j, appelClaudeTutoriel("v-to", "usine", { executer, plafondUsd: () => 1 }))) });
    const c = commandeTutoriel({ script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { idee: "Un tableau de bord pour un atelier" } } } as never);
    const { travail } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t", versionId: "ver", titre: "T", maintenant: T0 }));
    expect(travail.statut).toBe("en_file");
    expect(travail.erreur).toBeUndefined();
    expect(travail.parametres?.pause).toMatchObject({ code: "TO_SCRIPT_NON_ECRIT" });
    expect(entrees).toHaveLength(0);
    expect(j.claude).toHaveLength(0);
    expect(j.voix).toHaveLength(0);
    expect(typeof validerScriptTutoriel).toBe("function");
  });
});

describe("T-EXT-30 : plafond par défaut", () => {
  it("fini, positif, multiple de 0,05, déterministe, synchrone", () => {
    const a = plafondTutorielParDefautUsd();
    expect(typeof a).toBe("number");
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeGreaterThan(0);
    expect(Math.abs(a * 20 - Math.round(a * 20))).toBeLessThan(1e-9);
    expect(plafondTutorielParDefautUsd()).toBe(a);
    console.info(`T-EXT-30 plafond par défaut calculé : ${a} USD`);
  });
});

describe("T-EXT-30 : garde de texte du service", () => {
  const texte = readFileSync("src/services/tutoriel-claude.ts", "utf8");
  it("aucun appel direct hors du chemin gardé", () => {
    for (const interdit of ["executerRole(", "appelerAvecRotation(", "envoyerMessage(", "verifierEtReserverSelonOrigine(", "verifierBudgetEtCredits("]) expect(texte).not.toContain(interdit);
  });
  it("chaque appel de l'exécuteur porte l'origine sur sa ligne", () => {
    const lignes = texte.split("\n").filter((l) => /\bexecuter\(|executerRolePourVideo\(/.test(l));
    expect(lignes.length).toBeGreaterThan(0);
    for (const l of lignes) expect(l).toContain("origine");
  });
  it("aucun nombre décimal en dur hors 0.05, aucune async dans le calcul du plafond", () => {
    const sansCommentaires = texte.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    const decimaux = (sansCommentaires.match(/\b\d+\.\d+\b/g) ?? []).filter((x) => x !== "0.05");
    expect(decimaux).toEqual([]);
    const bloc = texte.slice(texte.indexOf("export function plafondTutorielParDefautUsd"), texte.indexOf("/** Phrases rendues"));
    expect(bloc).not.toMatch(/\bawait\b|\basync\b|genererPlan\(/);
  });
});

describe("T-EXT-27b : réglage du regard, plafond propre et plafond par défaut", () => {
  const lecteur = (valeurs: Record<string, unknown>) => (async (id: string, defaut: unknown) => (id in valeurs ? valeurs[id] : defaut)) as <T>(id: string, defaut: T) => Promise<T>;

  it("clé absente, \"true\", 1, lecture en échec : éteint", async () => {
    expect(await regardTutorielActif(lecteur({ "tutoriel.claude": true }))).toBe(false);
    expect(await regardTutorielActif(lecteur({ [PARAM_REGARD_TUTORIEL]: "true", "tutoriel.claude": true }))).toBe(false);
    expect(await regardTutorielActif(lecteur({ [PARAM_REGARD_TUTORIEL]: 1, "tutoriel.claude": true }))).toBe(false);
    expect(await regardTutorielActif((async () => { throw new Error("lecture en échec"); }) as never)).toBe(false);
  });

  it("le regard seul ne suffit pas : `tutoriel.claude` doit aussi être exactement `true`", async () => {
    expect(PARAM_REGARD_TUTORIEL).toBe("tutoriel.regardeur");
    expect(await regardTutorielActif(lecteur({ [PARAM_REGARD_TUTORIEL]: true }))).toBe(false);
    expect(await regardTutorielActif(lecteur({ [PARAM_REGARD_TUTORIEL]: true, "tutoriel.claude": "true" }))).toBe(false);
    expect(await regardTutorielActif(lecteur({ [PARAM_REGARD_TUTORIEL]: true, "tutoriel.claude": true }))).toBe(true);
  });

  it("étape du regard bâtie sur le préfixe du tutoriel, 12 images au plus, jamais plus que le plafond commun", () => {
    expect(ETAPE_REGARD_TUTORIEL).toBe("Tutoriel · Regardeur");
    expect(ETAPE_REGARD_TUTORIEL.startsWith("Tutoriel ·")).toBe(true);
    expect(IMAGES_REGARD_TUTORIEL).toBe(12);
    expect(IMAGES_REGARD_TUTORIEL).toBeLessThanOrEqual(IMAGES_REGARD_MAX);
  });

  it("`plafondPropreTutoriel()` est l'objet exact passé par `appelClaudeTutoriel`", async () => {
    const recu: unknown[][] = [];
    const executer = (async (...a: unknown[]) => (recu.push(a), { ok: true, simule: false, texte: "{}", coutUsd: 0, modele: "m", stopReason: "end_turn" })) as never;
    await appelClaudeTutoriel("v", "usine", { executer })(REQ_PLAN);
    const options = recu[0][3] as { plafondPropre: unknown };
    expect(options.plafondPropre).toEqual(plafondPropreTutoriel());
    expect(plafondPropreTutoriel({ plafondUsd: () => 2 })).toEqual({ id: "tuto", parametre: "tutoriel.plafondClaudeUsd", defautUsd: 2, prefixeEtape: "Tutoriel ·" });
  });

  it("plafond par défaut = plan + chaque rôle de l'équipe × ses essais + regard (mêmes fonctions, jamais en dur), arrondi au 0,05 $ supérieur, plus grand que l'ancien", () => {
    const nbMots = 143;
    const mots: MotMinute[] = Array.from({ length: nbMots }, (_, i) => ({ texte: "exemple", debutMs: Math.round((i * 55_000) / nbMots), finMs: Math.round(((i + 1) * 55_000) / nbMots) }));
    const e = { script: mots.map((m) => m.texte).join(" "), mots, format: formatDuRatio("4:5"), facecam: false };
    const pire = (r: ReturnType<typeof construireRequetePlan>, id: "tutoriel-plan" | "tutoriel-script") => pireCasRequete(roleDepuisRequete(r, id), entreeDepuisRequete(r));
    const reponseMax = "x".repeat(MAX_JETONS_PLAN_SCENES * 3);
    const plan = pire(construireRequetePlan(e), "tutoriel-plan") + pire(construireRequetePlan(e, [{ reponse: reponseMax, motif: "ce n'est pas du JSON lisible" }]), "tutoriel-plan");
    const regard = coutPireRegardUsd(IMAGES_REGARD_TUTORIEL);
    const arrondi = (x: number) => Math.round(Math.ceil(Math.round(x * 1e6) / 1e6 / 0.05) * 5) / 100;
    const d = detailPlafondTutorielUsd();
    // Le plan et le regard : recalculés ici par les mêmes fonctions ; les rôles : exactement ceux de ROLES_TUTORIEL qui appellent Claude.
    expect(d.plan).toBeCloseTo(plan, 10);
    expect(d.regard).toBe(regard);
    expect(Object.keys(d.roles).sort()).toEqual(ROLES_TUTORIEL.filter((r) => r.essaisMax > 0).map((r) => r.id).sort());
    for (const v of Object.values(d.roles)) expect(v).toBeGreaterThan(0);
    expect(d.total).toBeCloseTo(plan + Object.values(d.roles).reduce((s, v) => s + v, 0) + regard, 10);
    expect(plafondTutorielParDefautUsd()).toBe(arrondi(d.total));
    // Plus grand que l'ancien plafond (plan + regard + un script) : les rôles de l'équipe s'ajoutent, `requeteScript` sort du calcul.
    expect(plafondTutorielParDefautUsd()).toBeGreaterThan(arrondi(plan + regard));
    console.info(`T-EXT-55 plafond par défaut : avant (sans les rôles) ${arrondi(plan + regard)} USD, après ${plafondTutorielParDefautUsd()} USD ; détail USD : plan ${d.plan.toFixed(4)}, regard ${d.regard.toFixed(4)}, rôles ${JSON.stringify(Object.fromEntries(Object.entries(d.roles).map(([k, v]) => [k, +v.toFixed(4)])))}`);
  });
});

describe("T-EXT-53b : port d'appel du lecteur de retouche (aucun appel réel)", () => {
  const lecteur = (valeurs: Record<string, unknown>) => (async (id: string, defaut: unknown) => (id in valeurs ? valeurs[id] : defaut)) as <T>(id: string, defaut: T) => Promise<T>;
  const REQ_LECTURE: RequeteClaude = { ...REQ_PLAN, maxTokens: 1500 };

  it("sans `etape` : mêmes étapes qu'avant (plan et script)", async () => {
    const vues: string[] = [];
    const executer = (async (_v: unknown, role: { id: string }, _e: unknown, o: { etape: string }) => (vues.push(`${role.id}|${o.etape}`), OK)) as never;
    await appelClaudeTutoriel("v", "usine", { executer, plafondUsd: () => 1 })(REQ_PLAN);
    await appelClaudeTutoriel("v", "usine", { executer, plafondUsd: () => 1 })(REQ_SANS_JSON);
    expect(vues).toEqual(["tutoriel-plan|Tutoriel · plan de scènes", "tutoriel-script|Tutoriel · script"]);
  });

  it("avec `etape` : l'exécuteur reçoit l'étape de lecture, le plafond `tuto` et l'origine, même pour une requête JSON", async () => {
    expect(ETAPE_LECTURE_RETOUCHE_TUTORIEL).toBe("Tutoriel · lecture de retouche");
    const recu: unknown[][] = [];
    const executer = (async (...a: unknown[]) => (recu.push(a), OK)) as never;
    await appelClaudeTutoriel("v-to", "usine", { executer, plafondUsd: () => 1, etape: ETAPE_LECTURE_RETOUCHE_TUTORIEL, id: "tutoriel-retouche" })(REQ_LECTURE);
    expect(recu).toHaveLength(1);
    const [videoId, role, , options] = recu[0] as [string, { id: string }, unknown, { etape: string; origine?: string; plafondPropre: { id: string } }];
    expect(videoId).toBe("v-to");
    expect(role.id).toBe("tutoriel-retouche");
    expect(options).toMatchObject({ etape: ETAPE_LECTURE_RETOUCHE_TUTORIEL, origine: "usine" });
    expect(options.plafondPropre.id).toBe("tuto");
  });

  it("`lecteurClaudeTutorielActif` : absent, \"true\", 1, lecture en échec → éteint ; `tutoriel.claude` éteint → éteint ; les deux à true → allumé", async () => {
    expect(PARAM_LECTEUR_CLAUDE_RETOUCHE).toBe("retoucheChat.tutorielLecteurClaude");
    expect(await lecteurClaudeTutorielActif(lecteur({ "tutoriel.claude": true }))).toBe(false);
    expect(await lecteurClaudeTutorielActif(lecteur({ [PARAM_LECTEUR_CLAUDE_RETOUCHE]: "true", "tutoriel.claude": true }))).toBe(false);
    expect(await lecteurClaudeTutorielActif(lecteur({ [PARAM_LECTEUR_CLAUDE_RETOUCHE]: 1, "tutoriel.claude": true }))).toBe(false);
    expect(await lecteurClaudeTutorielActif((async () => { throw new Error("lecture en échec"); }) as never)).toBe(false);
    expect(await lecteurClaudeTutorielActif(lecteur({ [PARAM_LECTEUR_CLAUDE_RETOUCHE]: true }))).toBe(false);
    expect(await lecteurClaudeTutorielActif(lecteur({ [PARAM_LECTEUR_CLAUDE_RETOUCHE]: true, "tutoriel.claude": "true" }))).toBe(false);
    expect(await lecteurClaudeTutorielActif(lecteur({ [PARAM_LECTEUR_CLAUDE_RETOUCHE]: true, "tutoriel.claude": true }))).toBe(true);
  });

  it("`appelLecteurTutoriel` : version introuvable ou lecture en échec → lève, l'exécuteur n'est jamais appelé", async () => {
    let appels = 0;
    const executer = (async () => (appels++, OK)) as never;
    for (const origine of [async () => null, async () => { throw new Error("base"); }]) {
      const appeler = await appelLecteurTutoriel("v", { origine, executer });
      await expect(appeler(REQ_LECTURE)).rejects.toBeInstanceOf(ErreurClaude);
      await expect(appeler(REQ_LECTURE)).rejects.not.toThrow(/\d|€|\$/);
    }
    expect(appels).toBe(0);
  });

  it("`appelLecteurTutoriel` : version trouvée → un appel gardé, étape de lecture, origine de la commande de la version", async () => {
    const recu: unknown[][] = [];
    const executer = (async (...a: unknown[]) => (recu.push(a), OK)) as never;
    const appeler = await appelLecteurTutoriel("v-to", { origine: async () => "studio", executer, plafondUsd: () => 1 });
    expect((await appeler(REQ_LECTURE)).texte).toBe("{}");
    expect(recu).toHaveLength(1);
    expect(recu[0][3]).toMatchObject({ etape: ETAPE_LECTURE_RETOUCHE_TUTORIEL, origine: "studio" });
  });

  it("aucun plafond propre : le plafond par défaut est celui d'avant (recalculé par les mêmes fonctions)", () => {
    const d = detailPlafondTutorielUsd();
    expect(Object.keys(d).sort()).toEqual(["plan", "regard", "roles", "total"]);
    expect(plafondTutorielParDefautUsd()).toBeGreaterThanOrEqual(d.total);
  });
});
