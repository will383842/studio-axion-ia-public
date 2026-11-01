import { formaterDate, type PostMigration } from "./logique";

/** Posts dont la date est passée : jamais publiés seuls, vous choisissez une nouvelle date. */
export function AReprogrammer({ posts, onChoisir }: { posts: PostMigration[]; onChoisir?: (id: string) => void }) {
  if (!posts.length) return null;
  return (
    <section aria-labelledby="mig-repro" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">
      <h2 id="mig-repro" className="text-lg text-texte">À reprogrammer par vous · {posts.length}</h2>
      <p className="mt-1 text-sm text-texte-doux">Ces posts devaient partir pendant la bascule. Leur date est passée : nous ne les publions jamais seuls.</p>
      <ul className="mt-3 grid gap-2">
        {posts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0"><span className="font-semibold capitalize">{p.reseau}</span> · {p.titre} · prévu le {formaterDate(p.datePrevue)}</span>
            <button type="button" onClick={() => onChoisir?.(p.id)} className="min-h-11 shrink-0 rounded-full border border-trait-fort px-4 font-semibold">Choisir une date</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
