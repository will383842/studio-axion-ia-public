/**
 * DOSSIER DE L'ÉCRAN DE VALIDATION du tutoriel d'outil (T-EXT-24) : PUR, aucun réseau, aucun appel payant, rien ne l'appelle
 * (seul l'écran de validation, éteint tant que le format reste masqué, le lit).
 *
 * Construit, pour UNE vidéo, tout ce que Williams doit voir AVANT la voix et le rendu : le genre de vidéo retenu, la fiche
 * de valeur, les deux versions du script côte à côte, le parcours phrase par phrase, le verdict du contrôleur sans IA en
 * phrases simples, la liste mot pour mot de tous les textes de la vidéo et, si on le lui donne, le devis en phrases.
 *
 * Règles tenues ici : le texte de Williams fait foi (aucun texte n'est nettoyé ni reformulé) ; aucune étiquette de la
 * famille interdite à l'écran ; aucun montant (le devis arrive en phrases déjà écrites, reprises telles quelles) ; aucune
 * chaîne de ce fichier n'est envoyée au rendu.
 */
import { MOTS_PAR_SECONDE } from "../script";
import type { CarteZones, GesteZone } from "./analyste";
import type { CahierVideo, CasTutoriel, FinChoisie, IdGabarit } from "./chef-de-projet";
import { resumePourWilliams, type VerdictControleur } from "./controleur";
import type { ParcoursTutoriel } from "./realisateur";
import { lignesPourValidation, type RegistreTextes } from "./registre-textes";
import { verifierVersion, type IdVersion, type PhraseChoisie, type PropositionScripts, type ScriptChoisi, type TempsPhrase } from "./scenariste";
import type { FicheValeur } from "./strategie-valeur";

/* ------------------------------------------------------------------ */
/* Mots simples                                                        */
/* ------------------------------------------------------------------ */

export const PHRASE_MINIATURE_ABSENTE = "miniature après la capture";
export const PHRASE_AUCUNE_FIN = "Aucune";
export const PHRASE_FIN_RENDEZ_VOUS = "Prendre rendez-vous";
const PHRASE_GESTE_ABSENT = "geste précisé avec le parcours";
const PHRASE_ZONE_ABSENTE = "écran précisé avec le parcours";
const PHRASE_VERSION_BLOQUEE = "Cette version doit d'abord être corrigée.";

const CAS: Record<CasTutoriel, string> = {
  1: "Tableau de bord fourni",
  2: "Tableau de bord à créer",
  3: "Automatisation sans tableau de bord",
  4: "Assistant qui répond",
  5: "Mélange",
};

const GABARITS: Record<IdGabarit, string> = {
  "G-Journee": "Une journée avant / après",
  "G-Decision": "Du chiffre à la décision",
  "G-Reponse": "Le client écrit à 2 h du matin",
  "G-Flux": "Une automatisation de bout en bout",
};

/** Jamais « Douleur », « Solution », « Exemple », « À vous » : les trois temps d'une phrase en mots de tous les jours. */
const TEMPS: Record<TempsPhrase, string> = {
  situation: "Situation",
  changement: "Ce qui change",
  gain: "Ce que l'entreprise gagne",
};

const GESTES: Record<GesteZone, string> = {
  clic: "on clique",
  defilement: "on fait défiler",
  saisie: "on écrit",
  survol: "on survole",
  zoom: "on s'approche",
  apparition: "ça apparaît",
};

const DEVIENT: Record<FicheValeur["gainEntreprise"]["devient"], string> = {
  "plus-sereine": "Une entreprise plus sereine",
  "plus-solide": "Une entreprise plus solide",
  "prete-a-grandir": "Une entreprise prête à grandir",
  "plus-maitre-de-ses-decisions": "Une entreprise plus maître de ses décisions",
};

const EMOTION: Record<FicheValeur["emotion"], string> = { soulagement: "Soulagement", maitrise: "Maîtrise" };

const OU: Record<string, string> = {
  voix: "Voix",
  maquette: "Écran de l'outil",
  conversation: "Conversation",
  "ecran-studio": "Texte proposé par le Studio",
  fin: "Fin",
};

