import { Carte } from "@/components/ui/Carte";
import type { ElementATraiter, KitLinkedinProfil } from "@/services/mots-kit";

/** Kit à copier (LinkedIn profil) et file « À traiter ». Tous les textes passent par React : échappés, jamais en HTML brut. */
export function KitLinkedin({ kit, file }: { kit: KitLinkedinProfil | null; file: readonly ElementATraiter[] }) {
  return (
    <Carte data-carte="kit-linkedin-profil">
      <h3 className="text-base text-texte">LinkedIn profil : à faire à la main</h3>
      {kit ? (
        <div className="mt-2 flex flex-col gap-3 text-sm text-texte-doux">
          <div>
            <p className="font-semibold text-texte">Commentaire à épingler</p>
            <pre className="whitespace-pre-wrap" data-kit="epingle">{kit.commentaireEpingle}</pre>
          </div>
          <div>
            <p className="font-semibold text-texte">Réponse type</p>
            <pre className="whitespace-pre-wrap" data-kit="reponse">{kit.reponseType}</pre>
          </div>
          <div>
            <p className="font-semibold text-texte">Lien du guide</p>
            <pre className="whitespace-pre-wrap break-all" data-kit="lien">{kit.lienGuide}</pre>
          </div>
          <ol className="list-decimal pl-5">
            {kit.instructions.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-2 text-sm text-texte-doux">Pas de kit : les textes doivent être validés (ou l’interrupteur est éteint).</p>
      )}
      <h4 className="mt-4 text-sm font-semibold text-texte">À traiter</h4>
      {file.length === 0 ? (
        <p className="text-sm text-texte-doux">Rien à traiter.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1 text-sm text-texte-doux" aria-label="À traiter">
          {file.map((e) => (
            <li key={e.id} data-a-traiter={e.mot}>
              {e.mot} · {e.repere}
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}
