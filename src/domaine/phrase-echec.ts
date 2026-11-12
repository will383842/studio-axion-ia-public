/**
 * Un message d'échec qui dit la cause (fiche GV-EC-03). PUR. Le message technique d'un fournisseur sert UNIQUEMENT à
 * reconnaître la cause par mots clés : la phrase rendue vient d'une liste fermée, jamais d'un extrait du message (il
 * peut recopier une clé, un jeton ou une adresse). Aucun montant.
 */

/** Un nom d'outil montrable : lettres, chiffres, espace, point, tiret (« HeyGen », « fal.ai »). Sinon : inconnu. */
const NOM_SUR = /^[\p{L}\p{N}][\p{L}\p{N} .\-]{0,39}$/u;

type Cause = "credit" | "moderation" | "cle" | "vide" | "delai" | "indisponible";

/** Dans l'ordre : la première cause reconnue gagne. */
const CAUSES: { cause: Cause; motif: RegExp }[] = [
  { cause: "credit", motif: /insufficient[\s_-]*(?:credit|fund|balance)|credit balance|(?:out of|no|exhausted|depleted)\s+credits?|credits?\s+(?:exhausted|depleted|epuis)|payment required|\b402\b|cr[ée]dits?\s+(?:[ée]puis|insuffisant)/i },
  { cause: "moderation", motif: /moderation|mod[ée]ration|content[\s_-]*policy|safety|nsfw|policy violation|flagged|blocked by/i },
  { cause: "cle", motif: /invalid[\s_-]*(?:api[\s_-]*)?key|api[\s_-]*key|unauthori[sz]ed|forbidden|authentication|\b40[13]\b|cl[ée]\s+(?:refus|invalide)/i },
  { cause: "vide", motif: /\bempty\b|no (?:output|result|image|video|audio)|returned nothing|r[ée]sultat vide|\bvide\b/i },
  { cause: "delai", motif: /time[sd]?[\s_-]*out|timed out|deadline|d[ée]lai/i },
  { cause: "indisponible", motif: /unavailable|overloaded|bad gateway|internal server error|econnreset|econnrefused|network|\b50[0-4]\b|indisponible/i },
];

function reconnaitre(message: string): Cause | null {
  for (const { cause, motif } of CAUSES) if (motif.test(message)) return cause;
  return null;
}

const PHRASES: Record<Cause, string> = {
  credit: "crédit épuisé. Rechargez le compte, puis réessayez.",
  moderation: "contenu refusé par la modération. Modifiez le texte ou l'image, puis réessayez.",
  cle: "clé refusée. Vérifiez-la dans Réglages > Connexions, puis réessayez.",
  vide: "résultat vide. Réessayez.",
  delai: "délai dépassé. Réessayez dans un instant.",
  indisponible: "service indisponible. Réessayez dans un instant.",
};

/**
 * La phrase à montrer à Will quand une étape échoue. `outil` : nom de l'outil (« HeyGen »), facultatif.
 * Panne non définitive (indisponible pendant 24 h) : on garde la durée, la cause « délai » ou « indisponible » n'y change rien.
 */
export function phraseDEchec(p: { outil?: string | null; message?: string | null; definitive: boolean }): string {
  const outil = p.outil && NOM_SUR.test(p.outil.trim()) ? p.outil.trim() : null;
  const cause = reconnaitre(p.message ?? "");
  if (cause && (p.definitive || (cause !== "delai" && cause !== "indisponible"))) return outil ? `${outil} : ${PHRASES[cause]}` : `${PHRASES[cause][0].toUpperCase()}${PHRASES[cause].slice(1)}`;
  if (!p.definitive) return outil ? `${outil} : resté indisponible pendant 24 h. Vous pouvez réessayer.` : "Un outil est resté indisponible pendant 24 h. Vous pouvez réessayer.";
  return outil ? `${outil} : cet outil a refusé cette étape. Vous pouvez réessayer.` : "Un outil a refusé cette étape. Vous pouvez réessayer.";
}
