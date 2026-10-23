"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { appliquerSousTitresAction, corrigerMotAction } from "@/app/(studio)/videos/actions";
import { FeuilleAjoutPrononciation } from "@/components/prononciations/FeuilleAjoutPrononciation";
import { plansDuMot, RefairePhrase, type PlanPhrase } from "@/components/prononciations/RefairePhrase";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { EtatVide } from "@/components/ui/EtatVide";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import type { SegmentSousTitres } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { chrono } from "@/lib/dates";
import { allerAuTemps, groupeA, useTempsLecture } from "../tempsLecture";

/** Le mot sans la ponctuation collée par les sous-titres (« PV ? » → « PV »). */
function motSeul(mot: string): string {
  return mot.replace(/^[«\s\u00a0"“]+|[\s\u00a0?!:;,.…»"”]+$/g, "");
}

/**
 * Sous-titres sous la vidéo (AV2.3-3 ; lot M3, B.9) : la liste des groupes est SYNCHRONISÉE au lecteur (groupe en cours
 * surligné, toucher l'heure d'un groupe y amène la lecture) ; toucher un mot pour le corriger (une NOUVELLE version des
 * sous-titres, l'ancienne est gardée). « Appliquer à la vidéo » n'apparaît que si le moteur de la vidéo sait recomposer
 * les sous-titres sans rien repayer (`recalquer`, lot M4). Export .srt / .vtt.
 * « Mal prononcé ? » (lot A1, prononciations n° 3) : depuis un mot touché, l'ajouter à la liste des prononciations en
 * un geste, puis refaire la phrase seule (retouche des plans qui contiennent le mot, coût affiché avant).
 */
