import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';

interface Photo {
  photoId: string;
  resultUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// 微信小程序风格顶部导航栏组件 - 使用 flex 布局而不是 absolute
function MiniAppHeader({ 
  title, 
  onBack 
}: { 
  title: string; 
  onBack: () => void;
}) {
  return (
    <>
      {/* iPhone 状态栏区域 - 44px */}
      <div className="h-11 flex-shrink-0" />
      
      {/* 导航栏 - 44px */}
      <div className="h-[44px] px-2.5 flex items-center justify-between flex-shrink-0">
        {/* 左侧返回按钮 */}
        <button 
          onClick={onBack}
          className="flex items-center gap-[3px]"
        >
          <ChevronLeft className="w-5 h-5 text-[#6f5d55]" />
          <span className="text-[#6f5d55] text-base">{title}</span>
        </button>
        
        {/* 右侧微信胶囊按钮 */}
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
    </>
  );
}

// 底部导航栏组件 - 按照 Figma 设计
function BottomNavBar({
  onSave,
  onRetake,
  onShare,
  isSaving,
  isSharing,
}: {
  onSave: () => void;
  onRetake: () => void;
  onShare: () => void;
  isSaving: boolean;
  isSharing: boolean;
}) {
  return (
    <div className="flex-shrink-0 bg-white safe-area-bottom">
      <div className="flex items-end justify-start gap-4 px-4 py-3">
        {/* IP 头像 - 佛像卡通形象 */}
        <div className="relative flex-shrink-0" style={{ width: '80px', height: '80px', marginTop: '-15px' }}>
          <img 
            src="/assets/figma/10051-2973.webp" 
            alt="IP Avatar"
            className="w-full h-full object-contain"
          />
          {/* 波形动画图标 */}
          <div className="absolute" style={{ left: '34px', top: '50px', width: '12px', height: '12px' }}>
            <img 
              src="/assets/figma/10051-2978.svg" 
              alt="Waveform"
              className="w-full h-full animate-pulse"
            />
          </div>
        </div>

        {/* 保存相册按钮 */}
        <button
          className={cn('flex flex-col items-center', isSaving && 'opacity-50')}
          onClick={onSave}
          disabled={isSaving}
        >
          <div className="w-[55px] h-[55px] rounded-full bg-[#eae3e0] flex items-center justify-center mb-1">
            <img 
              src="/assets/figma/8010-3278.svg" 
              alt="Save"
              className="w-[24px] h-[24px]"
            />
          </div>
          <span className="text-[#6f5d55] text-xs whitespace-nowrap">保存相册</span>
        </button>

        {/* 再来一张按钮 - 粉红色主色调 */}
        <button 
          className="flex flex-col items-center" 
          onClick={onRetake}
        >
          <div className="w-[55px] h-[55px] rounded-full bg-[#e89a8d] flex items-center justify-center mb-1">
            <img 
              src="/assets/figma/8010-3320.svg" 
              alt="Retake"
              className="w-[26px] h-[26px]"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>
          <span className="text-[#6f5d55] text-xs whitespace-nowrap">再来一张</span>
        </button>

        {/* 分享好友按钮 */}
        <button
          className={cn('flex flex-col items-center', isSharing && 'opacity-50')}
          onClick={onShare}
          disabled={isSharing}
        >
          <div className="w-[55px] h-[55px] rounded-full bg-[#eae3e0] flex items-center justify-center mb-1">
            <img 
              src="/assets/figma/8010-3267.svg" 
              alt="Share"
              className="w-[24px] h-[24px]"
            />
          </div>
          <span className="text-[#6f5d55] text-xs whitespace-nowrap">分享好友</span>
        </button>
      </div>
    </div>
  );
}

export default function PhotoResultPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const searchString = useSearch();
  const [, navigate] = useLocation();
  
  const photoIds = searchString 
    ? new URLSearchParams(searchString).get('photoIds')?.split(',').filter(Boolean) || []
    : (photoId ? [photoId] : []);
  
  const isError = new URLSearchParams(searchString).get('error') === 'true';
  const isTestMode = photoId?.startsWith('test') || photoId === 'demo';
  const isMultiMode = photoIds.length > 1;
  
  const [displayedPhotos, setDisplayedPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: singlePhotoData, isLoading: singleLoading } = trpc.photo.getDetail.useQuery(
    { photoId: photoId || '' },
    { enabled: !!photoId && !isTestMode && !isMultiMode }
  );

  // 获取多张照片信息（快速生成模式） - 每 1 秒轮询一次
  const { data: multiPhotosData } = trpc.photo.getByIds.useQuery(
    { photoIds },
    { enabled: photoIds.length > 0 && photoIds[0] !== '', refetchInterval: 1000 }
  );

