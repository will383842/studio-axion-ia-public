import type { ReactNode } from "react";
import { Icone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";

/** Silhouette commune des illustrations (tête + épaules). */
function Silhouette({ x = 80, y = 52, echelle = 1 }: { x?: number; y?: number; echelle?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${echelle})`}>
      <circle cx="0" cy="0" r="14" className="fill-texte-doux" />
      <path d="M-30 50 q0 -28 30 -28 q30 0 30 28 z" className="fill-texte-doux" />
    </g>
  );
}

type Carte = { titre: string; aide: string; dessin: ReactNode };

/** Guide « face à l'objectif » (selfie et autres formats où l'on regarde la caméra). */
const ILLUSTRATIONS_FACE: Carte[] = [
  {
    titre: "Face à la lumière",
    aide: "Une fenêtre devant vous, jamais derrière.",
    dessin: (
      <>
        <rect x="14" y="22" width="34" height="52" rx="4" className="fill-ambre-doux stroke-ambre" strokeWidth="2" />
        <line x1="31" y1="22" x2="31" y2="74" className="stroke-ambre" strokeWidth="1.5" />
        <line x1="14" y1="48" x2="48" y2="48" className="stroke-ambre" strokeWidth="1.5" />
        {[34, 48, 62].map((y) => (
          <line key={y} x1="56" y1={y} x2="76" y2={y + (48 - y) * 0.3} className="stroke-ambre" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" />
        ))}
        <Silhouette x={108} y={50} />
      </>
    ),
  },
  {
    titre: "Les yeux dans l'objectif",
    aide: "Comme si vous parliez à quelqu'un.",
    dessin: (
      <>
        <rect x="14" y="40" width="40" height="28" rx="6" className="fill-surface-3 stroke-trait-fort" strokeWidth="2" />
        <circle cx="34" cy="54" r="9" className="fill-fond stroke-orange-vif" strokeWidth="3" />
        <rect x="22" y="34" width="12" height="6" rx="2" className="fill-surface-3" />
        <line x1="96" y1="48" x2="46" y2="54" className="stroke-orange-vif" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
        <Silhouette x={110} y={50} />
        <circle cx="104" cy="48" r="2.5" className="fill-fond" />
      </>
    ),
  },
  {
    titre: "Cadré à la poitrine",
    aide: "Les yeux au tiers haut de l'image.",
    dessin: (
      <>
        <rect x="44" y="12" width="72" height="96" rx="6" className="fill-surface-2" />
        <Silhouette x={80} y={48} echelle={1.15} />
        <line x1="44" y1="44" x2="116" y2="44" className="stroke-orange-vif" strokeWidth="1.5" strokeDasharray="4 3" />
        {[
          "M44 24 v-12 h12",
          "M116 24 v-12 h-12",
          "M44 96 v12 h12",
          "M116 96 v12 h-12",
        ].map((d) => (
          <path key={d} d={d} className="fill-none stroke-texte" strokeWidth="3" strokeLinecap="round" />
        ))}
      </>
    ),
  },
  {
    titre: "Un fond simple",
    aide: "Uni, sans passage derrière vous.",
    dessin: (
      <>
        <rect x="24" y="12" width="112" height="96" rx="8" className="fill-surface-3" />
        <Silhouette x={80} y={52} />
        <circle cx="122" cy="26" r="10" className="fill-sauge" />
        <path d="M117 26 l4 4 l7 -8" className="fill-none stroke-fond" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    titre: "Téléphone posé",
    aide: "Stable, à hauteur des yeux, en vertical.",
    dessin: (
      <>
        <rect x="62" y="10" width="36" height="66" rx="7" className="fill-surface-3 stroke-trait-fort" strokeWidth="2" />
        <rect x="67" y="18" width="26" height="48" rx="3" className="fill-orange-doux" />
        <circle cx="80" cy="70" r="2.5" className="fill-trait-fort" />
        <path d="M80 76 v18 M66 108 l14 -14 l14 14 M80 94 v14" className="fill-none stroke-texte-doux" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="20" y1="42" x2="56" y2="42" className="stroke-orange-vif" strokeWidth="2" strokeDasharray="4 4" />
        <circle cx="20" cy="42" r="4" className="fill-orange-vif" />
      </>
    ),
  },
  {
    titre: "2 minutes sans couper",
    aide: "Parlez naturellement, avec des pauses.",
    dessin: (
      <>
        <circle cx="80" cy="60" r="38" className="fill-surface-2 stroke-surface-3" strokeWidth="8" />
        <path d="M80 22 A38 38 0 1 1 46 77" className="fill-none stroke-orange" strokeWidth="8" strokeLinecap="round" />
        <rect x="74" y="8" width="12" height="8" rx="2" className="fill-trait-fort" />
        <text x="80" y="68" textAnchor="middle" className="fill-texte font-titre" fontSize="22">
          2:00
        </text>
      </>
    ),
  },
];

/** Silhouette assise, de la tête à mi-cuisse (mains posées). */
function SilhouetteAssise({ x = 80, y = 34, echelle = 1 }: { x?: number; y?: number; echelle?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${echelle})`}>
      <circle cx="0" cy="0" r="11" className="fill-texte-doux" />
      <path d="M-24 52 q0 -34 24 -34 q24 0 24 34 v14 h-48 z" className="fill-texte-doux" />
      <path d="M-24 66 h48 v12 h-48 z" className="fill-surface-3" />
      <circle cx="-14" cy="64" r="4" className="fill-texte-faible" />
      <circle cx="14" cy="64" r="4" className="fill-texte-faible" />
    </g>
  );
}

