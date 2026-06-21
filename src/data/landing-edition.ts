/**
 * The showcase edition the landing page renders.
 *
 * This is a REAL Scout issue, produced by the live generation pipeline
 * (scout's-read -> Exa discovery constrained to authoritative outlets -> Haiku
 * sift -> Sonnet compose) in the "Sharp Analyst" voice over a 30 day window,
 * not hand-written copy.
 *
 * SOURCE-VERIFIED. Every story below was checked against its actual sourceUrl
 * (the page was fetched and the central factual claim confirmed in the text).
 * Every source is a reputable outlet or primary source: NASA press releases
 * (nasa.gov), SpaceNews trade journalism, and a peer-reviewed Nature paper. No
 * blogs, forums, Reddit, or Wikipedia. Two model-introduced specifics that the
 * cited sources did not support were corrected against the source: an
 * unverifiable Gateway/ESA-leverage aside was trimmed from the Artemis story,
 * and a fabricated "43-year-old police officer" detail was corrected to what
 * SpaceNews actually states (a payload specialist formerly of the Hong Kong
 * police force).
 *
 * Captured 2026-06-21. To refresh it, regenerate an issue, verify each kept
 * story against its real source, and replace the object below. No em dashes.
 */

export interface LandingStory {
  headline: string
  summary: string
  sourceName: string
  sourceUrl: string
  publishedAt?: string
}

export interface LandingEdition {
  title: string
  lead: string
  dispatchNo: number
  dateLabel: string
  voiceLabel: string
  stories: LandingStory[]
}

