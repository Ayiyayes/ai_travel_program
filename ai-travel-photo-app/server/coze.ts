import axios from 'axios';
import * as db from './db';

// Coze API 配置 - 默认值（优先从数据库读取）
const COZE_API_URL = 'https://api.coze.cn/v1';

// 默认工作流 ID（如果数据库中没有配置则使用这些默认值）
const DEFAULT_WORKFLOW_IDS = {
  FACE_SWAP_SINGLE: '7578419604687552562',      // 单人换脸 (swap_face_total)
  FACE_SWAP_COUPLE: '7574050703116075050',      // 双人换脸 (Runninghub_swap_faces)
  USER_ANALYZE: '7554026919391150095',          // 用户判别
};

// 配置缓存
let configCache: {
  apiKey?: string;
  botId?: string;
  singleFaceWorkflowId?: string;
  doubleFaceWorkflowId?: string;
  userAnalyzeWorkflowId?: string;
  lastFetch?: number;
} = {};

const CACHE_TTL = 60000; // 缓存1分钟

// 从数据库获取配置（带缓存）
async function getCozeConfig() {
  const now = Date.now();
  if (configCache.lastFetch && (now - configCache.lastFetch) < CACHE_TTL) {
    return configCache;
  }
  
  try {
    const [apiKey, botId, singleFaceWorkflowId, doubleFaceWorkflowId, userAnalyzeWorkflowId] = await Promise.all([
      db.getSystemConfig('COZE_API_KEY'),
      db.getSystemConfig('COZE_BOT_ID'),
      db.getSystemConfig('COZE_SINGLE_FACE_WORKFLOW_ID'),
      db.getSystemConfig('COZE_DOUBLE_FACE_WORKFLOW_ID'),
      db.getSystemConfig('COZE_USER_ANALYZE_WORKFLOW_ID'),
    ]);

    configCache = {
      apiKey: apiKey || process.env.COZE_API_KEY || '',
      botId: botId || process.env.COZE_BOT_ID || '',
      singleFaceWorkflowId: singleFaceWorkflowId || DEFAULT_WORKFLOW_IDS.FACE_SWAP_SINGLE,
      doubleFaceWorkflowId: doubleFaceWorkflowId || DEFAULT_WORKFLOW_IDS.FACE_SWAP_COUPLE,
      userAnalyzeWorkflowId: userAnalyzeWorkflowId || DEFAULT_WORKFLOW_IDS.USER_ANALYZE,
      lastFetch: now,
    };

    console.log('[Coze] Config loaded from database, botId:', botId ? 'set' : 'not set');
  } catch (error) {
    console.error('[Coze] Failed to load config from database, using defaults:', error);
    // 使用环境变量或默认值
    configCache = {
      apiKey: process.env.COZE_API_KEY || '',
      botId: process.env.COZE_BOT_ID || '',
      singleFaceWorkflowId: DEFAULT_WORKFLOW_IDS.FACE_SWAP_SINGLE,
      doubleFaceWorkflowId: DEFAULT_WORKFLOW_IDS.FACE_SWAP_COUPLE,
      userAnalyzeWorkflowId: DEFAULT_WORKFLOW_IDS.USER_ANALYZE,
      lastFetch: now,
    };
  }
  
  return configCache;
}

// 清除配置缓存（在配置更新后调用）
export function clearCozeConfigCache() {
  configCache = {};
  console.log('[Coze] Config cache cleared');
}

interface CozeWorkflowResponse {
  code: number;
  msg: string;
  execute_id?: string;
  data?: string;
}

interface CozeWorkflowStatusResponse {
  code: number;
  msg: string;
  data?: {
    status: 'running' | 'completed' | 'failed';
    output?: string;
    error?: string;
  };
}

// 调用 Coze 工作流（异步模式，需要轮询状态）
async function callCozeWorkflowAsync(workflowId: string, parameters: Record<string, any>): Promise<{ executeId: string }> {
  const config = await getCozeConfig();
  
  if (!config.apiKey) {
    throw new Error('Coze API Key 未配置，请在管理后台 API配置 中设置');
  }
  
  try {
    const response = await axios.post<CozeWorkflowResponse>(
      `${COZE_API_URL}/workflow/run`,
      {
        workflow_id: workflowId,
        parameters,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.msg || 'Coze workflow call failed');
    }

    const executeId = response.data.execute_id;
    if (!executeId) {
      console.error('[Coze] No execute_id in response:', JSON.stringify(response.data));
      throw new Error('Coze workflow did not return execute_id');
    }
    
    console.log('[Coze] Workflow started, execute_id:', executeId);
    return { executeId };
  } catch (error: any) {
    console.error('[Coze] Workflow call error:', error.message);
    throw new Error(`Coze workflow call failed: ${error.message}`);
  }
}

