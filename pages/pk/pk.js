const app = getApp()

Page({
  data: {
    myGroups: [],
    hasGroup: false,
    inited: false,
    showJoinModal: false,
    joinGroupId: '',
    arrow: '\u276F'
  },

  onLoad(options) {
    if (options.groupId && options.join === '1') {
      this.pendingJoinGroupId = options.groupId
    }
  },

  onShow() {
    this.loadGroups()
  },

  async loadGroups() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'familyGroup',
        data: { action: 'getMyGroups' }
      })

      if (result.success) {
        this.setData({
          myGroups: result.groups,
          hasGroup: result.groups.length > 0
        })
      }
    } catch (err) {
      console.error('加载家庭群失败', err)
    }
    this.setData({ inited: true })

    if (this.pendingJoinGroupId) {
      const groupId = this.pendingJoinGroupId
      this.pendingJoinGroupId = null
      this.confirmJoin(groupId)
    }
  },

  async confirmJoin(groupId) {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'familyGroup',
        data: { action: 'getGroupInfo', groupId }
      })

      if (!result.success) {
        wx.showToast({ title: result.error, icon: 'none' })
        return
      }

      const group = result.group
      const confirmRes = await new Promise(resolve => {
        wx.showModal({
          title: '加入家庭群',
          content: `确定加入「${group.name}」？\n当前 ${group.members.length} 人参与`,
          confirmText: '加入',
          confirmColor: '#00C853',
          success: resolve
        })
      })

      if (!confirmRes.confirm) return

      wx.showLoading({ title: '加入中...' })
      const { result: joinRes } = await wx.cloud.callFunction({
        name: 'familyGroup',
        data: { action: 'join', groupId }
      })
      wx.hideLoading()

      if (joinRes.success) {
        wx.showToast({ title: `已加入「${joinRes.groupName}」`, icon: 'success' })
        this.loadGroups()
      } else if (joinRes.alreadyIn) {
        wx.showToast({ title: '你已在群中', icon: 'none' })
      } else {
        wx.showToast({ title: joinRes.error, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '加入失败', icon: 'none' })
    }
  },

  async createGroup() {
    const nameRes = await new Promise(resolve => {
      wx.showModal({
        title: '创建家庭群',
        placeholderText: '如：柳家活力群',
        editable: true,
        confirmText: '创建',
        success: resolve
      })
    })

    if (!nameRes.confirm || !nameRes.content || !nameRes.content.trim()) return

    const groupName = nameRes.content.trim()

    wx.showLoading({ title: '创建中...' })
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'familyGroup',
        data: { action: 'create', name: groupName }
      })

      wx.hideLoading()
      if (result.success) {
        this.newGroupId = result.groupId
        this.newGroupName = result.groupName
        this.loadGroups()
        wx.showModal({
          title: '创建成功！',
          content: `「${groupName}」已创建，点击确定分享给家人`,
          confirmText: '分享',
          success: (res) => {
            if (res.confirm) {
              this.setData({ showShareTip: true })
              setTimeout(() => this.setData({ showShareTip: false }), 3000)
            }
          }
        })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  },

  showJoinModal() {
    this.setData({ showJoinModal: true, joinGroupId: '' })
  },

  hideJoinModal() {
    this.setData({ showJoinModal: false })
  },

  onJoinIdInput(e) {
    this.setData({ joinGroupId: e.detail.value })
  },

  async joinGroup() {
    const groupId = this.data.joinGroupId.trim()
    if (!groupId) {
      wx.showToast({ title: '请输入群 ID', icon: 'none' })
      return
    }

    this.setData({ showJoinModal: false })
    this.confirmJoin(groupId)
  },

  viewGroup(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/pk-detail/pk-detail?id=${id}`
    })
  },

  shareGroup(e) {
  },

  onShareAppMessage(e) {
    const groupId = e.target && e.target.dataset && e.target.dataset.groupId
    const groupName = e.target && e.target.dataset && e.target.dataset.groupName
    if (groupId) {
      return {
        title: `加入「${groupName}」一起运动吧！`,
        path: `/pages/pk/pk?groupId=${groupId}&join=1`
      }
    }

    if (this.newGroupId) {
      const id = this.newGroupId
      const name = this.newGroupName
      this.newGroupId = null
      this.newGroupName = null
      return {
        title: `加入「${name}」一起运动吧！`,
        path: `/pages/pk/pk?groupId=${id}&join=1`
      }
    }

    return {
      title: '柳活力周 - 家人运动打卡',
      path: '/pages/index/index'
    }
  }
})
