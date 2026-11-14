"use client";

/**
 * Aperçu de la publication sur place (RC-36) : un clic sur une carte de la semaine ouvre ce panneau à droite, sans
 * quitter le calendrier. Il montre le rendu du réseau (texte, visuel ou lecteur vidéo, hashtags, premier commentaire),
 * le format, la date et l'heure de Paris, l'état et la campagne d'origine. Les flèches passent à la suivante ; la date
 * changée ici se voit aussitôt dans la grille. Rien n'est publié d'ici : le décalage est l'action de L4-06.
 * Disposition, mots et couleurs : la maquette validée (docs/maquettes/calendrier/calendrier-du-studio.html).
 */
import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { decalerEntree } from "@/app/(studio)/calendrier/actions/decaler";
import { Icone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import { plageSemaine } from "@/lib/calendrier-plages";
import { RESEAUX_CALENDRIER } from "./BarreFiltres";
import { MonogrammeReseau, TYPES_CONTENU, trierEntrees, heureLisible, jourLisible, reseauConnu, styleReseau, type EntreeCarte } from "./CarteEntreeCalendrier";
import { GrilleSemaine } from "./GrilleSemaine";
import { PHRASES_VERROU, lireCleFiche, verrouFiche } from "./FicheEntree";
import { LIBELLES_ENVOI, PHRASE_DEPUIS_LA_VIDEO, apercuReseau, deplacerEntree, entreeVoisine, extraireHashtags, type EntreeApercu } from "./apercu-reseau";
import { PastilleStatutPlan } from "./PastilleStatutPlan";
import { PretAPartir } from "./PretAPartir";
import type { CodeControle } from "@/services/pret-a-partir";
import { BlocMotsCommentaires, type MotsPublication } from "./BlocMotsCommentaires";
import { accepteReponseAutomatique, nomReponseALaMain } from "@/domaine/calendrier/reponses-auto";
import { TiroirAccessible } from "./TiroirAccessible";
import { filtrerEntrees, type CriteresFiltre } from "@/domaine/calendrier/regroupement";
import type { IdReseau } from "@/domaine/types";

export interface ProprietesApercuPublication {
  /** L'entrée à montrer ; absente (panneau fermé ou entrée disparue) : rien n'est rendu. */
  entree: EntreeApercu;
  /** Jour de Paris d'aujourd'hui (AAAA-MM-JJ), fourni par l'appelant. */
  aujourdhui: string;
  onPrecedente: () => void;
  onSuivante: () => void;
  onFermer: () => void;
  /** Un nouveau jour (AAAA-MM-JJ) a été choisi dans le champ. */
  onChangerDate: (jour: string) => void;
  /** Phrase sous le champ de date : un refus, ou une précision. */
  message?: string | null;
  tonMessage?: "alerte" | "info";
  /** Mot-clé, guide et commentaires (RC-38), fournis par l'appelant ; montrés seulement sur Instagram et Facebook (CAL-04). */
  mots?: MotsPublication | null;
}

/**
 * « Prêt à partir ? » d'une entrée, à partir de ce qu'elle porte déjà (réseau, texte, hashtags du texte, date, type, premier
 * commentaire s'il est connu). Le fichier décrit et le mot ne sont pas dans ces données : « à vérifier à la main », jamais inventés.
 */
function pretAPartirDe(entree: EntreeApercu) {
  const instant = jourLisible(entree.jour) ? `${entree.jour}T${heureLisible(entree.heure) ?? "00:00"}` : null;
  const averifier: CodeControle[] = ["fichier"];
  const commentaireConnu = typeof entree.premierCommentaire === "string" && entree.premierCommentaire.trim() !== "";
  if (!commentaireConnu) averifier.push("premier-commentaire");
  if (accepteReponseAutomatique(entree.reseau)) averifier.push("mot");
  return {
    averifier,
    publications: [{ reseau: entree.reseau, texte: entree.texte, hashtags: extraireHashtags(entree.texte ?? ""), premierCommentaire: entree.premierCommentaire, instant, typeContenu: entree.type }],
  };
}

const CHAMP_DE_SAISIE = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const BOUTON = "min-h-[38px] rounded-[10px] border border-trait-fort bg-surface-2 px-3 py-1.5 text-sm font-bold text-texte hover:bg-surface-3";

/** Le panneau : sans état propre, tout vient de l'appelant. */
export function ApercuPublication({ entree, aujourdhui, onPrecedente, onSuivante, onFermer, onChangerDate, message, tonMessage = "alerte", mots }: ProprietesApercuPublication): ReactNode {
  if (!entree) return null;
  const a = apercuReseau(entree, aujourdhui);
  const type = TYPES_CONTENU[entree.type] ?? TYPES_CONTENU.video;
  const nom = a.nomReseau;

  const surTouche = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onFermer();
      return;
    }
    if (CHAMP_DE_SAISIE.has((e.target as HTMLElement | null)?.tagName ?? "")) return;
    if (e.key === "ArrowRight") onSuivante();
    else if (e.key === "ArrowLeft") onPrecedente();
  };

  const visuel = (
    <div className="relative my-2 grid min-h-[160px] place-items-center overflow-hidden rounded-[10px] border border-trait bg-surface-3 text-center text-sm font-bold text-texte-doux">
      {a.media.genre === "video" && a.media.url ? (
        <video controls preload="metadata" poster={a.media.poster ?? undefined} src={a.media.url} className="max-h-[60vh] w-full bg-voile">
          <track kind="captions" />
        </video>
      ) : a.media.genre === "image" && a.media.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- adresse libre d'un visuel du Studio, montrée entière
        <img src={a.media.url} alt={`Visuel de la publication ${nom}`} className="max-h-[60vh] w-full object-contain" />
      ) : (
        <span>Visuel à venir</span>
      )}
      {a.disposition === "legende-sur-media" && a.texte && <p className="absolute inset-x-0 bottom-0 whitespace-pre-line bg-voile p-3 text-left text-sm font-semibold text-sur-orange">{a.texte}</p>}
    </div>
  );
  const texte = (
    <p className="my-2 whitespace-pre-line text-sm text-texte">{a.texte || "Texte à écrire."}</p>
  );

  return (
    <TiroirAccessible aria-label={`Aperçu de la publication ${nom}, ${a.dateDite}`} data-apercu={entree.cle} data-reseau={entree.reseau} style={styleReseau(entree.reseau)} onFermer={onFermer}>
    <aside onKeyDown={surTouche}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onPrecedente} className={BOUTON}>
          <Icone nom="chevron-gauche" size={14} /> Précédente
        </button>
        <button type="button" onClick={onSuivante} className={BOUTON}>
          Suivante <Icone nom="chevron-droite" size={14} />
        </button>
        <button type="button" onClick={onFermer} autoFocus className={cn(BOUTON, "ml-auto")}>
          Fermer
        </button>
      </div>

      <h2 className="mt-3 flex items-center gap-2 font-titre text-lg text-texte">
        {reseauConnu(entree.reseau) && <MonogrammeReseau reseau={entree.reseau} />}
        {nom} · {type.libelle}
      </h2>
      <p className="text-xs text-texte-faible">{a.dateDite}</p>
      <p className="mt-1 text-xs text-texte-faible">Format : {a.formatLibelle}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] bg-surface-1 p-2 text-sm font-bold text-texte">
        <PastilleStatutPlan etat={entree.etat} libelles={LIBELLES_ENVOI} />
        <span>{a.phraseEtat}</span>
      </div>
      {entree.message && <p className="mt-2 rounded-[10px] bg-surface-1 p-2 text-sm font-bold text-texte">{entree.message}</p>}
      {a.campagne && <p className="mt-2 text-xs text-texte-doux">Campagne d&apos;origine : {a.campagne}</p>}

      <section data-disposition={a.disposition} aria-label={`Rendu sur ${nom}`} className="mt-2">
        {a.disposition === "texte-dessus" && (
          <>
            {texte}
            {visuel}
          </>
        )}
        {a.disposition === "media-dessus" && (
          <>
            {visuel}
            {texte}
          </>
        )}
        {a.disposition === "legende-sur-media" && visuel}
      </section>

      {a.hashtags.length > 0 && (
        <p className="text-sm text-texte-doux">
          <span className="font-bold text-texte">Hashtags</span> : {a.hashtags.join(" ")}
        </p>
      )}

      <div className="mt-3 text-sm">
        <p className="font-bold text-texte">Premier commentaire</p>
        <p className="text-texte-doux">{a.premierCommentaire ?? a.phrasePremierCommentaire}</p>
      </div>

      {accepteReponseAutomatique(entree.reseau) ? (
        <BlocMotsCommentaires reseau={entree.reseau} mots={mots} />
      ) : (
        nomReponseALaMain(entree.reseau) && (
          <section aria-label="Réponses aux commentaires" className="mt-2 text-sm text-texte-doux">
            <p>
              Réponses aux commentaires : toujours à la main sur {nomReponseALaMain(entree.reseau)}.{" "}
              <Link href="/a-traiter" className="font-bold text-texte underline">
                À traiter
              </Link>
            </p>
          </section>
        )
      )}

      <div className="mt-3">
        <PretAPartir {...pretAPartirDe(entree)} />
      </div>

      <div className="mt-3">
        <label htmlFor="apercu-date" className="text-sm font-bold text-texte">
          Déplacer au
        </label>
        <input
          id="apercu-date"
          type="date"
          value={entree.jour}
          min={aujourdhui}
          disabled={a.verrou !== null || !a.deplacable}
          onChange={(e) => {
            if (e.target.value) onChangerDate(e.target.value);
          }}
          className="mt-1 block w-full rounded-[9px] border border-trait-fort bg-surface-2 p-2 text-sm text-texte disabled:opacity-60"
        />
        <p className="mt-1 text-xs text-texte-faible">{a.phraseVerrou ?? "L'heure ne change pas."}</p>
        {message && (
          <p role={tonMessage === "alerte" ? "alert" : "status"} className="mt-2 rounded-[10px] bg-surface-1 p-2 text-sm font-bold text-texte">{message}</p>
        )}
      </div>

      {entree.lienSource && (
        <Link href={entree.lienSource} className="mt-4 inline-flex min-h-[38px] items-center rounded-[10px] border border-trait-fort px-3 text-sm font-bold text-texte hover:bg-surface-3">
          Ouvrir la vidéo
        </Link>
      )}
    </aside>
    </TiroirAccessible>
  );
}

