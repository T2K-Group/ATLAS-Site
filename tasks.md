# ATLAS website publication checklist

This checklist records the work that should be completed or consciously accepted before the public website is published. Line numbers refer to the current files and may move as content is edited.

## Priority 0: publication blockers

### Approve and replace the draft website terms

- [x] Arrange review by a qualified legal adviser.
- [x] Confirm the contracting and website-operating legal entity as T2K Group Limited.
- [x] Add company number 13799529, the registered office and contact details.
- [x] Confirm England and Wales as the jurisdiction and finalise the liability, intellectual-property, demo and customer-agreement wording.
- [x] Remove all visible draft and legal-review warnings.
- [x] Update the displayed revision date to 31 August 2026.

Locations:

- `legal/terms/index.html:38`, visible draft wording and the "Legal review required" notice.
- `legal/terms/index.html:45`, undefined references to "we", "us" and "our", plus missing company number and registered address.
- `legal/terms/index.html:90`, instruction to add the responsible entity's final details.

### Verify the privacy notice and data-processing disclosures

- [x] Confirm that the privacy notice accurately describes the production contact-form workflow.
- [x] Confirm that the website is hosted on T2K Group's own servers and identify the other production processor and recipient categories, including email delivery, Cloudflare Turnstile, CARTO and T2K Group's internal anonymous analytics service.
- [x] Confirm the lawful bases, contract-specific retention, international-transfer safeguards, cookie usage and `privacy@t2k.group` rights-request route.
- [x] Confirm that no cookie banner is required while internal analytics remains anonymous, aggregate and cookie-free.
- [x] Confirm T2K Group Limited as the data controller, with company number 13799529, its registered office and FAO Data Controller postal contact.
- [x] Update the FAQ to reflect contract-specific retention and T2K Group Limited's controller or processor role under the applicable data processing agreement.

Locations:

- `legal/privacy/index.html`, the complete privacy notice.
- `contact/index.html:50-65`, personal information, consent wording and Turnstile-protected enquiry form.
- `assets/marketing-pages.js:127-193`, contact-form validation and submission logic.
- `resources/faq/index.html:155`, data-handling details that are still stated as needing confirmation.
- `resources/faq/index.html:167`, retention period that is still to be confirmed.

### Fix documentation links

The documentation lives at `/docs/index.html`, but several links currently point outside the site to variants of `docs.html`. Replace them with a consistent root-relative `/docs/` or `/docs/index.html` URL, then test them on the production host.

- [x] Fix the homepage permissions link and footer link.
- [x] Fix contact-page documentation links.
- [x] Fix resource and knowledge-page documentation links.
- [x] Fix industry, solutions and legal footer links.
- [x] Fix article footer links.
- [x] Run a complete internal-link check after the replacements. All 758 internal links across 22 HTML files resolve, including URL fragments.

Known locations:

- `index.html:57`
- `index.html:60`
- `contact/index.html:73`
- `contact/index.html:99`
- `industries/index.html:121`
- `industries/public-sector/index.html:118`
- `solutions/index.html:136`
- `resources/index.html:89`
- `resources/index.html:128`
- `resources/faq/index.html:178`
- `resources/knowledge/index.html:102`
- `resources/knowledge/digital-chain-of-custody/index.html:132`
- `resources/knowledge/elections/ballot-box-arrival-confirmation/index.html:28`
- `resources/knowledge/elections/election-day-asset-visibility/index.html:21`
- `resources/knowledge/elections/tracking-during-mobile-signal-gaps/index.html:28`
- `legal/privacy/index.html:132`
- `legal/terms/index.html:95`

### Test the contact form in production

- [x] Confirm the production API endpoint is correct and available over HTTPS. Verified `https://api.t2k.group/v1/content/forms` on 31 August 2026: HTTPS responds, GET returns 405 with POST allowed, and the production-origin CORS preflight succeeds.
- [ ] Test successful delivery to every intended recipient.
- [x] Test required fields, invalid email addresses, network failures and server errors. Empty submission focuses the first required field, invalid email focuses the email field, a simulated network failure restores the submit button and displays the fallback message, a missing Turnstile header returns 422, and an invalid token returns 403.
- [x] Test Cloudflare Turnstile with the final production hostname. The live widget loads, intercepts automated interaction and the API rejects an invalid token. A human success-path test is still required for delivery verification.
- [x] Confirm that the form prevents duplicate submissions while a request is in progress. The button becomes disabled and displays "Sending…" until the request completes.
- [ ] Confirm that no sensitive form values are written to browser or server logs.
- [x] Confirm the success and error messages are understandable and accessible. The success state uses `role="status"` and is programmatically focused; submission errors use `role="alert"`, are focusable and include the fallback email address.
- [ ] Confirm there is a monitored fallback email address.
- [ ] Test with keyboard navigation, a screen reader and a mobile device.

