# U Use market boundary and calculations

Source checked: 5 November 2026. Units distinguish students, requests and completed transactions. The observation window for the serviceable-demand illustration and pilot is four weeks.

## Official population base

XJTLU's [English overview](https://www.xjtlu.edu.cn/en/about/overview) and [Chinese overview](https://www.xjtlu.edu.cn/zh/about/overview) both publish **26,000+ students**, with a **May 2026** update date. The pages also state that statistical definitions and reporting periods vary by departmental practice.

This is the university's reported institution-wide population, not a verified current XEC-only population, a campus split, local reach, registrations or paying customers. For reproducible arithmetic use the fixed reference **N = 26,000**, while retaining the plus sign when displaying the official figure. This reference is not an exact enrolment count or a claim that 26,000 is the maximum possible population.

## Low-use serviceable-demand scenarios

**SAM(4 weeks) = N × c × d**

- **N:** the published university population reference, 26,000 students.
- **c:** share physically eligible for a feasible SIP/XEC handoff in the four-week window.
- **d:** conditional share of those eligible students with a planned item need that familiar peers or existing channels cannot meet in that same window.

Use **c = 50%** as a planning input, not an official campus-share statistic. Explore **d = 0.1%, 0.25%, 0.5%** as alternative low-use assumptions. The model excludes staff, visitors and people unable to make a feasible campus handoff. Relevant supply, willingness to register/pay, travel and operating capacity constrain fulfilment separately.

| Four-week unmet-need assumption d | Calculation | Scenario output |
| --- | --- | --- |
| 0.1% | 26,000 × 0.50 × 0.001 | 13 people |
| 0.25% | 26,000 × 0.50 × 0.0025 | 32.5, approximately 33 people |
| 0.5% | 26,000 × 0.50 × 0.005 | 65 people |

The **13–65** span is a set of chosen planning cases. It is **not** a confidence interval, observed lower/upper bound, verified market estimate or adoption forecast. The arithmetic is reproducible; the demand inputs remain assumptions. Lowering them does not make them measured evidence. Neither the 15 qualitative summaries nor the approximate 78-person participation account provides a representative denominator for these rates.

The population definition, time window, local eligibility and unmet need are explicit so that observed evidence can later replace the scenario inputs. No campus-wide revenue or growth claim follows from the official headcount.

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

## Financial boundary and cost-recovery strategy

The official population and the 13–65-person sensitivity cases are not directly multiplied by a rental price or platform fee. Pilot GMV remains **2 completions × 50% paid × CNY20 = CNY20**, platform fee revenue **CNY0**, cash budget **CNY180**, and cash result **−CNY180**.

Live transactions have not opened according to Rita. The strategy is a free transaction pilot, then evidence of cost recovery before a profit objective. The amounts above are prospective budgets and scenario outputs, not actual trades, income, spending or profit. No historical profit is inferred without cash records.

The later cash break-even threshold remains **334 completed transactions/month** under its separate 5% fee scenario. This is a conditional cost calculation, not a prediction that the population base or serviceable-demand scenario can produce that activity. Team time, tax and unpriced losses are outside that threshold.

## Supporting records

- [Claim-evidence map](Claims_and_Evidence.csv)
- [Team-provided qualitative interview summaries](Research_Summaries.md), V001–V015; not a representative survey.
- [Evidence Hub index](../Evidence_Hub/A1_Evidence_Index.md)
- [Original pilot workbook](UUse_A1_Market_Options_Evidence.xlsx), retained with its original model inputs. Its historical 430/SAM label concerns the earlier cohort model; this document and the current slides define the revised university-level scenario separately.

The source URLs, update/access dates, formula definitions, assumptions, time window and units are also recorded in slide 2's notes.
