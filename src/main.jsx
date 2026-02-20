import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import cloudbase from '@cloudbase/js-sdk';
import './index.css';

const API_BASE_URL = 'https://www.runninghub.cn/openapi/v2';
const DEFAULT_API_KEY = import.meta.env.RUNNINGHUB_API_KEY || '';
const CLOUDBASE_ENV = 'ai-rh202602-4g44noj4b1870204';

// 初始化 CloudBase
const app = cloudbase.init({
  env: CLOUDBASE_ENV,
});
const db = app.database();
const auth = app.auth();

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
  // 文生视频状态
  const [prompt, setPrompt] = useState('图片动起来');
  const [duration, setDuration] = useState('10');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [batchSize, setBatchSize] = useState(1);
  
  // 图生视频状态
  const [imagePrompt, setImagePrompt] = useState('图片动起来');
  const [imageDuration, setImageDuration] = useState('10');
  const [imageAspectRatio, setImageAspectRatio] = useState('9:16');
  const [imageBatchSize, setImageBatchSize] = useState(1);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingImageVideo, setIsGeneratingImageVideo] = useState(false);
  const [showImageSavedPrompts, setShowImageSavedPrompts] = useState(false);

  // 图生图状态
  const [editPrompt, setEditPrompt] = useState('基于原图风格');
  const [editResolution, setEditResolution] = useState('1k');
  const [editAspectRatio, setEditAspectRatio] = useState('1:1');
  const [editBatchSize, setEditBatchSize] = useState(1);
  const [editImageFiles, setEditImageFiles] = useState([]);
  const [editImageUrls, setEditImageUrls] = useState([]);
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
  const [isGeneratingEditImage, setIsGeneratingEditImage] = useState(false);
  const [showEditSavedPrompts, setShowEditSavedPrompts] = useState(false);
  const [editTasks, setEditTasks] = useState([]);
  const [editTasksLoaded, setEditTasksLoaded] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState(null);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showSavedPrompts, setShowSavedPrompts] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState([]);
  
  // CloudBase 状态
  const [cloudUser, setCloudUser] = useState(null);
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // 导入导出状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTaskIds, setImportTaskIds] = useState('');
  const [importPrompt, setImportPrompt] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [exporting, setExporting] = useState(false);

  // 主题状态
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app_theme');
    return saved || 'light';
  });

  // 应用主题
  // 左侧主Tab状态（视频生成/图片生成）
  const [leftMainTab, setLeftMainTab] = useState('video');

  // 视频生成Tab下的功能选择
  const [videoFunction, setVideoFunction] = useState('text-to-video'); // text-to-video | image-to-video

  // 图片生成Tab下的功能选择
  const [imageFunction, setImageFunction] = useState('image-to-image'); // image-to-image

  // 右侧历史记录Tab状态
  const [rightTab, setRightTab] = useState('all'); // all | video | image

  // 其他状态...
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // 切换主题
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const pollingRef = useRef(null);
  const taskQueueRef = useRef([]);

  const APP_VERSION = 'v1.7.0';
  const LAST_DEPLOY_TIME = '2026-02-20 16:00';

  // CloudBase 匿名登录并加载数据
  useEffect(() => {
    const initCloudBase = async () => {
      try {
        const loginState = await auth.getLoginState();
        if (loginState) {
          const user = await auth.getCurrentUser();
          setCloudUser(user);
          console.log('CloudBase 已登录:', user?.uid);
          // 登录后自动加载云端任务和提示词
          await loadTasksFromCloud(user);
          await loadSavedPromptsFromCloud(user);
          await loadEditTasksFromCloud(user);
        } else {
          await auth.signInAnonymously();
          const user = await auth.getCurrentUser();
          setCloudUser(user);
          console.log('CloudBase 匿名登录成功:', user?.uid);
          // 登录后自动加载云端任务和提示词
          await loadTasksFromCloud(user);
          await loadSavedPromptsFromCloud(user);
          await loadEditTasksFromCloud(user);
        }
      } catch (error) {
        console.error('CloudBase 登录失败:', error);
      }
    };
    initCloudBase();
  }, []);

  // 从云端加载任务
  const loadTasksFromCloud = async (user = cloudUser) => {
    if (!user) {
      console.log('CloudBase 用户未登录');
      return;
    }
    
    setIsLoadingFromCloud(true);
    try {
      const result = await db.collection('video_tasks')
        .where({ _openid: user.uid })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      
      if (result.data && result.data.length > 0) {
        console.log(`从云端获取到 ${result.data.length} 条记录`);
        
        // 直接使用云端数据,并去重(相同 taskId 只保留一个)
        const taskMap = new Map();
        const cloudTasks = result.data.map(doc => {
          const task = {
            ...doc,
            _id: undefined, // 移除 CloudBase 的 _id
          };
          console.log(`云端任务 ${task.taskId} 的提示词:`, task.prompt);
          return task;
        });
        
        // 去重:相同 taskId 的任务,保留最新的一个
        cloudTasks.forEach(task => {
          if (!taskMap.has(task.taskId)) {
            taskMap.set(task.taskId, task);
          }
        });
        
        const uniqueTasks = Array.from(taskMap.values());
        console.log(`去重后有 ${uniqueTasks.length} 条记录`);
        
        setTasks(uniqueTasks);
        setTasksLoaded(true);
        setLastSyncTime(new Date().toLocaleString('zh-CN'));
        
        if (tasksLoaded) {
          showToast(`已从云端加载 ${uniqueTasks.length} 条记录`);
        }
      } else {
        console.log('云端暂无数据');
        setTasks([]);
        setTasksLoaded(true);
      }
    } catch (error) {
      console.error('加载云端数据失败:', error);
      setTasksLoaded(true);
      if (tasksLoaded) {
        showToast('加载云端数据失败');
      }
    } finally {
      setIsLoadingFromCloud(false);
    }
  };

  // 同步任务到云端（已废弃，任务自动保存到云端）
  const syncTasksToCloud = async () => {
    showToast('任务已自动保存到云端，无需手动同步');
  };

  // 保存单个任务到云端
  const saveTaskToCloud = async (task) => {
    if (!cloudUser) return;
    
    try {
      const taskData = {
        ...task,
        _openid: cloudUser.uid,
        syncedAt: new Date().toISOString()
      };
      
      console.log(`准备同步任务到云端 ${task.taskId}, 包含字段:`, Object.keys(taskData));
      console.log(`任务提示词:`, taskData.prompt);
      
      const existing = await db.collection('video_tasks')
        .where({ taskId: task.taskId })
        .get();
      
      if (existing.data && existing.data.length > 0) {
        await db.collection('video_tasks')
          .doc(existing.data[0]._id)
          .update(taskData);
        console.log(`任务 ${task.taskId} 已更新到云端`);
      } else {
        await db.collection('video_tasks').add(taskData);
        console.log(`任务 ${task.taskId} 已新增到云端`);
      }
    } catch (error) {
      console.error('保存任务到云端失败:', error);
    }
  };

  // 删除云端任务
  const deleteTaskFromCloud = async (taskId) => {
    if (!cloudUser) return;
    
    try {
      const existing = await db.collection('video_tasks')
        .where({ taskId: taskId })
        .get();
      
      if (existing.data && existing.data.length > 0) {
        await db.collection('video_tasks')
          .doc(existing.data[0]._id)
          .remove();
        console.log('任务已从云端删除:', taskId);
      }
    } catch (error) {
      console.error('删除云端任务失败:', error);
    }
  };

  // 从云端加载保存的提示词
  const loadSavedPromptsFromCloud = async (user = cloudUser) => {
    if (!user) {
      console.log('CloudBase 用户未登录');
      return;
    }
    
    try {
      const result = await db.collection('saved_prompts')
        .where({ _openid: user.uid })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      
      if (result.data && result.data.length > 0) {
        console.log(`从云端获取到 ${result.data.length} 条保存的提示词`);
        
        const cloudPrompts = result.data.map(doc => ({
          ...doc,
          _id: undefined,
          _openid: undefined
        }));
        
        setSavedPrompts(cloudPrompts);
        console.log(`已加载 ${cloudPrompts.length} 条保存的提示词`);
      } else {
        console.log('云端暂无保存的提示词');
        setSavedPrompts([]);
      }
    } catch (error) {
      console.error('加载云端提示词失败:', error);
    }
  };

  // 保存提示词到云端
  const savePromptToCloud = async (prompt) => {
    if (!cloudUser) return;
    
    try {
      const promptData = {
        ...prompt,
        _openid: cloudUser.uid,
        syncedAt: new Date().toISOString()
      };
      
      const existing = await db.collection('saved_prompts')
        .where({ id: prompt.id })
        .get();
      
      if (existing.data && existing.data.length > 0) {
        await db.collection('saved_prompts')
          .doc(existing.data[0]._id)
          .update(promptData);
        console.log(`提示词已更新到云端`);
      } else {
        await db.collection('saved_prompts').add(promptData);
        console.log(`提示词已保存到云端`);
      }
    } catch (error) {
      console.error('保存提示词到云端失败:', error);
    }
  };

  // 删除云端的提示词
  const deletePromptFromCloud = async (id) => {
    if (!cloudUser) return;
    
    try {
      const existing = await db.collection('saved_prompts')
        .where({ id: id })
        .get();
      
      if (existing.data && existing.data.length > 0) {
        await db.collection('saved_prompts')
          .doc(existing.data[0]._id)
          .remove();
        console.log('提示词已从云端删除');
      }
    } catch (error) {
      console.error('删除云端提示词失败:', error);
    }
  };

  // ==================== 图生图模块函数 ====================

  // 从云端加载图生图任务
  const loadEditTasksFromCloud = async (user = cloudUser) => {
    if (!user) {
      console.log('CloudBase 用户未登录');
      return;
    }

    try {
      const result = await db.collection('edit_tasks')
        .where({ _openid: user.uid })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      if (result.data && result.data.length > 0) {
        const taskMap = new Map();
        const cloudTasks = result.data.map(doc => ({
          ...doc,
          _id: undefined,
        }));

        cloudTasks.forEach(task => {
          if (!taskMap.has(task.taskId)) {
            taskMap.set(task.taskId, task);
          }
        });

        const uniqueTasks = Array.from(taskMap.values());
        setEditTasks(uniqueTasks);
        setEditTasksLoaded(true);
      } else {
        setEditTasks([]);
        setEditTasksLoaded(true);
      }
    } catch (error) {
      console.error('加载图生图任务失败:', error);
      setEditTasksLoaded(true);
    }
  };

  // 保存图生图任务到云端
  const saveEditTaskToCloud = async (task) => {
    if (!cloudUser) return;
    try {
      const taskData = {
        ...task,
        _openid: cloudUser.uid,
        syncedAt: new Date().toISOString()
      };

      const existing = await db.collection('edit_tasks')
        .where({ taskId: task.taskId })
        .get();

      if (existing.data && existing.data.length > 0) {
        await db.collection('edit_tasks')
          .doc(existing.data[0]._id)
          .update(taskData);
      } else {
        await db.collection('edit_tasks').add(taskData);
      }
    } catch (error) {
      console.error('保存图生图任务失败:', error);
    }
  };

  // 从云端删除图生图任务
  const deleteEditTaskFromCloud = async (taskId) => {
    if (!cloudUser) return;
    try {
      const existing = await db.collection('edit_tasks')
        .where({ taskId: taskId })
        .get();

      if (existing.data && existing.data.length > 0) {
        await db.collection('edit_tasks')
          .doc(existing.data[0]._id)
          .remove();
      }
    } catch (error) {
      console.error('删除图生图任务失败:', error);
    }
  };

  // 上传多张图片到 RunningHub
  const uploadEditImagesToRunningHub = async (files) => {
    const uploadPromises = files.map(file => {
      const formData = new FormData();
      formData.append('file', file);

      return fetch(`${API_BASE_URL}/media/upload/binary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
        signal: AbortSignal.timeout(60000)
      }).then(response => {
        if (!response.ok) {
          throw new Error(`上传失败: ${response.status}`);
        }
        return response.json();
      }).then(data => {
        if (data.code !== 0) {
          throw new Error(data.message || '上传失败');
        }
        return data.data.download_url;
      });
    });

    return Promise.all(uploadPromises);
  };

  // 创建图生图任务
  const createEditTask = async (taskConfig) => {
    try {
      const requestBody = {
        imageUrls: taskConfig.imageUrls,
        prompt: taskConfig.prompt,
        resolution: taskConfig.resolution,
        aspectRatio: taskConfig.aspectRatio
      };

      const response = await fetch(`${API_BASE_URL}/rhart-image-n-pro/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP错误: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.msg || errorJson.message || errorJson.errorMessage || errorMessage;
        } catch (e) {
          if (errorText) errorMessage = errorText.substring(0, 100);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.errorCode && data.errorCode !== '') {
        throw new Error(`API 错误 (${data.errorCode}): ${data.errorMessage || '未知错误'}`);
      }

      if (!data.taskId) {
        throw new Error('API未返回taskId');
      }

      const newTask = {
        taskId: data.taskId,
        status: data.status || 'RUNNING',
        prompt: taskConfig.prompt,
        resolution: taskConfig.resolution,
        aspectRatio: taskConfig.aspectRatio,
        type: 'image-to-image',
        imageUrls: taskConfig.imageUrls,
        imageCount: taskConfig.imageUrls.length,
        createdAt: new Date().toISOString(),
        progress: 0,
        resultUrl: null,
        retryCount: 0
      };

      setEditTasks(prev => [newTask, ...prev]);
      await saveEditTaskToCloud(newTask);
      showToast(`图生图任务创建成功！TaskID: ${data.taskId}`);
      pollEditTaskStatus(newTask.taskId);

    } catch (error) {
      console.error('创建图生图任务失败:', error);
      showToast(`任务创建失败: ${error.message}`);
      if (editTaskQueueRef.current.length === 0) {
        setIsGeneratingEditImage(false);
      }
    }
  };

  const editTaskQueueRef = useRef([]);

  // 轮询图生图任务状态
  const pollEditTaskStatus = async (taskId) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ taskId }),
          signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) throw new Error('查询失败');

        const data = await response.json();
        const task = editTasks.find(t => t.taskId === taskId);
        if (!task) return;

        const progress = data.status === 'SUCCESS' ? 100 : data.status === 'RUNNING' ? 50 : 0;

        setEditTasks(prev => prev.map(t =>
          t.taskId === taskId
            ? { ...t, status: data.status, progress, retryCount: 0 }
            : t
        ));

        if (data.status === 'SUCCESS' && data.results && data.results.length > 0) {
          const resultUrl = data.results[0].url;
          setEditTasks(prev => prev.map(t =>
            t.taskId === taskId
              ? { ...t, resultUrl, progress: 100 }
              : t
          ));
          await saveEditTaskToCloud({ ...task, status: 'SUCCESS', resultUrl, progress: 100 });
          showToast('图生图生成完成！');
        } else if (data.status === 'FAILED') {
          showToast(`图生图任务失败: ${data.errorMessage || '未知错误'}`);
        } else {
          setTimeout(poll, 3000);
        }
      } catch (error) {
        const task = editTasks.find(t => t.taskId === taskId);
        if (task && task.retryCount < 3) {
          setEditTasks(prev => prev.map(t =>
            t.taskId === taskId ? { ...t, retryCount: t.retryCount + 1 } : t
          ));
          setTimeout(poll, 3000);
        }
      }
    };
    poll();
  };

  // 处理图生图生成
  const handleGenerateEditImage = async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    if (editImageFiles.length === 0) {
      showToast('请先选择图片');
      return;
    }

    if (!editPrompt.trim()) {
      showToast('请输入提示词');
      return;
    }

    if (editImageFiles.length > 10) {
      showToast('最多支持10张图片');
      return;
    }

    setIsGeneratingEditImage(true);
    editTaskQueueRef.current = [];

    try {
      setIsUploadingEditImage(true);
      showToast(`正在上传 ${editImageFiles.length} 张图片...`);
      const uploadedUrls = await uploadEditImagesToRunningHub(editImageFiles);
      setIsUploadingEditImage(false);

      for (let i = 0; i < editBatchSize; i++) {
        editTaskQueueRef.current.push({
          imageUrls: uploadedUrls,
          prompt: editPrompt,
          resolution: editResolution,
          aspectRatio: editAspectRatio,
          delay: i * 1000
        });
      }

      processEditTaskQueue();

    } catch (error) {
      console.error('图生图失败:', error);
      showToast(`创建任务失败: ${error.message}`);
      setIsGeneratingEditImage(false);
      setIsUploadingEditImage(false);
    }
  };

  const processEditTaskQueue = () => {
    let completedTasks = 0;
    const totalTasks = editTaskQueueRef.current.length;

    const processNextTask = () => {
      if (editTaskQueueRef.current.length === 0) {
        if (completedTasks === totalTasks) {
          setIsGeneratingEditImage(false);
        }
        return;
      }

      const taskConfig = editTaskQueueRef.current.shift();

      setTimeout(() => {
        createEditTask(taskConfig);
        completedTasks++;
        processNextTask();
      }, taskConfig.delay);
    };

    processNextTask();
  };

  // 处理图生图图片选择
  const handleEditImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 检查总数量
    if (editImageFiles.length + files.length > 10) {
      showToast('最多支持10张图片');
      return;
    }

    // 检查每张图片
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`${file.name} 超过10MB`);
        return false;
      }
      if (!file.type.startsWith('image/')) {
        showToast(`${file.name} 不是图片文件`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newFiles = [...editImageFiles, ...validFiles];
    const newUrls = newFiles.map(file => URL.createObjectURL(file));

    setEditImageFiles(newFiles);
    setEditImageUrls(newUrls);
  };

  // 清除单张图生图图片
  const handleRemoveEditImage = (index) => {
    const newFiles = editImageFiles.filter((_, i) => i !== index);
    const newUrls = editImageUrls.filter((_, i) => i !== index);
    setEditImageFiles(newFiles);
    setEditImageUrls(newUrls);
  };

  // 清除所有图生图图片
  const handleClearEditImages = () => {
    setEditImageFiles([]);
    setEditImageUrls([]);
  };

  // 保存图生图提示词
  const handleSaveEditPrompt = async () => {
    if (!editPrompt.trim()) {
      showToast('请先输入提示词');
      return;
    }

    const newPrompt = {
      id: Date.now(),
      prompt: editPrompt.trim(),
      type: 'image-to-image',
      resolution: editResolution,
      aspectRatio: editAspectRatio,
      createdAt: new Date().toISOString()
    };

    setSavedPrompts(prev => [newPrompt, ...prev]);
    await savePromptToCloud(newPrompt);
    showToast('图生图提示词已保存');
  };

  // 删除图生图任务
  const handleDeleteEditTask = async (taskId) => {
    if (confirm('确定要删除这个图生图任务吗？')) {
      await deleteEditTaskFromCloud(taskId);
      setEditTasks(prev => prev.filter(task => task.taskId !== taskId));
    }
  };

  // 通过 taskId 批量导入任务
  const handleImportTask = async () => {
    if (!importTaskIds.trim()) {
      showToast('请输入 Task ID');
      return;
    }
    
    // 解析多个 Task ID（支持逗号、空格、换行分隔）
    const taskIdList = importTaskIds
      .split(/[\s,\n]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    if (taskIdList.length === 0) {
      showToast('请输入有效的 Task ID');
      return;
    }
    
    setImporting(true);
    setImportProgress({ current: 0, total: taskIdList.length });
    
    const successTasks = [];
    const failedTasks = [];
    const skippedTasks = [];
    
    try {
      // 批量导入任务
      for (let i = 0; i < taskIdList.length; i++) {
        const taskId = taskIdList[i];
        setImportProgress({ current: i + 1, total: taskIdList.length });
        
        try {
          // 检查是否已存在
          const existing = tasks.find(t => t.taskId === taskId);
          if (existing) {
            skippedTasks.push(taskId);
            continue;
          }
          
          // 查询任务
          const response = await fetch(`${API_BASE_URL}/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ taskId }),
            signal: AbortSignal.timeout(15000)
          });
          
          if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`导入任务 ${taskId} 数据:`, data);
          
          if (data.errorCode && data.errorCode !== '') {
            throw new Error(`API 错误 (${data.errorCode}): ${data.errorMessage || '未知错误'}`);
          }
          
          if (!data.taskId) {
            throw new Error('API未返回taskId');
          }
          
          // 尝试从多个可能的字段获取提示词
          let prompt = data.prompt || data.promptTips || data.description || '';
          
          // 如果 API 没有返回提示词,使用用户手动输入的提示词
          if (!prompt && importPrompt.trim()) {
            prompt = importPrompt.trim();
          }
          
          const newTask = {
            taskId: data.taskId,
            status: data.status,
            prompt: prompt,
            duration: data.duration || '10',
            aspectRatio: data.aspectRatio || '9:16',
            createdAt: new Date().toISOString(),
            type: 'video',
            progress: data.status === 'SUCCESS' ? 100 : 0,
            resultUrl: null,
            previewUrl: null,
            retryCount: 0,
            syncedAt: new Date().toISOString()
          };
          
          // 如果已生成成功，提取视频URL和预览图
          if (data.status === 'SUCCESS' && data.results && data.results.length > 0) {
            newTask.resultUrl = data.results[0].url;
            newTask.outputType = data.results[0].outputType;
            newTask.progress = 100;
            
            // 提取预览图
            try {
              const thumbnail = await extractVideoThumbnail(newTask.resultUrl);
              newTask.previewUrl = thumbnail;
            } catch (err) {
              console.error('提取预览图失败:', err);
            }
          }
          
          if (data.usage) {
            newTask.usage = {
              consumeMoney: data.usage.consumeMoney,
              consumeCoins: data.usage.consumeCoins,
              taskCostTime: data.usage.taskCostTime,
              thirdPartyConsumeMoney: data.usage.thirdPartyConsumeMoney
            };
          }
          
          successTasks.push(newTask);
          
        } catch (error) {
          console.error(`导入任务 ${taskId} 失败:`, error);
          failedTasks.push({ taskId, error: error.message });
        }
      }
      
      // 批量添加到任务列表
      if (successTasks.length > 0) {
        setTasks(prev => [...successTasks, ...prev]);
        
        // 同步到云端
        for (const task of successTasks) {
          await saveTaskToCloud(task);
        }
      }
      
      // 显示结果
      let message = `导入完成：成功 ${successTasks.length} 个`;
      if (skippedTasks.length > 0) message += `，跳过 ${skippedTasks.length} 个`;
      if (failedTasks.length > 0) message += `，失败 ${failedTasks.length} 个`;
      
      showToast(message);
      setShowImportModal(false);
      setImportTaskIds('');
      setImportPrompt('');
      
    } catch (error) {
      console.error('批量导入失败:', error);
      showToast(`批量导入失败: ${error.message}`);
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  // 导出任务数据
  const handleExportTasks = () => {
    setExporting(true);
    
    try {
      const exportData = {
        tasks: tasks,
        exportTime: new Date().toISOString(),
        version: APP_VERSION
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_tasks_export_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast(`已导出 ${tasks.length} 条任务记录`);
    } catch (error) {
      console.error('导出失败:', error);
      showToast('导出失败');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('runninghub_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('runninghub_prompts', JSON.stringify(savedPrompts));
  }, [savedPrompts]);

  // 页面加载时检查所有未完成的任务
  useEffect(() => {
    if (!apiKey || !tasksLoaded || tasks.length === 0) return;
    
    const pendingTasks = tasks.filter(task => 
      task.status === 'RUNNING' || 
      task.status === 'QUEUED' || 
      task.status === '获取结果中...' ||
      task.status === '网络中断，正在重试...'
    );
    
    if (pendingTasks.length > 0) {
      console.log(`发现 ${pendingTasks.length} 个未完成任务，开始重新查询状态`);
      pendingTasks.forEach(task => {
        console.log(`重新查询任务: ${task.taskId}`);
        pollTaskStatus(task.taskId);
      });
    }
  }, [apiKey]); // 只在 apiKey 变化时执行，避免无限循环

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
      saveTaskToCloud(newTask); // 同步到云端
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

        // 检查是否有错误
        if (data.errorCode && data.errorCode !== '') {
          console.error(`任务 ${taskId} API错误:`, data.errorCode, data.errorMessage);
          setTasks(prev => prev.map(task => {
            if (task.taskId === taskId) {
              return {
                ...task,
                status: 'FAILED',
                progress: 0,
                errorMessage: data.errorMessage || '未知错误'
              };
            }
            return task;
          }));
          showToast(`任务失败: ${data.errorMessage || data.errorCode}`);
          return;
        }

        setTasks(prev => {
          const updatedTasks = prev.map(task => {
            if (task.taskId === taskId) {
              const updatedTask = { ...task, status: data.status, retryCount: 0 };

              if (data.status === 'SUCCESS' && data.results && data.results.length > 0) {
                // API 已经返回了视频 URL，直接使用
                console.log(`任务 ${taskId} 成功，视频URL:`, data.results[0].url);
                updatedTask.progress = 100;
                updatedTask.resultUrl = data.results[0].url;
                updatedTask.previewUrl = null;
                updatedTask.outputType = data.results[0].outputType;
                // 保存费用信息
                if (data.usage) {
                  updatedTask.usage = {
                    consumeMoney: data.usage.consumeMoney,
                    consumeCoins: data.usage.consumeCoins,
                    taskCostTime: data.usage.taskCostTime,
                    thirdPartyConsumeMoney: data.usage.thirdPartyConsumeMoney
                  };
                }
              } else if (data.status === 'SUCCESS') {
                // SUCCESS 但没有 results，需要获取结果
                console.log(`任务 ${taskId} SUCCESS 但没有 results，尝试获取结果`);
                updatedTask.progress = 99;
                updatedTask.status = '获取结果中...';
                fetchTaskResult(taskId);
              } else if (data.status === 'FAILED') {
                console.error(`任务 ${taskId} 失败:`, data.failedReason);
                updatedTask.progress = 0;
                updatedTask.failedReason = data.failedReason;
              }

              console.log(`任务 ${taskId} 更新后的状态:`, updatedTask);
              // 同步到云端
              if (data.status === 'SUCCESS' || data.status === 'FAILED') {
                saveTaskToCloud(updatedTask);
              }
              return updatedTask;
            }
            return task;
          });
          
          console.log(`所有任务状态更新完成`);
          return updatedTasks;
        });

        // 只有在 RUNNING 或 QUEUED 时才继续轮询
        if (data.status === 'RUNNING' || data.status === 'QUEUED') {
          console.log(`任务 ${taskId} 状态为 ${data.status}，5秒后继续轮询`);
          setTimeout(poll, 5000);
        } else {
          console.log(`任务 ${taskId} 已完成，状态: ${data.status}，停止轮询`);
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
                  previewUrl: thumbnailUrl,
                  usage: data.usage ? {
                    consumeMoney: data.usage.consumeMoney,
                    consumeCoins: data.usage.consumeCoins,
                    taskCostTime: data.usage.taskCostTime,
                    thirdPartyConsumeMoney: data.usage.thirdPartyConsumeMoney
                  } : null
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

  const handleDelete = async (taskId) => {
    if (confirm('确定要删除这个任务吗？')) {
      // 先从云端删除
      await deleteTaskFromCloud(taskId);
      // 再从本地列表删除
      setTasks(prev => prev.filter(task => task.taskId !== taskId));
    }
  };

  const handlePlayVideo = (url) => {
    setCurrentVideoUrl(url);
    setShowVideoModal(true);
  };

  const handleSavePrompt = async () => {
    if (!prompt.trim()) {
      showToast('请先输入提示词');
      return;
    }
    
    const newPrompt = {
      id: Date.now(),
      prompt: prompt.trim(),
      duration,
      aspectRatio,
      createdAt: new Date().toISOString()
    };
    
    // 保存到本地状态
    setSavedPrompts(prev => [newPrompt, ...prev]);
    
    // 保存到云端
    await savePromptToCloud(newPrompt);
    
    showToast('提示词已保存');
  };

  const handleDeletePrompt = async (id) => {
    // 从云端删除
    await deletePromptFromCloud(id);
    // 从本地列表删除
    setSavedPrompts(prev => prev.filter(p => p.id !== id));
    showToast('已删除提示词');
  };

  // 图片上传处理
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 检查文件大小 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      showToast('图片大小不能超过 50MB');
      return;
    }
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件');
      return;
    }
    
    setImageFile(file);
    
    // 创建本地预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // 上传图片到 RunningHub
  const uploadImageToRunningHub = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/media/upload/binary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`上传失败: ${errorText}`);
    }
    
    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.message || '上传失败');
    }
    
    return data.data.download_url;
  };

  // 图生视频
  const handleGenerateFromImage = async () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }
    
    if (!imageFile) {
      showToast('请先选择图片');
      return;
    }
    
    if (!imagePrompt.trim()) {
      showToast('请输入提示词');
      return;
    }
    
    if (imagePrompt.trim().length < 5) {
      showToast('提示词至少需要 5 个字符');
      return;
    }
    
    setIsGeneratingImageVideo(true);
    taskQueueRef.current = [];
    
    try {
      // 1. 上传图片(只上传一次)
      setIsUploading(true);
      showToast('正在上传图片...');
      const uploadedUrl = await uploadImageToRunningHub(imageFile);
      setIsUploading(false);
      console.log('图片上传成功:', uploadedUrl);
      
      // 2. 创建批量任务
      for (let i = 0; i < imageBatchSize; i++) {
        taskQueueRef.current.push({
          imageUrl: uploadedUrl,
          prompt: imagePrompt,
          duration: imageDuration,
          aspectRatio: imageAspectRatio,
          delay: i * 1000
        });
      }
      
      processImageTaskQueue();
      
    } catch (error) {
      console.error('图生视频失败:', error);
      let errorMsg = error.message;
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMsg = '网络连接失败，请检查网络';
      }
      showToast(`创建任务失败: ${errorMsg}`);
      setIsGeneratingImageVideo(false);
    }
  };
  
  const processImageTaskQueue = () => {
    let completedTasks = 0;
    const totalTasks = taskQueueRef.current.length;

    const processNextTask = () => {
      if (taskQueueRef.current.length === 0) {
        if (completedTasks === totalTasks) {
          setIsGeneratingImageVideo(false);
        }
        return;
      }

      const taskConfig = taskQueueRef.current.shift();
      
      setTimeout(() => {
        createImageTask(taskConfig);
        completedTasks++;
        processNextTask();
      }, taskConfig.delay);
    };

    processNextTask();
  };
  
  const createImageTask = async (taskConfig) => {
    try {
      // 创建图生视频任务
      const requestBody = {
        imageUrl: taskConfig.imageUrl,
        duration: taskConfig.duration,
        aspectRatio: taskConfig.aspectRatio,
        prompt: taskConfig.prompt,
        storyboard: false
      };
      
      console.log('请求URL:', `${API_BASE_URL}/rhart-video-s/image-to-video`);
      console.log('请求体:', requestBody);
      
      const response = await fetch(`${API_BASE_URL}/rhart-video-s/image-to-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP错误: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.msg || errorJson.message || errorJson.errorMessage || errorMessage;
        } catch (e) {
          if (errorText) {
            errorMessage = errorText.substring(0, 100);
          }
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('响应数据:', data);
      
      if (data.errorCode && data.errorCode !== '') {
        throw new Error(`API 错误 (${data.errorCode}): ${data.errorMessage || '未知错误'}`);
      }
      
      if (!data.taskId) {
        throw new Error('API未返回taskId');
      }
      
      const newTask = {
        taskId: data.taskId,
        status: data.status || 'RUNNING',
        prompt: taskConfig.prompt,
        duration: taskConfig.duration,
        aspectRatio: taskConfig.aspectRatio,
        createdAt: new Date().toISOString(),
        type: 'image-to-video',
        imageUrl: taskConfig.imageUrl,
        progress: data.status === 'SUCCESS' ? 100 : 0,
        resultUrl: null,
        previewUrl: null,
        retryCount: 0
      };
      
      setTasks(prev => [newTask, ...prev]);
      saveTaskToCloud(newTask); // 同步到云端
      showToast(`任务创建成功！TaskID: ${data.taskId}`);
      pollTaskStatus(newTask.taskId);
      
    } catch (error) {
      console.error('创建图生视频任务失败:', error);
      showToast(`任务创建失败: ${error.message}`);
      
      if (taskQueueRef.current.length === 0) {
        setIsGeneratingImageVideo(false);
      }
    }
  };

  // 保存图生视频提示词
  const handleSaveImagePrompt = async () => {
    if (!imagePrompt.trim()) {
      showToast('请先输入提示词');
      return;
    }
    
    const newPrompt = {
      id: Date.now(),
      prompt: imagePrompt.trim(),
      type: 'image-to-video',
      duration: imageDuration,
      aspectRatio: imageAspectRatio,
      createdAt: new Date().toISOString()
    };
    
    // 保存到本地状态
    setSavedPrompts(prev => [newPrompt, ...prev]);
    
    // 保存到云端
    await savePromptToCloud(newPrompt);
    
    showToast('提示词已保存');
  };

  // 使用保存的提示词(支持文生视频和图生视频)
  const handleUsePrompt = (savedPrompt) => {
    if (savedPrompt.type === 'image-to-video') {
      // 图生视频提示词
      setImagePrompt(savedPrompt.prompt);
      setImageDuration(savedPrompt.duration);
      setImageAspectRatio(savedPrompt.aspectRatio);
      showToast('已应用保存的图生视频提示词');
    } else if (savedPrompt.type === 'image-to-image') {
      // 图生图提示词
      setEditPrompt(savedPrompt.prompt);
      setEditResolution(savedPrompt.resolution);
      setEditAspectRatio(savedPrompt.aspectRatio);
      showToast('已应用保存的图生图提示词');
    } else {
      // 文生视频提示词(默认)
      setPrompt(savedPrompt.prompt);
      setDuration(savedPrompt.duration);
      setAspectRatio(savedPrompt.aspectRatio);
      showToast('已应用保存的提示词');
    }
  };

  // 清除图片
  const handleClearImage = () => {
    setImageFile(null);
    setImageUrl(null);
  };

  const getChangelog = () => {
    const changes = [
      {
        version: 'v1.7.0',
        date: '2026-02-20',
        changes: [
          '🎨 新增：全能图片PRO - 图生图模块',
          '🎨 支持风格迁移、内容替换等图片编辑功能',
          '🎨 支持1K/2K/4K分辨率和多种画面比例',
          '🎨 支持批量生产(1/3/5/10个)和提示词保存',
          '☁️ 图生图任务独立存储在云端'
        ]
      },
      {
        version: 'v1.6.0',
        date: '2026-02-20',
        changes: [
          '📥 新增：手动导入任务功能',
          '📤 新增：导出所有任务数据',
          '🖼️ 优化：历史记录视频预览图显示',
          '📊 优化：导入任务自动提取预览图'
        ]
      },
      {
        version: 'v1.5.0',
        date: '2026-02-20',
        changes: [
          '☁️ 新增：CloudBase 云同步功能',
          '☁️ 支持历史记录云端备份',
          '☁️ 支持多设备数据同步',
          '🔐 自动匿名登录认证'
        ]
      },
      {
        version: 'v1.4.0',
        date: '2026-02-20',
        changes: [
          '✨ 新增：任务费用显示',
          '✨ 新增：当日消耗统计',
          '📊 显示今日生成数量、金额和RH币'
        ]
      },
      {
        version: 'v1.3.0',
        date: '2026-02-20',
        changes: [
          '✨ 新增：图生视频功能',
          '✨ 新增：图片上传支持',
          '✨ 新增：历史记录悬停预览播放',
          '🎨 优化：任务卡片显示区分类型'
        ]
      },
      {
        version: 'v1.2.0',
        date: '2026-02-20',
        changes: [
          '✨ 新增：提示词保存和管理功能',
          '✨ 新增：版本号和更新历史查看',
          '✨ 新增：显示最后部署时间',
          '🐛 修复：任务状态同步问题',
          '🐛 修复：页面刷新后状态丢失',
          '🐛 修复：CSS 路径问题',
          '🐛 修复：视频预览图显示问题'
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

  // 计算当日消耗
  const getTodayUsage = () => {
    const today = new Date().toDateString();
    const todayTasks = tasks.filter(task => {
      const taskDate = new Date(task.createdAt).toDateString();
      return taskDate === today && task.status === 'SUCCESS';
    });
    
    let totalMoney = 0;
    let totalCoins = 0;
    
    todayTasks.forEach(task => {
      if (task.usage) {
        if (task.usage.consumeMoney) {
          totalMoney += parseFloat(task.usage.consumeMoney) || 0;
        }
        if (task.usage.consumeCoins) {
          totalCoins += parseFloat(task.usage.consumeCoins) || 0;
        }
        if (task.usage.thirdPartyConsumeMoney) {
          totalMoney += parseFloat(task.usage.thirdPartyConsumeMoney) || 0;
        }
      }
    });
    
    return {
      taskCount: todayTasks.length,
      totalMoney: totalMoney.toFixed(2),
      totalCoins: totalCoins.toFixed(2)
    };
  };

  // 格式化费用显示
  const formatCost = (usage) => {
    if (!usage) return null;
    
    const parts = [];
    if (usage.consumeMoney) {
      parts.push(`¥${parseFloat(usage.consumeMoney).toFixed(2)}`);
    }
    if (usage.thirdPartyConsumeMoney) {
      parts.push(`三方¥${parseFloat(usage.thirdPartyConsumeMoney).toFixed(2)}`);
    }
    if (usage.consumeCoins) {
      parts.push(`${usage.consumeCoins} RH币`);
    }
    
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">AI视频生成 <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '0.5rem' }}>{APP_VERSION}</span></div>
          <div className="header-actions">
            <button className="btn btn-icon" onClick={toggleTheme} title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
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
          {/* 当日统计 */}
          <div className="stats-bar">
            <div className="stats-item">
              <span className="stats-label">今日生成</span>
              <span className="stats-value">{getTodayUsage().taskCount} 个</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">今日消耗</span>
              <span className="stats-value">¥{getTodayUsage().totalMoney}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">今日RH币</span>
              <span className="stats-value">{getTodayUsage().totalCoins}</span>
            </div>
            <div className="stats-item" style={{ marginLeft: 'auto' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => setShowImportModal(true)}
                  title="通过Task ID导入任务"
                >
                  📥 导入
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={handleExportTasks}
                  disabled={exporting || tasks.length === 0}
                  title="导出所有任务"
                >
                  {exporting ? '⏳' : '📤'} 导出
                </button>
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => loadTasksFromCloud()}
                  disabled={isLoadingFromCloud || !cloudUser}
                  title="刷新云端数据"
                >
                  {isLoadingFromCloud ? '⏳' : '🔄'} 刷新
                </button>
              </div>
              {lastSyncTime && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  更新: {lastSyncTime}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', minHeight: 'calc(100vh - 200px)' }}>
            {/* 左侧：生成面板 */}
            <div style={{ flex: '0 0 420px', minWidth: '420px' }}>
              <div className="card" style={{ marginBottom: '2rem', height: 'fit-content' }}>
                {/* 主Tab切换 */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <button
                    className={`tab-button ${leftMainTab === 'video' ? 'active' : ''}`}
                    onClick={() => setLeftMainTab('video')}
                  >
                    🎬 视频生成
                  </button>
                  <button
                    className={`tab-button ${leftMainTab === 'image' ? 'active' : ''}`}
                    onClick={() => setLeftMainTab('image')}
                  >
                    🖼️ 图片生成
                  </button>
                </div>

                {/* 视频生成Tab内容 */}
                {leftMainTab === 'video' && (
                  <>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="label">选择功能</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className={`function-select-btn ${videoFunction === 'text-to-video' ? 'active' : ''}`}
                          onClick={() => setVideoFunction('text-to-video')}
                        >
                          全能视频S · 文生视频
                        </button>
                        <button
                          className={`function-select-btn ${videoFunction === 'image-to-video' ? 'active' : ''}`}
                          onClick={() => setVideoFunction('image-to-video')}
                        >
                          视频S · 图生视频
                        </button>
                      </div>
                    </div>

                    {/* 文生视频模块 */}
                    {videoFunction === 'text-to-video' && (
                      <>
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
                            <label className="label">批量</label>
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
                              style={{ minWidth: '100px' }}
                            >
                              {isGenerating ? '生成中' : '生成'}
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={handleSavePrompt}
                            style={{ flex: 1 }}
                          >
                            💾 保存提示词
                          </button>
                        </div>
                      </>
                    )}

                    {/* 图生视频模块 */}
                    {videoFunction === 'image-to-video' && (
                      <>
                        <div className="form-group">
                          <label className="label">上传图片</label>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div
                              className="image-upload-area"
                              onClick={() => document.getElementById('imageInput').click()}
                              style={{
                                width: '120px',
                                height: '160px',
                                border: '2px dashed var(--border-color)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                background: imageUrl ? 'transparent' : 'var(--bg-secondary)',
                                position: 'relative',
                                flexShrink: 0
                              }}
                            >
                              {imageUrl ? (
                                <>
                                  <img
                                    src={imageUrl}
                                    alt="预览"
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover'
                                    }}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClearImage();
                                    }}
                                    style={{
                                      position: 'absolute',
                                      top: '4px',
                                      right: '4px',
                                      width: '24px',
                                      height: '24px',
                                      borderRadius: '50%',
                                      background: 'rgba(0,0,0,0.6)',
                                      color: 'white',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    ×
                                  </button>
                                </>
                              ) : (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  <div style={{ fontSize: '2rem' }}>+</div>
                                  <div style={{ fontSize: '0.75rem' }}>点击上传</div>
                                </div>
                              )}
                              <input
                                id="imageInput"
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                style={{ display: 'none' }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="hint" style={{ marginBottom: '0.5rem' }}>
                                支持 JPG、PNG 格式，最大 50MB
                              </div>
                              <div className="hint" style={{ color: 'var(--text-secondary)' }}>
                                推荐使用 9:16 比例的图片以获得最佳效果
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="label">提示词</label>
                          <textarea
                            className="input textarea"
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="描述你想要的视频效果..."
                            maxLength="4000"
                            style={{ minHeight: '80px' }}
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="label">时长</label>
                            <select
                              className="input select"
                              value={imageDuration}
                              onChange={(e) => setImageDuration(e.target.value)}
                            >
                              <option value="10">10秒</option>
                              <option value="15">15秒</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="label">画面比例</label>
                            <select
                              className="input select"
                              value={imageAspectRatio}
                              onChange={(e) => setImageAspectRatio(e.target.value)}
                            >
                              <option value="9:16">竖屏 (9:16)</option>
                              <option value="16:9">横屏 (16:9)</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="label">批量</label>
                            <select
                              className="input select"
                              value={imageBatchSize}
                              onChange={(e) => setImageBatchSize(Number(e.target.value))}
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
                              onClick={handleGenerateFromImage}
                              disabled={isGeneratingImageVideo || isUploading || !imageFile}
                              style={{ minWidth: '100px' }}
                            >
                              {isUploading ? '上传中' : isGeneratingImageVideo ? '生成中' : '生成'}
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={handleSaveImagePrompt}
                            style={{ flex: 1 }}
                          >
                            💾 保存提示词
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* 图片生成Tab内容 */}
                {leftMainTab === 'image' && (
                  <>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="label">选择功能</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className={`function-select-btn ${imageFunction === 'image-to-image' ? 'active' : ''}`}
                          onClick={() => setImageFunction('image-to-image')}
                        >
                          全能图片PRO · 图生图
                        </button>
                      </div>
                    </div>

                    {/* 图生图模块 */}
                    {imageFunction === 'image-to-image' && (
                      <>
                        <div className="form-group">
                          <label className="label">上传原图 ({editImageUrls.length}/10)</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}>
                            {editImageUrls.map((url, index) => (
                              <div
                                key={index}
                                style={{
                                  width: '100px',
                                  height: '100px',
                                  border: '2px solid var(--border-color)',
                                  borderRadius: '12px',
                                  overflow: 'hidden',
                                  position: 'relative',
                                  flexShrink: 0
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`图片${index + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <button
                                  onClick={() => handleRemoveEditImage(index)}
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {editImageUrls.length < 10 && (
                              <div
                                className="image-upload-area"
                                onClick={() => document.getElementById('editImageInput').click()}
                                style={{
                                  width: '100px',
                                  height: '100px',
                                  border: '2px dashed var(--border-color)',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  background: 'var(--bg-secondary)',
                                  flexShrink: 0
                                }}
                              >
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  <div style={{ fontSize: '1.5rem' }}>+</div>
                                  <div style={{ fontSize: '0.7rem' }}>添加</div>
                                </div>
                              </div>
                            )}
                            {editImageUrls.length > 0 && (
                              <button
                                onClick={handleClearEditImages}
                                className="btn btn-secondary btn-small"
                                style={{ height: 'fit-content', marginTop: 'auto' }}
                              >
                                清空全部
                              </button>
                            )}
                            <input
                              id="editImageInput"
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleEditImageSelect}
                              style={{ display: 'none' }}
                            />
                          </div>
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                            <div className="hint">
                              支持 JPG、PNG 格式，每张最大 10MB，最多 10 张
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="label">提示词</label>
                          <textarea
                            className="input textarea"
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder="描述你想要的图片效果..."
                            maxLength="4000"
                            style={{ minHeight: '80px' }}
                          />
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="label">分辨率</label>
                            <select
                              className="input select"
                              value={editResolution}
                              onChange={(e) => setEditResolution(e.target.value)}
                            >
                              <option value="1k">1K</option>
                              <option value="2k">2K</option>
                              <option value="4k">4K</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="label">画面比例</label>
                            <select
                              className="input select"
                              value={editAspectRatio}
                              onChange={(e) => setEditAspectRatio(e.target.value)}
                            >
                              <option value="1:1">1:1</option>
                              <option value="16:9">横屏 (16:9)</option>
                              <option value="9:16">竖屏 (9:16)</option>
                              <option value="4:3">4:3</option>
                              <option value="3:4">3:4</option>
                              <option value="3:2">3:2</option>
                              <option value="2:3">2:3</option>
                              <option value="5:4">5:4</option>
                              <option value="4:5">4:5</option>
                              <option value="21:9">21:9</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="label">批量</label>
                            <select
                              className="input select"
                              value={editBatchSize}
                              onChange={(e) => setEditBatchSize(Number(e.target.value))}
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
                              onClick={handleGenerateEditImage}
                              disabled={isGeneratingEditImage || isUploadingEditImage || editImageFiles.length === 0}
                              style={{ minWidth: '100px' }}
                            >
                              {isUploadingEditImage ? '上传中' : isGeneratingEditImage ? '生成中' : '生成'}
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={handleSaveEditPrompt}
                            style={{ flex: 1 }}
                          >
                            💾 保存提示词
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* 保存的提示词 */}
              {showSavedPrompts && savedPrompts.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className="section-title" style={{ marginBottom: 0, fontSize: '1.1rem' }}>
                      保存的提示词 ({savedPrompts.length})
                    </h2>
                    <button
                      className="btn btn-secondary btn-small btn-icon"
                      onClick={() => setShowSavedPrompts(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                    {savedPrompts.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '1rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: '12px',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{
                          fontSize: '0.9rem',
                          marginBottom: '0.5rem',
                          lineHeight: '1.4'
                        }}>
                          {item.prompt}
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.75rem'
                        }}>
                          <span style={{
                            background: item.type === 'image-to-video' ? '#10b981' : item.type === 'image-to-image' ? '#8b5cf6' : '#6366f1',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            marginRight: '0.5rem'
                          }}>
                            {item.type === 'image-to-video' ? '图生视频' : item.type === 'image-to-image' ? '图生图' : '文生视频'}
                          </span>
                          {item.duration ? `${item.duration}秒 · ` : ''}{item.aspectRatio} · {formatDate(item.createdAt)}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-small"
                            onClick={() => {
                              handleUsePrompt(item);
                              setShowSavedPrompts(false);
                            }}
                            style={{ flex: 1 }}
                          >
                            使用
                          </button>
                          <button
                            className="btn btn-secondary btn-small btn-icon"
                            onClick={() => handleDeletePrompt(item.id)}
                            title="删除"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 显示保存的提示词按钮 */}
              {!showSavedPrompts && savedPrompts.length > 0 && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowSavedPrompts(true)}
                  style={{ width: '100%' }}
                >
                  📋 已保存提示词 ({savedPrompts.length})
                </button>
              )}
            </div>

            {/* 右侧：历史记录 */}
            <div style={{ flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column' }}>
              <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* 历史记录Tab切换 */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <button
                    className={`tab-button ${rightTab === 'all' ? 'active' : ''}`}
                    onClick={() => setRightTab('all')}
                  >
                    全部 ({tasks.length + editTasks.length})
                  </button>
                  <button
                    className={`tab-button ${rightTab === 'video' ? 'active' : ''}`}
                    onClick={() => setRightTab('video')}
                  >
                    视频 ({tasks.length})
                  </button>
                  <button
                    className={`tab-button ${rightTab === 'image' ? 'active' : ''}`}
                    onClick={() => setRightTab('image')}
                  >
                    图片 ({editTasks.length})
                  </button>
                </div>

                {/* 全部内容 */}
                {rightTab === 'all' && (
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: '400px' }}>
                    {isLoadingFromCloud ? (
                      <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>正在从云端加载任务...</p>
                        <div className="spinner" style={{ margin: '1rem auto 0' }} />
                      </div>
                    ) : tasks.length === 0 && editTasks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        暂无生成记录
                      </div>
                    ) : (
                      <div className="task-grid">
                        {/* 视频任务 */}
                        {tasks.map(task => (
                          <div key={task.taskId} className="task-card">
                            <div
                              className="task-preview"
                              onClick={task.resultUrl ? () => handlePlayVideo(task.resultUrl) : undefined}
                              style={task.resultUrl ? { cursor: 'pointer' } : {}}
                              onMouseEnter={(e) => {
                                if (!task.resultUrl) return;
                                const video = e.currentTarget.querySelector('video');
                                const img = e.currentTarget.querySelector('img');
                                if (video) {
                                  video.style.display = 'block';
                                  if (img) img.style.display = 'none';
                                  video.play().catch(() => {});
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!task.resultUrl) return;
                                const video = e.currentTarget.querySelector('video');
                                const img = e.currentTarget.querySelector('img');
                                if (video) {
                                  video.pause();
                                  video.currentTime = 0.1;
                                  if (task.previewUrl && img) {
                                    video.style.display = 'none';
                                    img.style.display = 'block';
                                  }
                                }
                              }}
                            >
                              {task.resultUrl ? (
                                <>
                                  <video
                                    ref={(videoEl) => {
                                      if (videoEl && !videoEl.dataset.loaded && !task.previewUrl) {
                                        videoEl.dataset.loaded = 'true';
                                        videoEl.currentTime = 0.1;
                                      }
                                    }}
                                    src={task.resultUrl}
                                    muted
                                    preload="metadata"
                                    loop
                                    style={{ display: task.previewUrl ? 'none' : 'block' }}
                                    onSeeked={(e) => {
                                      const video = e.target;
                                      if (!task.previewUrl) {
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
                                    />
                                  )}
                                  <div className="play-overlay">
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
                              <span className={`task-badge ${task.type === 'image-to-video' ? 'image-video' : 'video'}`}>
                                {task.type === 'image-to-video' ? '图生视频' : '文生视频'}
                              </span>
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

                              {task.usage && formatCost(task.usage) && (
                                <div className="task-cost">
                                  💰 {formatCost(task.usage)}
                                </div>
                              )}

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
                        {/* 图片任务 */}
                        {editTasks.map(task => (
                          <div key={task.taskId} className="task-card">
                            <div className="task-preview">
                              {task.resultUrl ? (
                                <img
                                  src={task.resultUrl}
                                  alt="结果"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                  onClick={() => window.open(task.resultUrl, '_blank')}
                                />
                              ) : (
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'var(--bg-secondary)',
                                  color: 'var(--text-secondary)'
                                }}>
                                  {task.status === 'RUNNING' ? (
                                    <>
                                      <div className="spinner" style={{ width: '40px', height: '40px' }} />
                                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>生成中</div>
                                    </>
                                  ) : (
                                    <span>等待中</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="task-info">
                              <span className="task-badge edit">图生图</span>
                              <div className="task-id">TaskID: {task.taskId}</div>
                              <div className="task-prompt" title={task.prompt}>
                                {task.prompt.length > 30 ? task.prompt.substring(0, 30) + '...' : task.prompt}
                              </div>
                              <div className="task-meta">
                                <span className={`task-status ${getTaskStatusClass(task.status)}`}>
                                  {task.status}
                                </span>
                                <span className="task-time">
                                  🕐 {formatDate(task.createdAt)}
                                </span>
                              </div>
                              <div className="task-actions">
                                {task.resultUrl && (
                                  <button
                                    className="btn btn-small"
                                    onClick={() => window.open(task.resultUrl, '_blank')}
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    下载
                                  </button>
                                )}
                                <button
                                  className="btn btn-small btn-secondary"
                                  onClick={() => handleDeleteEditTask(task.taskId)}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 视频内容 */}
                {rightTab === 'video' && (
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: '400px' }}>
                    {isLoadingFromCloud ? (
                      <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>正在从云端加载任务...</p>
                        <div className="spinner" style={{ margin: '1rem auto 0' }} />
                      </div>
                    ) : tasks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        暂无视频记录
                      </div>
                    ) : (
                      <div className="task-grid">
                        {tasks.map(task => (
                          <div key={task.taskId} className="task-card">
                            <div
                              className="task-preview"
                              onClick={task.resultUrl ? () => handlePlayVideo(task.resultUrl) : undefined}
                              style={task.resultUrl ? { cursor: 'pointer' } : {}}
                              onMouseEnter={(e) => {
                                if (!task.resultUrl) return;
                                const video = e.currentTarget.querySelector('video');
                                const img = e.currentTarget.querySelector('img');
                                if (video) {
                                  video.style.display = 'block';
                                  if (img) img.style.display = 'none';
                                  video.play().catch(() => {});
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!task.resultUrl) return;
                                const video = e.currentTarget.querySelector('video');
                                const img = e.currentTarget.querySelector('img');
                                if (video) {
                                  video.pause();
                                  video.currentTime = 0.1;
                                  if (task.previewUrl && img) {
                                    video.style.display = 'none';
                                    img.style.display = 'block';
                                  }
                                }
                              }}
                            >
                              {task.resultUrl ? (
                                <>
                                  <video
                                    ref={(videoEl) => {
                                      if (videoEl && !videoEl.dataset.loaded && !task.previewUrl) {
                                        videoEl.dataset.loaded = 'true';
                                        videoEl.currentTime = 0.1;
                                      }
                                    }}
                                    src={task.resultUrl}
                                    muted
                                    preload="metadata"
                                    loop
                                    style={{ display: task.previewUrl ? 'none' : 'block' }}
                                    onSeeked={(e) => {
                                      const video = e.target;
                                      if (!task.previewUrl) {
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
                                    />
                                  )}
                                  <div className="play-overlay">
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
                              <span className={`task-badge ${task.type === 'image-to-video' ? 'image-video' : 'video'}`}>
                                {task.type === 'image-to-video' ? '图生视频' : '文生视频'}
                              </span>
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

                              {task.usage && formatCost(task.usage) && (
                                <div className="task-cost">
                                  💰 {formatCost(task.usage)}
                                </div>
                              )}

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
                  </div>
                )}

                {/* 图片内容 */}
                {rightTab === 'image' && (
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: '400px' }}>
                    {editTasks.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        暂无图片记录
                      </div>
                    ) : (
                      <div className="task-grid">
                        {editTasks.map(task => (
                          <div key={task.taskId} className="task-card">
                            <div className="task-preview">
                              {task.resultUrl ? (
                                <img
                                  src={task.resultUrl}
                                  alt="结果"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                  onClick={() => window.open(task.resultUrl, '_blank')}
                                />
                              ) : (
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'var(--bg-secondary)',
                                  color: 'var(--text-secondary)'
                                }}>
                                  {task.status === 'RUNNING' ? (
                                    <>
                                      <div className="spinner" style={{ width: '40px', height: '40px' }} />
                                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>生成中</div>
                                    </>
                                  ) : (
                                    <span>等待中</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="task-info">
                              <span className="task-badge edit">图生图</span>
                              <div className="task-id">TaskID: {task.taskId}</div>
                              <div className="task-prompt" title={task.prompt}>
                                {task.prompt.length > 30 ? task.prompt.substring(0, 30) + '...' : task.prompt}
                              </div>
                              <div className="task-meta">
                                <span className={`task-status ${getTaskStatusClass(task.status)}`}>
                                  {task.status}
                                </span>
                                <span className="task-time">
                                  🕐 {formatDate(task.createdAt)}
                                </span>
                              </div>
                              <div className="task-actions">
                                {task.resultUrl && (
                                  <button
                                    className="btn btn-small"
                                    onClick={() => window.open(task.resultUrl, '_blank')}
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    下载
                                  </button>
                                )}
                                <button
                                  className="btn btn-small btn-secondary"
                                  onClick={() => handleDeleteEditTask(task.taskId)}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
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

      {showChangelogModal && (
        <div className="modal" onClick={() => setShowChangelogModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-header">更新日志</h2>
            
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <strong>当前版本：</strong>{APP_VERSION}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                <strong>最后部署：</strong>{LAST_DEPLOY_TIME}
              </div>
            </div>

            {getChangelog().map((item, index) => (
              <div key={index} style={{ marginBottom: index < getChangelog().length - 1 ? '1.5rem' : 0 }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '0.75rem'
                }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{item.version}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.date}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {item.changes.map((change, i) => (
                    <li key={i} style={{
                      padding: '0.5rem 0',
                      borderBottom: i < item.changes.length - 1 ? '1px solid var(--border-color)' : 'none',
                      fontSize: '0.9rem',
                      lineHeight: 1.6
                    }}>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowChangelogModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-header">导入任务</h2>
            
            <div className="form-group">
              <label className="label">Task IDs</label>
              <textarea
                className="input textarea"
                value={importTaskIds}
                onChange={(e) => setImportTaskIds(e.target.value)}
                placeholder="请输入要导入的 Task ID，每行一个"
                autoFocus
                style={{ fontFamily: 'monospace', minHeight: '120px' }}
              />
              <div className="hint" style={{ marginTop: '0.5rem' }}>
                支持批量导入，每行输入一个 Task ID，系统将查询并导入所有任务
              </div>
            </div>
            
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="label">提示词（可选）</label>
              <textarea
                className="input textarea"
                value={importPrompt}
                onChange={(e) => setImportPrompt(e.target.value)}
                placeholder="如果 API 没有返回提示词，可以手动输入，将应用到所有导入的任务"
                maxLength="4000"
                style={{ minHeight: '60px' }}
              />
              <div className="hint" style={{ marginTop: '0.5rem' }}>
                如果 API 没有返回原始提示词，可以在这里手动输入，此提示词将应用到所有导入的任务
              </div>
            </div>
              
            {importing && importProgress.total > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span>导入进度</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            )}
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowImportModal(false)}
              >
                取消
              </button>
              <button 
                className="btn" 
                onClick={handleImportTask}
                disabled={importing || !importTaskIds.trim()}
              >
                {importing ? '导入中...' : '导入'}
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
