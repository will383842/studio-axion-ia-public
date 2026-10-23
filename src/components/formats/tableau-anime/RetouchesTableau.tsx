"use client";

/**
 * RETOUCHES DU TABLEAU ANIMÉ sur « Votre vidéo » (raccord 2) : le coût de la voix, les boutons du catalogue fermé et,
 * pour le bouton choisi, ses paramètres en listes fermées (`parametres.ts`). Une retouche payante montre son prix,
 * renvoyé par le serveur, et ne part qu'après « Confirmer » (le montant confirmé est renvoyé tel quel).
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retoucherTableauAction } from "@/app/(studio)/videos/actions-tableau";
import { Bouton } from "@/components/ui/Bouton";
import { Dialogue } from "@/components/ui/Dialogue";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { formaterMontant } from "@/lib/montants";
import type { BoutonRetoucheTableau, ChoixRetoucheTableau } from "@/services/tableau-vue";
import { BoutonsRetoucheTableau } from "./BoutonsRetouche";
import { CoutVoixTableau } from "./CoutVoix";
import { BESOINS, elementsPour, operationDe, scenesPour, valeursPour, type Saisie } from "./parametres";

export function RetouchesTableau({ videoId, retouches, choix, coutCentimes, possible = true }: { videoId: string; retouches: readonly BoutonRetoucheTableau[]; choix: ChoixRetoucheTableau | null; coutCentimes: number; possible?: boolean }) {
  const router = useRouter();
  const [cle, setCle] = useState<string | null>(null);
  const [saisie, setSaisie] = useState<Saisie>({});
  const [prix, setPrix] = useState<number | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const bouton = retouches.find((r) => r.cle === cle);
  const besoin = cle ? BESOINS[cle] : undefined;
  const scenes = cle && choix ? scenesPour(cle, choix) : [];
  const scene = choix?.scenes.find((s) => s.id === saisie.sceneId);
  const elements = cle ? elementsPour(cle, scene) : [];
  const valeurs = cle && choix ? valeursPour(cle, choix, saisie) : [];
  const operation = cle ? operationDe(cle, saisie) : null;

  function ouvrir(c: string) {
    setCle(c);
    setSaisie({});
    setPrix(null);
    setRefus(null);
  }
  function changer(s: Saisie) {
    setSaisie(s);
    setPrix(null);
    setRefus(null);
  }
  function envoyer() {
    if (!operation) return;
    demarrer(async () => {
      const r = await retoucherTableauAction(videoId, operation, prix ?? undefined);
      if (!r.ok) return setRefus(r.message);
      if (r.donnees.statut === "refusee") return setRefus(r.donnees.phrase);
      if (r.donnees.statut === "accord-requis") return setPrix(r.donnees.centimes);
      notifier.succes("Retouche lancée", "Seules les scènes changées sont refaites.");
      setCle(null);
      router.refresh();
    });
  }

  if (!choix || !retouches.length) return <CoutVoixTableau centimes={coutCentimes} />;
  return (
    <section aria-label="Retoucher" className="space-y-3">
      <CoutVoixTableau centimes={coutCentimes} />
      <BoutonsRetoucheTableau operations={retouches} onChoisir={ouvrir} possible={possible && !enCours} enCours={enCours ? cle : null} />
      <Dialogue
        ouvert={!!bouton}
        onOuvertChange={(v) => !v && setCle(null)}
        titre={bouton?.libelle ?? ""}
        pied={
          <Bouton chargement={enCours} disabled={!operation} onClick={envoyer}>
            {prix !== null ? `Confirmer ${formaterMontant({ centimes: prix, devise: "EUR" })}` : "Retoucher"}
          </Bouton>
        }
      >
        <div className="space-y-4">
          {besoin?.scene &&
            (scenes.length ? (
              <SelecteurPastilles libelle="La scène" options={scenes.map((s) => ({ valeur: s.id, libelle: s.libelle }))} valeur={saisie.sceneId} onChange={(v) => changer({ sceneId: v, texte: besoin.texte === "dit" ? choix.scenes.find((s) => s.id === v)?.texteDit : undefined })} />
            ) : (
              <p className="text-[15px] text-texte-doux">Aucune scène ne s&apos;y prête dans cette vidéo.</p>
            ))}
          {besoin?.element && scene && <SelecteurPastilles libelle="L'élément" options={elements} valeur={saisie.elementId} onChange={(v) => changer({ sceneId: saisie.sceneId, elementId: v, texte: besoin.texte === "ligne" ? scene.lignes.find((l) => l.id === v)?.texte : undefined })} />}
          {besoin?.valeur && (!besoin.scene || scene) && (!besoin.element || saisie.elementId) &&
            (valeurs.length ? (
              <SelecteurPastilles libelle="Le choix" options={valeurs} valeur={saisie.valeur} defilement={valeurs.length > 8} onChange={(v) => changer({ ...saisie, valeur: v })} />
            ) : (
              <p className="text-[15px] text-texte-doux">{besoin.valeur === "appel" ? "Aucune fin n'est encore validée." : "Rien à choisir ici."}</p>
            ))}
          {besoin?.texte && (!besoin.element || saisie.elementId) && (besoin.texte !== "dit" || scene) && (
            <ZoneTexte libelle={besoin.texte === "dit" ? "Ce que dit la voix" : "Le texte écrit"} value={saisie.texte ?? ""} onChange={(e) => changer({ ...saisie, texte: e.target.value })} />
          )}
          {prix !== null && <p className="text-[15px] font-semibold text-texte">La voix est refaite : environ {formaterMontant({ centimes: prix, devise: "EUR" })}. Rien n&apos;est payé avant votre accord.</p>}
          {refus && (
            <p role="alert" className="text-[15px] text-brique">
              {refus}
            </p>
          )}
        </div>
      </Dialogue>
    </section>
  );
}
