import { useState } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  Image as ImageIcon,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function ShareTemplatesPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = parseInt(params.orderId || '0');
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxType, setLightboxType] = useState<'selfie' | 'template'>('template');

  // 获取订单模板信息（公开API）
  const { data: orderData, isLoading, error } = trpc.public.orderTemplates.useQuery(
    { orderId },
    { enabled: orderId > 0, retry: false }
  );

  const templates = orderData?.templates || [];

  // 打开大图
  const openLightbox = (index: number, type: 'selfie' | 'template') => {
    setLightboxIndex(index);
    setLightboxType(type);
    setLightboxOpen(true);
  };

  // 关闭大图
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // 上一张
  const prevImage = () => {
    if (lightboxType === 'template') {
      setLightboxIndex((prev) => (prev === 0 ? templates.length - 1 : prev - 1));
    }
  };

  // 下一张
  const nextImage = () => {
    if (lightboxType === 'template') {
      setLightboxIndex((prev) => (prev === templates.length - 1 ? 0 : prev + 1));
    }
  };

  // 获取当前大图URL
  const getCurrentLightboxUrl = () => {
    if (lightboxType === 'selfie') {
      return orderData?.selfieUrl || '';
    }
    return templates[lightboxIndex]?.imageUrl || '';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fdf9f6] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#e89a8d]" />
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-[#fdf9f6] flex flex-col items-center justify-center gap-4 p-4">
        <ImageIcon className="w-16 h-16 text-gray-300" />
        <p className="text-gray-500 text-center">内容不存在或已过期</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf9f6]">
      {/* 顶部标题栏 */}
      <div className="sticky top-0 z-10 bg-[#fdf9f6] border-b border-[#e89a8d]/20 px-4 py-3">
        <h1 className="text-center text-[#6f5d55] font-medium">订单详情</h1>
      </div>

      {/* 内容区域 */}
      <div className="p-4 space-y-6">
        {/* 自拍照区域 */}
        {orderData.selfieUrl && (
          <div>
            <h2 className="text-sm text-[#6f5d55] font-medium mb-3">自拍照</h2>
            <div 
              className="w-20 h-20 rounded-lg overflow-hidden shadow-sm cursor-pointer"
              onClick={() => openLightbox(0, 'selfie')}
            >
              <img 
                src={orderData.selfieUrl} 
                alt="自拍照" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* 模板照区域 */}
        <div>
          <h2 className="text-sm text-[#6f5d55] font-medium mb-3">模板照</h2>
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">暂无模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {templates.map((template, index) => (
                <div 
                  key={index}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md cursor-pointer"
                  onClick={() => openLightbox(index, 'template')}
                >
                  <img 
                    src={template.imageUrl} 
                    alt={`模板 ${template.templateId}`} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-white text-xs">{template.templateId}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 大图查看器 */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          {/* 关闭按钮 */}
          <button 
            className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-white/20 rounded-full"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* 图片计数 */}
          {lightboxType === 'template' && templates.length > 1 && (
            <div className="absolute top-4 left-4 z-10 text-white text-sm bg-black/40 px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {templates.length}
            </div>
          )}

          {/* 图片 */}
          <img 
            src={getCurrentLightboxUrl()} 
            alt="大图"
            className="max-w-full max-h-full object-contain"
          />

          {/* 左右切换按钮 */}
          {lightboxType === 'template' && templates.length > 1 && (
            <>
              <button 
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/20 rounded-full"
                onClick={prevImage}
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button 
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/20 rounded-full"
                onClick={nextImage}
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
