/**
 * LOT R1 — LES REQUÊTES DU STUDIO CONTRE LE SCHÉMA RELEVÉ DE BUFFER (`docs/buffer/schema-2026-10.json`).
 *
 * Petit vérificateur GraphQL (sans dépendance) : chaque champ, argument, champ d'entrée, valeur d'énumération et type
 * de variable des requêtes de `requetes.ts` (et de la lecture des statistiques) doit exister dans le schéma, avec le
 * bon type. L'entrée `createPost` fabriquée par le studio est vérifiée champ par champ (obligatoires présents, aucun
 * inconnu, énumérations valides). Un champ renommé chez Buffer rougit ici, pas en production.
 * Et : une seule mutation, `createPost` ; jamais de suppression ni de modification chez Buffer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as requetes from "@/fournisseurs/publication/requetes";
import { entreeCreerPost } from "@/fournisseurs/publication/buffer";
import { REQUETE_POST_BUFFER } from "@/fournisseurs/mesures/buffer";
import type { IdReseau } from "@/domaine/types";

type Ref = { kind: string; name: string | null; ofType?: Ref | null };
type Champ = { name: string; args: { name: string; type: Ref; defaultValue: string | null }[]; type: Ref };
type TypeSchema = { kind: string; name: string; fields?: Champ[] | null; inputFields?: { name: string; type: Ref; defaultValue: string | null }[] | null; enumValues?: { name: string }[] | null; possibleTypes?: { name: string }[] | null };

const RACINE = join(__dirname, "..");
const SCHEMA = JSON.parse(readFileSync(join(RACINE, "docs", "buffer", "schema-2026-10.json"), "utf8")).__schema as { types: TypeSchema[]; queryType: { name: string }; mutationType: { name: string } };
const TYPES = new Map(SCHEMA.types.map((t) => [t.name, t]));
const nomue = (t: Ref): string => (t.ofType ? nomue(t.ofType) : String(t.name));
const ecrit = (t: Ref): string => (t.kind === "NON_NULL" ? `${ecrit(t.ofType!)}!` : t.kind === "LIST" ? `[${ecrit(t.ofType!)}]` : String(t.name));

/* --------------------------- analyse --------------------------- */
type Valeur = { var: string } | { enum: string } | { objet: [string, Valeur][] } | { liste: Valeur[] };
type Selection = { champ: string; args: [string, Valeur][]; sous?: Selection[] } | { sur: string; sous: Selection[] };
interface Operation {
  genre: "query" | "mutation";
  nom: string;
  variables: Map<string, string>;
  selection: Selection[];
}

