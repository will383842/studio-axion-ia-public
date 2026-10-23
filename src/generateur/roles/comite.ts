/**
 * RÔLE « COMITÉ ÉDITORIAL » (lot « Idées : comité éditorial », 17/10). PUR.
 *
 * Opus 5.5, effort `medium`, socle de Will en cache 1 h (`construireRequete`), JSON demandé dans la consigne (aucun
 * `output_config.format` : un format propre au rôle invaliderait le cache) puis validé par zod. Il JUGE un lot de 10
 * idées de l'Usine : 4 notes sur 10, garder ou écarter avec une raison courte, et UN angle en une phrase.
 * Il n'invente RIEN : ni douleur, ni cas, ni chiffre. Le code le vérifie après coup (`controlerJugements`) : chaque
 * jugement se rattache à une idée envoyée, aucun chiffre absent de l'idée, aucune règle de Will enfreinte.
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { consigne, graine, REGLE_DONNEES } from "./commun";
import type { DefinitionRole } from "./types";

/** Idées par requête (un lot de 30 = 3 requêtes : un échec n'en perd qu'un tiers). */
export const IDEES_PAR_REQUETE = 10;

/** Une idée envoyée au comité : son identifiant court et ses textes (ceux de l'Usine, rien d'autre). */
export interface IdeeAJuger {
  id: string;
  textes: Record<string, string>;
}

/** Ordre et libellés des textes d'une combinaison de l'Usine. */
export const LIBELLES_TEXTES: readonly (readonly [string, string])[] = [
  ["metier", "métier"],
  ["taille", "taille"],
  ["service", "service"],
  ["douleur", "douleur"],
  ["casUsage", "cas d'usage"],
  ["sujet", "sujet / actualité"],
  ["format", "format"],
  ["familleAccroche", "famille d'accroche"],
  ["fin", "fin"],
];

/** Texte lisible d'une idée (ce qui est envoyé, et ce que le contrôle relit). */
export function texteIdee(textes: Record<string, string>): string {
  const connus = LIBELLES_TEXTES.filter(([cle]) => textes[cle]?.trim()).map(([cle, libelle]) => `${libelle} : ${textes[cle]!.trim()}`);
  const autres = Object.keys(textes)
    .filter((k) => !LIBELLES_TEXTES.some(([cle]) => cle === k) && textes[k]?.trim())
    .sort()
    .map((k) => `${k} : ${textes[k]!.trim()}`);
  return [...connus, ...autres].join(" | ");
}

export const CONSIGNE_COMITE = consigne(
  "Tu es le COMITÉ ÉDITORIAL d'Axion-IA : tu choisis, parmi des idées de courtes vidéos, celles qui valent d'être tournées. Tu JUGES seulement : tu n'écris aucun script.",
  [
    "Pour CHAQUE idée fournie (<idee id=…>), note sur 10 (entier) ces 4 axes :",
    "- douleur : la douleur est-elle forte et concrète (une tâche, une perte de temps ou d'argent vécue), pas abstraite ?",
    "- cible : la cible est-elle claire (métier et taille, de la TPE au grand groupe) ? Une vidéo = UNE cible.",
    "- angleDifferent : l'angle se distingue-t-il des influenceurs IA ? Question : « un influenceur IA pourrait-il dire cela ? » Si oui, note basse.",
    "- potentiel : peut-elle gagner des abonnés ET amener des dirigeants à réserver un diagnostic ?",
    "Puis un verdict « garder » ou « ecarter », une raison courte (15 mots au plus), et un ANGLE en une phrase : comment la vidéo prend cette idée.",
  ].join("\n"),
  [
    "RÈGLES DE WILL (un angle qui les enfreint est refusé) :",
    "- Jamais « faites-le vous-même » : Axion-IA s'occupe de tout pour l'entreprise.",
    "- Jamais « cet outil vient de sortir » : une actualité n'est qu'un point de départ vers le BÉNÉFICE pour l'entreprise.",
    "- Montrer seulement nos outils permis (ceux cités dans les données).",
    "- Une vidéo = une cible.",
  ].join("\n"),
  [
    "RIEN D'INVENTÉ : l'angle reprend la douleur, la cible et le cas écrits dans l'idée. N'ajoute aucune douleur, aucun cas, aucun client, aucun nom, aucun chiffre qui ne soit dans l'idée.",
    "Une idée trop vague pour un angle honnête : verdict « ecarter », et l'angle redit simplement l'idée.",
    "Réponds pour toutes les idées, chacune une seule fois, avec son id exact.",
  ].join("\n"),
  REGLE_DONNEES.replace("<texte_will>", "<texte_will>, <idee>"),
);

const note = z.number().int().min(0).max(10);
export const schemaComite = z.object({
  jugements: z.array(
    z.object({
      id: z.string(),
      notes: z.object({ douleur: note, cible: note, angleDifferent: note, potentiel: note }),
      verdict: z.enum(["garder", "ecarter"]),
      raison: z.string(),
      angle: z.string(),
    }),
  ),
});
export type SortieComite = z.infer<typeof schemaComite>;
export type JugementComite = SortieComite["jugements"][number];