// 调用 Coze 工作流（同步模式，直接返回结果）
async function callCozeWorkflowSync(workflowId: string, parameters: Record<string, any>): Promise<{ executeId: string; resultUrls: string[] }> {
  const config = await getCozeConfig();

  if (!config.apiKey) {
    throw new Error('Coze API Key 未配置，请在管理后台 API配置 中设置');
  }

  try {
    console.log('[Coze] Calling workflow sync:', workflowId);
    console.log('[Coze] Parameters:', JSON.stringify(parameters, null, 2));
    console.log('[Coze] Bot ID:', config.botId || '(not set)');

    // 构建请求体
    const requestBody: Record<string, any> = {
      workflow_id: workflowId,
      parameters,
    };

    // 如果配置了 bot_id，添加到请求体（某些工作流需要关联智能体）
    if (config.botId) {
      requestBody.bot_id = config.botId;
    }

    const response = await axios.post<CozeWorkflowResponse>(
      `${COZE_API_URL}/workflow/run`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2分钟超时，换脸可能需要较长时间
      }
    );

    console.log('[Coze] Response:', JSON.stringify(response.data, null, 2));

    if (response.data.code !== 0) {
      throw new Error(response.data.msg || 'Coze workflow call failed');
    }

    const executeId = response.data.execute_id || '';
    
    // 解析 data 字段中的结果
    let resultUrls: string[] = [];
    if (response.data.data) {
      try {
        const dataObj = JSON.parse(response.data.data);
        if (dataObj.output && Array.isArray(dataObj.output)) {
          resultUrls = dataObj.output;
        }
      } catch (e) {
        console.error('[Coze] Failed to parse data:', e);
      }
    }
    
    console.log('[Coze] Workflow completed, execute_id:', executeId, 'resultUrls:', resultUrls);
    return { executeId, resultUrls };
  } catch (error: any) {
    console.error('[Coze] Workflow call error:', error.message);
    throw new Error(`Coze workflow call failed: ${error.message}`);
  }
}

