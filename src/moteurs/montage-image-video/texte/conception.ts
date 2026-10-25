/**
 * IMAGE → VIDÉO · MODE TEXTE (R6a) · Service de conception : `{ texte, reseaux }` → `LectureImage` valide.
 *
 * Will décrit une automatisation en langage libre ; le rôle `conceptionWorkflowIV` (Opus) en fait un workflow complet
 * sous la forme EXACTE d'une lecture d'image. Le reste de la chaîne (carte, réparation, script, voix, rendu) ne change
 * pas : la carte est complétée et contrôlée par le même code que pour une image lue.
 *
 * - Provenance « texte » : sur le résultat (`provenance`) et dans la clé d'image de la carte (`texte:<empreinte>`,
 *   `estCleTexte`) ; aucun fichier n'existe.
 * - Réservation du pire coût AVANT chaque appel, dans le plafond de la vidéo (`PLAFOND_VIDEO_IV_CENTIMES`) ; au plus
 *   `APPELS_CONCEPTION_MAX` appels (1 + une relance si la sortie est illisible ou invalide).
 * - Jamais de crash : toute panne, tout refus, toute sortie invalide devient une erreur propre (`ok: false`, phrase
 *   simple pour Will) ; la chaîne n'est jamais bloquée, Will peut reformuler son texte et relancer.
 * - Le schéma est un EXEMPLE : mention « Exemple de situation type. » garantie par le code, aucune photo de personnes,
 *   aucun témoignage ni client réel présenté. Les phrases affirmatives ne sont PAS filtrées.
 */
import { createHash } from "node:crypto";
import { completerCarte, controlerCarte, type CarteImage, type ControleCarte } from "@/domaine/image-video/carte";
import { pireCasRole, type DefinitionRole } from "@/generateur/roles/types";
import { TAUX_USD_EUR_PAR_DEFAUT } from "@/lib/montants";
import { PLAFOND_VIDEO_IV_CENTIMES } from "../fabrication";
import type { OutilsLecture } from "../lecture";
import { schemaLectureImage, type LectureImage } from "../lecture/consigne";
import { roleConceptionWorkflowIV, variableConception } from "./consigne";

export { roleConceptionWorkflowIV } from "./consigne";

export const PROVENANCE_TEXTE = "texte" as const;
/** Étape inscrite sur chaque réservation. */
export const ETAPE_CONCEPTION = "conception-workflow";
export const APPELS_CONCEPTION_MAX = 2;
export const MOTS_MIN = 3;
export const CARACTERES_MAX = 4000;
export const BLOCS_MIN = 3;
export const BLOCS_MAX = 16;
export const MENTION_EXEMPLE = "Exemple de situation type.";

export const idAppelConception = (videoId: string, essai: number) => `iv-conception-${videoId}-${essai}`;
/** Vrai si la clé d'image d'une carte indique qu'elle vient d'un texte (aucun fichier). */
export const estCleTexte = (cle: string) => cle.startsWith(`${PROVENANCE_TEXTE}:`);

/** Dépense de la vidéo, en centimes d'euro, et son plafond. */
export interface PlafondConception {
  plafondCentimes?: number;
  /** Déjà dépensé sur cette vidéo (centimes d'euro). */
  depenseCentimes?: number;
  tauxUsdEur?: number;
}

export interface EntreeConception {
  videoId: string;
  /** Description libre de Will. */
  texte: string;
  /** Réseaux visés (indicatif, transmis tel quel à la conception). */
  reseaux?: readonly string[];
  plafond?: PlafondConception;
}

/** Outils branchés par le service : les mêmes que la lecture d'image (appel et réservation), sans conversion d'image. */
export type OutilsConception = Pick<OutilsLecture, "appeler" | "budget">;

export type MotifRefusConception = "texte-vide" | "texte-trop-court" | "texte-trop-long" | "hors-sujet" | "plafond" | "budget" | "appel" | "illisible";

export type ResultatConception =
  | { ok: true; provenance: typeof PROVENANCE_TEXTE; lecture: LectureImage; carte: CarteImage; controle: ControleCarte; appels: number; simule: boolean; coutUsd?: number }
  | { ok: false; provenance: typeof PROVENANCE_TEXTE; motif: MotifRefusConception; /** Phrase simple pour Will. */ message: string; appels: number };

// ─── Validation de la sortie ─────────────────────────────────────────────────────────────────────────────────────────

/** Ce qui ferait passer un schéma d'exemple pour le résultat d'un vrai client (DGCCRF). */
const CLIENT_REEL = /\b(t[ée]moignage|chez notre client|chez nos clients|nos clients (ont|ont obtenu|gagnent)|client r[ée]el|cas r[ée]el|r[ée]sultats? mesur[ée]s? chez)\b/i;

const net = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();

