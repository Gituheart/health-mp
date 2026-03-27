const app = getApp()

Page({
  data: {
    year: 0,
    month: 0,
    days: [],
    checkinDates: {},
    monthTotal: 0,
    monthDays: 0,
    leftArrow: '\u276E',
    rightArrow: '\u276F',
    weekdays: ['一', '二', '三', '四', '五', '六', '日']
  },

  onLoad() {
    const now = new Date()
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1
    })
    this.buildCalendar()
  },

  prevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month })
    this.buildCalendar()
  },

  nextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month })
    this.buildCalendar()
  },

  async buildCalendar() {
    const { year, month } = this.data
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    let startWeekday = firstDay.getDay()
    if (startWeekday === 0) startWeekday = 7 // 周一为起始

    // 加载本月打卡数据
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    let checkinDates = {}
    try {
      const db = wx.cloud.database()
      const _ = db.command
      const { data } = await db.collection('checkins')
        .where({ date: _.gte(startStr).and(_.lte(endStr)), openid: app.globalData.openid })
        .get()

      data.forEach(r => {
        if (!checkinDates[r.date]) {
          checkinDates[r.date] = { calories: 0, count: 0 }
        }
        checkinDates[r.date].calories += r.calories || 0
        checkinDates[r.date].count++
      })
    } catch (err) {
      console.error('加载打卡数据失败', err)
    }

    // 构建日历格子
    const days = []
    // 前面空白
    for (let i = 1; i < startWeekday; i++) {
      days.push({ day: '', empty: true })
    }
    // 日期
    const todayStr = this.formatDate(new Date())
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const info = checkinDates[dateStr]
      days.push({
        day: d,
        dateStr,
        checked: !!info,
        calories: info ? info.calories : 0,
        isToday: dateStr === todayStr
      })
    }

    const monthDays = Object.keys(checkinDates).length
    let monthTotal = 0
    Object.values(checkinDates).forEach(v => { monthTotal += v.calories })

    this.setData({ days, checkinDates, monthTotal, monthDays })
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
})
