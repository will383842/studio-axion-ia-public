"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { archiverVideosAction, desarchiverVideosAction, mettreALaCorbeilleAction, restaurerDeLaCorbeilleAction, viderCorbeilleAction } from "@/app/(studio)/videos/actions";
import { Apparition } from "@/components/ui/Apparition";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Menu } from "@/components/ui/Menu";
import { PastilleEtat } from "@/components/ui/PastilleEtat";
import { FormeRatio, SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { VignetteVideo } from "@/components/ui/VignetteVideo";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import { joursRestants, messageCorbeille, noteRestauration, phraseSuppressionDans } from "@/domaine/corbeille";
import { ETAPES_EDITORIALES, LIBELLES_RETRAIT } from "@/domaine/libelles";
import { useConfirmationArchivage } from "./ConfirmationArchivage";
import { useConfirmationSuppression } from "./ConfirmationSuppression";
import type { EtapeEditoriale, Ratio } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { contient, pluriel } from "@/lib/textes";
import type { VueVideoCarte } from "@/services/vues";
import { CarteVideo } from "./CarteVideo";

type Statut = "prete" | "en-cours" | "echec" | "annulee" | "brouillon";
type Tri = "recentes" | "anciennes" | "titre" | "qualite";

const STATUTS: { valeur: Statut; libelle: string; icone: NomIcone }[] = [
  { valeur: "prete", libelle: "Prêtes", icone: "valide" },
  { valeur: "en-cours", libelle: "En cours", icone: "sablier" },
  { valeur: "echec", libelle: "À corriger", icone: "attention" },
  { valeur: "annulee", libelle: "Arrêtées", icone: "fermer" },
  { valeur: "brouillon", libelle: "Brouillons", icone: "ecrire" },
];

const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: "recentes", libelle: "Plus récentes" },
  { valeur: "anciennes", libelle: "Plus anciennes" },
  { valeur: "titre", libelle: "Titre (A → Z)" },
  { valeur: "qualite", libelle: "Meilleure qualité" },
];

function statutDe(v: VueVideoCarte): Statut | null {
  if (v.statut === "prete") return "prete";
  if (v.statut === "echec") return "echec";
  if (v.statut === "annulee") return "annulee";
  if (v.statut === "brouillon") return "brouillon";
  if (v.statut === "en_file" || v.statut === "en_fabrication" || v.statut === "maquette") return "en-cours";
  return null;
}

interface Filtres {
  statut?: Statut;
  etape?: EtapeEditoriale;
  ratio?: Ratio;
  serie?: string;
}

/**
 * Galerie de Mes vidéos et des onglets de format : recherche, filtres (statut technique,
 * étape éditoriale, ratio, série) dans une feuille, tri, sélection multiple (télécharger, archiver).
 */
