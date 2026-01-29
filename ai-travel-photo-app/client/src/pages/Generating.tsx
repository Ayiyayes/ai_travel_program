import { useParams, useSearch, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useState, useEffect, useRef, useMemo } from 'react';

// AI 对话消息
const AI_MESSAGES = [
  "小姐姐的照片已在生成了，稍等片刻就好了。",
  "正在分析您的面部特征，让照片更加自然...",
  "AI 正在精心绘制您的专属照片...",
  "正在优化细节，让照片更加完美...",
  "即将完成，请稍候片刻...",
];

export default function GeneratingPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const searchString = useSearch();
  const [, navigate] = useLocation();
  
  // Parse photoIds from URL params (for quick generate) - memoized to prevent infinite loops
  const photoIds = useMemo(() => {
    if (searchString) {
      return new URLSearchParams(searchString).get('photoIds')?.split(',') || [];
    }
    return photoId ? [photoId] : [];
  }, [searchString, photoId]);
  
  // Parse selected template IDs from URL params (for background carousel) - memoized
  const selectedTemplateIds = useMemo(() => {
    if (searchString) {
      return new URLSearchParams(searchString).get('templateIds')?.split(',') || [];
    }
    return [];
  }, [searchString]);
  
  const isMultiMode = photoIds.length > 1;
  
  // 倒计时状态：使用时间戳确保准确性
  const [startTime, setStartTime] = useState<number | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [remainingTime, setRemainingTime] = useState(10); // 默认 10 秒
  
  const [currentMessage, setCurrentMessage] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentTemplateIndex, setCurrentTemplateIndex] = useState(0);
  const [templateImages, setTemplateImages] = useState<string[]>([]);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const templateSwitchRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const templateImagesInitialized = useRef(false);

  // For single photo mode (legacy)
  const { data: photoData } = trpc.photo.getDetail.useQuery(
    { photoId: photoId || '' },
    { enabled: !!photoId && !isMultiMode }
  );

  // For single photo mode (legacy)
  const { refetch } = trpc.photo.getStatus.useQuery(
    { photoId: photoId || '' },
    { 
      enabled: !!photoId && !isMultiMode,
      refetchInterval: false,
    }
  );

  // For quick generate mode (multiple photos)
  const { data: progressData } = trpc.quickGenerate.progress.useQuery(
    { photoIds },
    { enabled: photoIds.length > 0 && photoIds[0] !== '' }
  );

  // 获取模板列表（用于背景图片轮播）
  const { data: templatesData } = trpc.template.list.useQuery({});

  // 初始化模板图片列表 - 使用用户已勾选的模板
  // 只初始化一次，避免无限循环
  useEffect(() => {
    if (templateImagesInitialized.current) return;
    if (!templatesData || templatesData.length === 0) return;
    
    let images: string[] = [];
    
    if (selectedTemplateIds.length > 0) {
      // 使用用户已勾选的模板
      images = templatesData
        .filter((t: any) => selectedTemplateIds.includes(t.id) && t.imageUrl)
        .map((t: any) => t.imageUrl);
    }
    
    // 如果没有勾选的模板或勾选的模板没有图片，使用单张照片的模板
    if (images.length === 0 && photoData?.template?.imageUrl) {
      images = [photoData.template.imageUrl];
    }
    
    // 如果还是没有，使用所有模板（兜底）
    if (images.length === 0) {
      images = templatesData
        .filter((t: any) => t.imageUrl)
        .map((t: any) => t.imageUrl);
    }
    
    if (images.length > 0) {
      templateImagesInitialized.current = true;
      setTemplateImages(images);
      // 随机选择一个模板作为初始背景
      setCurrentTemplateIndex(Math.floor(Math.random() * images.length));
    }
  }, [templatesData, selectedTemplateIds, photoData]);

  // Single photo mode polling
  useEffect(() => {
    if (!photoId || isMultiMode) return;

    pollIntervalRef.current = setInterval(async () => {
      const result = await refetch();
      const status = result.data;
      
      if (status?.status === 'completed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        navigate(`/result/${photoId}`);
      } else if (status?.status === 'failed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        navigate(`/result/${photoId}?error=true`);
      }
    }, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [photoId, isMultiMode, refetch, navigate]);

  // 初始化倒计时 - 只在 photoIds.length 变化时执行
  useEffect(() => {
    // 计算总时长：每个模板 10 秒
    const photoCount = isMultiMode ? photoIds.length : 1;
    const duration = photoCount * 10 * 1000; // 转换为毫秒
    setTotalDuration(duration);
    setStartTime(Date.now());
    setRemainingTime(Math.ceil(duration / 1000));
  }, [photoIds.length, isMultiMode]);

  // 倒计时定时器
  useEffect(() => {
    if (startTime === null || totalDuration === 0) return;

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalDuration - elapsed);
      const remainingSeconds = Math.ceil(remaining / 1000);
      
      setRemainingTime(remainingSeconds);

      // 多张照片模式：倒计时结束时导航到结果页
      if (isMultiMode && remainingSeconds <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        navigate(`/result?photoIds=${photoIds.join(',')}`);
      }
    }, 100); // 每 100ms 更新一次，确保精度

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [startTime, totalDuration, navigate, isMultiMode, photoIds]);

  // Quick generate mode polling and navigation
  useEffect(() => {
    if (!isMultiMode || !progressData) return;

    // Check if all photos are completed
    if (progressData.completedPhotos === progressData.totalPhotos) {
      // Navigate to result page with all photoIds
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      navigate(`/result?photoIds=${photoIds.join(',')}`);
    }
  }, [progressData, photoIds, navigate, isMultiMode]);

  // Update current photo index based on completed count
  useEffect(() => {
    if (progressData) {
      setCurrentPhotoIndex(Math.min(progressData.completedPhotos, progressData.totalPhotos - 1));
    }
  }, [progressData]);

  // 模板轮播：每 3 秒随机切换一个模板
  // 只有当有多张模板时才轮播，单张模板不切换
  useEffect(() => {
    // 如果只有一张模板，不启用轮播
    if (templateImages.length <= 1) return;

    templateSwitchRef.current = setInterval(() => {
      setCurrentTemplateIndex(prev => {
        // 随机选择一个不同的模板
        let newIndex = Math.floor(Math.random() * templateImages.length);
        while (newIndex === prev && templateImages.length > 1) {
          newIndex = Math.floor(Math.random() * templateImages.length);
        }
        return newIndex;
      });
    }, 3000);

    return () => {
      if (templateSwitchRef.current) {
        clearInterval(templateSwitchRef.current);
      }
    };
  }, [templateImages.length]);

  // 切换 AI 消息
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % AI_MESSAGES.length);
    }, 6000);

    return () => clearInterval(messageInterval);
  }, []);

  // 获取当前模板图片 URL
  const templateUrl = templateImages[currentTemplateIndex] || photoData?.template?.imageUrl;

  // 获取当前进度文本
  const progressText = isMultiMode 
    ? `正在生成第 ${currentPhotoIndex + 1}/${photoIds.length} 张...`
    : `正在生成中...`;

  return (
    <div className="mini-app-container relative overflow-hidden">
      {/* 虚化背景 - 使用用户已勾选的模板轮播 */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{ 
          backgroundImage: templateUrl ? `url(${templateUrl})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          filter: 'blur(6px)', // 降低模糊度：从 10px 改为 6px
          transform: 'scale(1.1)',
        }}
      />
      {/* 黑色半透明遮罩 - 调高明亮度：从 25% 改为 15% */}
      <div className="absolute inset-0 bg-black/15" />

      {/* 顶部倒计时显示 - 按照 Figma 设计 */}
      <div className="absolute top-[54px] left-1/2 -translate-x-1/2 z-20">
        <div 
          className="w-[89px] h-[33px] rounded-[25px] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(234, 227, 224, 0.8)' }}
        >
          <span 
            className="text-[#6f5d55] text-base font-normal"
            style={{ fontFamily: 'Arimo, sans-serif' }}
          >
            还剩{remainingTime}秒
          </span>
        </div>
      </div>

      {/* 中间加载动画和进度文字 - 按照 Figma 设计 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        {/* G 形旋转加载图标 - 79x79px */}
        <div className="w-[79px] h-[79px] mb-6">
          <img 
            src="/assets/figma/10038-3152.svg" 
            alt="Loading"
            className="w-full h-full animate-spin"
            style={{ animationDuration: '2s' }}
          />
        </div>
        
        {/* 进度文字 - 按照 Figma 设计 */}
        <p 
          className="text-center opacity-80"
          style={{ 
            color: '#eae3e0', 
            fontSize: '20px', 
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {progressText}
        </p>
      </div>

      {/* 底部智能体对话 - 按照 Figma 设计 */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pb-4 safe-area-bottom">
        <div className="flex flex-col items-center">
          {/* 对话气泡 - 按照 Figma 设计 */}
          <div className="relative mx-[60px] mb-4">
            {/* 气泡主体 */}
            <div 
              className="w-[274px] rounded-lg px-3 py-2 border"
              style={{ 
                backgroundColor: 'rgba(253, 249, 246, 0.9)',
                borderColor: '#6f5d55'
              }}
            >
              <p 
                className="text-[15px] font-normal"
                style={{ 
                  color: '#5d4e44',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                {AI_MESSAGES[currentMessage]}
              </p>
            </div>
            {/* 气泡尖角 - 指向下方 IP 头像 */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-[12px]">
              <img 
                src="/assets/figma/8249-3874.svg" 
                alt="Bubble Arrow"
                className="w-[22px] h-[18px]"
                style={{ transform: 'rotate(180deg)' }}
              />
            </div>
          </div>
          
          {/* IP 头像 - 佛像卡通形象 103x103px */}
          <div className="relative w-[103px] h-[103px]">
            <img 
              src="/assets/figma/I8249-3872;8249-3495.webp" 
              alt="IP Avatar"
              className="w-full h-full object-contain"
            />
            {/* 波形动画图标 */}
            <div className="absolute left-[45px] top-[64px] w-[14px] h-[14px]">
              <img 
                src="/assets/figma/I8249-3872;8249-3507.svg" 
                alt="Waveform"
                className="w-full h-full animate-pulse"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
