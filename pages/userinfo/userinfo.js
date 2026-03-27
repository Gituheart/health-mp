const app = getApp()

Page({
  data: {
    nickname: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    submitting: false,
    isEdit: false
  },

  onLoad(options) {
    if (options.edit === '1' && app.globalData.userInfo) {
      const info = app.globalData.userInfo
      this.setData({
        isEdit: true,
        nickname: info.nickname || '',
        age: String(info.age || ''),
        gender: info.gender || '',
        height: String(info.height || ''),
        weight: String(info.weight || '')
      })
    }
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onAgeInput(e) {
    this.setData({ age: e.detail.value })
  },

  onGenderSelect(e) {
    const gender = e.currentTarget.dataset.gender
    this.setData({ gender })
  },

  onHeightInput(e) {
    this.setData({ height: e.detail.value })
  },

  onWeightInput(e) {
    this.setData({ weight: e.detail.value })
  },

  async onSubmit() {
    const { nickname, age, gender, height, weight, isEdit } = this.data
    if (!nickname || !age || !weight) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const db = wx.cloud.database()
      const userInfo = {
        nickname,
        age: Number(age),
        gender: gender || '',
        height: Number(height) || 0,
        weight: Number(weight)
      }

      if (isEdit) {
        // 更新已有记录
        const { data: users } = await db.collection('users')
          .where({ openid: app.globalData.openid })
          .get()

        if (users.length > 0) {
          await db.collection('users').doc(users[0]._id).update({
            data: userInfo
          })
        }

        app.globalData.userInfo = { ...app.globalData.userInfo, ...userInfo }
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 500)
      } else {
        // 新建
        userInfo.openid = app.globalData.openid
        userInfo.createdAt = db.serverDate()
        await db.collection('users').add({ data: userInfo })
        app.globalData.userInfo = userInfo
        wx.switchTab({ url: '/pages/index/index' })
      }
    } catch (err) {
      console.error('保存用户信息失败', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