export const LANDING_EDITION: LandingEdition = {
  title: 'Artemis Splits in Two, Starship V3 Flies, and China Closes the Gap',
  lead: 'NASA officially named the four-person Artemis III crew on June 9 and confirmed the mission will fly in low Earth orbit in 2027, not to the Moon. That reframe matters: the first crewed lunar landing is now Artemis IV, targeting 2028, and almost everything happening right now, from rover contracts to Starship test flights to China rushing its own taikonauts toward a year in orbit, is a race to be ready for that window. The next six months will show whether the hardware can actually keep up with the calendar.',
  dispatchNo: 48,
  dateLabel: 'June 21, 2026',
  voiceLabel: 'Sharp Analyst',
  stories: [
    {
      headline: 'Artemis III is now a dress rehearsal, not a Moon landing',
      summary:
        "NASA named Randy Bresnik as commander, ESA's Luca Parmitano as pilot, and Andre Douglas and Frank Rubio as mission specialists for Artemis III on June 9, with the mission redesigned as a low-Earth-orbit test flight in 2027. Instead of landing near the lunar south pole, the spacecraft will, for the first time, demonstrate rendezvous and docking with test versions of one or both of the commercial human landing systems in development by Blue Origin and SpaceX. NASA frames those Earth-orbit tests as essential for Artemis IV, which it now calls the first planned crewed mission to the lunar south pole in 2028. Parmitano's assignment is also the first time an ESA astronaut has been given an Artemis mission. The 2028 crewed landing is the hard target everything else is being built around, and Artemis III is the critical test standing between here and there.",
      sourceName: 'NASA',
      sourceUrl:
        'https://www.nasa.gov/news-release/nasa-marches-toward-artemis-iii-mission-in-2027-names-crew-members/',
      publishedAt: '2026-06-09',
    },
    {
      headline: 'A New Glenn explosion forced NASA to redesign its Moon base supply chain',
      summary:
        "Blue Origin's New Glenn exploded during a May 28 static-fire test, and NASA had already built Blue Moon Mark 1 landers into the first contracts for its Moon Base program, announced at a May 26 briefing. NASA selected Astrolab and Lunar Outpost to build lunar rovers, both to be delivered to the south pole on separate Blue Moon landers before the Artemis IV landing in 2028, and tapped Firefly Aerospace to carry MoonFall drone-like spacecraft that will hop across the surface scouting base sites. According to SpaceNews, NASA's three-phase Moon Base concept, unveiled in March and pegged at more than $30 billion, was already thin on specifics, and the New Glenn failure now forces a rewrite of a timeline that was already tight. If Blue Origin cannot demonstrate New Glenn reliability quickly, the rover delivery schedule that preconditions the crewed 2028 landing comes apart.",
      sourceName: 'SpaceNews',
      sourceUrl:
        'https://spacenews.com/new-glenn-forced-an-explosive-rewrite-for-nasas-plans-to-build-a-moon-base/',
      publishedAt: '2026-06-09',
    },
    {
      headline: 'Starship V3 flew on Flight 12, but the booster did not come back',
      summary:
        "SpaceX launched the first Starship Version 3 vehicle on May 22 from Starbase, Texas, on a mission designated Flight 12. The Super Heavy booster's 33 Raptor 3 engines lit for ascent, one engine shut down about one minute and 40 seconds after liftoff, and the upper stage ignited its six engines and separated cleanly, according to SpaceNews. The booster was scheduled to perform a boostback burn toward a targeted splashdown in the Gulf of Mexico but did not complete that maneuver as planned, with engines shutting down less than 20 seconds into the burn. Starship serves as NASA's Human Landing System for Artemis, so every test flight is directly relevant to the 2028 crewed lunar landing. Version 3 completing most of its suborbital objectives is progress, but full booster recovery remains unfinished business on the critical path.",
      sourceName: 'SpaceNews',
      sourceUrl: 'https://spacenews.com/spacex-launches-first-starship-v3/',
      publishedAt: '2026-05-23',
    },
    {
      headline: 'NASA handed a Mars science mission to Relativity Space rather than build the bus itself',
      summary:
        "On June 17, NASA announced a public-private partnership in which Relativity Space will supply the spacecraft, rocket, and cruise operations for a Mars mission, while NASA contributes the Aeolus atmospheric-science instrument suite, a set of four instruments meant to give the first integrated daily global view of Martian winds, temperatures, dust, and clouds. NASA Administrator Jared Isaacman announced the deal at a Relativity Space event, with Aeolus scheduled to launch in 2028. The model is the same commercial-services logic NASA uses for lunar payloads, now applied to Mars: hand the bus to a commercial partner to keep a Mars presence on the manifest while the agency's budget and attention are consumed by 2028 lunar preparations.",
      sourceName: 'NASA',
      sourceUrl: 'https://www.nasa.gov/news-release/nasa-announces-public-private-partnership-to-advance-mars-science/',
      publishedAt: '2026-06-17',
    },
    {
      headline: 'China put its first Hong Kong astronaut in orbit and is conditioning a crew for a year in space',
      summary:
        "Shenzhou-23 lifted off May 24 from the Jiuquan Satellite Launch Center carrying commander Zhu Yangzhu and astronauts Zhang Zhiyuan and Lai Ka-ying, a payload specialist formerly of the Hong Kong police force and the first astronaut from Hong Kong to reach orbit. One of Zhu or Zhang is expected to complete a full continuous year in orbit, a first for Chinese human spaceflight, according to SpaceNews. China's stated goal is a crewed lunar landing by 2030, two years after NASA's 2028 target, and the year-in-orbit experiment is direct preparation for the long-duration deep-space missions a lunar program requires. The gap between the two programs' timelines is two years and narrowing.",
      sourceName: 'SpaceNews',
      sourceUrl: 'https://spacenews.com/shenzhou-23-crew-arrives-at-tiangong-as-china-maps-path-to-2030-lunar-landing/',
      publishedAt: '2026-05-24',
    },
    {
      headline: "Chang'e-6 samples are rewriting what we know about the Moon's south pole geology",
      summary:
        "A paper published June 15 in Communications Earth and Environment used lead isotope data from Chang'e-6 soil samples to date two groups of impact melt fragments at 4,245 and 3,876 million years ago. The data cannot be explained by standard lunar magma ocean crystallization alone and instead point to post-impact remelting of the crust and underlying mantle, probably triggered by the South Pole-Aitken basin impact. The south pole region is exactly where both NASA and China plan to land crews and build permanent infrastructure. Understanding its actual crustal and mantle structure is not academic: it directly informs where to drill, what resources may be present, and what ground conditions crews will face.",
      sourceName: 'Nature (Communications Earth and Environment)',
      sourceUrl: 'https://www.nature.com/articles/s43247-026-03763-x',
      publishedAt: '2026-06-15',
    },
  ],
}