  useEffect(() => {
    if (!isMultiMode && singlePhotoData?.photo) {
      setDisplayedPhotos([singlePhotoData.photo]);
      setCurrentIndex(0);
    }
  }, [singlePhotoData, isMultiMode]);

  useEffect(() => {
    if (!isMultiMode || !multiPhotosData) return;

    const completed = multiPhotosData.filter((p: Photo) => p.status === 'completed');
    if (completed.length > 0) {
      setDisplayedPhotos(completed);
      if (currentIndex >= completed.length) {
        setCurrentIndex(0);
      }
    }
  }, [isMultiMode, multiPhotosData]);

  // 测试用照片数据
  const testPhotos = [
    {
      photoId: 'test1',
      resultUrl: 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=800',
      status: 'completed' as const,
    },
    {
      photoId: 'test2',
      resultUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
      status: 'completed' as const,
    },
  ];

  // 如果是测试模式且没有照片，使用测试数据
  useEffect(() => {
    if (isTestMode && displayedPhotos.length === 0) {
      setDisplayedPhotos(testPhotos);
    }
  }, [isTestMode]);

  const currentPhoto = displayedPhotos[currentIndex] || null;
  
  // 获取右侧小图列表（当前图片之后的所有图片）
  const rightPhotos = displayedPhotos.slice(currentIndex + 1);
  
  // 获取左侧小图列表（当前图片之前的所有图片）
  const leftPhotos = displayedPhotos.slice(0, currentIndex);

