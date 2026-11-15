import { compter, type PostMigration } from "./logique";

/** Héros « Avancement » : un gros chiffre, une barre à 3 segments, la légende et la ligne de total. */
export function Heros({ posts }: { posts: PostMigration[] }) {
  const c = compter(posts);
  const part = (n: number) => (c.total ? `${(n / c.total) * 100}%` : "0%");
  return (
    <section aria-labelledby="mig-avancement" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte sm:p-5">
      <h2 id="mig-avancement" className="text-base sm:text-sm font-semibold text-texte-doux">Avancement</h2>
      <p className="mt-1 text-3xl font-bold text-texte">
        {c.enRegle} sur {c.total} posts en règle · {c.pourcent} %
      </p>
      <div role="img" aria-label={`${c.laissesBuffer} laissés à Buffer, ${c.verifies} vérifiés chez Zernio, ${c.aVerifier} à vérifier`} className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-3">
        <span className="bg-texte-faible" style={{ width: part(c.laissesBuffer) }} />
        <span className="bg-sauge" style={{ width: part(c.verifies) }} />
        <span className="bg-ambre" style={{ width: part(c.aVerifier) }} />
      </div>
      <ul className="mt-3 grid gap-1 text-base sm:text-sm text-texte-doux">
        <li>{c.verifies} vérifiés et programmés chez Zernio</li>
        <li>{c.aVerifier} recréés, à vérifier par vous</li>
        <li>{c.restants} restants (après le 20/11)</li>
        <li>{c.laissesBuffer} laissés à Buffer (partent avant la bascule)</li>
      </ul>
      {c.ecart === 0 ? (
        <p className="mt-3 text-base sm:text-sm font-semibold text-texte">
          Total vérifié : {c.verifies} + {c.aVerifier} + {c.restants} + {c.laissesBuffer} = {c.total} posts. Aucun doublon.
        </p>
      ) : (
        <p role="alert" className="mt-3 rounded-xl bg-brique-doux p-3 text-base sm:text-sm font-semibold text-brique">
          Écart de {Math.abs(c.ecart)} post{Math.abs(c.ecart) > 1 ? "s" : ""} : {c.verifies} + {c.aVerifier} + {c.restants} + {c.laissesBuffer} = {c.somme}, pour {c.total} posts.
        </p>
      )}
    </section>
  );
}

/** Carte d'état : Buffer est résilié, la publication passe par Zernio. Rien à faire, aucune date. */
export function EtatBuffer() {
  return (
    <section aria-labelledby="mig-buffer" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">
      <h2 id="mig-buffer" className="text-base sm:text-sm font-semibold text-texte-doux">Buffer</h2>
      <p className="mt-1 text-2xl font-bold text-texte">Buffer est résilié.</p>
      <p className="mt-1 text-base sm:text-sm text-texte-doux">Toutes les publications passent par Zernio.</p>
    </section>
  );
}
