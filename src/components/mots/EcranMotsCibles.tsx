"use client";

// R4 — écran « mots et cibles », par mot. Présentation pure : la vue et les services arrivent en propriétés.
// Chaque geste qui allume un envoi passe par une confirmation (Dialogue) : sans « oui », aucun service n'est appelé.
import { useEffect, useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Dialogue } from "@/components/ui/Dialogue";
import { EtatVide } from "@/components/ui/EtatVide";
import type {
  ApercuTextesVue,
  EtatMotVue,
  ServicesMotsCibles,
  VueMotsCibles,
} from "@/domaine/guide-reseau/vue-mots-cibles";
import { FicheMot } from "./FicheMot";
import { LIBELLES_ECRAN as E } from "./fiche-mot-libelles";
import {
  creerGestesMotsCibles,
  type DemandeConfirmation,
} from "./gestes-mots-cibles";
import { NouveauMot } from "./NouveauMot";
import { TableauMots } from "./TableauMots";

export interface ProprietesEcranMotsCibles {
  vue: VueMotsCibles | null;
  services: ServicesMotsCibles;
  /** Appelée après un geste réussi, pour que la page relise la vue. */
  onChange?: () => void;
}

type Filtre = "tous" | "actifs" | "brouillons" | "pause";
const FILTRES: readonly Filtre[] = ["tous", "actifs", "brouillons", "pause"];
const ETAT_DU_FILTRE: Record<Exclude<Filtre, "tous">, EtatMotVue> = {
  actifs: "actif",
  brouillons: "brouillon",
  pause: "pause",
};

interface Question extends DemandeConfirmation {
  resoudre: (oui: boolean) => void;
}
interface Message {
  ok: boolean;
  phrase: string;
}

/**
 * Textes lus, par mot. Chaque lecture a un numéro : une réponse en retard (ancienne lecture du même mot)
 * est ignorée, elle ne peut pas écraser une réponse plus récente.
 */
function useApercus(services: ServicesMotsCibles) {
  const [apercus, setApercus] = useState<Record<string, ApercuTextesVue>>({});
  const numeros = useRef<Record<string, number>>({});
  const charger = async (mot: string) => {
    const n = (numeros.current[mot] ?? 0) + 1;
    numeros.current[mot] = n;
    let r: ApercuTextesVue;
    try {
      r = await services.apercuTextes(mot);
    } catch {
      r = { ok: false, phrase: E.apercuIllisible };
    }
    if (numeros.current[mot] === n) setApercus((p) => ({ ...p, [mot]: r }));
  };
  const oublier = (mot: string) =>
    setApercus((p) =>
      Object.fromEntries(Object.entries(p).filter(([k]) => k !== mot)),
    );
  return { apercus, charger, oublier };
}

