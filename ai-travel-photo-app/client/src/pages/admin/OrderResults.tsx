import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import JSZip from 'jszip';

// 订单状态配置
const ORDER_STATUS = {
  pending: { label: '待支付', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: '已支付', color: 'bg-green-100 text-green-800' },
  completed: { label: '已完成', color: 'bg-blue-100 text-blue-800' },
  failed: { label: '失败', color: 'bg-red-100 text-red-800' },
};

export default function OrderResultsPage() {
  const params = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();
  const orderId = parseInt(params.orderId || '0');
  
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // 获取订单详情
  const { data: order, isLoading, error } = trpc.admin.orderDetail.useQuery(
    { orderId },
    { enabled: orderId > 0 }
  );

  // 解析结果图URL
  const resultUrls: string[] = order?.resultUrls ? JSON.parse(order.resultUrls) : [];

  // 下载单张图片
  const downloadSingleImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `结果图_${order?.orderNo}_${index + 1}.jpg`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast.error('下载失败');
    }
  };

  // 打包下载所有图片
  const downloadAllImages = async () => {
    if (resultUrls.length === 0) {
      toast.error('没有可下载的图片');
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder(`订单结果图_${order?.orderNo}`);

      for (let i = 0; i < resultUrls.length; i++) {
        const url = resultUrls[i];
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const extension = url.split('.').pop()?.split('?')[0] || 'jpg';
          folder?.file(`结果图_${i + 1}.${extension}`, blob);
          setDownloadProgress(Math.round(((i + 1) / resultUrls.length) * 100));
        } catch (e) {
          console.error(`Failed to download image ${i + 1}:`, e);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `订单结果图_${order?.orderNo}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success('下载完成');
    } catch (error) {
      toast.error('打包下载失败');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !order) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <XCircle className="w-12 h-12 text-red-500" />
          <p className="text-muted-foreground">订单不存在或加载失败</p>
          <Button variant="outline" onClick={() => setLocation('/admin/orders')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回订单列表
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setLocation('/admin/orders')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#6f5d55]">订单结果图</h1>
              <p className="text-muted-foreground">订单号：{order.orderNo}</p>
            </div>
          </div>
          <Button 
            onClick={downloadAllImages} 
            disabled={downloading || resultUrls.length === 0}
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                下载中 {downloadProgress}%
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                打包下载全部 ({resultUrls.length}张)
              </>
            )}
          </Button>
        </div>

        {/* 订单信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">订单信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">订单状态</p>
                <Badge className={ORDER_STATUS[order.orderStatus as keyof typeof ORDER_STATUS]?.color || ''}>
                  {ORDER_STATUS[order.orderStatus as keyof typeof ORDER_STATUS]?.label || order.orderStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">用户</p>
                <p className="text-sm">{order.userName || order.userOpenId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">发生位置</p>
                <p className="text-sm">{order.city && order.scenicSpot ? `${order.city}-${order.scenicSpot}` : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">照片数量</p>
                <p className="text-sm">{order.photoCount || 0} 张</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">支付金额</p>
                <p className="text-sm font-medium">¥{((order.orderAmount || 0) / 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">订单时间</p>
                <p className="text-sm">{order.createdAt ? format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm') : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 自拍原图 */}
        {order.selfieUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">自拍原始图</CardTitle>
            </CardHeader>
            <CardContent>
              <a href={order.selfieUrl} target="_blank" rel="noopener noreferrer">
                <img 
                  src={order.selfieUrl} 
                  alt="自拍原始图" 
                  className="max-w-[300px] h-auto rounded-lg border hover:opacity-80 transition-opacity cursor-pointer"
                />
              </a>
            </CardContent>
          </Card>
        )}

        {/* 结果图列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              生成结果图 ({resultUrls.length}张)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resultUrls.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无结果图</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {resultUrls.map((url, index) => (
                  <div key={index} className="group relative">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={url} 
                        alt={`结果图 ${index + 1}`} 
                        className="w-full aspect-[3/4] object-cover rounded-lg border hover:opacity-90 transition-opacity cursor-pointer"
                      />
                    </a>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm">图片 {index + 1}</span>
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            downloadSingleImage(url, index);
                          }}
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 错误信息 */}
        {(order.errorCode || order.errorMessage) && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-lg text-red-800">错误信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-red-600">错误码</p>
                  <p className="font-mono">{order.errorCode || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-red-600">错误信息</p>
                  <p>{order.errorMessage || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
