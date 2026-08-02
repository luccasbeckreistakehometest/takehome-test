// Link "adicionar ao Google Calendar" (template oficial, sem OAuth):
// um clique cria o evento na agenda do usuário, onde ele pode anexar o Meet.
export function googleCalendarUrl(meeting: {
  title: string;
  scheduledAt: string;
  link?: string;
  notes?: string;
  reasoning?: string;
}): string {
  const start = new Date(meeting.scheduledAt);
  if (Number.isNaN(start.getTime())) return "https://calendar.google.com";
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [meeting.notes, meeting.reasoning, meeting.link]
      .filter(Boolean)
      .join("\n\n"),
  });
  if (meeting.link) params.set("location", meeting.link);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