function analyser(source: string): Operation {
  const jetons = source.match(/\.\.\.|[{}()[\]:!$,]|[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  let i = 0;
  const voir = () => jetons[i];
  const prendre = (attendu?: string) => {
    const j = jetons[i++];
    if (attendu && j !== attendu) throw new Error(`Attendu « ${attendu} », lu « ${j} »`);
    return j;
  };
  const sauterVirgules = () => {
    while (voir() === ",") i++;
  };
  const typeVar = (): string => {
    let t: string;
    if (voir() === "[") {
      prendre("[");
      t = `[${typeVar()}]`;
      prendre("]");
    } else t = prendre();
    if (voir() === "!") {
      prendre("!");
      t += "!";
    }
    return t;
  };
  const valeur = (): Valeur => {
    sauterVirgules();
    if (voir() === "$") {
      prendre("$");
      return { var: prendre() };
    }
    if (voir() === "{") {
      prendre("{");
      const champs: [string, Valeur][] = [];
      while (voir() !== "}") {
        const n = prendre();
        prendre(":");
        champs.push([n, valeur()]);
        sauterVirgules();
      }
      prendre("}");
      return { objet: champs };
    }
    if (voir() === "[") {
      prendre("[");
      const vs: Valeur[] = [];
      while (voir() !== "]") {
        vs.push(valeur());
        sauterVirgules();
      }
      prendre("]");
      return { liste: vs };
    }
    return { enum: prendre() };
  };
  const selection = (): Selection[] => {
    prendre("{");
    const s: Selection[] = [];
    while (voir() !== "}") {
      sauterVirgules();
      if (voir() === "...") {
        prendre("...");
        prendre("on");
        const sur = prendre();
        s.push({ sur, sous: selection() });
        continue;
      }
      const champ = prendre();
      const args: [string, Valeur][] = [];
      if (voir() === "(") {
        prendre("(");
        while (voir() !== ")") {
          sauterVirgules();
          const n = prendre();
          prendre(":");
          args.push([n, valeur()]);
          sauterVirgules();
        }
        prendre(")");
      }
      s.push({ champ, args, sous: voir() === "{" ? selection() : undefined });
    }
    prendre("}");
    return s;
  };
  const genre = prendre() as "query" | "mutation";
  const nom = prendre();
  const variables = new Map<string, string>();
  if (voir() === "(") {
    prendre("(");
    while (voir() !== ")") {
      sauterVirgules();
      prendre("$");
      const n = prendre();
      prendre(":");
      variables.set(n, typeVar());
      sauterVirgules();
    }
    prendre(")");
  }
  const sel = selection();
  if (i !== jetons.length) throw new Error("Texte en trop après l'opération");
  return { genre, nom, variables, selection: sel };
}

/* --------------------------- vérification --------------------------- */
function verifier(op: Operation): string[] {
  const fautes: string[] = [];
  for (const [n, t] of op.variables) if (!TYPES.has(t.replace(/[[\]!]/g, ""))) fautes.push(`variable $${n} : type inconnu ${t}`);
  const utilisees = new Set<string>();

  // Une variable de type `t` peut aller dans un emplacement `attendu` (non nul → nullable permis).
  const compatible = (t: string, attendu: Ref): boolean => {
    if (attendu.kind === "NON_NULL") return t.endsWith("!") && compatible(t.slice(0, -1), attendu.ofType!);
    const base = t.endsWith("!") ? t.slice(0, -1) : t;
    if (attendu.kind === "LIST") return base.startsWith("[") && compatible(base.slice(1, -1), attendu.ofType!);
    return base === attendu.name;
  };
  const valeurPour = (v: Valeur, attendu: Ref, ou: string) => {
    if ("var" in v) {
      utilisees.add(v.var);
      const t = op.variables.get(v.var);
      if (!t) fautes.push(`${ou} : variable $${v.var} non déclarée`);
      else if (!compatible(t, attendu)) fautes.push(`${ou} : $${v.var} est ${t}, attendu ${ecrit(attendu)}`);
      return;
    }
    const sansNul = attendu.kind === "NON_NULL" ? attendu.ofType! : attendu;
    if ("liste" in v) {
      if (sansNul.kind !== "LIST") return void fautes.push(`${ou} : liste inattendue (${ecrit(attendu)})`);
      v.liste.forEach((x, k) => valeurPour(x, sansNul.ofType!, `${ou}[${k}]`));
      return;
    }
    // Une valeur seule va dans une liste (règle GraphQL).
    const cible = sansNul.kind === "LIST" ? (sansNul.ofType!.kind === "NON_NULL" ? sansNul.ofType!.ofType! : sansNul.ofType!) : sansNul;
    const t = TYPES.get(nomue(cible));
    if ("objet" in v) {
      if (t?.kind !== "INPUT_OBJECT") return void fautes.push(`${ou} : objet inattendu (${ecrit(attendu)})`);
      for (const [n, x] of v.objet) {
        const f = t.inputFields?.find((y) => y.name === n);
        if (!f) fautes.push(`${ou}.${n} : champ d'entrée inconnu de ${t.name}`);
        else valeurPour(x, f.type, `${ou}.${n}`);
      }
      for (const f of t.inputFields ?? []) if (f.type.kind === "NON_NULL" && f.defaultValue === null && !v.objet.some(([n]) => n === f.name)) fautes.push(`${ou} : ${t.name}.${f.name} obligatoire absent`);
      return;
    }
    if (t?.kind !== "ENUM" || !t.enumValues?.some((e) => e.name === v.enum)) fautes.push(`${ou} : « ${v.enum} » n'est pas une valeur de ${ecrit(attendu)}`);
  };
  const parcourir = (sel: Selection[], nomType: string, chemin: string) => {
    const t = TYPES.get(nomType);
    if (!t) return void fautes.push(`${chemin} : type inconnu ${nomType}`);
    for (const s of sel) {
      if ("sur" in s) {
        const possibles = new Set([nomType, ...(t.possibleTypes ?? []).map((p) => p.name)]);
        const cible = TYPES.get(s.sur);
        if (!cible) fautes.push(`${chemin} : fragment sur type inconnu ${s.sur}`);
        else if (!possibles.has(s.sur) && !(cible.possibleTypes ?? []).some((p) => possibles.has(p.name))) fautes.push(`${chemin} : « ... on ${s.sur} » impossible ici`);
        parcourir(s.sous, s.sur, `${chemin}<${s.sur}>`);
        continue;
      }
      if (s.champ === "__typename") continue;
      const f = t.fields?.find((x) => x.name === s.champ);
      const ici = `${chemin}.${s.champ}`;
      if (!f) {
        fautes.push(`${ici} : champ inconnu de ${nomType}`);
        continue;
      }
      for (const [n, v] of s.args) {
        const a = f.args.find((x) => x.name === n);
        if (!a) fautes.push(`${ici}(${n}) : argument inconnu`);
        else valeurPour(v, a.type, `${ici}(${n})`);
      }
      for (const a of f.args) if (a.type.kind === "NON_NULL" && a.defaultValue === null && !s.args.some(([n]) => n === a.name)) fautes.push(`${ici} : argument obligatoire ${a.name} absent`);
      const retour = TYPES.get(nomue(f.type));
      const feuille = retour?.kind === "SCALAR" || retour?.kind === "ENUM";
      if (feuille && s.sous) fautes.push(`${ici} : ${retour!.name} n'a pas de sous-champs`);
      if (!feuille && !s.sous) fautes.push(`${ici} : sous-champs requis (${retour?.name})`);
      if (s.sous && retour) parcourir(s.sous, retour.name, ici);
    }
  };
  parcourir(op.selection, op.genre === "query" ? SCHEMA.queryType.name : SCHEMA.mutationType.name, op.nom);
  for (const n of op.variables.keys()) if (!utilisees.has(n)) fautes.push(`variable $${n} déclarée mais jamais utilisée`);
  return fautes;
}

/** Une valeur JSON (variables) contre un type d'entrée : obligatoires présents, aucun champ inconnu, énumérations. */
function verifierEntree(valeur: unknown, attendu: Ref, ou: string): string[] {
  const fautes: string[] = [];
  if (attendu.kind === "NON_NULL") {
    if (valeur === undefined || valeur === null) return [`${ou} : obligatoire`];
    return verifierEntree(valeur, attendu.ofType!, ou);
  }
  if (valeur === undefined || valeur === null) return [];
  if (attendu.kind === "LIST") {
    if (!Array.isArray(valeur)) return [`${ou} : liste attendue`];
    return valeur.flatMap((v, k) => verifierEntree(v, attendu.ofType!, `${ou}[${k}]`));
  }
  const t = TYPES.get(String(attendu.name))!;
  if (t.kind === "INPUT_OBJECT") {
    if (typeof valeur !== "object" || Array.isArray(valeur)) return [`${ou} : objet attendu (${t.name})`];
    for (const k of Object.keys(valeur)) if (!t.inputFields!.some((f) => f.name === k)) fautes.push(`${ou}.${k} : inconnu de ${t.name}`);
    for (const f of t.inputFields!) fautes.push(...verifierEntree((valeur as Record<string, unknown>)[f.name], f.type, `${ou}.${f.name}`));
    return fautes;
  }
  if (t.kind === "ENUM" && !t.enumValues!.some((e) => e.name === valeur)) return [`${ou} : « ${String(valeur)} » hors de ${t.name}`];
  if (t.kind === "SCALAR") {
    const attenduJs = t.name === "Boolean" ? "boolean" : t.name === "Int" || t.name === "Float" ? "number" : "string";
    if (typeof valeur !== attenduJs) return [`${ou} : ${t.name} attendu, lu ${typeof valeur}`];
  }
  return fautes;
}

describe("R1 — requêtes du studio contre le schéma relevé de Buffer", () => {
  const toutes = { ...requetes, REQUETE_POST_BUFFER } as Record<string, string>;

  it("le relevé est un vrai schéma, sans aucune donnée de compte", () => {
    expect(SCHEMA.types.length).toBeGreaterThan(100);
    const texte = readFileSync(join(RACINE, "docs", "buffer", "schema-2026-10.json"), "utf8");
    expect(texte).not.toMatch(/@axion-ia\.com|Bearer |"organizationId":\s*"[0-9a-f]{24}"/);
  });

  for (const [nom, source] of Object.entries(toutes)) {
    it(`${nom} : chaque champ, argument, valeur et variable existe, avec le bon type`, () => {
      expect(verifier(analyser(source))).toEqual([]);
    });
  }

  it("le vérificateur rougit vraiment (champ, argument, énumération, type de variable faux)", () => {
    const faux = [
      "query A($id: PostId!) { post(input: { id: $id }) { id statut } }",
      "query A($id: PostId!) { post(entree: { id: $id }) { id } }",
      "query A($o: OrganizationId!) { posts(input: { organizationId: $o, sort: [{ field: createdAt, direction: descendant }] }) { edges { cursor } } }",
      "query A($id: String!) { post(input: { id: $id }) { id } }",
      "query A($id: PostId!) { post(input: { id: $id }) { channel } }",
    ];
    for (const f of faux) expect(verifier(analyser(f)).length, f).toBeGreaterThan(0);
  });

  it("une SEULE mutation, createPost ; jamais de suppression ni de modification chez Buffer", () => {
    const mutations = Object.values(toutes).filter((q) => /^\s*mutation\b/.test(q));
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatch(/createPost\(/);
    const sources = ["src/fournisseurs/publication/buffer.ts", "src/fournisseurs/publication/requetes.ts", "src/services/buffer.ts", "src/services/publications.ts"].map((f) => readFileSync(join(RACINE, f), "utf8")).join("\n");
    expect(sources).not.toMatch(/deletePost|editPost|deleteIdea|movePostInQueue|removePost/);
  });

  const CREATE = TYPES.get("CreatePostInput")!;
  const cas: [IdReseau, "brouillon" | "programmer"][] = [
    ["instagram", "brouillon"],
    ["facebook", "brouillon"],
    ["linkedin", "programmer"],
    ["tiktok", "brouillon"],
    ["youtube", "programmer"],
    ["youtube-shorts", "brouillon"],
  ];
  for (const [reseau, mode] of cas) {
    it(`entrée createPost (${reseau}, ${mode}) conforme à CreatePostInput`, () => {
      const input = entreeCreerPost({ reseau, texte: "Texte\n\n#mot", date: new Date(Date.now() + 86_400_000).toISOString(), fichierCle: "https://exemple.r2.cloudflarestorage.com/v.mp4?X-Amz-Expires=604800", mode, canalId: "e00003000000000000000000", titre: "Un titre" });
      expect(verifierEntree(input, { kind: "NON_NULL", name: null, ofType: { kind: "INPUT_OBJECT", name: CREATE.name } }, "input")).toEqual([]);
    });
  }
  // L1-10 : premier commentaire et texte alternatif, vérifiés champ par champ contre le schéma relevé.
  for (const reseau of ["instagram", "facebook", "linkedin"] as const) {
    it(`entrée createPost (${reseau}) avec premier commentaire conforme à CreatePostInput`, () => {
      const input = entreeCreerPost({ reseau, texte: "Texte", date: new Date(Date.now() + 86_400_000).toISOString(), fichierCle: "https://exemple.test/v.mp4", mode: "brouillon", canalId: "e00003000000000000000000", premierCommentaire: "Le lien" });
      expect(verifierEntree(input, { kind: "NON_NULL", name: null, ofType: { kind: "INPUT_OBJECT", name: CREATE.name } }, "input")).toEqual([]);
    });
  }
  it("entrée createPost avec images et altText conforme à CreatePostInput", () => {
    const input = entreeCreerPost({ reseau: "instagram", texte: "Texte", date: new Date(Date.now() + 86_400_000).toISOString(), fichierCle: "", mode: "brouillon", canalId: "e00003000000000000000000", images: [{ url: "https://exemple.test/i.png", texteAlternatif: "Un schéma" }] });
    expect(verifierEntree(input, { kind: "NON_NULL", name: null, ofType: { kind: "INPUT_OBJECT", name: CREATE.name } }, "input")).toEqual([]);
  });
});
