import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Apparition } from "@/components/ui/Apparition";
import { Carrousel } from "@/components/ui/Carrousel";
import { CarteFormat } from "@/components/ui/CarteFormat";
import { EnTetePage, EnTeteSection } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { libelleDuree, nomCourtFormat } from "@/formats";
import { listerFormatsAvecCompteurs } from "@/services/formats";
import { listerModeles } from "@/services/modeles";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Nouvelle vidéo" };
export const dynamic = "force-dynamic";

/** NOUVELLE VIDÉO (B.8 #3 + AV2.1) — « Recommencer comme… » (mes modèles) puis la grille des formats, générée du registre. */
export default async function PageNouvelle() {
  await exigerSession();
  const [formats, modeles] = await Promise.all([listerFormatsAvecCompteurs(), listerModeles()]);
  const actifs = formats.filter((f): f is typeof f & { statut: "actif" } => f.statut === "actif");
  // Tout ce qui n'est pas actif est grisé et non cliquable (décision de Will, 17/10) : il sait ce qui n'est pas fait.
  const bientot = formats.filter((f): f is typeof f & { statut: "bientot" | "masque" } => f.statut !== "actif");
  return (
    <div>
      <EnTetePage titre="Nouvelle vidéo" sousTitre="Choisissez un format." />

      {modeles.length > 0 && (
        <section className="mb-8">
          <EnTeteSection titre="Recommencer comme…" lien={{ href: "/modeles", libelle: "Mes modèles" }} />
          <Carrousel libelle="Mes modèles" largeurElement="w-[78%] sm:w-80">
            {modeles.map((m, i) => (
              <Apparition key={m.id} index={i}>
                <Link
                  href={`/nouvelle/${m.formatId}?modele=${m.id}`}
                  className="group relative isolate flex items-center gap-3 overflow-hidden rounded-carte border border-trait bg-surface-1 p-2.5 pr-3 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-orange/50"
                >
                  <span className="relative aspect-[9/16] w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {m.vignette ? <Image src={m.vignette} alt="" fill sizes="56px" className="object-cover" /> : <Icone nom="modele" size={18} className="absolute inset-0 m-auto text-texte-faible" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-vif">
                      <Icone nom={m.format.icone} size={12} />
                      <span className="truncate">{nomCourtFormat(m.format)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[15px] font-semibold text-texte">{m.nom}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-texte-faible">
                      <Icone nom="horloge" size={12} />
                      {libelleDuree(m.dureeSec)}
                      <span>·</span>
                      {m.ratios.join(" ")}
                    </span>
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif transition-colors group-hover:bg-orange group-hover:text-sur-orange">
                    <Icone nom="repeter" size={17} />
                  </span>
                </Link>
              </Apparition>
            ))}
          </Carrousel>
        </section>
      )}

      {actifs.length ? (
        <section>
          {modeles.length > 0 && <EnTeteSection titre="Ou un format" />}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actifs.map((f, i) => (
              <li key={f.id}>
                <Apparition index={i + 1}>
                  <CarteFormat format={f} href={f.adresseCreation} />
                </Apparition>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EtatVide icone="clap" titre="Aucun format prêt" phrase="Les formats arrivent bientôt." />
      )}

      {bientot.length > 0 && (
        <section className="mt-10">
          <EnTeteSection titre="Bientôt" compteur={bientot.length} />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bientot.map((f) => (
              <li key={f.id}>
                <CarteFormat format={f} compacte />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
