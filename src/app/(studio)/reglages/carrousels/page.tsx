import type { Metadata } from "next";
import Link from "next/link";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { exigerSession } from "@/services/auth";
import { generateurAllume, type FamilleVisuelle } from "@/visuels/interrupteur";
import { basculerGenerateurFormulaire } from "./actions";

export const metadata: Metadata = { title: "Carrousels" };
export const dynamic = "force-dynamic";

const FAMILLES: { id: FamilleVisuelle; libelle: string }[] = [
  { id: "carrousels", libelle: "Carrousels" },
  { id: "infographies", libelle: "Infographies" },
  { id: "carrousels-continus", libelle: "Carrousels continus" },
];

/** Réglages › Carrousels : état des trois générateurs, éteints tant que vous ne les allumez pas. */
export default async function PageReglagesCarrousels() {
  await exigerSession();
  const etats = await Promise.all(FAMILLES.map(async (f) => ({ ...f, allume: await generateurAllume(f.id) })));
  return (
    <div className="mx-auto w-full max-w-xl">
      <EnTetePage retour={{ href: "/reglages", libelle: "Réglages" }} titre="Carrousels" sousTitre="Allumez un générateur seulement quand vous voulez l'utiliser." />
      <p className="mb-3 text-sm text-texte-doux">Écriture : simulation (0 $) ou texte écrit en session ; API payante : verrouillée</p>
      <Link href="/carrousels" className="mb-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        Ouvrir Carrousels
      </Link>
      <ul className="flex flex-col gap-3">
        {etats.map((e) => (
          <li key={e.id} className="flex flex-col gap-2 rounded-2xl border border-trait p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{e.libelle}</span>
              <span>{e.allume ? "Allumé" : "Éteint"}</span>
            </div>
            {!e.allume && <p className="text-sm text-texte-doux">Éteint : rien ne s&apos;écrit ni ne se rend tant que vous ne l&apos;allumez pas.</p>}
            <form action={basculerGenerateurFormulaire}>
              <input type="hidden" name="famille" value={e.id} />
              <input type="hidden" name="valeur" value={e.allume ? "non" : "oui"} />
              <button type="submit" className="min-h-11 rounded-full px-4 font-semibold">
                {e.allume ? "Éteindre" : "Allumer"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