  const handleSave = async () => {
    if (!currentPhoto?.resultUrl) return;

    setIsSaving(true);
    try {
      const response = await fetch(currentPhoto.resultUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-photo-${currentPhoto.photoId}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('照片已保存');
    } catch (err) {
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!currentPhoto?.resultUrl) return;

    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AI 旅拍换脸',
          text: '看看我的古风写真照片！',
          url: window.location.href,
        });
        toast.success('分享成功');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('链接已复制');
      }
    } catch (err) {
      // 用户取消分享
    } finally {
      setIsSharing(false);
    }
  };

  const { user } = useAuth();

  const handleRetake = () => {
    navigate('/templates?type=single');
  };

  const handleBack = () => {
    navigate('/');
  };

  // 向左滑动：显示下一张
  const handleSwipeLeft = () => {
    if (currentIndex < displayedPhotos.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setScale(1);
    }
  };

  // 向右滑动：显示上一张
  const handleSwipeRight = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setScale(1);
    }
  };

  // 点击右侧小图：切换到该图片
  const handleClickRightPhoto = (index: number) => {
    const newIndex = currentIndex + 1 + index;
    setCurrentIndex(newIndex);
    setScale(1);
  };

  // 点击左侧小图：切换到该图片
  const handleClickLeftPhoto = (index: number) => {
    setCurrentIndex(index);
    setScale(1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || displayedPhotos.length <= 1) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // 向左滑动 -> 显示下一张
        handleSwipeLeft();
      } else {
        // 向右滑动 -> 显示上一张
        handleSwipeRight();
      }
    }
    setTouchStart(null);
  };

  const handleImageClick = () => {
    setIsFullscreen(true);
    setScale(1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isFullscreen) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(1, Math.min(3, prev + delta)));
  };

  // 加载中状态
  if (!isTestMode && !isMultiMode && singleLoading) {
    return (
      <div className="mini-app-container flex flex-col bg-[#fdf9f6]">
        <MiniAppHeader title="返回" onBack={handleBack} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#e89a8d] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // 错误状态
  if (isError || currentPhoto?.status === 'failed') {
    return (
      <div className="mini-app-container relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-purple-600" />
        <div className="absolute inset-0 bg-black/20" />

        <MiniAppHeader title="返回" onBack={handleBack} />

        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <button
            className="flex items-center gap-2 px-8 py-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg"
            onClick={() => navigate('/')}
          >
            <span className="text-[#333] font-medium">重试</span>
          </button>

          <div className="mt-6 text-center">
            <p className="text-white/90 text-base">网络开小差 请稍后重试</p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 pb-8 safe-area-bottom">
          <div className="flex flex-col items-center">
            <div className="mx-6 mb-4 bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-3 relative">
              <p className="text-[#333] text-sm leading-relaxed">
                出了点小问题，不要着急，跟我说说你的这趟旅程吧！
              </p>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/95 rotate-45" />
            </div>

            <div className="w-16 h-16 rounded-full bg-[#f5d5c8] flex items-center justify-center overflow-hidden">
              <img 
                src="/assets/figma/10051-2973.webp" 
                alt="IP Avatar"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 全屏放大模式
  const FullscreenView = () => (
    <div 
      className="fixed inset-0 z-50 bg-black flex items-center justify-center" 
      onClick={() => setIsFullscreen(false)}
    >
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-auto" 
        onWheel={handleWheel}
      >
        <img
          src={currentPhoto?.resultUrl || ''}
          alt="Fullscreen"
          className="max-w-full max-h-full transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center bg-black/50 rounded-full"
          onClick={() => setIsFullscreen(false)}
        >
          ✕
        </button>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
          滚轮缩放 · 点击关闭
        </div>
      </div>
    </div>
  );

  // 有照片时的正常显示 - 手机相册风格
  if (currentPhoto) {
    return (
      <div 
        className="mini-app-container flex flex-col overflow-hidden bg-[#fdf9f6]"
        ref={containerRef}
        tabIndex={0}
      >
        {isFullscreen && <FullscreenView />}

        {/* 顶部导航栏 */}
        <MiniAppHeader title="返回" onBack={handleBack} />

        {/* 照片计数指示器 */}
        {displayedPhotos.length > 1 && (
          <div className="flex-shrink-0 flex justify-center py-2">
            <span className="text-[#6f5d55] text-sm font-medium">
              {currentIndex + 1} / {displayedPhotos.length}
            </span>
          </div>
        )}

        {/* 相册轮播区域 - 手机相册风格 */}
        <div
          className="flex-1 flex items-center justify-center relative"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* 左侧小图队列 - 当前图片之前的图片 */}
            {leftPhotos.length > 0 && (
              <div className="absolute left-2 z-10 flex flex-col gap-2">
                {leftPhotos.slice(-2).map((photo, index) => {
                  const actualIndex = leftPhotos.length > 2 ? leftPhotos.length - 2 + index : index;
                  return (
                    <button
                      key={photo.photoId}
                      onClick={() => handleClickLeftPhoto(actualIndex)}
                      className="flex-shrink-0 transition-all hover:scale-105"
                      style={{
                        transform: `perspective(1000px) rotateY(15deg)`,
                        opacity: 0.7,
                      }}
                    >
                      <img
                        src={photo.resultUrl || ''}
                        alt={`Photo ${actualIndex + 1}`}
                        className="w-[60px] h-[90px] object-cover rounded-lg shadow-lg"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* 中间大图 */}
            <button
              onClick={handleImageClick}
              className="flex-shrink-0 z-20"
            >
              <img
                src={currentPhoto.resultUrl || ''}
                alt="Current"
                className="w-[220px] h-[330px] object-cover rounded-xl shadow-2xl cursor-pointer hover:shadow-3xl transition-shadow"
              />
            </button>

            {/* 右侧小图队列 - 当前图片之后的图片 */}
            {rightPhotos.length > 0 && (
              <div className="absolute right-2 z-10 flex flex-col gap-2">
                {rightPhotos.slice(0, 2).map((photo, index) => (
                  <button
                    key={photo.photoId}
                    onClick={() => handleClickRightPhoto(index)}
                    className="flex-shrink-0 transition-all hover:scale-105"
                    style={{
                      transform: `perspective(1000px) rotateY(-15deg)`,
                      opacity: 0.7,
                    }}
                  >
                    <img
                      src={photo.resultUrl || ''}
                      alt={`Photo ${currentIndex + 2 + index}`}
                      className="w-[60px] h-[90px] object-cover rounded-lg shadow-lg"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* 左右滑动提示箭头 */}
            {currentIndex > 0 && (
              <button 
                onClick={handleSwipeRight}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center bg-white/50 rounded-full shadow-md"
              >
                <ChevronLeft className="w-6 h-6 text-[#6f5d55]" />
              </button>
            )}
            {currentIndex < displayedPhotos.length - 1 && (
              <button 
                onClick={handleSwipeLeft}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-10 h-10 flex items-center justify-center bg-white/50 rounded-full shadow-md"
              >
                <ChevronRight className="w-6 h-6 text-[#6f5d55]" />
              </button>
            )}
          </div>
        </div>

        {/* 滑动提示文字 */}
        {displayedPhotos.length > 1 && (
          <div className="flex-shrink-0 flex justify-center py-2">
            <span className="text-[#6f5d55]/60 text-xs">← 左右滑动查看更多 →</span>
          </div>
        )}

        {/* 底部导航栏 */}
        <BottomNavBar
          onSave={handleSave}
          onRetake={handleRetake}
          onShare={handleShare}
          isSaving={isSaving}
          isSharing={isSharing}
        />
      </div>
    );
  }

  // 加载中状态（多张照片模式）
  if (isMultiMode) {
    return (
      <div className="mini-app-container flex flex-col bg-[#fdf9f6]">
        <MiniAppHeader title="返回" onBack={handleBack} />
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#e89a8d] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#6f5d55] text-base">正在加载照片...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mini-app-container flex flex-col bg-[#fdf9f6]">
      <MiniAppHeader title="返回" onBack={handleBack} />
      
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#e89a8d] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
