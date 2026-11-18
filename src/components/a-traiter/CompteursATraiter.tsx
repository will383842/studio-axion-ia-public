import { compteurs, type Compte } from "@/services/a-traiter-suivi";
import { LIBELLE_RESEAU_A_TRAITER, type OngletATraiter } from "@/services/a-traiter-onglets";
import type { CarteATraiter, ReseauATraiter } from "@/services/a-traiter-types";

/** Nom lisible de chaque post, dans l'ordre d'arrivée : « Post 1 », « Post 2 »… (jamais l'identifiant technique). */
export function etiquettesPosts(cartes: readonly Pick<CarteATraiter, "reseau" | "post">[]): Map<string, string> {
  const m = new Map<string, string>();
  const vus: Record<string, number> = {};
  for (const c of cartes) {
    const cle = `${c.reseau}|${c.post}`;
    if (m.has(cle)) continue;
    vus[c.reseau] = (vus[c.reseau] ?? 0) + 1;
    m.set(cle, `Post ${vus[c.reseau]}`);
  }
  return m;
}
export const clePost = (c: Pick<CarteATraiter, "reseau" | "post">): string => `${c.reseau}|${c.post}`;

/** Pastilles neutres : aucune couleur d'alerte, aucun clignotement. Les rappels passent par la cloche seule. */
function Pastilles({ c }: { c: Compte }) {
  const p = "rounded-full border border-surface-3 bg-surface-3 px-3 py-1 text-sm text-texte-doux";
  return (
    <span className="flex flex-wrap gap-2">
      <span className={p}>{c.arrives} arrivés</span>
      <span className={p}>{c.repondus} répondus</span>
      <span className={p}>{c.enRetard} en retard</span>
    </span>
  );
}

/** Compteurs de l'onglet courant : par réseau, puis par post. Lecture seule. */
export function CompteursATraiter({ cartes, onglet, maintenant }: { cartes: readonly CarteATraiter[]; onglet: OngletATraiter; maintenant?: Date }) {
  const total = compteurs(cartes, maintenant);
  const noms = etiquettesPosts(cartes);
  const reseaux = (Object.keys(total.parReseau) as ReseauATraiter[]).filter((r) => onglet === "tous" || r === onglet);
  if (reseaux.length === 0) return null;
  return (
    <section aria-label="Suivi" className="flex flex-col gap-3 rounded-lg border border-surface-3 p-3" data-compteurs>
      {reseaux.map((r) => (
        <div key={r} className="flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{LIBELLE_RESEAU_A_TRAITER[r]}</span>
            <Pastilles c={total.parReseau[r]} />
          </p>
          <ul className="flex flex-col gap-2 pl-3">
            {Object.entries(total.parPost[r] ?? {}).map(([post, c]) => (
              <li key={post} className="flex flex-wrap items-center gap-2 break-words text-sm text-texte-doux">
                <span>{noms.get(`${r}|${post}`) ?? "Post"}</span>
                <Pastilles c={c} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