// 查询工作流执行状态（用于异步模式）
async function getWorkflowStatus(executeId: string): Promise<{
  status: 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
}> {
  const config = await getCozeConfig();
  
  try {
    const response = await axios.get<CozeWorkflowStatusResponse>(
      `${COZE_API_URL}/workflow/run/${executeId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
        timeout: 10000,
      }
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.msg || 'Failed to get workflow status');
    }

    const data = response.data.data;
    return {
      status: data?.status || 'running',
      output: data?.output ? JSON.parse(data.output) : undefined,
      error: data?.error,
    };
  } catch (error: any) {
    console.error('[Coze] Get status error:', error.message);
    throw new Error(`Failed to get workflow status: ${error.message}`);
  }
}

// 单人换脸（同步模式，直接返回结果）
export async function faceSwapSingle(params: {
  userImageUrl: string;
  templateImageUrls: string[];
}): Promise<{ executeId: string; resultUrls: string[] }> {
  console.log('[Coze] faceSwapSingle called with params:', {
    userImageUrl: params.userImageUrl,
    templateImageUrls: params.templateImageUrls,
  });

  const config = await getCozeConfig();

  // 注意：template_image_url 必须是数组格式
  return callCozeWorkflowSync(config.singleFaceWorkflowId!, {
    image: params.userImageUrl,
    template_image_url: params.templateImageUrls, // 传递数组，不是单个字符串
  });
}

// 双人换脸（同步模式，直接返回结果）
export async function faceSwapCouple(params: {
  user1ImageUrl: string;  // 用户正脸照片
  user2ImageUrl: string;  // 好友正脸照片
  templateImageUrls: string[];  // 选中的模板数组
}): Promise<{ executeId: string; resultUrls: string[] }> {
  console.log('[Coze] faceSwapCouple called with params:', {
    user1ImageUrl: params.user1ImageUrl,
    user2ImageUrl: params.user2ImageUrl,
    templateImageUrls: params.templateImageUrls,
  });

  const config = await getCozeConfig();

  // 注意：template_image_url 必须是数组格式
  return callCozeWorkflowSync(config.doubleFaceWorkflowId!, {
    image1: params.user1ImageUrl,
    image2: params.user2ImageUrl,
    template_image_url: params.templateImageUrls, // 传递数组，不是单个字符串
  });
}

// 用户判别 - 识别性别、年龄类型、脸型（同步模式）
export async function analyzeUserFace(params: {
  userImageUrl: string;
}): Promise<FaceAnalysisResult> {
  console.log('[Coze] analyzeUserFace called with params:', {
    userImageUrl: params.userImageUrl,
  });
  
  const config = await getCozeConfig();
  
  if (!config.apiKey) {
    return {
      success: false,
      executeId: '',
      errorMessage: 'Coze API Key 未配置，请在管理后台 API配置 中设置',
    };
  }
  
  try {
    const response = await axios.post<CozeWorkflowResponse>(
      `${COZE_API_URL}/workflow/run`,
      {
        workflow_id: config.userAnalyzeWorkflowId,
        parameters: {
          image: params.userImageUrl,
          n_pics: 1,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30秒超时
      }
    );

    console.log('[Coze] analyzeUserFace response:', JSON.stringify(response.data, null, 2));

    if (response.data.code !== 0) {
      throw new Error(response.data.msg || 'Coze workflow call failed');
    }

    const executeId = response.data.execute_id || '';
    
    // 解析 data 字段中的结果
    if (response.data.data) {
      try {
        const dataObj = JSON.parse(response.data.data);
        const info = dataObj.info;
        
        if (info) {
          return {
            success: true,
            executeId,
            faceType: info.face_type, // "宽脸" 或 "窄脸"
            gender: info.gender,       // "男" 或 "女"
            userType: info.age,        // "少女"、"熟女"、"奶奶" 等
            description: info.desc,
            package: info.package,
            recommendedUrls: dataObj.urls || [],
            rawResult: dataObj,
          };
        }
      } catch (e) {
        console.error('[Coze] Failed to parse face analysis data:', e);
      }
    }
    
    return {
      success: false,
      executeId,
      errorMessage: '无法解析用户判别结果',
    };
  } catch (error: any) {
    console.error('[Coze] analyzeUserFace error:', error.message);
    return {
      success: false,
      executeId: '',
      errorMessage: error.message,
    };
  }
}

// 用户判别结果接口
export interface FaceAnalysisResult {
  success: boolean;
  executeId: string;
  faceType?: string;      // "宽脸" | "窄脸"
  gender?: string;        // "男" | "女"
  userType?: string;      // "少女" | "熟女" | "奶奶" | "少男" | "大叔" 等
  description?: string;   // 详细描述
  package?: string;       // 推荐包
  recommendedUrls?: string[];
  rawResult?: any;
  errorMessage?: string;
}

// 将中文脸型转换为数据库存储的英文值
export function convertFaceTypeToDb(faceType: string): 'wide' | 'narrow' | null {
  if (faceType === '宽脸') return 'wide';
  if (faceType === '窄脸') return 'narrow';
  return null;
}

// 将数据库英文脸型转换为中文
export function convertFaceTypeFromDb(faceType: string | null): string | null {
  if (faceType === 'wide') return '宽脸';
  if (faceType === 'narrow') return '窄脸';
  return null;
}

// 获取工作流结果
export async function getWorkflowResult(executeId: string) {
  return getWorkflowStatus(executeId);
}

// 解析用户判别结果
export interface UserProfileResult {
  success: boolean;
  gender?: string;
  userType?: string;
  faceType?: string;
  package?: string;
  description?: string;
  recommendedTemplateUrls?: string[];
  errorMessage?: string;
}

export function parseUserProfileResult(output: any): UserProfileResult {
  try {
    if (!output) {
      return { success: false, errorMessage: '无输出结果' };
    }

    const info = output.info;
    const urls = output.urls;

    if (!info?.success) {
      return { 
        success: false, 
        errorMessage: info?.msg || '用户判别失败' 
      };
    }

    return {
      success: true,
      gender: info.data?.gender,
      userType: info.data?.UserType,
      faceType: info.data?.face_type,
      package: info.data?.package,
      description: info.data?.UserAppearanceDescription,
      recommendedTemplateUrls: urls,
    };
  } catch (error: any) {
    return { 
      success: false, 
      errorMessage: `解析结果失败: ${error.message}` 
    };
  }
}

// 解析换脸结果
export interface FaceSwapResult {
  success: boolean;
  resultUrls?: string[];
  errorMessage?: string;
}

export function parseFaceSwapResult(output: any): FaceSwapResult {
  try {
    if (!output) {
      return { success: false, errorMessage: '无输出结果' };
    }

    const urls = output.output;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return { success: false, errorMessage: '未生成换脸图片' };
    }

    return {
      success: true,
      resultUrls: urls,
    };
  } catch (error: any) {
    return { 
      success: false, 
      errorMessage: `解析结果失败: ${error.message}` 
    };
  }
}

// 轮询等待工作流完成（用于异步模式）
export async function waitForWorkflowCompletion(
  executeId: string,
  options?: {
    maxWaitTime?: number;  // 最大等待时间（毫秒），默认 180000 (3分钟)
    pollInterval?: number; // 轮询间隔（毫秒），默认 2000 (2秒)
    onProgress?: (progress: number) => void;
  }
): Promise<{ status: 'completed' | 'failed'; output?: any; error?: string }> {
  const maxWaitTime = options?.maxWaitTime || 180000;
  const pollInterval = options?.pollInterval || 2000;
  const startTime = Date.now();
  let progress = 0;

  while (Date.now() - startTime < maxWaitTime) {
    const result = await getWorkflowStatus(executeId);

    if (result.status === 'completed') {
      options?.onProgress?.(100);
      return { status: 'completed' as const, output: result.output, error: result.error };
    }

    if (result.status === 'failed') {
      return { status: 'failed' as const, output: result.output, error: result.error };
    }

    // 模拟进度
    progress = Math.min(90, progress + Math.random() * 10);
    options?.onProgress?.(Math.floor(progress));

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return { 
    status: 'failed', 
    error: '工作流执行超时' 
  };
}

// 模拟 Coze 工作流（用于开发测试）
export async function mockFaceSwap(params: {
  userImageUrl: string;
  templateImageUrls: string[];
}): Promise<{ resultUrls: string[] }> {
  // 模拟处理延迟
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 返回模板图片作为结果（实际应该是换脸后的图片）
  return {
    resultUrls: params.templateImageUrls,
  };
}
