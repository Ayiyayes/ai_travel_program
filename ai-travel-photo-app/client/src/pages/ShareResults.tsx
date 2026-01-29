import { useState } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Image as ImageIcon,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';

export default function ShareResultsPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = parseInt(params.orderId || '0');
  
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // 获取订单结果图（公开API）
  const { data: orderData, isLoading, error } = trpc.public.orderResults.useQuery(
    { orderId },
    { enabled: orderId > 0, retry: false }
  );

  // 解析结果图URL
  const resultUrls: string[] = orderData?.resultUrls ? JSON.parse(orderData.resultUrls) : [];

  // 打开大图
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // 关闭大图
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // 上一张
  const prevImage = () => {
    setLightboxIndex((prev) => (prev === 0 ? resultUrls.length - 1 : prev - 1));
  };

  // 下一张
  const nextImage = () => {
    setLightboxIndex((prev) => (prev === resultUrls.length - 1 ? 0 : prev + 1));
  };

  // 下载单张图片
  const downloadSingleImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `照片_${index + 1}.jpg`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('下载成功');
    } catch (error) {
      toast.error('下载失败');
    }
  };

  // 保存全部到相册（打包下载）
  const saveAllToAlbum = async () => {
    if (resultUrls.length === 0) {
      toast.error('没有可下载的图片');
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder('我的照片');

      for (let i = 0; i < resultUrls.length; i++) {
        const url = resultUrls[i];
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const extension = url.split('.').pop()?.split('?')[0] || 'jpg';
          folder?.file(`照片_${i + 1}.${extension}`, blob);
          setDownloadProgress(Math.round(((i + 1) / resultUrls.length) * 100));
        } catch (e) {
          console.error(`Failed to download image ${i + 1}:`, e);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = '我的照片.zip';
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success('保存成功');
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
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
        <p className="text-gray-500 text-center">照片不存在或已过期</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf9f6]">
      {/* 顶部标题栏 */}
      <div className="sticky top-0 z-10 bg-[#fdf9f6] border-b border-[#e89a8d]/20 px-4 py-3">
        <h1 className="text-center text-[#6f5d55] font-medium">我的照片</h1>
      </div>

      {/* 照片列表 */}
      <div className="p-4 pb-24">
        {resultUrls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500">暂无照片</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {resultUrls.map((url, index) => (
              <div 
                key={index} 
                className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <img 
                  src={url} 
                  alt={`照片 ${index + 1}`} 
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部保存按钮 */}
      {resultUrls.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#fdf9f6] to-transparent">
          <Button 
            className="w-full h-12 bg-[#e89a8d] hover:bg-[#d88a7d] text-white rounded-full text-base font-medium"
            onClick={saveAllToAlbum}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                保存中 {downloadProgress}%
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                保存相册 ({resultUrls.length}张)
              </>
            )}
          </Button>
        </div>
      )}

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
          <div className="absolute top-4 left-4 z-10 text-white text-sm bg-black/40 px-3 py-1 rounded-full">
            {lightboxIndex + 1} / {resultUrls.length}
          </div>

          {/* 图片 */}
          <img 
            src={resultUrls[lightboxIndex]} 
            alt={`照片 ${lightboxIndex + 1}`}
            className="max-w-full max-h-full object-contain"
          />

          {/* 左右切换按钮 */}
          {resultUrls.length > 1 && (
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

          {/* 底部下载按钮 */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <Button 
              className="bg-[#e89a8d] hover:bg-[#d88a7d] text-white rounded-full px-6"
              onClick={() => downloadSingleImage(resultUrls[lightboxIndex], lightboxIndex)}
            >
              <Download className="w-4 h-4 mr-2" />
              保存这张
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
