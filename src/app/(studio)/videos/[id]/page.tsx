import { correctionEnAttente } from "@/services/recalque";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AvantDePublier } from "@/components/publication/AvantDePublier";
import { BarreActionsVideo } from "@/components/publication/BarreActionsVideo";
import { FournisseurVideo, type DonneesVideo } from "@/components/publication/ContexteVideo";
import { KitPublication } from "@/components/publication/KitPublication";
import { Carte } from "@/components/ui/Carte";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { Onglets, type Onglet } from "@/components/ui/Onglets";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { STATUTS_VIDEO } from "@/domaine/libelles";
import { CarteQualite } from "@/components/videos/CarteQualite";
import { BandeauArchivee } from "@/components/videos/BandeauArchivee";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import { ChiffresVideo, type ChiffreVideo } from "@/components/fabrication/ChiffresVideo";
import { GabaritFicheVideo } from "@/components/fabrication/GabaritFicheVideo";
import { ActionsArret } from "@/components/videos/ActionsArret";
import { peutAnnuler, statutAnnulable } from "@/domaine/corbeille";
import { BandeauGenerateur } from "@/components/videos/BandeauGenerateur";
import { EnTeteVideo } from "@/components/videos/EnTeteVideo";
import { LecteurVersions } from "@/components/videos/LecteurVersions";
import { SuiviTravail } from "@/components/videos/SuiviTravail";
import { aOnglet } from "@/components/videos/fiche/aOnglet";
import { OngletMiniature } from "@/components/videos/fiche/OngletMiniature";
import { DemanderModification } from "@/components/videos/fiche/DemanderModification";
import { OngletRetouches } from "@/components/videos/fiche/OngletRetouches";
import { OngletSousTitres } from "@/components/videos/fiche/OngletSousTitres";
import { AlerteAjouteesDepuis } from "@/components/prononciations/AlerteAjouteesDepuis";
import { prononciationsAjouteesDepuisVideo } from "@/services/prononciations";
import { OngletDistribution, OngletHistorique, OngletReglages, OngletResultats, OngletScript } from "@/components/videos/fiche/OngletsLecture";
import { formatSansPrix, trouverFormat } from "@/formats";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { dureeDeLaVideo, libelleDureeVideo } from "@/domaine/duree-video";
import { titreAffiche } from "@/domaine/titres";
import { formaterMontant } from "@/lib/montants";
import { exigerSession } from "@/services/auth";
import { listerPartages } from "@/services/partages";
import { obtenirKit, resultatsVideo, telechargementsVideo } from "@/services/publications";
import { listerConnexions, lireReglages } from "@/services/reglages";
import { estimerReexport } from "@/services/fabrication";
import { exemplesModification, historiqueModifications } from "@/services/modifications";
import { commandeEnEssai, moteurDeCommande } from "@/moteurs";
import { obtenirVideo } from "@/services/videos";
import { coutsDeLaVideo } from "@/services/cout-video";
import { chiffresCoutVideo } from "@/domaine/cout-video";
import { vueEnvoiBuffer } from "@/services/buffer";
import { AttenteFacecam } from "@/components/facecam/AttenteFacecam";
import { EncartFormatFacecam } from "@/components/facecam/EncartFormatFacecam";
import { VotreVideoFacecam } from "@/components/facecam/VotreVideoFacecam";
import { SuiviTableau } from "@/components/formats/tableau-anime/SuiviTableau";
import { SuiviCasConcret } from "@/components/formats/cas-concret/fiche-video/SuiviCasConcret";
import { ecranTableauVisible } from "@/components/formats/tableau-anime/aiguillage";
import { VotreFicheTableau } from "@/components/formats/tableau-anime/VotreFicheTableau";
import { HistoriqueTableau } from "@/components/formats/tableau-anime/HistoriqueTableau";
import { historiqueTableau } from "@/services/tableau-tracabilite";
import { vueTableau } from "@/services/tableau-vue";
import { fichiersApresArretTableau } from "@/services/tableau-creation";
import { ficheCasConcretVisible } from "@/components/formats/cas-concret/aiguillage";
import { VosFichiers } from "@/components/formats/cas-concret/fiche-video/VosFichiers";
import { vueCasConcret } from "@/services/cas-concret-vue";
import { BlocDocument } from "@/components/formats/cas-concret/document/BlocDocument";
import { BlocReleves } from "@/components/formats/cas-concret/releves/BlocReleves";
import { apercuScriptCasConcret } from "@/services/cas-concret-scripts";
import { ValidationScript } from "@/components/formats/cas-concret/fiche-video/ValidationScript";
import { vueVotreVideo } from "@/services/monteur-facecam";
import { OptionsPayantesVideo } from "@/components/options-payantes/CarteOptionPayante";
import { cartesEnAttente } from "@/services/options-payantes";
import { BlocSurLeSite } from "@/components/videos/fiche/BlocSurLeSite";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await exigerSession();
  const d = await obtenirVideo((await params).id);
  return { title: d ? titreAffiche(d.video.titre) : "Vidéo" };
}

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

