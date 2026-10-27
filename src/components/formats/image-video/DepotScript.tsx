"use client";

/**
 * ÉCRAN 1 · MODE SCRIPT COMPLET · « Coller mon script complet ». Will colle le texte que la voix doit dire ; l'IA n'écrit
 * rien et ne change aucun mot : elle conçoit seulement le schéma d'après ce texte, puis la vidéo se fabrique comme avec
 * une image. Même bouton, même prix « au plus » et mêmes réseaux que le mode texte (rien ne part sans ce prix confirmé).
 * Un refus (script trop court, trop long, chiffre absent du schéma) s'affiche en phrase simple et le script reste là.
 */
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { deposerScriptImageVideoAction } from "@/app/(studio)/image-video/actions";
import { BoutonFabriquer } from "@/components/formats/commun/BoutonFabriquer";
import { BarreActionCollee } from "@/components/ui/BarreActionCollee";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import { nombreDeMotsDuScript, refusScriptColle, SCRIPT_CARACTERES_MAX, SCRIPT_MOTS_MAX } from "@/moteurs/montage-image-video/texte/script-limites";
import { euros } from "./vue";

export function DepotScript({ script, onScript, reseaux, montant, blocage, onRefus, children }: { script: string; onScript: (t: string) => void; reseaux: ReseauIV[]; montant: number; blocage?: string; onRefus: (phrase: string | null) => void; /** Sélecteur de réseaux, placé entre le script et la barre du prix. */ children?: ReactNode }) {
  const router = useRouter();
  const mots = nombreDeMotsDuScript(script);
  const pret = !refusScriptColle(script) && reseaux.length > 0 && !blocage;

  async function fabriquer(accord: number): Promise<{ centimes: number } | void> {
    onRefus(null);
    const r = await deposerScriptImageVideoAction({ script, reseaux, accordCentimes: accord });
    if (!r.ok) return void onRefus(r.message);
    if (r.donnees.statut === "accord-requis") return { centimes: r.donnees.centimes };
    if (r.donnees.statut === "refusee") return void onRefus(r.donnees.phrase);
    router.push(`/image-video/${r.donnees.videoId}`);
  }

  return (
    <>
      <ZoneTexte
        libelle="Collez votre script complet"
        aide={`La voix dira vos mots tels quels : rien n'est réécrit. Seul le schéma est conçu d'après votre texte. ${mots} mot${mots > 1 ? "s" : ""} sur ${SCRIPT_MOTS_MAX} au plus.`}
        placeholder="Collez ici le texte exact que la voix doit dire, du début à la fin."
        value={script}
        longueurMax={SCRIPT_CARACTERES_MAX}
        rows={8}
        onChange={(e) => {
          onScript(e.target.value);
          onRefus(null);
        }}
      />
      {children}
      {blocage && <p className="text-[15px] text-texte-doux">{blocage}</p>}
      <BarreActionCollee>
        <BoutonFabriquer montantCentimes={montant} libelle={`Concevoir le schéma et fabriquer la vidéo (au plus ${euros(montant)})`} desactive={!pret} onFabriquer={fabriquer} message="Au plus ce prix. Seule la conception du schéma part maintenant : la voix attend votre accord sur le script." />
      </BarreActionCollee>
    </>
  );
}
