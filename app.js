App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 以上的基础库以使用云能力')
      return
    }

    wx.cloud.init({
      env: 'cloud1-8gat8oniea3581bc',
      traceUser: true
    })

    this.login()
  },

  async login() {
    try {
      const { result } = await wx.cloud.callFunction({ name: 'login' })
      this.globalData.openid = result.openid

      if (result.userInfo) {
        this.globalData.userInfo = result.userInfo
      } else {
        wx.redirectTo({ url: '/pages/userinfo/userinfo' })
      }
    } catch (err) {
      console.error('登录失败', err)
    }
  },

  globalData: {
    openid: null,
    userInfo: null
  }
})
