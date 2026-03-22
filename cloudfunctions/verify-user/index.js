// 验证用户登录云函数
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { username, password } = event;

  try {
    // 查询用户
    const result = await db.collection('users')
      .where({
        username: username
      })
      .get();

    if (result.data && result.data.length > 0) {
      const user = result.data[0];

      // 验证密码
      if (user.password === password) {
        return {
          success: true,
          message: '登录成功',
          user: {
            _openid: user._openid,
            username: user.username,
            password: user.password // 注意：生产环境不应返回密码
          }
        };
      } else {
        return {
          success: false,
          message: '密码错误'
        };
      }
    } else {
      return {
        success: false,
        message: '用户不存在'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: '查询失败: ' + error.message
    };
  }
};
