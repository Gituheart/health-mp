const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const openid = wxContext.OPENID

  // 查询用户是否已存在
  const { data } = await db.collection('users').where({ openid }).get()

  return {
    openid,
    userInfo: data.length > 0 ? data[0] : null
  }
}
