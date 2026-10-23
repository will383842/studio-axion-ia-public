/**
 * TRAÇABILITÉ DU TABLEAU ANIMÉ : l'historique complet d'une vidéo, en ÉVÉNEMENTS DATÉS, en AJOUT SEUL.
 *
 * Un événement n'est jamais modifié ni retiré : le service refuse d'écrire sur un identifiant déjà pris. L'identifiant
 * vient d'une CLÉ NATURELLE (`cle`) : rejouer la reconstruction depuis le journal de fabrication redonne les mêmes
 * identifiants, donc aucun doublon. PUR : aucune lecture de base, aucun import de service ; le service passe les
 * documents lus (`SourceTrace`).
 *
 * Le journal de fabrication (`versions.projetMontage.tableau.journal`, sinon `travaux.parametres.tableau.journal`) est lu
 * tel quel, sans rien supposer : une donnée absente donne un événement plus pauvre, jamais une erreur.
 */
import type { DateIso, EntiteBase, Id, Publication, Retouche, Script, Sortie, Travail, Video, VersionVideo } from "./types";
import { formaterMontant } from "@/lib/montants";

export const TYPES_TRACE = ["script", "fiche", "voix", "etape", "fichier", "code", "retouche", "controle", "publication"] as const;
export type TypeTrace = (typeof TYPES_TRACE)[number];

/** D'où vient l'événement : reconstruit du journal, écrit par la fabrication (plus tard), saisi à la main. */
export type OrigineTrace = "reconstruit" | "fabrication" | "saisie";

export interface EvenementTrace extends EntiteBase {
  videoId: Id;
  type: TypeTrace;
  /** Clé naturelle : même fait = même clé = même identifiant (rejouable sans doublon). */
  cle: string;
  date: DateIso;
  /** Rang dans la reconstruction : départage deux événements de la même date. */
  ordre: number;
  origine: OrigineTrace;
  versionId?: Id;
  /** Ce qui est compté dans le coût total (centimes d'euro, entier). Absent : rien à compter. */
  centimes?: number;
  donnees: Record<string, unknown>;
}

/** Événement avant son écriture (sans identifiant ni horodatage de base). */
export type NouvelEvenementTrace = Omit<EvenementTrace, "id" | "creeLe" | "modifieLe">;

/** Identifiant stable d'un événement. */
export function idEvenementTrace(videoId: Id, cle: string): Id {
  return `tr:${videoId}:${cle}`;
}

/* ------------------------------------------------------------------ */
/* Libellés pour une personne                                           */
/* ------------------------------------------------------------------ */

const NOMS_ETAPES: Readonly<Record<string, string>> = {
  fiche: "Fiche de scènes relue",
  script: "Contrôles avant la voix",
  voix: "Voix",
  calage: "Calage sur la voix",
  "mise-en-page": "Mise en page",
  fin: "Fin de la vidéo",
  scenes: "Dessin des scènes",
  composition: "Montage",
  controles: "Contrôles finaux",
};

const nombre = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const texte = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

const secondes = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;
const euros = (centimes: number) => formaterMontant({ centimes, devise: "EUR" });

