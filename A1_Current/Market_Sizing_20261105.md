# U Use market boundary and calculations

Source checked: 5 November 2026. Units distinguish students, requests and completed transactions. The observation window for the serviceable-demand illustration and pilot is four weeks.

## Official population base

XJTLU's [English overview](https://www.xjtlu.edu.cn/en/about/overview) and [Chinese overview](https://www.xjtlu.edu.cn/zh/about/overview) both publish **26,000+ students**, with a **May 2026** update date. The pages also state that statistical definitions and reporting periods vary by departmental practice.

This is the university's reported institution-wide population, not a verified current XEC-only population, a campus split, local reach, registrations or paying customers. For reproducible arithmetic use the fixed reference **N = 26,000**, while retaining the plus sign when displaying the official figure. This reference is not an exact enrolment count or a claim that 26,000 is the maximum possible population.

## Serviceable-demand formula

**SAM(4 weeks) = N × c × d**

- **N:** published university population reference, 26,000 students.
- **c:** share physically able to use an SIP/XEC handoff in the observation window. This removes people outside the local service boundary.
- **d:** conditional share of those locally serviceable students with an unmet planned item need during the same four weeks, after considering familiar peers and existing services.

The demand definition covers relevant student requesters. It does not count every student as a buyer or assume that every idle item has a willing owner. Staff, visitors and people unable to make a feasible campus handoff are outside this student-service model. Supply, willingness to register/pay and operating capacity constrain fulfilment separately.

**Illustrative planning case:** c = 80%; d = 1%.

**26,000 × 0.80 × 0.01 = 208 potentially serviceable students in four weeks.**

The two percentages are explicit scenario inputs chosen for planning. They are **not** findings from the 15 qualitative summaries, an official campus-share estimate, measured adoption or a demand forecast. No quantitative demand prevalence has been established. The numerical example becomes an evidence-based estimate only when the inputs are replaced with suitable observations.

| Unmet-need share d, with c held at 80% | Calculation | Scenario output |
| --- | --- | --- |
| 0.5% | 26,000 × 0.80 × 0.005 | 104 students / four weeks |
| 1% | 26,000 × 0.80 × 0.01 | 208 students / four weeks |
| 2% | 26,000 × 0.80 × 0.02 | 416 students / four weeks |

These sensitivity cases expose uncertainty; they do not establish growth or prove that this many students will use U Use.

## Initial channel and obtainable pilot activity

The team's initial channel is **eight DTS classes, approximately 430 students**. This is Rita's cohort estimate and a starting outreach boundary, not a figure supplied by the university overview. Later outreach across SIP/XEC is planned.

The retained four-week pilot assumptions are:

- I = 80 invitations, within the approximately 430-person starting channel.
- r = 10% posting, modelled as one request per responding invitee for this illustration.
- f = 25% completion of those requests.
- O = 4 willing owners, with K = 2 uses each in the four-week window.

**Requests = I × r = 80 × 10% = 8.**

**Completed requests = min(I × r × f, O × K) = min(80 × 10% × 25%, 4 × 2) = 2.**

The owner capacity is eight possible uses in the scenario, but expected fulfilment is two. Invitations, requests, willing owners and completions are planning inputs/outputs, not achieved recruitment or transactions. The two completions are a transaction count, not two students or the university's market size. Eligibility and compatible supply must also hold; the formula is a simplified bounded pilot case, not a guarantee of matches.

## Financial boundary

The official population and 208-person illustration are not directly multiplied by a rental price or platform fee. Pilot GMV remains **2 completions × 50% paid × CNY20 = CNY20**, platform fee revenue **CNY0**, cash budget **CNY180**, and cash result **−CNY180**.

The later cash break-even threshold remains **334 completed transactions/month** under its separate 5% fee scenario. This is a conditional cost calculation, not a prediction that the population base or serviceable-demand scenario can produce that activity. Team time, tax and unpriced losses are outside that threshold.

## Supporting records

- [Claim-evidence map](Claims_and_Evidence.csv)
- [Team-provided qualitative interview summaries](Research_Summaries.md), V001–V015; not a representative survey.
- [Evidence Hub index](../Evidence_Hub/A1_Evidence_Index.md)
- [Original pilot workbook](UUse_A1_Market_Options_Evidence.xlsx), retained with its original model inputs. Its historical 430/SAM label concerns the earlier cohort model; this document and the current slides define the revised university-level scenario separately.

The source URLs, update/access dates, formula definitions, assumptions, time window and units are also recorded in slide 2's notes.
