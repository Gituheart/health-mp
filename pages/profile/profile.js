const app = getApp()

Page({
  data: {
    userInfo: null,
    bmi: '',
    bmiLabel: '',
    bodyFat: '',
    bodyFatLevel: '',
    arrow: '\u276F'
  },

  onShow() {
    const userInfo = app.globalData.userInfo
    this.setData({ userInfo })
    if (userInfo) this.calcBodyData(userInfo)
  },

  calcBodyData(info) {
    const weight = info.weight || 0
    const height = info.height || 0
    const age = info.age || 0
    const gender = info.gender || ''

    if (!height || !weight) {
      this.setData({ bmi: '', bodyFat: '' })
      return
    }

    // BMI
    const bmi = weight / ((height / 100) * (height / 100))
    const bmiRound = Math.round(bmi * 10) / 10
    let bmiLabel = ''
    if (bmi < 18.5) bmiLabel = '偏瘦'
    else if (bmi < 24) bmiLabel = '正常'
    else if (bmi < 28) bmiLabel = '偏胖'
    else bmiLabel = '肥胖'

    // 体脂率 - Deurenberg 公式 (1991)
    // BF% = 1.2 × BMI + 0.23 × Age - 10.8 × Sex - 5.4
    // Sex: male=1, female=0
    let bodyFat = ''
    let bodyFatLevel = ''
    if (gender && age) {
      const sexFactor = gender === 'male' ? 1 : 0
      const bf = 1.2 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4
      const bfRound = Math.round(bf * 10) / 10

      if (gender === 'male') {
        if (bf < 15) bodyFatLevel = '偏低'
        else if (bf < 25) bodyFatLevel = '正常'
        else bodyFatLevel = '偏高'
      } else {
        if (bf < 20) bodyFatLevel = '偏低'
        else if (bf < 30) bodyFatLevel = '正常'
        else bodyFatLevel = '偏高'
      }

      bodyFat = bfRound > 0 ? bfRound + '%' : '--'
    }

    this.setData({ bmi: String(bmiRound), bmiLabel, bodyFat, bodyFatLevel })
  },

  goUserInfo() {
    wx.navigateTo({ url: '/pages/userinfo/userinfo?edit=1' })
  },

  goReport() {
    wx.navigateTo({ url: '/pages/report/report' })
  },

  goCalendar() {
    wx.navigateTo({ url: '/pages/calendar/calendar' })
  },

  goStats() {
    wx.navigateTo({ url: '/pages/stats/stats' })
  }
})
