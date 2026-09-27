# A1 六页 Pitch Deck：U Use

交付要求（来自 handbook 与课程邮件）：

- Assessment 1：Group 6-page Pitch Deck，**正好 6 页，不放 appendix**，占 20%。
- 截止：**2026-11-06（Fri）23:59，通过 LMO 提交**。
- 课程 CW link：Week 3 的市场与竞品分析对应 **Slide 2-3**；Week 6 的洞察对应 **Slide 2-4**；Week 7 的方案比较对应 **Slide 3-4**；Week 8 的 BMC + claim-evidence map 补 **Slide 5-6**。
- 每个 claim 都要能指到证据 ID（见 `Evidence_Hub/Week_3/W3_Evidence_Sources.csv`）。

## 版面结构（v1，已按课程 CW link 调整）

| 页 | 内容 | 对应课程要求 | 证据 |
|---|---|---|---|
| 1 | Title + 一句话定位 | — | — |
| 2 | Problem（可证伪的问题陈述） | Week 2 | E02/E03 |
| 3 | Market & Competitor + USP | **Week 3** | E01/E02/E10-E15 |
| 4 | Solution & Prototype | Week 6-7 | E05/E06 |
| 5 | Business Model & Feasibility | Week 8 | — |
| 6 | Validation & Next Steps | Week 8 | E02/E07 |

> **相比旧版改了什么：** 旧版 Slide 3 是 Solution、Slide 5 是 Differentiation，导致市场与竞品内容没有独立页，BMC 完全没有出现。现按 handbook 的 CW link 调整为上表结构。

---

## Slide 1 - Title

U Use｜西浦学生物品使用平台

一句话：让西浦学生安全地买、借、短租或交换暂时需要的物品。

副标题（口头说明用）：XJTLU verified item-access platform for SIP and Taicang campuses.

## Slide 2 - Problem

标题：Students need things for days, not forever.

可证伪的问题陈述（建议原样放上）：

> XJTLU students often need an item for a short period but do not want to buy it, and existing channels (WeChat groups, second-hand platforms, borrowing from friends) cannot simultaneously solve identity trust, availability, deposit, return responsibility and dual-campus handoff.

典型场景：

- 考试周临时需要计算器。
- 答辩或面试需要正装。
- 短途出行需要行李箱。
- 社团活动需要投影仪或设备。
- 太仓通勤临时需要自行车。

现有方式的缺口：

- 买新的成本高，用完闲置。
- 微信群信息刷屏，搜索困难，规则靠私聊。
- 闲鱼身份复杂，以买卖为主，不适合 1-7 天使用。
- 借东西靠人情，归还、损坏和押金说不清。

证据：问卷 Q3/Q4（E02）、访谈 U01-U0x（E03）。

## Slide 3 - Market & Competitor + USP

标题：A narrow, testable beachhead: verified XJTLU students.

市场（只讲结论，公式写在 evidence 文件里，数字全部来自 `W3_Market_Sizing_Workbook_v1.xlsx`）：

- TAM：全国高校在校生约 4,763 万人 × 需求比例 × 年均使用次数 × 单次金额 = **约 25.0 亿元/年**（仅作上限参考，来源 E08）。
- SAM：XJTLU 在校学生 26,000 人 × 50% × 3 次/年 × 35 元/次 = **136.5 万元/年**（来源：XJTLU 官网 About/Overview，E01）。
- SOM（Year-1）：校内 5 条渠道去重后可触达 2,150 人，按三情景给出：

| Year-1 情景 | 可触达（人） | 触达→注册 | 注册→首单 | 成交单数（单/年） | 成交额 GMV（元/年） |
|---|---:|---:|---:|---:|---:|
| 保守 | 1,290 | 15% | 10% | 29 | 1,016 |
| 基准 | 2,150 | 20% | 15% | 129 | 4,515 |
| 乐观 | 2,795 | 30% | 25% | 629 | 22,011 |

- 口径说明：首年不收费，所以 SOM 用**成交额（GMV）**表述，平台收入按 0% 服务费计为 0 元/年（只做敏感性展示）。
- 一句话结论：首年可验证的量很小，我们讲的是**可触达、可验证**，不是市场规模本身。

竞品对比表（6 个真实在运营的竞品/替代方案，来源见 E10-E15，完整版 `W3_Competitor_Table_v1.xlsx`）：

| 方案 | 类型 | 解决什么 | 缺口 |
|---|---|---|---|
| 闲鱼 goofish.com（C01） | 直接竞品 | 全网二手买卖 | 交付、押金、归还靠私聊；不解决 1-7 天短期使用 |
| XJTLU 学生微信二手/拼单群（C02） | 替代方案 | 快速发布信息 | 无搜索、无规则、损坏责任说不清；跨校区信息混乱 |
| 人人租 rrzuji.com（C03） | 间接竞品 | 信用免押全品类租赁 | 面向社会用户、品类偏高值设备、无校园交付点、短租单价高 |
| 爱回收 aihuishou.com（C04） | 替代方案 | 闲置回收与处置 | 解决「处理掉」，不解决「短期用到」；无押金与借还场景 |
| 转转 zhuanzhuan.com（C05） | 直接竞品 | 二手交易，主打官方验 | 以买卖为主；交付、押金、归还没有规则 |
| 线下向同学借用（C06） | 非商业替代 | 熟人之间直接借用 | 可借范围极小；多次借用有心理负担；损坏时更难开口 |
| **U Use** | — | **物品使用权流转** | 押金、可用时间、归还确认、双校区公共交付点 |