/** Une phrase lisible par un non-technicien (« Voix enregistrée · 41 s · 0,10 € »). */
export function libelleEvenement(e: Pick<EvenementTrace, "type" | "donnees" | "centimes">): string {
  const d = e.donnees;
  const parts: string[] = [];
  switch (e.type) {
    case "script": {
      parts.push("Script d'origine");
      const n = nombre(d.caracteres);
      if (n !== undefined) parts.push(`${n} caractères`);
      if (texte(d.serie)) parts.push(`série ${texte(d.serie)}`);
      break;
    }
    case "fiche": {
      parts.push("Fiche de scènes");
      parts.push(d.origine === "decoupage" ? "découpage automatique" : d.origine === "correction" ? "corrigée à la main" : "fournie");
      break;
    }
    case "voix": {
      parts.push(d.reutilisee === true ? "Voix reprise" : "Voix enregistrée");
      const s = nombre(d.dureeSec);
      if (s !== undefined) parts.push(`${Math.round(s)} s`);
      if (e.centimes !== undefined) parts.push(euros(e.centimes));
      break;
    }
    case "etape": {
      if (d.resultat === "echec") {
        parts.push(`${texte(d.nom) ?? "Une étape"} : n'a pas abouti`);
        break;
      }
      parts.push(texte(d.nom) ?? "Étape");
      const ms = nombre(d.dureeMs);
      if (ms !== undefined && ms > 0) parts.push(secondes(ms));
      break;
    }
    case "fichier": {
      const role = d.role;
      if (role === "video") parts.push(`Vidéo ${d.format === "9:16" ? "verticale " : ""}produite`);
      else if (role === "master") parts.push("Version sans sous-titres conservée");
      else if (role === "vignette") parts.push("Image d'aperçu produite");
      else if (role === "voix") parts.push("Fichier de la voix conservé");
      else parts.push(`Scène ${texte(d.scene) ?? ""} dessinée`.replace("  ", " "));
      break;
    }
    case "code": {
      // Code de version par réseau (« 0042-TB-IG »), posé à la fabrication.
      const codes = obj(d.codesVersion);
      if (codes) {
        const liste = Object.values(codes).filter((c): c is string => typeof c === "string");
        parts.push(`Code de version : ${liste.join(", ") || "aucun"}`);
        break;
      }
      parts.push("Fabriquée par");
      parts.push(texte(d.chaine) ?? "la chaîne du studio");
      if (texte(d.style)) parts.push(`style ${texte(d.style)}`);
      break;
    }
    case "retouche": {
      parts.push(`Retouche : ${texte(d.consigne) ?? "sans précision"}`);
      const c = nombre(d.coutCentimes);
      if (c) parts.push(euros(c));
      break;
    }
    case "controle": {
      const n = nombre(d.alertes) ?? 0;
      parts.push(d.moment === "avant-voix" ? "Contrôles avant la voix" : d.moment === "avant-montage" ? "Bruitages vérifiés avant le montage" : "Contrôles de la vidéo");
      parts.push(n ? `${n} alerte${n > 1 ? "s" : ""}` : "aucune alerte");
      break;
    }
    case "publication": {
      parts.push(`Publiée sur ${texte(d.reseauNom) ?? texte(d.reseau) ?? "un réseau"}`);
      break;
    }
  }
  return parts.join(" · ");
}

/* ------------------------------------------------------------------ */
/* Lecture : ordre, coût, exports                                       */
/* ------------------------------------------------------------------ */

/** Chronologique : la date, puis le rang, puis l'identifiant (ordre total, donc stable). */
export function trierChronologie<T extends Pick<EvenementTrace, "date" | "ordre" | "id">>(evenements: readonly T[]): T[] {
  return [...evenements].sort((a, b) => a.date.localeCompare(b.date) || a.ordre - b.ordre || a.id.localeCompare(b.id));
}

/** Coût total cumulé, en centimes : la somme des seuls `centimes` (entiers, jamais comptés deux fois). */
export function coutTotalCentimes(evenements: readonly Pick<EvenementTrace, "centimes">[]): number {
  return evenements.reduce((s, e) => s + (Number.isFinite(e.centimes) ? Math.round(e.centimes as number) : 0), 0);
}

const cellule = (v: string) => `"${v.replace(/\r?\n/g, " ").replace(/"/g, '""')}"`;

/**
 * Tableur : une ligne par événement, séparateur « ; » (Excel en français), UTF-8 avec marque d'ordre des octets.
 * Colonnes : Date · Type · Description · Coût (€) · Origine · Détail (JSON).
 */
export function enCsv(evenements: readonly EvenementTrace[]): string {
  const lignes = [["Date", "Type", "Description", "Coût (€)", "Origine", "Détail"].map(cellule).join(";")];
  for (const e of trierChronologie(evenements)) {
    lignes.push(
      [e.date, e.type, libelleEvenement(e), e.centimes === undefined ? "" : (e.centimes / 100).toFixed(2).replace(".", ","), e.origine, JSON.stringify(e.donnees)].map(cellule).join(";"),
    );
  }
  return `﻿${lignes.join("\r\n")}\r\n`;
}

/** JSON complet : tous les événements, dans l'ordre, et le coût total. */
export function enJson(videoId: Id, evenements: readonly EvenementTrace[]): string {
  const tries = trierChronologie(evenements);
  return JSON.stringify({ videoId, coutTotalCentimes: coutTotalCentimes(tries), evenements: tries }, null, 2);
}

/* ------------------------------------------------------------------ */
/* Reconstruction depuis le journal de fabrication                      */
/* ------------------------------------------------------------------ */

/** Ce que la reconstruction lit (documents déjà en base). */
export interface SourceTrace {
  video: Pick<Video, "id" | "formatId" | "creeLe" | "serieId" | "reseau">;
  script?: Pick<Script, "id" | "sujet"> | null;
  /** Versions de la vidéo, quel que soit leur ordre. */
  versions: readonly VersionVideo[];
  travaux: readonly Travail[];
  retouches: readonly Retouche[];
  sorties: readonly Sortie[];
  publications: readonly Publication[];
  /** Nom d'un réseau à partir de son identifiant. */
  nomReseau?: (id: string) => string;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);