const ORIGINE: Record<string, string> = {
  "script-choisi": "Script que vous avez choisi",
  "script-corrige": "Script que vous avez corrigé",
  "fin-choisie": "Fin que vous avez choisie",
  "maquette-dossier": "Maquette de votre dossier",
  "maquette-creee": "Maquette créée pour l'occasion",
  "conversation-dossier": "Conversation de votre dossier",
  "proposition-studio": "Proposition du Studio",
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EntreeDossierValidation {
  cahier: CahierVideo;
  carte: CarteZones;
  fiche: FicheValeur;
  proposition: PropositionScripts;
  scriptChoisi?: ScriptChoisi;
  parcours?: ParcoursTutoriel;
  verdict: VerdictControleur;
  registre?: RegistreTextes;
  /** Url signée de la miniature de chaque étape de la maquette (facultatif : elles existent après la capture). */
  miniatures?: Record<string, string>;
  /** T-EXT-42 : phrases du devis et empreinte, calculées par l'appelant ; facultatif. */
  devis?: { phrases: string[]; empreinte: string };
  /** Durée de la fin commune choisie (0 si aucune) ; sert seulement à la vérification des versions. */
  dureeFinSec?: number;
}

export interface PhraseVue {
  texte: string;
  /** « Situation », « Ce qui change » ou « Ce que l'entreprise gagne » ; absent si la phrase n'est pas annotée. */
  temps?: string;
  apport?: string;
  /** Nom interne de la zone montrée pendant la phrase. */
  zone?: string;
  dureeSec: number;
  /** Phrase corrigée par Williams, à relire une dernière fois. */
  aRevoir?: boolean;
}

export interface VersionVue {
  id: IdVersion;
  origine: string;
  phrases: PhraseVue[];
  dureeSec: number;
  remarques: string[];
  blocages: string[];
}

export interface MomentVue {
  id: string;
  /** Nom interne de la zone. */
  zone: string;
  geste: string;
  evite?: string;
  permet?: string;
}

export interface LigneParcours {
  numero: number;
  phrase: string;
  zone: string;
  geste: string;
  /** Url signée, ou « miniature après la capture ». */
  miniature: string;
  /** Vrai quand `miniature` est bien une adresse (sinon c'est la phrase d'attente). */
  miniatureDisponible: boolean;
}

export interface LigneTexte {
  texte: string;
  ou: string;
  origine: string;
  choisi: boolean;
}

export interface PropositionVue {
  id: string;
  texte: string;
  ou: string;
  choisi: boolean;
}

export interface DossierValidation {
  entete: { cas: string; gabarits: string[]; fin: string; formats: string[]; dureeVisee: string };
  valeur: {
    persona: { metier: string; journee: string; perte: string };
    avant: string[];
    moments: MomentVue[];
    gain: { devient: string; pourquoi: string };
    emotion: string;
  };
  versions: VersionVue[];
  /** Version déjà choisie, s'il y en a une (« corrigée » quand le texte est celui de Williams). */
  choix: { source: "choisi" | "corrige"; texte: string } | null;
  parcours: LigneParcours[];
  controle: {
    resume: string;
    peutValider: boolean;
    /** Les défauts à corriger, une phrase chacun ; vide quand rien ne bloque. */
    raisons: string[];
  };
  textes: {
    lignes: LigneTexte[];
    propositions: PropositionVue[];
    /** La fin est choisie mais son texte exact manque : le Studio ne l'invente pas. */
    finSansTexte: boolean;
  };
  /** Présent seulement si un devis est fourni : ses phrases telles quelles. */
  devis?: { phrases: string[] };
  /** Transmise telle quelle à l'action de validation ; le clic « Valider » vaut accord du devis. */
  empreinteDevis?: string;
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

const nbMots = (t: string): number => t.split(/\s+/).filter(Boolean).length;
const duree = (t: string): number => Math.round((nbMots(t) / MOTS_PAR_SECONDE) * 10) / 10;

function nomFin(fin: FinChoisie): string {
  return fin === "prendre-rendez-vous" ? PHRASE_FIN_RENDEZ_VOUS : PHRASE_AUCUNE_FIN;
}

interface PhraseCommune {
  texte: string;
  temps?: TempsPhrase;
  apport?: string;
  zoneId?: string;
  aRevoir?: boolean;
}

/** Nom interne de la zone d'après la carte ; l'identifiant lui-même à défaut. */
function nomZone(carte: CarteZones, zoneId: string | undefined): string | undefined {
  if (!zoneId) return undefined;
  const z = carte.zones.find((x) => x.id === zoneId);
  return z ? `${z.nom} (${z.id})` : zoneId;
}

function phraseVue(p: PhraseCommune, carte: CarteZones): PhraseVue {
  const v: PhraseVue = { texte: p.texte, dureeSec: duree(p.texte) };
  if (p.temps) v.temps = TEMPS[p.temps];
  if (p.apport) v.apport = p.apport;
  const zone = nomZone(carte, p.zoneId);
  if (zone) v.zone = zone;
  if (p.aRevoir) v.aRevoir = true;
  return v;
}

function versionVue(v: PropositionScripts["versions"][number], e: EntreeDossierValidation): VersionVue {
  let verification: { bloquants: string[]; remarques: string[] } = { bloquants: [], remarques: [] };
  try {
    verification = verifierVersion(v, { cahier: e.cahier, carte: e.carte, fiche: e.fiche, dureeFinSec: e.dureeFinSec ?? 0 });
  } catch {
    verification = { bloquants: [PHRASE_VERSION_BLOQUEE], remarques: [] };
  }
  const phrases = v.phrases.map((p) => phraseVue(p, e.carte));
  return {
    id: v.id,
    origine: v.source === "fourni" ? "Votre texte, gardé tel quel" : "Écrite par le Studio",
    phrases,
    dureeSec: Math.round(phrases.reduce((s, p) => s + p.dureeSec, 0) * 10) / 10,
    remarques: verification.remarques,
    blocages: verification.bloquants,
  };
}

function lignesParcours(e: EntreeDossierValidation): LigneParcours[] {
  const phrases: PhraseCommune[] = e.scriptChoisi ? e.scriptChoisi.phrases.map((p: PhraseChoisie) => ({ ...p })) : (e.proposition.versions.find((v) => v.id === "A") ?? e.proposition.versions[0]).phrases;
  return phrases.map((p, i) => {
    const geste = e.parcours?.gestes.find((g) => g.phraseIndex === i);
    const zone = nomZone(e.carte, p.zoneId) ?? PHRASE_ZONE_ABSENTE;
    const url = geste ? e.miniatures?.[geste.etapeId] : undefined;
    return {
      numero: i + 1,
      phrase: p.texte,
      zone,
      geste: geste ? (GESTES[geste.geste as GesteZone] ?? String(geste.geste)) : PHRASE_GESTE_ABSENT,
      miniature: url || PHRASE_MINIATURE_ABSENTE,
      miniatureDisponible: !!url,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Le dossier                                                          */
/* ------------------------------------------------------------------ */

export function construireDossierValidation(e: EntreeDossierValidation): DossierValidation {
  const { cahier, fiche, verdict } = e;
  const peutValider = verdict.verdict === "ok";
  const raisons = peutValider ? [] : resumePourWilliams(verdict).split("\n").filter((l) => l.trim() !== "");
  const lignes = e.registre ? lignesPourValidation(e.registre) : [];

  const dossier: DossierValidation = {
    entete: {
      cas: CAS[cahier.cas] ?? "Mélange",
      gabarits: cahier.gabarits.map((g) => GABARITS[g] ?? g),
      fin: nomFin(cahier.fin),
      formats: [...cahier.ratios],
      dureeVisee: `${cahier.dureeCibleSec[0]} à ${cahier.dureeCibleSec[1]} s`,
    },
    valeur: {
      persona: { metier: fiche.persona.metier, journee: fiche.persona.journee, perte: fiche.persona.perte },
      avant: [...fiche.avant],
      moments: fiche.moments.map((m) => ({
        id: m.id,
        zone: nomZone(e.carte, m.zoneId) ?? m.zoneId,
        geste: GESTES[m.geste] ?? m.geste,
        ...(m.evite ? { evite: m.evite } : {}),
        ...(m.permet ? { permet: m.permet } : {}),
      })),
      gain: { devient: DEVIENT[fiche.gainEntreprise.devient] ?? fiche.gainEntreprise.devient, pourquoi: fiche.gainEntreprise.pourquoi },
      emotion: EMOTION[fiche.emotion] ?? fiche.emotion,
    },
    versions: e.proposition.versions.map((v) => versionVue(v, e)),
    choix: e.scriptChoisi ? { source: e.scriptChoisi.source, texte: e.scriptChoisi.texte } : null,
    parcours: lignesParcours(e),
    controle: { resume: resumePourWilliams(verdict), peutValider, raisons },
    textes: {
      lignes: lignes.map((l) => ({ texte: l.texte, ou: OU[l.ou] ?? l.ou, origine: ORIGINE[l.origine] ?? l.origine, choisi: l.choisi })),
      propositions: (e.registre?.entrees ?? []).filter((x) => x.origine === "proposition-studio").map((x) => ({ id: x.id, texte: x.texte, ou: OU[x.ou] ?? x.ou, choisi: x.choisi === true })),
      finSansTexte: e.registre?.finSansTexte === true,
    },
  };
  if (e.devis && e.devis.phrases.length) {
    dossier.devis = { phrases: [...e.devis.phrases] };
    if (e.devis.empreinte) dossier.empreinteDevis = e.devis.empreinte;
  }
  return dossier;
}
