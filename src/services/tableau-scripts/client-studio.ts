/**
 * CLIENT DU GÉNÉRATEUR DE SCRIPTS DU TABLEAU ANIMÉ, branché sur le chemin de dépense plafonné du studio.
 *
 * Chaque passe (angle, écriture, relance, relecture) devient UN rôle exécuté par `executerRolePourVideo` : plafond
 * PROPRE de l'écriture pour cette vidéo (réglage `tableau.plafondScriptUsd`, défaut : le pire cas d'une génération),
 * limite du mois, pré-vol, réservation et dépense réelle enregistrée. Ce fichier n'appelle jamais Claude lui-même.
 *
 * Le socle de Will (`socle-will.ts`, le même que le générateur) part TEL QUEL, octet pour octet, pour toutes les passes
 * (`<contexte_axion>` = sa charte, `<style_will>` = son style, `<preuves>` = ses preuves : préfixe mis en cache 1 h,
 * partagé avec le générateur) ; `<gagnants>` = les modèles de ton du format. Les blocs propres au tableau vont APRÈS,
 * dans `<recette_format>` : la phrase de priorité (les règles du tableau passent avant la charte quand elles diffèrent),
 * les règles du tableau, puis (écriture, relecture) le script témoin v3 et le contre-exemple. La consigne de la passe
 * en consigne, la demande en partie variable ; la sortie attendue est le schéma de la passe. Socle illisible : journalisé,
 * le tableau écrit avec ses seules règles, comme avant (jamais une vidéo bloquée). Claude non relié pour les textes
 * (simulation) : arrêt clair, rien n'est écrit ni payé.
 */
import "server-only";
import type { z } from "zod";
import { schemaAngle, schemaEcriture, schemaRelecture, type AppelTrace } from "@/domaine/scripts-tableau";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import type { Id } from "@/domaine/types";
import { executerRolePourVideo, plafondScriptTableau, type PlafondPropre } from "../depense-claude-video";
import { ArretClientScripts, type ClientScripts } from "./index";

/** Le format servi (ses modèles de ton : `parametresGenerateur`). */
const FORMAT_TABLEAU = "tableau-anime";

/** Étape des dépenses de l'écriture (préfixe du plafond propre). */
export const ETAPE_SCRIPT_TABLEAU = "Tableau · script";

const SCHEMAS: Record<AppelTrace["passe"], z.ZodType> = { angle: schemaAngle, ecriture: schemaEcriture, relance: schemaEcriture, relecture: schemaRelecture };
const NOMS: Record<AppelTrace["passe"], string> = { angle: "accroches", ecriture: "écriture", relance: "relance de l'écriture", relecture: "relecture" };

/** Les blocs en cache du socle de Will (charte, style, preuves, modèles de ton) ; absent : socle indisponible. */
export type SocleTableau = EntreeRole["contexte"];

/** Will, 14/10 : dite entre sa charte et les règles du tableau, quand les deux sont données. */
export const PRIORITE_REGLES_TABLEAU = "Pour ce format, les règles du tableau ci-dessous passent avant la charte générale quand elles diffèrent.";

/**
 * Le rôle et l'entrée d'une requête du générateur (PUR). Le socle passe sans retouche ; les blocs du tableau (règles,
 * puis script témoin s'il y en a) forment la recette, précédée de la phrase de priorité quand il y a un socle.
 * `socle` absent : la seule recette du tableau (comme avant : ses règles et son script témoin).
 */
