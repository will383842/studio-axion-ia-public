import Link from "next/link";
import type { ReactNode } from "react";
import type { VueCarrouselFiche } from "@/domaine/visuels/contrats";
import { jourFrancais } from "../formats/cas-concret/document/jour";

export const LIEN_DEPOT_SESSION = "/carrousels/nouveau?entree=session";

const pluriel = (n: number) => `${n} ${n > 1 ? "jours" : "jour"}`;
const Message = ({ children, ton = "doux", role = "status" }: { children: ReactNode; ton?: "doux" | "ambre" | "brique"; role?: "status" | "alert" }) => (
  <p role={role} className={`mb-4 text-sm ${ton === "brique" ? "text-brique" : ton === "ambre" ? "font-semibold text-ambre" : "text-texte-doux"}`}>
    {children}
  </p>
);

/** Tous les messages d'état d'une fiche de carrousel : rendu en cours, blocage, refus, corbeille, texte d'exemple. */
export function MessagesFiche({ fiche }: { fiche: VueCarrouselFiche }) {
  const session = fiche.entree === "session";
  const aCorbeille = fiche.joursRestantsCorbeille !== undefined;
  const dernierRefus = fiche.refus.at(-1);
  return (
    <>
      {/* Rafraîchissement simple tant que le rendu tourne. */}
      {fiche.renduEnCours && !aCorbeille && <meta httpEquiv="refresh" content="5" />}
      {aCorbeille && <Message ton="ambre">À la corbeille : supprimé définitivement dans {pluriel(Math.max(0, fiche.joursRestantsCorbeille ?? 0))}</Message>}
      {fiche.erreur && <Message ton="brique">{fiche.erreur}</Message>}
      {fiche.renduEnCours && !aCorbeille && <Message>Rendu en cours, environ une minute : cette page se met à jour toute seule</Message>}
      {fiche.statut === "rendu_en_cours" && !fiche.renduEnCours && fiche.actionsPermises.includes("relancer_rendu") && (
        <Message>Le rendu semble bloqué : utilisez « Relancer le rendu ».</Message>
      )}
      {fiche.statut === "echec_rendu" && !aCorbeille && !fiche.actionsPermises.includes("relancer_rendu") && (
        <Message ton="brique">
          {fiche.actionsPermises.includes("refaire") ? (
            <>Corrigez le texte avec « Refaire ».</>
          ) : (
            <>
              Il faut changer le texte : <Link href={LIEN_DEPOT_SESSION} className="font-semibold underline underline-offset-4">déposez un texte corrigé</Link>.
            </>
          )}
        </Message>
      )}
      {fiche.statut === "bloque" && !aCorbeille && (
        <Message ton="brique">
          {fiche.actionsPermises.includes("refaire") ? (
            <>Le texte est bloqué par la porte : corrigez avec « Refaire ».</>
          ) : session ? (
            <>
              Le texte est bloqué par la porte : <Link href={LIEN_DEPOT_SESSION} className="font-semibold underline underline-offset-4">déposez un texte corrigé</Link>.
            </>
          ) : (
            <>Le texte est bloqué par la porte.</>
          )}
        </Message>
      )}
      {fiche.statut === "refuse" && dernierRefus && (
        <Message ton="brique">
          Refusé le {jourFrancais(dernierRefus.le)} · {dernierRefus.libelleMotif}
          {dernierRefus.page !== undefined && ` (page ${dernierRefus.page + 1})`}
          {dernierRefus.commentaire && <> : « {dernierRefus.commentaire} »</>}
          {session && (
            <>
              {" "}
              <Link href={LIEN_DEPOT_SESSION} className="font-semibold underline underline-offset-4">Déposer un texte corrigé</Link>
            </>
          )}
        </Message>
      )}
      {fiche.modeTexte === "simulation" && <Message>Simulation : texte d&apos;exemple{fiche.noteTexte ? ` ; ${fiche.noteTexte}` : ", pas un texte écrit pour votre sujet"}.</Message>}
    </>
  );
}
