const app = getApp()

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

Page({
  data: {
    nickname: '',
    greeting: '',
    today: '',
    todayCalories: 0,
    todayCount: 0,
    todayMinutes: 0,
    weekCalories: 0,
    weekDays: [],
    healthScore: 0,
    healthLevel: '',
    healthColor: '',
    bmi: 0,
    bmiLabel: '',
    hasHeight: false
  },

  onShow() {
    this.initPage()
    this.loadData()
  },

  initPage() {
    const now = new Date()
    const hour = now.getHours()
    let greeting = '晚上好'
    if (hour < 12) greeting = '早上好'
    else if (hour < 18) greeting = '下午好'

    const month = now.getMonth() + 1
    const date = now.getDate()
    const dayName = DAY_NAMES[now.getDay()]

    const userInfo = app.globalData.userInfo
    this.setData({
      greeting,
      nickname: (userInfo && userInfo.nickname) || '',
      today: `${month}月${date}日 周${dayName}`
    })
  },

  async loadData() {
    const db = wx.cloud.database()
    const _ = db.command
    const now = new Date()
    const todayStr = this.formatDate(now)

    const monday = this.getMonday(now)
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      dates.push(this.formatDate(d))
    }

    try {
      const { data: records } = await db.collection('checkins')
        .where({ date: _.in(dates), openid: app.globalData.openid })
        .get()

      const todayRecords = records.filter(r => r.date === todayStr)
      const todayCalories = todayRecords.reduce((sum, r) => sum + r.calories, 0)
      const todayMinutes = todayRecords.reduce((sum, r) => sum + r.duration_min, 0)

      const weekCalories = records.reduce((sum, r) => sum + r.calories, 0)
      const weekActiveDays = new Set(records.map(r => r.date)).size
      const weekMinutes = records.reduce((sum, r) => sum + r.duration_min, 0)

      const maxDayCal = Math.max(...dates.map(d => {
        return records.filter(r => r.date === d).reduce((sum, r) => sum + r.calories, 0)
      }), 1)

      const weekDays = dates.map((d, i) => {
        const dayCal = records.filter(r => r.date === d).reduce((sum, r) => sum + r.calories, 0)
        const dayDate = new Date(monday)
        dayDate.setDate(dayDate.getDate() + i)
        return {
          day: DAY_NAMES[dayDate.getDay()],
          calories: dayCal,
          height: Math.max(dayCal / maxDayCal * 160, dayCal > 0 ? 16 : 8),
          isToday: d === todayStr
        }
      })

      this.setData({
        todayCalories,
        todayCount: todayRecords.length,
        todayMinutes,
        weekCalories,
        weekDays
      })

      // 计算健康评分
      this.calcHealthScore(weekActiveDays, weekMinutes)
    } catch (err) {
      console.error('加载首页数据失败', err)
    }
  },

  calcHealthScore(weekActiveDays, weekMinutes) {
    const userInfo = app.globalData.userInfo
    if (!userInfo) return

    const weight = userInfo.weight || 60
    const height = userInfo.height || 0
    const age = userInfo.age || 30
    let totalScore = 0
    let factors = 0

    // === 1. BMI 评分 (0-35分) ===
    // WHO 标准：18.5-24.9 正常
    let bmi = 0
    let bmiScore = 0
    let bmiLabel = '未知'
    const hasHeight = height > 0

    if (hasHeight) {
      bmi = weight / ((height / 100) * (height / 100))
      bmi = Math.round(bmi * 10) / 10

      if (bmi < 18.5) {
        bmiScore = 25
        bmiLabel = '偏瘦'
      } else if (bmi < 24) {
        bmiScore = 35
        bmiLabel = '正常'
      } else if (bmi < 28) {
        bmiScore = 20
        bmiLabel = '偏胖'
      } else {
        bmiScore = 10
        bmiLabel = '肥胖'
      }
      totalScore += bmiScore
      factors += 35
    }

    // === 2. 运动频率评分 (0-35分) ===
    // WHO 建议：每周至少 150 分钟中等强度运动，或 5 天以上活动
    let activityScore = 0
    if (weekMinutes >= 150) {
      activityScore = 35
    } else if (weekMinutes >= 90) {
      activityScore = 28
    } else if (weekMinutes >= 60) {
      activityScore = 20
    } else if (weekMinutes >= 30) {
      activityScore = 12
    } else if (weekMinutes > 0) {
      activityScore = 5
    }
    totalScore += activityScore
    factors += 35

    // === 3. 运动规律性评分 (0-30分) ===
    // 每周活动天数越多越好
    let regularityScore = 0
    if (weekActiveDays >= 5) {
      regularityScore = 30
    } else if (weekActiveDays >= 3) {
      regularityScore = 22
    } else if (weekActiveDays >= 2) {
      regularityScore = 14
    } else if (weekActiveDays >= 1) {
      regularityScore = 7
    }
    totalScore += regularityScore
    factors += 30

    // 归一化到 100 分
    const healthScore = factors > 0 ? Math.round(totalScore / factors * 100) : 0

    let healthLevel = '需要加油'
    let healthColor = '#FF6D00'
    if (healthScore >= 80) {
      healthLevel = '非常健康'
      healthColor = '#00E676'
    } else if (healthScore >= 60) {
      healthLevel = '良好'
      healthColor = '#69F0AE'
    } else if (healthScore >= 40) {
      healthLevel = '一般'
      healthColor = '#FFB74D'
    }

    this.setData({ healthScore, healthLevel, healthColor, bmi, bmiLabel, hasHeight })
  },

  getMonday(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
})
