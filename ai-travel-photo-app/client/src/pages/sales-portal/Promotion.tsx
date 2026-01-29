import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import SalesPortalLayout from '@/components/SalesPortalLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  QrCode, 
  Copy, 
  Download, 
  MapPin,
  Eye,
  ShoppingCart,
  RefreshCw,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SalesUser {
  id: number;
  username: string;
  role: string;
  channelId: number | null;
  salesId: number | null;
  salesName?: string;
  salesCode?: string;
}

interface PromoCode {
  id: number;
  promoCode: string;
  city: string;
  scenicSpot: string;
  wechatLink?: string;
  wechatQrCodeUrl?: string;
  douyinLink?: string;
  douyinQrCodeUrl?: string;
  scanCount: number;
  orderCount: number;
}

export default function SalesPromotion() {
  const [user, setUser] = useState<SalesUser | null>(null);
  const [selectedCode, setSelectedCode] = useState<PromoCode | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [platform, setPlatform] = useState<'wechat' | 'douyin'>('wechat');

  useEffect(() => {
    const userStr = localStorage.getItem('channelUser');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch {
        // ignore
      }
    }
  }, []);

  const salesId = user?.salesId;

  const { data: promoCodes, isLoading, refetch } = trpc.channelPortal.salesPromoCodes.useQuery(
    { salesId: salesId! },
    { enabled: !!salesId }
  );

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('链接已复制到剪贴板');
  };

  const handleDownloadQR = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    toast.success('二维码已开始下载');
  };

  const openQRDialog = (code: PromoCode) => {
    setSelectedCode(code);
    setQrDialogOpen(true);
  };

  // 按城市分组
  const groupedCodes = (promoCodes || []).reduce((acc: Record<string, PromoCode[]>, code: PromoCode) => {
    const city = code.city || '未分类';
    if (!acc[city]) acc[city] = [];
    acc[city].push(code);
    return acc;
  }, {});

  return (
    <SalesPortalLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">推广工具</h1>
            <p className="text-muted-foreground">管理您的推广二维码和链接</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* 推广说明 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">推广说明</p>
                <ul className="space-y-1 text-blue-600">
                  <li>• 每个景点都有独立的推广二维码，用户扫码后将自动关联到您</li>
                  <li>• 支持微信小程序和抖音小程序两个平台</li>
                  <li>• 用户通过您的推广码完成付费，您将获得相应佣金</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 推广码列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e89a8d]" />
          </div>
        ) : Object.keys(groupedCodes).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <QrCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">暂无推广码，请联系渠道管理员分配</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedCodes).map(([city, codes]) => (
            <Card key={city}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[#e89a8d]" />
                  {city}
                </CardTitle>
                <CardDescription>共 {codes.length} 个推广码</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {codes.map((code: PromoCode) => (
                    <div
                      key={code.id}
                      className="border rounded-lg p-4 hover:border-[#e89a8d] transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{code.scenicSpot}</h4>
                          <p className="text-xs text-muted-foreground font-mono">{code.promoCode}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {code.city}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{code.scanCount || 0} 扫码</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ShoppingCart className="h-4 w-4" />
                          <span>{code.orderCount || 0} 订单</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => openQRDialog(code)}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        查看二维码
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 二维码弹窗 */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>推广二维码</DialogTitle>
          </DialogHeader>
          {selectedCode && (
            <div className="space-y-4">
              <div className="text-center text-sm text-muted-foreground">
                <p>{selectedCode.city} - {selectedCode.scenicSpot}</p>
                <p className="font-mono text-xs">{selectedCode.promoCode}</p>
              </div>

              <Tabs value={platform} onValueChange={(v) => setPlatform(v as 'wechat' | 'douyin')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="wechat">微信小程序</TabsTrigger>
                  <TabsTrigger value="douyin">抖音小程序</TabsTrigger>
                </TabsList>
                <TabsContent value="wechat" className="space-y-4">
                  <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
                    {selectedCode.wechatQrCodeUrl ? (
                      <img 
                        src={selectedCode.wechatQrCodeUrl} 
                        alt="微信小程序二维码" 
                        className="w-48 h-48 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-muted-foreground">
                        暂无二维码
                      </div>
                    )}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">微信扫码进入小程序</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => selectedCode.wechatLink && handleCopyLink(selectedCode.wechatLink)}
                      disabled={!selectedCode.wechatLink}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      复制链接
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => selectedCode.wechatQrCodeUrl && handleDownloadQR(
                        selectedCode.wechatQrCodeUrl,
                        `wechat_${selectedCode.promoCode}.png`
                      )}
                      disabled={!selectedCode.wechatQrCodeUrl}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      下载二维码
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="douyin" className="space-y-4">
                  <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
                    {selectedCode.douyinQrCodeUrl ? (
                      <img 
                        src={selectedCode.douyinQrCodeUrl} 
                        alt="抖音小程序二维码" 
                        className="w-48 h-48 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-muted-foreground">
                        暂无二维码
                      </div>
                    )}
                  </div>
                  <p className="text-center text-sm text-muted-foreground">抖音扫码进入小程序</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => selectedCode.douyinLink && handleCopyLink(selectedCode.douyinLink)}
                      disabled={!selectedCode.douyinLink}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      复制链接
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => selectedCode.douyinQrCodeUrl && handleDownloadQR(
                        selectedCode.douyinQrCodeUrl,
                        `douyin_${selectedCode.promoCode}.png`
                      )}
                      disabled={!selectedCode.douyinQrCodeUrl}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      下载二维码
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SalesPortalLayout>
  );
}
