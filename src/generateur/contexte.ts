/**
 * CONTEXTE D'UNE GÉNÉRATION (plan v5 B.3.3, B.3.10 ; lot G4). PUR.
 *
 * Construit, à partir des DONNÉES (stock, contexte de marque, style, recette résolue, règles des réseaux), ce que les
 * rôles reçoivent :
 *  - le SOCLE mis en cache (1 h), identique pour tous les rôles, formats et sujets : `<contexte_axion>`, `<style_will>`,
 *    `<preuves>` ; puis ce qui dépend du format : `<gagnants>` (ses modèles de ton) et `<recette_format>` (son cadre) ;
 *  - la partie variable : le sujet, les matières (anonymisées, en `<matiere type=… id=…>`), le choix de l'étape 0, la
 *    recette résolue et les règles des réseaux cochés.
 * Rien ici ne nomme un format, une structure ou un réseau : tout vient de `parametresGenerateur` et de `ecritureReseau`.
 * Garde « rien d'inventé » : un nombre d'une matière qui n'est la valeur d'AUCUNE preuve validée est signalé
 * (`chiffres-non-prouves`) et ne doit jamais être dit (C1 le bloque s'il l'est).
 */
import { anonymiser, utilisable, type ConsignesDiversite } from "@/domaine/controles-script";
import type { StructureGenerateur } from "@/domaine/controles-script/types";
import { memeValeur, nombresAffirmes } from "@/domaine/nombres-fr";
import type { Adresse, ChoixSerie, ContexteAxion, ExempleStyle, FicheStyle, Matiere, ModeDiction, ObjectifSujet, Preuve, ReseauDeclinaison, ScriptMaitre } from "@/domaine/types";
import { CADRE_AXION } from "@/donnees/generateur/domaine-axion";
import { EXTRAITS_AVOCATREF, rendreExtraits } from "@/donnees/generateur/modeles-avocatref";
import { EXTRAITS_WILL } from "@/donnees/generateur/modeles-will";
import type { CadreDuFormat, ParametresGenerateur, SourceTon } from "@/donnees/generateur/parametres-generateur";
import { pertinence } from "./choix-combinaison";
import type { EntreeRole } from "@/generateur/roles/types";
import { ecritureReseau } from "@/reseaux/ecriture";

/** Tout ce que la chaîne reçoit du service (ou du banc), en données. */
export interface DonneesGeneration {
  maintenant: string;
  sujet: {
    idee: string;
    phraseWill?: string;
    objectif: ObjectifSujet;
    niveauConscience: ScriptMaitre["brief"]["niveauConscience"];
    cible?: string;
    motCle?: string;
    adresse: Adresse;
    mode: ModeDiction;
    reseaux: ReseauDeclinaison[];
    formatId: string;
    sujetSensible?: ScriptMaitre["brief"]["sujetSensible"];
    stadeCompte?: "demarrage" | "etabli";
    /** Pilier d'Axion-IA (rattachement obligatoire, §2 quater). */
    pilier?: { id: string; nom: string };
  };
  choix: ChoixSerie;
  /** 2 à 3 combinaisons réalisables (la retenue en tête). */
  combinaisons: ChoixSerie[];
  matieres: Matiere[];
  preuves: Preuve[];
  contexteAxion?: Pick<ContexteAxion, "positionIds" | "piliers" | "interdits" | "promessesInterdites" | "jargonInterdit" | "rolesDestinataires" | "appelDeSerie" | "phraseMarque" | "carnetVoix" | "termesVagues">;
  ficheStyle?: Pick<FicheStyle, "expressions" | "motsBannis" | "notes" | "ouvertures">;
  exemplesStyle?: Pick<ExempleStyle, "id" | "texte">[];
  /** Expressions récentes à ne pas reprendre (C44 : apaisement, relance, exception, appel). */
  expressionsRecentes?: string[];
  /** Intensités des sujets précédents (C80). */
  intensitesRecentes?: ("douleur" | "gain" | "curiosite")[];
  /** §2 sexies : ce que la série a trop vu, et la rupture due (calculé à l'étape 0). */
  diversite?: ConsignesDiversite;
  /**
   * Noms sensibles de TOUT le stock (`chargerSocleWill`), quel que soit le sujet : le socle est anonymisé sur cette
   * liste globale, donc identique d'un sujet à l'autre. Absente : les noms des données reçues (`nomsSensiblesDu`).
   * Le tableau, le cas concret et l'image-vidéo la reçoivent (`blocsSocleWill`), le générateur aussi (`boucle-generation.ts`,
   * `donneesDe`).
   */
  nomsSensibles?: readonly string[];
  /**
   * Bloc `<gagnants>` MESURÉ (apprentissage, éteint par défaut), recalculé une fois par jour par le service : les
   * vidéos de Will qui ont le mieux marché, en forme. Absent : les extraits de Will, comme avant.
   */
  gagnantsMesures?: string;
}