Test notes:

- Browser-console inspection found no submitted names, email addresses or message text. Server-log handling still requires verification on the API host before the logging task can be completed.
- At a 390 px viewport, the contact page had no horizontal overflow and displayed the mobile navigation control.
- Automated focus checks passed for empty required fields and invalid email. A manual keyboard and screen-reader pass is still required.
- Successful delivery was not attempted because Cloudflare Turnstile correctly blocked the automated browser. Complete that test manually and confirm receipt at every configured destination.

Locations:

- `contact/index.html:50-66`, form fields, consent and submit controls.
- `contact/index.html:11`, Turnstile script.
- `contact/index.html:64`, Turnstile site key and widget.
- `assets/marketing-pages.js:127-193`, validation, submission and response handling.

## Priority 1: visible unfinished content

### Replace image placeholders

There are 13 explicit image placeholders, plus the empty case-study block listed separately below. For every replacement, provide an appropriately sized WebP or AVIF asset, a useful fallback format if required, descriptive alternative text and explicit dimensions to reduce layout shift.

- [ ] Contact-page hero or supporting image.
  - Location: `contact/index.html:41`.
  - Current description: generic "Website image".
  - Needed: an approved ATLAS product, team or deployment image with meaningful alternative text.

- [ ] Industries overview hero image.
  - Location: `industries/index.html:41-44`.
  - Needed: a cross-industry critical-asset visual.

- [ ] Public-sector hero image.
  - Location: `industries/public-sector/index.html:41-44`.
  - Needed: an approved public-sector or election-operations visual that does not imply an unverified deployment.

- [ ] Resources card image for digital chain of custody.
  - Location: `resources/index.html:103`.
  - Current brief: connected route illustrating a digital chain of custody.

- [ ] Resources card image for election-day visibility.
  - Location: `resources/index.html:107`.
  - Current brief: election asset route between polling locations.

- [ ] Resources card image for ballot-box arrival confirmation.
  - Location: `resources/index.html:111`.
  - Current brief: comparison between a location pin and a verified event record.

- [ ] Knowledge-page featured image.
  - Location: `resources/knowledge/index.html:40`.
  - Current description: generic "Website image" and therefore needs a final creative brief.

- [ ] Knowledge-page chain-of-custody feature image.
  - Location: `resources/knowledge/index.html:48`.
  - Current brief: route events combining into a verified chain-of-custody record.

- [ ] Knowledge card image for connected custody events.
  - Location: `resources/knowledge/index.html:70`.

- [ ] Knowledge card image for monitored election-asset movement.
  - Location: `resources/knowledge/index.html:74`.

- [ ] Knowledge card image for ballot-box arrival.
  - Location: `resources/knowledge/index.html:78`.

- [ ] Knowledge card image for mobile-signal gaps.
  - Location: `resources/knowledge/index.html:82`.

- [ ] Digital chain-of-custody article illustration.
  - Location: `resources/knowledge/digital-chain-of-custody/index.html:36`.
  - Current brief: an asset journey linking tracker events to an operational record and report.

### Decide what to do with the empty case-studies page

- [ ] Preferably publish at least one approved, evidence-based customer case study.
- [ ] Obtain written permission for customer names, logos, quotations, performance figures and deployment details.
- [ ] If no approved case study is ready, remove the page from navigation and search indexing until useful content exists.
- [ ] Do not publish the current empty "Coming soon" page as a primary navigation destination.

Locations:

- `case-studies/index.html:39`, promise that customer stories will be added later.
- `case-studies/index.html:44-46`, empty placeholder and "Coming soon" wording.
- Search all headers, footers and resource cards for links to `case-studies/` if the page is hidden.

### Resolve demo call-to-action wording

Most "Book a Demo" links open `https://demo.atlas-tracking.co.uk` directly. That wording implies a booking flow, but the destination appears to be a self-service product demonstration.

- [ ] Decide whether the primary action is "Book a demo", "View the demo" or "Explore the demo".
- [ ] If it is a booking action, point it to a scheduling or contact flow.
- [ ] If it opens the product demonstration, rename all matching links consistently.
- [ ] Confirm whether external demo links should open in the same tab or a new tab.
- [ ] Add suitable external-link labelling where required for accessibility.

Locations:

- `index.html:48`, navigation action.
- `index.html:52`, homepage hero action.
- `index.html:58`, homepage closing action.
- `contact/index.html:31`, navigation action.
- `contact/index.html:72`, platform preview card.
- `solutions/index.html:30`, navigation action.
- `solutions/index.html:41`, hero action.
- `solutions/index.html:127`, closing action.
- Other occurrences: search for `https://demo.atlas-tracking.co.uk` across all HTML files.

### Decide how public demo documentation should be presented

The documentation currently describes a frontend demonstration rather than a production product. This can be useful, but it also exposes a long list of non-functional capabilities.

