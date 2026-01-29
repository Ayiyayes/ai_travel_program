import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import ChannelPortalLayout from "@/components/ChannelPortalLayout";
import {
  UserPlus,
  RefreshCw,
  Loader2,
  Users,
  TrendingUp,
  DollarSign,
  QrCode,
  Eye,
  Settings,
  MapPin,
  Copy,
  Download,
  Link,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SalesPerson {
  id: number;
  name: string;
  username: string;
  isActive: boolean;
  orderCount: number;
  totalSales: number;
  totalCommission: number;
  createdAt: Date;
}

interface ScenicConfig {
  city: string;
  scenicSpot: string;
}

export default function ChannelPortalSales() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedSales, setSelectedSales] = useState<any>(null);
  const [selectedScenics, setSelectedScenics] = useState<ScenicConfig[]>([]);
  const [newSales, setNewSales] = useState({ name: "", username: "", password: "123456" });
  const [newSalesScenics, setNewSalesScenics] = useState<ScenicConfig[]>([]);

  // 从 URL 参数或 localStorage 获取认证信息
  const urlParams = new URLSearchParams(window.location.search);
  const adminToken = urlParams.get('adminToken');
  const channelIdFromUrl = urlParams.get('channelId');
  const token = localStorage.getItem("channelToken") || "";

  // 管理员代登录模式
  const isAdminMode = adminToken === 'admin' && !!channelIdFromUrl;
  const effectiveChannelId = isAdminMode && channelIdFromUrl ? parseInt(channelIdFromUrl) : undefined;

  // 获取渠道信息（支持 token 或 channelId）
  const { data: channelInfo, isLoading: isLoadingChannelInfo } = trpc.channelPortal.channelInfo.useQuery(
    {
      token: isAdminMode ? undefined : token,
      channelId: effectiveChannelId
    },
    { enabled: isAdminMode ? !!effectiveChannelId : !!token }
  );

  // 从 channelInfo 获取实际的 channelId（用于其他 API 调用）
  const actualChannelId = effectiveChannelId || channelInfo?.id;

  // 获取销售人员列表
  const { data: salesList, isLoading, refetch } = trpc.channelPortal.salesList.useQuery(
    { channelId: actualChannelId || 0 },
    { enabled: !!actualChannelId }
  );

  // 获取推广员的推广码
  const { data: salesPromoCodes } = trpc.channelPortal.salesPromoCodes.useQuery(
    { salesId: selectedSales?.id || 0 },
    { enabled: !!selectedSales?.id && qrDialogOpen }
  );

  // 添加销售人员（包含城市景点配置）
  const addSalesMutation = trpc.channelPortal.addSalesWithScenics.useMutation({
    onSuccess: (data) => {
      toast.success(`推广员添加成功，已生成 ${data.codesCount} 个推广码`);
      setAddDialogOpen(false);
      setNewSales({ name: "", username: "", password: "123456" });
      setNewSalesScenics([]);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "添加失败");
    },
  });

  // 切换销售人员状态
  const toggleStatusMutation = trpc.channelPortal.toggleSalesStatus.useMutation({
    onSuccess: () => {
      toast.success("状态更新成功");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "操作失败");
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleAddSales = () => {
    if (!newSales.name || !newSales.username) {
      toast.error("请填写完整信息");
      return;
    }
    if (!actualChannelId) {
      toast.error("渠道信息错误");
      return;
    }
    if (newSalesScenics.length === 0) {
      toast.error("请至少选择一个城市景点");
      return;
    }
    addSalesMutation.mutate({
      channelId: actualChannelId,
      name: newSales.name,
      username: newSales.username,
      password: newSales.password,
      scenics: newSalesScenics,
    });
  };

  const handleToggleStatus = (salesId: number, currentStatus: boolean) => {
    toggleStatusMutation.mutate({
      salesId,
      isActive: !currentStatus,
    });
  };

  const handleOpenQrDialog = (sales: any) => {
    setSelectedSales(sales);
    setQrDialogOpen(true);
  };

  const handleNewSalesScenicToggle = (city: string, scenicSpot: string, checked: boolean) => {
    if (checked) {
      setNewSalesScenics([...newSalesScenics, { city, scenicSpot }]);
    } else {
      setNewSalesScenics(newSalesScenics.filter(
        s => !(s.city === city && s.scenicSpot === scenicSpot)
      ));
    }
  };

  const isNewSalesScenicSelected = (city: string, scenicSpot: string) => {
    return newSalesScenics.some(s => s.city === city && s.scenicSpot === scenicSpot);
  };

  const handleCopyLink = (link: string, platform: string) => {
    navigator.clipboard.writeText(link);
    toast.success(`${platform}链接已复制`);
  };

  const handleDownloadQrCode = async (url: string, filename: string) => {
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
      toast.success("二维码下载成功");
    } catch (error) {
      toast.error("下载失败");
    }
  };

  // 检查是否为机构渠道
  const isInstitution = channelInfo?.channelType === 'institution';

  // 解析渠道的城市和景点
  const channelCities = channelInfo?.cities ? JSON.parse(channelInfo.cities) : [];
  const channelSpots = channelInfo?.scenicSpots ? JSON.parse(channelInfo.scenicSpots) : [];

  // 格式化金额（分转元）
  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  // 统计数据
  const totalSales = (salesList || []).length;
  const activeSales = (salesList || []).filter((s: any) => s.isActive).length;
  const totalOrders = (salesList || []).reduce((sum: number, s: any) => sum + (s.orderCount || 0), 0);
  const totalCommission = (salesList || []).reduce((sum: number, s: any) => sum + (s.totalCommission || 0), 0);

  // 加载中状态
  if (isLoadingChannelInfo) {
    return (
      <ChannelPortalLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-16 h-16 text-gray-300 mb-4 animate-spin" />
          <h2 className="text-xl font-medium text-gray-600">加载中...</h2>
        </div>
      </ChannelPortalLayout>
    );
  }

  if (!isInstitution) {
    return (
      <ChannelPortalLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-medium text-gray-600">该功能仅对机构渠道开放</h2>
          <p className="text-gray-400 mt-2">个人渠道无法管理推广员</p>
        </div>
      </ChannelPortalLayout>
    );
  }

  return (
    <ChannelPortalLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">推广员管理</h1>
            <p className="text-gray-500 mt-1">管理您的下级推广员</p>
          </div>
          <div className="flex gap-2">
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
            <Button
              size="sm"
              className="bg-[#e89a8d] hover:bg-[#d4887b]"
              onClick={() => setAddDialogOpen(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              新增推广员
            </Button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">推广员总数</p>
                  <p className="text-2xl font-bold">{totalSales}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">活跃推广员</p>
                  <p className="text-2xl font-bold">{activeSales}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">总订单数</p>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">总佣金</p>
                  <p className="text-2xl font-bold text-[#e89a8d]">¥{formatAmount(totalCommission)}</p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 推广员列表 */}
        <Card>
          <CardHeader>
            <CardTitle>推广员列表</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : !salesList || salesList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>暂无推广员</p>
                <p className="text-sm mt-1">点击"新增推广员"添加</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>登录账号</TableHead>
                    <TableHead>订单数</TableHead>
                    <TableHead>销售额</TableHead>
                    <TableHead>佣金</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>加入时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesList.map((sales: any) => (
                    <TableRow key={sales.id}>
                      <TableCell className="font-medium">{sales.name}</TableCell>
                      <TableCell>{sales.username}</TableCell>
                      <TableCell>{sales.orderCount || 0}</TableCell>
                      <TableCell>¥{formatAmount(sales.totalSales || 0)}</TableCell>
                      <TableCell className="text-[#e89a8d]">¥{formatAmount(sales.totalCommission || 0)}</TableCell>
                      <TableCell>
                        <Badge variant={sales.isActive ? "default" : "secondary"}>
                          {sales.isActive ? "启用" : "禁用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sales.createdAt ? format(new Date(sales.createdAt), "yyyy-MM-dd") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={sales.isActive}
                            onCheckedChange={() => handleToggleStatus(sales.id, sales.isActive)}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="查看推广码"
                            onClick={() => handleOpenQrDialog(sales)}
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 新增推广员弹窗（包含城市景点配置） */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新增推广员</DialogTitle>
              <DialogDescription>
                填写推广员信息并选择可推广的城市景点，创建后将自动生成微信和抖音小程序二维码
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 border-b pb-2">基本信息</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>姓名 *</Label>
                    <Input
                      placeholder="请输入推广员姓名"
                      value={newSales.name}
                      onChange={(e) => setNewSales({ ...newSales, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>登录账号 *</Label>
                    <Input
                      placeholder="请输入登录账号"
                      value={newSales.username}
                      onChange={(e) => setNewSales({ ...newSales, username: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>初始密码</Label>
                  <Input
                    placeholder="默认密码"
                    value={newSales.password}
                    onChange={(e) => setNewSales({ ...newSales, password: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">默认密码为 123456，推广员首次登录后可自行修改</p>
                </div>
              </div>

              {/* 城市景点配置 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 border-b pb-2 flex items-center justify-between">
                  <span>推广城市景点 *</span>
                  <span className="text-sm font-normal text-gray-500">
                    已选择 {newSalesScenics.length} 个
                  </span>
                </h4>
                {channelCities.length === 0 || channelSpots.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                    <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>渠道暂未配置城市景点</p>
                    <p className="text-sm mt-1">请先在渠道管理中配置城市和景点</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {channelCities.map((city: string) => (
                      <div key={city} className="border rounded-lg p-3">
                        <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#e89a8d]" />
                          {city}
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {channelSpots.map((spot: string) => (
                            <label
                              key={`${city}-${spot}`}
                              className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50 cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={isNewSalesScenicSelected(city, spot)}
                                onCheckedChange={(checked) => handleNewSalesScenicToggle(city, spot, !!checked)}
                              />
                              <span>{spot}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setAddDialogOpen(false);
                setNewSales({ name: "", username: "", password: "123456" });
                setNewSalesScenics([]);
              }}>
                取消
              </Button>
              <Button
                className="bg-[#e89a8d] hover:bg-[#d4887b]"
                onClick={handleAddSales}
                disabled={addSalesMutation.isPending || newSalesScenics.length === 0}
              >
                {addSalesMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                创建并生成二维码
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 查看推广码弹窗（添加链接功能） */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>推广员推广码</DialogTitle>
              <DialogDescription>
                {selectedSales?.name} 的专属推广二维码
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {!salesPromoCodes || salesPromoCodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <QrCode className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>暂无推广码</p>
                  <p className="text-sm mt-1">该推广员尚未配置城市景点</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {salesPromoCodes.map((code: any) => (
                    <div key={code.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-4 h-4 text-[#e89a8d]" />
                        <span className="font-medium">{code.city} - {code.scenicSpot}</span>
                        <Badge variant="outline" className="ml-2">{code.promoCode}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {/* 微信二维码 */}
                        <div className="text-center space-y-3">
                          <div className="bg-green-50 rounded-lg p-4">
                            {code.wechatQrCodeUrl ? (
                              <img 
                                src={code.wechatQrCodeUrl} 
                                alt="微信小程序二维码"
                                className="w-32 h-32 mx-auto"
                              />
                            ) : (
                              <div className="w-32 h-32 mx-auto bg-gray-100 rounded flex items-center justify-center text-gray-400">
                                生成中...
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-medium text-green-600">微信小程序</p>
                          {code.wechatLink && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1 justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyLink(code.wechatLink, "微信")}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  复制链接
                                </Button>
                                {code.wechatQrCodeUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadQrCode(code.wechatQrCodeUrl, `${code.promoCode}-wechat.png`)}
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    下载
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 truncate px-2" title={code.wechatLink}>
                                <Link className="w-3 h-3 inline mr-1" />
                                {code.wechatLink}
                              </p>
                            </div>
                          )}
                        </div>
                        {/* 抖音二维码 */}
                        <div className="text-center space-y-3">
                          <div className="bg-pink-50 rounded-lg p-4">
                            {code.douyinQrCodeUrl ? (
                              <img 
                                src={code.douyinQrCodeUrl} 
                                alt="抖音小程序二维码"
                                className="w-32 h-32 mx-auto"
                              />
                            ) : (
                              <div className="w-32 h-32 mx-auto bg-gray-100 rounded flex items-center justify-center text-gray-400">
                                生成中...
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-medium text-pink-600">抖音小程序</p>
                          {code.douyinLink && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1 justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyLink(code.douyinLink, "抖音")}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  复制链接
                                </Button>
                                {code.douyinQrCodeUrl && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownloadQrCode(code.douyinQrCodeUrl, `${code.promoCode}-douyin.png`)}
                                  >
                                    <Download className="w-3 h-3 mr-1" />
                                    下载
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 truncate px-2" title={code.douyinLink}>
                                <Link className="w-3 h-3 inline mr-1" />
                                {code.douyinLink}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ChannelPortalLayout>
  );
}
