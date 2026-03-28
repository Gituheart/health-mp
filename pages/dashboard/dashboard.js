const app = getApp()

Page({
  data: {
    inited: false,
    nickname: '',
    todayChecked: false,
    weekCalories: 0,
    weekDays: 0,
    streak: 0,
    last7: [],
    maxCalories: 0
  },

  onLoad(options) {
    this.groupId = options.groupId
    this.targetOpenid = options.openid
    const nickname = decodeURIComponent(options.nickname || '')
    this.setData({ nickname })
    this.loadStats()
  },

  async loadStats() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'familyGroup',
        data: {
          action: 'getMemberStats',
          groupId: this.groupId,
          targetOpenid: this.targetOpenid
        }
      })

      if (!result.success) {
        wx.showToast({ title: result.error || '加载失败', icon: 'none' })
        this.setData({ inited: true })
        return
      }

      const maxCalories = Math.max(...result.last7.map(d => d.calories), 1)
      const last7 = result.last7.map(d => ({
        ...d,
        barHeight: d.hasCheckin
          ? Math.max(Math.round((d.calories / maxCalories) * 100), 4)
          : 8
      }))

      this.setData({
        nickname: result.userInfo.nickname,
        todayChecked: result.todayChecked,
        weekCalories: result.weekCalories,
        weekDays: result.weekDays,
        streak: result.streak,
        last7,
        maxCalories,
        inited: true
      })

      wx.setNavigationBarTitle({ title: result.userInfo.nickname + ' 的看板' })
    } catch (err) {
      console.error('加载成员看板失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  }
})