/**
 * FICHE VIDÉO (B.8 #8 + AV2.3) — niveau 1.
 * Lecteur au ratio réel + versions, note de qualité, « Avant de publier », KIT DE PUBLICATION,
 * onglets Publier · Retouches · Miniature · Sous-titres · Script · Qui parle · Réglages · Résultats · Historique.
 * Actions collées : Télécharger · Lien privé · Publier (Buffer, en Essai).
 */
export default async function PageVideo({ params }: { params: Promise<{ id: string }> }) {
  // Session vérifiée ICI, avant toute lecture : le layout est rendu en parallèle (cookie révoqué → aucune donnée).
  await exigerSession();
  const { id } = await params;
  const d = await obtenirVideo(id);
  if (!d) notFound();
  const v = d.video;
  // Image → vidéo : sa page à elle (carte, script, fabrication, vos vidéos) est la seule fiche.
  if (v.formatId === ID_FORMAT_IMAGE_VIDEO) redirect(`/image-video/${encodeURIComponent(v.id)}`);
  // Un brouillon se reprend dans l'assistant.
  if (v.statut === "brouillon") redirect(`/nouvelle/${v.formatId}?brouillon=${v.id}`);

  const prete = v.statut === "prete";
  const [kit, partages, resultats, telechargements, reglages, connexions, modifications, prononciationsAjoutees] = await Promise.all([
    prete ? obtenirKit(id) : Promise.resolve(null),
    listerPartages(id),
    resultatsVideo(id),
    telechargementsVideo(id),
    lireReglages(),
    listerConnexions(),
    historiqueModifications(id),
    // Prononciations ajoutées APRÈS la fabrication pour un mot de la vidéo (lot A1, n° 9).
    prete ? prononciationsAjouteesDepuisVideo(id) : Promise.resolve([]),
  ]);
  // Lot R1 : mode et comptes Buffer, lus en base (la page n'appelle jamais Buffer).
  const envoiBuffer = prete ? await vueEnvoiBuffer() : null;
  // Plan facecam v4 (lot D) : « Votre vidéo » face caméra (null pour tous les autres formats : page inchangée).
  const facecam = v.formatId === "facecam" ? await vueVotreVideo(v.id) : null;
  // « Demander une modification » (17/10) : exemples que le format et la vidéo permettent vraiment.
  const exemplesRetouche = prete && !facecam ? await exemplesModification(id) : { exemples: [] };
  // Lot J : options payantes qui attendent « Confirmer » (Décor IA, 3 caméras réelles…), tous formats.
  const optionsPayantes = await cartesEnAttente(v.id);
  const plansPhrases = d.plans.map((p) => ({ id: p.id, debutSec: p.debutSec, finSec: p.finSec, texte: p.texte }));
  const format = trouverFormat(v.formatId);
  const tableau = ecranTableauVisible(format);
  // Raccord 1 : fiche de scènes, coût de la voix et boutons de retouche du tableau animé (rien tant qu'il est masqué).
  const vueTab = tableau ? await vueTableau(v.id) : null;
  const histoTab = tableau ? await historiqueTableau(v.id) : null;
  // Fabrication du tableau arrêtée : les fichiers déjà faits restent téléchargeables, avec ce qui manque.
  const fichiersTab = tableau && d.travail?.statut === "echec" ? await fichiersApresArretTableau(v.id) : null;
  // Cas concret MD : « Vos fichiers » ; la publication est coupée pour ce format (`ecranVideo.publication`).
  const vueCas = ficheCasConcretVisible(format) ? await vueCasConcret(v.id) : null;
  // V4-3 : un script écrit qui attend la validation de Will (avant toute voix) : texte dit et ordre des écrans.
  const scriptAValider = ficheCasConcretVisible(format) && d.travail?.statut === "echec" ? await apercuScriptCasConcret(v.id) : null;
  // Brique 3 : cet arrêt est une étape « À relire », pas un échec (en-tête et icône).
  const aRelire = scriptAValider?.etat === "a-valider";
  const sansPublication = format?.ecranVideo?.publication === "aucune";
  const principale = d.sorties.find((s) => s.ratio === v.ratios[0]) ?? d.sorties[0];
  const miniature = d.miniatures.find((m) => m.choisie);
  // Face caméra : un « Nouveau format » (4:5, carré, 16:9) qui se fabrique ne bloque ni le fil du monteur ni les
  // panneaux Coupes / Image / Cartes : la vidéo 9:16 est prête (constat prod 10/10). Petit encart à la place de l'attente.
  const formatSecondaire = !!facecam && prete && d.travail?.type === "reexport";
  const enFabrication = !!d.travail && (d.travail.statut === "en_cours" || d.travail.statut === "en_file") && !formatSecondaire;
  // CORRECTEUR FINAL A (VERIF-E2E-1 n° 3) : l'essai se lit sur le moteur figé dans la version (la carte Montage peut être
  // « Reliée » alors que la vidéo est sortie du moteur d'essai, interrupteurs éteints).
  const versionDEssai = !v.estDemo && commandeEnEssai(d.versionCourante?.commande);
  const fabricationSimulee = commandeEnEssai(d.versionCourante?.commande) || connexions.find((c) => c.type === "montage")?.etat !== "relie";
  // Durée RÉELLE de la version choisie dès qu'elle est montée ; l'estimation du script (« environ ») avant.
  const duree = dureeDeLaVideo(v.dureeCibleSec, principale);
  const dureeLibelle = libelleDureeVideo(duree);
  const ratiosFormat = format?.ratios ?? v.ratios;
  const manquants = prete ? ratiosFormat.filter((r) => !d.sorties.some((s) => s.ratio === r)) : [];
  // « Appliquer à la vidéo » (sous-titres corrigés) n'existe que si le moteur de la version sait les recomposer (lot M4).
  const recalquePossible = !!d.versionCourante && typeof moteurDeCommande(d.versionCourante.commande).recalquer === "function";
  // Une correction déjà enregistrée mais pas encore appliquée à la vidéo reste proposée après un rechargement.
  const correctionAAppliquer = recalquePossible && !enFabrication && d.versionCourante ? await correctionEnAttente(d.versionCourante.id) : false;
  const couts = await coutsDeLaVideo(v.id);
  const coutsFormats = Object.fromEntries(await Promise.all(manquants.map(async (r) => [r, (await estimerReexport(v.id, r)).centimes] as const)));

  const donnees: DonneesVideo = {
    videoId: v.id,
    titre: v.titre,
    dureeSec: duree.sec,
    ratios: v.ratios,
    ratiosFormat,
    coutsFormats,
    sorties: d.sorties.map((s) => ({ id: s.id, ratio: s.ratio, resolution: s.resolution, url: s.url, vignette: s.vignette, taille: s.taille })),
    sousTitres: telechargements?.sousTitres ?? null,
    kit,
    partages,
    reseauxParDefaut: reglages.reseauxParDefaut,
    fabricationSimulee,
    textesSimules: connexions.find((c) => c.type === "texte-reseaux")?.etat !== "relie",
    envoiBuffer,
    verifiesAuto: principale?.rapportQualite.verifie ?? {},
  };

  const chiffres: ChiffreVideo[] = [
    { libelle: "Durée", valeur: dureeLibelle, icone: "horloge" as const },
    { libelle: "Vues", valeur: resultats.total.vues ? compact.format(resultats.total.vues) : "—", icone: "oeil" as const },
    // E2E-2 argent n° 6 et 7 : le payé (sans ESSAI) et la part simulée (ESSAI, pas payée) sont séparés.
    ...(facecam ? [] : chiffresCoutVideo({ ...couts, coutEstime: v.coutEstime, fabricationSimulee, estDemo: v.estDemo }).map((c) => ({
      libelle: c.libelle,
      valeur: c.montant ? `${c.estime ? "≈ " : ""}${formaterMontant(c.montant)}` : "—",
      icone: "euro" as const,
      essai: c.essai,
    }))),
  ];

  const onglets: Onglet[] = [
    ...(prete && kit && !sansPublication
      ? [
          {
            valeur: "publier",
            libelle: "Publier",
            icone: "megaphone" as const,
            contenu: (
              <div className="space-y-4">
                <AvantDePublier />
                <KitPublication />
              </div>
            ),
          },
        ]
      : []),
    ...(prete || d.retouches.length || modifications.length
      ? [
          {
            valeur: "retouches",
            libelle: "Retouches",
            icone: "ciseaux" as const,
            compteur: d.retouches.length || undefined,
            contenu: (
              <div className="space-y-4">
                {!facecam && <DemanderModification videoId={v.id} historique={modifications} possible={prete && !enFabrication} essai={fabricationSimulee} sansPrix={trouverFormat(v.formatId)?.sansPrix === true} {...exemplesRetouche} />}
                <OngletRetouches
                videoId={v.id}
                possible={prete && !enFabrication}
                essai={fabricationSimulee}
                retouches={d.retouches}
                plans={d.plans.map((p) => ({ id: p.id, ordre: p.ordre, debutSec: p.debutSec, finSec: p.finSec, texte: p.texte, vignette: p.vignette, verrouille: !!p.illustration?.verrouille }))}
                />
              </div>
            ),
          },
        ]
      : []),
    ...(d.miniatures.length
      ? [
          {
            valeur: "miniature",
            libelle: "Miniature",
            icone: "image" as const,
            contenu: <OngletMiniature videoId={v.id} dureeLibelle={dureeLibelle} miniatures={d.miniatures.map((m) => ({ id: m.id, url: m.url, titre: m.titre, choisie: m.choisie, incrustee: !!m.incrustee }))} />,
          },
        ]
      : []),
    {
      valeur: "sous-titres",
      libelle: "Sous-titres",
      icone: "sous-titres",
      contenu: <OngletSousTitres videoId={v.id} segments={d.sousTitres?.segments ?? null} liens={telechargements?.sousTitres ?? null} recalquePossible={recalquePossible && !enFabrication} correctionEnAttente={correctionAAppliquer} plans={plansPhrases} />,
    },
    { valeur: "script", libelle: "Script", icone: "document", contenu: <OngletScript script={d.script} formatId={v.formatId} /> },
    { valeur: "distribution", libelle: "Qui parle", icone: "personnages", contenu: <OngletDistribution distribution={d.distribution} /> },
    {
      valeur: "reglages",
      libelle: "Réglages",
      icone: "curseurs",
      contenu: <OngletReglages commande={d.versionCourante?.commande ?? null} mentionIA={v.mentionIA} dureeLibelle={dureeLibelle} ratios={v.ratios} />,
    },
    ...(prete ? [{ valeur: "resultats", libelle: "Résultats", icone: "resultats" as const, contenu: <OngletResultats resultats={resultats} exemple={v.estDemo} /> }] : []),
    {
      valeur: "historique",
      libelle: "Historique",
      icone: "horloge",
      contenu: <OngletHistorique versions={d.versions} publications={d.publications} versionCouranteId={d.versionCourante?.id} />,
    },
  ];

  const lecteur = principale ? (
    <LecteurVersions
      videoId={v.id}
      titre={v.titre}
      sorties={d.sorties.map((s) => ({ id: s.id, ratio: s.ratio, url: s.url, vignette: s.vignette }))}
      affiche={miniature?.url}
      sousTitresVtt={d.sousTitres ? `/api/sous-titres/${v.id}?format=vtt` : undefined}
      versions={d.versions.map((x) => ({ id: x.id, numero: x.numero, choisie: x.choisie, enCours: x.statut === "en_fabrication" }))}
      versionCouranteId={d.versionCourante?.id}
    />
  ) : (
    <div className="relative isolate mx-auto grid aspect-[9/16] max-h-[56vh] place-items-center overflow-hidden rounded-carte border border-trait bg-surface-1 lg:max-h-[70vh]">
      <div aria-hidden className="absolute inset-0 -z-10 lueur-forte" />
      {d.carte.vignette && <Image src={d.carte.vignette} alt="" fill sizes="420px" className="-z-20 object-cover opacity-30" />}
      <span className="grid size-16 place-items-center rounded-full bg-fond/70 text-orange-vif backdrop-blur">
        <Icone nom={aRelire ? "oeil" : STATUTS_VIDEO[v.statut].icone} size={28} className={v.statut === "en_fabrication" ? "animate-spin [animation-duration:2.5s]" : undefined} />
      </span>
    </div>
  );

  // Vidéo arrêtée par Will, sans travail en cours : les mots et l'ordre des actions de tous les formats (ActionsArret : EnTeteSuivi + ActionsSuivi).
  const arretee = !prete && !d.travail && v.statut === "annulee";

  // La zone « specifique » n'existe que si au moins un de ses blocs s'affiche (sinon le gabarit laisserait un vide).
  const etatVide = !prete && !d.travail && v.statut !== "archivee" && !arretee;
  const ajoutees = !enFabrication && prononciationsAjoutees.length > 0;
  const aSpecifique = Boolean(d.noteQualite || ajoutees || etatVide || prete || (tableau && (vueTab || histoTab)) || optionsPayantes.length > 0);

  return (
    <FournisseurVideo donnees={donnees}>
      <GabaritFicheVideo
          deuxColonnes
          retour={
            <Link href="/videos" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-texte-doux hover:text-texte">
              <Icone nom="fleche-gauche" size={16} />
              Mes vidéos
            </Link>
          }
          bandeau={<BandeauGenerateur formatId={d.carte.format.id} className="mb-0" />}
          entete={
            <>
              <EnTeteVideo videoId={v.id} titre={titreAffiche(v.titre)} statut={v.statut} etapeEditoriale={v.etapeEditoriale} format={d.carte.format} estDemo={v.estDemo} aRelire={aRelire} corbeilleLe={d.carte.corbeilleLe} />
              {v.statut === "archivee" && <BandeauArchivee videoId={v.id} corbeilleLe={d.carte.corbeilleLe} />}
            </>
          }
          lecteur={lecteur}
          essai={
            versionDEssai && (
              <div className="flex items-start gap-3 rounded-2xl border border-trait bg-surface-1 px-4 py-3 text-sm text-texte-doux">
                <PastilleEssai className="mt-0.5 shrink-0" />
                <p className="min-w-0 flex-1">Vidéo d&apos;essai : une vidéo de démonstration remplace la vôtre. Rien n&apos;a été payé et elle ne part pas sur vos réseaux.</p>
              </div>
            )
          }
          chiffres={<ChiffresVideo chiffres={chiffres} />}
          suivi={
            (d.travail || arretee) && (
              <Carte lueur={enFabrication}>
                {arretee ? (
                  <ActionsArret videoId={v.id} formatId={v.formatId} annulable={statutAnnulable(v.statut) && !v.versionChoisieId} />
                ) : d.travail && formatSecondaire ? (
                  <EncartFormatFacecam initial={d.travail} />
                ) : d.travail && facecam && (enFabrication || d.travail.statut === "echec") ? (
                  <AttenteFacecam initial={d.travail} />
                ) : d.travail && tableau && (enFabrication || d.travail.statut === "echec") ? (
                  <SuiviTableau initial={d.travail} fichiers={fichiersTab} />
                ) : d.travail && ficheCasConcretVisible(format) ? (
                  <>
                    {!(prete && d.travail.statut === "annule") && <SuiviCasConcret initial={d.travail} compacte={!enFabrication} annulable={peutAnnuler(v)} videoPrete={prete} />}
                    {aRelire && scriptAValider && <ValidationScript videoId={v.id} travailId={d.travail.id} ecrans={scriptAValider.ecrans} avertissements={scriptAValider.avertissements} />}
                  </>
                ) : d.travail ? (
                  <SuiviTravail initial={d.travail} compacte={!enFabrication} sansPrix={formatSansPrix(v.formatId)} />
                ) : null}
              </Carte>
            )
          }
          specifique={
            aSpecifique && (
            <div className="space-y-4 empty:hidden">
              {d.noteQualite && <CarteQualite note={d.noteQualite} />}
              {ajoutees && <AlerteAjouteesDepuis videoId={v.id} ajoutees={prononciationsAjoutees} plans={plansPhrases} />}
              {etatVide && <EtatVide compact icone={STATUTS_VIDEO[v.statut].icone} titre={STATUTS_VIDEO[v.statut].libelle} phrase="Le kit de publication arrive avec la vidéo." action={statutAnnulable(v.statut) && !v.versionChoisieId ? <BoutonAnnuler videoId={v.id} apres="/videos" /> : undefined} />}
              {facecam && prete && <VotreVideoFacecam videoId={v.id} vue={facecam} possible={prete && !enFabrication} avecOngletSousTitres={aOnglet(onglets, "sous-titres")} />}
              {tableau && vueTab && <VotreFicheTableau videoId={v.id} vue={vueTab} possible={prete && !enFabrication} />}
              {tableau && histoTab && <HistoriqueTableau videoId={v.id} vue={histoTab} />}
              {vueCas && prete && <VosFichiers vue={vueCas} lienPrive={{ videoId: v.id, titre: v.titre, partages }} />}
              {vueCas && prete && (
                // Chaque bloc se garde lui-même : réglage éteint (défaut), il ne rend rien et le conteneur reste vide (masqué).
                <div className="space-y-4 empty:hidden">
                  {vueCas.documentAPreparer && <BlocDocument videoId={v.id} />}
                  <BlocReleves videoId={v.id} />
                </div>
              )}
              <OptionsPayantesVideo videoId={v.id} cartes={optionsPayantes} />
              {prete && <BlocSurLeSite videoId={v.id} />}
            </div>
            )
          }
          onglets={<Onglets libelle="Sections de la vidéo" className="mt-6" onglets={onglets} />}
          action={prete && kit && !sansPublication && (facecam ? <BarreActionsVideo libellePublier="Valider et publier" avecOngletPublier={aOnglet(onglets, "publier")} /> : <BarreActionsVideo avecOngletPublier={aOnglet(onglets, "publier")} />)}
        />
    </FournisseurVideo>
  );
}
