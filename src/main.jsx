import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

const API_BASE_URL = 'https://www.runninghub.cn/openapi/v2';
const DEFAULT_API_KEY = import.meta.env.RUNNINGHUB_API_KEY || '';

function App() {
  const [apiKey, setApiKey] = useState(() => {
    const stored = localStorage.getItem('runninghub_api_key');
    if (stored) return stored;
    return DEFAULT_API_KEY;
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(!apiKey);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('runninghub_settings');
    return saved ? JSON.parse(saved) : { maxConcurrent: 5 };
  });
  const [prompt, setPrompt] = useState('图片动起来');
  const [duration, setDuration] = useState('10');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [batchSize, setBatchSize] = useState(1);
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('runninghub_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(null);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const pollingRef = useRef(null);
  const taskQueueRef = useRef([]);

  useEffect(() => {
    localStorage.setItem('runninghub_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('runninghub_settings', JSON.stringify(settings));
  }, [settings]);

  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    const key = e.target.apiKey.value.trim();
    
    if (!key) {
      showToast('请输入 API Key');
      return;
    }
    
    if (key.length !== 32) {
      showToast('API Key 必须是 32 位字符');
      return;
    }
    
    setApiKey(key);
    localStorage.setItem('runninghub_api_key', key);
    setShowApiKeyModal(false);
    console.log('API Key 已保存:', key.substring(0, 8) + '...');
    showToast('API Key 已保存');
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    if (!prompt.trim()) {
      showToast('请输入提示词');
      return;
    }

    if (prompt.trim().length < 5) {
      showToast('提示词至少需要 5 个字符');
      return;
    }

    setIsGenerating(true);
    taskQueueRef.current = [];

    for (let i = 0; i < batchSize; i++) {
      taskQueueRef.current.push({
        prompt,
        duration,
        aspectRatio,
        delay: i * 1000
      });
    }

    processTaskQueue();
  };

  const processTaskQueue = () => {
    let completedTasks = 0;
    const totalTasks = taskQueueRef.current.length;

    const processNextTask = () => {
      if (taskQueueRef.current.length === 0) {
        if (completedTasks === totalTasks) {
          setIsGenerating(false);
        }
        return;
      }

      const taskConfig = taskQueueRef.current.shift();
      
      setTimeout(() => {
        createTask(taskConfig);
        completedTasks++;
        processNextTask();
      }, taskConfig.delay);
    };

    processNextTask();
  };

  const createTask = async (taskConfig) => {
    try {
      console.log('开始创建任务，参数:', taskConfig);
      console.log('API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : '未设置');
      
      const requestBody = {
        duration: taskConfig.duration,
        prompt: taskConfig.prompt,
        aspectRatio: taskConfig.aspectRatio,
        storyboard: false
      };
      
      console.log('请求URL:', `${API_BASE_URL}/rhart-video-s/text-to-video`);
      console.log('请求体:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/rhart-video-s/text-to-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000) // 30秒超时
      });

      console.log('响应状态:', response.status, response.statusText);
      console.log('响应头:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP错误响应:', errorText);
        
        let errorMessage = `HTTP错误: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.code === 412 && errorJson.msg === 'TOKEN_INVALID') {
            errorMessage = 'API Key 无效，请检查您的 API Key';
          } else {
            errorMessage = errorJson.msg || errorJson.message || errorJson.errorMessage || errorMessage;
          }
        } catch (e) {
          // 不是JSON格式，使用原始错误文本
          if (errorText) {
            errorMessage = errorText.substring(0, 100);
          }
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('响应数据:', data);

      // 检查是否有错误
      if (data.errorCode && data.errorCode !== '') {
        const errorMsg = data.errorMessage || data.msg || '未知错误';
        
        // 对于 1000 未知错误，建议重试
        if (data.errorCode === '1000') {
          throw new Error(`服务器未知错误 (1000): ${errorMsg}。建议稍后重试。`);
        }
        
        // 对于 1011 系统繁忙，建议重试
        if (data.errorCode === '1011') {
          throw new Error(`系统繁忙 (1011): ${errorMsg}。建议 2-3 分钟后重试。`);
        }
        
        // 其他错误
        throw new Error(`API 错误 (${data.errorCode}): ${errorMsg}`);
      }

      if (!data.taskId) {
        throw new Error('API未返回taskId，响应: ' + JSON.stringify(data));
      }

      const newTask = {
        taskId: data.taskId,
        status: data.status || 'RUNNING',
        prompt: taskConfig.prompt,
        duration: taskConfig.duration,
        aspectRatio: taskConfig.aspectRatio,
        createdAt: new Date().toISOString(),
        type: 'video',
        progress: data.status === 'SUCCESS' ? 100 : 0,
        resultUrl: null,
        previewUrl: null,
        retryCount: 0,
        retryDelay: 0
      };

      setTasks(prev => [newTask, ...prev]);
      showToast(`任务创建成功！TaskID: ${data.taskId}`);
      pollTaskStatus(newTask.taskId);

    } catch (error) {
      console.error('创建任务失败:', error);
      
      let errorMsg = error.message;
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMsg = '网络连接失败，请检查网络或API地址是否正确';
      } else if (error.message.includes('401')) {
        errorMsg = 'API Key 无效或已过期';
      } else if (error.message.includes('403')) {
        errorMsg = 'API Key 权限不足';
      } else if (error.message.includes('1000')) {
        errorMsg = '服务器未知错误，请稍后重试（可能是临时性问题）';
      } else if (error.message.includes('1011')) {
        errorMsg = '系统负载较高，建议 2-3 分钟后重试';
      }
      
      showToast(`创建任务失败: ${errorMsg}`);
      
      if (taskQueueRef.current.length === 0) {
        setIsGenerating(false);
      }
    }
  };

  const pollTaskStatus = async (taskId) => {
    let retryCount = 0;
    const maxRetries = 3;
    const poll = async () => {
      try {
        console.log(`查询任务状态: ${taskId}, 第${retryCount + 1}次查询`);
        
        const response = await fetch(`${API_BASE_URL}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ taskId }),
          signal: AbortSignal.timeout(15000) // 15秒超时
        });

        console.log(`任务 ${taskId} 查询响应状态:`, response.status);

        if (!response.ok) {
          if (response.status === 0 || !response.ok) {
            retryCount++;
            console.log(`任务 ${taskId} 网络错误，准备第${retryCount}次重试`);
            
            if (retryCount <= maxRetries) {
              const delay = Math.pow(2, retryCount - 1) * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
              return poll();
            }
            throw new Error('网络中断，已达到最大重试次数');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`任务 ${taskId} 响应数据:`, data);

        setTasks(prev => prev.map(task => {
          if (task.taskId === taskId) {
            const updatedTask = { ...task, status: data.status, retryCount: 0 };

            if (data.status === 'SUCCESS') {
              updatedTask.progress = 99;
              updatedTask.status = '获取结果中...';
              fetchTaskResult(taskId);
            } else if (data.status === 'FAILED') {
              updatedTask.progress = 0;
            }

            return updatedTask;
          }
          return task;
        }));

        if (data.status === 'RUNNING' || data.status === 'QUEUED') {
          console.log(`任务 ${taskId} 状态为 ${data.status}，5秒后继续轮询`);
          setTimeout(poll, 5000);
        }

      } catch (error) {
        console.error(`任务 ${taskId} 查询失败:`, error);
        
        setTasks(prev => prev.map(task => {
          if (task.taskId === taskId) {
            return {
              ...task,
              status: '网络中断，正在重试...',
              retryCount: retryCount
            };
          }
          return task;
        }));

        retryCount++;
        if (retryCount <= maxRetries) {
          const delay = Math.pow(2, retryCount - 1) * 1000;
          console.log(`任务 ${taskId} 将在 ${delay}ms 后重试`);
          setTimeout(poll, delay);
        } else {
          setTasks(prev => prev.map(task => {
            if (task.taskId === taskId) {
              return { ...task, status: 'FAILED', retryCount: 0 };
            }
            return task;
          }));
        }
      }
    };

    poll();
  };

  const fetchTaskResult = async (taskId) => {
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 3000;

    const fetchResult = async () => {
      try {
        console.log(`获取任务 ${taskId} 结果，第${retryCount + 1}次尝试`);
        
        const response = await fetch(`${API_BASE_URL}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ taskId })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`任务 ${taskId} 结果数据:`, data);

        if (data.status === 'SUCCESS' && data.results && data.results.length > 0) {
          const videoUrl = data.results[0].url;
          console.log(`任务 ${taskId} 成功获取视频URL:`, videoUrl);
          
          // 提取视频第一帧作为预览图
          extractVideoThumbnail(videoUrl).then(thumbnailUrl => {
            setTasks(prev => prev.map(task => {
              if (task.taskId === taskId) {
                return {
                  ...task,
                  status: 'SUCCESS',
                  progress: 100,
                  resultUrl: videoUrl,
                  previewUrl: thumbnailUrl
                };
              }
              return task;
            }));
            
            showToast(`视频生成成功！TaskID: ${taskId}`);
          });
        } else if (data.status === 'FAILED' || (data.status === 'SUCCESS' && (!data.results || data.results.length === 0))) {
          console.log(`任务 ${taskId} 失败，结果未准备好，重试中...`);
          throw new Error('NOT_FOUND');
        } else {
          retryCount++;
          console.log(`任务 ${taskId} 结果未准备好，${retryDelay/1000}秒后第${retryCount + 1}次重试`);
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchResult();
          }
          throw new Error('获取结果超时');
        }

      } catch (error) {
        if (error.message === 'NOT_FOUND') {
          retryCount++;
          console.log(`任务 ${taskId} NOT_FOUND 错误，${retryDelay/1000}秒后第${retryCount + 1}次重试`);
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return fetchResult();
          }
        }
        
        console.error(`任务 ${taskId} 获取结果失败:`, error);
        
        setTasks(prev => prev.map(task => {
          if (task.taskId === taskId) {
            return {
              ...task,
              status: 'FAILED',
              progress: 0
            };
          }
          return task;
        }));
        
        showToast(`任务 ${taskId} 失败: ${error.message}`);
      }
    };

    fetchResult();
  };

  const handleClone = (task) => {
    setPrompt(task.prompt);
    setDuration(task.duration);
    setAspectRatio(task.aspectRatio);
    showToast('已克隆提示词，可以点击"生成视频"');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const extractVideoThumbnail = async (videoUrl) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      
      video.addEventListener('loadedmetadata', () => {
        video.currentTime = 0.1;
      });
      
      video.addEventListener('seeked', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      });
      
      video.addEventListener('error', () => {
        resolve(null);
      });
    });
  };

  const handleDownload = async (url, taskId) => {
    const downloadBtn = document.querySelector(`[data-download="${taskId}"]`);
    if (downloadBtn) {
      downloadBtn.textContent = '下载中...';
      downloadBtn.disabled = true;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('下载失败');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `video_${taskId}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      window.URL.revokeObjectURL(blobUrl);
      
      showToast('下载成功');
    } catch (error) {
      console.error('下载失败:', error);
      showToast('下载失败，请重试');
      
      window.open(url, '_blank');
    } finally {
      if (downloadBtn) {
        downloadBtn.textContent = '下载';
        downloadBtn.disabled = false;
      }
    }
  };

  const handleDelete = (taskId) => {
    if (confirm('确定要删除这个任务吗？')) {
      setTasks(prev => prev.filter(task => task.taskId !== taskId));
    }
  };

  const handlePlayVideo = (url) => {
    setCurrentVideoUrl(url);
    setShowVideoModal(true);
  };

  const getChangelog = () => {
    const changes = [
      {
        version: 'v1.2.0',
        date: '2026-02-20',
        changes: [
          '✨ 新增：支持从 GitHub Secrets 读取 API Key',
          '✨ 新增：添加历史更改信息查看功能',
          '🐛 修复：视频预览图不显示问题',
          '🐛 修复：旧视频无法生成预览图问题',
          '🐛 修复：视频元素语法错误'
        ]
      },
      {
        version: 'v1.1.0',
        date: '2026-02-19',
        changes: [
          '✨ 新增：批量生产功能（1/3/5/10个）',
          '✨ 新增：克隆任务功能',
          '✨ 新增：进度条显示',
          '✨ 新增：最大并发数配置',
          '🐛 修复：网络错误自动重试机制'
        ]
      },
      {
        version: 'v1.0.0',
        date: '2026-02-18',
        changes: [
          '🎉 初始版本发布',
          '✨ 文生视频功能',
          '✨ 支持选择时长（10s/15s）',
          '✨ 支持画面比例（9:16/16:9）',
          '✨ 历史记录管理',
          '✨ 视频下载功能',
          '🔑 API Key 配置'
        ]
      }
    ];
    return changes;
  };

  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTaskStatusClass = (status) => {
    const s = status.toLowerCase();
    if (s === 'running' || s === 'queued' || s.includes('retry')) return 'retry';
    if (s === 'success' || s === '获取结果中') return 'success';
    if (s === 'failed') return 'failed';
    return 'running';
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">文生视频</div>
          <div className="header-actions">
            <button className="btn btn-secondary btn-small" onClick={() => setShowChangelogModal(true)}>
              📝 更新日志
            </button>
            <button className="btn btn-secondary btn-small" onClick={() => setShowSettingsModal(true)}>
              ⚙️ 设置
            </button>
            <button className="btn btn-small" onClick={() => setShowApiKeyModal(true)}>
              🔑 API Key
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <section className="card" style={{ marginBottom: '2rem' }}>
            <h2 className="section-title">生成视频</h2>
            <div className="form-group">
              <label className="label">提示词</label>
              <textarea
                className="input textarea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你想要生成的视频内容..."
                maxLength="4000"
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="label">时长</label>
                <select 
                  className="input select"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="10">10秒</option>
                  <option value="15">15秒</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="label">画面比例</label>
                <select 
                  className="input select"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                >
                  <option value="9:16">竖屏 (9:16)</option>
                  <option value="16:9">横屏 (16:9)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">批量生产</label>
                <select 
                  className="input select"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                >
                  <option value="1">1个</option>
                  <option value="3">3个</option>
                  <option value="5">5个</option>
                  <option value="10">10个</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: '0 0 auto' }}>
                <button 
                  className="btn"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  style={{ minWidth: '120px' }}
                >
                  {isGenerating ? '生成中...' : '生成视频'}
                </button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="section-title">历史记录 ({tasks.length})</h2>
            {tasks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>暂无生成的视频</p>
              </div>
            ) : (
              <div className="task-grid">
                {tasks.map(task => (
                  <div key={task.taskId} className="task-card">
                    <div 
                      className="task-preview"
                      onClick={task.resultUrl ? () => handlePlayVideo(task.resultUrl) : undefined}
                      style={task.resultUrl ? { cursor: 'pointer' } : {}}
                    >
                      {task.resultUrl ? (
                        <>
                          <video 
                            src={task.resultUrl}
                            muted
                            preload="auto"
                            style={{ display: task.previewUrl ? 'none' : 'block', opacity: task.previewUrl ? 0 : 1 }}
                            onLoadedData={(e) => {
                              const video = e.target;
                              if (video.readyState >= 2 && !task.previewUrl) {
                                try {
                                  video.currentTime = 0.1;
                                } catch (err) {
                                  console.error('Seek failed:', err);
                                }
                              }
                            }}
                            onSeeked={(e) => {
                              const video = e.target;
                              if (!task.previewUrl && Math.abs(video.currentTime - 0.1) < 0.2) {
                                try {
                                  const canvas = document.createElement('canvas');
                                  canvas.width = video.videoWidth || 720;
                                  canvas.height = video.videoHeight || 1280;
                                  const ctx = canvas.getContext('2d');
                                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                  const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
                                  setTasks(prev => prev.map(t => 
                                    t.taskId === task.taskId 
                                      ? { ...t, previewUrl: thumbnail }
                                      : t
                                  ));
                                } catch (err) {
                                  console.error('生成预览图失败:', err);
                                }
                              }
                            }}
                          />
                          {task.previewUrl && (
                            <img 
                              src={task.previewUrl}
                              alt={task.prompt}
                              style={{ display: 'block' }}
                            />
                          )}
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(0,0,0,0.6)',
                            borderRadius: '50%',
                            width: '50px',
                            height: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '1.5rem'
                          }}>
                            ▶
                          </div>
                        </>
                      ) : (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center',
                          color: 'var(--text-secondary)'
                        }}>
                          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                          <p>{task.status}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="task-info">
                      <span className="task-badge video">文生视频</span>
                      <div className="task-id">TaskID: {task.taskId}</div>
                      <div className="task-prompt" title={task.prompt}>{task.prompt}</div>
                      <div className="task-meta">
                        <span className={`task-status ${getTaskStatusClass(task.status)}`}>
                          {task.status}
                        </span>
                        <span className="task-time">
                          🕐 {formatDate(task.createdAt)}
                        </span>
                      </div>
                      
                      {task.progress > 0 && task.progress < 100 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: 'var(--text-secondary)', 
                            marginTop: '0.25rem' 
                          }}>
                            {task.progress}%
                          </div>
                        </div>
                      )}
                      
                      <div className="task-actions">
                        {task.resultUrl && (
                          <>
                            <button 
                              className="btn btn-small"
                              onClick={() => handleClone(task)}
                              title="克隆此任务的提示词"
                            >
                              克隆
                            </button>
                            <button 
                              className="btn btn-secondary btn-small"
                              data-download={task.taskId}
                              onClick={() => handleDownload(task.resultUrl, task.taskId)}
                            >
                              下载
                            </button>
                          </>
                        )}
                        <button 
                          className="btn btn-secondary btn-small btn-icon"
                          onClick={() => handleDelete(task.taskId)}
                          title="删除"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {showApiKeyModal && (
        <div className="modal" onClick={() => !apiKey && setShowApiKeyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-header">配置 API Key</h2>
            <form onSubmit={handleApiKeySubmit}>
      <div className="form-group">
        <label className="label">RunningHub API Key</label>
        <input 
          className="input"
          type="text"
          name="apiKey"
          defaultValue={apiKey}
          placeholder="请输入您的 32 位 API Key"
          autoFocus
          style={{ fontFamily: 'monospace' }}
        />
        <div className="hint" style={{ marginTop: '0.5rem' }}>
          <strong>获取 API Key 步骤：</strong><br/>
          1. 访问 RunningHub 网站并登录<br/>
          2. 充值钱包余额<br/>
          3. 在个人中心获取 32 位 API Key<br/>
          4. 确保使用的是企业级共享 API Key
        </div>
        <div className="hint" style={{ marginTop: '0.5rem', color: 'var(--warning-color)' }}>
          ⚠️ 注意：API Key 必须是 32 位字符
        </div>
      </div>
              <div className="modal-footer">
                <button type="submit" className="btn">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChangelogModal && (
        <div className="modal" onClick={() => setShowChangelogModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh' }}>
            <h2 className="modal-header">📝 更新日志</h2>
            <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              {getChangelog().map((item, index) => (
                <div key={index} style={{ marginBottom: '1.5rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.75rem' 
                  }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                      {item.version}
                    </h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {item.date}
                    </span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {item.changes.map((change, idx) => (
                      <li key={idx} style={{ 
                        padding: '0.5rem 0', 
                        borderBottom: index < getChangelog().length - 1 || idx < item.changes.length - 1 
                          ? '1px solid var(--border-color)' 
                          : 'none',
                        fontSize: '0.9rem',
                        lineHeight: 1.6
                      }}>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setShowChangelogModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="modal" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-header">设置</h2>
            
            <div className="settings-item">
              <div>
                <div style={{ fontWeight: 500 }}>最大并发数量</div>
                <div className="hint">同时运行的最大任务数量</div>
              </div>
              <div className="radio-group">
                <label className="radio-label">
                  <input 
                    type="radio"
                    name="maxConcurrent"
                    checked={settings.maxConcurrent === 5}
                    onChange={() => setSettings({ ...settings, maxConcurrent: 5 })}
                  />
                  5
                </label>
                <label className="radio-label">
                  <input 
                    type="radio"
                    name="maxConcurrent"
                    checked={settings.maxConcurrent === 50}
                    onChange={() => setSettings({ ...settings, maxConcurrent: 50 })}
                  />
                  50
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowSettingsModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showVideoModal && currentVideoUrl && (
        <div className="video-player-modal" onClick={() => setShowVideoModal(false)}>
          <button className="close-btn" onClick={() => setShowVideoModal(false)}>×</button>
          <div className="video-player-content" onClick={e => e.stopPropagation()}>
            <video 
              src={currentVideoUrl}
              controls
              autoPlay
              style={{ maxHeight: '80vh' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
