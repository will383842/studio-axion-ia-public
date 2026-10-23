import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/coquille/Logo";
import { Icone } from "@/components/ui/Icone";
import { LecteurVideo } from "@/components/ui/LecteurVideo";
import type { Ratio } from "@/domaine/types";
import { chrono } from "@/lib/dates";
import { resoudrePartage } from "@/services/partages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Vidéo partagée",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

const RATIOS: Ratio[] = ["9:16", "1:1", "4:5", "16:9"];

/**
 * PAGE PUBLIQUE D'UN LIEN PRIVÉ (B.8 #10) — sans session, lecteur seul, noindex.
 * Lien expiré, révoqué ou inconnu : notFound() AVANT tout rendu → vrai statut d'erreur HTTP
 * et page soignée (not-found.tsx de ce dossier). Le statut 410 est posé par src/proxy.ts (état demandé à /api/partages/[code]).
 */
export default async function PagePartage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Code qui n'a jamais existé (E2E-1 n° 30) : page « Lien introuvable », servie en 404 par src/proxy.ts.
  if (code === "lien-introuvable") return <LienIntrouvable />;
  const p = await resoudrePartage(code);
  if (p.etat !== "ok") notFound();
  const ratio = RATIOS.includes(p.ratio as Ratio) ? (p.ratio as Ratio) : "9:16";
  const paysage = ratio === "16:9";

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center px-4 pb-8 pt-5">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[70vh] lueur-forte opacity-70" />
      <header className="mb-5 flex w-full max-w-3xl items-center justify-between">
        <Logo />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-trait bg-surface-1/80 px-3 py-1.5 text-xs font-semibold text-texte-doux backdrop-blur">
          <Icone nom="cadenas" size={13} />
          Lien privé
        </span>
      </header>

      <div className={paysage ? "w-full max-w-3xl" : "w-full max-w-md"}>
        <LecteurVideo src={p.video} affiche={p.vignette} ratio={ratio} titre={p.titre} className={paysage ? "w-full" : "w-auto"} />
        <h1 className="mt-5 text-center text-2xl leading-tight text-texte sm:text-3xl">{p.titre}</h1>
        <p className="mt-2 flex items-center justify-center gap-3 text-sm text-texte-faible">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Icone nom="horloge" size={14} />
            {chrono(p.dureeSec)}
          </span>
        </p>
        {p.telechargement && (
          <div className="mt-6 flex justify-center">
            <a href={p.video} download className="inline-flex min-h-12 items-center gap-2 rounded-full bg-orange px-6 font-semibold text-sur-orange shadow-orange transition-colors hover:bg-orange-vif">
              <Icone nom="telecharger" size={18} />
              Télécharger
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

/** Lien qui n'a jamais existé : une phrase, aucun bouton vers la console. */
function LienIntrouvable() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center px-4 py-6">
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[60vh] lueur" />
      <Logo className="self-start sm:self-center" />
      <div className="flex max-w-sm flex-1 flex-col items-center justify-center text-center">
        <span className="mb-6 grid size-14 place-items-center rounded-full bg-orange text-sur-orange shadow-orange">
          <Icone nom="lien" size={24} />
        </span>
        <h1 className="text-[28px] leading-tight text-texte">Lien introuvable</h1>
        <p className="mt-3 text-texte-doux">Vérifiez l&apos;adresse, ou demandez le lien à la personne qui vous l&apos;a envoyé.</p>
      </div>
    </main>
  );
}
