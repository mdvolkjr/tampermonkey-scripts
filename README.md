# Tampermonkey Scripts

Userscripts for QuickBooks Online and Clio workflows, plus a small Chrome extension.

| Script | Purpose |
| --- | --- |
| [QBO - Print Checks Screen - Account Quick Select](QBO%20-%20Print%20Checks%20Screen%20-%20Account%20Quick%20Select.user.js) | Adds one-click account buttons to the QBO Print Checks header to switch the Account dropdown. |
| [QBO - Display Ending Check Number](QBO%20-%20Display%20Ending%20Check%20Number.user.js) | Shows the ending check number next to the Starting check number field on the QBO Print Checks page. |
| [QBO Bulk Deposit Fields](qbo-bulk-deposit-fields.user.js) | Bulk-set Payment Method and Account on the QBO Bank Deposit page — applies to checked rows only, or all rows when none are checked. |
| [Clio – Quick Pay (Check)](clio-quick-pay.user.js) | Floating toolbar on Clio Receive Payments that fills payment source, deposit account, and amount, then records the payment. |
| [Clio - Generate Bill Button](clio-generate-bill.user.js) | One-click button on the Clio Quick Bill page: shows options, checks "Skip the bill approval process", and clicks Generate Bill. |
| [Gmail - Preview Attachment Before Sending](gmail-attachment-preview.user.js) | Click an attachment in a Gmail compose window to read it in an overlay instead of downloading it, so you can confirm the right document is attached before you hit Send. |

## Chrome extension: Close Claude Tab Groups

[close-claude-tab-groups](close-claude-tab-groups/) deletes every tab group whose name contains "Claude" (the groups Claude in Chrome leaves behind), skipping the group that holds your currently active tab so a running session is never interrupted. Closing all of a group's tabs removes the group entirely — Chrome tab groups only exist while their tabs are open.

Install (once): open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the `close-claude-tab-groups` folder from a local clone of this repo. Then click the toolbar icon (or press **Alt+Shift+C**) to sweep the groups. Updates arrive via `git pull` — Chrome reloads the code on browser restart, or press the reload arrow on the extension card.

## Installing

Click a script file above, then click **Raw** — Tampermonkey will offer to install it.

## Updating

Each script has `@updateURL`/`@downloadURL` headers pointing at this repo, so Tampermonkey auto-updates installed copies when a new version is pushed here (remember to bump `@version`, or the update check will ignore the change).
