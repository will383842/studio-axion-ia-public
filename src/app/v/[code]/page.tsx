import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CadrePublic, LogoPublic, MessagePublic } from "@/components/annexes/PagePublique";
import { Icone } from "@/components/ui/Icone";
import { LecteurVideo } from "@/components/ui/LecteurVideo";
import { Pastille } from "@/components/ui/Pastille";
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
    <CadrePublic>
      <header className="mb-5 flex w-full max-w-3xl items-center justify-between">
        <LogoPublic />
        <Pastille ton="neutre" taille="md" icone="cadenas">
          Lien privé
        </Pastille>
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
            <a href={p.video} download className="inline-flex min-h-12 items-center gap-2 rounded-full bg-orange px-6 font-semibold text-sur-orange transition-colors hover:bg-orange-vif">
              <Icone nom="telecharger" size={18} />
              Télécharger
            </a>
          </div>
        )}
      </div>
    </CadrePublic>
  );
}

/** Lien qui n'a jamais existé : une phrase, aucun bouton vers la console. */
function LienIntrouvable() {
  return (
    <CadrePublic>
      <LogoPublic className="self-start sm:self-center" />
      <MessagePublic icone={<Icone nom="lien" size={24} />} titre="Lien introuvable" phrase="Vérifiez l'adresse, ou demandez le lien à la personne qui vous l'a envoyé." />
    </CadrePublic>
  );
}
