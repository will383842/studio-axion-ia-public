/**
 * SOURCE DES IDÉES DU COMITÉ ÉDITORIAL (lot « Idées : comité éditorial », 17/10). Serveur seulement.
 *
 * L'Usine de Will (appli à part, sans accès à Claude) expose `POST {USINE_URL}/api/porte/sujets` (Bearer
 * `USINE_PORTE_SECRET`) qui rend N combinaisons de sujets neuves tirées de ses bases. Le CLIENT RÉEL de cette porte est
 * fait par un autre lot (branche `ecrire/idees-de-l-usine`) : il le branche ici par `brancherSourceIdees(source)`.
 * En attendant, la source SIMULÉE (déterministe, aucun réseau) sert le travail de fond et les essais.
 */
import "server-only";
import { graine, tirer } from "@/generateur/roles/commun";

/** Une combinaison de l'Usine : sa signature (unique), ses parts (identifiants) et ses textes. */
export interface CombinaisonUsine {
  signature: string;
  parts: Record<string, string | null>;
  /** Textes : métier, taille, service, douleur, casUsage, sujet (actualité), format, familleAccroche, fin. */
  textes: Record<string, string>;
}

/** Ce que le comité attend d'une source : N combinaisons NEUVES (jamais tirées avant, autant que possible). */
export interface SourceIdees {
  /** Nom court (Journal). */
  nom: string;
  /** `simulee` : aucune vraie idée (jamais montrée comme réelle). */
  simulee: boolean;
  tirer(n: number): Promise<CombinaisonUsine[]>;
}

const METIERS = ["expert-comptable", "agent immobilier", "artisan plombier", "directeur d'usine", "DRH de groupe", "gérant de restaurant"];
const TAILLES = ["TPE de 3 personnes", "PME de 40 salariés", "ETI de 400 salariés", "grand groupe"];
const DOULEURS = ["relance les devis à la main chaque vendredi", "ressaisit les factures fournisseurs dans le logiciel", "trie les candidatures une par une", "répond aux mêmes mails clients toute la journée", "prépare le reporting mensuel à la main"];
const CAS = ["assistant qui prépare la relance et la soumet", "lecture automatique des factures", "tri des candidatures avec résumé", "réponses préparées à valider d'un geste", "tableau de bord mis à jour seul"];
const SUJETS = ["un nouveau modèle sait lire les PDF", "les agents IA dans les entreprises", "la facture électronique obligatoire"];
const FORMATS = ["face caméra", "cas concret", "tableau animé"];
const ACCROCHES = ["constat chiffré", "question directe", "avant / après"];
const FINS = ["réservez un diagnostic", "abonnez-vous"];

/** Source simulée : combinaisons déterministes, signature unique par tirage (aucun réseau, aucune vraie idée). */
export function sourceIdeesSimulee(): SourceIdees {
  let tirage = 0;
  return {
    nom: "Usine (simulation)",
    simulee: true,
    async tirer(n: number) {
      tirage++;
      return Array.from({ length: Math.max(0, n) }, (_, i) => {
        const g = graine("usine", tirage, i);
        const textes = {
          metier: tirer(METIERS, g),
          taille: tirer(TAILLES, g, 1),
          service: "automatisation sur mesure",
          douleur: tirer(DOULEURS, g, 2),
          casUsage: tirer(CAS, g, 2),
          sujet: tirer(SUJETS, g, 3),
          format: tirer(FORMATS, g, 4),
          familleAccroche: tirer(ACCROCHES, g, 5),
          fin: tirer(FINS, g, 6),
        };
        return { signature: `sim-${tirage}-${i}-${g.toString(36)}`, parts: { metier: String(g % 97), douleur: String(g % 89) }, textes };
      });
    },
  };
}

const cleSource = Symbol.for("studio-axion-ia.source-idees");
type AvecSource = typeof globalThis & { [cleSource]?: SourceIdees | null };

/** Branche la source réelle (client de la porte de l'Usine, autre lot) ; `null` : retour à la simulation. */
export function brancherSourceIdees(source: SourceIdees | null): void {
  (globalThis as AvecSource)[cleSource] = source;
}

/** La source branchée, sinon la simulation. */
export function sourceIdees(): SourceIdees {
  const g = globalThis as AvecSource;
  return g[cleSource] ?? (g[cleSource] = sourceIdeesSimulee());
}
