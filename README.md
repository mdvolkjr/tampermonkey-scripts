# Tampermonkey Scripts

Userscripts for QuickBooks Online, Clio, and Frost Business Connect workflows.

| Script | Purpose |
| --- | --- |
| [Frost - Positive Pay Quick Button](Frost%20-%20Positive%20Pay%20Quick%20Button.user.js) | Adds a "Positive Pay" button to the Frost Business Connect top bar that jumps to the Issue Voids multiple-entry page. |
| [QBO - Print Checks Screen - Account Quick Select](QBO%20-%20Print%20Checks%20Screen%20-%20Account%20Quick%20Select.user.js) | Adds one-click account buttons to the QBO Print Checks header to switch the Account dropdown. |
| [QBO - Display Ending Check Number](QBO%20-%20Display%20Ending%20Check%20Number.user.js) | Shows the ending check number next to the Starting check number field on the QBO Print Checks page. |
| [Clio – Quick Pay (Check)](clio-quick-pay.user.js) | Floating toolbar on Clio Receive Payments that fills payment source, deposit account, and amount, then records the payment. |

## Installing

Click a script file above, then click **Raw** — Tampermonkey will offer to install it.

## Updating

Each script has `@updateURL`/`@downloadURL` headers pointing at this repo, so Tampermonkey auto-updates installed copies when a new version is pushed here (remember to bump `@version`, or the update check will ignore the change).
