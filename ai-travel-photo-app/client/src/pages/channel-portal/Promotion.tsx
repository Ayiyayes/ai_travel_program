import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import ChannelPortalLayout from "@/components/ChannelPortalLayout";
import {
  QrCode,
  RefreshCw,
  Loader2,
  Download,
  Copy,
  Eye,
  Smartphone,
  MapPin,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

interface PromoCode {
  id: number;
  promoCode: string;
  city: string;
  scenicSpot: string;
  wechatLink?: string | null;
  wechatQrCodeUrl?: string | null;
  douyinLink?: string | null;
  douyinQrCodeUrl?: string | null;
  scanCount?: number;
  orderCount?: number;
}

export default function ChannelPortalPromotion() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCode, setSelectedCode] = useState<PromoCode | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<"wechat" | "douyin">("wechat");

  // 从 URL 参数或 localStorage 获取认证信息
  const urlParams = new URLSearchParams(window.location.search);
  const adminToken = urlParams.get('adminToken');
  const channelIdFromUrl = urlParams.get('channelId');
  const token = localStorage.getItem("channelToken") || "";
  
  // 管理员代登录模式
  const isAdminMode = adminToken === 'admin' && !!channelIdFromUrl;
  const effectiveChannelId = isAdminMode && channelIdFromUrl ? parseInt(channelIdFromUrl) : undefined;

  // 获取推广码列表
  const { data: promoCodes, isLoading, refetch } = trpc.channelPortal.promoCodes.useQuery(
    { channelId: effectiveChannelId || 0 },
    { enabled: !!effectiveChannelId }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const copyLink = (link: string | null | undefined, platform: string) => {
    if (!link) {
      toast.error("链接暂未生成");
      return;
    }
    navigator.clipboard.writeText(link);
    toast.success(`${platform}链接已复制到剪贴板`);
  };

  const downloadQrCode = async (url: string | null | undefined, filename: string) => {
    if (!url) {
      toast.error("二维码暂未生成");
      return;
    }
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("二维码已下载");
    } catch (error) {
      toast.error("下载失败，请重试");
    }
  };

  const openQrDialog = (code: PromoCode) => {
    setSelectedCode(code);
    setQrDialogOpen(true);
  };

  // 按城市分组
  const groupedCodes = (promoCodes || []).reduce((acc: Record<string, PromoCode[]>, code: any) => {
    const city = code.city || '未分类';
    if (!acc[city]) {
      acc[city] = [];
    }
    acc[city].push({
      ...code,
      promoCode: code.promoCode,
      scenicSpot: code.scenicSpot,
    });
    return acc;
  }, {} as Record<string, PromoCode[]>);

  return (
    <ChannelPortalLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">推广工具</h1>
            <p className="text-gray-500 mt-1">管理您的推广二维码和链接</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            刷新数据
          </Button>
        </div>

        {/* 推广提示 */}
        <Card className="bg-gradient-to-r from-[#fdf9f6] to-[#fff5f3] border-[#e89a8d]/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#e89a8d]/10 rounded-full flex items-center justify-center">
                <QrCode className="w-5 h-5 text-[#e89a8d]" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">推广说明</h3>
                <ul className="mt-2 text-sm text-gray-600 space-y-1">
                  <li>• 每个景点都有独立的推广二维码，用户扫码后将自动关联到您的渠道</li>
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
            <Loader2 className="w-8 h-8 animate-spin text-[#e89a8d]" />
          </div>
        ) : Object.keys(groupedCodes).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              暂无推广码，请联系管理员分配
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedCodes).map(([city, codes]) => (
            <Card key={city}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#e89a8d]" />
                  {city}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {codes.map((code) => (
                    <div
                      key={code.id}
                      className="border rounded-lg p-4 hover:border-[#e89a8d]/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-800">{code.scenicSpot}</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            推广码: {code.promoCode}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openQrDialog(code)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4" />
                          <span>扫码 {code.scanCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Smartphone className="w-4 h-4" />
                          <span>订单 {code.orderCount || 0}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => copyLink(code.wechatLink, '微信')}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          微信链接
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => copyLink(code.douyinLink, '抖音')}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          抖音链接
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* 二维码弹窗 */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedCode?.scenicSpot} - 推广二维码
              </DialogTitle>
            </DialogHeader>
            <Tabs value={activePlatform} onValueChange={(v) => setActivePlatform(v as "wechat" | "douyin")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="wechat">微信小程序</TabsTrigger>
                <TabsTrigger value="douyin">抖音小程序</TabsTrigger>
              </TabsList>
              <TabsContent value="wechat" className="mt-4">
                <div className="flex flex-col items-center">
                  {selectedCode?.wechatQrCodeUrl ? (
                    <img
                      src={selectedCode.wechatQrCodeUrl}
                      alt="微信小程序二维码"
                      className="w-48 h-48 border rounded-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-gray-50 text-gray-400">
                      暂无二维码
                    </div>
                  )}
                  <p className="mt-4 text-sm text-gray-500">微信扫码进入小程序</p>
                  <div className="mt-4 flex gap-2 w-full">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyLink(selectedCode?.wechatLink, '微信')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      复制链接
                    </Button>
                    <Button
                      className="flex-1 bg-[#e89a8d] hover:bg-[#d4887b]"
                      onClick={() => downloadQrCode(
                        selectedCode?.wechatQrCodeUrl,
                        `${selectedCode?.promoCode}_wechat.png`
                      )}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载二维码
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="douyin" className="mt-4">
                <div className="flex flex-col items-center">
                  {selectedCode?.douyinQrCodeUrl ? (
                    <img
                      src={selectedCode.douyinQrCodeUrl}
                      alt="抖音小程序二维码"
                      className="w-48 h-48 border rounded-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 border rounded-lg flex items-center justify-center bg-gray-50 text-gray-400">
                      暂无二维码
                    </div>
                  )}
                  <p className="mt-4 text-sm text-gray-500">抖音扫码进入小程序</p>
                  <div className="mt-4 flex gap-2 w-full">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyLink(selectedCode?.douyinLink, '抖音')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      复制链接
                    </Button>
                    <Button
                      className="flex-1 bg-[#e89a8d] hover:bg-[#d4887b]"
                      onClick={() => downloadQrCode(
                        selectedCode?.douyinQrCodeUrl,
                        `${selectedCode?.promoCode}_douyin.png`
                      )}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载二维码
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </ChannelPortalLayout>
  );
}
