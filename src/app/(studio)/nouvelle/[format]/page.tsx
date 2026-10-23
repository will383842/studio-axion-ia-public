import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Assistant } from "@/assistant/Assistant";
import { estCleEtape, type CleEtape } from "@/assistant/etapes/meta";
import type { BrouillonAssistant } from "@/assistant/etapes/types";
import { visagePourFormat } from "@/domaine/distribution";
import { voixPourFormat } from "@/domaine/voix-format";
import { entreesAvecOrigine } from "@/domaine/voyant-rouge";
import type { Distribution } from "@/domaine/types";
import { dureeParDefaut, obtenirFormat, reglagesParDefaut, trouverFormat } from "@/formats";
import { lireReglages } from "@/services/reglages";
import { listerElements } from "@/services/bibliotheque";
import { listerIdees } from "@/services/idees";
import { obtenirModele } from "@/services/modeles";
import { listerPersonnages } from "@/services/personnages";
import { obtenirScript, texteDeVersionPourVideo } from "@/services/scripts";
import { claudeBranche } from "@/services/generation-claude";
import { adresseParDefaut, listerVideos, obtenirVideo } from "@/services/videos";
import { decorHabituel, donneesExpress } from "@/services/express";
import { decorInitial } from "@/assistant/express/logique";
import type { VueVideoCarte, VuePersonnage } from "@/services/vues";
import type { OrigineBrouillon } from "./actions";
import { exigerSession } from "@/services/auth";
import { choisirMoi } from "@/domaine/moi";
import { DejaFilme } from "@/components/facecam/DejaFilme";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { RecentsGenerateur } from "@/components/creation/RecentsGenerateur";
import { versRecentsVideos } from "@/components/creation/vues-recents";
import { FORMAT_TABLEAU_ANIME } from "@/components/formats/tableau-anime/aiguillage";
import { adresseNouvelleVideoCasConcret } from "@/components/formats/cas-concret/aiguillage";
import { ID_FORMAT_FACECAM } from "@/services/monteur-facecam";

/** Même valeur que `ID_FORMAT_FACECAM_ANIMEE` du service (non importé ici : il branche le moteur de la boucle). */
const ID_FORMAT_FACECAM_ANIMEE = "facecam-animee";

export const metadata: Metadata = { title: "Nouvelle vidéo" };
export const dynamic = "force-dynamic";

/**
 * Distribution par défaut : moi, mon avatar et la voix de ce format (sinon ma voix par défaut, sinon les premiers prêts). Les rôles suivants
 * (l'invité d'un podcast) reçoivent les autres personnages UTILISABLES (accord, double et voix prêts), dans l'ordre :
 * rien à choisir quand tout est déjà là (lot M3, parcours le plus court).
 */
function distributionParDefaut(formatId: string, personnages: VuePersonnage[]): Distribution[] {
  const format = obtenirFormat(formatId);
  if (format.personnages.max === 0) return [];
  // TEST-UI-REEL U1 : le vrai « Moi » d'abord (la liste ne contient celui d'exemple que si les exemples sont affichés).
  const moi = choisirMoi(personnages, (p) => p.personnage, true);
  const autres = personnages.filter((p) => p !== moi && p.utilisable);
  const roles = format.personnages.roles?.length ? format.personnages.roles : ["Face caméra"];
  return roles.slice(0, Math.max(1, format.personnages.min)).map((role, i) => {
    const p = i === 0 ? moi : autres[i - 1];
    return {
      role,
      source: "double" as const,
      personnageId: p?.personnage.id,
      // Avatar du FORMAT d'abord, sinon le visage par défaut (correcteur 4, sur le modèle de la voix).
      visageId: p ? visagePourFormat(p.visages, p.personnage, formatId)?.id : undefined,
      // Voix du FORMAT d'abord (« Vidéo type avocat → Voix avocat rapide »), sinon la voix habituelle (02/10).
      voixId: p ? voixPourFormat(p.voix, p.personnage, formatId)?.id : undefined,
    };
  });
}

/**
 * ASSISTANT (B.8 #4) — étapes générées depuis le format.
 * Paramètres : ?brouillon=<videoId> (reprendre), ?modele=<id>, ?script=<id>, ?idee=<id> (préremplir) ;
 * &variante=<id> : le texte d'une version du générateur (« Utiliser dans ma vidéo », correcteur 3, B1), mot pour mot.
 * Rien n'est créé à l'affichage : le brouillon naît au premier « Continuer » (avec son origine).
 */
