const app = getApp()

const EXERCISE_TYPES = [
  { name: '散步', met: 2.5, emoji: '🚶' },
  { name: '快走', met: 3.5, emoji: '🏃' },
  { name: '慢跑', met: 7.0, emoji: '👟' },
  { name: '太极拳', met: 3.0, emoji: '🧘' },
  { name: '广场舞', met: 4.5, emoji: '💃' },
  { name: '骑自行车', met: 4.0, emoji: '🚲' },
  { name: '家务劳动', met: 3.0, emoji: '🧹' },
  { name: '康复训练', met: 2.5, emoji: '💪' },
  { name: '自定义', met: 3.0, emoji: '✏️', custom: true }
]

Page({
  data: {
    exerciseTypes: EXERCISE_TYPES,
    selectedType: '',
    selectedMet: 0,
    isCustomType: false,
    customTypeName: '',
    duration: 0,
    customDuration: '',
    calories: 0,
    mediaUrl: '',
    mediaUploading: false,
    submitting: false,
    todayRecords: [],
    streak: 0
  },

  onShow() {
    this.loadTodayRecords()
    this.calcStreak()
  },

  onSelectType(e) {
    const { name, met, custom } = e.currentTarget.dataset
    if (custom) {
      this.setData({ selectedType: name, selectedMet: met, isCustomType: true })
    } else {
      this.setData({ selectedType: name, selectedMet: met, isCustomType: false, customTypeName: '' })
    }
    this.calcCalories()
  },

  onCustomTypeInput(e) {
    this.setData({ customTypeName: e.detail.value })
  },

  onSelectDuration(e) {
    const val = e.currentTarget.dataset.val
    this.setData({ duration: val, customDuration: '' })
    this.calcCalories()
  },

  onCustomDurationInput(e) {
    const val = Number(e.detail.value) || 0
    this.setData({ duration: val, customDuration: e.detail.value })
    this.calcCalories()
  },

  calcCalories() {
    const { selectedMet, duration } = this.data
    const weight = (app.globalData.userInfo && app.globalData.userInfo.weight) || 60
    const calories = Math.round(selectedMet * weight * (duration / 60))
    this.setData({ calories })
  },

  onChoosePhoto() {
    if (!app.globalData.openid) {
      wx.showToast({ title: '登录中，请稍后重试', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({ mediaUploading: true })
        wx.cloud.uploadFile({
          cloudPath: `checkin/${app.globalData.openid}/${Date.now()}.jpg`,
          filePath: tempFilePath,
          success: (uploadRes) => {
            this.setData({ mediaUrl: uploadRes.fileID, mediaUploading: false })
          },
          fail: () => {
            this.setData({ mediaUploading: false })
            wx.showToast({ title: '上传失败，请重试', icon: 'none' })
          }
        })
      }
    })
  },

  onRemovePhoto() {
    this.setData({ mediaUrl: '' })
  },

  async onSubmit() {
    const { selectedType, isCustomType, customTypeName, duration, calories, selectedMet, mediaUrl } = this.data
    const finalType = isCustomType ? (customTypeName.trim() || '自定义运动') : selectedType
    if (!selectedType || !duration) return
    if (isCustomType && !customTypeName.trim()) {
      wx.showToast({ title: '请输入运动名称', icon: 'none' })
      return
    }
    if (!app.globalData.openid) {
      wx.showToast({ title: '登录中，请稍后重试', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const db = wx.cloud.database()
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const record = {
        openid: app.globalData.openid,
        exercise_type: finalType,
        met: selectedMet,
        duration_min: duration,
        calories,
        date: dateStr,
        createdAt: db.serverDate()
      }
      if (mediaUrl) record.media_url = mediaUrl

      await db.collection('checkins').add({ data: record })

      wx.showToast({ title: '打卡成功！', icon: 'success' })
      this.setData({
        selectedType: '', selectedMet: 0, isCustomType: false,
        customTypeName: '', duration: 0, customDuration: '',
        calories: 0, mediaUrl: ''
      })
      this.loadTodayRecords()
      this.calcStreak()
    } catch (err) {
      console.error('打卡失败', err)
      wx.showToast({ title: '打卡失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  async loadTodayRecords() {
    try {
      const db = wx.cloud.database()
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const { data } = await db.collection('checkins')
        .where({ date: dateStr, openid: app.globalData.openid })
        .orderBy('createdAt', 'desc')
        .get()

      this.setData({ todayRecords: data })
    } catch (err) {
      console.error('加载打卡记录失败', err)
    }
  },

  async calcStreak() {
    const db = wx.cloud.database()
    const _ = db.command
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 364)
    const cutoffStr = this.formatDate(cutoff)

    const { data } = await db.collection('checkins')
      .where({ openid: app.globalData.openid, date: _.gte(cutoffStr) })
      .field({ date: true })
      .get()

    const dateSet = new Set(data.map(r => r.date))

    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = this.formatDate(d)
      if (dateSet.has(dateStr)) {
        streak++
      } else {
        if (i === 0) continue
        break
      }
    }

    this.setData({ streak })
  },

  formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
})
