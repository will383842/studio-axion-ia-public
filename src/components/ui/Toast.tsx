"use client";

import { toast, Toaster } from "sonner";

/** À placer une fois (layout racine). */
export function Toasts() {
  return (
    <Toaster
      position="top-center"
      theme="dark"
      offset={16}
      mobileOffset={{ top: 12, left: 16, right: 16 }}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-trait !bg-surface-2 !text-texte !shadow-carte !font-texte",
          description: "!text-texte-doux",
          actionButton: "!bg-orange !text-sur-orange !rounded-full !font-semibold",
          success: "[&_[data-icon]]:!text-sauge",
          error: "[&_[data-icon]]:!text-brique",
          warning: "[&_[data-icon]]:!text-ambre",
        },
      }}
    />
  );
}

/** Messages courts, vouvoiement. `essai` : action d'un fournisseur simulé (AV2.4-4). */
export const notifier = {
  succes: (message: string, description?: string) => toast.success(message, { description }),
  erreur: (message: string, description?: string) => toast.error(message, { description }),
  info: (message: string, description?: string) => toast(message, { description }),
  /** Ex. notifier.essai("rien n'a été envoyé à Buffer") → « Essai : rien n'a été envoyé à Buffer ». */
  essai: (message: string) => toast.warning(`Essai : ${message}`),
};