/** Journal de la version : celui de son projet de montage, sinon celui de son travail. */
function journalDe(v: VersionVideo, travaux: readonly Travail[]): Obj | undefined {
  const projet = obj(obj(v.projetMontage)?.tableau);
  const dansProjet = obj(projet?.journal);
  if (dansProjet) return dansProjet;
  const t = travaux.find((x) => x.id === v.travailId) ?? travaux.find((x) => x.versionId === v.id);
  return obj(obj(obj(t?.parametres)?.tableau)?.journal);
}

const empreinteDuChemin = (chemin: string) => /([0-9a-f]{32})\.[a-z0-9]+$/.exec(chemin)?.[1];

/**
 * Tous les événements que le journal permet de restituer. Chaque événement a une clé naturelle : la fonction est PURE et
 * donne le même résultat à chaque appel ; le service n'écrit que ceux dont l'identifiant manque encore.
 */
export function reconstruireTrace(source: SourceTrace): NouvelEvenementTrace[] {
  const { video } = source;
  const res: NouvelEvenementTrace[] = [];
  const vus = new Set<string>();
  let ordre = 0;
  const poser = (e: Omit<NouvelEvenementTrace, "videoId" | "origine" | "ordre">) => {
    if (vus.has(e.cle)) return;
    vus.add(e.cle);
    res.push({ videoId: video.id, origine: "reconstruit", ordre: ordre++, ...e });
  };

  const versions = [...source.versions].filter((v) => v.videoId === video.id).sort((a, b) => a.numero - b.numero);
  const premiere = versions.find((v) => !v.parentVersionId) ?? versions[0];

  // 1. Script d'origine.
  const texteScript = premiere?.commande.script.texteComplet ?? "";
  poser({
    type: "script",
    cle: "script",
    date: video.creeLe,
    versionId: premiere?.id,
    donnees: {
      texte: texteScript,
      caracteres: texteScript.length,
      sujet: source.script?.sujet,
      serie: video.serieId,
      reseaux: video.reseau ? [video.reseau] : [],
      formatId: video.formatId,
    },
  });

  const retouchesDe = (versionId: Id) => source.retouches.find((r) => r.versionProduiteId === versionId);

  for (const v of versions) {
    const travail = source.travaux.find((t) => t.id === v.travailId) ?? source.travaux.find((t) => t.versionId === v.id);
    const debut = travail?.debuteLe ?? v.creeLe;
    const fin = travail?.termineLe ?? debut;
    const journal = journalDe(v, source.travaux);
    const etapes = obj(journal?.etapes) ?? {};
    const projet = obj(obj(v.projetMontage)?.tableau);
    const retouche = retouchesDe(v.id);

    // 2. Retouche qui a produit cette version.
    if (retouche) {
      poser({
        type: "retouche",
        cle: `retouche:${retouche.id}`,
        date: retouche.creeLe,
        versionId: v.id,
        donnees: { consigne: retouche.consigne, versionSourceId: retouche.versionId, versionProduiteId: v.id, coutCentimes: v.coutReel?.centimes ?? 0 },
      });
    }

    // 3. Fiche de scènes (une version de la fiche = une empreinte).
    const fiche = obj(etapes.fiche);
    const empreinteFiche = texte(fiche?.empreinte);
    if (empreinteFiche) {
      const sansFicheFournie = !texte(obj(obj(v.commande.entrees)?.tableau)?.ficheScenesCle);
      const corrigee = !!(retouche || v.parentVersionId || projet?.retouchee);
      poser({
        type: "fiche",
        cle: `fiche:${empreinteFiche}`,
        date: debut,
        versionId: v.id,
        donnees: { empreinte: empreinteFiche, origine: corrigee ? "correction" : sansFicheFournie ? "decoupage" : "fournie", scenes: Array.isArray(obj(fiche?.sortie)?.scenes) ? (obj(fiche?.sortie)?.scenes as unknown[]).length : undefined },
      });
    }

    // 4. Voix.
    const voix = obj(etapes.voix);
    const sortieVoix = obj(voix?.sortie);
    if (voix && sortieVoix) {
      const reutilisee = sortieVoix.reutilise === true;
      poser({
        type: "voix",
        cle: `voix:${texte(voix.empreinte) ?? texte(sortieVoix.empreinte) ?? v.id}`,
        date: debut,
        versionId: v.id,
        centimes: reutilisee ? 0 : Math.round(nombre(sortieVoix.coutCentimes) ?? 0),
        donnees: {
          personnageId: v.commande.distribution.find((d) => d.role === "voix")?.personnageId,
          fournisseur: texte(sortieVoix.fournisseur),
          caracteres: nombre(sortieVoix.caracteres),
          dureeSec: nombre(sortieVoix.dureeSec),
          fichier: texte(sortieVoix.fichierCle),
          reutilisee,
        },
      });
      if (texte(sortieVoix.fichierCle)) {
        poser({ type: "fichier", cle: `fichier:${sortieVoix.fichierCle as string}`, date: debut, versionId: v.id, donnees: { role: "voix", chemin: sortieVoix.fichierCle, format: "audio", empreinte: empreinteDuChemin(sortieVoix.fichierCle as string) } });
      }
    }

    // 5. Étapes de fabrication.
    for (const nom of Object.keys(NOMS_ETAPES)) {
      const e = obj(etapes[nom]);
      if (!e) continue;
      poser({
        type: "etape",
        cle: `etape:${nom}:${texte(e.empreinte) ?? v.id}`,
        date: debut,
        versionId: v.id,
        donnees: { etape: nom, nom: NOMS_ETAPES[nom], dureeMs: nombre(e.dureeMs), resultat: "faite" },
      });
    }
    for (const e of travail?.etapes ?? []) {
      if (e.statut !== "echec") continue;
      poser({
        type: "etape",
        cle: `echec:${travail!.id}:${e.cle}`,
        date: travail!.termineLe ?? fin,
        versionId: v.id,
        donnees: { etape: e.cle, nom: e.nom, resultat: "echec", raison: e.erreur?.messagePourWill },
      });
    }

    // 6. Version du code qui a fabriqué.
    if (texte(journal?.version)) {
      poser({
        type: "code",
        cle: `code:${journal!.version as string}`,
        date: debut,
        versionId: v.id,
        donnees: { chaine: journal!.version, stylo: texte(obj(obj(etapes.fiche)?.sortie)?.stylo), style: texte(obj(obj(etapes.fiche)?.sortie)?.habillage) },
      });
    }

    // 7. Contrôles d'avant la voix (le résultat gardé dans le journal).
    const avant = obj(obj(etapes.script)?.sortie);
    if (avant) {
      poser({ type: "controle", cle: `controle:avant-voix:${texte(obj(etapes.script)?.empreinte) ?? v.id}`, date: debut, versionId: v.id, donnees: { moment: "avant-voix", resume: avant.resume, alertes: 0 } });
    }

    // 8. Fichiers de la composition et mesures.
    const compo = obj(obj(etapes.composition)?.sortie);
    const sortie = source.sorties.find((s) => s.versionId === v.id && s.ratio === "9:16") ?? source.sorties.find((s) => s.versionId === v.id);
    if (compo) {
      const [largeur, hauteur] = (sortie?.resolution ?? "").split("x").map(Number);
      const dims = Number.isFinite(largeur) && Number.isFinite(hauteur) && largeur && hauteur ? { largeur, hauteur } : {};
      const video916 = texte(compo.sortieCle);
      if (video916) poser({ type: "fichier", cle: `fichier:${video916}`, date: fin, versionId: v.id, donnees: { role: "video", chemin: video916, format: sortie?.ratio ?? "9:16", ...dims, tailleOctets: sortie?.taille, empreinte: empreinteDuChemin(video916) } });
      const master = texte(compo.masterCle);
      if (master) poser({ type: "fichier", cle: `fichier:${master}`, date: fin, versionId: v.id, donnees: { role: "master", chemin: master, format: "9:16", empreinte: empreinteDuChemin(master) } });
      const vignette = texte(compo.vignetteCle);
      if (vignette) poser({ type: "fichier", cle: `fichier:${vignette}`, date: fin, versionId: v.id, donnees: { role: "vignette", chemin: vignette, empreinte: empreinteDuChemin(vignette) } });
      const alertes = Array.isArray(compo.alertes) ? compo.alertes.length : 0;
      poser({ type: "controle", cle: `controle:video:${video916 ?? v.id}`, date: fin, versionId: v.id, donnees: { moment: "apres-montage", alertes, mesures: obj(compo.mesures), rapport: sortie?.rapportQualite?.verifie } });
    }
    const cles = obj(obj(obj(etapes.scenes)?.sortie)?.cles);
    if (cles) {
      Object.keys(cles).forEach((id, i) => {
        const chemin = texte(cles[id]);
        if (chemin) poser({ type: "fichier", cle: `fichier:${chemin}`, date: fin, versionId: v.id, donnees: { role: "scene", scene: id === "fin" ? "de fin" : String(i + 1), chemin, format: "9:16", empreinte: empreinteDuChemin(chemin) } });
      });
    }
  }

  // 9. Publications déjà faites.
  for (const p of source.publications) {
    if (p.videoId !== video.id || p.statut !== "publiee" || p.via === "simulation") continue;
    poser({
      type: "publication",
      cle: `publication:${p.id}`,
      date: p.date,
      donnees: { reseau: p.reseau, reseauNom: source.nomReseau?.(p.reseau), lien: p.urlPubliee, via: p.via },
    });
  }

  return res;
}