export default async function PageAssistant({ params, searchParams }: { params: Promise<{ format: string }>; searchParams: Promise<{ brouillon?: string; modele?: string; script?: string; idee?: string; variante?: string }> }) {
  await exigerSession();
  const { format: formatId } = await params;
  const sp = await searchParams;
  const format = trouverFormat(formatId);
  if (!format) notFound();
  // Image → vidéo (masqué pour le reste) a son propre écran de dépôt : un seul chemin « Nouvelle vidéo » y mène.
  if (format.id === ID_FORMAT_IMAGE_VIDEO) redirect(sp.brouillon ? `/image-video/${encodeURIComponent(sp.brouillon)}` : "/image-video");
  if (format.statut !== "actif") redirect(`/formats/${format.id}`);
  // Le tableau animé a son propre parcours : jamais l'assistant de face caméra.
  if (format.id === FORMAT_TABLEAU_ANIME) redirect(sp.brouillon ? `/tableau/nouvelle?brouillon=${encodeURIComponent(sp.brouillon)}` : "/tableau/nouvelle");
  // La face caméra animée aussi : son écran de dépôt (`/face-camera-animee`).
  // Paramètre transmis, pas encore lu par l'écran.
  if (format.id === ID_FORMAT_FACECAM_ANIMEE) redirect(sp.brouillon ? `/face-camera-animee?brouillon=${encodeURIComponent(sp.brouillon)}` : "/face-camera-animee");
  // Le cas concret aussi : son écran à lui (`/cas-concret`).
  const ecranCasConcret = adresseNouvelleVideoCasConcret(format);
  // Paramètre transmis, pas encore lu par l'écran.
  if (ecranCasConcret) redirect(sp.brouillon ? `${ecranCasConcret}?brouillon=${encodeURIComponent(sp.brouillon)}` : ecranCasConcret);

  const [personnages, elements, idees, reglages, adresse, express, habituel, ecritureReelle, recentsVideos] = await Promise.all([
    listerPersonnages(),
    listerElements({ type: ["lut", "style-sous-titres", "musique", "habillage", "style-montage", "profil-son", "illustration-image", "illustration-video", "decor", "accessoire"] }),
    listerIdees(),
    lireReglages(),
    adresseParDefaut(),
    // Écran « Votre vidéo » et onglet « Mes scripts » (lot M3) : scripts du format, images du plateau.
    donneesExpress(formatId),
    decorHabituel(formatId),
    claudeBranche(),
    // Récents du format sous l'express (H8c) : requête existante des vidéos, masqués (et non lancée) quand on reprend un brouillon.
    sp.brouillon ? Promise.resolve([] as VueVideoCarte[]) : listerVideos({ formatId, limite: 5 }),
  ]);

  let initial: BrouillonAssistant = {
    formatId,
    titre: "",
    sujet: "",
    dureeCibleSec: dureeParDefaut(format),
    ratios: [format.ratios[0]],
    blocs: [],
    distribution: distributionParDefaut(formatId, personnages),
    entrees: {},
    reglages: reglagesParDefaut(format),
    styles: {},
    briquesCoupees: [],
    // Bug corrigé (B.0 §1) : le brouillon part du RÉGLAGE de Will, jamais de la constante, qui l'écrasait.
    briquesAllumees: reglages.mentionIA.incrustee ? ["mention-ia"] : [],
    mentionIA: reglages.mentionIA,
    adresse,
  };
  const origine: OrigineBrouillon = {};
  let etape: CleEtape | undefined;

  if (sp.brouillon) {
    const d = await obtenirVideo(sp.brouillon);
    if (!d) notFound();
    const v = d.video;
    if (v.formatId !== formatId) redirect(`/nouvelle/${v.formatId}?brouillon=${v.id}`);
    if (v.statut === "prete" || v.statut === "archivee") redirect(`/videos/${v.id}`);
    initial = {
      ...initial,
      videoId: v.id,
      titre: v.titre === "Nouvelle vidéo" ? "" : v.titre,
      sujet: v.sujet ?? "",
      dureeCibleSec: v.dureeCibleSec,
      ratios: v.ratios,
      scriptId: v.scriptId,
      blocs: d.script?.blocs ?? [],
      notes: d.script?.notes,
      distribution: v.distribution.length ? v.distribution : initial.distribution,
      entrees: v.entrees,
      reglages: v.reglages,
      styles: v.styles,
      briquesCoupees: v.briquesCoupees ?? [],
      briquesAllumees: v.briquesAllumees ?? [],
      mentionIA: v.mentionIA,
      adresse: v.adresse ?? adresse,
      posture: v.posture,
      travailId: d.travail?.id,
    };
    const enFabrication = v.statut === "en_file" || v.statut === "en_fabrication" || v.statut === "echec";
    etape = enFabrication ? "fabrication" : v.etapeAssistant && estCleEtape(v.etapeAssistant) ? v.etapeAssistant : undefined;
  } else if (sp.modele) {
    const m = await obtenirModele(sp.modele);
    if (m && m.formatId === formatId) {
      origine.modeleId = m.id;
      initial = {
        ...initial,
        dureeCibleSec: m.dureeSec,
        ratios: m.ratios.filter((r) => format.ratios.includes(r)).length ? m.ratios.filter((r) => format.ratios.includes(r)) : initial.ratios,
        distribution: m.distribution.length ? m.distribution : initial.distribution,
        reglages: { ...initial.reglages, ...m.reglages },
        styles: m.stylesChoisis,
        briquesCoupees: m.briquesCoupees ?? [],
        briquesAllumees: m.briquesAllumees ?? initial.briquesAllumees,
      };
    }
  } else if (sp.script) {
    const s = await obtenirScript(sp.script);
    if (s && s.formatId === formatId) {
      origine.scriptId = s.id;
      initial = { ...initial, sujet: s.sujet, scriptId: s.id, blocs: s.blocs, notes: s.notes, dureeCibleSec: s.dureeCibleSec ?? initial.dureeCibleSec, adresse: s.adresse ?? initial.adresse };
    }
  } else if (sp.idee) {
    const i = idees.find((x) => x.id === sp.idee);
    if (i) {
      origine.ideeId = i.id;
      initial = { ...initial, sujet: i.texte };
    }
  }

  // B1 : retour du générateur avec le texte d'une version. Il remplace le texte de la vidéo (nouveau script à
  // l'enregistrement) ; une vidéo déjà en fabrication n'est jamais modifiée.
  if (sp.variante && etape !== "fabrication") {
    const t = await texteDeVersionPourVideo(sp.variante).catch(() => null);
    if (t && t.formatId === formatId) {
      // La version d'origine est gardée dans les `entrees` de la vidéo : le brouillon la retrouve après rechargement.
      initial = { ...initial, entrees: entreesAvecOrigine(initial.entrees, sp.variante), blocs: t.blocs, scriptId: undefined, notes: undefined, versions: undefined, versionChoisie: undefined, sujet: initial.sujet || t.sujet, adresse: t.adresse ?? initial.adresse };
    }
  }

  // Une étape absente du format (ou « fabrication » sans travail) : on reprend au début.
  if (etape && !format.etapes.includes(etape)) etape = undefined;

  // Décor de départ (lot M3) : le choix déjà fait (vidéo, modèle), sinon l'habitude du format, sinon N1 Halo orange.
  if (format.etapes.includes("express")) {
    const decorId = decorInitial(formatId, initial.styles.decorId ?? habituel, elements, format.stylesParDefaut.decor);
    if (decorId) initial = { ...initial, styles: { ...initial.styles, decorId } };
  }

  // Face caméra : la vidéo est souvent déjà filmée ; ce chemin mène droit à l'envoi, sans écriture (retour prod du 09/10).
  const dejaFilme = formatId === ID_FORMAT_FACECAM && !sp.brouillon;

  return (
    <>
      {dejaFilme && <DejaFilme />}
      <Assistant
        key={formatId}
        initial={initial}
        etapeInitiale={etape}
        origine={origine}
        recents={sp.brouillon ? undefined : <RecentsGenerateur elements={versRecentsVideos(recentsVideos)} vide={null} />}
        donnees={{
          personnages,
          elements,
          idees: idees
            .filter((i) => i.etat === "nouvelle" && (!i.formatSuggere || i.formatSuggere === formatId))
            .slice(0, 6)
            .map((i) => ({ id: i.id, texte: i.texte })),
          express,
          ecritureReelle,
        }}
      />
    </>
  );
}
