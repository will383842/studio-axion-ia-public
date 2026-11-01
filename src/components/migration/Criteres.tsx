import { critereResiliation, type Cellule, type CompteMigration } from "./logique";

function Case({ valeur, texte }: { valeur: Cellule | boolean; texte?: string }) {
  const v: Cellule = valeur === true ? "oui" : valeur === false ? "non" : valeur;
  return (
    <td className="px-2 py-2 text-center">
      <span aria-hidden>{v === "oui" ? "✓" : v === "non" ? "✗" : "–"}</span>
      <span className="sr-only">{texte ? `${texte} : ` : ""}{v === "oui" ? "rempli" : v === "non" ? "non rempli" : "sans objet"}</span>
    </td>
  );
}

/** Carte « Critères pour résilier Buffer » : le calcul vient de critereResiliation, rien en dur. */
export function Criteres({ comptes }: { comptes: CompteMigration[] }) {
  return (
    <section aria-labelledby="mig-criteres" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">
      <h2 id="mig-criteres" className="text-lg text-texte">Critères pour résilier Buffer</h2>
      <p className="mt-1 text-sm text-texte-doux">Chaque compte : 2 vraies publications par Zernio, dont une avec premier commentaire, vérifiées avec leur lien, sans rien « à vérifier », sur au moins 5 jours.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-texte-doux">
              <th scope="col" className="px-2 py-1">Compte</th>
              <th scope="col" className="px-2 py-1">Publications</th>
              <th scope="col" className="px-2 py-1">Premier comm.</th>
              <th scope="col" className="px-2 py-1">Lien vérifié</th>
              <th scope="col" className="px-2 py-1">Rien à vérifier</th>
              <th scope="col" className="px-2 py-1">Jours</th>
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => {
              const r = critereResiliation(c);
              return (
                <tr key={c.id} className="border-t border-trait">
                  <th scope="row" className="px-2 py-2 text-left font-semibold">{c.libelle}</th>
                  <td className="px-2 py-2 text-center">{r.publications.n} / {r.publications.requis}<span className="sr-only">{r.publications.ok ? " : rempli" : " : non rempli"}</span></td>
                  <Case valeur={r.premierComm} />
                  <Case valeur={r.lien} />
                  <Case valeur={r.rienAVerifier} />
                  <td className="px-2 py-2 text-center">{r.jours.n} / {r.jours.requis}<span className="sr-only">{r.jours.ok ? " : rempli" : " : non rempli"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
