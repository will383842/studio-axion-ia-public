"use client";

import { insecable } from "@/lib/textes";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiverVideosAction,
  changerEtapeEditorialeAction,
  desarchiverVideosAction,
  enregistrerCommeModeleAction,
  renommerVideoAction,
  mettreALaCorbeilleAction,
  viderCorbeilleAction,
} from "@/app/(studio)/videos/actions";
import { useVideo, useVideoFacultatif } from "@/components/publication/ContexteVideo";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Menu } from "@/components/ui/Menu";
import { Pastille } from "@/components/ui/Pastille";
import { PastilleEtat } from "@/components/ui/PastilleEtat";
import { PastilleFamille, PastilleStatut } from "@/components/ui/PastilleStatut";
import { STATUTS_USINE } from "@/components/ui/statuts-usine";
import { notifier } from "@/components/ui/Toast";
import { messageCorbeille, noteRestauration } from "@/domaine/corbeille";
import { ETAPES_EDITORIALES, LIBELLES_RETRAIT } from "@/domaine/libelles";
import type { EtapeEditoriale, IdReseau, StatutVideo } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { nomCourtFormat } from "@/formats";
import { BoutonValider } from "./BoutonValider";
import { statutUsineDeEtape, statutUsineDeVideo } from "./statut-usine-video";
import { PastillesReseaux } from "./PastillesReseaux";
import { useConfirmationArchivage } from "./ConfirmationArchivage";
import { useConfirmationSuppression } from "./ConfirmationSuppression";

type Feuille = "renommer" | "modele" | "etape" | null;

/**
 * Titre de la fiche vidéo, ses pastilles et le menu « … » :
 * Renommer · Étape · Enregistrer comme modèle · Décliner (bientôt) · Archiver · Mettre à la corbeille (restaurable 30 jours) · Supprimer définitivement (depuis la corbeille).
 */