/**
 * Guide de tournage de Will pour le format avocat (plan moteur avocat B.3 et plan du double, v3.2) :
 * deux angles dans la même séance, regard sur un interlocuteur, jamais dans l'objectif.
 */
const ILLUSTRATIONS_AVOCAT: Carte[] = [
  {
    titre: "Téléphone à la verticale",
    aide: "25 images par seconde, HDR coupé.",
    dessin: (
      <>
        <rect x="62" y="10" width="36" height="66" rx="7" className="fill-surface-3 stroke-trait-fort" strokeWidth="2" />
        <rect x="67" y="18" width="26" height="48" rx="3" className="fill-orange-doux" />
        <text x="80" y="47" textAnchor="middle" className="fill-orange-vif font-titre" fontSize="11">
          25
        </text>
        <path d="M80 76 v18 M66 108 l14 -14 l14 14 M80 94 v14" className="fill-none stroke-texte-doux" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x="122" y="40" textAnchor="middle" className="fill-brique font-titre" fontSize="11">
          HDR
        </text>
        <line x1="108" y1="44" x2="136" y2="30" className="stroke-brique" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    titre: "Assis, de la tête à mi-cuisse",
    aide: "Mains sur les cuisses entre les gestes.",
    dessin: (
      <>
        <rect x="46" y="10" width="68" height="100" rx="6" className="fill-surface-2" />
        <SilhouetteAssise x={80} y={30} />
        {["M46 24 v-14 h14", "M114 24 v-14 h-14", "M46 96 v14 h14", "M114 96 v14 h-14"].map((d) => (
          <path key={d} d={d} className="fill-none stroke-texte" strokeWidth="3" strokeLinecap="round" />
        ))}
      </>
    ),
  },
  {
    titre: "Regard sur votre interlocuteur",
    aide: "Jamais dans l'objectif. Il est à 25-35°.",
    dessin: (
      <>
        <rect x="18" y="74" width="30" height="22" rx="5" className="fill-surface-3 stroke-trait-fort" strokeWidth="2" />
        <circle cx="33" cy="85" r="6" className="fill-fond stroke-texte-faible" strokeWidth="2" />
        <Silhouette x={84} y={40} echelle={0.8} />
        <circle cx="132" cy="64" r="10" className="fill-orange-doux stroke-orange-vif" strokeWidth="2" />
        <line x1="94" y1="42" x2="122" y2="60" className="stroke-orange-vif" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
        <line x1="74" y1="46" x2="44" y2="78" className="stroke-brique" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
      </>
    ),
  },
  {
    titre: "Deux angles, même séance",
    aide: "Trois-quarts, puis presque de face.",
    dessin: (
      <>
        <Silhouette x={80} y={46} echelle={0.8} />
        <rect x="16" y="78" width="26" height="18" rx="4" className="fill-orange-doux stroke-orange-vif" strokeWidth="2" />
        <text x="29" y="91" textAnchor="middle" className="fill-orange-vif font-titre" fontSize="10">
          1
        </text>
        <rect x="104" y="84" width="26" height="18" rx="4" className="fill-surface-3 stroke-trait-fort" strokeWidth="2" />
        <text x="117" y="97" textAnchor="middle" className="fill-texte font-titre" fontSize="10">
          2
        </text>
        <line x1="42" y1="82" x2="66" y2="66" className="stroke-orange-vif" strokeWidth="1.5" strokeDasharray="3 3" />
        <line x1="108" y1="86" x2="90" y2="70" className="stroke-texte-faible" strokeWidth="1.5" strokeDasharray="3 3" />
      </>
    ),
  },
  {
    titre: "Fond gris uni, jamais vert",
    aide: "À 1,5-2 m derrière vous, éclairé à part.",
    dessin: (
      <>
        <rect x="24" y="12" width="112" height="96" rx="8" className="fill-surface-3" />
        <Silhouette x={80} y={56} />
        <circle cx="122" cy="26" r="10" className="fill-sauge" />
        <path d="M117 26 l4 4 l7 -8" className="fill-none stroke-fond" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="38" cy="26" r="10" className="fill-sauge-doux stroke-brique" strokeWidth="2" />
        <line x1="31" y1="33" x2="45" y2="19" className="stroke-brique" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    titre: "Lumière douce côté regard",
    aide: "Appoint plus faible, volets fermés.",
    dessin: (
      <>
        <rect x="112" y="24" width="30" height="40" rx="6" className="fill-ambre-doux stroke-ambre" strokeWidth="2" />
        {[34, 46, 58].map((y) => (
          <line key={y} x1="108" y1={y} x2="94" y2={y + (46 - y) * 0.3} className="stroke-ambre" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" />
        ))}
        <rect x="18" y="34" width="20" height="26" rx="5" className="fill-surface-3 stroke-trait-fort" strokeWidth="2" />
        <Silhouette x={70} y={50} />
      </>
    ),
  },
  {
    titre: "Micro caché",
    aide: "Hors du cadre ou sous la chemise.",
    dessin: (
      <>
        <rect x="46" y="22" width="68" height="88" rx="6" className="fill-surface-2" />
        <Silhouette x={80} y={56} />
        <rect x="74" y="4" width="12" height="20" rx="6" className="fill-texte-faible" />
        <line x1="80" y1="24" x2="80" y2="30" className="stroke-texte-faible" strokeWidth="2" />
        {["M46 36 v-14 h14", "M114 36 v-14 h-14"].map((d) => (
          <path key={d} d={d} className="fill-none stroke-texte" strokeWidth="3" strokeLinecap="round" />
        ))}
      </>
    ),
  },
  {
    titre: "Gestes ouverts, puis repos",
    aide: "Ni pointer, ni compter, ni pouce levé.",
    dessin: (
      <>
        <SilhouetteAssise x={80} y={30} />
        <path d="M52 66 q-14 -8 -18 -22 M108 66 q14 -8 18 -22" className="fill-none stroke-orange-vif" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 40 l4 4 M126 40 l-4 4" className="fill-none stroke-orange-vif" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  {
    titre: "3 à 5 min par prise",
    aide: "Le regard déjà posé dès le début.",
    dessin: (
      <>
        <circle cx="80" cy="60" r="38" className="fill-surface-2 stroke-surface-3" strokeWidth="8" />
        <path d="M80 22 A38 38 0 1 1 42 60" className="fill-none stroke-orange" strokeWidth="8" strokeLinecap="round" />
        <rect x="74" y="8" width="12" height="8" rx="2" className="fill-trait-fort" />
        <text x="80" y="68" textAnchor="middle" className="fill-texte font-titre" fontSize="20">
          3-5
        </text>
      </>
    ),
  },
];

/** La séance, dans l'ordre (B.3). */
const SEANCE_AVOCAT: { titre: string; detail: string }[] = [
  { titre: "Réglages du téléphone", detail: "HDR coupé (iPhone : Réglages › Appareil photo › Enregistrement vidéo), 25 images par seconde, format « le plus compatible ». Exposition, mise au point et blanc bloqués." },
  { titre: "Prise 1 · trois-quarts, mi-cuisse", detail: "3 à 5 min. Votre interlocuteur à 25-35° de l'objectif, à hauteur des yeux." },
  { titre: "Prise 2 · trois-quarts, à la taille", detail: "3 à 5 min, même angle, visage plus grand." },
  { titre: "Prise 3 · presque de face", detail: "3 à 5 min. Le téléphone juste à côté de l'interlocuteur ; vous le regardez, lui." },
  { titre: "Prise 4 · serrée, tête et poitrine", detail: "2 à 3 min en trois-quarts, gardée en réserve." },
  { titre: "30 s de silence", detail: "Personne ne parle : le bruit de la pièce sert au son." },
  { titre: "Facultatif · face à l'objectif", detail: "1 à 2 min, pour un essai plus tard." },
];

const REGLES_AVOCAT = ["Même tenue, même coiffure, même lumière pour toutes les prises.", "Très expressif, la bouche bien ouverte, un ton varié.", "Chaque prise commence le regard déjà posé sur l'interlocuteur.", "Aucun micro dans l'image."];

function Cartes({ cartes, titre, className }: { cartes: Carte[]; titre: string; className?: string }) {
  return (
    // tabIndex : la bande défile, elle doit s'atteindre au clavier (axe « scrollable-region-focusable », E2E-1 n° 25).
    <ul aria-label={titre} tabIndex={0} className={cn("sans-barre -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0", className)}>
      {cartes.map((g, i) => (
        <li key={g.titre} className="w-[64%] shrink-0 snap-start sm:w-56 lg:w-auto">
          <div className="h-full overflow-hidden rounded-carte border border-trait bg-surface-1">
            <div className="relative aspect-[4/3] bg-fond lueur">
              <span className="absolute left-3 top-3 grid size-7 place-items-center rounded-full bg-surface-2 font-titre text-xs tabular-nums text-texte-doux">{i + 1}</span>
              <svg viewBox="0 0 160 120" className="absolute inset-0 size-full" aria-hidden>
                {g.dessin}
              </svg>
            </div>
            <div className="p-3">
              <p className="font-semibold leading-tight text-texte">{g.titre}</p>
              <p className="mt-1 text-sm text-texte-faible">{g.aide}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Guide de tournage ILLUSTRÉ (B.8 #14) : des cartes visuelles, une ligne chacune.
 * Défile horizontalement sur mobile, grille sur ordinateur.
 * Par défaut : le guide du double de Will pour le format avocat (lot M1b, remis avant son tournage) ;
 * `variante="face"` : le guide court face à l'objectif (selfie).
 */
export function GuideTournage({ className, variante = "avocat" }: { className?: string; variante?: "avocat" | "face" | "invente" }) {
  if (variante === "face") return <Cartes cartes={ILLUSTRATIONS_FACE} titre="Bien filmer votre visage" className={className} />;
  if (variante === "invente") return <GuideCreation className={className} />;
  return (
    <div className={cn("space-y-4", className)}>
      <Cartes cartes={ILLUSTRATIONS_AVOCAT} titre="Bien filmer votre double" />
      <details className="group rounded-carte border border-trait bg-surface-1">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold text-texte">
          La séance, dans l&apos;ordre
          <Icone nom="chevron-bas" size={18} className="text-texte-faible transition-transform group-open:rotate-180" />
        </summary>
        <ol className="space-y-3 px-4 pb-4">
          {SEANCE_AVOCAT.map((e, i) => (
            <li key={e.titre} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-doux font-titre text-xs tabular-nums text-orange-vif">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-texte">{e.titre}</span>
                <span className="block text-sm text-texte-faible">{e.detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <ul className="space-y-1.5 border-t border-trait px-4 py-3">
          {REGLES_AVOCAT.map((r) => (
            <li key={r} className="flex gap-2 text-sm text-texte-doux">
              <Icone nom="coche" size={15} className="mt-0.5 shrink-0 text-sauge" />
              {r}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Personnage inventé (E2E-1 n° 18) : rien à filmer, le visage et la voix se créent. Trois étapes, une ligne chacune. */
const ETAPES_CREATION: { titre: string; aide: string; icone: "visage" | "micro" | "lecture" }[] = [
  { titre: "Créer le visage", aide: "Âge, allure, tenue : quelques mots suffisent.", icone: "visage" },
  { titre: "Choisir la voix", aide: "Écoutez, gardez celle qui lui va.", icone: "micro" },
  { titre: "Essayer", aide: "Une phrase pour vérifier le rendu.", icone: "lecture" },
];

function GuideCreation({ className }: { className?: string }) {
  return (
    <ol aria-label="Créer ce personnage" className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {ETAPES_CREATION.map((e, i) => (
        <li key={e.titre} className="flex items-center gap-3 rounded-carte border border-trait bg-surface-1 p-3">
          <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-orange-doux text-orange-vif">
            <Icone nom={e.icone} size={19} />
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-surface-2 font-titre text-[10px] tabular-nums text-texte-doux">{i + 1}</span>
          </span>
          <span className="min-w-0">
            <span className="block font-semibold leading-tight text-texte">{e.titre}</span>
            <span className="block text-sm text-texte-faible">{e.aide}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
