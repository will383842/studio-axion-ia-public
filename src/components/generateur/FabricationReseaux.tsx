"use client";

/**
 * FABRICATION PAR RÉSEAU sur la fiche sujet (générateur G6, G6b ; plan v5 B.6.6, B.8.10). Mobile d'abord (390 px) :
 *  - « Fabriquer les N » : la plus longue d'abord (la vidéo mère), les autres reprennent son milieu ; un prix par
 *    version, le total, Vertical toujours + 4:5 et Carré en option ; un identifiant d'opération par ouverture de la
 *    feuille (double toucher sans double vidéo) ;
 *  - l'état d'une version : attend la mère, raccord visible (fabriquée en entier, coût affiché, à confirmer), durée
 *    réelle et points vus sur la vidéo ;
 *  - « 2e ouverture Reels » et « Monter ma prise » (0 €).
 */
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { fabriquerEnEntierAction, monterJeLisAction, planFabricationNAction, resumeDepenseAction, secondeOuvertureAction } from "@/app/(studio)/ecrire/sujets/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import type { Ratio, ReseauDeclinaison } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";

export interface PlanFabricationAffiche {
  /** Relecture finale : format des versions, pour que « rien n'est payé » se décide sur CE format seulement. */
  formatId?: string;
  mere: { code: string; reseau: ReseauDeclinaison; dureeSec: number };
  versions: { varianteId: string; code: string; reseau: ReseauDeclinaison; role: "mere" | "variante"; prix: string; dejaVideo: boolean }[];
  total: string;
  /** E2E-1 n° 5 : total en centimes (total du jour et budget restant lus à l'ouverture de la feuille). */
  totalCentimes?: number;
  sansDeclinaison: string;
  surMere: boolean;
  /** E2E-1 n° 24 : double simulé, rien ne sera payé (pastille ESSAI sur chaque montant). */
  essai?: boolean;
  /** Lot R7e : « Votre avatar parle dans ces vidéos : environ … » (le lancement vaut confirmation : la feuille le dit). */
  avatarParle?: string;
}

type ResumeDepense = { prix: string; jourAvant: string; jourApres: string; budgetRestant: string; credits: { nom: string; disponible: string }[]; essai: boolean; messageEssai?: string; auDelaDuRepere: boolean; budgetInsuffisant?: boolean };

export interface EtatFabricationAffiche {
  videoId: string;
  attendMere: boolean;
  attendConfirmation: boolean;
  /** E2E-1 n° 2 : la mère est prête, la version attend du crédit (elle partira d’elle-même après la recharge). */
  attendCredit?: boolean;
  /** E2E-2 parcours n° 1 : pourquoi elle attend et ce qui la fera partir (`etatFabricationSujet().raisonAttente`). */
  raisonAttente?: string;
  coutComplet?: string;
  /** Lot R7e : phrase « Votre avatar parle… » si « Fabriquer en entier » le fait parler. */
  avatarParle?: string;
  dureeReelleSec?: number;
  points: string[];
  enCours: boolean;
}

