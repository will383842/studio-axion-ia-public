import type { ReactNode } from "react";

/** Dessin de chaque pièce (traits et remplissages en jetons du studio, aucune image externe). */
const DESSINS: Record<string, ReactNode> = {
  curseur: <path d="M30 14l4 34 8-9 8 16 6-3-8-16 12-1z" className="fill-orange stroke-texte" strokeWidth="2" strokeLinejoin="round" />,
  zoom: (
    <>
      <circle cx="40" cy="36" r="16" className="fill-surface-1 stroke-orange" strokeWidth="4" />
      <path d="M52 48l14 14" className="stroke-orange" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
  frappe: (
    <>
      <rect x="10" y="22" width="60" height="28" rx="6" className="fill-surface-1 stroke-trait-fort" strokeWidth="2" />
      <path d="M20 36h24" className="stroke-texte" strokeWidth="4" strokeLinecap="round" />
      <rect x="50" y="29" width="3" height="14" className="fill-orange" />
    </>
  ),
  "carte-kpi": (
    <>
      <rect x="12" y="14" width="56" height="44" rx="8" className="fill-surface-1 stroke-trait-fort" strokeWidth="2" />
      <path d="M22 44l10-8 8 4 14-14" className="stroke-sauge" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  graphique: (
    <>
      <rect x="16" y="38" width="10" height="20" className="fill-orange" />
      <rect x="32" y="26" width="10" height="32" className="fill-sauge" />
      <rect x="48" y="14" width="10" height="44" className="fill-orange-vif" />
    </>
  ),
  "tableau-de-bord": (
    <>
      <rect x="10" y="12" width="26" height="22" rx="4" className="fill-surface-1 stroke-trait-fort" strokeWidth="2" />
      <rect x="42" y="12" width="26" height="22" rx="4" className="fill-orange" />
      <rect x="10" y="40" width="58" height="20" rx="4" className="fill-surface-1 stroke-trait-fort" strokeWidth="2" />
    </>
  ),
  "liste-crm": (
    <>
      {[16, 30, 44].map((y) => (
        <g key={y}>
          <circle cx="20" cy={y + 4} r="5" className="fill-orange" />
          <rect x="30" y={y} width="38" height="8" rx="4" className="fill-trait-fort" />
        </g>
      ))}
    </>
  ),
  "fenetre-app": (
    <>
      <rect x="10" y="12" width="60" height="48" rx="8" className="fill-surface-1 stroke-trait-fort" strokeWidth="2" />
      <path d="M10 26h60" className="stroke-trait-fort" strokeWidth="2" />
      <circle cx="19" cy="19" r="2.5" className="fill-orange" />
      <circle cx="27" cy="19" r="2.5" className="fill-sauge" />
    </>
  ),
  "bulle-chat": (
    <>
      <rect x="10" y="14" width="42" height="22" rx="10" className="fill-surface-1 stroke-trait-fort" strokeWidth="2" />
      <rect x="28" y="40" width="42" height="20" rx="10" className="fill-orange" />
    </>
  ),
  legende: (
    <>
      <rect x="8" y="40" width="64" height="18" rx="9" className="fill-texte" />
      <rect x="18" y="47" width="44" height="4" rx="2" className="fill-surface-1" />
    </>
  ),
};

export function Pictogramme({ id }: { id: string }) {
  return (
    <svg aria-hidden width="100%" height="100%" viewBox="0 0 80 72" fill="none" className="h-full w-full">
      {DESSINS[id] ?? <circle cx="40" cy="36" r="16" className="fill-orange" />}
    </svg>
  );
}
