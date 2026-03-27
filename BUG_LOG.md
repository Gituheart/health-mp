# Bug 日志

每次修改代码前，先查阅此文件，确认是否有类似历史问题。

---

## BUG-001 多账号数据隔离失效

**发现时间：** 2026-03-27
**严重程度：** 高
**状态：** 已修复

### 现象
用另一个账号注册登录后，首页本周概览（卡路里/每日柱状图）、运动统计页、打卡日历页均显示其他账号的数据。

### 根本原因
微信云开发数据库的 `_openid` 自动过滤，仅在集合权限为"仅创建者可读写"（private）时生效。代码中所有 `checkins` 集合的查询均未显式过滤 `openid`，导致集合权限一旦不是严格 private，所有账号数据混读。同时写入时也未记录 `openid` 字段，导致无法在查询层做精确过滤。

### 受影响文件
| 文件 | 问题点 |
|------|--------|
| `pages/checkin/checkin.js` | `add()` 未写入 `openid`；`loadTodayRecords()`、`calcStreak()` 查询无 openid 过滤 |
| `pages/index/index.js` | `loadData()` 查询无 openid 过滤 |
| `pages/stats/stats.js` | `loadStats()` 查询无任何 where 条件 |
| `pages/calendar/calendar.js` | `buildCalendar()` 查询无 openid 过滤 |

### 修复方案
1. `checkin.js` `onSubmit()` 写入时加 `openid: app.globalData.openid`
2. 全部 `checkins` 查询的 `where()` 加 `openid: app.globalData.openid`

---

## BUG-002 calcStreak N+1 查询

**发现时间：** 2026-03-27
**严重程度：** 中（性能）
**状态：** 已修复

### 现象
打卡页加载时，连续打卡天数越多，页面越卡，极端情况下会发起最多 365 次串行数据库请求。

### 根本原因
`calcStreak()` 在 for 循环内对每一天单独发起一次 `db.collection('checkins').where({date}).get()`，每次均为网络往返请求。

### 受影响文件
| 文件 | 问题点 |
|------|--------|
| `pages/checkin/checkin.js` | `calcStreak()` 循环内串行查询 |

### 修复方案
改为一次性查询近 365 天内所有打卡日期，用 `Set` 在 JS 内计算连续天数，DB 请求从最多 365 次降为 1 次。

### 教训 / 检查清单
> 今后涉及循环内数据库查询的代码改动，必须确认：
> - [ ] 是否可以合并为单次批量查询
> - [ ] 能否用 `.field()` 只拉取必要字段

---

### 教训 / 检查清单（BUG-001）
> 今后涉及 `checkins`、`users` 或任何用户私有集合的代码改动，必须确认：
> - [ ] 写入时是否包含 `openid` 字段
> - [ ] 查询 where 条件是否包含 `openid: app.globalData.openid`
> - [ ] 新增集合时，是否同样遵守上述规范
> - [ ] 云函数内用 `wxContext.OPENID` 做隔离，不能依赖客户端传入的 openid

---
