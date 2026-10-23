/**
 * RELIRE LE SCRIPT DU CAS CONCRET : les deux gestes PURS de l'écran, sans accès au serveur (l'action est passée en
 * paramètre). « Enregistrer sans lancer » garde les phrases modifiées en NOUVELLE version validée du script, sans lancer
 * la vidéo : aucune dépense. La relecture suit ensuite la version rendue par la page.
 */
import type { ResultatEnregistrement } from "@/components/script/RelireScript";
import type { ScriptRelu } from "@/domaine/relecture-script";
import { modificationsDesDifferences } from "@/moteurs/montage-cas-concret/relecture";
import type { ModificationEcran } from "@/moteurs/montage-cas-concret/modifier-script";
import type { VueCas } from "./vue";

type ActionModifier = (casId: string, modifications: ModificationEcran[]) => Promise<{ ok: true; donnees: { empreinte: string; numero: number; modifie: boolean } } | { ok: false; message: string }>;

export const PHRASE_SCRIPT_GARDE_AUTRE = "Le script gardé n'est pas celui que vous avez relu. Rouvrez le cas. Rien n'a été payé.";

/** Garde les modifications relues (nouvelle version validée) ; le refus du serveur est rendu tel quel, en phrase. */
export async function enregistrerScriptRelu(casId: string, s: ScriptRelu, modifier: ActionModifier): Promise<ResultatEnregistrement> {
  const modifications = modificationsDesDifferences(s.modifications);
  if (!modifications.length) return { ok: true, message: "Rien à enregistrer : aucune phrase modifiée." };
  const m = await modifier(casId, modifications);
  if (!m.ok) return { ok: false, message: m.message };
  if (m.donnees.empreinte !== s.empreinte) return { ok: false, message: PHRASE_SCRIPT_GARDE_AUTRE };
  if (!m.donnees.modifie) return { ok: true, message: `Aucun changement : le script est déjà enregistré (version ${m.donnees.numero})` };
  return { ok: true, message: `Script enregistré (version ${m.donnees.numero})` };
}

/** Le cas de la relecture, tel que la page le rend maintenant (nouvelle phrase après un enregistrement) ; sinon celui ouvert. */
export function casCourant(valides: readonly VueCas[], ouvert: VueCas): VueCas {
  return valides.find((c) => c.id === ouvert.id) ?? ouvert;
}
