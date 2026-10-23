import { ETATS_RESEAU_GENERATEUR, type SigneCase } from "@/domaine/libelles";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { obtenirReseau } from "@/reseaux";
import { Icone } from "./Icone";

export type EtatLogoReseau = keyof typeof ETATS_RESEAU_GENERATEUR;

const TONS: Record<SigneCase, string> = {
  vide: "border border-dashed border-trait-fort bg-transparent text-texte-faible",
  point: "bg-ambre-doux text-ambre",
  coche: "bg-sauge-doux text-sauge",
  film: "bg-sauge-doux text-sauge",
  calendrier: "bg-orange-doux text-orange-vif",
  avion: "bg-orange-doux text-orange-vif",
  probleme: "bg-brique-doux text-brique",
};

function Signe({ signe, petit }: { signe: SigneCase; petit: boolean }) {
  const t = petit ? 13 : 16;
  if (signe === "point") return <span className={cn("rounded-full bg-current", petit ? "size-1.5" : "size-2")} />;
  if (signe === "probleme") return <span className="font-titre leading-none">!</span>;
  if (signe === "coche") return <Icone nom="coche" size={t} />;
  if (signe === "film") return <Icone nom="film" size={t} />;
  if (signe === "calendrier") return <Icone nom="calendrier" size={t} />;
  if (signe === "avion") return <Icone nom="envoyer" size={t} />;
  return null;
}

/**
 * Monogramme d'un réseau (pas de logo de marque) : « in », « IG », « TT »…
 * Générateur (lot G1b) : avec `etat`, c'est une CASE de la mini-grille : une couleur ET un signe (vide, point à relire,
 * coche validé, film vidéo prête, calendrier programmé, avion publié, « ! » problème), lisible sans les couleurs.
 * `lettres` (L, I, V, T) dit comment la version est dite : je lis, j'improvise, voix off, tu.
 */
export function LogoReseau({
  reseau,
  taille = "md",
  etat,
  lettres,
  className,
}: {
  reseau: IdReseau;
  taille?: "sm" | "md" | "lg";
  etat?: EtatLogoReseau;
  lettres?: string;
  className?: string;
}) {
  const r = obtenirReseau(reseau);
  const dims = cn(taille === "sm" && "size-7 rounded-lg text-[10px]", taille === "md" && "size-9 text-xs", taille === "lg" && "size-11 text-sm");
  const marque = lettres ? (
    <span aria-hidden className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-texte px-0.5 font-texte text-[9px] font-bold leading-none text-fond">
      {lettres}
    </span>
  ) : null;
  if (etat) {
    const e = ETATS_RESEAU_GENERATEUR[etat];
    return (
      <span
        role="img"
        aria-label={`${r.nom}${lettres ? ` (${lettres})` : ""} : ${e.libelle}`}
        title={`${r.nom} : ${e.libelle}`}
        className={cn("relative inline-grid shrink-0 place-items-center rounded-xl font-titre leading-none", dims, TONS[e.signe], className)}
      >
        <Signe signe={e.signe} petit={taille === "sm"} />
        {marque}
      </span>
    );
  }
  // role="img" : sans lui, le nom complet est ignoré et un lecteur d'écran lit « TT », « IG » (E2E-1 n° 25).
  return (
    <span
      role="img"
      title={r.nom}
      aria-label={r.nom}
      className={cn("relative inline-grid shrink-0 place-items-center rounded-xl border border-trait-fort bg-surface-2 font-titre leading-none text-texte", dims, className)}
    >
      {r.monogramme}
      {marque}
    </span>
  );
}
