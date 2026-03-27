Page({
  data: {
    tempImages: [],
    analyzing: false,
    reports: [],
    arrow: '\u276F'
  },

  onShow() {
    this.loadReports()
  },

  chooseImages() {
    const remaining = 9 - this.data.tempImages.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多选择 9 张', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath)
        this.setData({
          tempImages: [...this.data.tempImages, ...newImages]
        })
      }
    })
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.tempImages
    images.splice(index, 1)
    this.setData({ tempImages: images })
  },

  async submitReport() {
    if (this.data.tempImages.length === 0 || this.data.analyzing) return

    this.setData({ analyzing: true })
    wx.showLoading({ title: 'AI 分析中...', mask: true })

    try {
      // 1. 上传图片到云存储
      const fileIDs = []
      for (const path of this.data.tempImages) {
        const ext = path.split('.').pop()
        const cloudPath = `reports/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { fileID } = await wx.cloud.uploadFile({
          cloudPath,
          filePath: path
        })
        fileIDs.push(fileID)
      }

      // 2. 调用分析云函数
      const { result } = await wx.cloud.callFunction({
        name: 'analyzeReport',
        data: { fileIDs }
      })

      wx.hideLoading()

      if (result.success) {
        wx.showToast({ title: '分析完成', icon: 'success' })
        this.setData({ tempImages: [] })
        this.loadReports()

        // 跳转到详情页
        wx.navigateTo({
          url: `/pages/report-detail/report-detail?id=${result.reportId}`
        })
      } else {
        wx.showToast({ title: '分析失败: ' + result.error, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('提交报告失败', err)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      this.setData({ analyzing: false })
    }
  },

  async loadReports() {
    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('reports')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get()

      const reports = data.map(r => {
        const d = r.createdAt ? new Date(r.createdAt) : new Date()
        return {
          ...r,
          dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
      })

      this.setData({ reports })
    } catch (err) {
      console.error('加载报告列表失败', err)
    }
  },

  viewReport(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/report-detail/report-detail?id=${id}`
    })
  }
})
