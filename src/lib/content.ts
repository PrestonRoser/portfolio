import { getCollection } from "astro:content";

const published = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

export async function getProjects() {
  const projects = await getCollection("projects", published);
  return projects.sort((a, b) => a.data.order - b.data.order);
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "America/Denver",
});

export const formatDate = (date: Date) => dateFormat.format(date);
