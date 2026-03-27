const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  if (action === 'create') {
    // 发起 PK
    const { type } = event // 'week' or 'month'
    const now = new Date()
    let startDate, endDate

    if (type === 'week') {
      const day = now.getDay()
      const diff = day === 0 ? -6 : 1 - day
      startDate = new Date(now)
      startDate.setDate(now.getDate() + diff)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 6)
      endDate.setHours(23, 59, 59, 999)
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    }

    const formatDate = (d) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const { _id } = await db.collection('pk_challenges').add({
      data: {
        challenger_id: openid,
        opponent_id: null,
        type,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        status: 'pending',
        createdAt: db.serverDate()
      }
    })

    return { success: true, pkId: _id }
  }

  if (action === 'join') {
    // 接受 PK
    const { pkId } = event
    const { data: pk } = await db.collection('pk_challenges').doc(pkId).get()

    if (pk.status !== 'pending') {
      return { success: false, error: '该 PK 已被接受或已结束' }
    }
    if (pk.challenger_id === openid) {
      return { success: false, error: '不能和自己 PK' }
    }

    await db.collection('pk_challenges').doc(pkId).update({
      data: {
        opponent_id: openid,
        status: 'active'
      }
    })

    return { success: true }
  }

  if (action === 'getData') {
    // 获取 PK 双方数据
    const { pkId } = event
    const { data: pk } = await db.collection('pk_challenges').doc(pkId).get()

    const getCalories = async (uid, startDate, endDate) => {
      const { data } = await db.collection('checkins')
        .where({
          _openid: uid,
          date: _.gte(startDate).and(_.lte(endDate))
        })
        .get()
      return data.reduce((sum, r) => sum + r.calories, 0)
    }

    const getUserInfo = async (uid) => {
      const { data } = await db.collection('users').where({ openid: uid }).get()
      return data[0] || { nickname: '未知用户' }
    }

    const [challengerCal, opponentCal, challengerInfo, opponentInfo] = await Promise.all([
      getCalories(pk.challenger_id, pk.start_date, pk.end_date),
      pk.opponent_id ? getCalories(pk.opponent_id, pk.start_date, pk.end_date) : 0,
      getUserInfo(pk.challenger_id),
      pk.opponent_id ? getUserInfo(pk.opponent_id) : { nickname: '等待加入...' }
    ])

    return {
      success: true,
      pk,
      challenger: { ...challengerInfo, calories: challengerCal, healthIndex: Math.floor(challengerCal / 100) },
      opponent: { ...opponentInfo, calories: opponentCal, healthIndex: Math.floor(opponentCal / 100) }
    }
  }

  return { success: false, error: '未知操作' }
}
