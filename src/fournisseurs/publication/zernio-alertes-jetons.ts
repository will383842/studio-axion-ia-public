/**
 * ALERTES JETONS ZERNIO (STU-JETONS) : PUR, sans réseau ni base. Dit quels sujets méritent une alerte :
 * - un compte relié est déconnecté (`isActive: false`) ou à reconnecter (`needsReconnection: true`) ;
 * - son jeton est expiré, ou expire dans moins de 7 jours (`metadata.tokenExpiresAt`, documenté par Zernio ; absent = jeton sans expiration) ;
 * - le quota restant passe sous 20 % (valeur fournie par l'appelant : aucune route Zernio du client ne la donne aujourd'hui, voir la PR).
 * Un champ absent ou illisible ne déclenche JAMAIS d'alerte : on n'invente rien. Aucun identifiant ni nom de personne dans les messages (réseau + rang).
 */
import type { CompteZernio } from "./zernio-client";

export const JETON_ALERTE_JOURS = 7;
export const QUOTA_ALERTE_PCT = 20;
const JOUR_MS = 24 * 3600_000;

export interface CompteSurveille {
  id: string;
  nom: string;
  actif?: boolean;
  aReconnecter?: boolean;
  expireLe?: string | number | null;
}
export interface AlerteJeton {
  /** Un sujet = au plus une alerte par jour (`jeton:<idCompte>` ou `quota`). */
  sujet: string;
  message: string;
}

/** Ne lit que les champs documentés par Zernio ; le reste du compte est ignoré. */
export function compteSurveilleDepuisZernio(c: CompteZernio): CompteSurveille {
  const meta = typeof c.metadata === "object" && c.metadata !== null ? (c.metadata as Record<string, unknown>) : {};
  const exp = meta.tokenExpiresAt;
  return {
    id: c._id,
    // Libellé NEUTRE : jamais le nom affiché ni le pseudo (un compte personnel porte le nom d'une personne). Le rang est ajouté à l'alerte.
    nom: c.platform,
    actif: typeof c.isActive === "boolean" ? c.isActive : undefined,
    aReconnecter: typeof c.needsReconnection === "boolean" ? c.needsReconnection : undefined,
    expireLe: typeof exp === "string" || typeof exp === "number" ? exp : undefined,
  };
}

/** Nombre < 1e12 = secondes Unix (les jetons Meta le sont souvent) ; sinon millisecondes. Illisible = NaN (aucune alerte). */
function dateEnMs(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? (v < 1e12 ? v * 1000 : v) : NaN;
  return Date.parse(v);
}

export function alertesJetonsZernio(e: { comptes: readonly CompteSurveille[]; quotaRestantPct?: number | null; maintenant: number }): AlerteJeton[] {
  const sortie: AlerteJeton[] = [];
  // Libellé neutre : réseau, plus un rang (ordre des identifiants) quand plusieurs comptes du même réseau existent.
  const parReseau = new Map<string, string[]>();
  for (const c of e.comptes) parReseau.set(c.nom, [...(parReseau.get(c.nom) ?? []), c.id].sort());
  for (const brut of e.comptes) {
    const ids = parReseau.get(brut.nom) ?? [];
    const c = { ...brut, nom: ids.length > 1 ? `${brut.nom} n°${ids.indexOf(brut.id) + 1}` : brut.nom };
    const sujet = `jeton:${c.id}`;
    if (c.actif === false || c.aReconnecter === true) {
      sortie.push({ sujet, message: `${c.nom} : le compte est déconnecté de Zernio. Reconnectez-le pour que les publications repartent.` });
      continue;
    }
    const fin = dateEnMs(c.expireLe);
    if (!Number.isFinite(fin)) continue;
    if (fin <= e.maintenant) sortie.push({ sujet, message: `${c.nom} : le jeton du réseau est expiré. Reconnectez le compte dans Zernio.` });
    else if (fin - e.maintenant < JETON_ALERTE_JOURS * JOUR_MS) {
      const jours = Math.max(1, Math.ceil((fin - e.maintenant) / JOUR_MS));
      sortie.push({ sujet, message: `${c.nom} : le jeton du réseau expire dans ${jours} jour${jours > 1 ? "s" : ""}. Reconnectez le compte dans Zernio avant.` });
    }
  }
  const q = e.quotaRestantPct;
  if (typeof q === "number" && Number.isFinite(q) && q >= 0 && q <= 100 && q < QUOTA_ALERTE_PCT) {
    sortie.push({ sujet: "quota", message: `Il reste moins de ${QUOTA_ALERTE_PCT} % du quota Zernio (${Math.floor(q)} %).` });
  }
  return sortie;
}
