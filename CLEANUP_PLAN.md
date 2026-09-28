# Cleanup Plan

This repo is not broken, but it mixes product files, course evidence, drafts, and archive material in one root folder. The safest cleanup is staged: document first, move later, delete almost never.

## Keep As-Is

These are active and should stay visible:

- `README.md`: GitHub/product overview.
- `ARCHITECTURE.md`: product and repo architecture.
- `PRD_V0.5_UUse物品使用平台版.md`: current product requirements. Rename to V0.6 later if the team wants.
- `xjtlu-market-app/`: active MVP code.
- `Evidence_Hub/`: formal course evidence.
- `00_README_先看这个.md`: course-facing entry point.
- `26_必须提交清单.md`: assessment checklist.
- `13_课程交付矩阵_按Handbook对齐.md`: course mapping.

## Probably Redundant At Root

These root files have newer or more formal versions in `Evidence_Hub/`. They are not useless, but they should be treated as working drafts.

| Root file | Use instead |
|---|---|
| `04_用户访谈提纲.md` | `Evidence_Hub/Week_5/W05_访谈执行包_v1.md` |
| `05_问卷题目草稿.md` | `Evidence_Hub/Week_5/W05_问卷成品_v1.md` |
| `06_竞品分析表.csv` | `Evidence_Hub/Week_3/W3_Competitor_Table_v1.csv` |
| `18_TAM_SAM_SOM估算模板.md` | `Evidence_Hub/Week_3/W3_Market_Sizing_v1.md` and `.xlsx` |
| `19_研究设计与数据计划.md` | `Evidence_Hub/Week_4/W4_Research_Design_v1.md` |
| `20_初步洞察汇总模板.md` | `Evidence_Hub/Week_6/W6_Insight_Synthesis_v1.md` |
| `21_三方案加权比较矩阵.md` | `Evidence_Hub/Week_7/W7_Ideation_与_Storyboard_v1.md` |
| `23_A2路线图与构建目标.md` | `Evidence_Hub/Week_11-14/W11-14_A2_构建与视频_v1.md` |

Recommendation: keep them for now, but later move to `docs/working/` after A1.

## Archive Already Exists

`Evidence_Hub/Archive/` contains old PRDs and legacy directions. Keep it because it shows iteration history, but do not use these as the active product direction.

Large archived files:

- `Evidence_Hub/Archive/校园版闲鱼_PRD_初稿.md`
- `Evidence_Hub/Archive/现有_PRD_V0.2.md`
- `Evidence_Hub/Archive/PRD_V0.4_交易效率差异化版.md`
- `Evidence_Hub/Archive/PRD_V0.4_课程截止时间任务包差异化版.md`

Recommendation: keep through A1/A4 because reflection may need pivot evidence.

## Candidate Future Structure

Do this after the team is comfortable with the current GitHub repo:

```text
U-Use/
├── README.md
├── ARCHITECTURE.md
├── CLEANUP_PLAN.md
├── product/
│   └── PRD_V0.6_UUse.md
├── app/
│   └── xjtlu-market-app/
├── course/
│   ├── Evidence_Hub/
│   └── working/
└── archive/
```

Do not reorganize immediately before a supervisor session, because changing paths may confuse teammates.

## What Not To Push Publicly

Keep the GitHub repository private if it contains:

- Interview notes.
- Survey exports with identifiable metadata.
- WeChat group screenshots.
- Student names, IDs, emails, phone numbers, or dorm information.
- Supervisor comments not intended for public release.

The current `.gitignore` already excludes common build and environment files, but human review is still needed before adding screenshots or raw evidence.

## Practical Rule For The Team

When someone asks "where should this go?":

- Product code -> `xjtlu-market-app/`
- Product strategy -> `PRD...` or future `product/`
- Formal evidence -> `Evidence_Hub/Week_x/`
- Weekly notes -> `Evidence_Hub/01_Weekly_Log/`
- Drafts/templates -> root for now, future `docs/working/`
- Old directions -> `Evidence_Hub/Archive/`
