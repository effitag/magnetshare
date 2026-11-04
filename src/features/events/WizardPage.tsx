import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Shell } from "@/features/layout/Shell";
import { WizardDetails, WizardPrivacy, WizardType } from "@/features/events/WizardSteps";
import { useEventWizard } from "@/hooks/useEventWizard";

const titles = ["פרטי האירוע", "סוג האירוע", "פרטיות"];

export default function WizardPage() {
  const wizard = useEventWizard();

  return (
    <Shell width="narrow">
      <p className="text-sm text-muted">שלב {wizard.step + 1} מתוך 3</p>
      <h1 className="mt-1 text-3xl font-semibold">{titles[wizard.step]}</h1>
      <div className="mt-6">
        {wizard.step === 0 ? (
          <WizardDetails
            name={wizard.name}
            date={wizard.date}
            description={wizard.description}
            coverPreview={wizard.coverPreview}
            errors={wizard.errors}
            onName={wizard.setName}
            onDate={wizard.setDate}
            onDescription={wizard.setDescription}
            onCover={wizard.setCover}
          />
        ) : null}
        {wizard.step === 1 ? <WizardType type={wizard.type} onType={wizard.setType} /> : null}
        {wizard.step === 2 ? (
          <WizardPrivacy
            moderationRequired={wizard.moderationRequired}
            open={wizard.open}
            onModeration={wizard.setModerationRequired}
            onOpen={wizard.setOpen}
          />
        ) : null}
      </div>
      {wizard.formError ? (
        <p className="mt-4 text-sm text-primary" role="alert">
          {wizard.formError}
        </p>
      ) : null}
      <div className="mt-6 flex items-center justify-between gap-3">
        {wizard.step > 0 ? (
          <Button variant="ghost" onClick={wizard.previousStep}>
            <ChevronRight className="size-4" aria-hidden="true" />
            חזרה
          </Button>
        ) : (
          <span />
        )}
        {wizard.step < 2 ? (
          <Button onClick={wizard.nextStep}>
            המשך
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={() => void wizard.submit()} disabled={wizard.submitting}>
            {wizard.submitting ? "יוצרים…" : "יצירת האירוע"}
          </Button>
        )}
      </div>
    </Shell>
  );
}
