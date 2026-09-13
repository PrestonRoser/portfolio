// LinkedIn has no feed or API for personal posts, so these are copied over by
// hand. Add new ones at the top: the id is the number in the post's
// urn:li:activity:<id> URL.

interface Entry {
  id: string;
  title: string;
  excerpt: string;
}

const entries: Entry[] = [
  {
    id: "7422760359096246272",
    title: "Accepted an offer to join Shamrock Foods as a Systems Analyst Intern",
    excerpt:
      "Over the past few months, I’ve been balancing CS coursework, building software projects, and growing HANDS, often learning through trial, error, and persistence.",
  },
  {
    id: "7404725667377885184",
    title: "This semester, I was told something that stopped me in my tracks.",
    excerpt:
      "A professor emailed me saying he was “worried about [me] having any realistic chance for finishing the course successfully.”",
  },
  {
    id: "7398547020606713856",
    title: "Yesterday was a milestone for us.",
    excerpt:
      "We presented HANDS at ASU Venture Devils Demo Day, and we are incredibly grateful to share that we secured funding to support our next stage of growth.",
  },
  {
    id: "7397466648871464960",
    title: "Boring software wins.",
    excerpt:
      "For students and junior devs, simple and stable beats flashy. You ship faster, fix faster, and learn faster.",
  },
  {
    id: "7396256117355507714",
    title: "We turned an idea into real momentum in a short time.",
    excerpt: "Not by waiting. By moving. At HANDS, we decided progress beats perfection.",
  },
  {
    id: "7395518768615124992",
    title: "CS students nearing graduation, you still have time.",
    excerpt:
      "Use this year to build and show real work. What still cuts through is simple: evidence.",
  },
  {
    id: "7395160896580476928",
    title: "CS hiring runs on signal. Not noise.",
    excerpt:
      "Projects over degree, connections over cold apps. What the market consistently rewards right now is proof of work.",
  },
  {
    id: "7395156770639343616",
    title:
      "The fastest way to level up as a software engineer is to work where the real traffic is.",
    excerpt:
      "In 2025, open source hit 1.12B contributions across 395M public repos, and 36M new developers joined GitHub. That is the classroom.",
  },
  {
    id: "7394810006581338112",
    title: "Nine days until Venture Devils.",
    excerpt:
      "Here is how we are getting ready at HANDS, where we turn abstract science into something you can hold.",
  },
  {
    id: "7394463373750407168",
    title: "Innovation rarely arrives with a drumroll.",
    excerpt:
      "It shows up as a half-working prototype and a teacher asking, “Can my students try this next week?”",
  },
  {
    id: "7394121393862389760",
    title: "No one is coming to “discover” you. You have to build in public.",
    excerpt:
      "If you’re a CS student right now, you’ve probably felt it too: more applicants, fewer roles, louder noise.",
  },
];

export interface LinkedInPost extends Entry {
  url: string;
  date: Date;
}

// Activity ids start with a millisecond timestamp in their top 41 bits.
const postedAt = (id: string) => new Date(Number(BigInt(id) >> 22n));

export const linkedinPosts: LinkedInPost[] = entries
  .map((entry) => ({
    ...entry,
    url: `https://www.linkedin.com/feed/update/urn:li:activity:${entry.id}/`,
    date: postedAt(entry.id),
  }))
  .sort((a, b) => b.date.valueOf() - a.date.valueOf());