/* ------------------------------------------------------------------ */

export type DecalerLeJour = (saisie: { id: string; nouveauJour: string; raison: string; cle: string }) => Promise<{ ok: true; donnees: unknown } | { ok: false; message: string }>;

export interface ProprietesSemaineAvecApercu {
  entrees: readonly EntreeApercu[];
  /** N'importe quel jour de Paris de la semaine à montrer. */
  semaineDu: string;
  /** Jour de Paris d'aujourd'hui (AAAA-MM-JJ). */
  aujourdhui: string;
  /** Action de décalage de L4-06 (doublure en test). */
  decaler?: DecalerLeJour;
  /** Filtres du calendrier (CAL-12) : la grille et les flèches Précédente / Suivante ne parcourent que les entrées gardées. Absent : toutes. */
  criteres?: CriteresFiltre;
}

const RAISON = "Déplacée depuis l'aperçu du calendrier";
const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** La semaine en couloirs et son panneau d'aperçu : un clic ouvre, les flèches passent, la date se voit aussitôt. */
export function SemaineAvecApercu({ entrees, semaineDu, aujourdhui, decaler = decalerEntree as DecalerLeJour, criteres }: ProprietesSemaineAvecApercu): ReactNode {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [deplacements, setDeplacements] = useState<Readonly<Record<string, string>>>({});
  const [retour, setRetour] = useState<{ texte: string; ton: "alerte" | "info" } | null>(null);
  const enCours = useRef(false);

  // Les jours changés ici s'appliquent par-dessus les données reçues : un nouvel envoi de la page ne les écrase pas.
  const liste = useMemo(() => entrees.reduce<readonly EntreeApercu[]>((acc, e) => (deplacements[e.cle] ? deplacerEntree(acc, e.cle, deplacements[e.cle]) : acc), entrees), [entrees, deplacements]);
  // La liste filtrée : c'est elle que montre la grille et que parcourent les flèches.
  const visibles = useMemo(() => (criteres ? filtrerEntrees(liste, criteres) : liste), [liste, criteres]);
  const courante = ouverte ? liste.find((e) => e.cle === ouverte) : undefined;
  // Un réseau hors des quatre du calendrier garde son couloir : rien n'est caché.
  const reseaux: IdReseau[] = [...RESEAUX_CALENDRIER, ...Array.from(new Set(liste.map((e) => e.reseau))).filter((r) => !RESEAUX_CALENDRIER.includes(r))];

  const ouvrir = (carte: EntreeCarte) => {
    if (!liste.some((e) => e.cle === carte.cle)) return;
    setOuverte(carte.cle);
    setRetour(null);
  };
  const aller = (sens: 1 | -1) => {
    if (!ouverte) return;
    // Une entrée ouverte que le filtre masque : on repart du début (ou de la fin) de la liste filtrée.
    const voisine = entreeVoisine(visibles, ouverte, sens) ?? (sens === 1 ? trierEntrees(visibles)[0] : trierEntrees(visibles).at(-1));
    if (voisine) {
      setOuverte(voisine.cle);
      setRetour(null);
    }
  };
  const refuser = (texte: string) => setRetour({ texte, ton: "alerte" });

  async function changerDate(jour: string) {
    if (!courante || !jourLisible(jour) || jour === courante.jour) return;
    const verrou = verrouFiche(courante, aujourdhui);
    if (verrou) return refuser(PHRASES_VERROU[verrou]);
    if (jour < aujourdhui) return refuser("Impossible : ce jour est passé.");
    const cle = lireCleFiche(courante.cle);
    if (!cle || cle.origine !== "creneau") return refuser(PHRASE_DEPUIS_LA_VIDEO);
    if (enCours.current) return;
    enCours.current = true;
    const avant = deplacements[courante.cle];
    const revenir = () =>
      setDeplacements((d) => Object.fromEntries([...Object.entries(d).filter(([k]) => k !== courante.cle), ...(avant ? [[courante.cle, avant]] : [])]));
    setDeplacements((d) => ({ ...d, [courante.cle]: jour }));
    setRetour(null);
    try {
      const r = await decaler({ id: cle.id, nouveauJour: jour, raison: RAISON, cle: crypto.randomUUID() });
      if (!r.ok) {
        revenir();
        refuser(r.message);
      } else if (!plageSemaine(semaineDu).jours.includes(jour)) {
        setRetour({ texte: `Déplacée au ${JOUR_COURT.format(new Date(`${jour}T12:00:00Z`))}, dans une autre semaine : elle n'est plus dans cette grille.`, ton: "info" });
      }
    } catch {
      revenir();
      refuser("Le changement de date n'a pas pu être fait. Réessayez.");
    } finally {
      enCours.current = false;
    }
  }

  return (
    <>
      <GrilleSemaine semaineDu={semaineDu} aujourdhui={aujourdhui} entrees={visibles} reseaux={reseaux} libellesEtat={LIBELLES_ENVOI} onOuvrirEntree={ouvrir} />
      {courante && (
        <ApercuPublication
          entree={courante}
          aujourdhui={aujourdhui}
          onPrecedente={() => aller(-1)}
          onSuivante={() => aller(1)}
          onFermer={() => setOuverte(null)}
          onChangerDate={(j) => void changerDate(j)}
          message={retour?.texte ?? null}
          tonMessage={retour?.ton}
        />
      )}
    </>
  );
}
