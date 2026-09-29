# ENT303TC U Use 项目交付包

项目名称：U Use｜西浦学生物品使用平台

项目定位：面向 XJTLU 学生的物品使用平台。学生可以通过学生邮箱认证，在 SIP 与太仓两个校区之间买断、借用、短租或交换物品。

课程依据：ENT303TC module handbook（A1/A2/A3/A4 结构与 weekly checkpoint）+ 教学团队每周邮件。**Handbook 和邮件是课程要求，本目录所有文件都要服从它们。**

## 三个最重要的入口

0. **`TEAM_ROSTER_AND_DATA_POLICY.md`** —— 组员姓名统一写法 + 哪些数据可以 demo、哪些必须真实收集。
1. **`26_必须提交清单.md`** —— 必须交什么、什么时候交、要留什么证据。
2. **`28_组员操作手册.md`** —— 每个人照着做的详细步骤（含卡住了找谁）。
3. **`29_邮件要点与本周动作.md`** —— 教学团队 Week 3 邮件逐条拆解 + 我们对应的文件状态。
4. **`Evidence_Hub/README_Evidence_Hub.md`** —— supervisor 会直接看的地方，包含目录结构、命名规范和权限设置步骤。
5. **`24_Week3分工与任务分配.md`** —— 本周任务拆解与分工依据。

## 目录分工（很重要，别混）

```text
ENT303TC/
├── 00_README_先看这个.md        ← 本文件
├── 26_必须提交清单.md
├── 24_Week3分工与任务分配.md
├── 13_课程交付矩阵_按Handbook对齐.md
├── 01_每周推进计划_ENT303TC匹配版.md
├── 11_提交节点与日期日历.md
├── 03_-23_*.md / *.csv          ← 工作稿与模板（不是提交版本）
├── PRD_V0.5_UUse物品使用平台版.md
├── xjtlu-market-app/            ← Next.js 可点击原型
└── Evidence_Hub/                ← supervisor 看的正式材料（需上传到在线共享位置）
```

规则：**正式交付物只放 `Evidence_Hub/`**，带版本命名（`W3_Market_Sizing_v1`），每个数字旁写来源和证据 ID。根目录的 `03_`-`23_` 是工作稿和索引，不能替代 Evidence Hub 里的版本。

## 推荐阅读顺序

1. `29_邮件要点与本周动作.md`（想知道老师到底要什么，先看这个）
2. `26_必须提交清单.md`
3. `24_Week3分工与任务分配.md`
4. `Evidence_Hub/README_Evidence_Hub.md`
5. `13_课程交付矩阵_按Handbook对齐.md`
6. `PRD_V0.5_UUse物品使用平台版.md`
7. `14_迭代日志_Pivot记录.md`
8. `02_A1_六页PitchDeck_可直接改.md`
9. `09_A2_3到6分钟PitchVideo脚本.md`

## Week 3 关键文件（本周重点）

| 文件 | 用途 |
|---|---|
| `Evidence_Hub/Week_3/W3_Market_Sizing_Workbook_v1.xlsx` | **可填数自动出结果的 workbook**（汤鋆秋 主责，只改橙色格） |
| `Evidence_Hub/Week_3/W3_Market_Sizing_v1.md` | TAM/SAM/SOM，公式可见、单位统一、来源可追溯 |
| `Evidence_Hub/Week_3/W3_Competitor_Table_v1.xlsx` | **竞品主文件**（4 页签：填写说明/竞品总表/截图清单/Session 话术），6 个点名在运营竞品 |
| `Evidence_Hub/Week_3/W3_Competitor_Table_v1.csv` | 竞品表 CSV 版，同上内容 |
| `Evidence_Hub/Week_3/W3_A1_Slide3_文案_v1.md` | A1 第 3 页可直接粘贴的成品文案（市场+竞品+USP+口头版） |
| `Evidence_Hub/Week_3/W3_USP_Hypothesis_v1.md` | 课程句式的可测试 USP |
| `Evidence_Hub/Week_3/W3_Evidence_Sources.csv` | 证据 ID（E01 起）登记表 |
| `Evidence_Hub/01_Weekly_Log/Weekly_Log_纯文本_可直接粘贴.txt` | **Weekly Log 纯文本版（Week 1/2/3 三节全填好），整段复制进在线文档即可** |
| `Evidence_Hub/01_Weekly_Log/Weekly_Log_UUse.md` | Weekly Log 的 md 版（内容相同） |
| `Evidence_Hub/00_Team_Admin/05_AI使用声明_可直接粘贴.txt` | **AI 使用声明成品，直接粘贴** |
| `Evidence_Hub/00_Team_Admin/03_分工表.md` | 分工与贡献记录 |
| `Evidence_Hub/Week_5/W05_访谈执行包_v1.md` | **访谈成品包**：同意话术 + 提问卡 + U01/U02 记录表（黄俊杰 照着做） |
| `Evidence_Hub/Week_5/W05_问卷成品_v1.md` | 问卷终版，逐题带选项，可直接导入问卷星/腾讯问卷（黄俊杰） |
| `Evidence_Hub/Week_5/W05_UserInterview_U01_模板.md` | 访谈记录模板（备用） |

