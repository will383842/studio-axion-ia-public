/**
 * Filtre RÉCURSIF des mots interdits pour Zernio (ADR-0004, D7).
 *
 * Réutilise `motsInterditsEnvoiZernio` (règle de Buffer + ville interdite et promesse de gain). Parcourt TOUTES les chaînes d'un corps, quelle que soit leur
 * profondeur (texte, customContent, firstComment, documentTitle de platformSpecificData, title, altText,
 * description, valeurs de metadata…), y compris les NOMS de clés, puis contrôle la sérialisation JSON entière.
 * S'applique aux POST, aux PUT, au GET avant promotion et à l'import ; le refus a lieu avant le réseau.
 */
import { motsInterditsEnvoiZernio } from "./mots-interdits-envoi";
import { ErreurZernio } from "./zernio-erreurs";

/** Une chaîne trouvée dans le corps, avec son chemin lisible (`platforms[0].customContent`, `metadata.<clé>`…). */
export interface ChaineDuCorps {
  chemin: string;
  valeur: string;
}

/** Un champ en défaut : son chemin et les mots interdits trouvés (libellés). */
export interface MotInterditTrouve {
  chemin: string;
  mots: string[];
}

/** Chemin réservé au contrôle de la sérialisation JSON entière. */
export const CHEMIN_SERIALISATION = "(sérialisation JSON)";

const PROFONDEUR_MAX = 32;

/** Toutes les chaînes d'une valeur JSON (valeurs ET noms de clés), en profondeur. PUR. */
export function chainesDuCorps(corps: unknown, prefixe = ""): ChaineDuCorps[] {
  const sortie: ChaineDuCorps[] = [];
  const parcourir = (v: unknown, chemin: string, profondeur: number): void => {
    if (profondeur > PROFONDEUR_MAX) {
      // Corps anormalement profond : on le refuse plutôt que de laisser passer une chaîne non lue.
      sortie.push({ chemin, valeur: "\u0000profondeur" });
      return;
    }
    if (typeof v === "string") {
      sortie.push({ chemin: chemin || "(racine)", valeur: v });
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => parcourir(x, `${chemin}[${i}]`, profondeur + 1));
    } else if (v !== null && typeof v === "object") {
      for (const [cle, x] of Object.entries(v as Record<string, unknown>)) {
        const sous = chemin ? `${chemin}.${cle}` : cle;
        sortie.push({ chemin: `${sous}(nom)`, valeur: cle });
        parcourir(x, sous, profondeur + 1);
      }
    }
  };
  parcourir(corps, prefixe, 0);
  return sortie;
}

/** Les champs du corps qui portent un mot interdit (liste vide = corps propre). PUR. */
export function motsInterditsDuCorps(corps: unknown): MotInterditTrouve[] {
  if (corps === undefined) return [];
  const trouves: MotInterditTrouve[] = [];
  for (const { chemin, valeur } of chainesDuCorps(corps)) {
    if (valeur === "\u0000profondeur") {
      trouves.push({ chemin, mots: ["(corps trop profond)"] });
      continue;
    }
    const mots = motsInterditsEnvoiZernio(valeur);
    if (mots.length > 0) trouves.push({ chemin, mots });
  }
  // Contrôle final : la sérialisation entière (jetons concaténés, échappements, clés).
  let serialisation: string;
  try {
    serialisation = typeof corps === "string" ? corps : JSON.stringify(corps) ?? "";
  } catch {
    return [...trouves, { chemin: CHEMIN_SERIALISATION, mots: ["(corps non sérialisable)"] }];
  }
  const motsSerialisation = new Set([...motsInterditsEnvoiZernio(serialisation), ...motsInterditsEnvoiZernio(decoderEchappements(serialisation))]);
  if (motsSerialisation.size > 0) trouves.push({ chemin: CHEMIN_SERIALISATION, mots: [...motsSerialisation] });
  return trouves;
}

/** Lève `ErreurZernio("mot-interdit")` si le corps porte un mot interdit ; le message nomme les champs. */
export function exigerCorpsSansMotInterdit(corps: unknown, contexte: string): void {
  const trouves = motsInterditsDuCorps(corps);
  if (trouves.length === 0) return;
  const champs = [...new Set(trouves.map((t) => t.chemin))];
  throw new ErreurZernio("mot-interdit", `${contexte} : mot interdit dans ${champs.join(", ")}. Rien n'a été envoyé.`, { champs });
}

/** Décode les échappements `\uXXXX` d'une sérialisation (un mot écrit en échappements doit être vu). */
function decoderEchappements(t: string): string {
  return t.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
}
