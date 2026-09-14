export interface Role {
  org: string;
  role: string;
  place: string;
  start: string;
  end?: string;
  summary: string;
  url?: string;
}

export const experience: Role[] = [
  {
    org: "HANDS (SproutForge3D LLC)",
    role: "Co-Founder & Engineering Lead",
    place: "Phoenix, AZ",
    start: "Aug 2025",
    url: "https://handslearning.com",
    summary:
      "STEM education startup building hands-on learning kits with 3D-printed hardware for K–12 classrooms, piloted in 8 Phoenix-area classrooms. $6,000 in seed funding through ASU's Edson E+I program.",
  },
  {
    org: "Shamrock Foods Co.",
    role: "Systems Analyst Intern",
    place: "Phoenix, AZ",
    start: "May 2026",
    end: "Aug 2026",
    summary:
      "Built document-batching software with SSRS, Azure DevOps, and Azure CI/CD to replace legacy on-premise services, and a Copilot agent that improved QA audit efficiency by more than 80%.",
  },
  {
    org: "Vestas",
    role: "Production Associate Intern",
    place: "Weld County, CO",
    start: "Jun 2024",
    end: "Aug 2024",
    summary:
      "Flagged process inefficiencies and quality risks in turbine component production with engineering and QA, contributing to a 5% improvement in build quality.",
  },
];

export const education = {
  school: "Arizona State University",
  degree: "B.S. Computer Science",
  end: "Dec 2027",
};
