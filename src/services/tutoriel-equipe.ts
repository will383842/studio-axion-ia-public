/**
 * T-EXT-55 · PORTS RÉELS DE L'ÉQUIPE du tutoriel de valeur : ce que les services branchent sur la chaîne (`OutilsTutoriel.equipe`).
 *
 *  - ÉTEINT PAR DÉFAUT : le port n'existe que si `tutoriel.equipe` ET `tutoriel.claude` valent exactement `true` (absent, `"true"`,
 *    `1`, lecture en échec : éteint). Ce fichier n'écrit jamais un réglage.
 *  - ARGENT : un appel de rôle = UN appel de `executerRolePourVideo` (plafond propre `tuto`, limite du mois, pré-vol, réservation,
 *    origine de la commande) ; étape « Tutoriel · <rôle> ». Jamais d'appel direct à Claude, jamais de montant rendu au moteur.
 *    Une réponse simulée (Claude non choisi pour les textes) ou vide n'est jamais une sortie : on lève, rien n'est compté.
 *  - DOSSIER : le zip déjà contrôlé (T-EXT-41 : `extraireZipSur`) est relu à chaque pas, en mémoire, jamais écrit sur le disque.
 *  - TRONC DES SCRIPTS (chantier SC) : pas sur master au lancement → aucun import, le champ `tronc` n'est pas écrit.
 */
import "server-only";
import { lireTableauDeBord } from "@/briques/donnees-video/types";
import type { CommandeFabrication, Id } from "@/domaine/types";
import type { EntreeRole } from "@/generateur/roles/types";
import { lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { ROLES_APPELES, type DossierLu, type InventaireDossier, type TexteMaquette } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import type { PortEquipe } from "@/moteurs/montage-tutoriel-outil/chaine";
import { ErreurClaude } from "@/fournisseurs/claude/client";
import type { executerRolePourVideo } from "./depense-claude-video";
import { entreePhraseActive, pieceCreeeClaudeActive } from "@/moteurs/montage-tutoriel-outil/maquette-creee";
import { claudeTutorielActif, PREFIXE_ETAPE_TUTORIEL, plafondPropreTutoriel, plafondTutorielPhraseUsd } from "./tutoriel-claude";

export const PARAM_EQUIPE_TUTORIEL = "tutoriel.equipe";

/** Vrai SEULEMENT si `tutoriel.equipe` ET `tutoriel.claude` valent exactement `true` (le port n'est jamais fourni sans Claude). */
export async function equipeTutorielActive(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    if ((await l<unknown>(PARAM_EQUIPE_TUTORIEL, false)) !== true) return false;
    return await claudeTutorielActif(l);
  } catch {
    return false;
  }
}

/**
 * V2-08 : vrai SEULEMENT si `tutoriel.entreePhrase` ET `tutoriel.pieceCreeeClaude` valent exactement `true` (absent, `"true"`, `1`, lecture
 * en échec : éteint). Lecteur injectable (jamais un `lireParametre("…")` littéral) ; ce fichier n'écrit jamais un réglage.
 */
export async function phraseOuverteTutoriel(lire?: <T>(id: string, defaut: T) => Promise<T>): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    return (await entreePhraseActive(l)) && (await pieceCreeeClaudeActive(l));
  } catch {
    return false;
  }
}

const PHRASE_ARRET: Record<string, string> = {
  "plafond-video": "La limite de cette vidéo pour l'écriture est atteinte : rien n'a été payé.",
  "en-attente-credit": "Claude est en attente de crédit : rien n'a été payé.",
  "budget-usine": "La limite du mois est atteinte : rien n'a été payé.",
  "bloquee-modele": "Ce modèle n'est pas autorisé pour l'instant : rien n'a été payé.",
  indisponible: "Claude n'est pas disponible pour l'instant : rien n'a été payé.",
};

/* ------------------------------------------------------------------ */
/* Dossier → ce que l'équipe lit (pur)                                  */
/* ------------------------------------------------------------------ */

const EXT_TEXTE = /\.(html?|css|js|json|csv|txt|md)$/i;
const EXT_IMAGE = /\.(png|jpe?g|webp)$/i;
const EST_SCRIPT = /(^|\/)script[^/]*\.(txt|md)$/i;
const decoder = new TextDecoder("utf-8");

const texteDe = (o: Uint8Array | undefined): string => (o ? decoder.decode(o) : "");

