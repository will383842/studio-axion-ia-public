"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { chargerFeuilleAction, cocherAucunClientAction, modifierPasseportAction, publierSurLeSiteAction, reecrirePasseportAction } from "@/app/(studio)/videos/[id]/actions-site";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Champ } from "@/components/ui/Champ";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import type { RetouchePasseport } from "@/services/site-videos";
import type { ControleSite } from "@/domaine/site-videos/controles";
import type { VueFeuilleSurLeSite } from "@/domaine/site-videos/types";
import { TITRE_WEB_MAX } from "@/domaine/site-videos/passeport";
import { formaterMontant } from "@/lib/montants";

export const TEXTES_FEUILLE_SITE = {
  titre: "Relire avant le site",
  publier: "Publier sur le site",
  metteAJour: "Mettre à jour sur le site",
  aucunClient: "Aucun client nommé, aucun logo",
  aucunClientAide: "Cochez après avoir vérifié la vidéo et les textes.",
  enregistrer: "Enregistrer mes retouches",
  charge: "Un instant…",
} as const;

function pastilleDe(c: ControleSite): { ton: "sauge" | "brique" | "ambre"; icone: "coche" | "attention" } {
  if (c.ok) return { ton: "sauge", icone: "coche" };
  return c.gravite === "bloquant" ? { ton: "brique", icone: "attention" } : { ton: "ambre", icone: "attention" };
}

/** Retouches à envoyer : seulement ce qui a changé. */
function retoucheDe(base: VueFeuilleSurLeSite["passeport"], saisie: SaisieFeuille): RetouchePasseport {
  const r: RetouchePasseport = {};
  if (saisie.titreWeb.trim() !== base.titreWeb) r.titreWeb = saisie.titreWeb;
  if (saisie.resume.trim() !== base.resume) r.resume = saisie.resume;
  if (JSON.stringify(saisie.aRetenir) !== JSON.stringify(base.aRetenir)) r.aRetenir = saisie.aRetenir;
  if (JSON.stringify(saisie.questions) !== JSON.stringify(base.questions)) r.questions = saisie.questions;
  if (saisie.rubrique.trim() !== base.rubrique) r.rubrique = saisie.rubrique;
  const mots = motsDe(saisie.motsCles);
  if (JSON.stringify(mots) !== JSON.stringify(base.motsCles)) r.motsCles = mots;
  if (JSON.stringify(saisie.chapitres) !== JSON.stringify(base.chapitres.map((c) => c.libelle))) r.chapitres = base.chapitres.map((c, i) => ({ ...c, libelle: saisie.chapitres[i] ?? c.libelle }));
  return r;
}

const motsDe = (t: string) => t.split(",").map((m) => m.trim()).filter(Boolean);

interface SaisieFeuille {
  titreWeb: string;
  resume: string;
  aRetenir: string[];
  questions: { question: string; reponse: string }[];
  rubrique: string;
  motsCles: string;
  chapitres: string[];
}

function saisieDe(p: VueFeuilleSurLeSite["passeport"]): SaisieFeuille {
  return { titreWeb: p.titreWeb, resume: p.resume, aRetenir: [...p.aRetenir, "", "", ""].slice(0, Math.max(3, p.aRetenir.length)), questions: p.questions.map((q) => ({ ...q })), rubrique: p.rubrique, motsCles: p.motsCles.join(", "), chapitres: p.chapitres.map((c) => c.libelle) };
}

