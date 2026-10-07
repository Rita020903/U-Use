# U Use 最终交付包

版本日期：2026-10-06。以你提供的 ENT303TC 2026/27 handbook 为依据，独立 assessment brief 如有更具体要求，以它为准。本目录替代旧 pitch 和旧 JSON 原型描述，旧文件保留作历史记录。

## 正式作业

| 作业 | 当前文件 | 官方要求 / 截止 |
|---|---|---|
| A1 | `01_Assessments/A1_UUse_6_Slides.pptx` | 6 页，含封面，不加 appendix；2026-11-06 23:59；20% |
| A2 | `01_Assessments/A2_Recording_Script.md` | 3-6 分钟视频；2026-12-18；20%；视频需要实际拍摄 |
| A3 | `01_Assessments/A3_UUse_12_Slides.pptx` | 10-12 页 + live pitch；2027-03-21 23:59 北京时间；30% |
| A4 | `03_A4_Individual/` 七份角色专属材料 | 每人独立 reflection；2027-04-16；30% |

A3 live presentation：2027-03-22 至 03-26。Handbook 未写 A4 字数，也未写 A2/A4 的具体时刻，不伪造要求。A3 是当前版本，提交前必须更新为 2027 年真实进度。

## 支撑材料

- `02_Support/UUse_Venture_Dossier.docx`：问题、persona/journey 假设、三种方案与加权矩阵、研究与知情同意方案、完整九宫格 BMC、市场与成本、技术架构、团队章程草案、AI 声明和提交检查。
- `02_Support/Market_and_Costs.xlsx`：可修改、公式联动的四周保守场景与成本；押金不计收入，无虚构用户增长。
- `02_Support/Claims_and_Evidence.csv`：主张、依据、限制与待补证据。
- `02_Support/Weekly_Log_20261006.md`：仅记本次实际工作，不预填未来访谈或团队贡献。
- `02_Support/Release_Review.md`：本次修复、已执行验证与上线限制。
- `02_Support/Research_Record_Form.md`：可直接用于真实访谈/测试的记录表与中性问题。
- `02_Support/Team_Confirmation.md`：七位组员中英文姓名与待确认职责。
- `02_Support/Sources.csv`：课程手册和公开资料的来源登记。
- `02_Support/Product_Preview.png`：当前本地首页与明确标示的示例物品，不是用户使用证据。
- PPT 的 speaker notes 含来源、讲述细节和假设说明。支撑材料不作为 A1 第 7 页或 appendix 一起塞入正式 deck。

## 还必须真实完成的事项

1. 团队确认组号、正式封面需要的学号信息、分工、章程和签字。这里没有伪造签名或已完成贡献。
2. 按课程 checkpoint 做真实的 3-5 次互动/测试，保留匿名原始记录、至少三条可追溯洞察，再更新 deck。Demo 账号和自动化测试不算用户研究。
3. 实际录制 A2 视频。七位成员分别核实自己的经历，独立完成 A4；角色材料不是可冒充本人经历的成稿。
4. 查阅独立 assessment brief，核对 AI 声明、命名、字数、上传要求；本人提交到 LMO，并保存 handbook 要求的回执。
5. 公网上线前完成 SMTP、HTTPS、生产 PostgreSQL、备份恢复、真实设备和运营责任验收。不要把本地 prototype 当成正式托管/担保交易服务。

## 数据规则

计划人数、转化率、单价、成本、未来收费和决策阈值均显式标为假设。产品截图来自本地程序及合成测试数据。没有编造访谈、满意度、营收、合作方、用户人数或提交回执。26,000+ 仅是学校整体规模，不是两个校区的可触达人数。

GitHub 只保留代码和去标识的证据材料。数据库、`.env`、令牌、邮箱、原始课表、定位与个人聊天不得放进仓库。以前在聊天里发过的凭据应在 GitHub 撤销，不能继续复用。

## 产品代码

最新源码位于本目录旁的 `../xjtlu-market-app/`，架构见 `../ARCHITECTURE.md`。交付 ZIP 只装作业与支撑材料，不装数据库、用户课表、环境变量、依赖包或测试内部文件。它不是可以直接部署的源码 ZIP，也不是全部都应上传到 LMO 的单一作业。
