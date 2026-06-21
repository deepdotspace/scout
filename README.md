# Scout

Scout is a personal newsletter studio you run for yourself. Describe what you want to follow in plain words; Scout searches the live web, reads more than you would, throws out the noise, and writes you a short, sourced issue. It arrives by email on your schedule, or the moment you ask. Open any issue and talk to Scout about it, and it remembers your past issues and chats. One person, one inbox, your own copy.

**Live demo: [scout.app.space](https://scout.app.space)** · MIT · Built on the [DeepSpace SDK](https://deep.space)

## Quick start

Deploy your own copy:

```sh
git clone https://github.com/deepdotspace/scout && cd scout
npm install
npx deepspace login     # one-time, opens a browser tab
npx deepspace deploy    # → <name>.app.space
```

Auth, the database, email, the AI, and the search integrations all come from your own DeepSpace account, so there's nothing else to wire up. Your subdomain is the `name` field in `wrangler.toml`; change it for your own deployment. For local changes, use `npx deepspace dev`.

## What it does
- Set up a newsletter: a topic, a voice, and a schedule. Vague topics are fine; Scout reads your topic back as a sharper scope you can edit.
- Five built-in voices (Analyst, Operator, Scholar, Companion, Storyteller), or write your own.
- Real sources only. Every story links to where it came from. Nothing invented.
- Send on a schedule (daily, weekdays, weekly, or specific days, in your timezone) or hit "Send now" for an issue immediately.
- Read issues in the app or in your inbox. Star, archive, and give feedback that shapes the next issue.
- Talk to any issue. Ask it to go deeper, ask what it skipped, or ask it to reshape the next one. It remembers.

## Setup notes
- **Email.** Issues are sent through Resend. Until you verify a sending domain at resend.com and set `EMAIL_FROM` in `.dev.vars`, delivery only reaches your own verified account address. Scout tells you this honestly in Settings and still saves every issue it writes.
- **Cost.** You pay your own DeepSpace account, at cost, with no markup. Model spend is roughly a few cents per issue (Scout uses a cheap model to triage sources and a stronger one to write). Settings shows a live estimate.
- **Make it yours.** The writing prompts live in `src/prompts/` and the voices in `src/personas.ts`. Edit them and redeploy.

## How it works
Describe a newsletter, and a background job searches the web (Exa for articles, Firecrawl for forums), scores and dedupes what it finds with a cheap model, writes the issue with a stronger one, and emails it to you. A scheduler runs your newsletters at their set times. The companion answers from the current issue plus a memory of your past issues and chats. Built on the DeepSpace SDK and Cloudflare Workers.

## License
MIT. See [LICENSE](LICENSE).