/** Phrase d'erreur si la conception est inutilisable ; `null` si elle est valide. PUR. */
export function erreurConception(l: LectureImage): string | null {
  if (!net(l.titre) || !net(l.phraseChoc)) return "titre ou phrase du bas manquant";
  if (l.noeuds.length < BLOCS_MIN) return `moins de ${BLOCS_MIN} blocs`;
  if (l.noeuds.length > BLOCS_MAX) return `plus de ${BLOCS_MAX} blocs`;
  const ids = l.noeuds.map((n) => n.id);
  if (new Set(ids).size !== ids.length) return "identifiants de blocs en double";
  if (l.noeuds.some((n) => !net(n.libelle))) return "bloc sans texte";
  const ordres = l.noeuds.map((n) => n.ordre);
  if (new Set(ordres).size !== ordres.length) return "rangs de blocs en double";
  const liensIds = l.liens.map((x) => x.id);
  if (new Set(liensIds).size !== liensIds.length) return "identifiants de flèches en double";
  const connus = new Set(ids);
  for (const x of l.liens) {
    if (!connus.has(x.de) || !connus.has(x.vers)) return "flèche vers un bloc inexistant";
    if (x.de === x.vers) return "flèche d'un bloc vers lui-même";
  }
  const relies = new Set(l.liens.flatMap((x) => [x.de, x.vers]));
  if (ids.some((i) => !relies.has(i))) return "bloc non relié";
  const groupes = new Set(l.groupes.map((g) => g.id));
  if (groupes.size !== l.groupes.length) return "groupes en double";
  if (l.noeuds.some((n) => n.groupe && !groupes.has(n.groupe))) return "bloc dans un groupe inexistant";
  if (l.groupes.some((g) => g.noeuds.some((i) => !connus.has(i)))) return "groupe avec un bloc inexistant";
  const textes = [l.titre, l.sousTitre, l.phraseChoc, ...l.noeuds.flatMap((n) => [n.libelle, n.detail, ...n.sousElements]), ...l.liens.map((x) => x.etiquette), ...l.bandeau, ...l.pied];
  if (textes.some((t) => CLIENT_REEL.test(t))) return "présenté comme le résultat d'un vrai client";
  return null;
}

/** Normalise sans rien inventer : aucune photo de personnes, mention d'exemple garantie. PUR. */
export function normaliserConception(l: LectureImage): LectureImage {
  const pied = l.pied.some((p) => /exemple|situation type/i.test(p)) ? l.pied : [...l.pied, MENTION_EXEMPLE];
  return { ...l, noeuds: l.noeuds.map((n) => ({ ...n, photoPersonnes: false })), pied };
}

/** Carte construite comme pour une image lue (même code), avec la clé d'image « texte ». */
export function carteDeConception(l: LectureImage, texte: string): CarteImage {
  const empreinte = createHash("sha256").update(texte).digest("hex");
  return completerCarte({
    version: "carte-image/1",
    image: { cle: `${PROVENANCE_TEXTE}:${empreinte.slice(0, 16)}`, empreinte, largeur: 1080, hauteur: 1350, orientation: "portrait" },
    titre: net(l.titre),
    ...(net(l.sousTitre) ? { sousTitre: net(l.sousTitre) } : {}),
    phraseChoc: net(l.phraseChoc),
    ...(net(l.signature) ? { signature: net(l.signature) } : {}),
    noeuds: l.noeuds.map((n) => ({
      id: n.id, libelle: net(n.libelle), role: n.role, couleur: n.couleur, acteur: n.acteur, ordre: n.ordre,
      ...(net(n.detail) ? { detail: net(n.detail) } : {}),
      ...(net(n.icone) ? { icone: net(n.icone) } : {}),
      ...(n.groupe ? { groupe: n.groupe } : {}),
      ...(n.quantite !== null && n.quantite > 0 ? { quantite: n.quantite } : {}),
      ...(n.sousElements.length ? { sousElements: n.sousElements.map(net).filter(Boolean) } : {}),
      ...(n.exemple ? { exemple: true } : {}),
    })),
    liens: l.liens.map((x) => ({ id: x.id, de: x.de, vers: x.vers, couleur: x.couleur, style: x.style, ...(net(x.etiquette) ? { etiquette: net(x.etiquette) } : {}), ...(x.part !== null && x.part > 0 ? { part: x.part } : {}) })),
    groupes: l.groupes.map((g) => ({ id: g.id, sorte: g.sorte, noeuds: [...g.noeuds], ...(net(g.titre) ? { titre: net(g.titre) } : {}), ...(g.majoritaire ? { majoritaire: true } : {}) })),
    bandeau: l.bandeau.map(net).filter(Boolean),
    pied: l.pied.map(net).filter(Boolean),
    lecture: { ecarts: [], alertes: [] },
  });
}

