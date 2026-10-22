# M4 business page and waitlist: DRAFT for the owner

**Status: DRAFT, not legal advice.** Legal text is a human gate. Nothing here goes live until the owner approves it in a `needs-human` issue. Prepared 22 October 2026 from the M4 research notes, `docs/PLAN.md` (M4 and H9), `docs/BRIEF.md`, `docs/SPEC.md` 6 and the current `privacyPage` in `scripts/build-site.mjs`, and revised the same day after a source check.

**Placeholders the owner fills in** (all are owner decisions; see section 4):
- `[legal sender name]`: the owner's first name and surname, or a registered business name with its ABN (step 1).
- `[N]`: the most emails about the service a sign-up will get. Emails arranging a call the person asked for, replies to their messages and any notice about a data breach don't count (step 8).
- `[date]`: the date the consent lapses and the answers are deleted (step 8).
- `[record date]` and `[suppression date]`: how long the consent record and the do-not-email list are kept (step 8).
- `[mail provider]` and `[mail country]`: the service that hosts (and any service that forwards) admin@sombrexo.com, and where it stores mail (step 10).
- `[record place]`: where the owner keeps the consent record and the do-not-email list (step 10).
- `[postal address]`: only if the owner chooses to add one (step 11).
- `TALLY_FORM_URL`: the form's share link from Tally's Share tab (step 14).
- `[YYYY-MM-DD]`: the form wording version (step 16).
- `[coverage]`: filled in at build time, as on the home page.

**Confidence labels.** "Verified" means the researcher read the source itself. "Partly" means the point rests on a search summary or a secondary source, and the owner should check it before relying on it.

No prices appear anywhere in this draft. Copy is in Australian English with no em dashes.

---

## 1. Business page

**Path:** `/business/`
**Title:** `Patchlife for business | Patchlife`
**Meta description:** Patchlife's data is free. This is a planned paid service for MSPs, IT teams and suppliers built on it. Nothing is for sale yet: join the waitlist to tell us what you need.

