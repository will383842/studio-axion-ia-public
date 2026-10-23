import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { BarreEtapes, type EtapeBarre } from "@/components/ui/BarreEtapes";
import { EnTetePage } from "@/components/ui/EnTetePage";

export interface ProprietesGabaritCreation {
  entete: Parameters<typeof EnTetePage>[0];
  /** Absent = écran à une seule étape. */
  etapes?: { etapes: EtapeBarre[]; courante: number; onAller?: (index: number) => void };
  /** Un `<SuiviFabrication …/>` ; absent si rien n'est en cours. */
  suivi?: ReactNode;
  /** Un `<RecentsGenerateur …/>` ; absent si le générateur n'en a pas. */
  recents?: ReactNode;
  /** Contenu de la `BarreActionCollee` ; ABSENT quand l'enfant porte déjà la sienne. */
  action?: ReactNode;
  actionSecondaire?: ReactNode;
  /** « etroite » (défaut, dépôts) ou « large » (assistant, tableau). */
  largeur?: "etroite" | "large";
  /** La zone spécifique du générateur. */
  children: ReactNode;
}

/**
 * Squelette commun des écrans de création : en-tête, étapes, zone spécifique, suivi, récents, action collée.
 * Ne touche ni aux couleurs ni aux textes du générateur (serveur, sans état).
 */
export function GabaritCreation({ entete, etapes, suivi, recents, action, actionSecondaire, largeur = "etroite", children }: ProprietesGabaritCreation) {
  return (
    <div data-gabarit="creation" className={cn("mx-auto space-y-6", largeur === "etroite" && "max-w-2xl")}>
      <div data-zone="entete">
        <EnTetePage {...entete} className={cn("mb-0", entete.className)} />
      </div>
      {etapes && (
        <div data-zone="etapes">
          <BarreEtapes etapes={etapes.etapes} courante={etapes.courante} onAller={etapes.onAller} />
        </div>
      )}
      <div data-zone="specifique">{children}</div>
      {suivi && <div data-zone="suivi">{suivi}</div>}
      {recents && <div data-zone="recents">{recents}</div>}
      {action && (
        <div data-zone="action">
          <BarreActionCollee secondaire={actionSecondaire}>{action}</BarreActionCollee>
        </div>
      )}
    </div>
  );
}