export function EnTeteVideo({
  videoId,
  titre,
  statut,
  etapeEditoriale,
  format,
  estDemo,
  aRelire,
  corbeilleLe,
  reseaux = [],
  reseauxPrecis = false,
  actions,
}: {
  videoId: string;
  titre: string;
  statut: StatutVideo;
  etapeEditoriale?: EtapeEditoriale;
  format: { id: string; nom: string; icone: NomIcone };
  estDemo?: boolean;
  /** La fabrication attend que Will relise le script (cas concret) : « À relire », pas « À reprendre ». */
  aRelire?: boolean;
  /** Vidéo à la corbeille : seule « Supprimer définitivement » reste (et « Restaurer »). */
  corbeilleLe?: string;
  /** Lot F : réseaux de la vidéo (pastilles) ; `reseauxPrecis` faux = réseaux prévus par défaut (pastilles atténuées). */
  reseaux?: readonly IdReseau[];
  reseauxPrecis?: boolean;
  /** Lot F : actions posées à côté de « Valider », sous le titre (Télécharger, Lien privé). */
  actions?: ReactNode;
}) {
  const router = useRouter();
  const [feuille, setFeuille] = useState<Feuille>(null);
  const [nouveauTitre, setNouveauTitre] = useState(titre);
  const [nomModele, setNomModele] = useState(`${nomCourtFormat(format)} — ${titre}`.slice(0, 60));
  const [enCours, demarrer] = useTransition();
  const prete = statut === "prete";
  const confirmation = useConfirmationArchivage();
  const suppression = useConfirmationSuppression();
  // La barre du bas ne porte le bouton orange (Publier) que si la vidéo est publiable : sinon « Valider » reste le seul.
  const publiable = useVideoFacultatif()?.publiable ?? false;

  function executer(action: () => Promise<{ ok: boolean; message?: string }>, succes: string, apres?: () => void) {
    demarrer(async () => {
      const r = await action();
      if (!r.ok) {
        notifier.erreur(r.message ?? "Un souci est survenu.");
        return;
      }
      notifier.succes(succes);
      setFeuille(null);
      apres?.();
      router.refresh();
    });
  }

  /** Restaurable 30 jours : pas de confirmation, le message le dit (et les brouillons restés dans Buffer). */
  function mettreALaCorbeille() {
    demarrer(async () => {
      const r = await mettreALaCorbeilleAction([videoId]);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(messageCorbeille(r.donnees.mises, r.donnees.brouillonsBuffer, r.donnees.pagesRetirees));
      router.push("/videos?vue=corbeille");
      router.refresh();
    });
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <PastilleFamille famille="video" />
        {prete && etapeEditoriale ? (
          <button
            type="button"
            onClick={() => setFeuille("etape")}
            className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2"
            aria-label={`${STATUTS_USINE[statutUsineDeEtape(etapeEditoriale)].libelle}, changer l'étape`}
          >
            <PastilleStatut statut={statutUsineDeEtape(etapeEditoriale)} />
          </button>
        ) : aRelire ? (
          <PastilleStatut statut={statutUsineDeEtape("a_relire")} />
        ) : (
          <PastilleVideo statut={statut} />
        )}
        {estDemo && <Pastille>Exemple</Pastille>}
        <PastillesReseaux reseaux={reseaux} precis={reseauxPrecis} />
      </div>
      <div className="flex items-start gap-2">
        <h1 title={titre} className="line-clamp-2 min-w-0 flex-1 text-2xl leading-tight text-texte sm:text-3xl">{insecable(titre)}</h1>
        <Menu
          declencheur={<Bouton variante="secondaire" taille="md" icone="menu">Plus</Bouton>}
          elements={[
            { libelle: "Renommer", icone: "ecrire", onSelect: () => setFeuille("renommer") },
            ...(prete
              ? [
                  { libelle: "Étape de publication", icone: "calendrier" as const, onSelect: () => setFeuille("etape") },
                  { libelle: "Enregistrer comme modèle", icone: "modele" as const, onSelect: () => setFeuille("modele") },
                ]
              : []),
            { libelle: "Décliner", icone: "calques", onSelect: () => undefined, bientot: true },
            // Pas d'archivage pendant la fabrication : la fin du travail ferait réapparaître la vidéo.
            ...(statut === "en_file" || statut === "en_fabrication"
              ? []
              : [
                  "separateur" as const,
                  statut === "archivee"
                    ? { libelle: LIBELLES_RETRAIT.retour, icone: "archive" as const, onSelect: () => executer(() => desarchiverVideosAction([videoId]), `Vidéo restaurée${noteRestauration(corbeilleLe)}`) }
                    : {
                        libelle: LIBELLES_RETRAIT.action,
                        icone: "archive" as const,
                        danger: true,
                        // Des publications encore programmées ? On prévient avant (elles quittent le calendrier).
                        onSelect: () => void confirmation.demander([videoId], () => executer(() => archiverVideosAction([videoId]), "Vidéo archivée", () => router.push("/videos"))),
                      },
                  // Décision de Will (18/10) : « Mettre à la corbeille » (restaurable 30 jours) ; la vraie suppression (17/10,
                  // après confirmation, dépenses gardées) se fait depuis la corbeille.
                  corbeilleLe
                    ? {
                        libelle: "Supprimer définitivement",
                        icone: "corbeille" as const,
                        danger: true,
                        onSelect: () => suppression.demander({ titre, nombre: 1 }, () => executer(() => viderCorbeilleAction([videoId]), "Vidéo supprimée", () => router.push("/videos?vue=corbeille"))),
                      }
                    : {
                        libelle: "Mettre à la corbeille",
                        icone: "corbeille" as const,
                        danger: true,
                        onSelect: () => void mettreALaCorbeille(),
                      },
                ]),
          ]}
        />
      </div>

      {(prete || actions) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BoutonValider videoId={videoId} prete={prete} etape={etapeEditoriale} variante={actions && publiable ? "secondaire" : "principal"} sansPastilleEtape />
          {actions}
        </div>
      )}

      {confirmation.feuille}
      {suppression.feuille}

      <FeuilleBas
        ouverte={feuille === "renommer"}
        onOuverteChange={(o) => setFeuille(o ? "renommer" : null)}
        titre="Renommer"
        pied={
          <Bouton taille="lg" pleineLargeur chargement={enCours} disabled={!nouveauTitre.trim()} onClick={() => executer(() => renommerVideoAction(videoId, nouveauTitre), "Titre modifié")}>
            Enregistrer
          </Bouton>
        }
      >
        <Champ libelle="Titre" libelleMasque grand autoFocus value={nouveauTitre} onChange={(e) => setNouveauTitre(e.target.value)} maxLength={120} />
      </FeuilleBas>

      <FeuilleBas
        ouverte={feuille === "modele"}
        onOuverteChange={(o) => setFeuille(o ? "modele" : null)}
        titre="Enregistrer comme modèle"
        description="Format, durée, double, styles et réglages, réutilisables en un geste."
        pied={
          <Bouton
            taille="lg"
            pleineLargeur
            icone="modele"
            chargement={enCours}
            disabled={!nomModele.trim()}
            onClick={() =>
              demarrer(async () => {
                const r = await enregistrerCommeModeleAction(videoId, nomModele);
                if (!r.ok) {
                  notifier.erreur(r.message);
                  return;
                }
                notifier.succes("Modèle enregistré", "Retrouvez-le dans Mes modèles.");
                setFeuille(null);
              })
            }
          >
            Enregistrer le modèle
          </Bouton>
        }
      >
        <Champ libelle="Nom du modèle" icone="modele" value={nomModele} onChange={(e) => setNomModele(e.target.value)} maxLength={60} />
      </FeuilleBas>

      <FeuilleBas ouverte={feuille === "etape"} onOuverteChange={(o) => setFeuille(o ? "etape" : null)} titre="Étape de publication">
        <ul className="grid grid-cols-2 gap-2">
          {(Object.keys(ETAPES_EDITORIALES) as EtapeEditoriale[]).map((e) => {
            const s = ETAPES_EDITORIALES[e];
            const actif = e === etapeEditoriale;
            return (
              <li key={e}>
                <button
                  type="button"
                  disabled={enCours}
                  aria-pressed={actif}
                  onClick={() => (actif ? setFeuille(null) : executer(() => changerEtapeEditorialeAction(videoId, e), s.libelle))}
                  className={cn(
                    "flex min-h-20 w-full flex-col items-start justify-between gap-2 rounded-2xl border p-3 text-left transition-colors",
                    actif ? "border-accent bg-accent-doux" : "border-trait bg-surface-2 hover:border-trait-fort",
                  )}
                >
                  <Icone nom={s.icone} size={20} className={actif ? "text-accent" : "text-texte-doux"} />
                  <span className="text-sm font-semibold text-texte">{s.libelle}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </FeuilleBas>
    </div>
  );
}

/** Statut technique : l'un des 9 de l'usine, ou la pastille d'origine pour « archivée ». */
function PastilleVideo({ statut }: { statut: StatutVideo }) {
  const usine = statutUsineDeVideo(statut);
  return usine ? <PastilleStatut statut={usine} /> : <PastilleEtat type="video" statut={statut} />;
}

/** Télécharger et Lien privé, sous le titre : ouvrent les feuilles que porte `BarreActionsVideo` (même fiche). */
export function ActionsRapidesVideo() {
  const { ouvrir } = useVideo();
  return (
    <>
      <Bouton variante="secondaire" taille="md" icone="telecharger" onClick={() => ouvrir("telecharger")}>
        Télécharger
      </Bouton>
      <Bouton variante="secondaire" taille="md" icone="lien" onClick={() => ouvrir("partager")}>
        Lien privé
      </Bouton>
    </>
  );
}