/** Contenu de la feuille : les champs retouchables, les contrôles, la raison qui bloque, le bouton. */
export function ContenuFeuille({ feuille: initiale }: { feuille: VueFeuilleSurLeSite }) {
  const router = useRouter();
  const [feuille, setFeuille] = useState(initiale);
  const [saisie, setSaisie] = useState(() => saisieDe(initiale.passeport));
  const [enCours, demarrer] = useTransition();
  const retouche = retoucheDe(feuille.passeport, saisie);
  const modifiee = Object.keys(retouche).length > 0;
  const bloquants = feuille.controles.controles.filter((c) => !c.ok && c.gravite === "bloquant");
  const raison = modifiee ? "Enregistrez vos retouches avant de publier." : bloquants[0]?.message;
  const peutPublier = !modifiee && feuille.controles.publiable;

  async function recharger() {
    const res = await chargerFeuilleAction(feuille.videoId);
    if (res.ok) {
      setFeuille(res.donnees);
      setSaisie(saisieDe(res.donnees.passeport));
    }
    router.refresh();
  }

  function enregistrer() {
    demarrer(async () => {
      const res = await modifierPasseportAction(feuille.videoId, retouche);
      if (!res.ok) return void notifier.erreur(res.message);
      await recharger();
      notifier.succes("Retouches enregistrées");
    });
  }

  function reecrire() {
    demarrer(async () => {
      const res = await reecrirePasseportAction(feuille.videoId);
      if (!res.ok) return void notifier.erreur(res.message);
      await recharger();
      notifier.succes("Page réécrite");
    });
  }

  function cocherAucunClient(v: boolean) {
    setFeuille({ ...feuille, aucunClient: v });
    demarrer(async () => {
      const res = await cocherAucunClientAction(feuille.videoId, v);
      if (!res.ok) notifier.erreur(res.message);
      await recharger();
    });
  }

  function publier() {
    demarrer(async () => {
      const res = await publierSurLeSiteAction(feuille.videoId);
      if (!res.ok) return void notifier.erreur(res.message);
      if (res.donnees.etat === "echec") notifier.erreur(res.donnees.message ?? "L'envoi n'a pas abouti.");
      else notifier.succes(feuille.enLigne ? "Site mis à jour" : "En ligne sur le site");
      await recharger();
    });
  }

  return (
    <div className="space-y-5">
      {feuille.simulation && (
        <p className="flex items-center gap-2 text-sm text-texte-doux">
          <PastilleEssai /> Essai : la page est envoyée à un site factice, rien n&apos;est mis en ligne.
        </p>
      )}

      <section className="space-y-3">
        <Champ libelle="Titre" aide={`${saisie.titreWeb.trim().length} / ${TITRE_WEB_MAX}`} value={saisie.titreWeb} onChange={(e) => setSaisie({ ...saisie, titreWeb: e.target.value })} />
        <ZoneTexte libelle="Résumé" longueurMax={300} value={saisie.resume} onChange={(e) => setSaisie({ ...saisie, resume: e.target.value })} />
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-semibold text-texte-doux">À retenir</legend>
          {saisie.aRetenir.map((t, i) => (
            <Champ key={i} libelle={`Point ${i + 1}`} libelleMasque value={t} onChange={(e) => setSaisie({ ...saisie, aRetenir: saisie.aRetenir.map((x, j) => (j === i ? e.target.value : x)) })} />
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-semibold text-texte-doux">Questions</legend>
          {saisie.questions.map((q, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-trait p-3">
              <Champ libelle={`Question ${i + 1}`} value={q.question} onChange={(e) => setSaisie({ ...saisie, questions: saisie.questions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} />
              <ZoneTexte libelle={`Réponse ${i + 1}`} value={q.reponse} onChange={(e) => setSaisie({ ...saisie, questions: saisie.questions.map((x, j) => (j === i ? { ...x, reponse: e.target.value } : x)) })} />
            </div>
          ))}
        </fieldset>
        <Champ libelle="Rubrique" value={saisie.rubrique} onChange={(e) => setSaisie({ ...saisie, rubrique: e.target.value })} />
        <Champ libelle="Mots-clés" aide="Séparés par des virgules." value={saisie.motsCles} onChange={(e) => setSaisie({ ...saisie, motsCles: e.target.value })} />
        {saisie.chapitres.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-semibold text-texte-doux">Chapitres</legend>
            {saisie.chapitres.map((c, i) => (
              <Champ key={i} libelle={`Chapitre ${i + 1} · ${feuille.passeport.chapitres[i]?.debutSec ?? 0} s`} value={c} onChange={(e) => setSaisie({ ...saisie, chapitres: saisie.chapitres.map((x, j) => (j === i ? e.target.value : x)) })} />
            ))}
          </fieldset>
        )}
        <p className="text-xs text-texte-faible">Version {feuille.passeport.version}</p>
        <div className="flex flex-wrap gap-2">
          <Bouton variante="secondaire" disabled={!modifiee} chargement={enCours} onClick={enregistrer}>
            {TEXTES_FEUILLE_SITE.enregistrer}
          </Bouton>
          {feuille.prixClaude && (
            <Bouton variante="contour" icone="etincelles" disabled={enCours || modifiee} onClick={reecrire}>
              {`Réécrire avec Claude (≈ ${formaterMontant(feuille.prixClaude)})`}
            </Bouton>
          )}
        </div>
      </section>

      <CaseACocher libelle={TEXTES_FEUILLE_SITE.aucunClient} detail={TEXTES_FEUILLE_SITE.aucunClientAide} coche={feuille.aucunClient} desactive={enCours} onChange={cocherAucunClient} />

      <section aria-label="Vérifications">
        <ul className="space-y-1.5">
          {feuille.controles.controles.map((c, i) => {
            const p = pastilleDe(c);
            return (
              <li key={`${c.code}-${i}`} className="flex items-start gap-2 text-sm">
                <Pastille ton={p.ton} icone={p.icone}>
                  {c.ok ? "Bon" : c.gravite === "bloquant" ? "À faire" : "À savoir"}
                </Pastille>
                <span className="min-w-0 flex-1 text-texte-doux">{c.message}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="space-y-2">
        {!peutPublier && raison && (
          <p data-raison className="flex gap-2 text-sm text-brique">
            <Icone nom="attention" size={16} className="mt-0.5 shrink-0" />
            {raison}
          </p>
        )}
        <Bouton variante="principal" pleineLargeur disabled={!peutPublier || enCours} chargement={enCours} onClick={publier}>
          {feuille.enLigne ? TEXTES_FEUILLE_SITE.metteAJour : TEXTES_FEUILLE_SITE.publier}
        </Bouton>
      </div>
    </div>
  );
}

/** Charge la page et ses vérifications au montage (la feuille n'est montée qu'ouverte, donc jamais à l'affichage de la fiche). */
function CorpsFeuille({ videoId }: { videoId: string }) {
  const [feuille, setFeuille] = useState<VueFeuilleSurLeSite | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    void chargerFeuilleAction(videoId).then((res) => {
      if (annule) return;
      if (res.ok) setFeuille(res.donnees);
      else setErreur(res.message);
    });
    return () => {
      annule = true;
    };
  }, [videoId]);

  if (erreur) return <p className="text-sm text-brique">{erreur}</p>;
  if (!feuille) return <p className="text-sm text-texte-doux">{TEXTES_FEUILLE_SITE.charge}</p>;
  return <ContenuFeuille key={feuille.passeport.version + feuille.passeport.modifieLe} feuille={feuille} />;
}

/** Feuille « Relire avant le site ». */
export function FeuilleSurLeSite({ videoId, ouverte, onOuverteChange }: { videoId: string; ouverte: boolean; onOuverteChange: (v: boolean) => void }) {
  return (
    <FeuilleBas ouverte={ouverte} onOuverteChange={onOuverteChange} titre={TEXTES_FEUILLE_SITE.titre} pleinEcran>
      <CorpsFeuille videoId={videoId} />
    </FeuilleBas>
  );
}