## Week 4-14 每周成品文件（本周之后的路线）

每一周都有一份"照做就行"的成品文件，放在 Evidence Hub 对应的 Week 文件夹里：

| 周 | 文件 | 本周只做这件事 |
|---|---|---|
| Week 4 | `Week_4/W4_Research_Design_v1.md` | 研究问题 / 方法 / consent 与数据计划 / 试跑访谈 |
| Week 5 | `Week_5/W05_Primary_Data_Collection_v1.md` | 3-5 次用户互动（3 访谈 + 2 原型测试）+ 存原始证据 + 中间小结 |
| Week 6 | `Week_6/W6_Insight_Synthesis_v1.md` | ≥3 条洞察 + persona/journey + pivot/persevere 决策 |
| Week 7 | `Week_7/W7_Ideation_与_Storyboard_v1.md` | 三方案加权比较 + 六页 storyboard |
| Week 8 | `Week_8/W8_BMC_与_A1提交_v1.md` | BMC + claim-evidence map + **A1 提交（11-06 23:59）** |
| Week 9 | `Week_9/W9_原型测试与迭代_v1.md` | ≥3 人原型测试 + 迭代日志 + A1 反馈自查 |
| Week 10 | `Week_10/W10_Semester1_CloseOut_v1.md` | 13 项归档 + A2 目标 + 导师签核 |
| Week 11-14 | `Week_11-14/W11-14_A2_构建与视频_v1.md` | 构建 + 分镜 + **A2 提交（12-18）** |
| Semester 2 | `Semester_2/S2_A3_A4_计划_v1.md` | A3（03-21 + 现场）与 A4 个人报告（04-16） |
| 每周 | `01_Weekly_Log/Weekly_Log_Week4-14_骨架_可直接粘贴.txt` | 黄禹轩 每周填空即可 |

## 课程证据文件（工作稿）

- 假设与证据：`03_假设与证据登记表.csv`
- 用户访谈：`04_用户访谈提纲.md`、问卷：`05_问卷题目草稿.md`
- 竞品：`06_竞品分析表.csv`、`15_竞品与替代方案深度分析.md`
- 商业模型：`07_Business_Model_Canvas.md`
- 用户画像与旅程：`08_用户画像与用户旅程.md`
- 证据清单：`10_证据收集清单.md`
- 差异化策略：`12_差异化策略_UUse物品使用平台版.md`
- Claim-Evidence Map：`16_Claim_Evidence_Map.md`
- 研究设计：`19_研究设计与数据计划.md`
- 三方案比较：`21_三方案加权比较矩阵.md`
- A2 路线图：`23_A2路线图与构建目标.md`
- 已被取代的文件：`Evidence_Hub/Archive/`

## 原型运行

```bash
cd xjtlu-market-app
npm install
npm run dev
```

学生端：`http://localhost:3000`　管理端：`http://localhost:3000/admin`

原型限制（要主动向 supervisor 说明）：本地 JSON 数据、无真实服务器、无真实支付、无真实邮箱验证。

最终展示统一使用 U Use 版本，避免讲回收、课程任务包或普通二手交易，防止和其他小组重复。