export function OngletSousTitres({
  videoId,
  segments: initiaux,
  liens,
  recalquePossible = false,
  correctionEnAttente = false,
  plans = [],
}: {
  videoId: string;
  segments: SegmentSousTitres[] | null;
  /** L0d : `parReseau` (cas concret) : un .srt / .vtt par réseau, chacun avec SA fin. */
  liens: { srt: string; vtt: string; parReseau?: { reseau: string; nom: string; srt: string; vtt: string }[] } | null;
  /** Le moteur de la version sait recomposer les sous-titres (gratuit). */
  recalquePossible?: boolean;
  /** Une correction est enregistrée mais pas encore dans la vidéo (lot M4). */
  correctionEnAttente?: boolean;
  /** Plans de la version (« Mal prononcé ? » : refaire seulement la phrase du mot). */
  plans?: PlanPhrase[];
}) {
  const router = useRouter();
  const [segments, setSegments] = useState(initiaux ?? []);
  const [cible, setCible] = useState<{ segmentId: string; index: number; mot: string; debutSec: number } | null>(null);
  const [malDit, setMalDit] = useState<{ mot: string; debutSec: number } | null>(null);
  const [ajoute, setAjoute] = useState<{ mot: string; prononciation: string; debutSec: number } | null>(null);
  const [saisie, setSaisie] = useState("");
  const [corriges, setCorriges] = useState(0);
  const [enCours, demarrer] = useTransition();
  const [application, demarrerApplication] = useTransition();
  const [appliquee, setAppliquee] = useState(false);
  const t = useTempsLecture();
  const courant = groupeA(segments, t);
  const liste = useRef<HTMLOListElement>(null);
  // Tabulation itinérante : un seul mot est atteignable par Tab, les flèches gauche/droite passent d'un mot à l'autre
  // (au lieu d'un arrêt par mot, soit des centaines).
  const [arret, setArret] = useState({ n: 0, i: 0 });
  const arretValide = segments[arret.n]?.mots[arret.i] ? arret : { n: segments.findIndex((s) => s.mots.length > 0), i: 0 };

  // Le groupe en cours reste visible dans la liste (défilement de la liste seulement, jamais de la page).
  useEffect(() => {
    const ol = liste.current;
    const li = courant >= 0 ? (ol?.children[courant] as HTMLElement | undefined) : undefined;
    if (!ol || !li) return;
    const haut = li.offsetTop - ol.offsetTop;
    if (haut < ol.scrollTop || haut + li.offsetHeight > ol.scrollTop + ol.clientHeight) ol.scrollTo({ top: haut - ol.clientHeight / 3, behavior: "smooth" });
  }, [courant]);

  if (!initiaux?.length) return <EtatVide compact icone="sous-titres" titre="Pas de sous-titres" phrase="Ils arrivent avec la vidéo." />;

  function enregistrer() {
    if (!cible) return;
    const mot = saisie.trim();
    const { segmentId, index } = cible;
    demarrer(async () => {
      const r = await corrigerMotAction(videoId, segmentId, index, mot);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      setSegments((l) => l.map((s) => (s.id === segmentId ? { ...s, mots: s.mots.map((m, i) => (i === index ? { ...m, mot } : m)) } : s)));
      setCorriges((n) => n + 1);
      notifier.succes("Mot corrigé");
      setCible(null);
      router.refresh();
    });
  }

  /** Flèches gauche/droite, Début/Fin : déplace le focus d'un mot à l'autre, d'un groupe au suivant. */
  function naviguerMots(e: KeyboardEvent<HTMLButtonElement>, n: number, i: number) {
    const tous = segments.flatMap((s, sn) => s.mots.map((_, si) => ({ n: sn, i: si })));
    const pos = tous.findIndex((p) => p.n === n && p.i === i);
    const suivant =
      e.key === "ArrowRight" ? tous[Math.min(pos + 1, tous.length - 1)] : e.key === "ArrowLeft" ? tous[Math.max(pos - 1, 0)] : e.key === "Home" ? tous[0] : e.key === "End" ? tous[tous.length - 1] : null;
    if (!suivant) return;
    e.preventDefault();
    setArret(suivant);
    liste.current?.querySelector<HTMLButtonElement>(`[data-mot="${suivant.n}-${suivant.i}"]`)?.focus();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <p className="flex flex-1 items-center gap-2 text-sm text-texte-doux">
          <Icone nom="curseurs" size={15} className="text-orange-vif" />
          Touchez un mot pour le corriger.
        </p>
        {liens && (
          <>
            <a href={liens.srt} download className="inline-flex min-h-11 items-center rounded-full border border-trait bg-surface-2 px-3 text-xs font-bold text-texte hover:border-trait-fort">
              .srt
            </a>
            <a href={liens.vtt} download className="inline-flex min-h-11 items-center rounded-full border border-trait bg-surface-2 px-3 text-xs font-bold text-texte hover:border-trait-fort">
              .vtt
            </a>
          </>
        )}
      </div>
      {!!liens?.parReseau?.length && (
        <ul aria-label="Sous-titres par réseau" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-texte-doux">
          {liens.parReseau.map((l) => (
            <li key={l.reseau} className="flex items-center gap-1">
              <span className="font-bold text-texte">{l.nom}</span>
              <a href={l.srt} download className="inline-flex min-h-11 items-center rounded-full border border-trait bg-surface-2 px-3 font-bold text-texte hover:border-trait-fort">
                .srt
              </a>
              <a href={l.vtt} download className="inline-flex min-h-11 items-center rounded-full border border-trait bg-surface-2 px-3 font-bold text-texte hover:border-trait-fort">
                .vtt
              </a>
            </li>
          ))}
        </ul>
      )}
      <ol ref={liste} aria-label="Sous-titres" className="relative max-h-[50vh] divide-y divide-trait overflow-y-auto overscroll-contain rounded-carte border border-trait bg-surface-1">
        {segments.map((s, n) => {
          const actif = n === courant;
          return (
            <li key={s.id} aria-current={actif || undefined} className={cn("flex items-start gap-2 px-2 py-1.5 transition-colors", actif && "bg-orange-doux")}>
              <button
                type="button"
                onClick={() => allerAuTemps(s.debutSec)}
                aria-label={`Lire à ${chrono(s.debutSec)}`}
                className={cn("min-h-11 w-12 shrink-0 rounded-lg text-[11px] tabular-nums transition-colors hover:bg-surface-2", actif ? "font-bold text-orange-vif" : "text-texte-faible")}
              >
                {chrono(s.debutSec)}
              </button>
              <p className="flex flex-1 flex-wrap gap-x-0.5">
                {s.mots.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    data-mot={`${n}-${i}`}
                    tabIndex={arretValide.n === n && arretValide.i === i ? 0 : -1}
                    onFocus={() => setArret({ n, i })}
                    onKeyDown={(e) => naviguerMots(e, n, i)}
                    onClick={() => {
                      setCible({ segmentId: s.id, index: i, mot: m.mot, debutSec: m.debutSec });
                      setSaisie(m.mot);
                    }}
                    className={cn(
                      "min-h-11 rounded-lg px-1.5 text-[16px] transition-colors hover:bg-surface-2",
                      m.enValeur ? "font-bold text-orange-vif" : "text-texte",
                      actif && t >= m.debutSec && t < m.finSec && "underline decoration-orange-vif decoration-2 underline-offset-4",
                      cible?.segmentId === s.id && cible.index === i && "bg-orange-doux",
                    )}
                  >
                    {m.mot}
                  </button>
                ))}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Le moteur ne sait pas refaire l'image : le dire, sans rien proposer d'impossible (E2E-1 n° 10). */}
      {!recalquePossible && (corriges > 0 || correctionEnAttente) && (
        <p className="mt-3 flex items-start gap-2 rounded-carte border border-trait bg-surface-2 p-3 text-sm text-texte-doux">
          <Icone nom="info" size={15} className="mt-0.5 shrink-0 text-texte-faible" />
          La vidéo garde l&apos;ancien mot. Les fichiers de sous-titres (.srt, .vtt) sont corrigés.
        </p>
      )}

      {recalquePossible && !appliquee && (corriges > 0 || correctionEnAttente) && (
        <div className="mt-3 rounded-carte border border-orange/30 bg-surface-1 p-3">
          <p className="mb-2 text-sm text-texte-doux">La vidéo garde l&apos;ancien mot tant que vous n&apos;appliquez pas la correction.</p>
          <Bouton
            icone="coche"
            pleineLargeur
            chargement={application}
            onClick={() =>
              demarrerApplication(async () => {
                const r = await appliquerSousTitresAction(videoId);
                if (!r.ok) return void notifier.erreur(r.message);
                setAppliquee(true);
                notifier.succes("Correction en cours dans la vidéo, sans frais");
                router.refresh();
              })
            }
          >
            Appliquer à la vidéo · gratuit
          </Bouton>
        </div>
      )}

      {ajoute && (
        <div className="mt-3 rounded-carte border border-orange/30 bg-surface-1 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm text-texte-doux">
            <Icone nom="son" size={15} className="shrink-0 text-orange-vif" />
            <span>
              <span className="font-semibold text-texte">« {ajoute.mot} »</span> sera bien dit dans vos prochaines vidéos. Et dans celle-ci ?
            </span>
          </p>
          <RefairePhrase videoId={videoId} plans={plansDuMot(plans, ajoute.mot, ajoute.debutSec)} mot={ajoute.mot} prononciation={ajoute.prononciation} />
        </div>
      )}

      <FeuilleAjoutPrononciation
        ouverte={!!malDit}
        onOuverteChange={(o) => !o && setMalDit(null)}
        initial={malDit ? { mot: malDit.mot } : undefined}
        source="video"
        onEnregistree={(r) => malDit && setAjoute({ mot: r.mot, prononciation: r.prononciation, debutSec: malDit.debutSec })}
      />

      <FeuilleBas
        ouverte={!!cible}
        onOuverteChange={(o) => !o && setCible(null)}
        titre="Corriger le mot"
        description={cible ? `« ${cible.mot} »` : undefined}
        pied={
          <Bouton taille="lg" pleineLargeur icone="coche" chargement={enCours} disabled={!saisie.trim() || saisie.trim() === cible?.mot} onClick={enregistrer}>
            Corriger
          </Bouton>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enregistrer();
          }}
        >
          <Champ libelle="Mot" libelleMasque grand autoFocus value={saisie} onChange={(e) => setSaisie(e.target.value)} maxLength={40} />
        </form>
        <button
          type="button"
          onClick={() => {
            if (!cible) return;
            setMalDit({ mot: motSeul(cible.mot), debutSec: cible.debutSec });
            setCible(null);
          }}
          className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-carte border border-trait bg-surface-2 px-3 text-left transition-colors hover:border-orange"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif">
            <Icone nom="son" size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-texte">Mal prononcé ?</span>
            <span className="block truncate text-xs text-texte-faible">Apprendre à la voix à le dire</span>
          </span>
          <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
        </button>
      </FeuilleBas>
    </div>
  );
}
