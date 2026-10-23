import Link from "next/link";
import { CarteBrouillon } from "@/components/creation/CarteBrouillon";
import { Apparition } from "@/components/ui/Apparition";
import { Carrousel } from "@/components/ui/Carrousel";
import { Carte } from "@/components/ui/Carte";
import { EnTeteSection } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { JaugeBudget } from "@/components/ui/JaugeBudget";
import { CarteVideo } from "@/components/videos/CarteVideo";
import { listerFormatsActifs } from "@/formats";
import { cn } from "@/lib/cn";
import { dateLongue } from "@/lib/dates";
import { resumeAccueil } from "@/services/accueil";
import { resumeCreditsAccueil } from "@/services/credits";
import { vueCreditClaude } from "@/services/credit-claude";
import { BandeauCredits } from "./_accueil/BandeauCredits";
import { CarteCredits } from "./_accueil/CarteCredits";
import { CarteCreditClaude } from "./_accueil/CarteCreditClaude";
import { EnCours } from "./_accueil/EnCours";
import { IdeeRapide } from "./_accueil/IdeeRapide";
import { TuilesEcrire } from "./_accueil/TuilesEcrire";
import { compteursGenerateur } from "@/services/generateur";
import { compterMesuresASaisir } from "@/services/mesures";
import { exigerSession } from "@/services/auth";
import { RappelsEnvoi } from "@/components/facecam/RappelsEnvoi";
import { versionsFacecamAEnvoyer } from "@/services/envoi-facecam";
import { formateurDate } from "@/lib/intl";

export const dynamic = "force-dynamic";

