import type { Metadata } from "next";
import Link from "next/link";
import { AjoutPersonnage } from "@/components/personnages/AjoutPersonnage";
import { Apparition } from "@/components/ui/Apparition";
import { CartePersonnage } from "@/components/ui/CartePersonnage";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { EtatVide } from "@/components/ui/EtatVide";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
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
      <EnTetePage surTitre="Ressources" titre="Personnages" sousTitre="Vous, et ceux qui parlent dans vos vidéos." />

      {personnages.length === 0 ? (
        <EtatVide icone="personnages" titre="Personne pour l'instant" phrase="Commencez par vous : votre visage et votre voix." />
      ) : (
        <>
          <Apparition>
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Où en sont vos personnages">
              <li>
                <Pastille ton={prets === personnages.length ? "sauge" : "neutre"} icone="valide" taille="md">
                  {prets} sur {personnages.length} {prets > 1 ? "prêts" : "prêt"} à tourner
                </Pastille>
              </li>
              <li>
                <Pastille ton="neutre" icone="visage" taille="md">
                  {visages} {visages > 1 ? "visages prêts" : "visage prêt"}
                </Pastille>
              </li>
              <li>
                <Pastille ton="neutre" icone="micro" taille="md">
                  {voix} {voix > 1 ? "voix prêtes" : "voix prête"}
                </Pastille>
              </li>
            </ul>
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