function duree(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

const OPTIONS_RATIO: { valeur: Ratio; libelle: string }[] = [
  { valeur: "4:5", libelle: "4:5" },
  { valeur: "1:1", libelle: "Carré" },
];

/** « Fabriquer les N » : carte, puis feuille de confirmation avec le prix de chaque version. */
export function CarteFabriquerLesN({ sujetId, plan }: { sujetId: string; plan: PlanFabricationAffiche }) {
  const [ouverte, setOuverte] = useState(false);
  const [ratios, setRatios] = useState<Ratio[]>([]);
  // E2E-1 n° 5 : prix recalculé quand un format est coché (chaque version le reçoit) ; total du jour et crédits.
  const [prixCoches, setPrixCoches] = useState<{ cle: string; versions: Record<string, string>; total: string; totalCentimes: number; sansDeclinaison: string; avatarParle?: string } | null>(null);
  const [resume, setResume] = useState<ResumeDepense | null>(null);
  const [calcul, setCalcul] = useState(false);
  const derniere = useRef(0);
  const cleRatios = [...ratios].sort().join(",");
  const prixAJour = prixCoches && prixCoches.cle === cleRatios ? prixCoches : null;
  const total = prixAJour?.total ?? plan.total;
  const avatarParle = prixAJour ? prixAJour.avatarParle : plan.avatarParle;
  const prixDe = (varianteId: string, prix: string) => prixAJour?.versions[varianteId] ?? prix;
  const essai = resume?.essai ?? !!plan.essai;
  const aFaire = plan.versions.filter((v) => !v.dejaVideo);
  const n = aFaire.length;
  const autres = plan.versions.filter((v) => v.role === "variante").length;

  async function chiffrer(choix: Ratio[]) {
    // Deux touchers rapprochés : seule la dernière réponse est affichée.
    const demande = ++derniere.current;
    setResume(null);
    setCalcul(true);
    try {
      let centimes = plan.totalCentimes;
      if (choix.length) {
        const r = await planFabricationNAction(sujetId, choix);
        if (demande !== derniere.current) return;
        if (r.ok && r.donnees) {
          setPrixCoches({ cle: [...choix].sort().join(","), versions: Object.fromEntries(r.donnees.versions.map((x) => [x.varianteId, x.prix])), total: r.donnees.total, totalCentimes: r.donnees.totalCentimes, sansDeclinaison: r.donnees.sansDeclinaison, avatarParle: r.donnees.avatarParle });
          centimes = r.donnees.totalCentimes;
        }
      }
      if (centimes !== undefined) {
        const d = await resumeDepenseAction(centimes, plan.formatId ? [plan.formatId] : undefined);
        if (demande !== derniere.current) return;
        setResume(d.ok ? d.donnees : null);
      }
    } finally {
      if (demande === derniere.current) setCalcul(false);
    }
  }

  function basculer(r: Ratio) {
    const suivants = ratios.includes(r) ? ratios.filter((x) => x !== r) : [...ratios, r];
    setRatios(suivants);
    void chiffrer(suivants);
  }

  return (
    <>
      <Carte className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange-doux text-orange-vif">
            <Icone nom="film" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold leading-snug text-texte">Fabriquer les {n}</p>
            <p className="text-sm text-texte-doux">
              {plan.surMere ? `${obtenirReseau(plan.mere.reseau).nom} d'abord (${duree(plan.mere.dureeSec)}), ${autres > 1 ? `les ${autres} autres reprennent` : "l'autre reprend"} son milieu.` : "Chaque vidéo est fabriquée en entier."}
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Vidéos à fabriquer">
          {aFaire.map((v) => (
            <li key={v.varianteId}>
              <LogoReseau reseau={v.reseau} />
            </li>
          ))}
        </ul>
        <Bouton
          pleineLargeur
          icone="film"
          essai={!!plan.essai}
          onClick={() => {
            setOuverte(true);
            void chiffrer(ratios);
          }}
        >
          Fabriquer les {n} · {plan.total}
        </Bouton>
      </Carte>
      <FeuilleBas
        ouverte={ouverte}
        onOuverteChange={setOuverte}
        titre={`Fabriquer les ${n}`}
        description={plan.surMere ? "Seuls le début et la fin de chaque réseau sont refaits." : undefined}
        pied={
          // La fabrication ne part qu'après « Relire le script » (repère « script relu » exigé par le serveur) : le
          // total confirmé là-bas est celui des formats cochés ici (CORRECTEUR 1 — B6).
          <Bouton asChild pleineLargeur taille="lg" icone="ecrire" essai={essai} disabled={calcul || !!resume?.budgetInsuffisant}>
            <Link aria-disabled={calcul || !!resume?.budgetInsuffisant} href={`/ecrire/sujets/${sujetId}/relire${ratios.length ? `?ratios=${encodeURIComponent([...ratios].sort().join(","))}` : ""}`}>
              Relire le script · {total}
            </Link>
          </Bouton>
        }
      >
        <ol className="space-y-2">
          {aFaire.map((v) => (
            <li key={v.varianteId} className="flex min-h-14 items-center gap-3 rounded-champ border border-trait bg-surface-2 px-3">
              <LogoReseau reseau={v.reseau} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-texte">{obtenirReseau(v.reseau).nom}</span>
                <span className="block text-xs text-texte-faible">{v.role === "mere" ? "Vidéo mère, en entier" : plan.surMere ? "Début et fin" : "En entier"}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums text-texte">
                ≈ {prixDe(v.varianteId, v.prix)}
                {essai && <PastilleEssai />}
              </span>
            </li>
          ))}
        </ol>
        {avatarParle && <p className="mt-3 text-sm font-semibold text-texte">{avatarParle}</p>}
        {plan.surMere && <p className="mt-3 text-center text-xs text-texte-faible">Chacune en entier : ≈ {prixAJour?.sansDeclinaison ?? plan.sansDeclinaison}</p>}
        <dl className="mt-4 space-y-1.5 rounded-champ bg-surface-2 p-3 text-sm" aria-busy={calcul}>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-texte-doux">Total</dt>
            <dd className="flex items-center gap-2 font-semibold tabular-nums text-texte">
              {calcul ? "calcul…" : total}
              {essai && <PastilleEssai />}
            </dd>
          </div>
          {resume && !calcul && (
            <>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-texte-doux">Aujourd&apos;hui</dt>
                <dd className="flex items-center gap-2 tabular-nums text-texte">
                  {resume.jourAvant} → {resume.jourApres}
                  {essai && <PastilleEssai />}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-texte-doux">Budget du mois restant</dt>
                <dd className="tabular-nums text-texte">{resume.budgetRestant}</dd>
              </div>
              {resume.credits.map((c) => (
                <div key={c.nom} className="flex items-center justify-between gap-2">
                  <dt className="text-texte-doux">Crédit {c.nom}</dt>
                  <dd className="tabular-nums text-texte">{c.disponible}</dd>
                </div>
              ))}
            </>
          )}
        </dl>
        {resume?.auDelaDuRepere && !calcul && <p className="mt-2 text-sm font-semibold text-ambre">Au-dessus de votre repère de confirmation.</p>}
        {resume?.budgetInsuffisant && !calcul && (
          <p className="mt-2 text-sm font-semibold text-ambre">
            Le budget du mois ne suffit pas pour ce lancement.{" "}
            <a href="/reglages#budget" className="underline">
              Augmenter le budget
            </a>
          </p>
        )}
        {/* E2E-2 argent n° 7 : la phrase dit exactement ce qui sera payé (jamais « rien » quand la voix l'est). */}
        {resume?.messageEssai && !calcul && <p className="mt-2 text-center text-xs text-texte-faible">{resume.messageEssai}</p>}
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Formats</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-orange bg-orange-doux px-4 text-sm font-semibold text-texte">
              <Icone nom="coche" size={14} className="text-orange-vif" />
              Vertical
            </span>
            {OPTIONS_RATIO.map((o) => {
              const actif = ratios.includes(o.valeur);
              return (
                <button
                  key={o.valeur}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => basculer(o.valeur)}
                  className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold", actif ? "border-2 border-orange bg-orange-doux text-texte" : "border-trait text-texte-doux")}
                >
                  {actif && <Icone nom="coche" size={14} className="text-orange-vif" />}
                  {o.libelle}
                </button>
              );
            })}
          </div>
        </div>
      </FeuilleBas>
    </>
  );
}

