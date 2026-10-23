import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { exigerSession } from "@/services/auth";
import { depots } from "@/services/_commun";
import { DepartIpad } from "@/components/facecam/DepartIpad";

export const metadata: Metadata = { title: "Je lis" };
export const dynamic = "force-dynamic";

/**
 * « Je lis » sur un autre appareil (lot G4, B.4.7) : le texte du téléprompteur en grand, une prise par phrase,
 * à ouvrir sur la tablette ou l'ordinateur posé derrière le téléphone qui filme.
 */
export default async function PageLire({ params }: { params: Promise<{ id: string; varianteId: string }> }) {
  await exigerSession();
  const { id, varianteId } = await params;
  const v = await depots().variantes.obtenir(varianteId);
  if (!v || v.scriptMaitreId !== id || !v.prompteur) notFound();
  const prises = v.prompteur.split("\n").filter((l) => l.trim());
  const texte = (
    <div className="mx-auto max-w-3xl">
      <EnTetePage retour={{ href: `/ecrire/sujets/${id}`, libelle: "Sujet" }} surTitre={v.code} titre="Je lis" className="mb-4" />
      <div className="mb-4 flex justify-end">
        <BoutonCopier texte={v.prompteur} />
      </div>
      <ol className="space-y-6">
        {prises.map((l, i) => (
          <li key={i} className="rounded-carte bg-surface-1 p-5 text-[28px] font-semibold leading-snug text-texte">
            {l.replace(/^\d+\.\s*/, "").split(" / ").map((ligne, j) => (
              <span key={j} className="block">
                {ligne}
              </span>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
  // Plan facecam v4 (lot D) : écran de départ (4 pictogrammes, « C'est parti ») pour le face caméra seulement.
  return v.formatId === "facecam" ? <DepartIpad varianteId={v.id}>{texte}</DepartIpad> : texte;
}
