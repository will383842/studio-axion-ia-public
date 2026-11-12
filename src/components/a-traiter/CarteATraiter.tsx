import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { extraitLisible, type CarteATraiter as Donnees } from "@/services/a-traiter-types";

export const LIBELLE_MOTIF: Record<Donnees["motif"], string> = {
  echec_envoi: "L’envoi automatique a échoué",
  mot_dans_phrase: "Le mot est dans une phrase",
  mot_inconnu: "Mot inconnu",
  mot_manuel: "Ce réseau se traite à la main",
};

/** Une carte. Tout le texte passe par React (échappé) : jamais de HTML brut. */
export function CarteATraiter({ carte }: { carte: Donnees }) {
  return (
    <Carte data-carte="a-traiter" data-motif={carte.motif}>
      <div className="flex flex-wrap items-center gap-2">
        <Pastille ton="neutre">{carte.reseau}</Pastille>
        <span className="text-sm font-semibold text-texte">{LIBELLE_MOTIF[carte.motif]}</span>
        {carte.mot ? <span className="text-sm text-texte-doux" data-mot>Mot : {carte.mot}</span> : null}
      </div>
      <p className="mt-3 text-sm text-texte" data-extrait>{extraitLisible(carte.extrait)}</p>
      <p className="mt-1 text-xs text-texte-doux">Reçu le {carte.creeLe.slice(0, 10)}</p>
      {carte.opposee ? (
        <p className="mt-3 text-sm font-semibold text-texte" data-opposee>Cette personne a demandé l’arrêt : ne rien envoyer.</p>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-semibold text-texte">Réponse proposée</p>
          {carte.kit ? <pre className="whitespace-pre-wrap text-sm text-texte-doux" data-kit>{carte.kit}</pre> : <p className="text-sm text-texte-doux">Pas de réponse proposée : écrivez-la vous-même.</p>}
        </div>
      )}
    </Carte>
  );
}
