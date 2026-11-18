/** L8-04a : carte « Votre semaine » de l'accueil. Affiche des phrases déjà écrites : aucun calcul, aucun montant. */
export function CarteBilanSemaine({ lignes }: { lignes: readonly string[] }) {
  return (
    <section aria-labelledby="titre-bilan-semaine" className="rounded-carte border border-trait bg-surface-1 p-4">
      <h2 id="titre-bilan-semaine" className="mb-3 text-lg text-texte">
        Votre semaine
      </h2>
      <ul className="space-y-2 text-[15px] leading-snug text-texte-doux">
        {lignes.map((l) => (
          <li key={l} className="break-words">
            {l}
          </li>
        ))}
      </ul>
    </section>
  );
}
