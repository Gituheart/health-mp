Page({
  data: {
    reportId: '',
    imageUrls: [],
    analysis: '',
    analysisHtml: '',
    loading: true
  },

  onLoad(options) {
    this.setData({ reportId: options.id })
    this.loadReport(options.id)
  },

  async loadReport(id) {
    try {
      const db = wx.cloud.database()
      const { data } = await db.collection('reports').doc(id).get()

      // 获取图片临时链接
      const { fileList } = await wx.cloud.getTempFileURL({
        fileList: data.image_urls
      })
      const imageUrls = fileList.map(f => f.tempFileURL)

      // 简易 markdown 转 HTML（处理标题和加粗）
      const analysisHtml = this.mdToHtml(data.ai_analysis || '')

      this.setData({
        imageUrls,
        analysis: data.ai_analysis,
        analysisHtml,
        loading: false
      })
    } catch (err) {
      console.error('加载报告失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  mdToHtml(md) {
    return md
      .replace(/## (.+)/g, '<div style="font-size:32rpx;font-weight:bold;color:#00E676;margin:24rpx 0 12rpx;">$1</div>')
      .replace(/\*\*(.+?)\*\*/g, '<span style="font-weight:bold;color:#FF8A65;">$1</span>')
      .replace(/\n/g, '<br/>')
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: this.data.imageUrls
    })
  }
})