function propre(t: string, noms: string[]): string {
  return anonymiser(t, { nomsSensibles: noms }).texte;
}

/** Noms sensibles de tout le stock : jamais envoyés à Claude (C59). */
export function nomsSensiblesDu(d: Pick<DonneesGeneration, "matieres" | "preuves">): string[] {
  return [...d.matieres.flatMap((m) => m.nomsSensibles ?? []), ...d.preuves.flatMap((p) => p.client?.nomsSensibles ?? [])];
}

/**
 * Noms masqués dans le SOCLE : la liste globale du stock, plus ceux des données reçues (déjà dans la liste globale
 * quand elle est donnée : l'anonymisation ne dépend ni de l'ordre ni des doublons, le socle reste le même).
 */
export function nomsDuSocle(d: Pick<DonneesGeneration, "matieres" | "preuves" | "nomsSensibles">): string[] {
  return [...new Set([...(d.nomsSensibles ?? []), ...nomsSensiblesDu(d)])].sort();
}

/** Nombres d'une matière qui ne sont la valeur d'aucune preuve validée (« 99 % »…). */
export function chiffresNonProuves(texte: string, preuves: Preuve[]): string[] {
  const valeurs = preuves.filter((p) => p.statut === "validee").flatMap((p) => p.valeurs.map((v) => v.normalise));
  return nombresAffirmes(texte)
    .filter((n) => !valeurs.some((v) => memeValeur(v, n.valeur)))
    .map((n) => n.brut);
}

/* ------------------------------------------------------------------ */
/* Le socle mis en cache (ordre figé), puis les blocs du format        */
/* ------------------------------------------------------------------ */

/**
 * Le SOCLE de Will : ce que les blocs en cache lisent des données (charte, style, textes, preuves, positions). Le
 * générateur le tire de ses données ; le tableau animé le charge seul (`services/socle-will.ts`).
 */
export type DonneesSocle = Pick<DonneesGeneration, "maintenant" | "matieres" | "preuves" | "contexteAxion" | "ficheStyle" | "exemplesStyle" | "nomsSensibles" | "gagnantsMesures">;

/** Le bloc `<gagnants>` : les modèles de ton demandés par le format, la v4 de Will toujours en premier. */
export function rendreGagnants(modelesDeTon: readonly SourceTon[], mesures?: string): string {
  if (modelesDeTon.includes("will") && mesures?.trim()) {
    const avocatref = modelesDeTon.includes("avocatref") ? ["Vidéos modèles du style imité (texte dit réel, citations courtes) : des modèles de TON et de rythme, jamais un contenu à reprendre.", rendreExtraits(EXTRAITS_AVOCATREF)] : [];
    return [mesures.trim(), ...avocatref].join("\n");
  }
  const will = modelesDeTon.includes("will") ? ["Le ton de Will, sa meilleure vidéo (la v4, texte dit réel, citations courtes) : un modèle de TON et de rythme, jamais un contenu à reprendre.", rendreExtraits(EXTRAITS_WILL)] : [];
  const avocatref = modelesDeTon.includes("avocatref") ? ["Vidéos modèles du style imité (texte dit réel, citations courtes) : des modèles de TON et de rythme, jamais un contenu à reprendre.", rendreExtraits(EXTRAITS_AVOCATREF)] : [];
  return [...will, ...avocatref].join("\n");
}

