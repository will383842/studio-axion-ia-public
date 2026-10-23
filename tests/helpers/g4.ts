/**
 * Aides des tests du lot G4 (chaîne d'écriture) : exécutant SIMULÉ (aucune clé, aucun appel), données du banc.
 */
import type { z } from "zod";
import type { ElementDiversite, TournureControle } from "@/domaine/controles-script";
import { DRAPEAUX_TOURNURES, TOURNURES_CALIBREES } from "@/donnees/generateur/tournures-calibrees";
import type { ExecuteurRoles, SortieExecution } from "@/generateur/chaine";
import { briefMinimal, etapeZero, type ResultatEtapeZero } from "@/generateur/etape-zero";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { CONTEXTE_BANC, MAINTENANT_BANC, type SujetBanc } from "../generateur/banc/registre-banc-g4";

export const TOURNURES_G4: TournureControle[] = TOURNURES_CALIBREES.map((t) => ({ id: t.id, motif: t.motif, regex: t.regex, drapeaux: DRAPEAUX_TOURNURES, niveau: t.niveau }));

/** Exécutant simulé : la sortie déterministe de chaque rôle ; garde les appels (rôle, partie variable). */
export function executeurSimule(remplacer: Partial<Record<string, (entree: EntreeRole) => unknown>> = {}) {
  const appels: { role: string; entree: EntreeRole }[] = [];
  const executeur: ExecuteurRoles = {
    async executer<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<SortieExecution<z.infer<S>>> {
      appels.push({ role: role.id, entree });
      const brut = remplacer[role.id] ? remplacer[role.id]!(entree) : role.simuler(entree);
      const donnees = role.schema ? (role.schema.parse(brut) as z.infer<S>) : undefined;
      return { ok: true, simule: true, donnees, coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
    },
  };
  return { executeur, appels };
}

/** Étape 0 d'un sujet du banc (série de diversité facultative). */
export function etapeZeroBanc(s: SujetBanc, serieDiversite?: ElementDiversite[], extra: Partial<Parameters<typeof briefMinimal>[0]> = {}): ResultatEtapeZero {
  const brief = briefMinimal({ idee: s.idee, phraseWill: s.phraseWill, reseaux: s.reseaux, formatId: "avocat", pilier: s.pilier.id, ...extra });
  return etapeZero({ maintenant: MAINTENANT_BANC, brief, mode: extra.mode ?? "avatar", matieres: s.matieres, preuves: s.preuves, contexteAxion: CONTEXTE_BANC, serieDiversite, tournures: TOURNURES_G4 });
}