export function roleDeRequete(r: RequeteClaude, passe: AppelTrace["passe"], socle?: SocleTableau): { role: DefinitionRole; entree: EntreeRole } {
  const blocs = r.systeme.map((b) => b.texte);
  const consigne = blocs.at(-1) ?? "";
  const propres = blocs.slice(0, -1).map((b) => b.trim()).filter(Boolean);
  const avecSocle = !!(socle?.contexteAxion?.trim() || socle?.styleWill?.trim() || socle?.preuves?.trim());
  // Un cadre du format donné par le socle (`recette`, aucun aujourd'hui pour le tableau) passe en tête, jamais perdu.
  const recette = [...(socle?.recette?.trim() ? [socle.recette.trim()] : []), ...(avecSocle && propres.length ? [PRIORITE_REGLES_TABLEAU] : []), ...propres].join("\n\n");
  const { contexteAxion, styleWill, preuves, gagnants } = socle ?? {};
  // Méthode courte : un bloc du tableau marqué « 1h » met la recette entière en cache 1 h (partagée par les passes).
  const cacheRecette = r.systeme.slice(0, -1).some((b) => b.cache === "1h");
  return {
    role: { id: `tableau-script-${passe}`, version: 2, consigne, schema: SCHEMAS[passe], modele: r.modele, effort: r.effort, maxTokens: r.maxTokens, simuler: () => "", ...(cacheRecette ? { cacheRecette } : {}) },
    entree: {
      contexte: { ...(contexteAxion ? { contexteAxion } : {}), ...(styleWill ? { styleWill } : {}), ...(preuves ? { preuves } : {}), ...(gagnants ? { gagnants } : {}), ...(recette ? { recette } : {}) },
      variable: r.messages.map((m) => m.contenu).join("\n\n"),
    },
  };
}

/** Le socle réel de Will pour le tableau animé : les modèles de ton viennent des paramètres du format. */
export async function socleWillTableau(): Promise<SocleTableau> {
  const [{ blocsSocleWill }, { parametresGenerateur }] = await Promise.all([import("../socle-will"), import("@/donnees/generateur/parametres-generateur")]);
  return blocsSocleWill(parametresGenerateur(FORMAT_TABLEAU));
}

/** Enveloppe un chargement du socle : un échec est journalisé et rend `undefined` (le tableau écrit comme avant). */
export function socleSansEchec(charger: () => Promise<SocleTableau>): () => Promise<SocleTableau | undefined> {
  return async () => {
    try {
      return await charger();
    } catch (e) {
      console.error(`[tableau] socle de Will illisible, écriture avec les seules règles du tableau : ${e instanceof Error ? `${e.name} : ${e.message.slice(0, 200)}` : "erreur"}`);
      return undefined;
    }
  };
}

/**
 * Client réel : chaque passe par le chemin plafonné, sur le plafond de l'écriture de la vidéo. Le plafond couvre les
 * QUATRE appels possibles (accroches, écriture, relance, relecture : `pireCasUsd` = leur pire cas, marge de réservation
 * comprise) ; `plafond.depuis` : l'enveloppe ouverte par la confirmation du prix (une écriture précédente de la même
 * vidéo ne la mange pas). Dépassement : arrêt expliqué, rien ne part.
 */
export function clientScriptsStudio(videoId: Id, pireCasUsd: number, plafond: PlafondPropre = plafondScriptTableau(pireCasUsd), chargerSocle: () => Promise<SocleTableau | undefined> = socleSansEchec(socleWillTableau)): ClientScripts {
  // Lu UNE fois par écriture : les quatre passes voient la même charte (et le même cache).
  let socle: Promise<SocleTableau | undefined> | undefined;
  return {
    simule: false,
    async appeler(requete, passe) {
      socle ??= chargerSocle().catch(() => undefined);
      const { role, entree } = roleDeRequete(requete, passe, await socle);
      const r = await executerRolePourVideo(videoId, role, entree, { etape: `${ETAPE_SCRIPT_TABLEAU} · ${NOMS[passe]}`, plafondPropre: plafond });
      if (!r.ok) throw new ArretClientScripts(r.message);
      if (r.simule) throw new ArretClientScripts("Claude n'est pas relié pour l'écriture : aucun script n'a été écrit, rien n'a été payé.");
      // Appel fait et payé, réponse inutilisable : refaire le même appel ne servirait à rien (arrêt définitif).
      if (r.stopReason === "max_tokens") throw new ArretClientScripts(`La réponse de la passe « ${passe === "angle" ? "angle" : NOMS[passe]} » a été coupée avant la fin (trop longue).`, true);
      if (r.donnees === undefined) throw new ArretClientScripts(`La réponse de la passe « ${passe === "angle" ? "angle" : NOMS[passe]} » ne suit pas le format attendu${r.invalide ? ` : ${r.invalide}` : "."}`, true);
      return {
        texte: JSON.stringify(r.donnees),
        modeleDemande: requete.modele,
        modele: r.modele,
        replis: [],
        stopReason: r.stopReason ?? "end_turn",
        jetons: r.jetons ?? { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 },
        coutUsd: r.coutUsd,
      };
    },
  };
}
