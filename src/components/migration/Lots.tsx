import type { ResumeLot } from "./logique";

const STATUT: Record<ResumeLot["statut"], string> = { vide: "Aucun post", "a-faire": "À faire", "en-cours": "En cours", termine: "Terminé" };

/** Cartes des lots A, B, C : intitulé, X / Y, plage, mini-barre, statut. */
export function Lots({ lots, onOuvrir }: { lots: ResumeLot[]; onOuvrir?: (code: ResumeLot["code"]) => void }) {
  return (
    <section aria-labelledby="mig-lots" className="grid gap-3">
      <h2 id="mig-lots" className="text-lg text-texte">Les lots</h2>
      {lots.map((l) => (
        <article key={l.code} className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-texte">{l.intitule}</h3>
            <p className="shrink-0 text-base sm:text-sm font-semibold text-texte">{l.faits} / {l.total}</p>
          </div>
          <p className="text-base sm:text-sm text-texte-doux">{l.plage}</p>
          <div role="img" aria-label={`${l.faits} sur ${l.total}`} className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full bg-sauge" style={{ width: l.total ? `${(l.faits / l.total) * 100}%` : "0%" }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-base sm:text-sm text-texte-doux">{STATUT[l.statut]}</p>
            {onOuvrir && l.total > 0 && (
              <button type="button" onClick={() => onOuvrir(l.code)} className="min-h-11 rounded-full border border-trait-fort px-4 text-base sm:text-sm font-semibold text-texte">
                Ouvrir le lot {l.code}
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