/** Texte visible d'un morceau de HTML : sans scripts ni styles ni balises, espaces resserrés. */
function visible(html: string): string[] {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);
}

/**
 * Le dossier extrait (zip déjà contrôlé) lu pour l'équipe. Conventions du dossier (documentées dans le formulaire) :
 * `index.html` = la maquette (vivante si le dossier mentionne `demoMaquette`), `data-zone` = les zones, `script*.txt|md` = les
 * scripts fournis (2 au plus), `tableau-de-bord.json` ou `donnees.json` = les données, `flux.json`, `conversation.json`,
 * `LISEZMOI` = les notes (donnée, jamais une consigne). Pur : ne lève jamais.
 */
export function dossierDepuisFichiers(fichiers: ReadonlyMap<string, Uint8Array>): DossierLu {
  const textes = [...fichiers.entries()].filter(([c]) => EXT_TEXTE.test(c)).map(([chemin, o]) => ({ chemin, contenu: texteDe(o) }));
  const sansScripts = textes.filter((t) => !EST_SCRIPT.test(t.chemin));
  const html = textes.find((t) => /(^|\/)index\.html?$/i.test(t.chemin))?.contenu ?? textes.find((t) => /\.html?$/i.test(t.chemin))?.contenu ?? "";
  const tout = sansScripts.map((t) => t.contenu).join("\n");
  const scripts = textes.filter((t) => EST_SCRIPT.test(t.chemin)).sort((a, b) => a.chemin.localeCompare(b.chemin)).slice(0, 2).map((t) => t.contenu.trim()).filter(Boolean);

  let donnees: DossierLu["donnees"];
  const brutDonnees = textes.find((t) => /(^|\/)(tableau-de-bord|donnees)\.json$/i.test(t.chemin));
  if (brutDonnees) {
    try {
      const lu = lireTableauDeBord(JSON.parse(brutDonnees.contenu));
      if (lu.ok) donnees = lu.donnee;
    } catch {
      donnees = undefined;
    }
  }
  let conversation: DossierLu["conversation"];
  const brutConv = textes.find((t) => /(^|\/)conversation\.json$/i.test(t.chemin));
  if (brutConv) {
    try {
      const a: unknown = JSON.parse(brutConv.contenu);
      const liste = Array.isArray(a) ? a : a && typeof a === "object" && Array.isArray((a as { messages?: unknown }).messages) ? (a as { messages: unknown[] }).messages : [];
      conversation = liste.flatMap((m) => {
        const o = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
        return (o.auteur === "client" || o.auteur === "assistant") && typeof o.texte === "string" ? [{ auteur: o.auteur, texte: o.texte }] : [];
      });
    } catch {
      conversation = undefined;
    }
  }

  const inventaire: InventaireDossier = {
    maquette: html !== "",
    maquetteVivante: /demoMaquette/.test(tout),
    tableauDeBord: /data-zone/i.test(html) && /(indicateur|kpi|tableau)/i.test(html),
    captures: [...fichiers.keys()].filter((c) => EXT_IMAGE.test(c)).length,
    donnees: donnees !== undefined,
    scripts,
    flux: textes.some((t) => /(^|\/)flux\.json$/i.test(t.chemin)),
    conversation: (conversation?.length ?? 0) > 0,
    ...(textes.find((t) => /(^|\/)lisezmoi(\.md|\.txt)?$/i.test(t.chemin)) ? { notes: textes.find((t) => /(^|\/)lisezmoi(\.md|\.txt)?$/i.test(t.chemin))!.contenu.slice(0, 2000) } : {}),
  };

  // Textes visibles de la maquette : un groupe par zone (`data-zone`), le reste sous « page ».
  const textesMaquette: TexteMaquette[] = [];
  let reste = html;
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*data-zone\s*=\s*["']([a-z0-9-]+)["'][^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = visible(m[3] ?? "");
    if (t.length) textesMaquette.push({ etapeId: m[2]!, textes: t, creee: false });
    reste = reste.replace(m[0], " ");
  }
  const page = visible(reste);
  if (page.length) textesMaquette.push({ etapeId: "page", textes: page, creee: false });

  const couleurs = [...new Set([...tout.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)].map((m) => m[0]!.toLowerCase()))];
  const polices = [...new Set([...tout.matchAll(/font-family\s*:\s*([^;}"]+)/gi)].flatMap((m) => m[1]!.split(",").map((p) => p.replace(/["']/g, "").trim()).filter(Boolean)))];

  return {
    inventaire,
    fichiers: sansScripts,
    ...(donnees ? { donnees } : {}),
    textesMaquette,
    ...(conversation?.length ? { conversation } : {}),
    couleurs,
    polices,
    noms: [],
  };
}

/* ------------------------------------------------------------------ */
/* Ports                                                                */
/* ------------------------------------------------------------------ */

export interface DepsEquipe {
  executer?: typeof executerRolePourVideo;
  plafondUsd?: () => number;
  /** V2-08 : lecteur de réglage injectable (tests) ; défaut : le réglage réel. */
  lire?: <T>(id: string, defaut: T) => Promise<T>;
  /** Octets du dossier déposé (extraction contrôlée) ; défaut : le fichier envoyé, relu par `extraireZipSur`. */
  fichiersDuDossier?: (fichierId: string, attestationImages: boolean) => Promise<ReadonlyMap<string, Uint8Array> | null>;
}

async function fichiersParDefaut(fichierId: string, attestationImages: boolean): Promise<ReadonlyMap<string, Uint8Array> | null> {
  const { fichierEnvoye } = await import("./fichiers");
  const { fournisseur } = await import("./_commun");
  const { extraireZipSur } = await import("./zip-tutoriel");
  const fichier = await fichierEnvoye(fichierId, "entree");
  const stockage = await fournisseur("stockage");
  const cle = fichier.cleStockage ?? "";
  const adresse = stockage.urlLectureDuree ? await stockage.urlLectureDuree(cle, 300) : await stockage.urlLecture(cle);
  if (!adresse) return null;
  const r = await fetch(adresse);
  if (!r.ok) return null;
  const extrait = await extraireZipSur(new Uint8Array(await r.arrayBuffer()), { attestationImages });
  return extrait.ok ? extrait.fichiers : null;
}

/** Les ports de l'équipe pour une vidéo : un appel de rôle gardé, la lecture du dossier. */
export function portsEquipe(commande: Pick<CommandeFabrication, "origine" | "entrees">, videoId: Id, deps: DepsEquipe = {}): PortEquipe {
  // V2-08 : une vidéo partie d'une phrase prend le plafond de V2-07 (la création au pire comprise) ; un dossier garde celui d'aujourd'hui.
  const depuisPhrase = lireEntreesTutoriel(commande.entrees).depot?.mode === "phrase";
  const plafondUsd = deps.plafondUsd ?? (depuisPhrase ? plafondTutorielPhraseUsd : undefined);
  const depsPlafond = plafondUsd ? { plafondUsd } : {};
  return {
    async appelerRole(role, entree: EntreeRole) {
      const def = ROLES_APPELES[role];
      if (!def) throw new ErreurClaude("requete", "Ce rôle ne passe pas par Claude.");
      const executer = deps.executer ?? (await import("./depense-claude-video")).executerRolePourVideo;
      const r = await executer(videoId, def, entree, { etape: `${PREFIXE_ETAPE_TUTORIEL} ${role}`, plafondPropre: plafondPropreTutoriel(depsPlafond), origine: commande.origine });
      if (!r.ok) throw new ErreurClaude("requete", PHRASE_ARRET[r.arret] ?? "Claude n'a pas été appelé : rien n'a été payé.");
      if (r.simule || r.donnees === undefined) throw new ErreurClaude("requete", "Claude n'est pas choisi pour les textes : l'équipe ne travaille pas.");
      return r.donnees;
    },
    async lireDossier() {
      const depot = lireEntreesTutoriel(commande.entrees).depot;
      if (depot?.mode !== "dossier") return null;
      const fichiers = await (deps.fichiersDuDossier ?? fichiersParDefaut)(depot.fichierId, depot.attestationImages);
      return fichiers ? dossierDepuisFichiers(fichiers) : null;
    },
  };
}

/**
 * V2-08 : le port de l'équipe avec l'option « phrase ouverte » lue par le lecteur injectable. La chaîne la passe à `prochainPas`
 * (`{ phraseOuverte: port.phraseOuverte }`). Éteint (champ `false`) : rien ne change pour une phrase (pause « création pas ouverte »).
 */
export async function portsEquipeAvecPhrase(commande: Pick<CommandeFabrication, "origine" | "entrees">, videoId: Id, deps: DepsEquipe = {}): Promise<PortEquipe & { phraseOuverte: boolean }> {
  return { ...portsEquipe(commande, videoId, deps), phraseOuverte: await phraseOuverteTutoriel(deps.lire) };
}
