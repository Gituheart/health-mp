const app = getApp()

Page({
  data: {
    weekStats: { calories: 0, count: 0, minutes: 0, days: 0 },
    monthStats: { calories: 0, count: 0, minutes: 0, days: 0 },
    totalStats: { calories: 0, count: 0, minutes: 0, days: 0 },
    topExercises: [],
    inited: false
  },

  onShow() {
    this.loadStats()
  },

  async loadStats() {
    const db = wx.cloud.database()
    const _ = db.command
    const now = new Date()

    // 本周范围
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    const weekStart = this.formatDate(monday)
    const weekEnd = this.formatDate(now)

    // 本月范围
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = this.formatDate(now)

    try {
      // 获取全部打卡记录
      let allRecords = []
      let hasMore = true
      let skip = 0
      while (hasMore) {
        const { data } = await db.collection('checkins')
          .where({ openid: app.globalData.openid })
          .orderBy('date', 'desc')
          .skip(skip)
          .limit(100)
          .get()
        allRecords = allRecords.concat(data)
        hasMore = data.length === 100
        skip += 100
      }

      const weekRecords = allRecords.filter(r => r.date >= weekStart && r.date <= weekEnd)
      const monthRecords = allRecords.filter(r => r.date >= monthStart && r.date <= monthEnd)

      const calcStats = (records) => {
        const calories = records.reduce((s, r) => s + (r.calories || 0), 0)
        const minutes = records.reduce((s, r) => s + (r.duration_min || 0), 0)
        const days = new Set(records.map(r => r.date)).size
        return { calories, count: records.length, minutes, days }
      }

      // 运动类型排行
      const typeMap = {}
      allRecords.forEach(r => {
        if (!typeMap[r.exercise_type]) {
          typeMap[r.exercise_type] = { name: r.exercise_type, calories: 0, count: 0 }
        }
        typeMap[r.exercise_type].calories += r.calories || 0
        typeMap[r.exercise_type].count++
      })
      const topExercises = Object.values(typeMap)
        .sort((a, b) => b.calories - a.calories)
        .slice(0, 5)

      this.setData({
        weekStats: calcStats(weekRecords),
        monthStats: calcStats(monthRecords),
        totalStats: calcStats(allRecords),
        topExercises,
        inited: true
      })
    } catch (err) {
      console.error('加载统计数据失败', err)
      this.setData({ inited: true })
    }
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
})