USP（课程句式，来自 `W3_USP_Hypothesis_v1.md`）：

> For XJTLU students who currently buy things they only need for a few days, or post a message in WeChat groups and hope someone replies, U Use is a verified campus item-access platform that lets them buy, borrow, rent or swap a specific item for a chosen time window, with deposit, return confirmation and a public handoff point, unlike Xianyu, which is built for second-hand trading and leaves delivery, deposit and return arrangements to private chat.

## Slide 4 - Solution & Prototype

标题：From owning to using.

U Use 把「临时使用物品」变成结构化流程：

- 找到附近可用物品，按校区、分类、使用方式筛选。
- 查看可用日期、押金、租金、归还规则。
- 选择买断、借用、短租或交换。
- 公共交付点完成借出与归还，双方确认状态。

Demo 展示顺序（现场演示或截图）：

1. 学生端首页：搜索「计算器」+ 筛选「可借」。
2. 物品详情：可用时间、押金、归还规则、借还协议。
3. 借还预约：交付地点、借出时间、归还说明。
4. 管理端：认证、审核、举报、押金争议。

Demo 话术：

> 我周五考试需要计算器。搜索「计算器」，筛选「可借」，看到可借 7 天、押金 50 元、交付点在图书馆门口。预约后双方在借出前确认状态，归还时再次确认。

原型说明（主动讲清限制，避免被追问）：本地 JSON 数据、无真实支付、无真实邮箱验证。

## Slide 5 - Business Model & Feasibility

标题：Who pays, and what it takes to run.

9-block BMC 摘要（完整版见 `07_Business_Model_Canvas.md`）：

| 模块 | 内容 |
|---|---|
| Customer Segments | SIP / 太仓学生；有闲置且愿意借出的学生；后续扩展到社团与学院活动方 |
| Value Propositions | 不用买下低频物品；认证降低风险；押金与归还规则清楚；双校区公共交付点 |
| Channels | 微信 H5；课程群、社团群、宿舍群；考试周/毕业季/活动季推广；海报二维码 |
| Customer Relationships | 自助发现与预约；管理端审核与举报；借出前与归还后状态确认 |
| Revenue Streams | 课程阶段不盈利；长期：短租服务费、押金托管服务费、社团设备专区、推广位 |
| Key Resources | 认证机制、物品与可用时间数据、借还协议、公共交付点、争议处理 |
| Key Activities | 用户调研、发布审核、种子物品库、借还流程维护、争议处理 |
| Key Partners | 学生社团、宿舍社区、学院活动方、校园服务部门 |
| Cost Structure | 服务器与数据库、域名部署、邮箱验证、地图服务、客服与争议处理、推广物料 |

可行性要主动说明：

- 技术：原型已完成可点击版本，真实运营需数据库、认证、支付/押金托管、消息通知。
- 供给：冷启动依赖种子物品库（计算器、正装、行李箱等低风险品类）。
- 合规与风险：押金争议、归还异常、物品损坏责任的界定规则。

## Slide 6 - Validation & Next Steps

标题：What we have proved, and what we test next.

已完成的验证：

- 竞品与替代方案已完成结构化对比（来源见 E10-E15）。
- 市场测算框架已按可追溯来源建立（E01）。

待验证假设（对应 `03_假设与证据登记表.csv`）：

| 假设 | 验证方式 | 通过标准 |
|---|---|---|
| H01 存在短期使用需求 | 问卷 Q3 + 访谈 | ≥60% 过去一学期有此场景 |
| H02 愿意借/短租而非买断 | 问卷 Q5 | >50% 选择借用或短租 |
| H03 可接受押金 | 问卷 Q8 | >60% 接受合理押金 |
| H04 品类集中在 5 类 | 问卷 Q4 排序 | ≥3 类高频 |
| H05 邮箱认证提升信任 | 原型测试 + Q7 | >70% 认为更可信 |
| H06 双校区需要公共交付点 | 访谈 + Q10/Q11 | 多数提到校车点或公共点 |
| H07 用户能说出差异 | 原型测试 + Q12 | 5 人中 ≥4 人 |

下一步时间线：

- Week 4：研究设计与数据计划（`19_研究设计与数据计划.md`）。
- Week 5：完成 3-5 次用户互动/测试，保存匿名原始证据。
- Week 6：聚类成 ≥3 个洞察，更新 persona 与 pivot 决策。
- Week 7：三方案加权比较 + A1 storyboard 定稿。
- Week 8：BMC + claim-evidence map 定稿，LMO 提交。

---

## 提交前自查

- [ ] 正好 6 页，没有 appendix。
- [ ] 每个 claim 都能指到证据 ID。
- [ ] 市场数字与 `W3_Market_Sizing_v1.md` 一致（supervisor 会重算）。
- [ ] 竞品至少 3 个是点名的、在运营的，且有来源。
- [ ] 已区分「已验证」与「假设」，没有把假设写成事实。
- [ ] 保存 LMO 提交截图到 `Evidence_Hub/Week_8/`。
