import type { Metadata } from "next";
import { formatsEcrivables } from "@/components/generateur/donnees";
import { EcranSujet } from "@/components/generateur/EcranSujet";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { listerIdees } from "@/services/idees";
import { exigerSession } from "@/services/auth";
import { apprentissageActif } from "@/services/apprentissage";
import { retourValide } from "@/domaine/retour-video";
import { formaterMontant } from "@/lib/montants";
import { prixLancement } from "@/services/boucle-generation";
import { claudeBranche } from "@/services/generation-claude";
import { libelleAxe } from "@/services/mesures-completes";
import { listerSeries } from "@/services/series";

export const metadata: Metadata = { title: "Nouveau sujet" };
export const dynamic = "force-dynamic";

/**
 * ÉCRAN SUJET (plan v5 B.6.5, lot G1b ; ancien « Atelier », même adresse). ?idee=<id> (« En faire un sujet »),
 * ?texte=… (idée préremplie), ?structure=…&famille=… (« Refaire cette structure », depuis « Ce qui marche »), ?retour=… (correcteur 3, B1 : « Nouvelle vidéo » › « Une idée », retour à la vidéo).
 * G4 : l'écriture passe par la chaîne ; elle reste un essai (0 €) tant que Claude n'est pas branché. Prix calculé (B11).
 */
export default async function PageSujet({ searchParams }: { searchParams: Promise<{ idee?: string; texte?: string; retour?: string; structure?: string; famille?: string }> }) {
  await exigerSession();
  const sp = await searchParams;
  const idee = sp.idee ? (await listerIdees({ inclureArchivees: true })).find((i) => i.id === sp.idee) : undefined;
  const retour = retourValide(sp.retour);
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage retour={retour ? { href: retour, libelle: "Ma vidéo" } : { href: "/ecrire", libelle: "Écrire" }} titre="Nouveau sujet" className="mb-4" />
      <EcranSujet
        ideeInitiale={idee?.texte ?? sp.texte ?? ""}
        ideeId={idee?.id}
        formats={formatsEcrivables()}
        ecritureSimulee={!(await claudeBranche())}
        prix={formaterMontant(await prixLancement())}
        retour={retour}
        series={(await listerSeries()).map((s) => ({ id: s.id, nom: s.nom }))}
        imposee={sp.structure && (await apprentissageActif()) ? { structure: sp.structure, libelle: libelleAxe("structure", sp.structure), ...(sp.famille ? { famille: sp.famille } : {}) } : undefined}
      />
    </div>
  );
}