> # Patchlife for MSPs, IT teams and suppliers
>
> Patchlife looks up when smart devices stop getting security updates, and quotes the manufacturer's own words as evidence. So far it covers [coverage]. The lookup and the data are free, and they'll stay free.
>
> We're testing whether people who look after a lot of devices want a paid service built on top of it. Nothing is for sale yet. If you'd use it, join the waitlist and tell us what you need.
>
> ## Free now, and staying free
> - **Search and model pages.** Each model shows its support end date, or the manufacturer's rule in words, with the quote, a link to the source and the date we last checked it.
> - **The full data as JSON.** Every record is at [/api/v1/devices.json](/api/v1/devices.json) under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/), so you can use it in your own tools on the licence's terms.
> - **Corrections in public.** Anyone with a free GitHub account can report a wrong date in public, and every change to the data is public in the repository history.
>
> ## What a paid service would add
> The data would stay free under the Open Database License. A paid service would charge for the work around the data, not for access to it:
> - **Alerts.** An email when a device on your list is 12 months from its support end date, when that date passes, or when we find its manufacturer has changed what it says.
> - **Fleet matching.** Upload a list of makes and models, for example an export from your RMM tool or asset register. You'd get back which devices have ended, which end within 12 months, which have no published date and which we don't cover yet. Matching would prefer the longest exact model name, so an older model isn't mistaken for a newer one whose name starts the same way. We plan to produce one-off reports in your browser, so your list doesn't have to leave your computer.
> - **Change history.** What each manufacturer said about a device, when we saw it change and when we checked it, kept per device and ready to export, so you can show what was published when we checked.
> - **Reliability.** A feed and API you can build on, with notice before anything changes and a contact when something breaks.
> - **Supplier checks.** For suppliers and retailers: send a list of your SKUs and get back whether we found a published security support statement and support period for each, with links.
>
> ## Nothing is for sale yet
> This is a four-week test. If enough businesses want the service, we plan to build it, and we'll email you if it launches before [date]. If the answer isn't clear, we may extend the test once. If not enough businesses want it, we'll shelve the idea for now: we'll email the waitlist once to say so, and delete your answers. We may test the idea again later, with a new waitlist. Either way, the free site keeps going.
>
> ## What Patchlife doesn't do
> Patchlife doesn't give legal advice or certify that a product complies with Australia's smart device rules or the UK's PSTI regulations, and a paid service wouldn't either. Support information is as published by each manufacturer. It may change and is not advice.
>
> ## Who runs it
> Claude Code, an AI coding tool, builds and runs Patchlife. A human owner makes the decisions that need a person, such as money, accounts, legal text and publishing. [More about Patchlife](/about/).
>
> ## Join the waitlist
> It takes about two minutes. We'll ask for your work email, what kind of organisation you are, roughly how many devices you look after and which features matter to you. We don't ask for your name.
>
> **[Join the waitlist](TALLY_FORM_URL)** (opens the form on Tally's site)
>
> The form is hosted by Tally, which says it stores the answers in Europe. We'll email you only about this service: when it launches or if the plan changes, no more than [N] times and not after [date], and, if you ask for a call, to arrange it. Every email tells you how to unsubscribe. Apart from Tally and our email provider, which hold the list for us, no one else gets it, and we never sell it. We delete your answers on [date], or sooner if you unsubscribe or ask. We keep a short record that you agreed to our emails until [record date], and if you unsubscribe or ask us to delete your entry, we keep your address on a do-not-email list until [suppression date]. [How we handle the waitlist](/privacy/#waitlist).
>
> Questions? Email [admin@sombrexo.com](mailto:admin@sombrexo.com).

**Notes for whoever builds the page** (not page copy):
- Use a plain `<a href="TALLY_FORM_URL">` link and never Tally's embed. An embed loads `tally.so/widgets/embed.js` and an iframe as soon as `/business` opens, and passes the page's path and query string to Tally (https://developers.tally.so/widgets/introduction, https://developers.tally.so/widgets/embeds; partly). A plain link keeps the privacy page's "sets no cookies and runs no advertising or tracking scripts" true (D41).
- The paragraph under the link is the first layer of the collection notice. The OAIC accepts layered notices on forms (APP guidelines 5.5 and 5.6: https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-5-app-5-notification-of-the-collection-of-personal-information), and so does the ICO (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-methods-can-we-use-to-provide-privacy-information/; partly). Its retention sentences must say the same as the form, the thank-you page and the privacy page (step 8).
- Fill `[coverage]` from the build, as `homePage` and `aboutPage` do, so the page never states a stale count.
- "Who runs it" reuses the owner-approved About page wording.
- Forward-looking lines ("they'll stay free", "we plan to build it", "we'll email you if it launches before [date]") need reasonable grounds: under the Australian Consumer Law a statement about a future matter is taken to be misleading if the person had no reasonable grounds, and is presumed to have had none unless evidence is given (ACL s 4, Competition and Consumer Act 2010 Schedule 2, https://www.legislation.gov.au/C2004A00109/latest/text; text read through a reproduction at https://www.australiancompetitionlaw.org/legislation/provisions/acl4.html; partly). PLAN's M4 "Our offer" and "What happens next" are those grounds, so keep this page in step with PLAN (extend once; if both gates fail, maintenance mode and a re-test in 3 months; if A fails but B passes, M5 first).
- Don't use the `mailto:` fallback in PLAN as a way to *join*. An emailed request to join might count as express consent, but no record would show the terms the person saw, which the ACMA expects consent records to show (ACMA Statement of Expectations, link in step 8).
- Publish the page only once the privacy page change in section 3 is live (step 18).

---

## 2. Waitlist form text

Enter the text below exactly as written in Tally. Each block is one Tally block, in this order.

**Form title:** Join the Patchlife business waitlist

**Text block at the top** (second layer of the collection notice, shown where collection happens):

> Patchlife is testing whether MSPs, IT teams and suppliers want a paid service built on its free data. Nothing is for sale yet.
>
> **About your details.** Patchlife is run by [legal sender name], [town or state], Australia. Contact: admin@sombrexo.com. We collect what you enter on this form. Tally also records for us when you send it and random ID codes for your response and your browser, and counts visits to this form, which we see only as totals (for example by device, browser, country and city). We use your answers to email you about the planned service, to arrange a call if you ask for one, and to count interest during our four-week test. Tally hosts this form and says it stores the answers in Europe. Our emails are held by [mail provider] in [mail country]. Joining is optional: if you don't join, nothing else changes. Apart from Tally and our email provider, which hold the list for us, no one else gets it, and we never sell it. We delete your answers on [date], or sooner if you unsubscribe or ask. We keep a short record that you agreed to our emails until [record date], and if you unsubscribe or ask us to delete your entry, we keep your address on a do-not-email list until [suppression date]. Full details, including how to see, correct or delete your entry and how to complain: https://patchlife.tech/privacy/#waitlist
>
> **Your right to object.** We use the answers to count interest and decide whether to build the service, because testing demand is in our legitimate interests. You can object to this at any time by emailing admin@sombrexo.com.

**Question 1: Email block, required**
- Label: Work email

**Question 2: Multiple choice (one answer), required**
- Label: What kind of organisation are you?
- Options:
  - Managed service provider (MSP)
  - In-house IT team
  - Supplier, retailer or distributor
  - Device manufacturer
  - Other (please say)

**Question 3: Multiple choice (one answer), required**
- Label: Roughly how many connected devices do you look after, across all your sites or clients?
- Help text: Cameras, doorbells, routers, switches, access points, printers, NVRs and the like. Suppliers: count the SKUs you sell.
- Options:
  - Fewer than 50
  - 50 to 249
  - 250 to 999
  - 1,000 to 4,999
  - 5,000 or more
  - Not sure

**Question 4: Checkboxes, optional**
- Label: Which of these would be useful to you? Tick any.
- Options:
  - Alerts before a device's support ends
  - Fleet matching: check a list of devices against the data
  - Change history: what manufacturers said, and when we saw it change
  - A dependable feed or API
  - Supplier checks: whether a published support statement can be found for each of my SKUs
  - None of these

**Question 5: Long text, optional**
- Label: Anything else?
- Help text: For example, brands or device types you need covered, or how you track device support today. Please don't include anyone else's personal details or your clients' names.

**Text block above the checkboxes** (the consent terms, shown in full where consent is given):

> **Emails from Patchlife.** If you tick the first box below, Patchlife, run by [legal sender name] in [town or state], Australia, will email this address about its planned paid service for MSPs, IT teams and suppliers: when it launches, or if the plan changes (for example, if we decide not to build it). We'll send no more than [N] of these emails and none after [date] unless you sign up again. If you also tick the second box, we may email you to arrange a short call during the test. Emails arranging a call, and replies to your messages, don't count towards the limit. We won't add you to any other list. Every email says who sent it and how to unsubscribe. To unsubscribe, reply or email admin@sombrexo.com and ask us to stop: "unsubscribe" in the subject line is enough, and any message asking us to stop counts. We act on it within 5 business days, usually sooner.

**Checkbox 1: required, unticked by default**
- Email me about Patchlife's planned paid service, as described above.

**Checkbox 2: optional, unticked by default**
- Optional: you can also email me to arrange a short call about what I need.

**Submit button:** Join the waitlist

**Small text below the button:**
> Form wording version [YYYY-MM-DD]. Patchlife keeps a copy of this wording as a record of what you agreed to.

**Thank-you page** (Tally's ending page; on the free plan this is the only confirmation a sign-up gets):
> **Thanks, you're on the waitlist.**
>
> Unless you asked for a call, nothing else happens until we have news. We'll email you when the service launches or if the plan changes, no more than [N] times and not after [date]. If you asked for a call, we may also email you to arrange it. We don't send a confirmation email, so this page is your confirmation.
>
> To leave the list at any time, email admin@sombrexo.com or reply to any of our emails and ask us to stop. "Unsubscribe" in the subject line is enough.
>
> We delete your answers on [date], or sooner if you unsubscribe or ask. We keep a short record that you agreed to our emails until [record date], and if you unsubscribe or ask us to delete your entry, we keep your address on a do-not-email list until [suppression date]. How we handle your details: https://patchlife.tech/privacy/#waitlist

**Why the form is worded this way** (for the owner, not form text):
- An unticked box the person ticks, with terms beside it that say what the consent is for, who uses it, how long it lasts and how to withdraw it, and with no bundling: ACMA Statement of Expectations (https://www.acma.gov.au/sites/default/files/2024-06/ACMA%20-%20Statement%20of%20Expectations%20-%20Use%20of%20consent%20in%20telemarketing%20~%20marketing%20FINAL_0.DOCX; verified) and ACMA, which says express consent can be given by "filling in a form; ticking a box on a website" (https://www.acma.gov.au/avoid-sending-spam; verified). The ACMA calls its statement better practice, not a definitive compliance guide.
- The call request is a separate, optional box because the ACMA says "Do not use bundled consent" (Statement of Expectations, above). The ICO also wants consent to be granular, with no pre-ticked boxes (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/; partly).
- "Within 5 business days": the Spam Act 2003, Schedule 2, clause 6 (https://www.legislation.gov.au/C2004A01214/latest/text; verified).
- "Unsubscribe" is described as enough, not required, because any message "to the effect" that the person doesn't want more commercial emails, "or a message to similar effect", is an unsubscribe (s 18(9)) and withdraws consent (Schedule 2 clause 6(1)(d)) (Spam Act link above; verified). Unsubscribing by reply needs nothing but the person's own address and no login, as the Spam Regulations 2021 reg 7 require (https://www.legislation.gov.au/F2021L00285/latest/text; verified).
- The version line, and keeping each version's wording, is how the record shows "the terms that applied" (ACMA Statement of Expectations, above). The ICO also asks for "a master copy" of the consent wording in use at the time, with version numbers and dates (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/; partly).
- "Your right to object" is a separate paragraph because, if UK GDPR applies, counting interest rests on legitimate interests rather than the email consent (step 7), and the right to object must be brought to people's attention "clearly and separately from any other information", at the latest at the first communication (Art 21(4), https://www.legislation.gov.uk/eur/2016/679/article/21; partly).
- There is no name field, and the comments box has a "don't include others' details" line, because the OAIC recommends collecting only what you need (https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/tips-for-good-privacy-practice; verified).
- There is no price or willingness-to-pay question, because prices are the owner's decision. This leaves gate A partly unmeasurable (step 9).

---

## 3. Privacy page additions

Every rule below is cited inline in a **Source** line under the bullet. Source lines are for the owner and must not appear on the page.

### 3.1 Changes to the existing text (`privacyPage` in `scripts/build-site.mjs`)

These must go live **before** the form accepts its first response. The current page promises: "If this ever changes, for example when a waitlist collects email addresses, this page will say so before it happens." APP 5.1 also requires notice "at or before the time" of collection, or as soon as practicable after (http://classic.austlii.edu.au/au/legis/cth/consol_act/pa1988108/sch1.html; verified). UK GDPR Article 13 applies "at the time when personal data are obtained" (https://www.legislation.gov.uk/eur/2016/679/article/13; verified).

| Where | Now | Draft |
| --- | --- | --- |
| Meta description | Patchlife doesn't collect information about you. How search, hosting, corrections and questions work. | Patchlife doesn't collect information about you when you use this site. How search, hosting, corrections, questions and the business waitlist work. |
| "Last updated" | 22 October 2026. | The day this change goes live. |
| Opening sentence | Patchlife doesn't collect information about you. | Patchlife doesn't collect information about you when you use this site. If you email us or join the business waitlist, we hold what you send, as set out below. |
| First bullet, label only | **No accounts, forms or tracking.** | **No accounts or tracking.** (The rest of the bullet stays as approved.) |
| Closing sentence | If this ever changes, for example when a waitlist collects email addresses, this page will say so before it happens. | If anything else changes, this page will say so before it happens. |

The new opening sentence avoids an absolute promise: anyone who emails admin@sombrexo.com (the existing "Questions" bullet) gives Patchlife their address, and Tally counts visits to the form for Patchlife even from people who don't join.

Also update the approved-copy assertion in `tests/build-site.test.mjs`, which checks for the old opening sentence, and the comment above `privacyPage`, which records the approval issue.

### 3.2 New section, placed after the closing sentence

Heading: `<h2 id="waitlist">Business waitlist</h2>`

Intro paragraph: This section applies only if you open or join the waitlist form linked from the [Patchlife for business](/business/) page.

Bullets, in the page's existing `<li><strong>Label.</strong> Text</li>` style:

- **Who collects it.** Patchlife, run by [legal sender name], [town or state], Australia. Contact: admin@sombrexo.com.
  - Source: APP 5.2(a), identity and contact details (http://classic.austlii.edu.au/au/legis/cth/consol_act/pa1988108/sch1.html; verified). UK GDPR Art 13(1)(a) (https://www.legislation.gov.uk/eur/2016/679/article/13; verified).

- **What we collect.** What you enter on the form: your work email address, what kind of organisation you are, roughly how many devices you look after, which features interest you, any comments, and whether you'd like a call. Tally also records for us when you sent the form and random ID codes for your response and your browser. When anyone opens the form, Tally counts the visit and records where it came from, the device, browser, operating system, country and city, which we see only as totals. We don't ask for your name.
  - Source: APP 1.4(a), the kinds of personal information collected (sch1 link above; verified). Tally's Insights tab shows the form owner visits, unique visitors, traffic sources, devices, countries and cities, browsers and operating systems, free for the past 7 days (https://tally.so/help/form-insights; partly). Each response carries a Respondent ID, kept in the browser's local storage and the same across a workspace's forms, and a Submission ID (https://tally.so/help/faq, https://tally.so/help/prevent-duplicate-submissions; partly). Tally's DPA lists the data it processes as "(Electronic) identification data" and "Form data" (Art 2.5, https://tally.so/help/data-processing-agreement; verified). Confirm the list against a test form before publishing (step 15, T8). The OAIC treats an email address as generally personal information (https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/handling-personal-information/what-is-personal-information; partly). OAIC: collect only what you need (https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/tips-for-good-privacy-practice; verified).

- **Why.** To email you about our planned paid service for businesses (when it launches, or if the plan changes), to arrange a call if you asked for one, and to count interest during our four-week test. We also keep a short record to show you agreed to our emails, and a do-not-email list (see "How long we keep it"). We won't use it for anything else.
  - Source: APP 5.2(d) and APP 1.4(c), purposes (sch1 link above; verified). UK GDPR Art 13(1)(c) (Art 13 link above; verified). Consent covers only what it says: Spam Act 2003 s 16 (https://www.legislation.gov.au/C2004A01214/latest/text; verified). Don't email to ask for broader consent later (https://www.acma.gov.au/avoid-sending-spam; verified).

- **Legal basis.** We email you about the service, and about a call if you ticked that box, because you agreed. You can withdraw that consent at any time by unsubscribing. We use the answers to count interest and decide whether to build the service, because testing demand is in our legitimate interests.
  - Source: UK GDPR Art 13(1)(c), purposes and legal basis, and 13(1)(d), the legitimate interests where they are the basis (Art 13 link above; verified). Art 6(1)(a), consent "for one or more specific purposes", and 6(1)(f), legitimate interests (https://www.legislation.gov.uk/eur/2016/679/article/6; partly). Art 13(2)(c), the right to withdraw consent at any time (Art 13 link above; verified), and Art 7(3) (https://www.legislation.gov.uk/eur/2016/679/article/7; partly). Spam Act s 16(2) and Schedule 2 clause 2, express consent (Spam Act link above; verified). Needed only if UK GDPR applies (step 7).

- **Your right to object.** You can object at any time to our using your answers to count interest. Email admin@sombrexo.com and we'll stop.
  - Source: UK GDPR Art 21(1) and (4): the right must be "explicitly brought to the attention of the data subject" and "presented clearly and separately from any other information", at the latest at the first communication (https://www.legislation.gov.uk/eur/2016/679/article/21; partly). Keep it as its own bullet. Needed only if UK GDPR applies and counting rests on legitimate interests (step 7).

- **Joining is optional.** If you don't join, nothing changes: everything on Patchlife stays free to use.
  - Source: APP 5.2(e), main consequences of not providing the information (sch1 link above; verified). UK GDPR Art 13(2)(e) (Art 13 link above; verified).

- **Who holds it.** Tally (Tally BV, Belgium) hosts the form and stores the answers for us under its data processing agreement. Our emails, including your replies and requests, are held by our email provider, [mail provider]. The owner keeps the consent record and the do-not-email list in [record place]. Only the owner sees individual answers; any numbers we publish are totals. We don't sell, rent or swap the list, or share it with anyone else.
  - Source: APP 5.2(f) and UK GDPR Art 13(1)(e), recipients (links above; verified). Tally is the processor and the form creator the controller, and the DPA is accepted with Tally's terms (https://tally.so/help/gdpr; verified). Tally processes "only on the documented instructions" of the controller, Art 4.1 (https://tally.so/help/data-processing-agreement; verified). Every waitlist email goes out from admin@sombrexo.com, and PLAN's fallback route runs "through email forwarding" (docs/PLAN.md, M4 Waitlist), so the mail provider holds the list's addresses too (step 10). Trading in personal information can remove the small business exemption, Privacy Act s 6D(4)(c) and (d) (http://classic.austlii.edu.au/au/legis/cth/consol_act/pa1988108/s6d.html; verified; OAIC: https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/trading-in-personal-information; verified).

- **Where it's stored.** Tally says all form data is stored in Europe, and lists Google Cloud in Belgium as the service that holds form answers. Our emails are stored by [mail provider] in [mail country]. The owner reads the answers and the emails from Australia. [If UK GDPR applies: a sentence on UK transfer safeguards, wording to be settled with an adviser (step 6).]
  - Source: "All Tally form data is encrypted both in transit and at rest, and stored in Europe", and the sub-processor table (https://tally.so/help/gdpr; verified). The DPA lets Tally name sub-processors by category only (Art 9.2) and, by exception, transfer data outside the EEA under standard contractual clauses (Art 14.1) (DPA link above; verified), so the page attributes the Europe statement to Tally. APP 5.2(i) and (j), and APP 1.4(f) and (g), overseas disclosure and countries (sch1 link above; verified). Giving information to an overseas contractor is usually a disclosure, though limited cloud storage may be a use, APP guidelines 8.12 and 8.14 (https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information; verified). UK GDPR Art 13(1)(f), transfers (Art 13 link above; verified). The ICO's restricted-transfer test (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/are-we-making-a-restricted-transfer/; partly) is applied in step 6 and is unresolved. UK adequacy regulations cover all EEA countries, and there are none for Australia (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/adequacy-regulations/is-the-restricted-transfer-covered-by-adequacy-regulations/; partly).

- **Tally's website.** The form is on Tally's site, not ours. Tally runs it for us, so this page covers what Tally records for us. For anything Tally does for its own purposes, see [Tally's privacy policy](https://tally.so/privacy). Patchlife's own pages load nothing from Tally.
  - Source: this is accuracy, not a legal rule. Tally's privacy policy (https://tally.so/privacy, last updated 20/11/2023) treats the form creator as the controller of respondent data (partly); the earlier link, tally.so/help/privacy-policy, wasn't found in searches. Tally's form page stores a respondent ID in the browser's local storage (https://tally.so/help/prevent-duplicate-submissions; partly). What else that page loads for Tally's own purposes could not be checked (open question T4), so the page must not promise anything about it.

- **Emails.** We'll email you about the planned service no more than [N] times and not after [date]. If you asked for a call, we may also email you to arrange it. Those emails, replies to your messages and any notice about a data breach don't count towards the limit. Every email says who sent it and how to unsubscribe. To unsubscribe, reply or email admin@sombrexo.com and ask us to stop: "unsubscribe" in the subject line is enough, and any message asking us to stop counts. We'll stop within 5 business days, usually sooner.
  - Source: Spam Act s 17 (sender identification), s 18 (unsubscribe facility), s 18(9) (any message to that effect, "or ... to similar effect", is an unsubscribe message) and Schedule 2 clause 6 (withdrawal takes effect within 5 business days) (https://www.legislation.gov.au/C2004A01214/latest/text; verified). Spam Regulations 2021 reg 7, unsubscribe conditions (https://www.legislation.gov.au/F2021L00285/latest/text; verified). ACMA guidance (https://www.acma.gov.au/avoid-sending-spam; verified). UK: PECR reg 22 and 23 (https://www.legislation.gov.uk/uksi/2003/2426/regulation/22; partly), and the ICO on business addresses (https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/; partly).

- **How long we keep it.** We delete all the answers on [date], or yours sooner if you unsubscribe or ask. Deleted answers leave Tally's backups within 90 days. Until [record date] we keep a short record of your email address, when you joined, which version of the form you saw and when we emailed you, so we can show you agreed to our emails. If you unsubscribe or ask us to delete your entry, we keep your email address on a do-not-email list until [suppression date], so we don't email you again by mistake.
  - Source: APP 11.2, destroy or de-identify information that is no longer needed (sch1 link above; verified). UK GDPR Art 13(2)(a), storage period (Art 13 link above; verified). Tally: deleted data leaves its backups "within 90 days" (https://tally.so/help/gdpr; verified). A sender relying on consent bears an evidential burden: it must point to evidence that suggests a reasonable possibility of consent (Spam Act s 16(5), with "evidential burden" defined in s 4; Spam Act link above; verified), and the ACMA says "Keep a record when a person gives express consent, including who gave the consent, when and how" (https://www.acma.gov.au/avoid-sending-spam; verified). A suppression record of withdrawals is allowed, but people must be told about it (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/; partly). The same three dates appear in every layer (sections 1 and 2; step 8).

- **Your choices.** Email admin@sombrexo.com to see what you gave us, correct it, delete it, get a copy, ask us to stop or limit using it, or withdraw your consent.
  - Source: UK GDPR Art 13(2)(b), the rights of access, rectification, erasure, restriction, objection and portability, and 13(2)(c), withdrawal (Art 13 link above; verified). APP 1.4(d), how to seek access and correction (sch1 link above; verified). APPs 12 and 13 themselves were not researched.

- **Complaints.** Email admin@sombrexo.com. We'll confirm we've received your complaint within 30 days, usually much sooner, and tell you the outcome as soon as we can. [Only if Patchlife is covered by the Privacy Act or opts in: "If you're not happy with our reply, you can complain to the Office of the Australian Information Commissioner at oaic.gov.au."] [Only if UK GDPR applies: "If you're in the UK, you can also complain to the UK Information Commission (ICO) at ico.org.uk."]
  - Source: APP 5.2(h) and APP 1.4(e), complaints (sch1 link above; verified). UK Data Protection Act 2018 s 164A: acknowledge within 30 days and respond without undue delay (https://www.legislation.gov.uk/ukpga/2018/12/section/164A; partly). UK GDPR Art 13(2)(ca) and (d) (Art 13 link above; verified). The ICO has been the Information Commission since 30 September 2026 (https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/09/ico-welcomes-transition-to-new-information-commission-and-marks-new-chapter-with-manchester-head-office-opening/; verified). The OAIC line is conditional because an exempt small business that hasn't opted in isn't covered (https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business; verified).

- **No automated decisions.** We don't make automated decisions about you.
  - Source: UK GDPR Art 13(2)(f) (Art 13 link above; verified).

- **If something goes wrong.** If waitlist details are lost or exposed, whether at Tally, in our email or on the owner's computer, we'll tell the people affected, say so on this page and report it to a regulator where the law requires.
  - Source: UK GDPR Art 33(1) and (5) (https://www.legislation.gov.uk/eur/2016/679/article/33; partly). Privacy Act s 26WH and the OAIC quick reference guide (https://www.oaic.gov.au/privacy/notifiable-data-breaches/quick-reference-guide-for-responding-to-data-breaches; partly). Tally must notify the controller "without undue delay", and "It is the responsibility of the CONTROLLER to notify the Supervisory Authority" (DPA Art 5.2 and 5.5, https://tally.so/help/data-processing-agreement; verified). The OAIC recommends a data breach response plan (tips link above; verified). Details in step 20.

- **[Only if a UK representative is appointed] UK representative.** [Name and contact details.]
  - Source: UK GDPR Art 13(1)(a) and Art 27 (https://www.legislation.gov.uk/eur/2016/679/article/27; verified).

---

## 4. Owner checklist (H9b)

Do these in order before the form link goes live. Steps marked **(gate)** are human gates under CLAUDE.md: spending money, creating accounts, legal text and contacting people.

### A. Decide

1. **Choose the name every email and notice will carry** `[legal sender name]` **(gate: legal text).** Each commercial email must "clearly and accurately" identify who authorised it, with contact details valid for at least 30 days, under Spam Act s 17 (https://www.legislation.gov.au/C2004A01214/latest/text; verified). The ACMA says to use "the correct legal name of your business, or your name and Australian Business Number (ABN)" (https://www.acma.gov.au/avoid-sending-spam; verified). The privacy notice needs the same identity: APP 5.2(a) (http://classic.austlii.edu.au/au/legis/cth/consol_act/pa1988108/sch1.html; verified) and UK GDPR Art 13(1)(a) (https://www.legislation.gov.uk/eur/2016/679/article/13; verified). There are two options:
   - your first name and surname, which needs no registration. The Act only requires that each email clearly and accurately identifies who authorised it (s 17), but the ACMA's guidance pairs a person's name with an ABN, so a name alone departs from that guidance. An individual is entitled to an ABN only if carrying on or starting an enterprise in Australia, or making supplies connected with Australia's indirect tax zone (ABR: https://www.abr.gov.au/business-super-funds-charities/applying-abn/abn-entitlement; partly);
   - a registered "Patchlife" business name, which needs an ABN and moves part of H9c earlier. ASIC: "You must register a business name if you run a business in Australia and are not trading under your own name" (https://www.asic.gov.au/for-business-and-companies/business-names/register-a-business-name; verified; whether it applies to Patchlife today is open question S2).

   "Patchlife" alone is not a legal identity. Either way, your name or business name appears in every email footer.

2. **Confirm whether the Privacy Act covers Patchlife.** A small business (annual turnover of $3 million or less) is exempt, but the test looks at every business the entity carries on: a small business operator carries on only small businesses. An individual or entity is not a small business operator if it carries on a business that has had annual turnover over $3 million in a financial year ending after that business started (or after s 6D began, if later) (s 6D(4)(a), http://classic.austlii.edu.au/au/legis/cth/consol_act/pa1988108/s6d.html; verified; OAIC list of exceptions: https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business; verified). Because the test turns on a business the entity still carries on, it may stop applying if that business is sold or closed. If Patchlife is run by a company, being related to a company that carries on a larger business also brings it in (s 6D(9); its wording was read only through a secondary summary, so check it). The contact address is on sombrexo.com. If you, or the entity that runs Patchlife, carry on another business that has turned over more than $3 million, Patchlife is covered, and APP 5 is mandatory rather than good practice. Then decide:
   - whether to opt in under s 6EA. It costs nothing, but needs an ABN and a published privacy policy, and puts your trading name and ABN on a public register (https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/opting-in-to-the-privacy-act; verified);
   - whether to include the OAIC line in the privacy page's Complaints bullet. Include it only if Patchlife is covered or opted in.

3. **Decide whether `/business` and the week 1 posts deliberately target UK buyers.** UK GDPR reaches a controller outside the UK that offers services to people in the UK, "irrespective of whether a payment ... is required" (Art 3(2)(a), https://www.legislation.gov.uk/eur/2016/679/article/3; verified). Recital 23 of the GDPR says the "mere accessibility" of a website, email address or other contact details is insufficient to show an intention to offer services there, while mentioning customers or users who are there can show it (https://eur-lex.europa.eu/eli/reg/2016/679/oj; partly: read through a secondary copy, and its weight under UK GDPR wasn't checked). Internal ICO staff guidance, released under freedom of information request IC-327905-Y2Y5 in September 2024 and not published as guidance for organisations, says "if it's not clear, it's likely the UK GDPR doesn't apply" (https://ico.org.uk/media2/migrated/4031113/ic-327905-y2y5-knowledge-hub-territorial-scope.pdf; disclosure log: https://ico.org.uk/about-the-ico/our-information/disclosure-log/2024/09/ic-327905-y2y5/; partly). Don't rely on that presumption. BRIEF and SPEC 5 cover Australian and UK statements and buyers, and a post in a UK community or a page mentioning UK customers would point to targeting, so the draft is written as if UK GDPR applies. If you say yes, steps 4 to 6 follow.

4. **If UK GDPR applies: decide on a UK representative (gate: money and contracts; take advice).** Art 27 requires one in writing unless processing is "occasional" and low risk (https://www.legislation.gov.uk/eur/2016/679/article/27; verified). The internal ICO guidance in step 3 says UK law doesn't define "occasional", and cites the EDPB view that processing is occasional only if it isn't carried out regularly and falls outside the normal course of business (partly: read through a search summary). The waitlist is Patchlife's normal M4 activity, so the exemption looks doubtful (my reading). If you appoint one, their details go in the privacy page (section 3.2, last bullet).

5. **If UK GDPR applies: the ICO data protection fee (gate: money).** The ICO says overseas controllers within UK GDPR scope must register and pay unless exempt (https://ico.org.uk/for-organisations/data-protection-fee/paying-a-data-protection-fee-what-do-you-need-to-know/extraterritorial-organisations/; partly). One exemption covers processing only for "advertising, marketing and public relations" of your own goods and services (https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/exemptions/; partly). Whether it covers this waitlist is open question U3.

6. **If UK GDPR applies: settle the transfer sentence for the privacy page.** Belgium is covered by UK adequacy regulations, and Australia is not (link in section 3.2, "Where it's stored"; partly). The ICO's test for a restricted transfer asks whether UK GDPR applies to the processing, whether you are initiating a transfer to a receiver outside the UK, and whether the receiver is a separate organisation (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/are-we-making-a-restricted-transfer/; partly). Its Australian shoe retailer example shows UK GDPR applying to a seller outside the UK; it doesn't say that collecting from UK customers is itself a restricted transfer. Tally's DPA contains EU standard contractual clauses, Module Four (processor to controller), governed by Belgian law, with no UK Addendum or IDTA (https://tally.so/help/data-processing-agreement; verified). Ask an adviser: when Tally in Belgium makes UK sign-ups' answers available to you in Australia, is that a restricted transfer, who initiates it, and what safeguard is needed? Ask the same about the mail provider (step 10). Then fill the bracket in section 3.2.

7. **Choose what UK GDPR Art 13 needs that the APPs don't.** Sections 2 and 3 already include the legal basis for each purpose, the right to object, withdrawal of consent, all six rights, complaints to Patchlife, no automated decisions and the ICO line in brackets (Art 13 link above; verified). The legal basis has to fit each purpose. Box 1 covers emails only, and consent must be "for one or more specific purposes", so the draft uses consent (the two boxes) for the emails and legitimate interests for counting the answers (Art 6(1)(a) and (f), https://www.legislation.gov.uk/eur/2016/679/article/6; partly). Relying on legitimate interests means stating them (Art 13(1)(d); verified) and showing the right to object "clearly and separately from any other information", at the latest at the first communication (Art 21(4), https://www.legislation.gov.uk/eur/2016/679/article/21; partly). The alternative is a separate, optional consent box for counting, which would leave non-ticking sign-ups out of the gate A counts. Confirm which you want, and whether to show these points to everyone. One notice for all sign-ups is simpler, because the form doesn't ask where people are.

8. **Set the numbers in the wording.**
   - `[N]`, the most emails about the service per sign-up. Emails arranging a call the person asked for, replies to their messages and any breach notice don't count.
   - `[date]`, when the consent lapses and the answers are deleted. It must be late enough to cover the expected M6 launch. The ACMA warns against relying on consent so old that "a consumer would not expect it to still apply" (Statement of Expectations: https://www.acma.gov.au/sites/default/files/2024-06/ACMA%20-%20Statement%20of%20Expectations%20-%20Use%20of%20consent%20in%20telemarketing%20~%20marketing%20FINAL_0.DOCX; verified). Its 3-month figure is for telemarketing, not email.
   - `[record date]`, how long to keep the minimal consent record (email, sign-up time, form version, dates sent, unsubscribe dates). The Act sets no period. A sender relying on consent bears an evidential burden: it must point to evidence that suggests a reasonable possibility of consent (s 16(5), with "evidential burden" defined in s 4), and the ACMA can start civil penalty proceedings within 6 years (s 26(2)) (Spam Act link above; verified). Keeping records for that long is my inference, not a stated rule. It pulls against APP 11.2 (sch1 link above; verified) and the ICO's "for as long as you are still processing based on the consent" (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/; partly). Owner or legal decision.
   - `[suppression date]`, how long to keep the addresses of people who unsubscribe or ask to be deleted on the do-not-email list. The ACMA: "Do not re-contact consumers who have unsubscribed" (Statement of Expectations, above; verified).

   Every layer of the notice (the `/business` paragraph, the form's top text, the thank-you page and the privacy page) now states all three dates, so they stay consistent and none promises deletion of the address on `[date]` alone (UK GDPR Art 13(2)(a), Art 13 link above; verified). If you'd rather make one simple promise, set `[record date]` and `[suppression date]` no later than `[date]` and shorten the wording in all four places, accepting a weaker consent record. The H9b retention limit is the `[date]`.

9. **Decide how gate A is measured (gate: prices).** Gate A counts sign-ups "choosing" price bands and "qualified sign-ups" (https://github.com/sombreserotonin/Patchlife/blob/main/docs/PLAN.md, M4 Gates; D31). The form has no price question, because prices are your decision. Before day 0 (D31 allows changes only then), either:
   - write a willingness-to-pay question with bands you choose, which the notice then lists as a field; or
   - change gate A.

   Also define "qualified". A suggestion: organisation type MSP, in-house IT or supplier, and fleet size of [band] or more.

10. **Name where the waitlist's emails and records live.** Every launch, call and unsubscribe email, and every reply, passes through and stays in the mailbox behind admin@sombrexo.com, and PLAN's fallback route runs "through email forwarding" (docs/PLAN.md, M4 Waitlist). The consent record and the do-not-email list also live outside Tally once entries are deleted. Write down:
    - `[mail provider]` and `[mail country]`: the service that hosts the mailbox, any forwarding service, and the countries where they store mail;
    - `[record place]`: where you keep the consent record and the do-not-email list, for example a file on your own computer.

    The notice must name the bodies Patchlife usually discloses to, and any overseas recipients and their countries: APP 5.2(f), (i) and (j), and APP 1.4(f) and (g) (sch1 link above; verified); UK GDPR Art 13(1)(e) and (f) (Art 13 link above; verified). Giving information to an overseas contractor is usually a disclosure (APP guidelines 8.12, link in section 3.2; verified). Then fill the brackets in sections 2 and 3.2, and add the provider to steps 20 and 25. Alternatively, choose providers whose locations the notice already covers.

11. **Decide on a postal address for US and Canadian sign-ups (gate: legal text, and money if you rent a box).** The form doesn't ask where people are, and MSP communities are international. The US FTC says CAN-SPAM "makes no exception for business-to-business email", and each commercial email must include a valid physical postal address: a current street address, a post office box registered with the US Postal Service, or a private mailbox registered with a commercial mail receiving agency (https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business; partly). Whether an Australian post office box satisfies that wasn't checked. Canada's CRTC says a commercial electronic message must set out the sender's mailing address (Compliance and Enforcement Information Bulletin CRTC 2012-548, https://crtc.gc.ca/eng/archive/2012/2012-548.htm, quoted through a secondary source; Electronic Commerce Protection Regulations (CRTC), SOR/2012-36 s 2, https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/FullText.html; partly, the paragraph itself wasn't read). Whether either law reaches an Australian sender wasn't researched (U10). Either:
    - add `[postal address]` to the email footer (step 17); or
    - limit the waitlist to Australia and the UK: say so on `/business` and add a country question, which the notice must then list.

### B. Set up Tally

12. **Create the Tally account on the free plan (gate: accounts),** with a workspace used only for the waitlist. The form creator is the controller and Tally the processor (https://tally.so/help/gdpr; verified). Tally's respondent ID persists "between all forms from within the same workspace" (https://tally.so/help/faq; partly), so a separate workspace stops sign-ups being linked to any other forms you make.

13. **Read the data processing agreement and keep your own dated copy.** Creating the account accepts it, with nothing to sign: "It is not necessary to sign this document" (https://tally.so/help/gdpr; verified). Four points to note (https://tally.so/help/data-processing-agreement; verified):
    - Tally's liability is capped at the fees paid in the prior 12 months (Art 18.4), which is zero on the free plan.
    - Tally may amend the DPA on 30 days' notice, and silence counts as acceptance (Art 21.2).
    - It is written for "professional users ... on behalf of their company" (open question T1).
    - Its transfer clauses are EU standard contractual clauses (Module Four), with no UK Addendum or IDTA (step 6).

    A copy read on 22 October 2026 is in this session's scratchpad (`m4-prep/tally-src/dpa.md`), but scratchpad files don't last, so save your own.

14. **Build the form exactly as section 2,** with the consent box unticked and required, and the call box separate, optional and unticked.
    - ACMA: "Do not use pre-checked tick boxes on forms" and "Do not use bundled consent", and put the terms where consent is given, "not hidden away in fine print" (Statement of Expectations, above; verified).
    - ICO: "Don't use pre-ticked boxes" (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/how-should-we-obtain-record-and-manage-consent/; partly).
    - OAIC: show the APP 5 matters in the form, or give a prominent link (APP guidelines 5.6, https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-5-app-5-notification-of-the-collection-of-personal-information; verified).

    Copy the share link from the Share tab into `TALLY_FORM_URL`.

15. **Configure the form so the notice stays true.** By Tally's own sub-processor table, a form with only text, choice and email fields is processed by Google Cloud in Belgium (https://tally.so/help/gdpr; verified). The DPA lets Tally name sub-processors by category only (Art 9.2) and, by exception, transfer data outside the EEA under standard contractual clauses (Art 14.1) (https://tally.so/help/data-processing-agreement; verified), so the table may not be complete. That is why the notice says "Tally says".
    - **Self email notifications: off.** They are switched on with a toggle (https://tally.so/help/self-email-notifications; partly), and the default for a new form is unknown (T3). If they're on, each sign-up goes through SendGrid in the US and into your inbox, and the notice would have to name the United States.
    - **No file upload, payment or reCAPTCHA blocks.** Uploads go to Cloudflare storage, payments to Stripe in the US (sub-processor table, above; verified), and reCAPTCHA brings in Google (https://tally.so/help/recaptcha; partly).
    - **Prevent duplicate submissions: off.** It identifies people by a field such as IP address, email or Respondent ID (https://tally.so/help/prevent-duplicate-submissions; partly), and the notice doesn't mention IP addresses.
    - **No integrations** (Google Sheets, Notion, webhooks). Each copies sign-ups to another provider.
    - **No respondent confirmation emails or email verification.** These are paid features (https://tally.so/help/respondent-email-notifications, https://tally.so/help/email; partly). If you ever pay for them (gate), each email is sent with Patchlife's authority and must identify Patchlife (Spam Act s 17, link above; verified).
    - **Check what Tally records.** Submit a test entry, then compare the Submissions columns and the Insights tab with the "What we collect" bullet and the form's top text, and fix the wording before going live (T8).
    - **Close the form at the end of M4 day 28.** Tally's pricing page lists "Close forms on limit or date" as free (https://tally.so/pricing; partly; confirm in Settings).
    - Leave the form unpublished, or keep its link unshared, until step 18 is done.

### C. Before the first response

16. **Save the master copy of the form wording**, dated and matching the version line, outside the repo (a PDF or text file). Save it again whenever any wording changes. ACMA: records "should include the method by which the consent was obtained, the terms that applied and the date and time it was obtained", and must be produced if the ACMA demands them (Statement of Expectations, above; verified). Tally keeps submissions and their timestamps, but not a history of the form text it showed.

    **If UK GDPR applies, also write a one-page record of processing** for the waitlist and keep it with the master copy: purposes, the kinds of people and data, recipients (Tally and the mail provider), transfers, retention dates and security measures. An organisation with fewer than 250 staff is exempt only where its processing is occasional, unlikely to result in a risk and involves no special category or criminal offence data (Art 30(5), https://www.legislation.gov.uk/eur/2016/679/article/30; partly). The ICO's example is an insurer with 100 staff that "must still document" its regular processing "because they are not occasional" (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/documentation/who-needs-to-document-their-processing-activities/; partly). The waitlist is Patchlife's normal M4 activity, so it isn't occasional on that reading (step 4).

17. **Prepare the email footer and the unsubscribe routine.** Draft footer:
    > You're getting this because you joined the Patchlife business waitlist and agreed to emails about the planned paid service. Sent by [legal sender name], who runs Patchlife, [town or state], Australia. [postal address, if chosen in step 11] Contact: admin@sombrexo.com. To stop these emails, reply and ask us to stop, or email admin@sombrexo.com. "Unsubscribe" in the subject line is enough. We act on it within 5 business days, usually sooner.
    - Every email needs sender identification and a "clear and conspicuous" unsubscribe statement, with an address that can receive unsubscribe messages for at least 30 days after sending (Spam Act s 17 and s 18, https://www.legislation.gov.au/C2004A01214/latest/text; verified). Keep admin@sombrexo.com working indefinitely.
    - Unsubscribing must not need anything beyond the email address, any payment or a login (Spam Regulations 2021 reg 7, https://www.legislation.gov.au/F2021L00285/latest/text; verified).
    - Treat any message that says, in effect, "stop emailing me" as an unsubscribe, whatever its wording or subject line: an unsubscribe message includes "an electronic message to similar effect" (s 18(9)), and consent is withdrawn by "a message to similar effect" (Schedule 2 clause 6(1)(d)) (Spam Act link above; verified). Read the inbox by hand rather than relying on a subject-line filter. "Message" includes speech (s 4), and clause 6(1)(f) and (g) cover messages sent by post or delivered another way, so treat a request made on a call or by letter the same way (my reading).
    - It must take effect within 5 business days, counted from the day an emailed request was sent (Schedule 2 clause 6(1)(e), Spam Act link above; verified). Aim for the same or the next business day, and log both the date received and the date actioned.
    - Treat every waitlist email as commercial, including a factual "we're not going ahead" email. A message is commercial if any of its purposes is promotion, and it doesn't matter whether the service exists yet (s 6(1) and (2), Spam Act link above; verified). A link to a commercial page "is likely to mean the message is also commercial" (ACMA Statement of Expectations, above; verified).
    - Send one email per person, or put everyone in BCC, so the list isn't exposed (OAIC: protect what you hold, https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/tips-for-good-privacy-practice; verified).
    - If an email bounces, delete that entry. Spam Act s 16(6) bars commercial emails to non-existent addresses where the sender had no reason to believe they existed (Spam Act link above; verified). Applying it to bounces is my reading.
    - Sections 16(1), 17(1) and 18(1) are civil penalty provisions (s 16(11), s 17(7) and s 18(8)). The ACMA can seek penalties in the Federal Court (s 24 and s 26, with maximums in s 25), give infringement notices (s 30 and Schedule 3), seek injunctions (s 32), accept enforceable undertakings (s 38) or issue formal warnings (s 41) (Spam Act link above; verified). No dollar figure is given here because the penalty unit value wasn't verified.

18. **Approve and publish the privacy page change (section 3) and `/business` (section 1) through a `needs-human` issue (gate: legal text),** and confirm both are live on patchlife.tech before the form link is shared. The current privacy page promises to change "before it happens" (`scripts/build-site.mjs`, `privacyPage`). For timing, see APP 5.1 (http://classic.austlii.edu.au/au/legis/cth/consol_act/pa1988108/sch1.html; verified) and UK GDPR Art 13 (https://www.legislation.gov.uk/eur/2016/679/article/13; verified).

19. **Write the request and deletion routine into RUNBOOKS** once the retention date is approved.
    - **One entry:** Submissions tab, select the entry, trash icon. Then Trash in the left sidebar, Empty trash. Without that step, deleted entries sit in Trash for 90 days (https://tally.so/help/how-to-delete-and-recover-form-data; verified).
    - **The free plan has no automatic deletion.** It is a Tally Business feature (https://tally.so/help/submissions-data-retention; verified), so put the `[date]` in a dated issue or the M4 close checklist.
    - **Requests to see, correct, delete or copy an entry:** if UK GDPR applies, answer within one month of receiving the request (or of receiving any identity details you asked for), extendable by two further months for complex or numerous requests if you say so, with reasons, within the first month (Art 12(3) and Art 12A, as amended and inserted by the Data (Use and Access) Act 2025 s 76, https://www.legislation.gov.uk/ukpga/2025/18/section/76; partly). Log the dates received and answered. APP 12 and 13 timing wasn't researched.
    - **Complaints:** acknowledge within 30 days and respond without undue delay (UK DPA 2018 s 164A, https://www.legislation.gov.uk/ukpga/2018/12/section/164A; partly).

20. **Write a one-paragraph breach plan.** Cover every place the waitlist lives: Tally, the mailbox and any forwarding service (step 10), the consent record and do-not-email list, and any CSV copy (step 23). Whatever the cause, email the affected sign-ups and say so on the privacy page. The OAIC recommends a breach response plan (tips link above; verified).
    - Tally must tell you about a breach at Tally "without undue delay" (DPA Art 5.2), and reporting to a regulator is your job: "It is the responsibility of the CONTROLLER to notify the Supervisory Authority of a Personal Data Breach" (DPA Art 5.5) (https://tally.so/help/data-processing-agreement; verified).
    - **If UK GDPR applies:** notify the ICO without undue delay and, where feasible, within 72 hours of becoming aware, unless the breach is unlikely to result in a risk to people's rights and freedoms, and keep a dated log of every breach, its effects and what you did, whether or not you report it (Art 33(1) and (5), https://www.legislation.gov.uk/eur/2016/679/article/33; partly).
    - **If the Privacy Act covers Patchlife (step 2):** where you suspect an eligible data breach, assess it promptly, taking all reasonable steps to finish within 30 days (s 26WH), and for an eligible data breach notify the people at risk of serious harm and give a statement to the OAIC as soon as practicable (OAIC quick reference guide, https://www.oaic.gov.au/privacy/notifiable-data-breaches/quick-reference-guide-for-responding-to-data-breaches; partly).

21. **Re-check before M4 day 0.**
    - **Spam Act.** Compilation No. 10 (C2016C00614) and the Spam Regulations 2021 (F2021L00285) were current on 22 October 2026. Open the register's "Show known future amendments" view, which wasn't checked (https://www.legislation.gov.au/C2004A01214/latest/versions).
    - **Privacy Act.** Check the Tranche 2 bill: the exposure draft closed on 18 September 2026 and "remains subject to further consideration by government" (https://consultations.ag.gov.au/rights-and-protections/privacy-reform/; partly). Confirm the s 6D (including s 6D(9)) and Schedule 1 text against the legislation.gov.au compilation (https://www.legislation.gov.au/Series/C2004A03712), because AustLII and search summaries were used.
    - **Tally.** Check the live GDPR page, DPA and Insights help page for sub-processor, term or data changes.

### D. While it runs

22. **Never email anyone to invite them to join (gate: contacting people).** That includes MSPs found online, GitHub issue authors and people who wrote to the contact address.
    - "You cannot send an electronic message to ask for consent, because this is a marketing message" (https://www.acma.gov.au/avoid-sending-spam; verified).
    - Consent can't be inferred merely from a published address, and the exception for addresses published with the holder's agreement is narrow (Spam Act Schedule 2 clause 4, Spam Act link above; verified).
    - Direct messages on community platforms may be electronic messages too (s 5, same link; partly). Recruit through `/business` and public posts only.

23. **Keep the list out of GitHub and out of AI agents.**
    - The repo is public, so the Monday `M4 weekly numbers` issue gets counts only (sign-ups by organisation type and fleet band, and call requests). Never paste email addresses, comments or CSV exports into issues, PRs or the repo.
    - The privacy page says only the owner sees individual answers. If you ever want an agent to read them, for example to summarise the comments, change the notice first, because another provider would then receive them (APP 5.2(f), sch1 link above; verified).
    - Any CSV you download (https://tally.so/help/faq; partly) is a copy. Note where you keep it, and delete it on `[date]`.

24. **Action unsubscribes and deletion requests promptly and log them** (step 17). Any reply or email asking to stop counts, whatever its wording or subject line, and so does a request made on a call. Delete the entry in Tally and add the address to the do-not-email list.

25. **Watch the Tally account email, and notices from the mail provider, for DPA, terms or sub-processor changes.** Tally's amendments take effect 30 days after notice (Art 21.2), and new "Substantial Subprocessors" are notified (Art 9.1) (https://tally.so/help/data-processing-agreement; verified). If a change moves where submissions or emails are stored, update the privacy page first.

### E. At the end

26. **On `[date]`:**
    - delete every submission, empty Trash and delete the form, which deletes its submissions (https://tally.so/help/how-to-delete-and-recover-form-data; verified);
    - delete any CSV copies, and delete waitlist emails and replies from the mailbox, keeping only what the consent record and do-not-email list need;
    - optionally ask Tally to certify the deletion. Under DPA Art 20.3 Tally will "certify that it has done so" (https://tally.so/help/data-processing-agreement; verified);
    - if M4 is a no-go and Tally isn't needed, delete the account. This deletes all forms and submissions and can't be undone (https://tally.so/help/account-settings; partly).

    Keep only the consent record and the do-not-email list until their dates (step 8).

### Open questions (the research could not verify these)

**Spam Act and email**
- S1. Is the "place to which the message was sent" in Schedule 2 clause 6(2) the place where Patchlife receives unsubscribe requests, so that New South Wales public holidays apply? That is the researcher's reading, not ACMA guidance. Acting the same or the next business day avoids the question.
- S2. Does a free site plus a waitlist for a planned service count as "running a business" under ASIC's business name rule, or as "carrying on an enterprise" for an ABN? Not verified.
- S3. Is an email inviting a sign-up to a research call a commercial electronic message? Do the Telemarketing and Research Calls Industry Standard or Do Not Call Register rules apply to the M4 calls? Not researched. The draft treats call emails as commercial and gets express consent for them.
- S4. Are public posts in MSP communities "electronic messages" under s 5? Probably not, but this wasn't verified from an official source. Direct messages probably are.
- S5. Should Patchlife use double opt-in? The ACMA suggests considering it (Statement of Expectations). On Tally it needs a paid plan (gate), or a manual confirmation email from the owner.
- S6. The current dollar value of a Commonwealth penalty unit wasn't verified.
- S7. The register's "known future amendments" view for the Spam Act wasn't opened (step 21).
- S8. Treating a spoken request on a call as an unsubscribe (step 17) rests on s 4's definition of "message" and Schedule 2 clause 6(1)(g); it is a reading, not ACMA guidance.

**Australian privacy**
- P1. Who is the legal entity behind Patchlife (individual, company or trust), and does it, or (for a company) any related body corporate, carry on a business that has had annual turnover over $3 million? This decides whether APP 5 is mandatory (step 2).
- P2. APP 7 (direct marketing) does not apply to the extent the Spam Act applies (APP 7.8(b), sch1 link above; verified), so the Spam Act governs the waitlist emails. APP 7 may still matter for anything outside the Spam Act, such as the calls (S3).
- P3. Is Tally's role a "use" or an overseas "disclosure" under APP 8? Tally's DPA has some of the terms the OAIC lists, but Tally can amend it on its own (Art 21.2). Naming Tally and Europe in the notice satisfies APP 5 either way. If it is a disclosure and Patchlife is covered, APP 8.1 also requires reasonable steps to ensure Tally doesn't breach the APPs, and s 16C can make Patchlife accountable for Tally's acts, unless an exception applies. The likely route is APP 8.2(a): a reasonable belief that Tally is bound by a substantially similar law (EU GDPR in Belgium) with mechanisms individuals can use to enforce it. Otherwise, the OAIC generally expects an enforceable contract requiring the recipient to handle the information under the APPs (APP guidelines 8.16). Record which you rely on (sch1 and APP 8 guideline links above; verified). The same question applies to the mail provider (step 10).
- P4. Tranche 2: the exposure draft and consultation paper couldn't be read directly. The finding that the draft leaves the small business exemption alone rests on law firm summaries.
- P5. The s 6D, s 6DA and Schedule 1 text came from AustLII, not legislation.gov.au, which couldn't be reached here. The s 6D(9) wording was seen only through a secondary summary.
- P6. The breach duties in step 20 come from UK GDPR Art 33 and OAIC summaries of the Notifiable Data Breaches scheme (s 26WH), read through search results rather than the Act's text. Whether a particular waitlist breach is likely to cause serious harm, or a risk, is a judgment at the time.
- P7. The OAIC page treating an email address as personal information was read only through a search summary.

**UK**
- U1. Whether UK GDPR applies depends on your targeting decision (step 3).
- U2. Is a UK representative needed (Art 27)? The "occasional" exemption looks doubtful (step 4). Needs advice.
- U3. Does the ICO fee exemption for "advertising, marketing and public relations" of your own goods and services cover a waitlist-only controller? Would research calls, or correction emails from UK people, break it? The ICO extraterritorial fee page couldn't be read in full.
- U4. When Tally in Belgium makes UK sign-ups' answers available to the owner in Australia, is that a restricted transfer, who initiates it, and what safeguard is needed? Tally's SCCs are EU Module Four only, with no UK Addendum or IDTA. The same question applies to the mail provider. Not resolved (step 6).
- U5. Do PECR's email rules reach an Australian sender? Not verified. The draft complies anyway: consent, identity and an unsubscribe route.
- U6. Is a "launch" email the person asked for "solicited", and so outside PECR's consent rule? That is a reading of ICO guidance, not a confirmed ICO statement. Explicit consent avoids relying on it.
- U7. Does an email address satisfy s 164A's duty to make complaints easy? The provision mentions an electronic complaint form, and only a search summary was read.
- U8. UK GDPR Art 28 (the written processor contract) wasn't checked against Tally's DPA.
- U9. Several ICO pages (consent, PECR, business-to-business, transfers, layered notices, documentation) were read only as search summaries. The territorial scope PDF is internal ICO staff guidance released under freedom of information request IC-327905-Y2Y5 (disclosure log dated September 2024), not guidance published for organisations, and its content was seen only through search summaries. Law firm summaries say the ICO updated its international transfers guidance in 2026, so re-read the transfer pages before step 6.
- U10. EU GDPR for EU sign-ups wasn't researched. US CAN-SPAM and Canada's CASL were checked only for the postal address point (step 11), not for whether they reach an Australian sender.

**Tally**
- T1. Does the DPA bind an individual owner with no company or ABN? It is framed for "professional users ... on behalf of their company", and Tally's Terms couldn't be read.
- T2. Does "Empty trash" clear Tally's backups at once, or only within 90 days? The privacy page says "within 90 days", which is true either way.
- T3. Is the self email notifications toggle off by default on a new form? Check in the UI (step 15).
- T4. What else does Tally's form page store or load in the respondent's browser for Tally's own purposes? This covers its cookie notice and whether Sentry, Mixpanel or Plausible run on form pages. Not retrieved.
- T5. Closing a form by date is listed as free on Tally's pricing page (search summary only). Confirm in Settings.
- T6. The thresholds in Tally's "fair usage guidelines" weren't found. They're unlikely to matter for a small waitlist.
- T7. Tally's privacy policy (tally.so/privacy, dated 20/11/2023), terms, Insights, embed, export and API pages were read only as search summaries.
- T8. Exactly what Tally records about form visits and submissions (Insights figures, ID codes, and whether IP addresses are kept) was read only through help-page summaries. Check a test form's Submissions and Insights tabs before publishing (step 15).

**Other**
- O1. The `/business` page describes a service that may never be built. A statement about a future matter is taken to be misleading without reasonable grounds, and the maker is presumed to have none unless evidence is given (ACL s 4; see the notes under section 1; partly). The draft now ties each forecast to PLAN, says plainly that nothing is for sale, and says what happens either way. The rest of the ACL wasn't researched.
- O2. Gate A can't be fully measured without a price question (step 9).

### Suggested fixes to `docs/PLAN.md` (for a separate PR once the owner approves)
- **M4 Waitlist:** "Tally stores all form data in Europe on every plan, including the free one" goes beyond what Tally says. Quote it instead: "All Tally form data is encrypted both in transit and at rest, and stored in Europe" ([tally.so/help/gdpr](https://tally.so/help/gdpr)). Add that this holds only with notifications, uploads and payments off, and that the DPA lets Tally name sub-processors by category and transfer outside the EEA by exception.
- **H9b:**
  - change "Spam Act unsubscribe within 5 working days" to "within 5 business days (Spam Act Schedule 2 clause 6), for any message asking to stop";
  - add "consent wording and consent records";
  - add "sender identification in every email, and a postal address decision for US and Canadian sign-ups";
  - add "UK GDPR decision (targeting, UK representative, ICO fee, legal basis per purpose, record of processing)";
  - add "Privacy Act coverage and opt-in decision";
  - add "the mail provider and where the consent and do-not-email records are kept";
  - add "breach response, including regulator notification where required".
- **M4 Gates:** gate A needs either a price question written by the owner or a change before day 0 (step 9).

---

## Checker problems: what I did

I checked the Spam Act, Schedule 1, the APP 8 guidelines and the Tally DPA against the copies saved in `m4-prep/`. Everything else was checked through WebSearch summaries, because the Firecrawl credits ran out (D35 fallback) and direct fetches were blocked. Numbers follow the order of the PROBLEMS list. I made at least a partial fix for all 33 and rejected none outright. Partial rejections are marked.

**Fixed**
- **1 and 19, retention:** all four layers now give the same three dates. Step 8 offers a simpler single-date option.
- **2, ICO shoe example:** removed the misstatement from 3.2, step 6 and U4. *Partly rejected:* I didn't adopt the checker's replacement (a restricted transfer to an "Australian processor") because searches couldn't confirm it. Step 6 now states the ICO test and narrows the adviser question. The saved DPA confirms there is no UK Addendum or IDTA.
- **3, FOI PDF:** relabelled as internal staff guidance released under IC-327905-Y2Y5 (disclosure log, September 2024) and marked partly. Step 3 now rests on Art 3(2) and recital 23, since I couldn't find any published ICO targeting guidance. *Partly rejected:* I dropped the "cautious approach" and IP-address points rather than keeping them as partly, because no search found them.
- **4 and 26, legal basis:** consent covers the emails and legitimate interests covers counting interest. The right to object has its own paragraph in the form and its own bullet on the privacy page. Step 7 explains this and gives the consent alternative.
- **5 and 23, mail provider:** new step 10, new placeholders and notice text. Steps 6, 20, 25 and 26 and P3 are updated to match.
- **6 and 24, breaches:** covered DPA Art 5.5, UK GDPR Art 33(1) and (5), NDB s 26WH and notifying the OAIC, plus breaches outside Tally. P6 is rewritten.
- **7, name without an ABN:** the gap from ACMA guidance is now stated, with ABN entitlement from the ABR.
- **8 and 27, unsubscribing:** every layer now treats any message to that effect as an unsubscribe (s 18(9), Sch 2 cl 6(1)(d)). The point about calls and letters is labelled as my reading (S8).
- **9 and 25, record of processing (Art 30):** added to step 16. *Partly rejected:* I didn't add the ICO template, which I didn't check.
- **10 and 30:** "burden of proving" replaced with an evidential burden, citing s 16(5) and the s 4 definition.
- **11, penalty citations:** corrected to s 16(11), 17(7) and 18(8), and added s 24, 26, 30 with Schedule 3, 32 and 38.
- **12, s 6D:** "for good" removed and the "carries on" wording confirmed. *Partly:* s 6D(9) now applies only to companies, but it is marked partly because I couldn't read its text.
- **13:** P2 now cites APP 7.8(b).
- **14:** P3 now covers APP 8.1, s 16C, APP 8.2(a) and guidelines 8.16.
- **15, mailto:** the unsourced consent claim is gone. The record point stays.
- **16, IDs:** Respondent and Submission IDs are now in the notices. *Rejected in part:* "Tally doesn't collect IP addresses" couldn't be confirmed. Instead, step 15 turns off duplicate prevention (which can key on IP address) and T8 asks for a test-form check.
- **17, "only Google Cloud":** step 15, the form and the business page now attribute this to Tally (DPA Art 9.2 and 14.1).
- **18, Insights:** "only" removed, and the visit totals Tally records are now disclosed. The "Tally's website" bullet is reworded.
- **20, call emails:** added to every layer. `[N]` now excludes emails arranging a call, replies and breach notices.
- **21, forecasts:** the wording now matches PLAN (extend once, shelve, re-test). ACL s 4 is cited as partly.
- **22, feature wording:** fixed for supplier checks, fleet matching and change history. I also applied it to the Alerts line and the form's feature options.
- **28:** the privacy page's opening sentence and meta description no longer make an absolute promise.
- **29, postal address:** new step 11. *Partly:* the FTC's post office box option refers to US Postal Service boxes, so whether an Australian box counts is unconfirmed, and I didn't read the CASL regulation's paragraph itself.
- **31:** now says "Anyone with a free GitHub account", checked against `correctionsPage`.
- **32:** the Tally privacy link is now https://tally.so/privacy.
- **33:** step 19 now has the one-month deadline for rights requests (Art 12(3) and 12A), marked partly.

**Also fixed, not raised by the checkers:** the draft said "PLAN aims at AU and UK buyers", but PLAN doesn't say that. Step 3 now cites BRIEF and SPEC 5 instead.