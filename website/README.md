# FinTap marketing website

Standalone static website for **FinTap.pk**. The billing application in `src/` and the API in `server/` are separate.

Preview from the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory website
```

Open http://127.0.0.1:4173. Publish the contents of `website/` to a static host; no application build or database is needed.

After changing website CSS or JavaScript, run `npm run website:version` and commit
the updated references with the assets. Content-based URL versions prevent
Cloudflare and browsers from mixing a new page with an old stylesheet or script.
CSS imports are versioned too. CI runs `npm run website:check` and blocks deployment
when references are stale or assets are missing. Content stays visible without
animation scripts. `school.html` forwards the singular URL to `schools.html`.

- `index.html`: plain-language introduction, payment channels, solutions, and demo links. No analytics charts or dashboard mockups.
- `assets/css/site.css`: shared responsive FinTap styling, layered over the existing detail-page components.
- `assets/fonts/`: locally hosted DM Sans, with its license.
- `assets/js/site.js`: mobile navigation, keyboard FAQ controls, and email enquiry preparation.
- `contact.html`: validates details and prepares a preview and `mailto:` link. It does not submit, store, or send messages. Visitors send the email themselves.

The contact address is provisionally `hello@fintap.pk`, based on the new domain. Confirm the mailbox before publishing; references exist in page footers, the contact page, and `assets/js/site.js`.

Pricing is discussed directly with each institution. Do not publish fixed packages, monthly subscriptions, rates, or revenue-share details. Provider approval and biller onboarding remain prerequisites to live payment collection, as described on the pricing page.
