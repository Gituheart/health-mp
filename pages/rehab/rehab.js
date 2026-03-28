const app = getApp()

const EXERCISES = [
  {
    id: 'slr',
    name: '直腿抬高',
    emoji: '🦵',
    target: '股四头肌强化',
    prescription: '3组 × 15次，每次保持5秒',
    steps: [
      '平躺，腰背贴地，双腿伸直',
      '收紧大腿前侧肌肉，不弯曲膝盖',
      '缓慢抬腿至45°角',
      '保持5秒后缓慢放下',
      '两腿交替进行'
    ],
    caution: '全程不要弯曲膝盖，感到膝盖疼痛立即停止'
  },
  {
    id: 'wall_sit',
    name: '靠墙静蹲',
    emoji: '🧱',
    target: '膝关节稳定性',
    prescription: '3组 × 30~60秒，组间休息1分钟',
    steps: [
      '背靠墙站立，双脚离墙约30cm，与肩同宽',
      '缓慢向下滑动，直到大腿与地面平行（膝盖约90°）',
      '膝盖不超过脚尖，保持背部贴墙',
      '保持30~60秒后缓慢起身'
    ],
    caution: '膝关节疼痛严重时，只做浅蹲（30°~45°）即可'
  },
  {
    id: 'knee_ext',
    name: '坐姿伸膝',
    emoji: '🪑',
    target: '关节活动度',
    prescription: '3组 × 15次，每次保持5秒',
    steps: [
      '坐于椅边，双脚自然垂地',
      '缓慢伸直一侧膝盖至水平位置',
      '保持5秒，感觉大腿前侧轻微发力',
      '缓慢放下，双腿交替进行',
      '动作全程保持缓慢匀速'
    ],
    caution: '不要用力猛伸，感到卡顿或疼痛时停止'
  },
  {
    id: 'ankle_pump',
    name: '踝泵运动',
    emoji: '🦶',
    target: '促进血液循环',
    prescription: '每次20下，每日可多次练习',
    steps: [
      '平躺或坐位，腿部放松伸直',
      '用力将脚尖向上勾，保持2秒',
      '再用力将脚尖向下绷，保持2秒',
      '反复交替进行',
      '随时可做，不受场地限制'
    ],
    caution: '该动作安全性高，术后第一天即可开始'
  }
]

Page({
  data: {
    exercises: EXERCISES.map(e => ({ ...e, done: false, expanded: false })),
    doneCount: 0,
    showDurationPicker: false,
    selectedDuration: 30,
    submitting: false
  },

  toggleExpand(e) {
    const { id } = e.currentTarget.dataset
    const exercises = this.data.exercises.map(ex =>
      ex.id === id ? { ...ex, expanded: !ex.expanded } : ex
    )
    this.setData({ exercises })
  },

  toggleDone(e) {
    const { id } = e.currentTarget.dataset
    const exercises = this.data.exercises.map(ex =>
      ex.id === id ? { ...ex, done: !ex.done } : ex
    )
    const doneCount = exercises.filter(ex => ex.done).length
    this.setData({ exercises, doneCount })
  },

  onSelectDuration(e) {
    this.setData({ selectedDuration: e.currentTarget.dataset.val })
  },

  showPicker() {
    this.setData({ showDurationPicker: true })
  },

  hidePicker() {
    this.setData({ showDurationPicker: false })
  },

  async confirmCheckin() {
    if (this.data.submitting) return
    if (!app.globalData.openid) {
      wx.showToast({ title: '登录中，请稍后重试', icon: 'none' })
      return
    }

    const { selectedDuration } = this.data
    const weight = (app.globalData.userInfo && app.globalData.userInfo.weight) || 60
    const calories = Math.round(2.5 * weight * (selectedDuration / 60))

    this.setData({ submitting: true, showDurationPicker: false })

    try {
      const db = wx.cloud.database()
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      await db.collection('checkins').add({
        data: {
          openid: app.globalData.openid,
          exercise_type: '康复训练',
          met: 2.5,
          duration_min: selectedDuration,
          calories,
          date: dateStr,
          createdAt: db.serverDate()
        }
      })

      wx.showToast({ title: `打卡成功！消耗 ${calories} 千卡`, icon: 'success' })
      const exercises = this.data.exercises.map(ex => ({ ...ex, done: false }))
      this.setData({ exercises, doneCount: 0 })
    } catch (err) {
      console.error('打卡失败', err)
      wx.showToast({ title: '打卡失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