export function GalerieVideos({
  videos,
  series = [],
  archivees = false,
  corbeille = false,
  afficherFormat = true,
  ratioForce = "9:16",
  vide,
  filtresInitiaux,
  filtresAdresse,
}: {
  videos: VueVideoCarte[];
  series?: { id: string; nom: string }[];
  /** Onglet « Archivées » : l'action de sélection devient « Restaurer ». */
  archivees?: boolean;
  /** Onglet « Corbeille » : « Restaurer » et « Supprimer définitivement » ; chaque vidéo dit dans combien de jours elle part. */
  corbeille?: boolean;
  afficherFormat?: boolean;
  ratioForce?: Ratio;
  /** État vide quand la liste est vide (avant tout filtre). */
  vide?: ReactNode;
  /** Filtres posés à l'ouverture (ex. étape « À relire » depuis l'accueil). */
  filtresInitiaux?: { etape?: EtapeEditoriale };
  /**
   * Filtres d'adresse (Réseau, Étape, Type) venus du serveur : `contenu` va en tête de la feuille « Filtres », `puces` (filtres actifs retirables
   * et « Tout effacer ») s'affichent sur la ligne des puces, `nombre` s'ajoute au compteur. L'étape d'adresse remplace le groupe « Publication ».
   */
  filtresAdresse?: { contenu: ReactNode; puces: ReactNode; nombre: number; effacerHref: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtres, setFiltres] = useState<Filtres>(filtresInitiaux ?? {});
  const [tri, setTri] = useState<Tri>("recentes");
  const [feuille, setFeuille] = useState(false);
  const [enSelection, setEnSelection] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [enCours, demarrer] = useTransition();
  const confirmation = useConfirmationArchivage();
  const suppression = useConfirmationSuppression();

  // Options proposées : seulement celles présentes dans la liste.
  const presents = useMemo(() => {
    const statuts = new Set(videos.map(statutDe).filter(Boolean));
    const etapes = new Set(videos.map((v) => v.etapeEditoriale).filter(Boolean));
    const ratios = new Set(videos.flatMap((v) => v.ratios));
    const seriesPresentes = new Set(videos.map((v) => v.serieId).filter(Boolean));
    return {
      statuts: STATUTS.filter((s) => statuts.has(s.valeur)),
      etapes: (Object.keys(ETAPES_EDITORIALES) as EtapeEditoriale[]).filter((e) => etapes.has(e)),
      ratios: (["9:16", "1:1", "4:5", "16:9"] as Ratio[]).filter((r) => ratios.has(r)),
      series: series.filter((s) => seriesPresentes.has(s.id)),
    };
  }, [videos, series]);

  const visibles = useMemo(() => {
    const r = videos.filter(
      (v) =>
        (!q || contient(v.titre, q) || contient(v.format.nom, q)) &&
        (!filtres.statut || statutDe(v) === filtres.statut) &&
        (!filtres.etape || v.etapeEditoriale === filtres.etape) &&
        (!filtres.ratio || v.ratios.includes(filtres.ratio)) &&
        (!filtres.serie || v.serieId === filtres.serie),
    );
    return r.sort((a, b) => {
      if (tri === "titre") return a.titre.localeCompare(b.titre, "fr");
      if (tri === "anciennes") return a.modifieLe.localeCompare(b.modifieLe);
      if (tri === "qualite") return (b.noteQualite ?? -1) - (a.noteQualite ?? -1);
      return b.modifieLe.localeCompare(a.modifieLe);
    });
  }, [videos, q, filtres, tri]);

  // Avec les filtres d'adresse, l'étape se choisit là (pas deux fois) : elle ne compte ni ne s'affiche côté client.
  const nbClient = Object.entries(filtres).filter(([cle, v]) => v && !(filtresAdresse && cle === "etape")).length;
  const nbFiltres = nbClient + (filtresAdresse?.nombre ?? 0);
  const aDesFiltres = !!filtresAdresse || presents.statuts.length > 1 || presents.etapes.length > 0 || presents.ratios.length > 1 || presents.series.length > 0;

  // Liste vide : si des filtres d'adresse sont posés, on garde leurs puces pour pouvoir les retirer.
  if (!videos.length && vide) return filtresAdresse?.nombre ? <div><div className="mb-4">{filtresAdresse.puces}</div>{vide}</div> : <>{vide}</>;

  function basculer(id: string) {
    setChoisis((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Retire tous les filtres : ceux de l'adresse (lien « Tout effacer »), puis ceux de la page. */
  function toutEffacer() {
    setFiltres({});
    if (filtresAdresse?.nombre) router.push(filtresAdresse.effacerHref);
  }

  function quitterSelection() {
    setEnSelection(false);
    setChoisis(new Set());
  }

  function telecharger(ids: string[]) {
    const fichiers = videos.filter((v) => ids.includes(v.id) && v.video);
    if (!fichiers.length) {
      notifier.info("Rien à télécharger", "Seules les vidéos prêtes se téléchargent.");
      return;
    }
    fichiers.forEach((v, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = `/api/telechargements/video?video=${encodeURIComponent(v.id)}`;
        a.download = `${v.titre.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 400);
    });
    notifier.succes(fichiers.length > 1 ? `${fichiers.length} téléchargements lancés` : "Téléchargement lancé");
  }

  function archiver(ids: string[]) {
    if (!archivees) {
      void confirmation.demander(ids, () => executerArchivage(ids));
      return;
    }
    executerArchivage(ids);
  }

  function executerArchivage(ids: string[]) {
    demarrer(async () => {
      const r = archivees ? await desarchiverVideosAction(ids) : await archiverVideosAction(ids);
      if (!r.ok) {
                notifier.erreur(r.message);
                return;
              }
      notifier.succes(archivees ? pluriel(ids.length, "vidéo restaurée", "vidéos restaurées") : pluriel(ids.length, "vidéo archivée", "vidéos archivées"));
      quitterSelection();
      router.refresh();
    });
  }

  function restaurer(ids: string[]) {
    demarrer(async () => {
      const r = await restaurerDeLaCorbeilleAction(ids);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(`${pluriel(ids.length, "vidéo restaurée", "vidéos restaurées")}${noteRestauration(videos.find((v) => ids.includes(v.id))?.corbeilleLe)}`);
      quitterSelection();
      router.refresh();
    });
  }

  /** « Mettre à la corbeille » : restaurable 30 jours, donc sans confirmation ; le message le dit. */
  function mettreALaCorbeille(ids: string[]) {
    demarrer(async () => {
      const r = await mettreALaCorbeilleAction(ids);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      notifier.succes(messageCorbeille(r.donnees.mises, r.donnees.brouillonsBuffer, r.donnees.pagesRetirees));
      quitterSelection();
      router.refresh();
    });
  }

  function supprimer(ids: string[]) {
    suppression.demander({ nombre: ids.length, titre: ids.length === 1 ? videos.find((v) => v.id === ids[0])?.titre : undefined }, () =>
      demarrer(async () => {
        const r = await viderCorbeilleAction(ids);
        if (!r.ok) {
          notifier.erreur(r.message);
          return;
        }
        notifier.succes(pluriel(ids.length, "vidéo supprimée", "vidéos supprimées"));
        quitterSelection();
        router.refresh();
      }),
    );
  }

  return (
    <div>
      {confirmation.feuille}
      {suppression.feuille}
      {/* Barre d'outils : recherche, filtres, tri, sélection */}
      <div className="mb-4 flex items-center gap-2">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-trait bg-surface-1 px-4 transition-colors focus-within:border-orange">
          <Icone nom="loupe" size={18} className="shrink-0 text-texte-faible" />
          <span className="sr-only">Rechercher une vidéo</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-texte outline-none placeholder:text-texte-faible"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Effacer la recherche" className="-mr-2 grid size-9 place-items-center rounded-full text-texte-faible hover:text-texte">
              <Icone nom="fermer" size={16} />
            </button>
          )}
        </label>
        {aDesFiltres && (
          <button
            type="button"
            onClick={() => setFeuille(true)}
            aria-label={nbFiltres ? `Filtres, ${nbFiltres} actifs` : "Filtres"}
            className={cn(
              "relative inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors",
              nbFiltres ? "border-texte bg-texte text-fond" : "border-trait bg-surface-1 text-texte-doux hover:text-texte",
            )}
          >
            <Icone nom="filtre" size={18} />
            <span>Filtres</span>
            {nbFiltres > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-fond/20 px-1 text-[11px] tabular-nums">{nbFiltres}</span>
            )}
          </button>
        )}
        <Menu
          declencheur={
            <button type="button" aria-label="Trier" className="grid size-11 shrink-0 place-items-center rounded-full border border-trait bg-surface-1 text-texte-doux hover:text-texte">
              <Icone nom="curseurs" size={18} />
            </button>
          }
          elements={TRIS.map((t) => ({ libelle: t.libelle, icone: t.valeur === tri ? "coche" : undefined, onSelect: () => setTri(t.valeur) }))}
        />
        <Bouton variante={enSelection ? "secondaire" : "fantome"} onClick={() => (enSelection ? quitterSelection() : setEnSelection(true))} className="hidden sm:inline-flex">
          {enSelection ? "Terminer" : "Choisir"}
        </Bouton>
        <button
          type="button"
          onClick={() => (enSelection ? quitterSelection() : setEnSelection(true))}
          aria-label={enSelection ? "Terminer la sélection" : "Choisir plusieurs vidéos"}
          aria-pressed={enSelection}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full border transition-colors sm:hidden",
            enSelection ? "border-texte bg-texte text-fond" : "border-trait bg-surface-1 text-texte-doux",
          )}
        >
          <Icone nom={enSelection ? "fermer" : "coche"} size={18} />
        </button>
      </div>

      {/* Filtres actifs : pastilles retirables */}
      {nbFiltres > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {filtresAdresse?.puces}
          {filtres.statut && <PuceFiltre libelle={STATUTS.find((s) => s.valeur === filtres.statut)!.libelle} onRetirer={() => setFiltres((f) => ({ ...f, statut: undefined }))} />}
          {filtres.etape && !filtresAdresse && <PuceFiltre libelle={ETAPES_EDITORIALES[filtres.etape].libelle} onRetirer={() => setFiltres((f) => ({ ...f, etape: undefined }))} />}
          {filtres.ratio && <PuceFiltre libelle={filtres.ratio} onRetirer={() => setFiltres((f) => ({ ...f, ratio: undefined }))} />}
          {filtres.serie && <PuceFiltre libelle={series.find((s) => s.id === filtres.serie)?.nom ?? "Série"} onRetirer={() => setFiltres((f) => ({ ...f, serie: undefined }))} />}
          {nbClient > 0 && !filtresAdresse?.nombre && (
            <button type="button" onClick={toutEffacer} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-texte-doux hover:text-texte sm:min-h-9">
              Tout effacer
            </button>
          )}
        </div>
      )}

      {visibles.length ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibles.map((v, i) => (
            <li key={v.id}>
              <Apparition index={i}>
                {enSelection ? (
                  <CarteChoix video={v} ratio={ratioForce} choisi={choisis.has(v.id)} onBasculer={() => basculer(v.id)} />
                ) : (
                  <CarteVideo video={v} ratioForce={ratioForce} afficherFormat={afficherFormat} prioritaire={i < 4} />
                )}
                {/* Non terminée (brouillon, échec, annulée) : « Annuler cette vidéo » ; une prête, une en fabrication (arrêt d'abord, dans son suivi) ou une archivée n'ont pas ce bouton ici. */}
                {!enSelection && !archivees && !corbeille && (v.statut === "brouillon" || v.statut === "echec" || v.statut === "annulee") && !v.aVersionFinie && (
                  <div className="mt-1">
                    <BoutonAnnuler videoId={v.id} compact />
                  </div>
                )}
                {corbeille && v.corbeilleLe && <p className="mt-1 px-0.5 text-xs font-semibold text-brique">{phraseSuppressionDans(joursRestants(v.corbeilleLe))}</p>}
              </Apparition>
            </li>
          ))}
        </ul>
      ) : (
        <EtatVide
          compact
          icone="loupe"
          titre="Rien ne correspond"
          phrase="Essayez un autre mot ou retirez un filtre."
          action={
            <Bouton
              variante="secondaire"
              icone="fermer"
              onClick={() => {
                setQ("");
                toutEffacer();
              }}
            >
              Retirer les filtres
            </Bouton>
          }
        />
      )}

      {/* Barre flottante de la sélection */}
      <AnimatePresence>
        {enSelection && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 bottom-[calc(var(--hauteur-onglets-bas)+env(safe-area-inset-bottom)+12px)] z-40 mx-auto flex max-w-xl items-center gap-2 rounded-full border border-trait bg-surface-2 p-2 pl-5 shadow-carte lg:bottom-6"
          >
            <span className="flex-1 text-sm font-semibold tabular-nums text-texte">{choisis.size ? `${choisis.size} choisie${choisis.size > 1 ? "s" : ""}` : "Touchez des vidéos"}</span>
            {!archivees && !corbeille && (
              <Bouton variante="secondaire" icone="telecharger" disabled={!choisis.size} onClick={() => telecharger(Array.from(choisis))} aria-label="Télécharger la sélection">
                <span className="hidden sm:inline">Télécharger</span>
              </Bouton>
            )}
            {corbeille ? (
              <>
                <Bouton variante="principal" icone="archive" disabled={!choisis.size} chargement={enCours} onClick={() => restaurer(Array.from(choisis))}>
                  {LIBELLES_RETRAIT.retour}
                </Bouton>
                <Bouton variante="danger" icone="corbeille" disabled={!choisis.size} chargement={enCours} onClick={() => supprimer(Array.from(choisis))} aria-label="Supprimer définitivement la sélection">
                  <span className="hidden sm:inline">Supprimer définitivement</span>
                </Bouton>
              </>
            ) : (
              <>
                <Bouton variante={archivees ? "principal" : "secondaire"} icone="archive" disabled={!choisis.size} chargement={enCours} onClick={() => archiver(Array.from(choisis))}>
                  {archivees ? LIBELLES_RETRAIT.retour : LIBELLES_RETRAIT.action}
                </Bouton>
                <Bouton variante="danger" icone="corbeille" disabled={!choisis.size} chargement={enCours} onClick={() => mettreALaCorbeille(Array.from(choisis))} aria-label="Mettre la sélection à la corbeille">
                  <span className="hidden sm:inline">Mettre à la corbeille</span>
                </Bouton>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feuille des filtres */}
      <FeuilleBas
        ouverte={feuille}
        onOuverteChange={setFeuille}
        titre="Filtres"
        pied={
          <div className="flex gap-2">
            <Bouton variante="fantome" onClick={toutEffacer} disabled={!nbFiltres}>
              Effacer
            </Bouton>
            <Bouton pleineLargeur taille="lg" onClick={() => setFeuille(false)}>
              {pluriel(visibles.length, "vidéo")}
            </Bouton>
          </div>
        }
      >
        <div className="space-y-6 pt-2">
          {filtresAdresse?.contenu}
          {presents.statuts.length > 1 && (
            <SelecteurPastilles<Statut>
              libelle="État"
              valeur={filtres.statut}
              onChange={(v) => setFiltres((f) => ({ ...f, statut: f.statut === v ? undefined : v }))}
              options={presents.statuts.map((s) => ({ valeur: s.valeur, libelle: s.libelle, icone: s.icone }))}
            />
          )}
          {presents.etapes.length > 0 && !filtresAdresse && (
            <SelecteurPastilles<EtapeEditoriale>
              libelle="Publication"
              valeur={filtres.etape}
              onChange={(v) => setFiltres((f) => ({ ...f, etape: f.etape === v ? undefined : v }))}
              options={presents.etapes.map((e) => ({ valeur: e, libelle: ETAPES_EDITORIALES[e].libelle, icone: ETAPES_EDITORIALES[e].icone }))}
            />
          )}
          {presents.ratios.length > 1 && (
            <SelecteurPastilles<Ratio>
              libelle="Format d'image"
              valeur={filtres.ratio}
              onChange={(v) => setFiltres((f) => ({ ...f, ratio: f.ratio === v ? undefined : v }))}
              options={presents.ratios.map((r) => ({ valeur: r, libelle: r, visuel: <FormeRatio ratio={r} /> }))}
            />
          )}
          {presents.series.length > 0 && (
            <SelecteurPastilles<string>
              libelle="Série"
              valeur={filtres.serie}
              onChange={(v) => setFiltres((f) => ({ ...f, serie: f.serie === v ? undefined : v }))}
              options={presents.series.map((s) => ({ valeur: s.id, libelle: s.nom, icone: "calques" }))}
            />
          )}
        </div>
      </FeuilleBas>
    </div>
  );
}

function PuceFiltre({ libelle, onRetirer }: { libelle: string; onRetirer: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetirer}
      aria-label={`Retirer le filtre ${libelle}`}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-texte bg-texte pl-3.5 pr-2.5 text-sm font-semibold text-fond sm:min-h-9"
    >
      {libelle}
      <Icone nom="fermer" size={14} />
    </button>
  );
}

/** Carte en mode sélection : la vignette devient une case à cocher géante. */
function CarteChoix({ video: v, ratio, choisi, onBasculer }: { video: VueVideoCarte; ratio: Ratio; choisi: boolean; onBasculer: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={choisi} onClick={onBasculer} className="group block w-full text-left">
      <div className={cn("rounded-carte ring-2 ring-offset-2 ring-offset-fond transition-[box-shadow] duration-200", choisi ? "ring-orange" : "ring-transparent")}>
        <VignetteVideo
          src={v.vignette}
          titre={v.titre}
          ratio={ratio}
          ratioImage={v.ratioVignette ?? v.ratioPrincipal}
          dureeSec={v.statut === "prete" ? v.dureeSec : undefined}
          dureeEnviron={v.dureeEstimee}
          className={cn("transition-opacity", choisi ? "opacity-100" : "opacity-80")}
          coin={
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full border-2 transition-colors",
                choisi ? "border-orange bg-orange text-sur-orange" : "border-texte/70 bg-fond/50 text-transparent backdrop-blur",
              )}
            >
              <Icone nom="coche" size={15} strokeWidth={3} />
            </span>
          }
        />
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-texte">{v.titre}</p>
        <div className="mt-1">{v.statut === "prete" && v.etapeEditoriale ? <PastilleEtat type="editorial" statut={v.etapeEditoriale} /> : <PastilleEtat type="video" statut={v.statut} />}</div>
      </div>
    </button>
  );
}
