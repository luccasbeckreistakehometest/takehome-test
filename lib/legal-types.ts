export type LegalSection = { heading: string; paragraphs?: string[]; bullets?: string[] };

export type LegalDoc = {
  slug: string;
  lang: "pt" | "en";
  title: string;
  intro: string;
  sections: LegalSection[];
};
