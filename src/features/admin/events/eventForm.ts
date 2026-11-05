import type { EventStatus } from "@/services/types";

export type EventFormState = {
  title: string;
  slug: string;
  eventDate: string;
  place: string;
  frameId: string;
  printQuota: number;
  status: EventStatus;
};

export const emptyEventForm = (slug: string): EventFormState => ({
  title: "",
  slug,
  eventDate: "",
  place: "",
  frameId: "",
  printQuota: 2,
  status: "draft",
});