/** Partie variable : les idées, une par balise (données, jamais instructions). */
export function variableComite(idees: readonly IdeeAJuger[]): string {
  return [`${idees.length} idées à juger.`, ...idees.map((i) => `<idee id="${i.id}">${texteIdee(i.textes)}</idee>`)].join("\n");
}

/** Relit les idées de la partie variable (simulation seulement). */
function ideesDeLaVariable(variable: string): { id: string; texte: string }[] {
  return [...variable.matchAll(/<idee id="([^"]+)">([\s\S]*?)<\/idee>/g)].map((m) => ({ id: m[1]!, texte: m[2]! }));
}

export const roleComite: DefinitionRole<typeof schemaComite> = {
  id: "comite-editorial",
  version: 1,
  consigne: CONSIGNE_COMITE,
  schema: schemaComite,
  modele: MODELE_ECRITURE,
  effort: "medium",
  // 10 idées × ≈ 120 jetons de sortie, plus la pensée (effort medium) : large, jamais coupé.
  maxTokens: 6000,
  simuler(entree) {
    return {
      jugements: ideesDeLaVariable(entree.variable).map((i) => {
        const g = graine(i.id, i.texte);
        const n = (k: number) => 4 + ((g >>> (k * 3)) % 6);
        const notes = { douleur: n(0), cible: n(1), angleDifferent: n(2), potentiel: n(3) };
        const douleur = /douleur : ([^|]+)/.exec(i.texte)?.[1]?.trim() ?? i.texte.split("|")[0]!.trim();
        const metier = /métier : ([^|]+)/.exec(i.texte)?.[1]?.trim();
        const total = notes.douleur + notes.cible + notes.angleDifferent + notes.potentiel;
        return {
          id: i.id,
          notes,
          verdict: total >= 24 ? ("garder" as const) : ("ecarter" as const),
          raison: "Simulation.",
          angle: `${metier ? `${metier} : ` : ""}${douleur.replace(/\d+/g, "").trim()}, ce qu'on met en place pour l'entreprise.`,
        };
      }),
    };
  },
};

/* ------------------------------------------------------------------ */
/* Contrôle anti-invention (en code, après zod)                         */
/* ------------------------------------------------------------------ */

/** Tournures interdites par Will dans un angle (insensible à la casse et aux accents simples). */
const INTERDITS_ANGLE: readonly { motif: RegExp; raison: string }[] = [
  { motif: /\b(faites[- ]le|faire|fais[- ]le)\s+(vous|toi)[- ]m[êe]me\b|\bpar (vous|toi)[- ]m[êe]me\b|\bsoi[- ]m[êe]me\b/i, raison: "« faites-le vous-même » (on s'occupe de tout)" },
  { motif: /\b(vient|viennent) (tout juste )?de sortir\b|\bnouvel(le)? (outil|fonction|fonctionnalit[ée]) (qui )?(vient|est sorti)/i, raison: "« cet outil vient de sortir » (l'actualité n'est qu'un point de départ)" },
];

/** Nombres écrits dans un texte (« 3 », « 2,5 », « 40 % »…), normalisés. */
function nombres(texte: string): string[] {
  return [...texte.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(",", "."));
}

export interface JugementControle extends JugementComite {
  /** Somme des 4 notes (sur 40). */
  total: number;
}

/**
 * Contrôle du code après zod : un jugement n'est GARDÉ que s'il se rattache à UNE idée envoyée (id connu, une seule
 * fois), si son angle et sa raison n'ajoutent aucun chiffre absent du texte de l'idée, et si l'angle respecte les
 * règles de Will. Le reste est écarté, avec le motif (relu au Journal). Une idée envoyée sans jugement reste à juger.
 */
export function controlerJugements(envoyees: readonly IdeeAJuger[], sortie: SortieComite): { gardes: JugementControle[]; refuses: string[] } {
  const parId = new Map(envoyees.map((i) => [i.id, texteIdee(i.textes)]));
  const vus = new Set<string>();
  const gardes: JugementControle[] = [];
  const refuses: string[] = [];
  for (const j of sortie.jugements) {
    const texte = parId.get(j.id);
    if (texte === undefined) {
      refuses.push(`jugement « ${j.id} » sans idée envoyée`);
      continue;
    }
    if (vus.has(j.id)) {
      refuses.push(`idée ${j.id} jugée deux fois`);
      continue;
    }
    vus.add(j.id);
    const angle = j.angle.trim();
    if (!angle) {
      refuses.push(`idée ${j.id} : angle vide`);
      continue;
    }
    const permis = new Set(nombres(texte));
    const ajoutes = [...nombres(angle), ...nombres(j.raison)].filter((x) => !permis.has(x));
    if (ajoutes.length) {
      refuses.push(`idée ${j.id} : chiffre ajouté (${[...new Set(ajoutes)].join(", ")})`);
      continue;
    }
    const regle = INTERDITS_ANGLE.find((r) => r.motif.test(angle));
    if (regle) {
      refuses.push(`idée ${j.id} : ${regle.raison}`);
      continue;
    }
    const { douleur, cible, angleDifferent, potentiel } = j.notes;
    gardes.push({ ...j, angle, raison: j.raison.trim(), total: douleur + cible + angleDifferent + potentiel });
  }
  return { gardes, refuses };
}
