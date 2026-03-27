const app = getApp()

Page({
  data: {
    group: {},
    leaderboard: [],
    inited: false,
    refreshing: false,
    currentOpenid: '',
    period: 'week',
    startDate: '',
    endDate: ''
  },

  onLoad(options) {
    this.groupId = options.id
  },

  onShow() {
    this.setData({ currentOpenid: app.globalData.openid })
    this.loadLeaderboard()
  },

  switchPeriod(e) {
    const period = e.currentTarget.dataset.period
    if (period === this.data.period) return
    this.setData({ period, refreshing: true })
    this.loadLeaderboard()
  },

  async loadLeaderboard() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'familyGroup',
        data: {
          action: 'getLeaderboard',
          groupId: this.groupId,
          period: this.data.period
        }
      })

      if (result.success) {
        const leaderboard = result.leaderboard.map((item, index) => {
          let medal = ''
          if (index === 0) medal = '🥇'
          else if (index === 1) medal = '🥈'
          else if (index === 2) medal = '🥉'
          return { ...item, rank: index + 1, medal }
        })

        this.setData({
          group: result.group,
          leaderboard,
          startDate: result.startDate,
          endDate: result.endDate
        })
      }
    } catch (err) {
      console.error('加载排行榜失败', err)
    }
    this.setData({ inited: true, refreshing: false })
  },

  copyGroupId() {
    wx.setClipboardData({
      data: this.groupId,
      success: () => wx.showToast({ title: '已复制群 ID', icon: 'success' })
    })
  },

  async quitGroup() {
    const res = await new Promise(resolve => {
      wx.showModal({
        title: '退出家庭群',
        content: `确定退出「${this.data.group.name}」吗？`,
        confirmText: '退出',
        confirmColor: '#FF4D4F',
        success: resolve
      })
    })

    if (!res.confirm) return

    wx.showLoading({ title: '退出中...' })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'familyGroup',
        data: { action: 'quit', groupId: this.groupId }
      })
      wx.hideLoading()

      if (result.success) {
        wx.showToast({ title: '已退出', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 500)
      } else {
        wx.showToast({ title: result.error, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '退出失败', icon: 'none' })
    }
  },

  onShareAppMessage() {
    return {
      title: `加入「${this.data.group.name}」一起运动吧！`,
      path: `/pages/pk/pk?groupId=${this.groupId}&join=1`
    }
  }
})