// ─── Texte de Will ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Refus du texte avant tout appel (aucun coût). `null` si le texte peut partir. */
export function refusTexte(texte: string): { motif: MotifRefusConception; message: string } | null {
  const t = texte.normalize("NFC").trim();
  if (!t) return { motif: "texte-vide", message: "Décrivez d'abord l'automatisation, avec vos mots, comme dans une conversation." };
  if (t.length > CARACTERES_MAX) return { motif: "texte-trop-long", message: `Le texte est trop long (plus de ${CARACTERES_MAX} caractères) : gardez l'essentiel de l'automatisation.` };
  const mots = t.split(/\s+/).filter((m) => /\p{L}{2,}/u.test(m));
  if (mots.length < MOTS_MIN) return { motif: "texte-trop-court", message: "Dites-m'en un peu plus : que se passe-t-il au départ, et qu'est-ce que l'automatisation fait ensuite ?" };
  return null;
}

// ─── Conception ──────────────────────────────────────────────────────────────────────────────────────────────────────

export async function concevoirWorkflow(entree: EntreeConception, outils: OutilsConception): Promise<ResultatConception> {
  const refus = (motif: MotifRefusConception, message: string, appels = 0): ResultatConception => ({ ok: false, provenance: PROVENANCE_TEXTE, motif, message, appels });
  const avant = refusTexte(entree.texte);
  if (avant) return refus(avant.motif, avant.message);

  try {
    const role = roleConceptionWorkflowIV as unknown as DefinitionRole;
    const contexte = { variable: variableConception(entree.texte.trim(), entree.reseaux ?? []) };
    const taux = entree.plafond?.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT;
    const plafondUsd = ((entree.plafond?.plafondCentimes ?? PLAFOND_VIDEO_IV_CENTIMES) - (entree.plafond?.depenseCentimes ?? 0)) / 100 / taux;
    let appels = 0;
    let coutUsd: number | undefined;
    let dernier = "";
    for (let essai = 1; essai <= APPELS_CONCEPTION_MAX; essai++) {
      const pire = pireCasRole(role, { contexte: {}, ...contexte });
      // Plafond de la vidéo : le pire coût de CET appel, plus ce qui est déjà engagé ici, doit y tenir.
      if (pire + (coutUsd ?? 0) > plafondUsd) return refus("plafond", "Le plafond de dépense de cette vidéo est atteint : la conception du schéma n'a pas été lancée.", appels);
      const r = await outils.budget.reserver({ appelId: idAppelConception(entree.videoId, essai), videoId: entree.videoId, etape: ETAPE_CONCEPTION, modele: role.modele, coutEstimeUsd: pire });
      if (!r.ok) return refus("budget", `Conception du schéma non lancée : ${r.message}`, appels);
      appels++;
      const rep = await outils.appeler(role, { contexte: {}, ...contexte });
      if (!rep.ok) return refus("appel", `Conception du schéma interrompue : ${rep.message}`, appels);
      if (rep.coutUsd !== undefined) coutUsd = (coutUsd ?? 0) + rep.coutUsd;
      let brut: unknown = rep.donnees;
      if (brut === undefined && typeof rep.texte === "string") {
        try {
          brut = JSON.parse(rep.texte);
        } catch {
          brut = undefined;
        }
      }
      if (rep.stopReason === "max_tokens") { dernier = "réponse coupée"; continue; }
      const v = schemaLectureImage.safeParse(brut);
      if (!v.success) { dernier = "forme illisible"; continue; }
      if (v.data.type === "inconnu" && !v.data.noeuds.length) {
        return refus("hors-sujet", "Je n'y vois pas d'automatisation à schématiser : décrivez ce qui se déclenche, ce que l'IA ou l'outil fait, et le résultat attendu.", appels);
      }
      const lecture = normaliserConception(v.data);
      const erreur = erreurConception(lecture) ?? (lecture.type === "inconnu" ? "type non choisi" : null);
      if (erreur) { dernier = erreur; continue; }
      let carte: CarteImage;
      try {
        carte = carteDeConception(lecture, entree.texte.trim());
      } catch {
        dernier = "carte incohérente";
        continue;
      }
      const controle = controlerCarte(carte);
      if (!controle.ok) { dernier = controle.erreurs[0] ?? "carte refusée"; continue; }
      return { ok: true, provenance: PROVENANCE_TEXTE, lecture, carte, controle, appels, simule: rep.simule, ...(coutUsd !== undefined ? { coutUsd } : {}) };
    }
    return refus("illisible", `Je n'ai pas réussi à concevoir un schéma exploitable (${dernier}) : reformulez ou précisez le texte, puis relancez.`, appels);
  } catch {
    // Jamais de crash de la chaîne : une panne imprévue devient une erreur propre.
    return refus("appel", "La conception du schéma a rencontré un incident : relancez dans un instant.");
  }
}