/** L'état de fabrication d'une version (dans son détail). */
export function EtatFabricationVersion({ sujetId, etat }: { sujetId: string; etat: EtatFabricationAffiche }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  if (etat.attendConfirmation) {
    return (
      <div className="space-y-2 rounded-champ border border-ambre/40 bg-ambre-doux p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-texte">
          <Icone nom="attention" size={14} className="text-ambre" />
          Raccord visible avec la vidéo mère
        </p>
        <p className="text-sm text-texte-doux">Cette version doit être fabriquée en entier.</p>
        {etat.avatarParle && <p className="text-sm font-semibold text-texte">{etat.avatarParle}</p>}
        <Bouton
          variante="secondaire"
          icone="film"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              let r = await fabriquerEnEntierAction(sujetId, etat.videoId);
              r = await avecConfirmationPrix(r, (accord) => fabriquerEnEntierAction(sujetId, etat.videoId, accord));
              if (!r.ok) notifier.erreur(r.message);
              else router.refresh();
            })
          }
        >
          Fabriquer en entier · ≈ {etat.coutComplet}
        </Bouton>
      </div>
    );
  }
  if (etat.attendMere) {
    return (
      <p className="flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm text-texte-doux">
        <Icone nom="horloge" size={14} />
        Attend la vidéo mère
      </p>
    );
  }
  if (etat.attendCredit) {
    return (
      <p className="flex min-h-11 items-center gap-2 rounded-champ bg-surface-2 px-4 py-2 text-sm text-texte-doux">
        <Icone nom="horloge" size={14} className="shrink-0" />
        {etat.raisonAttente ?? "Attend du crédit · partira d’elle-même"}
      </p>
    );
  }
  if (etat.enCours) {
    return (
      <p className="flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm text-texte-doux">
        <Icone nom="film" size={14} />
        En fabrication
      </p>
    );
  }
  if (etat.dureeReelleSec === undefined) return null;
  return (
    <div className="space-y-1.5 rounded-champ bg-surface-2 p-3 text-sm">
      <p className="flex items-center justify-between gap-2 text-texte">
        <span className="font-semibold">Sur la vidéo</span>
        <span className="tabular-nums text-texte-doux">{duree(etat.dureeReelleSec)}</span>
      </p>
      {etat.points.length ? (
        <ul className="space-y-1">
          {etat.points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[13px] text-ambre">
              <Icone nom="attention" size={13} className="mt-0.5 shrink-0" />
              {p}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-[13px] text-sauge">
          <Icone nom="coche" size={13} />
          Rien à signaler sur le temps réel
        </p>
      )}
    </div>
  );
}

