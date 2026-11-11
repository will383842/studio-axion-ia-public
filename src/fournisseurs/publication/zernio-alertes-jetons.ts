/**
 * ALERTES JETONS ZERNIO (STU-JETONS) : PUR, sans réseau ni base. Dit quels sujets méritent une alerte :
 * - un compte relié est déconnecté (`isActive: false`) ou à reconnecter (`needsReconnection: true`) ;
 * - son jeton est expiré, ou expire dans moins de 7 jours (`metadata.tokenExpiresAt`, documenté par Zernio ; absent = jeton sans expiration) ;
 * - le quota restant passe sous 20 % (valeur fournie par l'appelant : aucune route Zernio du client ne la donne aujourd'hui, voir la PR).
 * Un champ absent ou illisible ne déclenche JAMAIS d'alerte : on n'invente rien. Aucun identifiant dans les messages.
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
    nom: c.displayName ?? c.username ?? c.platform,
    actif: typeof c.isActive === "boolean" ? c.isActive : undefined,
    aReconnecter: typeof c.needsReconnection === "boolean" ? c.needsReconnection : undefined,
    expireLe: typeof exp === "string" || typeof exp === "number" ? exp : undefined,
  };
}

export function alertesJetonsZernio(e: { comptes: readonly CompteSurveille[]; quotaRestantPct?: number | null; maintenant: number }): AlerteJeton[] {
  const sortie: AlerteJeton[] = [];
  for (const c of e.comptes) {
    const sujet = `jeton:${c.id}`;
    if (c.actif === false || c.aReconnecter === true) {
      sortie.push({ sujet, message: `${c.nom} : le compte est déconnecté de Zernio. Reconnectez-le pour que les publications repartent.` });
      continue;
    }
    const fin = c.expireLe === null || c.expireLe === undefined ? NaN : typeof c.expireLe === "number" ? c.expireLe : Date.parse(c.expireLe);
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
