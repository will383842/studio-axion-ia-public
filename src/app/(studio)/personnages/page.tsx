import type { Metadata } from "next";
import Link from "next/link";
import { AjoutPersonnage } from "@/components/personnages/AjoutPersonnage";
import { Apparition } from "@/components/ui/Apparition";
import { Carte } from "@/components/ui/Carte";
import { CartePersonnage } from "@/components/ui/CartePersonnage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { Portrait } from "@/components/ui/Portrait";
import { moiExiste } from "@/services/B-personnages-bibliotheque";
import { listerPersonnages } from "@/services/personnages";
import { exigerSession } from "@/services/auth";

export const metadata: Metadata = { title: "Personnages" };
export const dynamic = "force-dynamic";

/** PERSONNAGES (B.8 #13) — niveau 1. Propriétaire : développeur B. */
export default async function PagePersonnages({ searchParams }: { searchParams: Promise<{ ajouter?: string }> }) {
  await exigerSession();
  const [{ ajouter }, personnages, moi] = await Promise.all([searchParams, listerPersonnages(), moiExiste()]);
  const sansAccord = personnages.filter((p) => !p.accordValide);
  const prets = personnages.filter((p) => p.utilisable).length;
  const visages = personnages.reduce((n, p) => n + p.visages.filter((v) => v.statut === "pret").length, 0);
  const voix = personnages.filter((p) => p.voix.some((v) => v.statut === "pret")).length;

  return (
    <div>
      <EnTetePage titre="Personnages" sousTitre="Vous, et ceux qui parlent dans vos vidéos." />

      {personnages.length === 0 ? (
        <EtatVide icone="personnages" titre="Personne pour l'instant" phrase="Commencez par vous : votre visage et votre voix." />
      ) : (
        <>
          <Apparition>
            <Carte lueur sansMarge className="mb-4 grid grid-cols-3 divide-x divide-trait">
              {[
                { valeur: `${prets}/${personnages.length}`, libelle: "prêts à tourner", icone: "valide" as const },
                { valeur: visages, libelle: visages > 1 ? "visages prêts" : "visage prêt", icone: "visage" as const },
                { valeur: voix, libelle: voix > 1 ? "voix prêtes" : "voix prête", icone: "micro" as const },
              ].map((c) => (
                <div key={c.icone} className="flex flex-col items-center gap-1 px-2 py-4 text-center">
                  <Icone nom={c.icone} size={18} className="text-orange-vif" />
                  <span className="font-titre text-2xl tabular-nums text-texte sm:text-3xl">{c.valeur}</span>
                  <span className="text-xs text-texte-doux">{c.libelle}</span>
                </div>
              ))}
            </Carte>
          </Apparition>

          {sansAccord.map((p) => (
            <Apparition key={p.personnage.id} index={1}>
              <Link
                href={`/personnages/${p.personnage.id}?onglet=accord`}
                className="mb-4 flex min-h-14 items-center gap-3 rounded-carte border border-ambre/40 bg-ambre-doux p-3 transition-colors hover:border-ambre"
              >
                <Portrait nom={p.personnage.nom} photo={p.photo} taille="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-texte">Accord de {p.personnage.nom}</span>
                  <span className="block text-sm text-ambre">À enregistrer avant tout double</span>
                </span>
                <Icone nom="chevron-droite" size={18} className="text-ambre" />
              </Link>
            </Apparition>
          ))}

          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {personnages.map((p, i) => (
              <li key={p.personnage.id}>
                <Apparition index={i + 2} className="h-full">
                  <CartePersonnage
                    href={`/personnages/${p.personnage.id}`}
                    className="h-full"
                    personnage={{
                      id: p.personnage.id,
                      nom: p.personnage.nom,
                      role: p.personnage.role,
                      nature: p.personnage.nature,
                      photo: p.photo,
                      visagesPrets: p.visages.filter((v) => v.statut === "pret").length,
                      visagesTotal: p.visages.length,
                      voixPrete: p.voix.some((v) => v.statut === "pret"),
                      accordValide: p.accordValide,
                    }}
                  />
                </Apparition>
              </li>
            ))}
          </ul>
        </>
      )}

      <AjoutPersonnage moiExiste={moi} ouvertAuDepart={ajouter === "1"} />
    </div>
  );
}
