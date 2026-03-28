const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  if (action === 'create') {
    const { name } = event

    const { _id } = await db.collection('family_groups').add({
      data: {
        name,
        creator_id: openid,
        members: [openid],
        createdAt: db.serverDate()
      }
    })

    return { success: true, groupId: _id, groupName: name }
  }

  if (action === 'join') {
    const { groupId } = event

    let group
    try {
      const res = await db.collection('family_groups').doc(groupId).get()
      group = res.data
    } catch (e) {
      return { success: false, error: '群组不存在，请检查链接' }
    }

    if (group.members.includes(openid)) {
      return { success: false, error: '你已经在这个群组中了', alreadyIn: true, groupName: group.name }
    }

    await db.collection('family_groups').doc(groupId).update({
      data: {
        members: _.push(openid)
      }
    })

    return { success: true, groupName: group.name }
  }

  if (action === 'getGroupInfo') {
    const { groupId } = event
    try {
      const { data: group } = await db.collection('family_groups').doc(groupId).get()
      return { success: true, group }
    } catch (e) {
      return { success: false, error: '群组不存在' }
    }
  }

  if (action === 'getMyGroups') {
    const { data } = await db.collection('family_groups')
      .where({ members: openid })
      .orderBy('createdAt', 'desc')
      .get()

    return { success: true, groups: data }
  }

  if (action === 'getLeaderboard') {
    const { groupId, period } = event // period: 'week' | 'month'

    const { data: group } = await db.collection('family_groups').doc(groupId).get()

    // 根据 period 计算日期范围
    const now = new Date()
    let startDate, endDate

    if (period === 'week') {
      const day = now.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const monday = new Date(now)
      monday.setDate(now.getDate() + diff)
      monday.setHours(0, 0, 0, 0)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      startDate = monday
      endDate = sunday
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const formatDate = (d) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const startStr = formatDate(startDate)
    const endStr = formatDate(endDate)

    const members = group.members
    const results = []

    for (const uid of members) {
      const { data: checkins } = await db.collection('checkins')
        .where({
          _openid: uid,
          date: _.gte(startStr).and(_.lte(endStr))
        })
        .get()

      const calories = checkins.reduce((sum, r) => sum + (r.calories || 0), 0)
      const checkinDays = new Set(checkins.map(c => c.date)).size

      const { data: users } = await db.collection('users').where({ openid: uid }).get()
      const userInfo = users[0] || {}

      results.push({
        openid: uid,
        nickname: userInfo.nickname || '未知用户',
        avatarUrl: userInfo.avatarUrl || '',
        calories,
        healthIndex: Math.floor(calories / 100),
        checkinDays
      })
    }

    results.sort((a, b) => b.calories - a.calories)

    return {
      success: true,
      group,
      leaderboard: results,
      period,
      startDate: startStr,
      endDate: endStr
    }
  }

  if (action === 'getMemberStats') {
    const { groupId, targetOpenid } = event

    let group
    try {
      const res = await db.collection('family_groups').doc(groupId).get()
      group = res.data
    } catch (e) {
      return { success: false, error: '群组不存在' }
    }

    if (!group.members.includes(openid)) {
      return { success: false, error: '无权限查看' }
    }
    if (!group.members.includes(targetOpenid)) {
      return { success: false, error: '该成员不在群中' }
    }

    const formatDate = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const now = new Date()
    const todayStr = formatDate(now)
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 29)
    const cutoffStr = formatDate(cutoff)

    const { data: checkins } = await db.collection('checkins')
      .where({ _openid: targetOpenid, date: _.gte(cutoffStr) })
      .get()

    // 按天聚合
    const dayMap = {}
    for (const c of checkins) {
      if (!dayMap[c.date]) dayMap[c.date] = { calories: 0, count: 0 }
      dayMap[c.date].calories += c.calories || 0
      dayMap[c.date].count += 1
    }

    // 最近 7 天柱状图数据
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const last7 = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = formatDate(d)
      last7.push({
        date: dateStr,
        label: i === 0 ? '今' : weekdays[d.getDay()],
        calories: (dayMap[dateStr] || {}).calories || 0,
        hasCheckin: !!dayMap[dateStr]
      })
    }

    // 本周统计
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    const mondayStr = formatDate(monday)

    let weekCalories = 0, weekDays = 0
    for (const [date, val] of Object.entries(dayMap)) {
      if (date >= mondayStr && date <= todayStr) {
        weekCalories += val.calories
        weekDays++
      }
    }

    // 连续打卡
    let streak = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = formatDate(d)
      if (dayMap[dateStr]) {
        streak++
      } else {
        if (i === 0) continue
        break
      }
    }

    const { data: users } = await db.collection('users').where({ openid: targetOpenid }).get()
    const userInfo = users[0] || {}

    return {
      success: true,
      userInfo: { nickname: userInfo.nickname || '未知用户', avatarUrl: userInfo.avatarUrl || '' },
      todayChecked: !!dayMap[todayStr],
      weekCalories,
      weekDays,
      streak,
      last7
    }
  }

  if (action === 'quit') {
    const { groupId } = event

    let group
    try {
      const res = await db.collection('family_groups').doc(groupId).get()
      group = res.data
    } catch (e) {
      return { success: false, error: '群组不存在' }
    }

    if (!group.members.includes(openid)) {
      return { success: false, error: '你不在这个群组中' }
    }

    // 如果是创建者且群里只剩自己，直接删除群
    if (group.creator_id === openid && group.members.length === 1) {
      await db.collection('family_groups').doc(groupId).remove()
      return { success: true, deleted: true }
    }

    // 移除成员
    await db.collection('family_groups').doc(groupId).update({
      data: {
        members: _.pull(openid)
      }
    })

    // 如果创建者退出，把创建者转给第一个剩余成员
    if (group.creator_id === openid) {
      const remaining = group.members.filter(m => m !== openid)
      await db.collection('family_groups').doc(groupId).update({
        data: {
          creator_id: remaining[0]
        }
      })
    }

    return { success: true }
  }

  return { success: false, error: '未知操作' }
}
