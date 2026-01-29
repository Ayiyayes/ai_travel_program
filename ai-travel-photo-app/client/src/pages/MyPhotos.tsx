import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { ChevronLeft, Image, RotateCcw, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function MyPhotosPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();

  // 获取照片列表
  const { data: photos, isLoading } = trpc.photo.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // 获取用户积分
  const { data: userData } = trpc.user.profile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // 按日期分组照片
  const groupedPhotos = photos?.reduce((groups: Record<string, typeof photos>, photo) => {
    const date = format(new Date(photo.createdAt), 'yyyy年M月d日', { locale: zhCN });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(photo);
    return groups;
  }, {}) || {};

  // 点击照片
  const handlePhotoClick = (photo: any) => {
    if (photo.status === 'completed') {
      navigate(`/result/${photo.photoId}`);
    } else if (photo.status === 'processing' || photo.status === 'pending') {
      navigate(`/generating/${photo.photoId}`);
    }
  };

  // 重试失败的照片
  const handleRetry = (photo: any, e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: 实现重试逻辑
    navigate(`/camera?templates=${photo.templateId}`);
  };

  // 更换自拍
  const handleChangeSelfie = () => {
    navigate('/camera');
  };

  // 返回
  const handleBack = () => {
    window.history.back();
  };

  // 计算消耗积分
  const totalPhotos = photos?.length || 0;
  const consumedPoints = totalPhotos * 10; // 假设每张照片消耗10积分
  const remainingPoints = userData?.points || 0;

  return (
    <div className="mini-app-container bg-white">
      {/* 顶部导航 */}
      <div className="safe-area-top bg-white sticky top-0 z-10">
        <div className="h-11" />
        <div className="h-[54px] px-4 flex items-center">
          <button
            className="flex items-center gap-1 text-[#333]"
            onClick={handleBack}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-base">返回</span>
          </button>
        </div>
      </div>

      {/* 照片列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-32">
        {isLoading ? (
          <div className="px-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[3/4] rounded-xl image-placeholder" />
              ))}
            </div>
          </div>
        ) : Object.keys(groupedPhotos).length > 0 ? (
          Object.entries(groupedPhotos).map(([date, datePhotos]) => (
            <div key={date} className="mb-6">
              {/* 日期标题 */}
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-[#e89a8d] rounded-full" />
                <span className="text-[#333] font-medium">{date}</span>
                {/* 可以添加地点信息 */}
                <span className="text-[#999] text-sm">长沙橘子洲</span>
              </div>

              {/* 照片网格 - 瀑布流 */}
              <div className="px-4 grid grid-cols-2 gap-3">
                {datePhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className={cn(
                      "relative rounded-xl overflow-hidden shadow-sm cursor-pointer",
                      index % 3 === 0 ? "aspect-[3/4]" : "aspect-square"
                    )}
                    onClick={() => handlePhotoClick(photo)}
                  >
                    {/* 照片 */}
                    {photo.status === 'completed' && photo.resultUrl ? (
                      <img
                        src={photo.resultUrl}
                        alt="Photo"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : photo.status === 'failed' ? (
                      // 失败状态 - 模糊背景 + 重试按钮
                      <div className="w-full h-full relative">
                        <div 
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ 
                            backgroundImage: `url(${photo.selfieUrl || ''})`,
                            filter: 'blur(8px)',
                            transform: 'scale(1.1)'
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <button
                            className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm"
                            onClick={(e) => handleRetry(photo, e)}
                          >
                            <RotateCcw className="w-4 h-4 text-[#666]" />
                            <span className="text-[#333] text-sm">重试</span>
                          </button>
                          <div className="mt-3 text-center">
                            <p className="text-white/90 text-xs">错误码:{photo.errorMessage || '333'}</p>
                            <p className="text-white/70 text-xs mt-1">请联系18600000000处理</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 生成中状态
                      <div className="w-full h-full bg-[#f5ebe5] flex items-center justify-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-2 border-[#e89a8d] border-t-transparent rounded-full animate-spin mb-2" />
                          <span className="text-xs text-[#bcaea8]">生成中...</span>
                        </div>
                      </div>
                    )}

                    {/* 四角边框装饰 - 仅失败状态显示 */}
                    {photo.status === 'failed' && (
                      <>
                        <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-white/60" />
                        <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-white/60" />
                        <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-white/60" />
                        <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-white/60" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-[#bcaea8]">
            <Image className="w-16 h-16 mb-4" />
            <p className="mb-4">暂无照片</p>
            <button
              className="px-6 py-2 bg-[#e89a8d] text-white rounded-full text-sm"
              onClick={() => navigate('/')}
            >
              去生成照片
            </button>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#f0ebe8] safe-area-bottom">
        <div className="flex items-center justify-between px-4 py-3">
          {/* 智能体头像 */}
          <div className="w-14 h-14 rounded-full bg-[#f5d5c8] flex items-center justify-center overflow-hidden">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#ffe4d6] flex items-center justify-center">
                <div className="flex gap-1.5 -mt-0.5">
                  <div className="w-1 h-1 rounded-full bg-[#333]" />
                  <div className="w-1 h-1 rounded-full bg-[#333]" />
                </div>
              </div>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-7 h-3 bg-[#e8a090] rounded-t-full" />
            </div>
          </div>

          {/* 积分信息 */}
          <div className="flex-1 px-4">
            <div className="text-[#e89a8d] text-base font-medium">还剩积分{remainingPoints}分</div>
            <div className="text-[#999] text-xs">已消耗积分{consumedPoints}分</div>
          </div>

          {/* 更换自拍按钮 */}
          <button
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#f5d5c8] to-[#e89a8d] rounded-full"
            onClick={handleChangeSelfie}
          >
            <Camera className="w-5 h-5 text-white" />
            <span className="text-white font-medium">更换自拍</span>
          </button>
        </div>
      </div>
    </div>
  );
}
