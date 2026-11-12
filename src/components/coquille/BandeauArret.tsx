import Link from "next/link";

/** NAV D2 : rappel visible sur tous les écrans tant que « Tout arrêter » est actif (rien ne part vers Zernio). */
export function BandeauArret() {
  return (
    <div role="status" data-bandeau="arret" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-carte border border-brique/30 bg-brique-doux/40 px-4 py-3 text-sm text-texte">
      <strong className="font-semibold text-brique">Tout est à l’arrêt.</strong>
      <span className="text-texte-doux">Aucun envoi ne part vers Zernio.</span>
      <Link href="/reglages#connexions" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
        Reprendre dans les réglages
      </Link>
    </div>
  );
}
