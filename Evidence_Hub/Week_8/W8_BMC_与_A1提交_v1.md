# W8 Business Model & A1 提交 v1（成品）

主责：郭宇璇（Rita）（deck 定稿与提交）＋ 毛相宜（文案）＋ 黄禹轩（claim-evidence map 与回执）＋ 汪睿（现场讲）
版本：v1（2026-09-22）　｜　参考日期：**Week 8 = 2026-11-02 至 11-08**

课程要求（handbook Week 8）：finalise value proposition and 9-block BMC；complete claim-evidence map；submit final 6-slide deck via LMO；verify both submission receipts。
**A1 硬截止：2026-11-06（周五）23:59，通过 LMO 提交，占 20%。**

---

## 1. Value Proposition（定稿版，一句话）

> 给不想为几天使用而买下物品的西浦学生：U Use 是学生邮箱认证的校内物品使用平台，按自选时间段买断 / 借用 / 短租 / 交换，并把押金、可用时间、归还确认和双校区公共交付点做成流程。

检查三条：① 谁（西浦学生）② 什么痛（几天要用但不想买）③ 凭什么不同（时间窗 + 押金 + 归还确认 + 交付点）。缺任何一条都要重写。

## 2. 九宫格 BMC（定稿，完整版见 `07_Business_Model_Canvas.md`）

| 模块 | 内容 |
|---|---|
| Customer Segments | SIP / 太仓学生（需求方）；有闲置物品且愿意借出的学生（供给方）；后续扩展到社团与学院活动方 |
| Value Propositions | 不用买下低频物品；认证降低风险；押金与归还规则清楚；双校区公共交付点 |
| Channels | 微信 H5；课程群 / 社团群 / 宿舍群 / 二手群；考试周、毕业季、活动季推广；海报二维码 |
| Customer Relationships | 自助发现与预约；管理端审核与举报；借出前与归还后状态确认；押金争议介入 |
| Revenue Streams | 课程阶段不收费（服务费率 0%）；长期：短租服务费、押金托管服务费、社团设备专区、推广位 |
| Key Resources | 认证机制、物品与可用时间数据、借还协议、公共交付点、争议处理规则 |
| Key Activities | 用户调研、发布审核、种子物品库维护、借还流程运营、争议处理 |
| Key Partners | 学生社团、宿舍社区、学院活动方、校园服务部门 |
| Cost Structure | 服务器与数据库、域名部署、邮箱验证、地图服务、客服与争议处理、推广物料 |

导师会检查 **BMC 的内部一致性**：Channels 能不能触达 Segments；Cost Structure 和 Key Activities 对不对得上；Revenue Streams 有没有和 Value Proposition 矛盾。

## 3. Claim-Evidence Map（成品，完整版见 `16_Claim_Evidence_Map.md`）

规则：**deck 上出现的每个 claim 都必须有一个证据 ID。** 现在 10 条 claim 全部有归属，A1 前要把「仍需补充」一栏里的空白填掉或改写措辞。

| Claim | 证据 ID | A1 前必须处理的事 |
|---|---|---|
| 学生存在短期物品使用需求 | E02/E03 | 用问卷 Q3 比例 + 访谈原话替换「场景假设」 |
| 普通二手平台不能解决借还 | E10 | 补上竞品截图 |
| 微信群信息流混乱、规则弱 | E11/E15 | 补访谈原话 |
| 学生邮箱认证能提高信任 | E02/E06 | 用问卷 Q7 |
| 押金和状态确认能降低顾虑 | E02/E03 | 用问卷 Q8/Q9 |
| 双校区需要公共交付点 | E02/E03 | 用问卷 Q10/Q11 |
| XJTLU 市场基数 26,000 人 | E01 | 已记录访问日期 |
| SOM 首年可达 | E07 | 已用真实渠道数据更新为 v2 |
| U Use 与回收项目不重复 | E13 | 用户能否说出区别（问卷 Q12） |
| MVP 可先用 H5 / Web 验证 | E05 | 原型已本地跑通 |

## 4. A1 提交清单（一条一条打勾，缺一条不发）

- [ ] deck **正好 6 页**，无 appendix（Slide 1 Title / 2 Problem / 3 Market+Competitor+USP / 4 Solution+Prototype / 5 BMC+Feasibility / 6 Validation+Next Steps）
- [ ] 每页的关键 claim 都能指到证据 ID
- [ ] Slide 3 的数字与 `W3_Market_Sizing_v2.md` **完全一致**（含三情景）
- [ ] Slide 3 点名的竞品在 `W3_Competitor_Table_v1.xlsx` 里能找到
- [ ] 字体、字号、页脚格式统一；没有溢出、没有拼写错误
- [ ] 全组一起看过一遍（pack reviewed as a team）
- [ ] 文件命名规范：`ENT303TC_GroupXX_A1_PitchDeck_v1.pdf`
- [ ] **11-06 23:59 之前**通过 LMO 提交
- [ ] 提交后保存**两个回执**（LMO 确认页截图 + 邮件回执），存 `Evidence_Hub/Week_8/`
- [ ] 把提交时间、文件名、回执位置写进 Weekly Log

## 5. 本周动作（责任到人）

| 动作 | 谁 | 完成标准 | 时间 |
|---|---|---|---|
| BMC 定稿并与证据对齐 | 汪睿 + 郭宇璇（Rita） | 九宫格无自相矛盾 | 11-03 前 |
| claim-evidence map 补齐 | 黄禹轩 | 每条 claim 有证据 ID | 11-04 前 |
| deck 文案与页序定稿 | 毛相宜 | 严格 6 页 | 11-04 前 |
| demo 彩排（一遍过，不依赖网络） | 郭宇璇（Rita） | `npm run build` 通过 + `npm run reset` 可复现 | 11-05 前 |
| 全组过一遍 deck，每人能讲自己那页 | 汪睿 | 抽问不掉链子 | 11-05 前 |
| LMO 提交 + 两个回执 | 郭宇璇（Rita） | 回执存 Week_8 | **11-06 23:59 前** |
| Weekly Log Week 8 entry | 黄禹轩 | 周六前更新 | 11-07 前 |

## 6. 红线

- 多一页少一页、加 appendix，直接扣分。
- 改了数字不留 v2、不记录原因。
- 提交后不保存回执（handbook 明确要求 verify both submission receipts）。
- 组员讲不出自己那部分的数字。
