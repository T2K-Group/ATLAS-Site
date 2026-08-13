# Production website tasks

## Images

- [x] Homepage hero uses `assets/images/product-home.png`.
- [x] Industries overview image requirements and search queries documented in `SEARCHTERMS.md`.
- [x] Public-sector chain-of-custody image requirements and search queries documented in `SEARCHTERMS.md`.
- [x] Solutions hero uses `assets/images/product-line.png`.
- [x] “Turn operational history into defensible evidence” uses `assets/images/product-details.png`.
- [x] Resources hero uses a responsive light-blue ATLAS wordmark treatment.
- [x] “Built by T2K Group” uses `assets/images/T2K_Logo.svg`; its path is black.
- [x] Contact hero image requirements and search queries documented in `SEARCHTERMS.md`.

No images were generated. Missing photography remains represented by placeholders until appropriately licensed images are selected using `SEARCHTERMS.md`.

## CSS fixes

- [x] Resources “Browse all Knowledge” button alignment corrected.
- [x] Blog placeholder content removed, including the affected byline.
- [x] Contact message help and consent spacing corrected.

## Content fixes

- [x] Provisional Blog articles and Blog navigation links removed pending the content plan.
- [x] Reviewed privacy notice no longer contains its draft legal-review warning.
- [x] Public Terms links remain removed; the noindexed draft is retained for future use.

## Contact form

- [x] Contact form sends all fields as JSON to `https://t2k.group/api/v1/contact-form`.
- [x] Success is shown only after a successful HTTP response.
- [x] Submission failures keep the form visible and show an email fallback.