/** « 2e ouverture Reels » (Instagram) : une autre accroche, même milieu, publiée à la main. */
export function BoutonSecondeOuverture({ sujetId, varianteId, prix, avatarParle }: { sujetId: string; varianteId: string; prix: string; avatarParle?: string }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [operation, setOperation] = useState("");
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <Bouton
        variante="secondaire"
        icone="repeter"
        onClick={() => {
          setOperation(`op-a2-${varianteId}-${Date.now().toString(36)}`);
          setOuverte(true);
        }}
      >
        2e ouverture · ≈ {prix}
      </Bouton>
      <FeuilleBas ouverte={ouverte} onOuverteChange={setOuverte} titre="2e ouverture Reels" description="La même vidéo avec une autre accroche, pour comparer sur Instagram. À publier à la main.">
        {avatarParle && <p className="mb-3 text-sm font-semibold text-texte">{avatarParle}</p>}
        <Bouton
          taille="lg"
          pleineLargeur
          icone="film"
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              let r = await secondeOuvertureAction(sujetId, varianteId, operation);
              r = await avecConfirmationPrix(r, (accord) => secondeOuvertureAction(sujetId, varianteId, operation, accord));
              if (!r.ok) {
                notifier.erreur(r.message);
                return;
              }
              setOuverte(false);
              router.refresh();
            })
          }
        >
          Lancer · ≈ {prix}
        </Bouton>
      </FeuilleBas>
    </>
  );
}

/**
 * « Monter ma prise » (« je lis ») : la prise filmée devient la vidéo, sous-titrée depuis le texte validé. E2E-2 parcours
 * n° 5 : le prix affiché est celui du lancement (`propositionsFabrication().prixMonter`), avec ESSAI s'il n'est pas payé.
 */
export function BoutonMonterPrise({ sujetId, varianteId, prix, essai }: { sujetId: string; varianteId: string; prix?: string; essai?: boolean }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <Bouton
      variante="secondaire"
      icone="ciseaux"
      essai={!!prix && !!essai}
      chargement={enCours}
      onClick={() =>
        demarrer(async () => {
          let r = await monterJeLisAction(sujetId, varianteId);
          r = await avecConfirmationPrix(r, (accord) => monterJeLisAction(sujetId, varianteId, accord));
          if (!r.ok) {
            notifier.erreur(r.message);
            return;
          }
          notifier.succes("Votre prise part au montage");
          router.refresh();
        })
      }
    >
      {prix ? `Monter ma prise · ≈ ${prix}` : "Monter ma prise"}
    </Bouton>
  );
}
