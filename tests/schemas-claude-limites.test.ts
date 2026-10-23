/**
 * ANTI-RÉGRESSION — limites de la sortie structurée sur TOUS les rôles du studio (panne du 09/10 : « Monteur ·
 * discussion » 17 et « Monteur · relecture des images » 18 propriétés à union, limite 16).
 *
 * Pour chaque rôle à sortie structurée, le test construit EXACTEMENT le corps envoyé à l'API (`construireRequete` puis
 * `corpsRequete` → le schéma de `<schema_sortie>` dans la consigne : plus d'`output_config.format` depuis le 15/10, il
 * invalidait le cache) et vérifie hors ligne les limites documentées (doc Anthropic
 * « Structured outputs », 09/10) : ≤ 16 propriétés à union (alerte au-delà de 12), ≤ 24 propriétés facultatives (alerte
 * au-delà de 20), objets fermés, aucune contrainte refusée, rien de récursif. Aucun appel réseau (`fetch` interdit).
 * Il vérifie aussi l'aller-retour : une réponse SANS les champs nullables (forme envoyée) redevient, après `lireSortie`,
 * la réponse d'origine (nulls compris), validée par le même schéma zod strict.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { entreesFacecamVides } from "@/domaine/facecam";
import type { MotHorodate } from "@/domaine/types";
import { corpsRequete } from "@/fournisseurs/claude/client";
import { creerFournisseurScriptClaude, lireSortie } from "@/fournisseurs/claude/inscription";
import { ROLES_ECRITURE } from "@/generateur/roles";
import { roleCourtAngle, roleCourtRelecture, roleCourtScript } from "@/generateur/chaine-courte";
import { roleEquipeAccroches } from "@/generateur/roles/equipe-accroches";
import { roleEquipeChef } from "@/generateur/roles/equipe-chef";
import { roleEquipeRelecteur } from "@/generateur/roles/equipe-relecteur";
import { roleEquipeScenariste } from "@/generateur/roles/equipe-scenariste";
import { rolePublication } from "@/generateur/roles/publication";
import { rolePasseportWeb } from "@/generateur/roles/passeport-web";
import { schemaEnveloppeOperation } from "@/briques/monteur/enveloppe";
import { schemaReponsePour } from "@/briques/monteur/operations";
import { complexiteSchema, estimationGrammaire, LIMITES_SORTIE_STRUCTUREE, MARGES_SORTIE_STRUCTUREE, restaurerNulls, SEUILS_GRAMMAIRE, type EstimationGrammaire } from "@/generateur/roles/schema-api";
import { roleSonde } from "@/generateur/roles/sonde";
import { roleComite } from "@/generateur/roles/comite";
import { construireRequete, schemaJson, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { schemaReponseMonteurAvocat } from "@/moteurs/montage-avocat/monteur";
import { MODELES_CARTE, schemaReponseMonteur, SIGNATURES_OPERATIONS_FACECAM, TYPES_OPERATION_FACECAM, type OperationFacecam } from "@/moteurs/montage-facecam/monteur/operations";
import { roleMonteurFacecam, roleRelectureFacecam } from "@/moteurs/montage-facecam/monteur/role";
import { PHRASE_VERSION_SIMPLE_PANNE, piloterMonteur, type ReponseAppel } from "@/moteurs/montage-facecam/monteur/agent";
import { reglagesMonteurVides, type EtatMonteur, type PassageMonteur } from "@/moteurs/montage-facecam/monteur/appliquer";
import type { ReponseMonteur } from "@/moteurs/montage-facecam/monteur/operations";
import { CLE_ESSAI_CLAUDE, fauxFetch, fluxReussi, reponseFlux } from "./helpers/g0";

/** Tous les rôles qui partent à Claude, par le nom de leur export. */
const ROLES: Record<string, DefinitionRole> = {
  ...Object.fromEntries(Object.values(ROLES_ECRITURE).map((r) => [nomExport(r.id), r as DefinitionRole])),
  // Banc d'écriture : la chaîne courte (`chaine-courte.ts`), branchée sur aucun écran.
  roleCourtAngle: roleCourtAngle as DefinitionRole,
  roleCourtScript: roleCourtScript as DefinitionRole,
  roleCourtRelecture: roleCourtRelecture as DefinitionRole,
  // Chaîne « équipe » (`chaine-equipe.ts`), livrée éteinte.
  roleEquipeChef: roleEquipeChef as DefinitionRole,
  roleEquipeScenariste: roleEquipeScenariste as DefinitionRole,
  roleEquipeAccroches: roleEquipeAccroches as DefinitionRole,
  roleEquipeRelecteur: roleEquipeRelecteur as DefinitionRole,
  roleSonde,
  rolePublication,
  // Vidéos sur le site (lot S1) : la page du site écrite par Claude, derrière un réglage éteint.
  rolePasseportWeb,
  roleMonteurFacecam,
  roleRelectureFacecam,
  // Comité éditorial des idées (lot groupé, éteint par défaut).
  roleComite: roleComite as DefinitionRole,
};
function nomExport(id: string): string {
  return `role${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}

/** Schéma EXACT demandé dans la consigne (`<schema_sortie>`, dernier bloc de `system`) ; jamais d'`output_config.format`. */
function schemaDuCorps(corps: unknown): Record<string, unknown> | undefined {
  const c = corps as { output_config: Record<string, unknown>; system?: { text: string }[] };
  expect(c.output_config.format).toBeUndefined();
  const m = /<schema_sortie>\n([\s\S]*?)\n<\/schema_sortie>/.exec(c.system?.at(-1)?.text ?? "");
  return m ? (JSON.parse(m[1]) as Record<string, unknown>) : undefined;
}
function schemaEnvoye(role: DefinitionRole): Record<string, unknown> | undefined {
  return schemaDuCorps(corpsRequete(construireRequete(role, { contexte: {}, variable: "x" })));
}

function fichiersTs(dossier: string): string[] {
  return readdirSync(dossier).flatMap((f) => {
    const p = join(dossier, f);
    return statSync(p).isDirectory() ? fichiersTs(p) : p.endsWith(".ts") ? [p] : [];
  });
}

beforeAll(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit dans ce test");
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe("limites de la sortie structurée, rôle par rôle", () => {
  it("la liste couvre TOUS les rôles déclarés dans src (un nouveau rôle doit y entrer)", () => {
    const declares = new Set<string>();
    for (const f of fichiersTs("src")) for (const m of readFileSync(f, "utf8").matchAll(/export const (\w+): DefinitionRole\b/g)) declares.add(m[1]);
    expect([...declares].sort()).toEqual(Object.keys(ROLES).sort());
  });

  const alertes: string[] = [];
  afterAll(() => {
    if (alertes.length) console.warn(`[schémas Claude] au-delà de la marge :\n${alertes.join("\n")}`);
  });

  for (const [nom, role] of Object.entries(ROLES)) {
    it(`${nom} (${role.id}) : ≤ ${LIMITES_SORTIE_STRUCTUREE.unions} unions, ≤ ${LIMITES_SORTIE_STRUCTUREE.optionnels} facultatifs, schéma accepté`, () => {
      const s = schemaEnvoye(role);
      if (!role.schema) return expect(s).toBeUndefined();
      expect(s).toBeDefined();
      expect(s).not.toHaveProperty("$schema");
      const c = complexiteSchema(s);
      if (c.unions.length > MARGES_SORTIE_STRUCTUREE.unions) alertes.push(`${nom} : ${c.unions.length} unions (marge ${MARGES_SORTIE_STRUCTUREE.unions})`);
      if (c.optionnels.length > MARGES_SORTIE_STRUCTUREE.optionnels) alertes.push(`${nom} : ${c.optionnels.length} facultatifs (marge ${MARGES_SORTIE_STRUCTUREE.optionnels})`);
      expect(c.unions.length, c.unions.join("\n")).toBeLessThanOrEqual(LIMITES_SORTIE_STRUCTUREE.unions);
      expect(c.optionnels.length, c.optionnels.join("\n")).toBeLessThanOrEqual(LIMITES_SORTIE_STRUCTUREE.optionnels);
      expect(c.problemes).toEqual([]);
      expect(JSON.stringify(s)).not.toContain('"$ref"');
    });
  }

  it("monteur : enveloppe envoyée, AUCUNE union (le vocabulaire ne part plus en union)", () => {
    for (const r of [roleMonteurFacecam, roleRelectureFacecam]) {
      const c = complexiteSchema(schemaEnvoye(r));
      expect(c.unions, r.id).toEqual([]);
      expect(c.optionnels.length, r.id).toBeLessThanOrEqual(1);
    }
  });

  it("monteur avocat (schéma prêt, pas encore de rôle) : dans les limites aussi", () => {
    const c = complexiteSchema(schemaJson(schemaReponseMonteurAvocat));
    expect(c.unions.length).toBeLessThanOrEqual(MARGES_SORTIE_STRUCTUREE.unions);
    expect(c.optionnels.length).toBeLessThanOrEqual(LIMITES_SORTIE_STRUCTUREE.optionnels);
    expect(c.problemes).toEqual([]);
  });

  it("le vocabulaire complet reste : tous les types dans l'enveloppe, signatures de chacun (13 modèles L, effet réaliste K) dans la consigne", () => {
    const envoye = JSON.stringify(schemaEnvoye(roleMonteurFacecam));
    for (const t of TYPES_OPERATION_FACECAM) {
      expect(envoye, t).toContain(`"${t}"`);
      for (const r of [roleMonteurFacecam, roleRelectureFacecam]) expect(r.consigne, `${r.id} ${t}`).toContain(`- ${t} : {`);
    }
    expect(TYPES_OPERATION_FACECAM).toContain("effetRealisteIA");
    expect(TYPES_OPERATION_FACECAM).toContain("objetMain");
    for (const m of MODELES_CARTE) expect(SIGNATURES_OPERATIONS_FACECAM, m).toContain(`"${m}"`);
    expect(MODELES_CARTE).toHaveLength(13);
    expect(SIGNATURES_OPERATIONS_FACECAM).toContain("- effetRealisteIA : { consigne: texte, ancre: \"mot\"|\"instant\"|\"bon-endroit\"");
    expect(SIGNATURES_OPERATIONS_FACECAM).toContain("instantSec: nombre ou null");
  });
});

/* ------------------------------------------------------------------ */
/* Taille de la grammaire compilée (estimation hors ligne)              */
/* ------------------------------------------------------------------ */

describe("taille de la grammaire compilée, rôle par rôle (panne du 10/10 : « The compiled grammar is too large »)", () => {
  const releve: string[] = [];
  afterAll(() => console.info(`[schémas Claude] grammaire (propriétés · profondeur · branches · enums · facultatifs · JSON) :\n${releve.join("\n")}`));

  for (const [nom, role] of Object.entries(ROLES)) {
    if (!role.schema) continue;
    it(`${nom} (${role.id}) : sous les seuils prudents ${JSON.stringify(SEUILS_GRAMMAIRE)}`, () => {
      const e = estimationGrammaire(schemaEnvoye(role));
      releve.push(`${role.id} : ${e.proprietes} · ${e.profondeur} · ${e.branchesUnion} · ${e.enums} · ${e.optionnels} · ${e.tailleJson}`);
      for (const k of Object.keys(SEUILS_GRAMMAIRE) as (keyof EstimationGrammaire)[]) expect(e[k], `${role.id} : ${k}`).toBeLessThanOrEqual(SEUILS_GRAMMAIRE[k]);
    });
  }

  it("contre-épreuve : le schéma qu'envoyait le correctif #5 (union complète) dépasse les seuils", () => {
    for (const r of [roleMonteurFacecam, roleRelectureFacecam]) {
      const e = estimationGrammaire(schemaJson(r.schema!));
      expect(e.proprietes, r.id).toBeGreaterThan(SEUILS_GRAMMAIRE.proprietes);
      expect(e.branchesUnion, r.id).toBeGreaterThan(SEUILS_GRAMMAIRE.branchesUnion);
      expect(e.enums, r.id).toBeGreaterThan(SEUILS_GRAMMAIRE.enums);
      expect(e.optionnels, r.id).toBeGreaterThan(SEUILS_GRAMMAIRE.optionnels);
      expect(e.tailleJson, r.id).toBeGreaterThan(SEUILS_GRAMMAIRE.tailleJson);
    }
  });

  it("la grammaire du monteur ne grossit PAS avec le vocabulaire (100 types de plus : mêmes propriétés, mêmes unions)", () => {
    const types = [...TYPES_OPERATION_FACECAM, ...Array.from({ length: 100 }, (_, i) => `operationFuture${i}`)] as [string, ...string[]];
    const grand = estimationGrammaire(schemaJson(schemaReponsePour(schemaEnveloppeOperation(types))));
    const actuel = estimationGrammaire(schemaEnvoye(roleMonteurFacecam));
    expect(grand.proprietes).toBe(actuel.proprietes);
    expect(grand.branchesUnion).toBe(0);
    expect(grand.optionnels).toBe(0);
    expect(grand.profondeur).toBe(actuel.profondeur);
  });

  it("monteur avocat (schéma prêt, sans rôle) : sous les seuils aussi", () => {
    const e = estimationGrammaire(schemaJson(schemaReponseMonteurAvocat));
    for (const k of Object.keys(SEUILS_GRAMMAIRE) as (keyof EstimationGrammaire)[]) expect(e[k], k).toBeLessThanOrEqual(SEUILS_GRAMMAIRE[k]);
  });
});

/* ------------------------------------------------------------------ */
/* Aller-retour : champs absents → null, validation stricte inchangée   */
/* ------------------------------------------------------------------ */

const OPS_AVEC_NULLS: OperationFacecam[] = [
  { type: "ajouterCarte", debutMot: 3, finMot: 9, modele: null, textes: [], html: null, disposition: "plein-ecran", description: "Ciel étoilé", animationGardeeId: null },
  { type: "ajouterCarte", debutMot: 3, finMot: 9, modele: "check-list", textes: ["a", "b"], html: { html: "<p/>", css: "", timeline: "" }, disposition: "ecran-partage", description: "Liste", animationGardeeId: "g1" },
  { type: "miseEnPage", debutMot: 1, finMot: 4, mode: "vignette", cote: null, description: "vignette" },
  { type: "couleurs", reglage: "lumiere", cran: "plus", teinte: null },
  { type: "son", action: "musique", precision: null, debutMot: null, finMot: null },
  { type: "arretImage", auMot: 5, dureeSec: 1, texte: null },
  { type: "titre", texte: "Titre", debutMot: null, finMot: null, pleinEcran: false },
  { type: "vitreBrisee", auMot: 12, dureeSec: null, revele: "plan-suivant", texteCarte: null, bruitage: true },
  { type: "transitionEcran", auMot: 20, style: "ecran-plie", dureeSec: null },
  { type: "effetRealisteIA", consigne: "téléphone", ancre: "bon-endroit", debutMot: 7, instantSec: null, dureeSec: 5, consigneVideo: "A phone appears", objet: "telephone", imageReference: null, finitSurEcran: true, sonSuggere: null, raisonMoment: "Il parle du téléphone." },
];

/** Ce que l'API renvoie désormais : les champs null sont ABSENTS. */
function sansLesNulls(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sansLesNulls);
  if (!x || typeof x !== "object") return x;
  return Object.fromEntries(Object.entries(x).filter(([, v]) => v !== null).map(([k, v]) => [k, sansLesNulls(v)]));
}

/** Ce que l'API renvoie depuis le 10/10 : chaque opération en enveloppe `{ type, parametres: "<json>" }`. */
function enEnveloppe(x: unknown, cle = "operations"): unknown {
  const o = x as Record<string, unknown>;
  return { ...o, [cle]: (o[cle] as Record<string, unknown>[]).map(({ type, ...p }) => ({ type, parametres: JSON.stringify(p) })) };
}

const base = { modeleDemande: "m", modele: "m", replis: [], stopReason: "end_turn", jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 } };

describe("aller-retour des champs facultatifs", () => {
  it("monteur · discussion : réponse sans nulls → mêmes opérations qu'avant (nulls remis), schéma zod strict", () => {
    const origine = { reponse: "C'est fait.", operations: OPS_AVEC_NULLS, consignes: [{ consigneId: "fil", comprise: true, resume: "Fait.", operations: [0, 9] }] };
    expect(schemaReponseMonteur.safeParse(origine).success).toBe(true);
    const lu = lireSortie(roleMonteurFacecam, { ...base, texte: JSON.stringify(enEnveloppe(sansLesNulls(origine))) });
    expect(lu.invalide).toBeUndefined();
    expect(lu.ecartees).toBeUndefined();
    expect(lu.donnees).toEqual(origine);
  });

  it("monteur · relecture : elementId absent → null ; corrections relues", () => {
    const origine = { ok: false, defauts: [{ elementId: null, defaut: "image-noire" as const, detail: "fin noire" }], corrections: [OPS_AVEC_NULLS[4]] };
    const lu = lireSortie(roleRelectureFacecam, { ...base, texte: JSON.stringify(enEnveloppe(sansLesNulls(origine), "corrections")) });
    expect(lu.invalide).toBeUndefined();
    expect(lu.donnees).toEqual(origine);
  });

  it("la validation reste stricte, opération par opération : champ requis manquant, valeur hors liste, type faux → écartée avec son motif", () => {
    const ops = [
      { type: "zoom", debutMot: 1, finMot: 2, style: "lent" },
      { type: "zoom", debutMot: 1, finMot: 2, style: "géant", cible: "visage" },
      { type: "son", action: "musique", precision: 3 },
      { type: "couper", debutMot: 4, finMot: 6 },
    ];
    const lu = lireSortie(roleMonteurFacecam, { ...base, texte: JSON.stringify(enEnveloppe({ reponse: "x", operations: ops, consignes: [{ consigneId: "fil", comprise: true, resume: "r", operations: [0, 3] }] })) });
    expect(lu.invalide).toBeUndefined();
    expect(lu.donnees?.operations).toEqual([{ type: "couper", debutMot: 4, finMot: 6 }]);
    // Index renumérotés sur la liste gardée.
    expect(lu.donnees?.consignes[0].operations).toEqual([0]);
    expect(lu.ecartees).toHaveLength(3);
    expect(lu.ecartees![0]).toMatch(/^zoom n° 1 : cible/);
    expect(lu.ecartees![1]).toMatch(/^zoom n° 2 : style/);
    expect(lu.ecartees![2]).toMatch(/^son n° 3 : /);
    // Paramètres qui ne sont pas du JSON : écartée, motif lisible.
    const illisible = lireSortie(roleMonteurFacecam, { ...base, texte: JSON.stringify({ reponse: "x", operations: [{ type: "zoom", parametres: "{debutMot: 1" }], consignes: [] }) });
    expect(illisible.donnees?.operations).toEqual([]);
    expect(illisible.ecartees?.[0]).toMatch(/^zoom n° 1 : /);
    // Réponse entière illisible : invalide (jamais acceptée en silence).
    expect(lireSortie(roleMonteurFacecam, { ...base, texte: "pas du json" }).invalide).toBeTruthy();
    expect(lireSortie(roleMonteurFacecam, { ...base, texte: JSON.stringify({ operations: "x" }) }).invalide).toBeTruthy();
  });

  it("une valeur présente n'est jamais écrasée ; une réponse avec les nulls (ancienne forme) reste acceptée", () => {
    const avec = { reponse: "x", operations: OPS_AVEC_NULLS, consignes: [] };
    expect(restaurerNulls(schemaReponseMonteur, avec)).toEqual(avec);
    // Ancienne forme (opérations à plat, nulls compris) : toujours acceptée par la lecture.
    expect(lireSortie(roleMonteurFacecam, { ...base, texte: JSON.stringify(avec) }).donnees).toEqual(avec);
  });

  it("tous les rôles : la sortie simulée, privée de ses nulls, repasse la validation du rôle", () => {
    for (const [nom, role] of Object.entries(ROLES)) {
      if (!role.schema) continue;
      const sortie = role.simuler({ contexte: {}, variable: "Sujet : essai.\nMots : 0:un 1:deux" });
      if (typeof sortie === "string") continue;
      const lu = lireSortie(role, { ...base, texte: JSON.stringify(sansLesNulls(sortie)) });
      expect(lu.invalide, nom).toBeUndefined();
      expect(lu.donnees, nom).toEqual(role.schema.parse(sortie));
    }
  });
});

/* ------------------------------------------------------------------ */
/* Bout en bout : double de Claude (flux SSE enregistré) → monteur     */
/* ------------------------------------------------------------------ */

const MOTS_E2E: MotHorodate[] = Array.from({ length: 40 }, (_, i) => ({ mot: `mot${i}`, debutSec: 2 + i * 0.5, finSec: 2.4 + i * 0.5 }));

function etatE2E(): EtatMonteur {
  const facecam = entreesFacecamVides();
  facecam.coupes.auto = [
    { id: "c-debut", type: "debut", debutSec: 0, finSec: 2 },
    { id: "c-rep", type: "reprise", debutSec: 6, finSec: 8, libelle: "Phrase reprise" },
  ];
  return { facecam, reglages: reglagesMonteurVides() };
}

/** Double de Claude : le VRAI fournisseur (client SSE, `lireSortie`), servi par un faux `fetch` qui garde les requêtes. */
function doubleClaude(textes: string[]) {
  const { fetch, appels: requetes } = fauxFetch(textes.map((t) => () => reponseFlux(fluxReussi({ texte: t }))));
  const fournisseur = creerFournisseurScriptClaude(CLE_ESSAI_CLAUDE, fetch);
  // Même forme que `executerRolePourVideo` (services/depense-claude-video.ts).
  const appeler = vi.fn(async (entree: EntreeRole): Promise<ReponseAppel> => {
    const r = await fournisseur.executerRole(roleMonteurFacecam, entree);
    return { ok: true, simule: false, donnees: r.donnees, invalide: r.invalide, ...(r.ecartees?.length ? { ecartees: r.ecartees } : {}) };
  });
  return { appeler, requetes };
}

const env = (type: string, p: Record<string, unknown>) => ({ type, parametres: JSON.stringify(p) });
let nE2E = 0;
const depsE2E = () => ({ nouvelId: (p: string) => `${p}-${++nE2E}`, maintenant: () => "2026-10-10T10:00:00.000Z" });

describe("bout en bout : « Monteur · discussion » avec un double de Claude", () => {
  it("le corps envoyé porte l'enveloppe (grammaire fixe), jamais l'union du vocabulaire", async () => {
    const { appeler, requetes } = doubleClaude([JSON.stringify({ reponse: "Coupé.", operations: [env("couper", { debutMot: 4, finMot: 6 })], consignes: [{ consigneId: "fil", comprise: true, resume: "Coupé", operations: [0] }] })]);
    await piloterMonteur({ titre: "t", mots: MOTS_E2E, dureePriseSec: 22, etat: etatE2E(), message: "Coupe la phrase où je bafouille", plafondAtteint: false }, { ...depsE2E(), appeler });
    const schema = schemaDuCorps(requetes[0].corps);
    expect(complexiteSchema(schema).unions).toEqual([]);
    expect(JSON.stringify(schema)).not.toContain('"anyOf"');
  });

  it("chaque famille appliquée : carte (modèle L), objetMain (F3), effet réaliste (K, à confirmer), couper, rétablir ; multicaméra hors vocabulaire écartée (garde J)", async () => {
    const reponse = {
      reponse: "C'est fait.",
      operations: [
        env("ajouterCarte", { debutMot: 10, finMot: 16, modele: "check-list", textes: ["Devis", "Facture", "Relance"], html: null, disposition: "plein-ecran", description: "Check-list des 3 étapes", animationGardeeId: null }),
        env("objetMain", { debutMot: 20, finMot: 24, objet: "logo-axion", description: "Le logo dans ma main" }),
        env("effetRealisteIA", { consigne: "un téléphone apparaît dans ma main", ancre: "bon-endroit", debutMot: 26, instantSec: null, dureeSec: 5, consigneVideo: "A phone appears in the open palm", objet: "telephone", imageReference: null, finitSurEcran: false, sonSuggere: null, raisonMoment: "Il parle du téléphone." }),
        env("couper", { debutMot: 30, finMot: 32 }),
        env("retablir", { coupeId: "c-rep" }),
        { type: "multicamera", parametres: JSON.stringify({ actif: true }) },
      ],
      consignes: [{ consigneId: "fil", comprise: true, resume: "Carte, logo, effet, coupe et passage remis", operations: [0, 1, 2, 3, 4, 5] }],
    };
    const { appeler } = doubleClaude([JSON.stringify(reponse), JSON.stringify({ ...reponse, operations: reponse.operations.slice(0, 5) })]);
    const r = await piloterMonteur({ titre: "t", mots: MOTS_E2E, dureePriseSec: 22, etat: etatE2E(), message: "Fais tout ça", plafondAtteint: false }, { ...depsE2E(), appeler });
    // La multicaméra écartée (option payante : jamais par Claude) déclenche UN nouvel essai, qui cite le motif exact.
    expect(appeler).toHaveBeenCalledTimes(2);
    expect(appeler.mock.calls[1][0].variable).toContain("multicamera n° 6 : type inconnu");
    expect(r.version).toBe("complete");
    expect(r.comprises).toBe(1);
    const passages = r.etat.facecam.passages as PassageMonteur[];
    expect(passages.find((p) => p.type === "carte")?.modele).toBe("check-list");
    expect(passages.some((p) => (p.operation as { type?: string }).type === "objetMain")).toBe(true);
    // K : l'effet réaliste est préparé, PAS posé (payant, « Confirmer »).
    expect(r.aConfirmer).toHaveLength(1);
    expect(r.aConfirmer[0].effet.objet).toBe("telephone");
    expect(passages.some((p) => (p.operation as { type?: string }).type === "effetRealisteIA")).toBe(false);
    expect(r.etat.facecam.coupes.retablies).toContain("c-rep");
    expect(r.etat.reglages.coupesDemandees.length).toBeGreaterThan(0);
  });

  it("les 13 modèles L passent un à un par l'enveloppe et restent des cartes du catalogue", async () => {
    const ops = MODELES_CARTE.map((modele, i) => env("ajouterCarte", { debutMot: i * 3, finMot: i * 3 + 2, modele, textes: ["A", "B"], html: null, disposition: "plein-ecran", description: modele, animationGardeeId: null }));
    const { appeler } = doubleClaude([JSON.stringify({ reponse: "ok", operations: ops, consignes: [] })]);
    const r = await appeler({ contexte: {}, variable: "x" });
    expect(r.ok && r.ecartees).toBeFalsy();
    const lu = r.ok ? (r.donnees as ReponseMonteur) : null;
    expect(lu?.operations.map((o) => (o.type === "ajouterCarte" ? o.modele : null))).toEqual([...MODELES_CARTE]);
  });

  it("réponse invalide deux fois → version simple avec une phrase claire (jamais « un souci est survenu »)", async () => {
    const { appeler } = doubleClaude(["pas du json", JSON.stringify({ reponse: "x", operations: [{ type: "zoom", parametres: "{oups" }], consignes: [] })]);
    const r = await piloterMonteur({ titre: "t", mots: MOTS_E2E, dureePriseSec: 22, etat: etatE2E(), message: "Zoome quand je dis mot12", plafondAtteint: false }, { ...depsE2E(), appeler });
    expect(appeler).toHaveBeenCalledTimes(2);
    expect(appeler.mock.calls[1][0].variable).toContain("Sortie qui n'est pas du JSON");
    expect(r.version).toBe("simple");
    expect(r.reponse).toContain(PHRASE_VERSION_SIMPLE_PANNE);
    expect(r.reponse).not.toMatch(/souci/i);
    expect(r.alertes.join(" ")).toMatch(/illisible/);
  });

  it("opération réparable (modèle hors liste) → réparateur « carte sur mesure », sans nouvel essai", async () => {
    const { appeler } = doubleClaude([JSON.stringify({ reponse: "ok", operations: [env("ajouterCarte", { debutMot: 5, finMot: 9, modele: "inconnu", textes: [], html: null, disposition: "plein-ecran", description: "Ciel étoilé", animationGardeeId: null })], consignes: [{ consigneId: "fil", comprise: true, resume: "Ciel", operations: [0] }] })]);
    const r = await piloterMonteur({ titre: "t", mots: MOTS_E2E, dureePriseSec: 22, etat: etatE2E(), message: "Mets un ciel étoilé", plafondAtteint: false }, { ...depsE2E(), appeler });
    // Modèle inconnu → carte sur mesure (vocabulaire ouvert), rien d'écarté : un seul appel.
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(r.version).toBe("complete");
    expect(r.comprises).toBe(1);
  });
});

describe("bout en bout : « Monteur · relecture des images » avec un double de Claude", () => {
  it("corrections en enveloppe relues ; une correction illisible est écartée avec son motif, le reste est gardé", async () => {
    const { fetch } = fauxFetch([
      () =>
        reponseFlux(
          fluxReussi({
            texte: JSON.stringify({ ok: false, defauts: [{ defaut: "texte-deborde", detail: "carte trop longue" }], corrections: [env("retirer", { passageId: "p1" }), { type: "zoom", parametres: "{" }] }),
          }),
        ),
    ]);
    const r = await creerFournisseurScriptClaude(CLE_ESSAI_CLAUDE, fetch).executerRole(roleRelectureFacecam, { contexte: {}, variable: "x" });
    expect(r.invalide).toBeUndefined();
    expect(r.donnees).toEqual({ ok: false, defauts: [{ elementId: null, defaut: "texte-deborde", detail: "carte trop longue" }], corrections: [{ type: "retirer", passageId: "p1" }] });
    expect(r.ecartees).toEqual(["zoom n° 2 : parametres n'est pas un objet JSON valide"]);
  });
});
