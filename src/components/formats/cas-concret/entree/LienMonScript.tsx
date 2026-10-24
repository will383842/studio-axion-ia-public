import Link from "next/link";
import type { VueCas } from "./vue";

/** Le libellé du lien « Mon script » : écrire (aucun script), remplacer (script de l'IA), modifier (script de Will). */
export function libelleMonScript(cas: Pick<VueCas, "script" | "scriptFourni">): string {
  if (cas.script && cas.scriptFourni) return "Modifier mon script";
  if (cas.script) return "Remplacer par mon script";
  return "Écrire ou coller mon script";
}

/** Lien vers la page « Mon script » du cas (jamais en porte B). Cible de 44 px au moins. */
export function LienMonScript({ cas }: { cas: Pick<VueCas, "id" | "titre" | "script" | "scriptFourni"> }) {
  return (
    <Link
      href={`/cas-concret/script/${cas.id}`}
      aria-label={`${libelleMonScript(cas)} : ${cas.titre}`}
      className="inline-flex min-h-11 items-center rounded-sm text-[15px] font-semibold text-orange-vif underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif"
    >
      {libelleMonScript(cas)}
    </Link>
  );
}
