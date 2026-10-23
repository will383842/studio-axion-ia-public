/**
 * CACHE DE PROMPT RÉPARÉ (relevé du 15/10 : 188 appels, cache écrit à chaque appel, jamais lu).
 *
 *  1. Aucun `output_config.format` : un format de sortie structurée propre à chaque rôle invalide le cache (skill
 *     `claude-api`, « setting or changing a structured-output format ») ; le JSON est demandé dans la consigne, puis
 *     validé par le schéma zod du rôle, comme avant.
 *  2. SOCLE CANONIQUE : `<contexte_axion>`, `<style_will>`, `<preuves>` identiques octet pour octet pour tous les
 *     rôles, tous les formats (avocat, face caméra, tableau, chaîne courte) et tous les sujets ; ce qui dépend du
 *     format (cadre, modèles de ton, règles du tableau) part APRÈS, dans `<gagnants>` et `<recette_format>`.
 *  3. Deux points de cache : fin du socle (1 h), fin de la consigne du rôle (5 min) ; le plus long d'abord.
 */
import { describe, expect, it } from "vitest";
import type { Matiere } from "@/domaine/types";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { CADRE_TYPE_AVOCAT } from "@/donnees/generateur/domaine-axion";
import { corpsRequete, envoyerMessage } from "@/fournisseurs/claude/client";
import { coutUsd, jetonsEstimes, pireCasUsd, tarifDe } from "@/fournisseurs/claude/tarifs";
import { blocsEnCache, type DonneesGeneration, type DonneesSocle } from "@/generateur/contexte";
import { roleCourtAngle, roleCourtRelecture, roleCourtScript } from "@/generateur/chaine-courte";
import { ROLES_ECRITURE } from "@/generateur/roles";
import { construireRequete, pireCasRole, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { etapeZeroBanc } from "../helpers/g4";
import { CONTEXTE_BANC, SUJETS_BANC } from "./banc/registre-banc-g4";

const { requeteAngle, requeteEcriture, requeteRelecture, REGLES_TABLEAU, SCRIPT_TEMOIN } = await import("@/services/tableau-scripts/consignes");
const { roleDeRequete, PRIORITE_REGLES_TABLEAU } = await import("@/services/tableau-scripts/client-studio");
const { DEMANDE_MODELE } = await import("../tableau-scripts/modele-valide");

const z = etapeZeroBanc(SUJETS_BANC[0]);
if (!z.ok) throw new Error("étape 0");
const BASE = z.donnees;

/** Données communes du socle (la même base pour tous) : un nom de client glissé dans un texte de Will et une position. */
const POSITION: Matiere = { ...BASE.matieres[0], id: "pos-1", type: "avis-will", texte: "L'IA ne remplace pas le jugement, elle libère du temps.", nomsSensibles: [] };
const SOCLE: Omit<DonneesSocle, "matieres"> & { nomsSensibles: string[] } = {
  maintenant: BASE.maintenant,
  preuves: BASE.preuves,
  contexteAxion: { ...CONTEXTE_BANC, positionIds: ["pos-1"], appelDeSerie: undefined, phraseMarque: undefined },
  ficheStyle: { expressions: ["on gagne du temps"], motsBannis: ["booster"], notes: "Verdict posé.", ouvertures: [] },
  exemplesStyle: [{ id: "ex-1", texte: "Chez Garnier Transports, Martin relançait chaque devis à la main." }],
  // Liste GLOBALE : tous les noms sensibles du stock, quel que soit le sujet.
  nomsSensibles: ["Garnier Transports", "Martin"],
};

/** Un sujet A (avocat) : sa propre matière, qui ne porte AUCUN nom. */
const A: DonneesGeneration = { ...BASE, ...SOCLE, matieres: [POSITION, ...BASE.matieres] };
/** Un sujet B (face caméra) : une matière réservée qui porte « Martin » ; le socle ne doit pas changer d'un octet. */
const RESERVEE: Matiere = { ...BASE.matieres[0], id: "m-reservee", texte: "Martin, notre client, a gagné deux heures.", nomsSensibles: ["Martin"] };
const B: DonneesGeneration = { ...BASE, ...SOCLE, sujet: { ...BASE.sujet, idee: "Relancer les devis sans y passer le vendredi soir", formatId: "facecam" }, matieres: [POSITION, RESERVEE] };

const cacheA = blocsEnCache(A, parametresGenerateur("avocat"));
const cacheB = blocsEnCache(B, parametresGenerateur("facecam"));
const cacheTableau = blocsEnCache({ ...SOCLE, matieres: [POSITION] }, parametresGenerateur("tableau-anime"));

type Systeme = { type: string; text: string; cache_control?: { type: string; ttl?: string } }[];
const systemeDe = (role: DefinitionRole, entree: EntreeRole) => corpsRequete(construireRequete(role, entree)).system as Systeme;
/** Le préfixe mis en cache au point 1 : `system` jusqu'au bloc marqué `ttl: "1h"` compris (octets exacts). */
function prefixe(role: DefinitionRole, entree: EntreeRole): string {
  const s = systemeDe(role, entree);
  const fin = s.findIndex((b) => b.cache_control?.ttl === "1h");
  expect(fin, role.id).toBeGreaterThanOrEqual(0);
  return JSON.stringify(s.slice(0, fin + 1));
}

const ANGLE = {
  angle: "",
  douleur: "",
  accroches: (["situation-vecue", "idee-recue-contredite", "chiffre-vrai", "erreur-frequente", "promesse-precise"] as const).map((type) => ({ type, dit: "", ecran: "", pourquoi: "" })),
  retenue: 0,
  raison: "",
};
const ECRIT = { script: { accroche: { dit: "", ecran: "" } }, motsDouleur: [], sources: [], affirmations: [], aPreparer: [] } as never;

describe("socle canonique : le préfixe mis en cache est identique au bit près", () => {
  const appels: [string, DefinitionRole, EntreeRole][] = [
    ...(["stratege", "fond", "accroches", "plan", "prose", "juge", "preference", "reecriture", "declinaison"] as const).map((n): [string, DefinitionRole, EntreeRole] => [`${n} (avocat, sujet A)`, ROLES_ECRITURE[n], { contexte: cacheA, variable: `variable ${n}` }]),
    ...(["stratege", "plan", "prose", "juge"] as const).map((n): [string, DefinitionRole, EntreeRole] => [`${n} (face caméra, sujet B)`, ROLES_ECRITURE[n], { contexte: cacheB, variable: "autre sujet" }]),
    ["chaîne courte : angle", roleCourtAngle, { contexte: cacheA, variable: "x" }],
    ["chaîne courte : script", roleCourtScript, { contexte: cacheB, variable: "y" }],
    ["chaîne courte : relecture", roleCourtRelecture, { contexte: cacheA, variable: "z" }],
    ...(
      [
        ["angle", requeteAngle(DEMANDE_MODELE)],
        ["ecriture", requeteEcriture(DEMANDE_MODELE, ANGLE)],
        ["relecture", requeteRelecture(DEMANDE_MODELE, ANGLE, ECRIT)],
      ] as const
    ).map(([passe, r]): [string, DefinitionRole, EntreeRole] => {
      const { role, entree } = roleDeRequete(r, passe, cacheTableau);
      return [`tableau : ${passe}`, role, entree];
    }),
  ];

  it("tous les rôles, tous les formats, deux sujets : un seul préfixe", () => {
    const reference = prefixe(...(appels[0].slice(1) as [DefinitionRole, EntreeRole]));
    for (const [nom, role, entree] of appels) expect(prefixe(role, entree), nom).toBe(reference);
    // Le socle porte bien la charte, le style et les preuves (rien d'autre).
    const blocs = (JSON.parse(reference) as Systeme).map((b) => b.text.split("\n")[0]);
    expect(blocs).toEqual(["<contexte_axion>", "<style_will>", "<preuves>"]);
  });

  it("anonymisation sur la liste GLOBALE : aucun nom ne fuit, même absent des matières du sujet", () => {
    for (const c of [cacheA, cacheB, cacheTableau]) {
      const socle = [c.contexteAxion, c.styleWill, c.preuves].join("\n");
      expect(socle).not.toMatch(/Garnier|Martin/);
      expect(socle).toContain("un client");
    }
  });

  it("le cadre du format et ses modèles de ton sortent du socle, APRÈS le point 1 h", () => {
    expect(cacheA.contexteAxion).not.toContain(CADRE_TYPE_AVOCAT);
    expect(cacheA.recette).toContain(CADRE_TYPE_AVOCAT);
    expect(cacheB.recette).toBeUndefined();
    const s = systemeDe(ROLES_ECRITURE.stratege, { contexte: cacheA, variable: "v" });
    const point1 = s.findIndex((b) => b.cache_control?.ttl === "1h");
    const ordre = s.map((b) => b.text.split("\n")[0]);
    expect(ordre.slice(point1 + 1, point1 + 3)).toEqual(["<gagnants>", "<recette_format>"]);
  });

  it("tableau : charte et style de Will inchangés pour toutes les passes ; règles, priorité et script témoin dans la recette", () => {
    for (const [passe, r] of [
      ["angle", requeteAngle(DEMANDE_MODELE, "complete")],
      ["ecriture", requeteEcriture(DEMANDE_MODELE, ANGLE, undefined, {}, "complete")],
    ] as const) {
      const { entree } = roleDeRequete(r, passe, cacheTableau);
      expect(entree.contexte.contexteAxion, passe).toBe(cacheTableau.contexteAxion);
      expect(entree.contexte.styleWill, passe).toBe(cacheTableau.styleWill);
      expect(entree.contexte.recette, passe).toContain(REGLES_TABLEAU);
      expect(entree.contexte.recette!.indexOf(PRIORITE_REGLES_TABLEAU), passe).toBe(0);
    }
    expect(roleDeRequete(requeteEcriture(DEMANDE_MODELE, ANGLE, undefined, {}, "complete"), "ecriture", cacheTableau).entree.contexte.recette).toContain(SCRIPT_TEMOIN);
    expect(roleDeRequete(requeteAngle(DEMANDE_MODELE, "complete"), "angle", cacheTableau).entree.contexte.recette).not.toContain(SCRIPT_TEMOIN);
  });
});

describe("requête d'un rôle : points de cache et sortie JSON", () => {
  const corps = corpsRequete(construireRequete(ROLES_ECRITURE.stratege, { contexte: cacheA, variable: "v" })) as { system: Systeme; output_config: Record<string, unknown> };

  it("aucun format de sortie structurée n'est envoyé ; l'effort reste celui du rôle", () => {
    expect(corps.output_config).toEqual({ effort: ROLES_ECRITURE.stratege.effort });
  });

  it("deux points : fin du socle en 1 h, fin de la consigne en 5 min (le plus long d'abord)", () => {
    const points = corps.system.filter((b) => b.cache_control).map((b) => b.cache_control);
    expect(points).toEqual([{ type: "ephemeral", ttl: "1h" }, { type: "ephemeral" }]);
    expect(corps.system.at(-1)!.cache_control).toEqual({ type: "ephemeral" });
    expect(corps.system.at(-1)!.text.startsWith(ROLES_ECRITURE.stratege.consigne.trim())).toBe(true);
  });

  it("le JSON est demandé dans la consigne, avec le schéma du rôle", () => {
    const consigne = corps.system.at(-1)!.text;
    expect(consigne).toMatch(/UN seul objet JSON/);
    expect(consigne).toContain("<schema_sortie>");
    expect(consigne).toContain('"angles"');
  });

  it("un rôle en texte libre ne reçoit aucune consigne JSON", () => {
    const libre: DefinitionRole = { ...ROLES_ECRITURE.stratege, id: "libre", schema: undefined, envoi: undefined };
    expect(systemeDe(libre, { contexte: cacheA, variable: "v" }).at(-1)!.text).not.toContain("<schema_sortie>");
  });

  it("point de cache FACULTATIF sur la recette (`cacheRecette`) : trois points (socle 1 h, recette 1 h, consigne 5 min) ; sans lui, rien ne change", () => {
    const entree = { contexte: cacheA, variable: "v" };
    const avec = corpsRequete(construireRequete({ ...ROLES_ECRITURE.stratege, cacheRecette: true }, entree)) as { system: Systeme };
    const sans = corpsRequete(construireRequete(ROLES_ECRITURE.stratege, entree)) as { system: Systeme };
    expect(avec.system.filter((b) => b.cache_control).map((b) => b.cache_control)).toEqual([{ type: "ephemeral", ttl: "1h" }, { type: "ephemeral", ttl: "1h" }, { type: "ephemeral" }]);
    expect(avec.system.find((b) => b.cache_control?.ttl === "1h" && b.text.startsWith("<recette_format>"))).toBeDefined();
    // Le préfixe du socle reste identique au bit près ; seul le marqueur de la recette s'ajoute.
    expect(JSON.stringify(avec.system.slice(0, 3))).toBe(JSON.stringify(sans.system.slice(0, 3)));
    expect(avec.system.map((b) => b.text)).toEqual(sans.system.map((b) => b.text));
    // Pire cas : la recette passe au prix de l'écriture 1 h (jamais sous-estimé).
    expect(pireCasRole({ ...ROLES_ECRITURE.stratege, cacheRecette: true }, entree)).toBeGreaterThan(pireCasRole(ROLES_ECRITURE.stratege, entree));
  });

  it("refuse un point 5 min placé avant un point 1 h (règle de l'API)", () => {
    expect(() => corpsRequete({ modele: "m", maxTokens: 1, effort: "low", systeme: [{ texte: "a", cache: true }, { texte: "b", cache: "1h" }], messages: [] })).toThrow(/1 h/);
  });
});

describe("réponse JSON sans sortie structurée", () => {
  function flux(texte: string): typeof fetch {
    const evts = [
      ["message_start", { message: { id: "msg_1", model: "claude-opus-5-5", usage: { input_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 9000, cache_creation: { ephemeral_1h_input_tokens: 7000, ephemeral_5m_input_tokens: 2000 }, output_tokens: 1 } } }],
      ["content_block_start", { content_block: { type: "text", text: "" } }],
      ["content_block_delta", { delta: { type: "text_delta", text: texte } }],
      ["message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 50 } }],
    ];
    const corps = evts.map(([t, d]) => `event: ${t}\ndata: ${JSON.stringify(d)}\n\n`).join("");
    return (async () => new Response(corps, { status: 200 })) as unknown as typeof fetch;
  }
  const requete = { ...construireRequete(ROLES_ECRITURE.stratege, { contexte: cacheA, variable: "v" }) };

  it("une clôture Markdown ou un texte autour du JSON : le premier objet est extrait ; JSON tronqué : texte rendu tel quel", async () => {
    expect((await envoyerMessage(requete, { cle: "k", fetch: flux('```json\n{"a":1}\n```') })).texte).toBe('{"a":1}');
    expect((await envoyerMessage(requete, { cle: "k", fetch: flux('Voici : {"a":1}') })).texte).toBe('{"a":1}');
    expect((await envoyerMessage(requete, { cle: "k", fetch: flux('Voici : {"a":1} fin') })).texte).toBe('{"a":1}');
    expect((await envoyerMessage(requete, { cle: "k", fetch: flux('Voici : {"a":1') })).texte).toBe('Voici : {"a":1');
  });

  it("les écritures 1 h et 5 min sont lues séparément et comptées à leur prix (2 × et 1,25 × l'entrée)", async () => {
    const r = await envoyerMessage(requete, { cle: "k", fetch: flux("{}") });
    expect(r.jetons).toEqual({ entree: 10, cacheLu: 0, cacheEcrit: 9000, cacheEcrit1h: 7000, sortie: 50 });
    const t = tarifDe("claude-opus-5-5");
    expect(t.cacheEcrit1h).toBe(t.entree * 2);
    expect(t.cacheEcrit).toBe(t.entree * 1.25);
    expect(coutUsd(r.jetons, "claude-opus-5-5")).toBeCloseTo((10 * 4 + 7000 * 8 + 2000 * 5 + 50 * 20) / 1e6, 12);
    // Sans détail (ancienne forme) : tout au prix 5 min, comme avant.
    expect(coutUsd({ entree: 0, cacheLu: 0, cacheEcrit: 1000, sortie: 0 }, "claude-opus-5-5")).toBeCloseTo(0.005, 12);
  });

  it("pire cas : le socle au prix de l'écriture 1 h, le reste au prix 5 min (jamais sous-estimé)", () => {
    expect(pireCasUsd("claude-opus-5-5", 1_000_000, 0)).toBe(5);
    expect(pireCasUsd("claude-opus-5-5", 1_000_000, 0, 600_000)).toBeCloseTo(0.4 * 5 + 0.6 * 8, 9);
    const entree = { contexte: cacheA, variable: "v" };
    const r = construireRequete(ROLES_ECRITURE.stratege, entree);
    const socle = jetonsEstimes(r.systeme.slice(0, 3).map((b) => b.texte).join("\n"));
    const texte = [...r.systeme.map((b) => b.texte), "v", ""].join("\n");
    expect(pireCasRole(ROLES_ECRITURE.stratege, entree)).toBeCloseTo(pireCasUsd(ROLES_ECRITURE.stratege.modele, jetonsEstimes(texte), ROLES_ECRITURE.stratege.maxTokens, socle), 12);
  });
});
