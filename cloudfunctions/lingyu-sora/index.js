// 灵域AI API配置
const LINGYU_API_BASE_URL = 'https://api.ai6700.com/api';

exports.main = async (event, context) => {
  const { action, data, apiKey } = event;

  if (!apiKey) {
    return { success: false, error: '缺少API Key' };
  }

  try {
    if (action === 'create') {
      // 创建视频任务
      console.log('开始创建灵域AI视频任务...');
      console.log('Model:', data.model || 'kling-v3-omni');
      console.log('Prompt:', data.prompt);
      console.log('Params:', JSON.stringify(data.params || {}));
      
      const requestBody = {
        model: data.model || 'kling-v3-omni',  // 默认使用可灵视频模型
        prompt: data.prompt,
        params: data.params || {}
      };
      
      console.log('请求体:', JSON.stringify(requestBody));
      
      const response = await fetch(`${LINGYU_API_BASE_URL}/v1/media/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('响应状态:', response.status);
      
      const responseText = await response.text();
      console.log('响应内容:', responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP错误 ${response.status}: ${responseText}`);
      }

      const result = JSON.parse(responseText);
      console.log('解析结果:', JSON.stringify(result));
      
      // 检查API返回的错误
      if (result.code !== 200) {
        throw new Error(result.msg || 'API返回错误: ' + JSON.stringify(result));
      }
      
      return { 
        success: true, 
        data: result.data,
        raw: result
      };

    } else if (action === 'status') {
      // 查询任务状态
      console.log('查询任务状态:', data.taskId);
      
      const response = await fetch(`${LINGYU_API_BASE_URL}/v1/skills/task-status?task_id=${data.taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      const responseText = await response.text();
      console.log('状态查询响应:', responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP错误 ${response.status}: ${responseText}`);
      }

      const result = JSON.parse(responseText);
      return { success: true, data: result.data, raw: result };

    } else if (action === 'balance') {
      // 查询账户余额
      console.log('查询账户余额...');
      
      const response = await fetch(`${LINGYU_API_BASE_URL}/v1/skills/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      const responseText = await response.text();
      console.log('余额查询响应:', responseText);
      
      if (!response.ok) {
        throw new Error(`HTTP错误 ${response.status}: ${responseText}`);
      }

      const result = JSON.parse(responseText);
      return { success: true, data: result, raw: result };

    } else if (action === 'models') {
      // 获取视频模型列表
      console.log('获取视频模型列表...');
      
      const response = await fetch(`${LINGYU_API_BASE_URL}/v1/skills/models?type=video`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        throw new Error(`HTTP错误 ${response.status}: ${responseText}`);
      }

      const result = JSON.parse(responseText);
      return { success: true, data: result.models, raw: result };

    } else {
      return { success: false, error: '未知操作: ' + action };
    }
  } catch (error) {
    console.error('灵域AI API调用失败:', error);
    return { success: false, error: error.message, stack: error.stack };
  }
};
