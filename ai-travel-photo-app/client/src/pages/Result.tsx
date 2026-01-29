import { useLocation, useParams, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { ChevronLeft, Download, Share2, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface Photo {
  photoId: string;
  resultUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export default function ResultPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const searchString = useSearch();
  const [, navigate] = useLocation();
  
  // 解析 URL 参数
  const photoIds = searchString 
    ? new URLSearchParams(searchString).get('photoIds')?.split(',') || []
    : (photoId ? [photoId] : []);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, isFullscreenSet] = useState(false);
  const [scale, setScale] = useState(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenImageRef = useRef<HTMLImageElement>(null);

  // 获取照片详情
  const { data: photosData } = trpc.photo.getByIds.useQuery(
    { photoIds },
    { enabled: photoIds.length > 0 && photoIds[0] !== '' }
  );

  // 初始化照片列表
  useEffect(() => {
    if (photosData && photosData.length > 0) {
      setPhotos(photosData);
      setIsLoading(false);
    }
  }, [photosData]);

  // 处理滑动事件
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isFullscreen) return;
    
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isFullscreen) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartXRef.current - touchEndX;
    const diffY = touchStartYRef.current - touchEndY;

    // 只处理水平滑动（忽略垂直滑动）
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // 向左滑动，显示下一张
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      } else {
        // 向右滑动，显示上一张
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
      }
    }
  };

  // 处理鼠标拖动事件
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    
    touchStartXRef.current = e.clientX;
    touchStartYRef.current = e.clientY;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isFullscreen) return;
    
    const touchEndX = e.clientX;
    const touchEndY = e.clientY;
    const diffX = touchStartXRef.current - touchEndX;
    const diffY = touchStartYRef.current - touchEndY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      } else {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
      }
    }
  };

  // 全屏放大
  const handleImageClick = () => {
    isFullscreenSet(true);
    setScale(1);
  };

  // 退出全屏
  const handleExitFullscreen = () => {
    isFullscreenSet(false);
    setScale(1);
  };

  // 处理全屏图片点击退出
  const handleFullscreenImageClick = () => {
    handleExitFullscreen();
  };

  // 处理鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (!isFullscreen) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(1, Math.min(3, prev + delta)));
  };

  // 处理双指缩放
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isFullscreen || e.touches.length !== 2) return;
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    const distance = Math.hypot(
      touch1.clientX - touch2.clientX,
      touch1.clientY - touch2.clientY
    );
    
    // 这里需要保存上一次的距离来计算缩放比例
    // 简化实现：暂时不处理
  };

  // 保存照片
  const handleSave = async () => {
    if (!photos[currentIndex]?.resultUrl) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(photos[currentIndex].resultUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-photo-${photos[currentIndex].photoId}.jpg`;
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

  // 分享照片
  const handleShare = async () => {
    if (!photos[currentIndex]?.resultUrl) return;
    
    setIsSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: '我的 AI 旅拍照片',
          text: '看看我用 AI 生成的旅拍照片！',
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

  // 返回
  const handleBack = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="mini-app-container flex items-center justify-center bg-gradient-to-b from-[#FFF9F0] to-[#FFFCF8]">
        <div className="w-12 h-12 border-4 border-[#e89a8d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="mini-app-container flex items-center justify-center bg-gradient-to-b from-[#FFF9F0] to-[#FFFCF8]">
        <p className="text-[#bcaea8]">照片加载失败</p>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];
  const prevPhoto = photos[(currentIndex - 1 + photos.length) % photos.length];
  const nextPhoto = photos[(currentIndex + 1) % photos.length];
  
  // 如果没有 resultUrl，显示加载状态
  if (!currentPhoto?.resultUrl) {
    return (
      <div className="mini-app-container flex items-center justify-center bg-gradient-to-b from-[#FFF9F0] to-[#FFFCF8]">
        <p className="text-[#bcaea8]">照片加载中...</p>
      </div>
    );
  }

  return (
    <div className="mini-app-container relative overflow-hidden bg-gradient-to-b from-[#FFF9F0] to-[#FFFCF8]">
      {/* 全屏模式 */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={handleFullscreenImageClick}
        >
          <img
            ref={fullscreenImageRef}
            src={currentPhoto.resultUrl}
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain"
            style={{
              transform: `scale(${scale})`,
              transition: 'transform 0.2s ease-out',
            }}
            onWheel={handleWheel}
            onTouchMove={handleTouchMove}
          />
          
          {/* 关闭按钮 */}
          <button
            className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition"
            onClick={(e) => {
              e.stopPropagation();
              handleExitFullscreen();
            }}
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* 相册模式 */}
      <div className="relative h-full">
        {/* 顶部导航栏 */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="h-11" />
          <div className="h-[44px] px-2.5 flex items-center justify-between">
            {/* 左侧返回按钮 */}
            <button
              className="flex items-center gap-[3px]"
              onClick={handleBack}
            >
              <ChevronLeft className="w-5 h-5 text-[#6f5d55]" />
              <span className="text-[#6f5d55] text-base">返回</span>
            </button>
            
            {/* 中间照片计数 */}
            {photos.length > 1 && (
              <div className="text-[#6f5d55] text-sm font-medium">
                {currentIndex + 1} / {photos.length}
              </div>
            )}
            
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
        </div>

        {/* 相册容器 */}
        <div
          ref={containerRef}
          className="relative h-full flex items-center justify-center overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          {/* 左侧小图 */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-1/4 h-1/3 mx-2">
            {prevPhoto.resultUrl && (
              <img
                src={prevPhoto.resultUrl}
                alt="Previous"
                className="w-full h-full object-cover rounded-lg opacity-60 shadow-lg"
              />
            )}
          </div>

          {/* 中间大图 */}
          <div className="relative z-20 w-3/5 h-2/3 mx-4 cursor-pointer">
            <img
              src={currentPhoto.resultUrl}
              alt="Current"
              className="w-full h-full object-cover rounded-lg shadow-2xl transition-transform duration-300 hover:shadow-xl"
              onClick={handleImageClick}
            />
          </div>

          {/* 右侧小图 */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-1/4 h-1/3 mx-2">
            {nextPhoto.resultUrl && (
              <img
                src={nextPhoto.resultUrl}
                alt="Next"
                className="w-full h-full object-cover rounded-lg opacity-60 shadow-lg"
              />
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="absolute bottom-0 left-0 right-0 z-20 safe-area-bottom">
          <div className="h-[80px] px-4 py-4 flex items-center justify-center gap-4">
            <button
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition shadow-lg"
              onClick={handleShare}
              disabled={isSharing}
            >
              <Share2 className="w-5 h-5 text-[#e89a8d]" />
              <span className="text-[#333] font-medium text-sm">分享</span>
            </button>
            
            <button
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition shadow-lg"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Download className="w-5 h-5 text-[#e89a8d]" />
              <span className="text-[#333] font-medium text-sm">下载</span>
            </button>
          </div>
        </div>

        {/* 提示文字 */}
        <div className="absolute bottom-24 left-0 right-0 text-center z-10">
          <p className="text-white/70 text-xs">← 左右滑动查看更多 →</p>
        </div>
      </div>
    </div>
  );
}