export function EcranMotsCibles({
  vue,
  services,
  onChange,
}: ProprietesEcranMotsCibles) {
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [creation, setCreation] = useState(false);
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [motOuvert, setMotOuvert] = useState<string | null>(null);
  const { apercus, charger, oublier } = useApercus(services);
  const [question, setQuestion] = useState<Question | null>(null);
  const titreFicheRef = useRef<HTMLHeadingElement | null>(null);
  const ouvrirRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // La fiche s'ouvre : son titre prend le focus pour que le lecteur d'écran l'annonce.
  useEffect(() => {
    if (motOuvert !== null) titreFicheRef.current?.focus();
  }, [motOuvert]);

  if (vue === null)
    return (
      <EtatVide
        icone="bouclier"
        titre={E.vueNulle.titre}
        phrase={E.vueNulle.phrase}
        compact
      />
    );

  const ouvrir = (mot: string) => {
    setMotOuvert(mot);
    oublier(mot);
    void charger(mot);
  };
  const fermerFiche = () => {
    const mot = motOuvert;
    setMotOuvert(null);
    // Le focus revient au bouton « Ouvrir » du mot.
    if (mot !== null) ouvrirRefs.current[mot]?.focus();
  };

  // La fenêtre est modale : une seule question à la fois.
  const confirmer = (demande: DemandeConfirmation) =>
    new Promise<boolean>((resolve) => {
      const resoudre = (oui: boolean) => {
        setQuestion(null);
        resolve(oui);
      };
      setQuestion({ ...demande, resoudre });
    });
  const gestes = creerGestesMotsCibles(services, confirmer, (mot, issue) => {
    setMessage({ ok: issue.ok, phrase: issue.phrase });
    oublier(mot);
    void charger(mot);
    onChange?.();
  });

  const creerMot = async (mot: string, code: string) => {
    setErreurCreation(null);
    try {
      const r = await services.creerMot(mot, code);
      if (r.ok) {
        setCreation(false);
        setMessage({ ok: true, phrase: E.motCree });
        onChange?.();
      } else setErreurCreation(r.phrase);
    } catch {
      setErreurCreation(E.geste);
    }
  };
  const changerCible = async (mot: string, code: string) => {
    try {
      const r = await services.changerCible(mot, code);
      setMessage({ ok: r.ok, phrase: r.phrase });
      if (r.ok) {
        oublier(mot);
        void charger(mot);
        onChange?.();
      }
    } catch {
      setMessage({ ok: false, phrase: E.geste });
    }
  };

  const etats: Record<string, EtatMotVue> = Object.fromEntries(
    vue.mots.map((m) => [m.mot, m.etat]),
  );
  const visibles = new Set(
    vue.mots
      .filter((m) => filtre === "tous" || m.etat === ETAT_DU_FILTRE[filtre])
      .map((m) => m.mot),
  );
  const tableau = {
    ...vue.tableau,
    lignes: vue.tableau.lignes.filter((l) =>
      filtre === "tous" ? true : visibles.has(l.mot),
    ),
  };
  const resumeOuvert =
    motOuvert === null
      ? null
      : (vue.mots.find((m) => m.mot === motOuvert) ?? null);

  return (
    <div className="flex flex-col gap-4" data-ecran="mots-cibles">
      {!vue.plusieursMotsAllume && (
        <p role="status" className="text-sm font-semibold text-ambre">
          {E.bandeauMotsEteint}
        </p>
      )}
      {vue.depuisCopie && (
        <p role="status" className="text-sm font-semibold text-ambre">
          {E.bandeauCopie}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={E.filtreGroupe}
          className="flex flex-wrap gap-2"
        >
          {FILTRES.map((f) => (
            <Bouton
              key={f}
              variante={filtre === f ? "contour-orange" : "secondaire"}
              aria-pressed={filtre === f}
              onClick={() => setFiltre(f)}
            >
              {E.filtres[f]}
            </Bouton>
          ))}
        </div>
        <Bouton
          onClick={() => {
            setErreurCreation(null);
            setCreation(true);
          }}
        >
          {E.creer}
        </Bouton>
      </div>

      {message !== null && (
        <p
          role={message.ok ? "status" : "alert"}
          className={
            message.ok
              ? "text-sm font-semibold text-sauge"
              : "text-sm font-semibold text-brique"
          }
        >
          {message.phrase}
        </p>
      )}

      {creation && (
        <NouveauMot
          catalogue={vue.catalogue}
          onCreer={(m, c) => void creerMot(m, c)}
          erreur={erreurCreation}
        />
      )}

      <TableauMots
        vue={tableau}
        catalogue={vue.catalogue}
        etats={etats}
        onChangerCible={(m, c) => void changerCible(m, c)}
        onOuvrirMot={ouvrir}
        refsOuvrir={ouvrirRefs}
      />

      {resumeOuvert !== null && (
        <FicheMot
          resume={resumeOuvert}
          catalogue={vue.catalogue}
          apercu={apercus[resumeOuvert.mot] ?? null}
          services={gestes}
          onFermer={fermerFiche}
          titreRef={titreFicheRef}
        />
      )}

      {question !== null && (
        <Dialogue
          ouvert
          onOuvertChange={(o) => {
            if (!o) question.resoudre(false);
          }}
          titre={question.titre}
          description={question.phrase}
          pied={
            <>
              <Bouton
                variante="fantome"
                onClick={() => question.resoudre(false)}
              >
                {E.annuler}
              </Bouton>
              <Bouton onClick={() => question.resoudre(true)}>
                {question.bouton}
              </Bouton>
            </>
          }
        />
      )}
    </div>
  );
}
