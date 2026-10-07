# 部署与运行

## 正式环境

1. 使用 Node.js 24、HTTPS 反向代理和专用 PostgreSQL 数据库。配置 `APP_ORIGIN=https://你的域名`（不含末尾斜线）及 `DATABASE_URL`；应用身份只授予该数据库所需读写与建表权限，首次启动创建 `uuse_records`。
2. 配置 `AUTH_SECRET` / `CRON_SECRET`（独立随机值，至少 24 字符）、非默认 `ADMIN_PASSWORD`。不要提交环境文件、数据库或用户课表到 Git。
3. 配置 `SMTP_URL=smtps://USER:PASSWORD@HOST:465`，或需要 STARTTLS 的 `smtp://USER:PASSWORD@HOST:587`；账号密码中的特殊字符须 URL 编码。填写 `SMTP_FROM`，在邮件供应商验证发件域和投递能力。远程连接要求加密；只有本地测试服务器允许明文。
4. `AUTH_DELIVERY=email`、`MIGRATE_LEGACY=false`、`SEED_DEMO=false`。生产环境不允许开发验证码账号交易。学生邮箱允许域默认 `student.xjtlu.edu.cn`，可通过 `STUDENT_EMAIL_DOMAINS` 增加经过确认的学校域。
5. 执行 `npm ci`、`npm test`、`npm run lint`、`npm run build`、`npm run test:api`；用专用测试 PostgreSQL 执行 `npm run test:postgres` 后再启动 `npm start`。
6. 定时任务每分钟向 `/api/maintenance` 发送 POST，携带 `Authorization: Bearer <CRON_SECRET>`。任务处理未确认预约到期、邮件重试及临时数据清理；不能公开 cron 密钥。
7. 监控 5xx、邮件失败、数据库连接/容量、预约异常、照片占用和维护任务结果。定期执行供应商备份与恢复演练；不能仅确认备份文件存在。

数据库和 SMTP 服务必须由项目方开通配置，这个仓库不包含现成的云服务凭据。学校 SSO、实时校车、支付托管、自动退款、室内导航都不在已接通范围内。

## 持久磁盘单机

不使用 PostgreSQL 时，显式配置 `ALLOW_LOCAL_DATABASE=true` 与绝对 `DATA_DIRECTORY`，把其 `private/` 放在持久磁盘上；不能多容器共享 SQLite 网络文件系统。备份使用 SQLite 在线备份 API，不能只复制正在写入的主文件而忽略 WAL。

```bash
BACKUP_DIRECTORY=/private/path/outside-git npm run backup
```

备份包含学生邮箱、课表和会话等敏感信息，需加密、限制访问并安排保留周期。恢复先停止应用，在私有持久目录放入完整备份，再恢复启动并验证账号及交易记录。PostgreSQL 使用供应商备份或 `pg_dump` / `pg_restore`，先在测试数据库演练。

## 旧数据

需要保留旧个人课表时，首次启动设置 `MIGRATE_LEGACY=true`，`DATA_DIRECTORY` 指向含旧 JSON 与 `private/people.json` 的目录。一次性迁移完成后，数据库标记阻止重复导入；旧文件保持不变。切换 PostgreSQL 必须迁移完整数据库记录，不能只导入旧 JSON，否则会丢失后来创建的账户和交易。

`npm run reset` 只接受显式的隔离 `SQLITE_PATH` 和 `RESET_DEMO_CONFIRM=RESET_DEMO_ONLY`。有已登录账号、生产模式或 PostgreSQL 时拒绝重置。正常维护不能用重置替代迁移。

## 隐私与运营

- 账号和个人课表按本人会话隔离，消息与交易按参与方授权。匿名访客只能浏览和准备私人课表，不能发布或交易。
- 原始课表文件和 OCR 原文留在浏览器；草稿只保存在当前浏览器。共享电脑应退出登录，退出会清除本机账户草稿和收藏。
- 精确实时位置不上传；附近位置约 200 米网格，最长保留 2 分钟。客户端 GPS 可被伪造，不作为交易身份证明。
- 首页地图默认折叠，只有展开才向地图服务请求底图。精确 GPS 不上传至 U Use 后端，但定位后的 OpenStreetMap 瓦片请求会反映当前视区，底图提供方可能推断所在区域；不能声称第三方完全无法获知位置。发布者可只填写公共地点名称，不添加地图坐标。
- 求物公开物品要求、昵称、校区和日期，不公开账户 ID、邮箱、课表或推荐列表。公开文本仍应由用户避免填写私人联系方式；求物与物品都可举报，管理员应定期处理。回应求物不会自动锁定库存或代替交易确认。
- 实物照片去除 EXIF；用户不要上传住址、证件、他人肖像或私人联系方式。发布地点是公开交付点，双方确认安全和开放条件。
- 线下收付款只是双方记录，没有平台托管或退款保证。双方确认交付与归还，争议进入管理员处理队列。
- 正式开放前确定服务条款、禁售规则、押金/损坏争议流程、联系方式、个人数据保留和删除申请流程，进行独立安全与合规审查。这不是法律合规已获确认的声明。
- 代码修复不等于验证了需求或获客：用户规模、转化、收入预测必须来自实际运营；不得把演示数据当作访谈或使用证据。

## 测试边界

本机业务与 API 测试使用 SQLite 和本地 SMTP 模拟器，验证权限及交付路径，不证明邮件能送到真实学校邮箱。本机共享内存限制使 PostgreSQL 无法启动，但 [2026-10-07 GitHub 自动测试](https://github.com/Rita020903/U-Use/actions/runs/37595952467) 已在独立 PostgreSQL 服务中通过产品代码提交 `232abe0` 的集成测试及其余全部检查。正式上线仍需验证项目自己的数据库、备份恢复、HTTPS 和学校邮箱投递。依赖审计为执行时结果，不代表未来没有新的安全漏洞。
