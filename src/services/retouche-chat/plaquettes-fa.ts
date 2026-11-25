/**
 * S-15-b2-v21r — supplément « plaquettes » du lecteur commun du chat, face caméra animée (SENSIBLE ARGENT, ÉTEINT : aucun importeur).
 * Décrit les plaquettes de la vidéo (bloc borné ajouté au message de la lecture), lit gratuitement quelques phrases simples,
 * et relit strictement ce que Claude propose. N'appelle rien : l'unique appel reste celui du lecteur commun, s'il est allumé.
 * Pur : aucun réglage, aucun moteur, aucun accès base. Le texte venu de la vidéo est une donnée balisée, jamais une consigne.
 */
import { envelopper, neutraliser } from "./donnees-sures";
import type { SupplementLecteur } from "./lecteur-demande";
import { lireOperationsPlaquettes, listerPlaquettes, type OperationPlaquette } from "@/domaine/facecam-animee/appliquer-plaquettes";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";

/** Borne de la taille ajoutée au message de la lecture (≈ 1 000 jetons d'entrée au plus). */
export const BLOC_PLAQUETTES_MAX_CARACTERES = 4000;
/** Au-delà, les plaquettes suivantes sont seulement comptées. */
export const PLAQUETTES_MAX_DANS_BLOC = 40;

export const PHRASE_AUCUNE_PLAQUETTE = "Cette vidéo n'a aucune plaquette.";
export const REMARQUE_PLAQUETTE_ABSENTE = "Une plaquette citée n'existe pas dans cette vidéo.";
const ENTETE = "Plaquettes de la vidéo (rang, nom, type, moment, mots) :";
const FORME =
  'Opérations possibles sur les plaquettes (liste fermée, clé "supplementaires", nom = celui de la liste) : ' +
  '[{ "type": "retirer", "uid": "<nom>" }, { "type": "changer-texte", "uid": "<nom>", "mots": ["<mot>"] }, { "type": "decaler", "uid": "<nom>", "decalageSec": <secondes, négatif = plus tôt> }]';

type Plaquette = ReturnType<typeof listerPlaquettes>[number];

function lignePlaquette(p: Plaquette, rang: number): string {
  const mots = p.mots?.length ? ` · mots : ${envelopper("ecran", p.mots.join(" "))}` : "";
  return `${rang}. ${neutraliser(p.uid)} · ${neutraliser(p.type)} · de ${p.debut} à ${p.fin} s${mots}`;
}

/** Coupe le texte à `max` caractères sans laisser une moitié de caractère double. */
function couper(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const t = texte.slice(0, Math.max(0, max));
  return /[\uD800-\uDBFF]$/.test(t) ? t.slice(0, -1) : t;
}

/** Bloc borné : en-tête, au plus 40 lignes (puis « … et N autres. »), coupé pour que le tout tienne en 4 000 caractères, forme JSON gardée entière. */
export function blocPlaquettes(plaquettes: readonly Plaquette[]): string {
  if (!plaquettes.length) return PHRASE_AUCUNE_PLAQUETTE;
  const lignes = plaquettes.slice(0, PLAQUETTES_MAX_DANS_BLOC).map((p, i) => lignePlaquette(p, i + 1));
  const reste = plaquettes.length - PLAQUETTES_MAX_DANS_BLOC;
  if (reste > 0) lignes.push(`… et ${reste} autres.`);
  const place = BLOC_PLAQUETTES_MAX_CARACTERES - ENTETE.length - FORME.length - 2;
  return `${ENTETE}\n${couper(lignes.join("\n"), place)}\n${FORME}`;
}

const NOMBRE = String.raw`([+\-−]?\d+(?:[.,]\d+)?)`;
const RETIRER = /^(?:retire|retirez|supprime|supprimez|enl[eè]ve|enlevez)\s+la\s+plaquette\s+(?:n[°o]\s*)?(\d{1,3})\s*[.!]?$/i;
const DECALER = new RegExp(String.raw`^d[ée]cale[zr]?\s+la\s+plaquette\s+(?:n[°o]\s*)?(\d{1,3})\s+de\s+${NOMBRE}\s*(?:s|sec|secondes?)\s*[.!]?$`, "i");

/** Règles gratuites, sans réseau : une phrase simple sur une plaquette par son rang (1…). Tout le reste : rien. */
export function reglesPlaquettes(plaquettes: readonly Plaquette[], phrase: string): OperationPlaquette[] {
  const p = String(phrase ?? "").trim().replace(/\s+/g, " ");
  const viser = (rang: string) => plaquettes[Number(rang) - 1]?.uid;
  const r = RETIRER.exec(p);
  if (r) {
    const uid = viser(r[1]!);
    return uid ? [{ type: "retirer", uid }] : [];
  }
  const d = DECALER.exec(p);
  if (d) {
    const uid = viser(d[1]!);
    const decalageSec = Number(d[2]!.replace("−", "-").replace(",", "."));
    return uid && Number.isFinite(decalageSec) && decalageSec !== 0 ? [{ type: "decaler", uid, decalageSec }] : [];
  }
  return [];
}

/** Ne lève jamais. */
export function supplementPlaquettesFA(plan: PlanFacecamAnimee): SupplementLecteur<OperationPlaquette> {
  const plaquettes = listerPlaquettes(plan);
  const connus = new Set(plaquettes.map((p) => p.uid));
  return {
    bloc: blocPlaquettes(plaquettes),
    regles: (phrase) => {
      try {
        return reglesPlaquettes(plaquettes, phrase);
      } catch {
        return [];
      }
    },
    relire: (brut) => {
      const lu = lireOperationsPlaquettes(brut);
      const gardees = lu.operations.filter((o) => connus.has(o.uid));
      const remarques = gardees.length === lu.operations.length ? lu.remarques : [...lu.remarques, REMARQUE_PLAQUETTE_ABSENTE];
      return { operations: gardees, remarques };
    },
  };
}
