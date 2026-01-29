import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { ChevronLeft, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TemplateSelectPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user } = useAuth();
  
  const selfieUrl = new URLSearchParams(searchString).get('selfie');
  
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedScenic, setSelectedScenic] = useState<string>('');
  const [selectedGroupType, setSelectedGroupType] = useState<string>('');
  const [selectedTemplates, setSelectedTemplates] = useState<number[]>([]);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [showGroupTypeSelector, setShowGroupTypeSelector] = useState(false);
  const [fullscreenTemplate, setFullscreenTemplate] = useState<number | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 滚动方向检测
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const lastScrollTop = useRef(0);
  const [showFilters, setShowFilters] = useState(true);
  const [showPaymentBar, setShowPaymentBar] = useState(true);
  
  const [faceAnalysisResult, setFaceAnalysisResult] = useState<{
    faceType?: string;
    gender?: string;
    userType?: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 获取城市列表
  const { data: cities } = trpc.template.cities.useQuery();
  
  // 获取景区列表
  const { data: scenicSpots } = trpc.template.scenicSpots.useQuery(
    { city: selectedCity },
    { enabled: !!selectedCity }
  );
  
  // 获取人群类型列表
  const { data: groupTypes } = trpc.template.groupTypes.useQuery();
  
  // 获取模板列表
  const { data: templates, isLoading } = trpc.template.list.useQuery({
    city: selectedCity || undefined,
    scenicSpot: selectedScenic || undefined,
    groupType: selectedGroupType || undefined,
  });

  // 创建换脸任务
  const createPhotoMutation = trpc.photo.createSingle.useMutation();
  
  // AI 用户判别
  const analyzeUserMutation = trpc.photo.analyzeUser.useMutation();
  
  // 如果有自拍照且还没有进行脸型分析，异步调用用户判别
  useEffect(() => {
    if (selfieUrl && !faceAnalysisResult && !isAnalyzing) {
      setIsAnalyzing(true);
      analyzeUserMutation.mutateAsync({ selfieUrl })
        .then(result => {
          if (result.success) {
            console.log('[TemplateSelect] Face analysis result:', result);
            setFaceAnalysisResult({
              faceType: result.faceType,
              gender: result.gender,
              userType: result.userType,
            });
          }
        })
        .catch(err => {
          console.error('[TemplateSelect] Face analysis error:', err);
        })
        .finally(() => {
          setIsAnalyzing(false);
        });
    }
  }, [selfieUrl]);

  // 累积滚动距离，用于判断是否超过一个模板高度
  const accumulatedScrollRef = useRef(0);
  // 模板卡片高度（约 250px）
  const TEMPLATE_HEIGHT = 250;
  // 滚动方向切换的最小阈值
  const SCROLL_THRESHOLD = 30;
  // 底部区域容差（距离底部多少像素内认为在底部区域）
  const BOTTOM_TOLERANCE = 100;
  // 防抖延迟
  const scrollDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // 记录是否在底部区域
  const isInBottomAreaRef = useRef(false);
  
  // 处理滚动 - 检测滚动方向并控制显示/隐藏
  // 向上滚动：筛选器吸顶显示，支付栏隐藏（需要滚动超过一个模板高度）
  // 向下滚动：筛选器隐藏，支付栏重新出现
  // 滚动到底部：只显示支付栏，且在底部区域内不响应小幅度滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const currentScrollTop = container.scrollTop;
    const scrollDelta = currentScrollTop - lastScrollTop.current;
    const { scrollHeight, clientHeight } = container;
    
    // 检测是否在底部区域（距离底部 BOTTOM_TOLERANCE 像素内）
    const distanceToBottom = scrollHeight - currentScrollTop - clientHeight;
    const isInBottomArea = distanceToBottom < BOTTOM_TOLERANCE;
    const isAtBottom = distanceToBottom < 10;
    
    // 滚动条显示
    setIsScrolling(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1500);
    
    // 如果在底部区域内，只显示支付栏，不响应小幅度滚动
    if (isAtBottom || (isInBottomArea && isInBottomAreaRef.current)) {
      setShowFilters(false);
      setShowPaymentBar(true);
      setScrollDirection('down');
      lastScrollTop.current = currentScrollTop;
      isInBottomAreaRef.current = true;
      // 在底部区域内不累积滚动距离
      accumulatedScrollRef.current = 0;
      return;
    }
    
    // 如果从底部区域离开，重置标记
    if (!isInBottomArea && isInBottomAreaRef.current) {
      isInBottomAreaRef.current = false;
    }
    
    // 检测滚动方向
    if (Math.abs(scrollDelta) > SCROLL_THRESHOLD) {
      if (scrollDelta > 0) {
        // 向下滚动 - 隐藏筛选器，显示支付栏
        setScrollDirection('down');
        setShowFilters(false);
        setShowPaymentBar(true);
        accumulatedScrollRef.current = 0;
        lastScrollTop.current = currentScrollTop;
      } else {
        // 向上滚动 - 累积滚动距离
        accumulatedScrollRef.current += Math.abs(scrollDelta);
        
        // 只有向上滚动超过一个模板高度时，才显示筛选器
        if (accumulatedScrollRef.current >= TEMPLATE_HEIGHT) {
          setScrollDirection('up');
          setShowFilters(true);
          setShowPaymentBar(false);
          accumulatedScrollRef.current = 0;
        }
        lastScrollTop.current = currentScrollTop;
      }
    }
  }, []);

  // 选择城市和景点
  const handleCitySelect = (city: string, scenic?: string) => {
    setSelectedCity(city);
    setSelectedScenic(scenic || '');
    setShowCitySelector(false);
  };

  // 选择人群类型
  const handleGroupTypeSelect = (groupType: string) => {
    setSelectedGroupType(groupType);
    setShowGroupTypeSelector(false);
  };

  // 切换模板选中（点击勾选框或热区）
  const toggleTemplate = (e: React.MouseEvent, templateId: number) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedTemplates(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  // 点击模板中间区域放大查看
  const handleTemplateClick = (templateId: number) => {
    setFullscreenTemplate(templateId);
  };

  // 关闭全屏预览
  const closeFullscreen = () => {
    setFullscreenTemplate(null);
  };

  // Quick generate mutation
  const quickGenerateMutation = trpc.quickGenerate.init.useMutation();

  // 开始生成
  const handleStartGenerate = async () => {
    if (selectedTemplates.length === 0) return;
    
    try {
      // Use quick generate (with lastSelfieUrl from database)
      const result = await quickGenerateMutation.mutateAsync({
        templateIds: selectedTemplates,
      });
      
      // Navigate to generating page with photoIds
      navigate(`/generating?photoIds=${result.photoIds.join(',')}`);
    } catch (err: any) {
      console.error('[TemplateSelect] Quick generate error:', err);
      console.error('[TemplateSelect] Error structure:', {
        message: err?.message,
        data: err?.data,
        code: err?.data?.code,
      });
      
      // tRPC error format: check both message and data.message
      const errorMessage = err?.message || err?.data?.message || err?.toString() || '';
      console.error('[TemplateSelect] Error message:', errorMessage);
      
      if (errorMessage.includes('请先拍照')) {
        console.log('[TemplateSelect] Navigating to camera page');
        navigate(`/camera?templates=${selectedTemplates.join(',')}`);
      } else {
        console.error('[TemplateSelect] Unexpected error:', errorMessage);
      }
    }
  };

  // 返回我的照片页
  const handleBack = () => {
    navigate('/profile/photos');
  };

  // 计算价格
  const totalPoints = selectedTemplates.reduce((sum, id) => {
    const template = templates?.find(t => t.id === id);
    return sum + (template?.price || 0);
  }, 0);
  const userPoints = user?.points || 0;
  const discountPoints = Math.min(userPoints, totalPoints);
  const finalPrice = totalPoints - discountPoints;

  // 获取当前选中的景点显示名称
  const currentScenicDisplay = selectedScenic || selectedCity || '选择景点';
  
  // 获取当前选中的人群类型显示名称
  const currentGroupTypeDisplay = groupTypes?.find(g => g.code === selectedGroupType)?.displayName || selectedGroupType || '选择人群';

  // 获取全屏预览的模板
  const fullscreenTemplateData = fullscreenTemplate ? templates?.find(t => t.id === fullscreenTemplate) : null;

  return (
    <div className="mini-app-container bg-[#fdf9f6] overflow-hidden flex flex-col">
      {/* 顶部状态栏 */}
      <div className="h-11 flex-shrink-0" />
      
      {/* 顶部导航栏 */}
      <div className="h-[44px] px-2.5 flex items-center justify-between flex-shrink-0">
        {/* 左侧：我的照片 */}
        <button
          className="flex items-center gap-[3px]"
          onClick={handleBack}
        >
          <ChevronLeft className="w-5 h-5 text-[#6f5d55]" />
          <span className="text-[#6f5d55] text-base">我的照片</span>
        </button>
        
        {/* 右侧：微信胶囊按钮 */}
        <div className="flex items-center h-8 bg-white rounded-[18.55px] border border-[#e9e9e9] px-2">
          <div className="flex items-center justify-center w-8 h-full">
            <div className="flex gap-[3px]">
              <div className="w-[4px] h-[4px] rounded-full bg-[#333]" />
              <div className="w-[4px] h-[4px] rounded-full bg-[#333]" />
              <div className="w-[4px] h-[4px] rounded-full bg-[#333]" />
            </div>
          </div>
          <div className="w-[0.5px] h-5 bg-[#e9e9e9]" />
          <div className="flex items-center justify-center w-8 h-full">
            <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-[#333]" />
          </div>
        </div>
      </div>

      {/* 筛选器区域 - 吸顶效果，使用固定高度避免页面跳动 */}
      <div 
        className="h-[42px] flex-shrink-0 relative"
      >
        <div 
          className={cn(
            "absolute inset-0 px-3 py-1.5 flex gap-3 transition-all duration-300 bg-[#fdf9f6] z-20",
            showFilters ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"
          )}
        >
        {/* 城市景点选择器 */}
        <button
          className="flex-1 h-[26px] bg-white rounded-[7px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.13)] flex items-center justify-center gap-1 px-3"
          onClick={() => setShowCitySelector(true)}
        >
          <span className="text-[#6f5d55] text-base tracking-[0.2em]">
            {currentScenicDisplay}
          </span>
          <ChevronDown className="w-5 h-5 text-[#6f5d55] -rotate-0" />
        </button>

        {/* 人群类型选择器 */}
        <button
          className="flex-1 h-[26px] bg-white rounded-[7px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.13)] flex items-center justify-center gap-1 px-3"
          onClick={() => setShowGroupTypeSelector(true)}
        >
          <span className="text-[#6f5d55] text-base tracking-[0.2em]">
            {currentGroupTypeDisplay}
          </span>
          <ChevronDown className="w-5 h-5 text-[#6f5d55] -rotate-0" />
        </button>
        </div>
      </div>

      {/* 模板瀑布流区域 */}
      <div 
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto px-3 relative",
          selectedTemplates.length > 0 && showPaymentBar ? "pb-[100px]" : "pb-4"
        )}
        onScroll={handleScroll}
        style={{
          scrollbarWidth: isScrolling ? 'thin' : 'none',
          scrollbarColor: 'rgba(188, 174, 168, 0.7) transparent',
        }}
      >
        {/* 自定义滚动条 */}
        {isScrolling && (
          <div className="fixed right-[1px] top-[110px] bottom-[100px] w-2 z-10 pointer-events-none">
            <div className="w-2 h-[109px] bg-[#bcaea8]/70 rounded-[5px]" />
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 pt-1">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="aspect-[179/250] rounded-[15px] image-placeholder" />
            ))}
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 pt-1">
            {templates.map(template => (
              <div
                key={template.id}
                className="aspect-[179/250] rounded-[15px] shadow-[3px_3px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden relative cursor-pointer"
                onClick={() => handleTemplateClick(template.id)}
              >
                <img
                  src={template.thumbnailUrl || template.imageUrl}
                  alt={template.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* 半扇形勾选热区 - 以右下角为圆心 */}
                <div 
                  className="absolute bottom-0 right-0 w-[80px] h-[80px] z-10"
                  style={{
                    clipPath: 'circle(80px at 100% 100%)',
                  }}
                  onClick={(e) => toggleTemplate(e, template.id)}
                />
                {/* 勾选框显示 */}
                <div 
                  className={cn(
                    "absolute bottom-3 right-2 w-7 h-7 rounded-md flex items-center justify-center pointer-events-none",
                    selectedTemplates.includes(template.id) 
                      ? "bg-[#e89a8d]" 
                      : "bg-black/0 outline outline-1 outline-offset-[-1px] outline-white"
                  )}
                >
                  {selectedTemplates.includes(template.id) && (
                    <Check className="w-[18px] h-[13px] text-white" strokeWidth={3} />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-[#bcaea8]">
            <svg className="w-16 h-16 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p>暂无符合条件的模板</p>
          </div>
        )}
      </div>

      {/* 底部支付栏 - 仅在选中模板时显示，滚动时可隐藏 */}
      {selectedTemplates.length > 0 && (
        <div 
          className={cn(
            "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] h-[92px] bg-white safe-area-bottom transition-all duration-300 z-30",
            selectedTemplates.length > 0 && showPaymentBar ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          )}
        >
          {/* IP形象头像 */}
          <div className="absolute left-0 top-[-10px] w-[103px] h-[103px]">
            <img 
              src="/assets/ip-avatar-p6.webp" 
              alt="IP Avatar"
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* 价格信息 - 垂直居中 */}
          <div className="absolute left-[96px] top-1/2 -translate-y-1/2 flex flex-col justify-center">
            <div className="flex items-baseline">
              <span className="text-[#e89a8d] text-base">到手仅支付</span>
              <span className="text-[#e89a8d] text-[40px] font-bold ml-2 font-['Archivo_Narrow'] leading-none">{finalPrice}</span>
              <span className="text-[#e89a8d] text-[15px] ml-1">￥</span>
            </div>
            <div className="text-[#6f5d55] text-xs mt-1">
              您共消耗积分{totalPoints}  已抵扣{discountPoints}分
            </div>
          </div>
          
          {/* 拍照留念按钮容器 - 使用相对定位包含按钮和角标 */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {/* 模板选择计数角标 - 显示在按钮左上角 */}
            <div className="absolute -left-2 -top-2 w-[21px] h-[21px] bg-[#d9534f] rounded-full flex items-center justify-center z-50 shadow-md">
              <span className="text-white text-[13px] font-medium">{selectedTemplates.length}</span>
            </div>
            {/* 拍照留念按钮 */}
            <button
              className="w-[137px] h-[60px] bg-[#e89a8d] rounded-lg flex items-center justify-center"
              onClick={handleStartGenerate}
              disabled={quickGenerateMutation.isPending}
            >
              <span className="text-white text-[28px] font-bold">
                {quickGenerateMutation.isPending ? '処理中...' : '拍照留念'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 城市景点选择器弹窗 */}
      {showCitySelector && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0ebe8]">
              <span className="text-[#6f5d55] font-medium">选择城市景点</span>
              <button onClick={() => setShowCitySelector(false)}>
                <X className="w-6 h-6 text-[#bcaea8]" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {/* 显示所有城市和景点 */}
              {cities?.map(city => (
                <div key={`all-${city}`} className="mb-4">
                  <div className="text-[#6f5d55] font-medium mb-2">{city}</div>
                  <CityScenicsSelector 
                    city={city} 
                    selectedCity={selectedCity}
                    selectedScenic={selectedScenic}
                    onSelect={handleCitySelect}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 人群类型选择器弹窗 */}
      {showGroupTypeSelector && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-2xl max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0ebe8]">
              <span className="text-[#6f5d55] font-medium">选择人群类型</span>
              <button onClick={() => setShowGroupTypeSelector(false)}>
                <X className="w-6 h-6 text-[#bcaea8]" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              <div className="flex flex-wrap gap-3">
                <button
                  className={cn(
                    "px-6 py-3 rounded-full text-base",
                    !selectedGroupType
                      ? "bg-[#e89a8d] text-white"
                      : "bg-[#f5ebe5] text-[#6f5d55]"
                  )}
                  onClick={() => handleGroupTypeSelect('')}
                >
                  全部
                </button>
                {groupTypes?.map(type => (
                  <button
                    key={type.code}
                    className={cn(
                      "px-6 py-3 rounded-full text-base",
                      selectedGroupType === type.code
                        ? "bg-[#e89a8d] text-white"
                        : "bg-[#f5ebe5] text-[#6f5d55]"
                    )}
                    onClick={() => handleGroupTypeSelect(type.code)}
                  >
                    {type.displayName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 全屏模板预览 */}
      {fullscreenTemplate && fullscreenTemplateData && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={closeFullscreen}
        >
          <img
            src={fullscreenTemplateData.imageUrl}
            alt={fullscreenTemplateData.name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

// 城市景点选择器子组件
function CityScenicsSelector({ 
  city, 
  selectedCity, 
  selectedScenic,
  onSelect 
}: { 
  city: string;
  selectedCity: string;
  selectedScenic: string;
  onSelect: (city: string, scenic?: string) => void;
}) {
  const { data: scenicSpots } = trpc.template.scenicSpots.useQuery(
    { city },
    { enabled: true }
  );

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={cn(
          "px-4 py-2 rounded-full text-sm",
          selectedCity === city && !selectedScenic
            ? "bg-[#e89a8d] text-white"
            : "bg-[#f5ebe5] text-[#6f5d55]"
        )}
        onClick={() => onSelect(city)}
      >
        全部
      </button>
      {scenicSpots?.map(scenic => (
        <button
          key={scenic}
          className={cn(
            "px-4 py-2 rounded-full text-sm",
            selectedCity === city && selectedScenic === scenic
              ? "bg-[#e89a8d] text-white"
              : "bg-[#f5ebe5] text-[#6f5d55]"
          )}
          onClick={() => onSelect(city, scenic)}
        >
          {scenic}
        </button>
      ))}
    </div>
  );
}
