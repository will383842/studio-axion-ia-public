/**
 * RÔLE « MONTEUR FACE CAMÉRA » (plan facecam v4, B.14 et précision « Discuter avec mon monteur »). PUR.
 *
 * UN appel Claude, sans outils : il reçoit la transcription horodatée (index de mot, temps monté, mots retirés
 * marqués), les coupes, les éléments déjà posés, les consignes (dites « Monteur, … » ou écrites), le fil de discussion
 * et le catalogue ; il rend `schemaReponseMonteur` (sortie structurée). Les appels passent par le chemin de dépense
 * existant (`services/depense-claude-video.ts`) : plafond de la vidéo, limite du mois, réservation, coût réel.
 *
 * `reglesFixes` est la VERSION SIMPLE : règles par mots-clés, modèles fixes, aucun appel Claude. Elle sert quand le
 * plafond est atteint, quand Claude n'est pas relié (simulation) et quand sa réponse est inutilisable.
 */
import { z } from "zod";
import { CATALOGUE_MOTION_ETENDU, CONVENTION_TEXTES_TOUS, estModeleEtendu, lireDemandeModele, type IdModeleMotionEtendu } from "@/briques/motion";
import type { ConsigneFacecam } from "@/domaine/facecam";
import { MODELE_ECRITURE, MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { catalogueTexte } from "./catalogue";
import { estEffetSpecial, operationEffetParRegles, resumeEffetSpecial } from "./effets";
import { operationEffetRealisteParRegles } from "./effet-realiste";
import { CONSIGNE_ENVELOPPE } from "@/briques/monteur/enveloppe";
import {
  lireCorrections,
  lireEnvoiMonteur,
  schemaOperationEnvoyee,
  schemaOperationFacecam,
  schemaReponseMonteur,
  schemaReponseMonteurEnvoyee,
  SIGNATURES_OPERATIONS_FACECAM,
  type ModeleCarte,
  type OperationFacecam,
  type ReponseMonteur,
} from "./operations";
import { horloge, type MotMonteur } from "./temps";
import { QUESTION_COUVERTURE, type CouvertureMonteur } from "./couverture";
import { decouperDemande, morceauxEt, normaliserFrappe, operationsComposees, zoneDite, type ContexteRegles, type MotSimple, type PointCompose } from "./regles-simples";

/* ------------------------------------------------------------------ */
/* Données d'un appel                                                  */
/* ------------------------------------------------------------------ */

export interface MessageFil {
  de: "will" | "monteur";
  texte: string;
  le?: string;
}

export interface ConsigneATraiter {
  id: string;
  texte: string;
  origine: ConsigneFacecam["origine"] | "fil";
  /** Mot où la consigne s'applique par défaut (après une consigne dite ; ou repéré dans une consigne écrite). */
  ancre: { debutMot: number; finMot: number };
}

export interface DonneesMonteur {
  titre: string;
  mots: MotMonteur[];
  coupes: { id: string; type: string; debutSec: number; finSec: number; libelle?: string; retablie: boolean }[];
  passages: { id: string; type: string; debutSec: number; finSec: number; texte?: string; modele?: string }[];
  consignes: ConsigneATraiter[];
  fil: MessageFil[];
  /** Animations gardées réutilisables (« Mes animations »). */
  animations: { id: string; nom: string; description: string }[];
  /** Habitudes de Will (« Appliquer aux prochaines »), en phrases. */
  habitudes: string[];
  image: Record<string, string>;
  /** Test en prod du 11/10 : la couverture que Will voit (miniature choisie) ; null : aucune ; absente : pas fournie. */
  couverture?: CouvertureMonteur | null;
}

const ligneMot = (m: MotMonteur) => `[${m.index}] ${m.monteeSec === null ? "--:--" : horloge(m.monteeSec)} ${m.mot}`;

/** Partie variable de l'appel (balises de données ; les consignes en JSON, relues aussi par la simulation). */
export function variableMonteur(d: DonneesMonteur): string {
  const consignes = d.consignes.map((c) => ({ id: c.id, origine: c.origine, texte: c.texte, debutMot: c.ancre.debutMot, finMot: c.ancre.finMot }));
  return [
    `<titre>${d.titre}</titre>`,
    `<transcription>\n${d.mots.map(ligneMot).join("\n")}\n</transcription>`,
    `<coupes>\n${d.coupes.map((c) => `${c.id} · ${c.type} · ${c.retablie ? "rétablie" : "retirée"} · ${c.debutSec.toFixed(2)}-${c.finSec.toFixed(2)} s (prise)${c.libelle ? ` · ${c.libelle}` : ""}`).join("\n")}\n</coupes>`,
    `<elements>\n${d.passages.map((p) => `${p.id} · ${p.type}${p.modele ? ` (${p.modele})` : ""} · ${horloge(p.debutSec)}-${horloge(p.finSec)}${p.texte ? ` · ${p.texte}` : ""}`).join("\n")}\n</elements>`,
    `<image>${Object.entries(d.image).map(([k, v]) => `${k}=${v}`).join(", ")}</image>`,
    d.couverture === undefined ? "" : `<couverture>\n${d.couverture ? `titre : « ${d.couverture.titre} » · écrit sur l'image : ${d.couverture.ecrite ? "oui" : "non (posé à côté)"}` : "aucune image de couverture"}\n</couverture>`,
    d.animations.length ? `<mes_animations>\n${d.animations.map((a) => `${a.id} · ${a.nom} · ${a.description}`).join("\n")}\n</mes_animations>` : "",
    d.habitudes.length ? `<habitudes>\n${d.habitudes.map((h) => `- ${h}`).join("\n")}\n</habitudes>` : "",
    d.fil.length ? `<fil>\n${d.fil.map((m) => `${m.de === "will" ? "Will" : "Monteur"} : ${m.texte}`).join("\n")}\n</fil>` : "",
    `<consignes>\n${JSON.stringify(consignes)}\n</consignes>`,
  ]
    .filter(Boolean)
    .join("\n");
}

const CONSIGNE = `Tu es le monteur vidéo de Will (format face caméra, 9:16, vidéos de 1 à 3 min pour TikTok, Instagram, LinkedIn et YouTube Shorts). Niveau attendu : monteur professionnel (références : un créateur de référence, un créateur de référence, un créateur de référence ; explications façon Vox).

Tu reçois la transcription horodatée (chaque mot : [index] temps-dans-la-vidéo-montée mot ; « --:-- » = mot dans un passage retiré), les coupes, les éléments déjà posés, les consignes de Will et parfois le fil de discussion. Tu rends UNIQUEMENT des opérations de montage du vocabulaire ci-dessous.
Ce que Will VOIT hors de la vidéo montée : <titre> = nom de la vidéo dans le studio (liste et fiche ; jamais dans la vidéo montée) ; <couverture> = image de couverture (miniature choisie), affichée en grand sur le lecteur AVANT la lecture et en vignette sur les réseaux, avec son titre (écrit sur l'image ou posé à côté).

Règles :
- Chaque consigne reçoit une entrée dans « consignes » (consigneId = id fourni ; « fil » pour le dernier message du fil) : comprise ou non, un résumé d'UNE phrase simple au vouvoiement (« Carte des 3 étapes à 0:32 »), et les index des opérations qui y répondent.
- Cale chaque opération sur des index de mots de la transcription (debutMot, finMot), au début du mot important ; jamais sur un mot retiré, sauf pour « retablir ». Un temps donné par Will (« à 0:32 ») se lit sur le temps monté.
- Vocabulaire OUVERT : une demande qui n'entre dans aucune opération devient « ajouterCarte » sur mesure (modele null, html = { html, css, timeline }) : HTML et CSS autonomes ; « timeline » = code JS qui reçoit gsap, racine (élément de la carte) et AXION (jetons de la charte), crée UNE timeline en pause (gsap.timeline({ paused: true })) et l'enregistre par AXION.enregistrer(tl) ; 1080×1920, 3 à 8 s, zones sûres (10 % en haut, 20 % en bas), texte d'au moins 58 px, aucun réseau, aucune image externe, aucun nom ni marque. Mouvement soigné : anticipation, chute, décalages de 60-90 ms, aucun élément figé plus de 1,5 s.
- Cartes du catalogue (modele non null) : « textes » dans l'ordre attendu par le modèle (pont textes → données de la brique motion) : ${Object.entries(CONVENTION_TEXTES_TOUS)
  .map(([m, c]) => `${m} = ${c}`)
  .join(" ; ")}.
- Grammaire : coupe franche, punch-in instantané, zoom flou 2 au plus par vidéo, zoom lent 3 %/s au plus, écran partagé 3 à 8 s (texte en haut, Will en bas), jamais de fondu sur le visage, rien ne recouvre le visage hors écran partagé et mise en page.
- Détourage (masquerPersonne, texteDerriere) : SEULEMENT si Will le demande explicitement.
- Titre plein écran : seulement si Will le demande. Jamais de bandeau nom ni de marque. Aucun prix.
- Un message peut contenir plusieurs demandes (« il manque des plans de caméra. et beaucoup d'animation au début ; puis vers la fin je bégaie ») : traite-les TOUTES dans la même réponse (plusieurs opérations pour la même consigne), et le résumé les cite toutes. Will écrit vite, au téléphone : lis l'intention malgré les fautes de frappe, les majuscules et les touches voisines (« D4ANIMATION » = « d'animation », « bégueille » = « bégaie », « reprned » = « reprends »). « Je n'ai pas compris » est réservé à un message dont tu ne peux rien tirer.
- « Je bégaie », « je reprends les mêmes phrases », « enlève les répétitions » : cherche dans la transcription les mots ou phrases dits deux fois à quelques secondes d'écart (dans la zone dite : « vers la fin » = dernier tiers) et coupe la PREMIÈRE tentative (« couper » de son premier mot au mot juste avant la reprise) ; la phrase complète reste.
- « Plus de plans de caméra », « ça manque de rythme » : changements de cadre (« zoom » punch-in) répartis toutes les 6 à 10 s ; jamais la multicaméra (option payante, hors de ton vocabulaire).
- Les éléments de type « carte-auto » sont les cartes posées d'office par le studio d'après le texte : « retirer » avec leur id les enlève ; pour les déplacer ou changer leur texte, « retirer » puis « ajouterCarte » au nouvel endroit ou avec le nouveau texte. Une carte que tu poses sur le passage d'une carte-auto l'efface (Will en est averti) : quand l'instant est libre (« quand je parle de… »), choisis un moment sans carte-auto.
- « Remets / rétablis la carte … » : « remettre » avec l'id de l'élément carte-auto-retiree ou carte-auto-effacee (la même carte revient, mêmes textes, même instant) ; jamais une nouvelle carte pour cela.
- Sous-titres : ils ne sont pas dans ton vocabulaire (le studio corrige les mots lui-même) ; ne pose JAMAIS une carte pour eux.
- Une demande de suite dans le fil (« plus lent », « enlève l'icône ») modifie l'élément concerné : « retirer » l'ancien puis poser le nouveau.
- Couverture : quand Will parle d'un texte, d'un numéro ou d'un titre qu'il VOIT et qui n'est ni dans la transcription ni dans les éléments, cherche-le d'abord dans <couverture>. S'il y est : « changerTitreCouverture » (nouveau titre sans ce texte), jamais un montage (pas de « titre », pas de carte refaite). Ne dis JAMAIS qu'un texte est « invisible » à l'écran ou « n'est que le nom du projet » s'il figure sur la couverture. En cas de doute (texte à la fois sur la couverture et dans la vidéo, ou rien ne permet de savoir) : aucune opération, comprise = false, et reponse = « ${QUESTION_COUVERTURE} » au lieu de refaire un montage.
- Renommer la vidéo (son nom dans le studio, <titre>) n'est pas une opération : le studio le fait directement ; ne refais jamais un montage pour cela.
- Habitudes de Will : applique-les quand elles concernent cette vidéo.
- « reponse » : UNE phrase à Will, simple, au vouvoiement, sans jargon technique.
- Si une consigne est impossible ou trop vague, comprise = false et le résumé dit ce qu'il faudrait préciser.
- Pas encore possible dans la vidéo (ne les rends pas, ne dis jamais « c'est fait ») : accélérer ou ralentir, arrêt sur image, cacher Will ou écrire derrière lui (détourage), musique, zoom lent, zoom flou, zoom sur la main. Pour une telle demande : comprise = false et le résumé dit simplement « Pas encore possible : … ».

Vocabulaire :
${catalogueTexte()}

${CONSIGNE_ENVELOPPE}
Signatures :
${SIGNATURES_OPERATIONS_FACECAM}`;

export const roleMonteurFacecam: DefinitionRole<typeof schemaReponseMonteur> = {
  id: "monteur-facecam",
  version: 1,
  consigne: CONSIGNE,
  schema: schemaReponseMonteur,
  modele: MODELE_ECRITURE,
  effort: "high",
  maxTokens: 16000,
  simuler: (entree: EntreeRole) => reglesFixesDepuisVariable(entree.variable),
  // Panne du 10/10 : l'enveloppe part à l'API (grammaire fixe), le vocabulaire complet juge à la réception.
  envoi: { schema: schemaReponseMonteurEnvoyee, lire: lireEnvoiMonteur },
};

/* ------------------------------------------------------------------ */
/* Relecture des images de contrôle (1 correction au plus)            */
/* ------------------------------------------------------------------ */

export const DEFAUTS_RELECTURE = ["visage-cache", "texte-deborde", "carte-illisible", "zone-non-sure", "bords-detourage", "image-noire", "sous-titre-sur-bouche", "autre"] as const;

export const schemaRelecture = z.object({
  /** Tout est bon : aucune correction. */
  ok: z.boolean(),
  defauts: z.array(z.object({ elementId: z.string().nullable(), defaut: z.enum(DEFAUTS_RELECTURE), detail: z.string() })),
  /** Corrections (opérations du même vocabulaire, « retirer » compris) ; appliquées une seule fois, sans nouvelle relecture. */
  corrections: z.array(schemaOperationFacecam),
});
export type SortieRelecture = z.infer<typeof schemaRelecture>;

/** Forme ENVOYÉE de la relecture : corrections en enveloppe (panne du 10/10). */
export const schemaRelectureEnvoyee = schemaRelecture.extend({ corrections: z.array(schemaOperationEnvoyee) });

/** Lecture de la forme envoyée : corrections dépliées et validées une à une (les écartées sont dites, pas fatales). */
export function lireEnvoiRelecture(brut: unknown): { valeur: unknown; remarques: string[] } {
  if (!brut || typeof brut !== "object") return { valeur: brut, remarques: [] };
  const o = brut as { corrections?: unknown };
  const c = lireCorrections(o.corrections);
  return { valeur: { ...o, corrections: c.operations }, remarques: c.remarques };
}

export const roleRelectureFacecam: DefinitionRole<typeof schemaRelecture> = {
  id: "relecture-facecam",
  version: 1,
  consigne: `Tu relis les images de contrôle d'une vidéo face caméra montée (chaque coupe, chaque carte, chaque écran partagé, les 3 premières secondes, la dernière image). Liste fermée de défauts : ${DEFAUTS_RELECTURE.join(", ")}. Ne signale que ce qui se voit. Pour chaque défaut corrigeable, propose UNE correction (retirer l'élément, le déplacer, le simplifier) ; un effet de détourage aux bords ratés se signale « bords-detourage » (le studio livre alors la variante sans détourage). Si tout est bon : ok = true, aucune correction.

Vocabulaire des corrections :
${catalogueTexte()}

${CONSIGNE_ENVELOPPE}
Signatures :
${SIGNATURES_OPERATIONS_FACECAM}`,
  schema: schemaRelecture,
  modele: MODELE_JUGE,
  effort: "medium",
  maxTokens: 4000,
  simuler: () => ({ ok: true, defauts: [], corrections: [] }),
  envoi: { schema: schemaRelectureEnvoyee, lire: lireEnvoiRelecture },
};

/* ------------------------------------------------------------------ */
/* Ancre d'une consigne et version simple (règles fixes)               */
/* ------------------------------------------------------------------ */

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/*
 * Mission H : l'ancrage d'une consigne sur un mot (temps cité, mot cité, instant dit) est COMMUN à tous les formats ;
 * il vit dans la brique `monteur` (même code qu'au lot D). Réexporté ici : le face caméra ne change pas.
 */
import { ancreConsigne, instantDans, motCite } from "@/briques/monteur/ancrage";
export { ancreConsigne, instantDans, motCite };

const contient = (t: string, ...motifs: RegExp[]) => motifs.some((m) => m.test(t));

/** Texte entre guillemets, ou après « : ». */
function texteCite(texte: string): string | null {
  const g = texte.match(/[«“"]\s*([^»”"]+?)\s*[»”"]/);
  if (g) return g[1];
  const deuxPoints = texte.split(/\s:\s|:\s/)[1];
  return deuxPoints?.trim() || null;
}

/**
 * Textes d'une carte 7 à 13 en version simple (mission L), selon la convention `CONVENTION_TEXTES_ETENDUS` : le texte
 * cité, découpé en morceaux pour les modèles à plusieurs éléments (« administratif 9 h » → « administratif : 9 h »,
 * points d'une check-list, problème puis solution, lieu / date / chiffre). Si les textes ne suffisent pas, le raccord
 * applique la règle du modèle à la description (`carteDuModeleDepuisPhrase`).
 */
function textesModeleEtendu(modele: IdModeleMotionEtendu, texte: string): string[] {
  const cite = texteCite(texte);
  const morceaux = (x: string) => x.split(/\s*[;•|]\s*|,\s+|\s+et\s+/).map((m) => m.trim()).filter(Boolean);
  switch (modele) {
    case "graphique": {
      // Variante demandée (« en camembert », « en courbe », « en barres ») : dernier texte, comme le veut la convention.
      const variante = sansAccents(texte).match(/\b(camembert|courbe|barres)\b/)?.[1];
      const valeurs = cite
        ? morceaux(cite).map((m) => {
            if (m.includes(":")) return m;
            const fin = m.match(/^(.+?)\s+(\d[\d\s,.]*\s*[^\s\d]*)$/);
            const debut = m.match(/^(\d[\d,.]*\s*(?:h|heures?|min|jours?|%|€|ans?|mois)?)\s+(?:de\s+|d'|d’)?(.+)$/i);
            return fin ? `${fin[1]} : ${fin[2]}` : debut ? `${debut[2]} : ${debut[1]}` : m;
          })
        : [];
      return valeurs.length && variante ? [...valeurs, variante] : valeurs;
    }
    case "check-list": {
      const points = cite ? morceaux(cite) : [];
      // 3 textes ou plus : le premier est le titre (convention) ; la version simple n'en invente qu'un, neutre.
      return points.length >= 2 ? ["À vérifier", ...points] : points;
    }
    case "probleme-solution":
      return cite ? cite.split(/\s*(?:→|->|=>|;)\s*/).map((x) => x.trim()).filter(Boolean) : [];
    case "documentaire":
      return cite ? morceaux(cite).map((m) => m.replace(/^(?:à|a|en|au|aux|dans)\s+(?!\d)/i, "")) : [];
    case "icone-mot": {
      const mot = cite ?? texte.match(/\bmot\s+[«“"]?\s*([A-Za-zÀ-ÿ'’-]+)/i)?.[1];
      return mot ? [mot] : [];
    }
    default:
      return cite ? [cite] : [];
  }
}

/**
 * VERSION SIMPLE : traduit une consigne par des règles fixes (mots-clés), modèles fixes seulement (aucun HTML).
 * Mission L : les modèles 7 à 13 se choisissent à la demande (« fais un graphique », « en check-list », « façon
 * reportage »…, `lireDemandeModele`) ; le titre plein écran passe par la règle « titre » (« titre plein écran »), jamais
 * tout seul.
 * Rend `null` si la consigne n'est pas reconnue (elle reste « non comprise », avec « Reformuler »).
 */
export function operationsParRegles(c: ConsigneATraiter): OperationFacecam[] | null {
  const t = sansAccents(c.texte);
  const { debutMot, finMot } = c.ancre;
  // Lot F3 : effets spéciaux d'abord (« zoom à travers l'écran » n'est pas un zoom).
  // Lot K : une action réaliste (« jette-le sur l'écran », « en réaliste ») passe avant l'objet 3D (« en 3D », gratuit).
  const realiste = operationEffetRealisteParRegles(c.texte, debutMot);
  if (realiste) return [realiste];
  const effet = operationEffetParRegles(c.texte, debutMot, finMot);
  if (effet) return [effet];
  const ops: OperationFacecam[] = [];
  // Mission L : modèle 7 à 13 demandé par Will (le titre plein écran reste à la règle « titre » ci-dessous).
  // La capture annotée demande une image du passage, que la version simple ne connaît pas : elle reste à Claude.
  const lue = lireDemandeModele(c.texte);
  const demande = lue === "capture-annotee" ? null : lue;
  const carte = (modele: ModeleCarte, disposition: "plein-ecran" | "ecran-partage" = "plein-ecran", textes = texteCite(c.texte) ? [texteCite(c.texte)!] : []): OperationFacecam => ({
    type: "ajouterCarte",
    debutMot,
    finMot,
    modele,
    textes,
    html: null,
    disposition,
    description: c.texte.trim().slice(0, 200),
    animationGardeeId: null,
  });

  if (contient(t, /cache[- ]?moi|fais[- ]moi (dispara|partir)|disparai/)) ops.push({ type: "masquerPersonne", debutMot, finMot });
  else if (contient(t, /derriere moi|entre le mur et moi|texte derriere/)) ops.push({ type: "texteDerriere", debutMot, finMot, texte: texteCite(c.texte) ?? "" });
  else if (contient(t, /arret sur image|fige l'image|freeze/)) ops.push({ type: "arretImage", auMot: debutMot, dureeSec: 1.5, texte: texteCite(c.texte) });
  else if (contient(t, /generique/)) ops.push({ type: "generique", position: /debut|ouverture/.test(t) ? "debut" : "fin", texte: texteCite(c.texte) ?? "", dureeSec: 4 });
  else if (contient(t, /\btitre\b/)) ops.push({ type: "titre", texte: texteCite(c.texte) ?? "", debutMot: null, finMot: null, pleinEcran: /plein ecran/.test(t) });
  else if (contient(t, /accelere|plus vite|en accelere/)) ops.push({ type: "vitesse", debutMot, finMot, facteur: 1.5 });
  else if (contient(t, /ralenti|plus lent/)) ops.push({ type: "vitesse", debutMot, finMot, facteur: 0.75 });
  else if (contient(t, /divise l'ecran|ecran (partage|divise)|coupe l'ecran en deux|split/)) ops.push({ type: "ecranPartage", debutMot, finMot, description: c.texte.trim().slice(0, 200), textes: [] });
  else if (contient(t, /petite version de moi|vignette|en petit/)) ops.push({ type: "miseEnPage", debutMot, finMot, mode: "vignette", cote: null, description: c.texte.trim().slice(0, 200) });
  else if (contient(t, /mets[- ]moi a (droite|gauche)|moi a (droite|gauche)/)) ops.push({ type: "miseEnPage", debutMot, finMot, mode: "cote", cote: /droite/.test(t) ? "droite" : "gauche", description: c.texte.trim().slice(0, 200) });
  else if (contient(t, /zoom/)) ops.push({ type: "zoom", debutMot, finMot, style: /lent|doucement/.test(t) ? "lent" : "punch-in", cible: /main/.test(t) ? "main" : "visage" });
  else if (demande && demande !== "titre-plein-ecran") ops.push(carte(demande, "plein-ecran", textesModeleEtendu(demande, c.texte)));
  else if (contient(t, /compare|cote a cote|deux colonnes|en commun/)) ops.push(carte("deux-colonnes", "ecran-partage"));
  else if (contient(t, /etapes|processus|feuille de route|ligne de temps|chronologie/)) ops.push(carte("ligne-de-temps", "ecran-partage"));
  else if (contient(t, /\bliste\b|je liste|enumere|les \d+ (points|raisons|erreurs)/)) ops.push(carte("liste", "ecran-partage"));
  else if (contient(t, /chiffre|pourcentage|\d+\s?%/)) ops.push(carte("chiffre"));
  else if (contient(t, /avant.{0,6}apres/)) ops.push(carte("avant-apres"));
  else if (contient(t, /sans musique|enleve la musique|retire la musique|pas de musique/)) ops.push({ type: "son", action: "sans-musique", precision: null, debutMot: null, finMot: null });
  else if (contient(t, /musique/)) ops.push({ type: "son", action: "musique", precision: /calme|douce|pos/.test(t) ? "calme" : /energ|dynami|rythm/.test(t) ? "énergique" : "calme", debutMot: null, finMot: null });
  else if (contient(t, /nettoie le son|son propre|bruit de fond|souffle/)) ops.push({ type: "son", action: "nettoyer", precision: null, debutMot: null, finMot: null });
  else if (contient(t, /plus fort|monte le son/)) ops.push({ type: "son", action: "plus-fort", precision: null, debutMot: null, finMot: null });
  else if (contient(t, /moins fort|baisse le son/)) ops.push({ type: "son", action: "moins-fort", precision: null, debutMot: null, finMot: null });
  else if (contient(t, /whoosh|bruitage/)) ops.push({ type: "son", action: "bruitage", precision: /pop/.test(t) ? "pop" : "whoosh", debutMot, finMot: null });
  else if (contient(t, /plus chaud|plus froid|couleurs?|plus (vif|sature)|moins (vif|sature)/))
    ops.push({ type: "couleurs", reglage: "couleurs", cran: /moins|terne|doux/.test(t) ? "moins" : "plus", teinte: /chaud/.test(t) ? "plus-chaud" : /froid/.test(t) ? "plus-froid" : null });
  else if (contient(t, /lumiere|lumineu|plus clair|plus sombre|eclaire|trop sombre|trop clair/)) ops.push({ type: "couleurs", reglage: "lumiere", cran: /sombre|moins|trop clair/.test(t) && !/trop sombre/.test(t) ? "moins" : "plus", teinte: null });
  else if (contient(t, /dents/)) ops.push({ type: "couleurs", reglage: "dents", cran: /moins/.test(t) ? "moins" : "plus", teinte: null });
  else if (contient(t, /bonne mine|teint|cernes/)) ops.push({ type: "couleurs", reglage: "mine", cran: /moins/.test(t) ? "moins" : "plus", teinte: null });
  else if (contient(t, /\bcoupe\b|enleve (ce passage|cette phrase)|supprime/)) ops.push({ type: "couper", debutMot, finMot });
  return ops.length ? ops : null;
}

/** Réponse quand rien n'est compris : jamais une phrase nue, toujours des exemples à reprendre. */
export const PHRASE_NON_COMPRIS = "Je n'ai pas compris : pouvez-vous reformuler ? Par exemple : « à 0:32 montre les 3 étapes », « coupe l'hésitation à 0:41 », « plus lumineux » ou « enlève les répétitions vers la fin ».";

/** Temps montés occupés par des opérations (index de mots → secondes). */
function occupesDe(ops: OperationFacecam[], mots: MotSimple[]): ContexteRegles["occupes"] {
  const sec = (i: number) => mots.find((m) => m.index === i)?.sec ?? null;
  return ops.flatMap((o) => {
    const x = o as { debutMot?: number | null; finMot?: number | null };
    const d = typeof x.debutMot === "number" ? sec(x.debutMot) : null;
    if (d === null || o.type === "couper") return [];
    const f = typeof x.finMot === "number" ? (sec(x.finMot) ?? d) : d;
    return [{ debutSec: d, finSec: o.type === "ajouterCarte" ? Math.max(f, d + 3) : f, type: o.type === "zoom" ? "zoom" : o.type }];
  });
}

/** Le résumé d'un point compris par une règle mot-clé (une opération, ou plusieurs du même point). */
function pointParRegles(c: ConsigneATraiter, point: string, ctx: ContexteRegles | undefined, zone: [number, number] | null): PointCompose | null {
  // Un point qui dit son moment (« à 0:32 », « quand je dis … ») est calé dessus ; sinon l'ancre de la consigne
  // (instant où elle a été dite au tournage, ou celle du message).
  const situe = instantDans(point) !== null || !!motCite(point);
  const ancre = ctx?.ancrer && point !== c.texte && situe ? ctx.ancrer(point) : c.ancre;
  const parMotCle = () => {
    const ops = operationsParRegles({ ...c, texte: point, ancre });
    return ops ? { operations: ops, resume: resumeOperation(ops[0]), comprise: true } : null;
  };
  // Demande d'ensemble (« plus de zooms », « je bégaie vers la fin ») d'abord, sauf si le point dit son moment.
  if (!ctx) return parMotCle();
  if (situe) return parMotCle() ?? operationsComposees(point, ctx, zone);
  const compose = operationsComposees(point, ctx, zone);
  return compose?.comprise ? compose : (parMotCle() ?? compose);
}

/**
 * Une consigne → ses points (vérif V1 : « IL MAnque pplusierus plan de caméra. ET BEAUCOUP D4ANIMATION AU DEBUT;
 * PUIS VERS LA FIN … je bégueille ») : chaque phrase, et chaque morceau relié par « et » quand chacun se comprend seul.
 */
function pointsCompris(c: ConsigneATraiter, ctx?: ContexteRegles): { faits: PointCompose[]; rates: string[] } {
  const faits: PointCompose[] = [];
  const rates: string[] = [];
  const points = decouperDemande(c.texte);
  for (const point of points.length ? points : [c.texte]) {
    const zone = zoneDite(normaliserFrappe(point));
    const entier = pointParRegles(c, point, ctx, zone);
    const morceaux = morceauxEt(point);
    const parMorceau = morceaux.length > 1 ? morceaux.map((m) => pointParRegles(c, m, ctx, zone)) : [];
    const choisis = parMorceau.filter((x) => x?.comprise).length >= 2 ? parMorceau.filter((x): x is PointCompose => !!x) : entier ? [entier] : [];
    if (!choisis.length) rates.push(point);
    for (const x of choisis) {
      // Deux morceaux qui disent la même chose (« je bégaie et je reprends les mêmes phrases ») : une seule fois.
      if (faits.some((f) => JSON.stringify(f.operations) === JSON.stringify(x.operations))) continue;
      if (!x.comprise) {
        rates.push(x.resume);
        continue;
      }
      faits.push(x);
      // Les points suivants voient ce que celui-ci a posé (pas deux zooms sur le même mot).
      if (ctx) ctx = { ...ctx, occupes: [...ctx.occupes, ...occupesDe(x.operations, ctx.mots)] };
    }
  }
  return { faits, rates };
}

/**
 * Version simple d'un appel entier (aucun HTML, aucun appel). `ctx` (mots vus par le monteur, éléments posés) permet
 * les demandes d'ensemble et les demandes à plusieurs points ; sans lui, une règle par consigne (comme avant).
 */
export function reglesFixes(consignes: ConsigneATraiter[], ctx?: ContexteRegles): ReponseMonteur {
  const operations: OperationFacecam[] = [];
  const lues: ReponseMonteur["consignes"] = [];
  const restes: string[] = [];
  for (const c of consignes) {
    const { faits, rates } = pointsCompris(c, ctx);
    if (!faits.length) {
      const precis = rates.find((r) => /^Je n'ai pas trouvé/.test(r));
      lues.push({ consigneId: c.id, comprise: false, resume: precis ?? "Je n'ai pas compris cette consigne : pouvez-vous la reformuler ?", operations: [] });
      continue;
    }
    const debut = operations.length;
    const ops = faits.flatMap((f) => f.operations);
    operations.push(...ops);
    restes.push(...rates);
    const resume = faits.map((f, i) => (i ? f.resume.charAt(0).toLowerCase() + f.resume.slice(1) : f.resume)).join(" ; ");
    lues.push({ consigneId: c.id, comprise: true, resume, operations: ops.map((_, i) => debut + i) });
  }
  const comprises = lues.filter((l) => l.comprise).length;
  const aPreciser = restes.length ? ` Pas fait, à préciser : « ${restes.map((r) => r.slice(0, 60)).join(" », « ")} ».` : "";
  const reponse = !consignes.length
    ? "Rien à changer."
    : comprises === consignes.length
      ? (comprises > 1 ? `C'est fait : ${comprises} consignes appliquées.` : `C'est fait : ${lues[0].resume.charAt(0).toLowerCase()}${lues[0].resume.slice(1)}${/[.!?]$/.test(lues[0].resume) ? "" : "."}`) + aPreciser
      : comprises
        ? `${comprises} consigne${comprises > 1 ? "s" : ""} sur ${consignes.length} appliquée${comprises > 1 ? "s" : ""} ; les autres sont à reformuler.`
        : (lues.find((l) => /^Je n'ai pas trouvé/.test(l.resume))?.resume ?? PHRASE_NON_COMPRIS);
  return { reponse, operations, consignes: lues };
}

/** Contexte de la version simple relu dans la variable (simulation : Claude pas relié). */
function contexteDepuisVariable(variable: string): ContexteRegles {
  const bloc = (nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n?</${nom}>`))?.[1]?.split("\n").filter(Boolean) ?? [];
  const sec = (h: string) => (/^\d+:\d\d$/.test(h) ? Number(h.split(":")[0]) * 60 + Number(h.split(":")[1]) : null);
  const mots = bloc("transcription").flatMap((l): MotSimple[] => {
    const m = /^\[(\d+)\] (\S+) (.*)$/.exec(l);
    return m ? [{ index: Number(m[1]), sec: sec(m[2]), mot: m[3] }] : [];
  });
  const occupes = bloc("elements").flatMap((l) => {
    const [, type, temps] = l.split(" · ");
    const [d, f] = (temps ?? "").split("-").map(sec);
    // Une carte automatique retirée ou effacée ne prend aucune place.
    return type && !/^carte-auto-(retiree|effacee)/.test(type) && d !== null && d !== undefined ? [{ type: type.split(" ")[0], debutSec: d, finSec: f ?? d }] : [];
  });
  const ancrer = (texte: string) => {
    const t = instantDans(texte);
    const gardes = mots.filter((m) => m.sec !== null);
    const m = t !== null ? (gardes.find((x) => (x.sec ?? 0) >= t - 0.5) ?? gardes[gardes.length - 1]) : gardes[0];
    const i = m ? gardes.indexOf(m) : 0;
    return { debutMot: m?.index ?? 0, finMot: gardes[Math.min(gardes.length - 1, i + 5)]?.index ?? 0 };
  };
  return { mots, occupes, ancrer };
}

function reglesFixesDepuisVariable(variable: string): ReponseMonteur {
  const bloc = variable.match(/<consignes>\n([\s\S]*?)\n<\/consignes>/)?.[1];
  let brut: { id: string; origine: ConsigneATraiter["origine"]; texte: string; debutMot: number; finMot: number }[] = [];
  try {
    brut = bloc ? JSON.parse(bloc) : [];
  } catch {
    brut = [];
  }
  const ctx = contexteDepuisVariable(variable);
  return reglesFixes(brut.map((c) => ({ id: c.id, texte: c.texte, origine: c.origine, ancre: { debutMot: c.debutMot, finMot: c.finMot } })), ctx.mots.length ? ctx : undefined);
}

const NOMS_MODELE: Record<Exclude<ModeleCarte, IdModeleMotionEtendu>, string> = {
  liste: "Liste animée",
  chiffre: "Chiffre en grand",
  "avant-apres": "Avant / après",
  "ligne-de-temps": "Étapes qui avancent",
  "deux-colonnes": "Comparaison côte à côte",
  titre: "Titre animé",
};

/** Mission L : « Carte « Check-list » ajoutée » (nom de la fiche du catalogue de la brique motion). */
function resumeCarte(modele: ModeleCarte): string {
  return estModeleEtendu(modele) ? `Carte « ${CATALOGUE_MOTION_ETENDU[modele].nom} » ajoutée` : `${NOMS_MODELE[modele]} ajoutée`;
}

/** Résumé d'un réglage d'image en mots simples (jamais « lumiere » ni « mine » bruts). */
const RESUMES_IMAGE: Record<string, Partial<Record<string, string>>> = {
  lumiere: { plus: "Image plus lumineuse", moins: "Image moins lumineuse", juste: "Lumière d'origine" },
  couleurs: { plus: "Couleurs plus vives", moins: "Couleurs plus douces", juste: "Couleurs d'origine" },
  mine: { plus: "Meilleure mine", moins: "Teint plus naturel", juste: "Teint d'origine" },
  dents: { plus: "Dents plus blanches", moins: "Dents plus naturelles", juste: "Dents d'origine" },
};

/** Résumé lisible d'une opération (« Zoom », « Musique calme »…). */
export function resumeOperation(op: OperationFacecam): string {
  if (estEffetSpecial(op)) return resumeEffetSpecial(op);
  if (op.type === "effetRealisteIA") return "Effet réaliste par IA préparé : il attend votre confirmation";
  if (op.type === "changerTitreCouverture") return `Titre de couverture « ${op.texte} »`;
  switch (op.type) {
    case "ajouterCarte":
      return op.modele ? resumeCarte(op.modele) : "Animation sur mesure ajoutée";
    case "zoom":
      return op.style === "lent" ? "Zoom lent ajouté" : "Zoom ajouté";
    case "ecranPartage":
      return "Écran partagé ajouté";
    case "miseEnPage":
      return op.mode === "vignette" ? "Vous en petit à l'écran" : `Vous à ${op.cote === "gauche" ? "gauche" : "droite"} de l'écran`;
    case "couleurs":
      return op.teinte === "plus-chaud" ? "Image plus chaude" : op.teinte === "plus-froid" ? "Image plus froide" : (RESUMES_IMAGE[op.reglage]?.[op.cran] ?? "Image retouchée");
    case "son":
      return { nettoyer: "Son nettoyé", musique: `Musique ${op.precision ?? "calme"}`, "sans-musique": "Musique retirée", bruitage: "Bruitage ajouté", "plus-fort": "Son plus fort", "moins-fort": "Son moins fort" }[op.action];
    case "masquerPersonne":
      return "Vous disparaissez puis revenez";
    case "texteDerriere":
      return "Texte placé derrière vous";
    case "vitesse":
      return op.facteur > 1 ? "Passage accéléré" : "Passage ralenti";
    case "arretImage":
      return "Arrêt sur image";
    case "titre":
      return op.texte ? `Titre « ${op.texte} »` : "Titre ajouté";
    case "generique":
      return op.position === "debut" ? "Générique de début" : "Générique de fin";
    case "couper":
      return "Passage coupé";
    case "retablir":
      return "Passage rétabli";
    case "retirer":
      return "Élément retiré";
    case "remettre":
      return "Carte remise";
  }
}