/**
 * Les blocs du contexte. Le SOCLE (`contexteAxion`, `styleWill`, `preuves`) ne dépend NI du format NI du sujet : mêmes
 * octets pour tous les appels (cache 1 h partagé ; noms masqués sur la liste globale quand `d.nomsSensibles` est
 * donnée, sinon sur les noms des données reçues ; positions dans l'ordre choisi par Will). `format` n'ajoute qu'APRÈS le socle : ses modèles de ton (`gagnants`) et son cadre propre (`recette`).
 * Aucun nom de format ici.
 */
export function blocsEnCache(d: DonneesSocle, format: CadreDuFormat): EntreeRole["contexte"] {
  const noms = nomsDuSocle(d);
  const c = d.contexteAxion;
  const positions = [...new Set(c?.positionIds ?? [])].map((id) => d.matieres.find((m) => m.id === id)).filter((m): m is Matiere => !!m);
  const contexteAxion = [
    CADRE_AXION,
    c?.piliers.length ? `Thèmes : ${c.piliers.map((p) => p.nom).join(" · ")}.` : "",
    positions.length ? `Positions de Will (citations exactes) :\n${positions.map((m) => `- ${propre(m.texte, noms)}`).join("\n")}` : "",
    `Interdits (ordres permanents de Will) :\n${(c?.interdits ?? []).map((i) => `- ${i.texte}`).join("\n") || "- aucun"}`,
    `Promesses interdites : ${(c?.promessesInterdites ?? []).join(" · ") || "aucune"}.`,
    c?.jargonInterdit.length ? `Jargon interdit : ${c.jargonInterdit.join(", ")}.` : "",
    `Rôles destinataires d'un envoi : ${(c?.rolesDestinataires ?? []).join(", ") || "dirigeant"}.`,
    c?.appelDeSerie ? `Appel de série en cours (texte fixe) : « ${c.appelDeSerie.texte} ».` : "",
    c?.phraseMarque ? `Phrase-marque choisie par Will : « ${c.phraseMarque} ».` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const f = d.ficheStyle;
  const exemples = [...(d.exemplesStyle ?? [])].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 5);
  const carnet = (c?.carnetVoix ?? []).filter((x) => x.validee).map((x) => x.expression);
  const styleWill = [
    "Français oral, phrases courtes, rythme varié, verdict posé. Aucun ton publicitaire, aucune emphase marketing.",
    f?.expressions.length ? `Expressions de Will : ${f.expressions.join(" · ")}.` : "",
    carnet.length ? `Carnet de voix (à reprendre telles quelles) : ${carnet.join(" · ")}.` : "",
    f?.motsBannis.length ? `Mots bannis par Will : ${f.motsBannis.join(", ")}.` : "",
    f?.notes ? `Notes : ${f.notes}` : "",
    exemples.length ? `Textes de Will :\n${exemples.map((x) => `<texte_will id="${x.id}">${propre(x.texte, noms)}</texte_will>`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const preuves = [...d.preuves]
    .filter((p) => utilisable(p, d.maintenant))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => {
      const valeurs = p.valeurs.map((v) => v.brut).join(" ; ");
      const autorise = p.formulationsAutorisees.length ? ` | se dit : ${p.formulationsAutorisees.map((x) => `« ${x} »`).join(", ")}` : "";
      const interdit = p.formulationsInterdites.length ? ` | ne jamais dire : ${p.formulationsInterdites.map((x) => `« ${x} »`).join(", ")}` : "";
      const vague = p.nature === "vague" ? " | jamais chiffrée" : "";
      const incompatibles = p.motsClesIncompatibles.length ? ` | mots-clés incompatibles : ${p.motsClesIncompatibles.join(", ")}` : "";
      const client = p.client ? ` | client anonyme${p.client.secteur ? ` (secteur : ${p.client.secteur})` : ", aucun secteur, taille ni montant attribué"}` : "";
      return `<preuve id="${p.id}" type="${p.type}" niveau="${p.niveau}" nature="${p.nature}"${valeurs ? ` valeurs="${valeurs}"` : ""}>${propre(p.enonce, noms)}${autorise}${interdit}${vague}${incompatibles}${client}</preuve>`;
    })
    .join("\n");

  return { contexteAxion, styleWill, preuves: preuves || "Aucune preuve validée.", gagnants: rendreGagnants(format.modelesDeTon, d.gagnantsMesures), ...(format.cadreFormat?.trim() ? { recette: format.cadreFormat } : {}) };
}

/* ------------------------------------------------------------------ */
/* Partie variable                                                      */
/* ------------------------------------------------------------------ */

/** Matières envoyées : les ancrages des combinaisons d'abord, puis les autres matières utilisables du même pilier. */
export function matieresEnvoyees(d: DonneesGeneration): Matiere[] {
  const ids = new Set(d.combinaisons.flatMap((c) => c.ancrages.map((a) => a.matiereId)));
  const dispo = d.matieres.filter((m) => utilisable(m, d.maintenant) && (!m.accord?.requis || m.accord.obtenu));
  const ancrages = dispo.filter((m) => ids.has(m.id));
  // Les autres matières du sujet : même pilier, ou compatibles par les mots (une matière dictée n'a souvent pas de pilier).
  const brief = { idee: d.sujet.idee, pilier: d.choix.pilier ?? d.sujet.pilier?.id, motsCles: d.sujet.motCle ? [d.sujet.motCle] : [], reseaux: d.sujet.reseaux, objectif: d.sujet.objectif };
  const autres = dispo
    .filter((m) => !ids.has(m.id))
    .map((m) => ({ m, p: pertinence(m, brief) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.m.id.localeCompare(b.m.id))
    .map((x) => x.m);
  return [...ancrages, ...autres].slice(0, 12);
}

export function rendreMatiere(m: Matiere, d: DonneesGeneration): string {
  // Même liste que le socle (liste globale du stock quand elle est donnée, relecture A09).
  const noms = nomsDuSocle(d);
  const non = chiffresNonProuves(m.texte, d.preuves);
  const attrs = [
    `type="${m.type}"`,
    `id="${m.id}"`,
    m.preuveId ? `preuve="${m.preuveId}"` : "",
    m.frequente ? `frequente="oui"` : "",
    m.source.origine ? `origine="${m.source.origine}"` : "",
    non.length ? `chiffres-non-prouves="${non.join(" ; ")}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const scene = m.scene ? ` [scène : ${propre(m.scene, noms)}]` : "";
  return `<matiere ${attrs}>${propre(m.texte, noms)}${scene}</matiere>`;
}

function rendreStructure(s: StructureGenerateur): string {
  const temps = s.temps.map((t) => `${t.libelle}${t.obligatoire ? " (obligatoire)" : ""}${t.avantSec ? `, avant ${t.avantSec} s` : ""}`).join(" ; ");
  return `${s.id} « ${s.nom} » : ${s.enchainement.join(" → ")}${temps ? ` | temps : ${temps}` : ""}`;
}

/** Recette résolue, en clair (données) : plafonds, structures des combinaisons, familles d'accroche permises. */
export function rendreRecette(p: ParametresGenerateur, d: DonneesGeneration, debit: number): string {
  const r = p.recette;
  const structures = [...new Set(d.combinaisons.map((c) => c.structure))].map((id) => r.structures.find((s) => s.id === id)).filter((s): s is StructureGenerateur => !!s);
  return [
    `Débit du mode « ${d.sujet.mode} » : ${debit} mots par seconde (le code calcule toutes les durées).`,
    `Accroche : au plus ${r.accrocheMaxSec} s et ${r.accrocheMaxMots} mots, une affirmation ou un résultat, au plus ${r.nombresMaxAccroche} nombre.`,
    `Corps : au plus ${r.corpsMaxSec} s (≈ ${Math.floor(r.corpsMaxSec * debit)} mots). Jamais allonger pour remplir.`,
    `Appel : ${r.appelFacultatif ? "facultatif" : "obligatoire"}, ${r.appelMinMots} à ${r.appelMaxMots} mots quand il existe. Exception (limite) : ${r.exceptionObligatoire ? "obligatoire" : "facultative"} ; formules réelles : ${r.formulesException.slice(0, 5).join(" · ")}.`,
    `Structures transmises :\n${structures.map((s) => `- ${rendreStructure(s)}`).join("\n")}`,
    `Ressentis permis : ${r.emotionsPermises.join(", ")}. Points de vue permis : ${r.pointsDeVuePermis.join(", ")}.`,
  ].join("\n");
}

/** Règles d'écriture d'un réseau (données datées, avec leur `regleId`). */
export function rendreReseau(r: ReseauDeclinaison, p: ParametresGenerateur): string {
  const e = ecritureReseau(r);
  const pr = p.reseau(r);
  return [
    `Réseau ${r} : zone ${e.zoneDureeSec.valeur[0]}-${e.zoneDureeSec.valeur[1]} s [${e.zoneDureeSec.regleId}]`,
    `boucle : ${e.boucle.valeur} [${e.boucle.regleId}]`,
    `mots-dièse : ${e.motsDiese.valeur[0]}-${e.motsDiese.valeur[1]} [${e.motsDiese.regleId}]`,
    `1re ligne : ${e.premiereLigne.valeur.consigne}${e.premiereLigne.valeur.caracteresMax ? ` (≤ ${e.premiereLigne.valeur.caracteresMax} caractères)` : ""} [${e.premiereLigne.regleId}]`,
    `appels permis : ${pr.appelsPermis.join(", ")} ; défaut : ${pr.appelParDefaut}`,
    ...e.particularites.map((x) => `${x.valeur} [${x.regleId}]`),
  ].join(" | ");
}

/** Le sujet, en données. */
export function rendreSujet(d: DonneesGeneration): string {
  const s = d.sujet;
  // Même liste que le socle (liste globale du stock quand elle est donnée, relecture A09).
  const noms = nomsDuSocle(d);
  return [
    `<sujet>`,
    `Idée : ${propre(s.idee, noms)}`,
    s.pilier ? `Pilier d'Axion-IA : ${s.pilier.nom}` : "",
    `But : ${s.objectif} · niveau de conscience : ${s.niveauConscience} · adresse : ${s.adresse} · qui parle : ${s.mode === "avatar" ? "le double de Will (texte écrit d'avance)" : "Will lui-même"}`,
    s.cible ? `Cible : ${s.cible}` : "",
    s.motCle ? `Mot-clé cherché : ${s.motCle}` : "",
    s.sujetSensible ? `Sujet sensible : ${s.sujetSensible} (jamais un conseil personnalisé)` : "",
    `Réseaux : ${s.reseaux.join(", ")}${s.stadeCompte ? ` · comptes : ${s.stadeCompte}` : ""}`,
    `</sujet>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Choix de l'étape 0 (combinaisons transmises), en données. */
export function rendreChoix(d: DonneesGeneration): string {
  return d.combinaisons
    .map((c, i) => `<combinaison n="${i + 1}" structure="${c.structure}" ancrage="${c.ancrages.map((a) => `${a.matiereId}:${a.type}`).join(",")}" point-de-vue="${c.pointDeVue}" ressenti="${c.emotion}"${c.relachements.length ? ` relachements="${c.relachements.map((x) => x.axe).join(",")}"` : ""}/>`)
    .join("\n");
}