function salutation(): string {
  const h = Number(formateurDate("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(new Date()));
  return h >= 18 || h < 5 ? "Bonsoir Williams" : "Bonjour Williams";
}

/**
 * ACCUEIL (B.8 #2 + AV2.4-3) — niveau de finition 1.
 * Mobile : une colonne, la grande carte « Nouvelle vidéo » d'abord. Ordinateur : la vie des vidéos à gauche, le jour et les réglages à droite.
 */
export default async function PageAccueil() {
  await exigerSession();
  const [r, credits, ecrire, mesuresASaisir, facecamAEnvoyer, creditClaude] = await Promise.all([resumeAccueil(), resumeCreditsAccueil(), compteursGenerateur(), compterMesuresASaisir(), versionsFacecamAEnvoyer(), vueCreditClaude().catch((e) => {
      console.error("[accueil] crédit Claude restant illisible", e);
      return null;
    })]);
  const actifs = listerFormatsActifs();
  const aujourdhui: { libelle: string; nombre: number; icone: NomIcone; href: string }[] = [
    // « Vidéos » : les tuiles d'Écrire comptent des SCRIPTS sous les mêmes mots (E2E-1 n° 8).
    { libelle: "Vidéos à relire", nombre: r.aujourdhui.nbARelire, icone: "oeil", href: "/videos?etape=a_relire" },
    { libelle: "Vidéos à programmer", nombre: r.aujourdhui.nbAProgrammer, icone: "calendrier", href: "/calendrier" },
    { libelle: "Publiées aujourd'hui", nombre: r.aujourdhui.publicationsDuJour.length, icone: "megaphone", href: "/calendrier" },
  ];
  const pret: { libelle: string; ok: boolean; icone: NomIcone; href: string }[] = [
    { libelle: "Visage", ok: r.pret.visage, icone: "visage", href: "/personnages" },
    { libelle: "Voix", ok: r.pret.voix, icone: "micro", href: "/personnages" },
    { libelle: "LUT", ok: r.pret.lut, icone: "contraste", href: "/bibliotheque/lut" },
    { libelle: "Logo", ok: r.pret.logo, icone: "certifie", href: "/bibliotheque/logo" },
  ];
  const nbPret = pret.filter((p) => p.ok).length;

  return (
    <div className="space-y-8">
      <Apparition>
        <p className="text-sm font-semibold capitalize text-texte-faible">{dateLongue(new Date().toISOString())}</p>
        <h1 className="mt-1 text-[32px] leading-tight text-texte sm:text-4xl">{salutation()}</h1>
      </Apparition>

      <BandeauCredits cartes={credits.cartes} />

      <Apparition index={1}>
        <Link
          href="/nouvelle"
          className="group relative isolate block overflow-hidden rounded-[24px] border border-orange/40 bg-surface-1 p-6 shadow-orange transition-transform duration-300 ease-studio hover:-translate-y-0.5 sm:p-8"
        >
          <div aria-hidden className="absolute inset-0 -z-10 lueur-forte" />
          <div aria-hidden className="absolute -right-10 -top-10 -z-10 size-48 rounded-full bg-orange/20 blur-3xl transition-transform duration-500 group-hover:scale-125" />
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              {/* Vérif V3 : 40 px fixes ne tenaient pas à 390 px (« NOUVELL / E ») ; la taille suit la largeur. */}
              <p className="titre-affiche text-[clamp(28px,9vw,40px)] text-texte sm:text-6xl">
                Nouvelle
                <br />
                <span className="text-orange-vif">vidéo</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {actifs.map((f) => (
                  <span key={f.id} className="inline-flex items-center gap-1.5 rounded-full bg-fond/60 px-3 py-1 text-xs font-semibold text-texte-doux backdrop-blur">
                    <Icone nom={f.icone} size={13} />
                    {f.nom}
                  </span>
                ))}
              </div>
            </div>
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-orange text-sur-orange shadow-orange transition-transform duration-300 group-hover:rotate-90 sm:size-20">
              <Icone nom="plus" size={32} strokeWidth={2.4} />
            </span>
          </div>
        </Link>
      </Apparition>

      {/* Plan facecam v4 (lot D) : envoi en pause et vidéos face caméra à envoyer (rien sinon). */}
      <RappelsEnvoi aEnvoyer={facecamAEnvoyer} />

      {r.alertes.length > 0 && (
        <ul className="space-y-2">
          {r.alertes.map((a, i) => (
            <li key={a.id}>
              <Apparition index={i + 2}>
                <Link
                  href={a.lien}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-sm font-semibold transition-colors",
                    a.ton === "brique" ? "border-brique/30 bg-brique-doux text-brique hover:border-brique/60" : "border-ambre/30 bg-ambre-doux text-ambre hover:border-ambre/60",
                  )}
                >
                  <Icone nom="attention" size={18} className="shrink-0" />
                  <span className="flex-1">{a.message}</span>
                  <Icone nom="chevron-droite" size={16} className="shrink-0" />
                </Link>
              </Apparition>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-8">
          {r.enCours.length > 0 && (
            // Le titre et son compteur vivent DANS la liste en direct : ils suivent les fabrications (E2E-1 n° 26).
            <EnCours initial={r.enCours} />
          )}

          <section className="lg:hidden">
            <Aujourdhui elements={aujourdhui} />
          </section>

          {/* Générateur de scripts (lot G1b) : les vues rapides d'Écrire. */}
          <TuilesEcrire c={{ ...ecrire, mesuresASaisir }} />

          {r.brouillons.length > 0 && (
            <section>
              <EnTeteSection titre="Brouillons" compteur={r.brouillons.length} lien={{ href: "/videos?vue=brouillons" }} />
              <Carrousel libelle="Brouillons" largeurElement="w-[46%] sm:w-52">
                {r.brouillons.map((v) => (
                  <CarteBrouillon key={v.id} video={v} />
                ))}
              </Carrousel>
            </section>
          )}

          <div className="lg:hidden">
            <IdeeRapide />
          </div>

          <section>
            <EnTeteSection titre="Dernières vidéos" lien={r.dernieres.length ? { href: "/videos" } : undefined} />
            {r.dernieres.length ? (
              <Carrousel libelle="Dernières vidéos" largeurElement="w-[44%] sm:w-48">
                {r.dernieres.map((v, i) => (
                  <CarteVideo key={v.id} video={v} ratioForce="9:16" prioritaire={i < 2} />
                ))}
              </Carrousel>
            ) : (
              <EtatVide compact icone="film" titre="Aucune vidéo pour l'instant" phrase="La première est à cinq touches d'ici." />
            )}
          </section>
        </div>

        <aside aria-label="En un coup d'œil" className="space-y-4">
          <section className="hidden lg:block">
            <Aujourdhui elements={aujourdhui} />
          </section>
          <div className="hidden lg:block">
            <IdeeRapide />
          </div>

          <Carte lueur={nbPret < pret.length}>
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-sm font-semibold text-texte-doux">Prêt pour une vraie vidéo ?</p>
              <span className={cn("font-titre text-lg tabular-nums", nbPret === pret.length ? "text-sauge" : "text-texte")}>
                {nbPret}/{pret.length}
              </span>
            </div>
            <ul className="grid grid-cols-4 gap-2">
              {pret.map((p) => (
                <li key={p.libelle}>
                  <Link href={p.href} className="group flex flex-col items-center gap-2 rounded-xl py-1">
                    <span
                      className={cn(
                        "relative grid size-12 place-items-center rounded-full transition-transform duration-200 group-hover:scale-105",
                        p.ok ? "bg-sauge-doux text-sauge" : "border border-dashed border-trait-fort bg-surface-2 text-texte-faible",
                      )}
                    >
                      <Icone nom={p.icone} size={19} />
                      <span className={cn("absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full ring-2 ring-surface-1", p.ok ? "bg-sauge text-fond" : "bg-surface-3 text-texte-doux")}>
                        <Icone nom={p.ok ? "coche" : "plus"} size={11} strokeWidth={3} />
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-texte-doux group-hover:text-texte">{p.libelle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Carte>

          <Link href="/reglages#budget" className="block">
            <Carte interactive>
              <p className="mb-3 text-sm font-semibold text-texte-doux">Budget du mois</p>
              <JaugeBudget depense={r.budget.depense} budget={r.budget.budget} />
            </Carte>
          </Link>

          {/* Crédit Claude restant (estimé) : affichage seulement ; l'Accueil ne casse jamais s'il manque. */}
          {creditClaude && <CarteCreditClaude vue={creditClaude} />}

          {/* Lot « crédits » (02/10) : solde des services payants reliés, et départ des brouillons « dès que possible ». */}
          <CarteCredits cartes={credits.cartes} brouillonsPrets={credits.brouillonsPrets} />
        </aside>
      </div>
    </div>
  );
}

function Aujourdhui({ elements }: { elements: { libelle: string; nombre: number; icone: NomIcone; href: string }[] }) {
  return (
    <>
      <EnTeteSection titre="Aujourd'hui" />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {elements.map((a) => (
          <Link
            key={a.libelle}
            href={a.href}
            className={cn(
              "group flex min-h-24 flex-col gap-2 rounded-carte border bg-surface-1 p-3 transition-colors hover:border-trait-fort",
              a.nombre ? "border-trait" : "border-trait/60",
            )}
          >
            <Icone nom={a.icone} size={18} className={cn("transition-colors group-hover:text-orange-vif", a.nombre ? "text-orange-vif" : "text-texte-faible")} />
            <span className={cn("font-titre text-4xl tabular-nums leading-none", a.nombre ? "text-texte" : "text-texte-faible")}>{a.nombre}</span>
            <span className="text-xs font-semibold leading-tight text-texte-doux">{a.libelle}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