- [ ] Decide whether `/docs/` is demo documentation, production documentation or an internal preview.
- [ ] If it is demo documentation, label that purpose clearly in the page title, metadata and navigation.
- [ ] If it is production documentation, replace simulated workflows with verified product instructions and remove demo-only notes only after the features are operational.
- [ ] Consider adding `noindex` until the documentation reflects the intended public product.
- [ ] Verify every role and permission against backend enforcement before presenting it as a security control.
- [ ] Verify reports, exports, authentication, invitations, account settings, notifications and billing before documenting them as available.

Locations:

- `docs/index.html:53-56`, styling and instruction for demo-only notices.
- `docs/index.html:95`, overall frontend-demo warning.
- `docs/index.html:102`, random tracker positions.
- `docs/index.html:110`, simulated telemetry.
- `docs/index.html:118`, browser-only site data.
- `docs/index.html:125`, non-functional invitations and sign-in.
- `docs/index.html:131`, roles without backend enforcement.
- `docs/index.html:135`, static logs and non-functional exports.
- `docs/index.html:139`, example notifications and non-functional account actions.
- `docs/index.html:143`, non-functional reports and file exports.
- `docs/index.html:146-147`, consolidated demo limitations.

## Priority 2: claims and content approval

### Verify product and security claims

- [ ] Confirm the precise meaning and update frequency behind "real-time" location.
- [ ] Confirm which tracker models support temperature, humidity, physical-button and enclosure events.
- [ ] Confirm encryption in transit and at rest before retaining "secure" and "encrypted" claims.
- [ ] Confirm audit-log scope, immutability, retention and export behaviour before using "auditable" or "defensible evidence" wording.
- [ ] Confirm multi-network behaviour, offline storage limits and upload behaviour after reconnection.
- [ ] Confirm mapping, routing and geofence accuracy limitations.
- [ ] Document any operational dependencies or exclusions that customers need to understand.

Important locations:

- `index.html:52-57`, core homepage claims.
- `solutions/index.html`, detailed visibility, custody, audit, investigation and reliability claims.
- `about/index.html`, hardware, connectivity and platform-design statements.
- `resources/faq/index.html`, customer-facing product, security and data answers.
- `docs/index.html`, detailed descriptions of intended features and roles.

### Approve industry positioning

- [ ] Confirm whether elections are a deployed specialist application or still a target use case.
- [ ] Keep potential applications clearly separated from verified customer deployments.
- [ ] Review cold-chain language with a relevant compliance specialist. Do not imply certification, validated monitoring or automatic regulatory compliance.
- [ ] Review election content with an election-law and operations specialist. Preserve the distinction between tracking information and official custody, receipt and verification.
- [ ] Confirm that public-sector imagery and copy do not imply endorsement by an authority or customer.
- [ ] Confirm that agritech and high-value logistics claims match tested hardware and connectivity conditions.

Locations:

- `index.html:56`, specialist and potential-use-case positioning.
- `industries/public-sector/index.html:82`, potential public-sector applications.
- `industries/public-sector/elections/index.html`, election tracking proposition.
- `industries/cold-chain-logistics/index.html:24-28`, use-case and compliance boundaries.
- `industries/agritech/index.html:24`, potential applications disclaimer.
- `industries/high-value-logistics/index.html:24`, potential-use-case disclaimer.
- `resources/knowledge/elections/`, election guidance articles.

### Review all article content and attribution

- [ ] Confirm author names, job titles, publication dates and revision dates.
- [ ] Recheck every external factual source and ensure links point to the current authoritative guidance.
- [ ] Add an editorial owner and review date for each article.
- [ ] Confirm whether any article needs a legal, compliance or operational disclaimer.
- [ ] Check that structured Article data matches the visible page content.

Locations:

- `resources/knowledge/digital-chain-of-custody/index.html`.
- `resources/knowledge/elections/ballot-box-arrival-confirmation/index.html`.
- `resources/knowledge/elections/election-day-asset-visibility/index.html`.
- `resources/knowledge/elections/tracking-during-mobile-signal-gaps/index.html`.

## Priority 3: technical launch checks

### Maps and external services

- [ ] Confirm the CARTO key is restricted to the production and required preview hostnames.
- [ ] Check CARTO usage monitoring and the five-million-tile monthly allowance.
- [ ] Test both maps after a clean-cache load and verify that no API-key watermark appears.
- [ ] Confirm CARTO and OpenStreetMap attribution remains visible at every responsive size.
- [ ] Confirm that a public browser-visible CARTO key is acceptable under the chosen key restrictions.
- [ ] Add a helpful fallback if Leaflet or the tile service fails to load.
- [ ] Decide whether third-party map requests need to be described in the privacy notice.

Locations:

- `assets/marketing-pages.js:205-215`, homepage map and authenticated CARTO URL.
- `assets/marketing-pages.js:291-294`, solutions history map and authenticated CARTO URL.
- `index.html:26-27`, Leaflet assets.
- `solutions/index.html:10-11`, Leaflet assets.

### Internal and external links

- [ ] Crawl every page and resolve all 404s, incorrect relative paths and redirect chains.
- [ ] Test fragment links such as `#visibility`, `#custody`, `#audit`, `#investigation` and `#reliability`.
- [ ] Check external Electoral Commission links and the T2K Group website.
- [ ] Check that email addresses and contact routes are monitored.
- [ ] Apply a consistent policy for external links, `target="_blank"` and `rel="noopener noreferrer"`.
- [ ] Verify the custom 404 page works on the production host.

### Search and social metadata

- [ ] Confirm each indexable page has a unique title and meta description.
- [ ] Add canonical URLs to every public page.
- [ ] Add Open Graph and social-card metadata with a final approved sharing image.
- [ ] Verify structured data with a schema validator.
- [ ] Create and publish `sitemap.xml`.
- [ ] Create and review `robots.txt`.
- [ ] Decide which draft, demo and placeholder pages should be excluded from indexing.
- [ ] Submit the final sitemap to the chosen search-engine webmaster tools.

Locations:

- The `<head>` of every `index.html` and `404.html` file.
- Existing structured data is present in selected pages and should be checked against visible content.

### Branding and browser assets

- [ ] Confirm the production favicon set, including SVG or ICO and Apple touch icon.
- [ ] Confirm the final ATLAS and T2K Group logo files and usage rules.
- [ ] Add a web-app manifest only if required.
- [ ] Confirm the social-sharing image and its safe text area.
- [ ] Ensure all supplied image and font assets are licensed for public commercial use.

### Accessibility

- [ ] Complete keyboard-only testing for navigation menus, FAQ accordions, maps and the contact form.
- [ ] Test with at least one desktop and one mobile screen reader.
- [ ] Check heading order and landmark structure on every template.
- [ ] Check colour contrast in default, hover, focus, disabled and error states.
- [ ] Ensure every final image has appropriate alternative text, or an empty `alt` value if decorative.
- [ ] Ensure map content has an accessible text alternative and does not trap keyboard focus.
- [ ] Confirm visible focus indicators are not clipped or hidden.
- [ ] Respect reduced-motion preferences where animation is used.
- [ ] Check that form errors are announced and associated with the relevant fields.

### Responsive and browser testing

- [ ] Test current Chrome, Edge, Firefox and Safari.
- [ ] Test representative iOS and Android devices.
- [ ] Test at 320 px width and at tablet, laptop and large-desktop widths.
- [ ] Check dropdown navigation, long headings, cards, tables, legal pages and article layouts.
- [ ] Check both maps after resize and orientation changes.
- [ ] Test at 200% browser zoom and with larger system text.

### Performance and resilience

- [ ] Run Lighthouse or an equivalent production performance audit.
- [ ] Compress and responsively size every replacement image.
- [ ] Set explicit image dimensions to reduce cumulative layout shift.
- [ ] Review third-party Leaflet, CARTO and Turnstile loading behaviour.
- [ ] Consider self-hosting stable frontend assets where appropriate.
- [ ] Add suitable cache headers for versioned static assets.
- [ ] Confirm the site remains understandable when JavaScript is unavailable or a third-party service fails.
- [ ] Confirm production error monitoring and availability monitoring.

### Security and deployment

- [ ] Enforce HTTPS and review the redirect from HTTP.
- [ ] Add and test a Content Security Policy that permits only required services.
- [ ] Review HSTS, Referrer-Policy, Permissions-Policy and anti-framing headers.
- [ ] Restrict the CARTO and Turnstile keys to approved domains where supported.
- [ ] Confirm no private credentials, internal endpoints or customer data are committed.
- [ ] Ensure form submission has server-side validation, abuse protection and rate limiting.
- [ ] Confirm deployment rollback and backup procedures.

## Final release procedure

- [ ] Commit the current CARTO, proofreading and publishing-checklist changes before any Git reset, checkout or rebase.
- [ ] Review `git status` and confirm that every deletion is intentional. `SEARCHTERMS.md` and `todo.md` are currently shown as deleted and should be resolved deliberately.
- [ ] Deploy to a production-equivalent preview environment.
- [ ] Complete stakeholder review for product, marketing, legal, privacy and technical accuracy.
- [ ] Run the link, accessibility, browser, performance and security checks above against that preview.
- [ ] Record approval for final text, imagery and legal pages.
- [ ] Tag or otherwise record the exact release commit.
- [ ] Deploy to production and perform smoke tests for navigation, maps, forms, documentation and the 404 page.
- [ ] Monitor errors, form delivery and CARTO usage closely after launch.
