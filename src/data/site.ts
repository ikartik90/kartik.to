/**
 * What the site calls itself, wherever it has to say so out loud.
 *
 * Its own module because both the root layout and every post's metadata state
 * them — Next replaces the `openGraph` and `twitter` objects wholesale rather
 * than merging a page's into the layout's, so a post that says anything about
 * its card has to say all of it. Two literals would be two names for one site.
 */
export const SITE_NAME = "kartik.to";

/**
 * The homepage's title, and the line a search result leads with.
 *
 * The site's NAME is the domain, and a domain is what nobody searches for:
 * Google read "kartik.to" as the words "kartik to" and filed the homepage among
 * every other Kartik. The person and the work are what get searched.
 */
export const SITE_TITLE = "Kartik Iyer: Product Designer, Engineer, Builder";

export const SITE_DESCRIPTION =
  "Kartik Iyer is a product designer, founding designer and design engineer in Toronto, Canada, sharing case studies, writing and interactive playgrounds.";

export const SITE_LOCALE = "en_US";

/**
 * The About page's title in search results and link previews. The page's own
 * heading stays the post's title ("About Me"); a title is the strongest words
 * a page has for search, and "About Me" names nobody.
 */
export const ABOUT_TITLE =
  "About Kartik Iyer — Product Designer & Design Engineer in Toronto";

/**
 * Who the site is by — stated once for the structured data, the metadata and
 * `llms.txt`, which all describe the same person to machines that cannot read
 * the page's pictures.
 *
 * The job titles and the city are the searches the site should answer: a
 * product designer, founding designer or design engineer in Toronto or Canada.
 */
export const AUTHOR = {
  name: "Kartik Iyer",
  // The full name the About page opens with, so a search for it finds him too.
  fullName: "Shanker Kartik Iyer",
  jobTitles: ["Product Designer", "Founding Designer", "Design Engineer"],
  knowsAbout: [
    "Product design",
    "Design engineering",
    "Design systems",
    "Front-end engineering",
  ],
  location: {
    locality: "Toronto",
    region: "Ontario",
    country: "Canada",
    countryCode: "CA",
  },
  avatar: "/assets/kartik-iyer-logo.png",
  twitterHandle: "@ikartik90",
} as const;

/**
 * The author's profiles elsewhere. The social row links to them and the
 * structured data names them as `sameAs`, which is how a search engine learns
 * that the GitHub, the LinkedIn and this site are one person.
 */
export const SOCIAL_PROFILES = {
  github: "https://github.com/ikartik90",
  twitter: "https://twitter.com/ikartik90",
  linkedin: "https://linkedin.com/in/ikartik90",
} as const;
