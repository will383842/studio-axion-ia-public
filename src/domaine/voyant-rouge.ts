/**
 * VOYANT ROUGE : seconde confirmation AVANT la voix payante (lot E « Scripts exceptionnels »). PUR.
 *
 * Décision de Will : un voyant rouge ne bloque pas, il demande un second « oui » (blocage doux), enregistré dans
 * `avisWill.malgreVoyant`. Jamais sur un script COLLÉ par Will (origine « will ») : pris à l'identique, ni contrôlé
 * ni bloqué. DÉCISION (rouge par la seule note < 70, sans garde-fou échoué) : elle demande la même confirmation, car
 * la confirmation ne bloque rien. ATTENTION : l'écran n'affiche JAMAIS le mot « voyant rouge » (point ambre ou vert
 * seulement, FicheSujet) ; le message dit donc la vraie raison, en français simple : « La version X a une note de 62
 * sur 100 » ou « Une règle importante n'est pas respectée dans la version X ».
 */
import { GARDE_FOUS } from "./controles-script/niveaux";
import { voyant } from "./controles-script/note";

export type VoyantVersion = "vert" | "ambre" | "rouge";

/** Ce que le voyant lit d'une version : sa note et ses contrôles déjà enregistrés. `origine: "will"` = script collé. */
export interface VersionPourVoyant {
  origine?: string;
  note?: { globale: number };
  controles?: { violations: { controle: string; bloquant: boolean }[] };
}

/** Garde-fous échoués d'une version (contrôles bloquants qui sont des garde-fous). */
function gardeFousEchoues(v: VersionPourVoyant): string[] {
  const codes = (v.controles?.violations ?? []).filter((x) => x.bloquant && GARDE_FOUS.includes(x.controle)).map((x) => x.controle);
  return [...new Set(codes)];
}

/** Note absente ou à 0 = « non notée » (le générateur crée 0 pour « aucune note », l'écran affiche « — ») : ni verte ni rouge. */
function noteDe(v: VersionPourVoyant): number | undefined {
  const g = v.note?.globale;
  return g ? g : undefined;
}

export function voyantDeVersion(v: VersionPourVoyant): VoyantVersion {
  const echecs = gardeFousEchoues(v);
  // Non notée : seuls les garde-fous échoués comptent (100 = « rien à reprocher à la note »).
  return voyant({ globale: noteDe(v) ?? 100, criteres: {}, gardeFous: { passe: !echecs.length, echecs } });
}

export interface DemandeConfirmationVoyant {
  /** Codes des versions au voyant rouge (script de la machine seulement). */
  codes: string[];
  message: string;
}

/** `null` : rien à confirmer. Une seule demande, quel que soit le nombre de versions rouges. */
export function demandeConfirmationVoyant(versions: readonly (VersionPourVoyant & { code: string })[], o: { texteRetouche?: boolean; retouchees?: readonly string[] } = {}): DemandeConfirmationVoyant | null {
  const rouges = versions.filter((v) => v.origine !== "will" && voyantDeVersion(v) === "rouge");
  if (!rouges.length) return null;
  const codes = rouges.map((v) => v.code);
  const raisons = rouges.map((v) => (gardeFousEchoues(v).length ? `Une règle importante n'est pas respectée dans la version ${v.code}.` : `La version ${v.code} a une note de ${noteDe(v)} sur 100${o.texteRetouche || o.retouchees?.includes(v.code) ? " (note d'origine, avant vos retouches)" : ""}.`));
  return { codes, message: `${raisons.join(" ")} Voulez-vous quand même lancer la voix ? Elle est payante.` };
}

/**
 * La trace gardée dans `avisWill.malgreVoyant` quand Will confirme malgré le rouge. `texteRetouche` : Will a retouché le
 * texte avant de lancer ; la note n'est pas recalculée (elle coûterait un appel), elle est donc celle de la version d'origine
 * (`noteDOrigine`), pas celle du texte fabriqué. Les garde-fous, eux, sont ceux du texte relu (chemin « relire puis lancer »).
 * Sur « Utiliser dans ma vidéo », ce sont ceux de la version d'origine, comme la note.
 */
export function avisMalgreVoyant(v: VersionPourVoyant, le: string, o: { texteRetouche?: boolean } = {}): { voyant: "rouge"; note: number; gardeFous: string[]; le: string; noteDOrigine?: true } {
  return { voyant: "rouge", note: v.note?.globale ?? 0, gardeFous: gardeFousEchoues(v), le, ...(o.texteRetouche ? { noteDOrigine: true as const } : {}) };
}

/**
 * Où écrire la trace : dans l'avis de Will s'il existe déjà (résultat et date inchangés), sinon dans un champ séparé
 * `malgreVoyant` de la version : écrire un avis « valide » daté d'aujourd'hui inventerait une validation (la date
 * d'avis sert de date de validation ailleurs). Champs additifs non déclarés dans types.ts : d'où le cast chez l'appelant.
 */
export function patchTraceVoyant(v: { avisWill?: object }, trace: ReturnType<typeof avisMalgreVoyant>): { avisWill: object } | { malgreVoyant: ReturnType<typeof avisMalgreVoyant> } {
  return v.avisWill ? { avisWill: { ...v.avisWill, malgreVoyant: trace } } : { malgreVoyant: trace };
}

/**
 * Côté écran : lance, et si le serveur répond « VOYANT_ROUGE » (rien créé ni payé), pose UNE question (le message du
 * serveur, tel quel) puis relance avec la confirmation. Un « non » rend une seule phrase, sans doublon.
 * `dejaOui` : mémoire du oui, tenue par l'écran pour toute l'opération. Quand le prix est redemandé (CONFIRMATION_REQUISE)
 * l'écran relance : sans cette mémoire, le serveur répondrait de nouveau « VOYANT_ROUGE » et la question serait posée deux fois.
 */
export async function avecSecondOuiVoyant<R extends { ok: boolean; code?: string; message?: string }>(
  appeler: (malgreVoyant: boolean) => Promise<R>,
  demander: (question: string) => Promise<boolean>,
  dejaOui?: { current: boolean },
): Promise<R> {
  const r = await appeler(!!dejaOui?.current);
  if (r.ok || r.code !== "VOYANT_ROUGE") return r;
  if (!(await demander(r.message ?? ""))) return { ok: false, code: "VOYANT_ROUGE", message: "Rien n'a été créé ni payé." } as unknown as R;
  if (dejaOui) dejaOui.current = true;
  return appeler(true);
}

/** Clé, dans les `entrees` de la vidéo, de la version du générateur dont le texte a été repris (« Utiliser dans ma vidéo »). */
export const CLE_VARIANTE_ORIGINE = "varianteOrigineId";

/** `entrees` avec (ou sans, si `id` est absent) la version d'origine : enregistrée avec le brouillon, relue côté serveur. */
export function entreesAvecOrigine(entrees: Record<string, unknown> | undefined, id?: string): Record<string, unknown> {
  const { [CLE_VARIANTE_ORIGINE]: _ancienne, ...reste } = entrees ?? {};
  void _ancienne;
  return id ? { ...reste, [CLE_VARIANTE_ORIGINE]: id } : reste;
}
