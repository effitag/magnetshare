import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppError } from "@/lib/errors";
import { createEvent } from "@/services/api";
import type { EventType } from "@/services/types";

export function useEventWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [type, setType] = useState<EventType>(searchParams.get("type") === "magnet" ? "magnet" : "share");
  const [moderationRequired, setModerationRequired] = useState(true);
  const [open, setOpen] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  function validate(current: number): boolean {
    const next: Record<string, string> = {};
    if (current === 0) {
      if (name.trim().length < 2) next.name = "תנו לאירוע שם של לפחות שתי אותיות.";
      if (!date) next.date = "בחרו תאריך לאירוע.";
      if (description.trim().length > 280) next.description = "התיאור ארוך מדי. קיצרו אותו ל-280 תווים.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (!validate(step)) return;
    setStep((value) => Math.min(2, value + 1));
  }

  function previousStep() {
    setFormError(null);
    setStep((value) => Math.max(0, value - 1));
  }

  async function submit() {
    if (!validate(0)) {
      setStep(0);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const event = await createEvent({
        name,
        description,
        eventDate: date,
        type,
        moderationRequired,
        open,
        cover,
      });
      navigate(`/events/${event.id}`, {
        state: event.coverWarning ? { coverWarning: event.coverWarning } : null,
      });
    } catch (error) {
      setFormError(error instanceof AppError ? error.message : "לא הצלחנו ליצור את האירוע. נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    step,
    name,
    setName,
    date,
    setDate,
    description,
    setDescription,
    coverPreview,
    setCover,
    type,
    setType,
    moderationRequired,
    setModerationRequired,
    open,
    setOpen,
    errors,
    formError,
    submitting,
    nextStep,
    previousStep,
    submit,
  };
}
