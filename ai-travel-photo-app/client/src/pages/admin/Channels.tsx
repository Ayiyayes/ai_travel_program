import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/_core/hooks/useAdminAuth';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Copy,
  QrCode,
  Building2,
  User,
  Download,
  Smartphone,
  RefreshCw,
  LogIn
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function ChannelsPage() {
  const { user } = useAdminAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'institution' | 'personal'>('institution');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [viewingSales, setViewingSales] = useState<any>(null);
  const [qrCodeChannel, setQrCodeChannel] = useState<any>(null); // 二维码弹窗的渠道

  // 表单状态
  const [formData, setFormData] = useState({
    channelName: '',
    channelType: 'institution' as 'institution' | 'individual',
    commissionRate: 50,
    cities: [] as string[],
    scenicSpots: [] as string[],
    cooperationStartDate: new Date(),
    cooperationDays: 360,
  });

  // 获取城市和景点数据
  const { data: citiesData } = trpc.admin.cities.useQuery();
  const { data: spotsData } = trpc.admin.spots.useQuery();

  // 获取渠道列表
  const { data: channels, isLoading, refetch } = trpc.channel.list.useQuery({
    channelType: activeTab === 'institution' ? 'institution' : 'individual',
  });

  // 创建渠道
  const createMutation = trpc.channel.create.useMutation({
    onSuccess: () => {
      toast.success('渠道创建成功');
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '创建失败');
    },
  });

  // 更新渠道
  const updateMutation = trpc.channel.update.useMutation({
    onSuccess: () => {
      toast.success('渠道更新成功');
      setEditingChannel(null);
      resetForm();
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '更新失败');
    },
  });

  // 删除渠道
  const deleteMutation = trpc.channel.delete.useMutation({
    onSuccess: () => {
      toast.success('渠道删除成功');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '删除失败');
    },
  });

  // 切换渠道状态
  const toggleStatusMutation = trpc.channel.toggleStatus.useMutation({
    onSuccess: (data) => {
      toast.success(data.status === 'active' ? '渠道已启用' : '渠道已禁用');
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || '状态切换失败');
    },
  });

  // 获取销售人员列表
  const { data: salesList } = trpc.channel.salesList.useQuery(
    { channelId: viewingSales?.id },
    { enabled: !!viewingSales }
  );

  // 删除渠道
  const handleDelete = (id: number) => {
    if (confirm('确定要删除这个渠道吗？删除后将无法恢复，关联的推广码和销售人员也将被删除。')) {
      deleteMutation.mutate({ id });
    }
  };

  // 切换渠道状态
  const handleToggleStatus = (id: number) => {
    toggleStatusMutation.mutate({ id });
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      channelName: '',
      channelType: activeTab === 'institution' ? 'institution' : 'individual',
      commissionRate: 50,
      cities: [],
      scenicSpots: [],
      cooperationStartDate: new Date(),
      cooperationDays: 360,
    });
  };

  // 打开编辑对话框
  const handleEdit = (channel: any) => {
    setEditingChannel(channel);
    setFormData({
      channelName: channel.channelName,
      channelType: channel.channelType,
      commissionRate: channel.commissionRate,
      cities: channel.cities ? JSON.parse(channel.cities) : [],
      scenicSpots: channel.scenicSpots ? JSON.parse(channel.scenicSpots) : [],
      cooperationStartDate: new Date(channel.cooperationStartDate),
      cooperationDays: channel.cooperationDays,
    });
  };

  // 提交表单
  const handleSubmit = () => {
    // 验证必填字段
    if (!formData.channelName) {
      toast.error('请输入渠道名称');
      return;
    }
    if (formData.cities.length === 0) {
      toast.error('请选择至少一个城市');
      return;
    }
    if (formData.scenicSpots.length === 0) {
      toast.error('请选择至少一个景点');
      return;
    }

    if (editingChannel) {
      updateMutation.mutate({
        id: editingChannel.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  // 复制链接
  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('链接已复制');
  };

  // 检查管理员权限
  if (user?.role !== 'admin') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-medium mb-2">无权访问</h2>
            <p className="text-muted-foreground">您没有管理员权限</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">渠道管理</h1>
            <p className="text-sm text-muted-foreground">管理机构渠道和个人渠道</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                新建渠道
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>新建渠道</DialogTitle>
              </DialogHeader>
              <ChannelForm 
                formData={formData} 
                setFormData={setFormData}
                onSubmit={handleSubmit}
                onCancel={() => setIsCreateOpen(false)}
                isLoading={createMutation.isPending}
                citiesData={citiesData || []}
                spotsData={spotsData || []}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* 渠道类型切换 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="institution" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              机构渠道
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              个人渠道
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {/* 搜索 */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索渠道名称..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 渠道列表 */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>渠道名称</TableHead>
                    <TableHead>渠道编码</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>佣金比例</TableHead>
                    <TableHead>扫码次数</TableHead>
                    <TableHead>订单数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : channels && channels.length > 0 ? (
                    channels
                      .filter(c => !searchTerm || c.channelName.includes(searchTerm))
                      .map(channel => (
                        <TableRow key={channel.id}>
                          <TableCell className="font-medium">{channel.channelName}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {channel.channelCode}
                            </code>
                          </TableCell>
                          <TableCell>{channel.contactPerson || '-'}</TableCell>
                          <TableCell>{channel.commissionRate}%</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>-</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs",
                              channel.status === 'active' 
                                ? "bg-green-100 text-green-600" 
                                : "bg-gray-100 text-gray-600"
                            )}>
                              {channel.status === 'active' ? '启用' : '禁用'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                title="进入门户"
                                onClick={() => window.open(`/channel-portal/dashboard?channelId=${channel.id}&adminToken=admin`, '_blank')}
                              >
                                <LogIn className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                title="查看二维码"
                                onClick={() => setQrCodeChannel(channel)}
                              >
                                <QrCode className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                title="查看销售人员"
                                onClick={() => setViewingSales(channel)}
                              >
                                <User className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                title={channel.status === 'active' ? '点击禁用' : '点击启用'}
                                onClick={() => handleToggleStatus(channel.id)}
                              >
                                <Switch checked={channel.status === 'active'} />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                title="编辑"
                                onClick={() => handleEdit(channel)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                title="删除"
                                onClick={() => handleDelete(channel.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        暂无渠道数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 编辑渠道对话框 */}
        <Dialog open={!!editingChannel} onOpenChange={(open) => !open && setEditingChannel(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑渠道</DialogTitle>
            </DialogHeader>
            <ChannelForm 
              formData={formData} 
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onCancel={() => setEditingChannel(null)}
              isLoading={updateMutation.isPending}
              citiesData={citiesData || []}
              spotsData={spotsData || []}
            />
          </DialogContent>
        </Dialog>

        {/* 销售人员列表对话框 */}
        <Dialog open={!!viewingSales} onOpenChange={(open) => !open && setViewingSales(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{viewingSales?.channelName} - 销售人员</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {salesList && salesList.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>销售编码</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>佣金比例</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesList.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {sale.salesCode}
                          </code>
                        </TableCell>
                        <TableCell>{sale.salesName}</TableCell>
                        <TableCell>{sale.commissionRate}%</TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs",
                            sale.status === 'active' 
                              ? "bg-green-100 text-green-600" 
                              : "bg-gray-100 text-gray-600"
                          )}>
                            {sale.status === 'active' ? '启用' : '禁用'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  暂无销售人员
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* 二维码弹窗 */}
        <Dialog open={!!qrCodeChannel} onOpenChange={(open) => !open && setQrCodeChannel(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                {qrCodeChannel?.channelName} - 小程序二维码
              </DialogTitle>
            </DialogHeader>
            {qrCodeChannel && <QRCodeDisplay channelId={qrCodeChannel.id} channelCode={qrCodeChannel.channelCode} />}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

// 渠道表单组件
function ChannelForm({ 
  formData, 
  setFormData, 
  onSubmit, 
  onCancel, 
  isLoading,
  citiesData,
  spotsData,
}: {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  citiesData: any[];
  spotsData: any[];
}) {
  // 根据选中的城市过滤景点
  // 未选城市时景点为空，选中城市后显示该城市下的景点
  // 使用 cityName 或 city 字段匹配城市名称
  const filteredSpots = formData.cities.length === 0 
    ? [] 
    : spotsData.filter(spot => formData.cities.includes(spot.cityName || spot.city));

  return (
    <div className="space-y-4">
      {/* 渠道名称 */}
      <div className="space-y-2">
        <Label>渠道名称 *</Label>
        <Input
          value={formData.channelName}
          onChange={(e) => setFormData({ ...formData, channelName: e.target.value })}
          placeholder="请输入渠道名称"
        />
      </div>

      {/* 渠道类型 */}
      <div className="space-y-2">
        <Label>渠道类型</Label>
        <Select 
          value={formData.channelType} 
          onValueChange={(v) => setFormData({ ...formData, channelType: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="institution">机构渠道</SelectItem>
            <SelectItem value="individual">个人渠道</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 城市选择 */}
      <div className="space-y-2">
        <Label>合作城市 *</Label>
        <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px]">
          {citiesData.map(city => (
            <label key={city.id} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={formData.cities.includes(city.name)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFormData({ ...formData, cities: [...formData.cities, city.name] });
                  } else {
                    setFormData({ 
                      ...formData, 
                      cities: formData.cities.filter((c: string) => c !== city.name),
                      // 同时移除该城市下的景点
                      scenicSpots: formData.scenicSpots.filter((s: string) => {
                        const spot = spotsData.find(sp => sp.name === s);
                        return spot && spot.city !== city.name;
                      })
                    });
                  }
                }}
              />
              <span className="text-sm">{city.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 景点选择 */}
      <div className="space-y-2">
        <Label>合作景点 *</Label>
        <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px]">
          {filteredSpots.length > 0 ? filteredSpots.map(spot => (
            <label key={spot.id} className="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                checked={formData.scenicSpots.includes(spot.name)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFormData({ ...formData, scenicSpots: [...formData.scenicSpots, spot.name] });
                  } else {
                    setFormData({ 
                      ...formData, 
                      scenicSpots: formData.scenicSpots.filter((s: string) => s !== spot.name)
                    });
                  }
                }}
              />
              <span className="text-sm">{spot.name}</span>
            </label>
          )) : (
            <span className="text-sm text-muted-foreground">请先选择城市</span>
          )}
        </div>
      </div>

      {/* 佣金比例和合作期限 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>佣金比例 (%)</Label>
          <Input
            type="number"
            value={formData.commissionRate}
            onChange={(e) => setFormData({ ...formData, commissionRate: parseInt(e.target.value) || 50 })}
            min={5}
            max={80}
          />
          <p className="text-xs text-muted-foreground">范围：5% - 80%</p>
        </div>
        <div className="space-y-2">
          <Label>合作期限（天）</Label>
          <Input
            type="number"
            value={formData.cooperationDays}
            onChange={(e) => setFormData({ ...formData, cooperationDays: parseInt(e.target.value) || 360 })}
            min={1}
          />
        </div>
      </div>

      {/* 按钮 */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" type="button" onClick={onCancel}>取消</Button>
        <Button onClick={onSubmit} disabled={isLoading}>
          {isLoading ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  );
}


// 二维码展示组件
function QRCodeDisplay({ channelId, channelCode }: { channelId: number; channelCode: string }) {
  const utils = trpc.useUtils();
  const { data: promotionCodes, isLoading, refetch } = trpc.channel.promotionCodes.useQuery({ channelId });
  const [selectedCode, setSelectedCode] = useState<any>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'wechat' | 'douyin'>('wechat');

  // 重新生成二维码
  const regenerateMutation = trpc.channel.regenerateQRCode.useMutation({
    onSuccess: (data) => {
      toast.success('二维码生成成功');
      // 刷新推广码列表
      refetch();
      // 更新选中的推广码
      if (selectedCode) {
        setSelectedCode({
          ...selectedCode,
          wechatQrCodeUrl: data.wechatQrCodeUrl,
          douyinQrCodeUrl: data.douyinQrCodeUrl,
        });
      }
    },
    onError: (err) => {
      toast.error(err.message || '生成二维码失败');
    },
  });

  // 复制链接
  const copyLink = (link: string, platform: string) => {
    navigator.clipboard.writeText(link);
    toast.success(`${platform}链接已复制到剪贴板`);
  };

  // 下载二维码
  const downloadQRCode = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success('二维码已下载');
    } catch (error) {
      toast.error('下载失败，请重试');
    }
  };

  // 处理重新生成
  const handleRegenerate = () => {
    if (!selectedCode) return;
    regenerateMutation.mutate({ promotionCodeId: selectedCode.id });
  };

  if (isLoading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  if (!promotionCodes || promotionCodes.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">暂无推广码数据</div>;
  }

  // 检查当前选中的推广码是否有二维码
  const hasQRCode = selectedCode && (
    (selectedPlatform === 'wechat' && selectedCode.wechatQrCodeUrl) ||
    (selectedPlatform === 'douyin' && selectedCode.douyinQrCodeUrl)
  );

  return (
    <div className="space-y-4">
      {/* 推广码列表 */}
      <div className="space-y-2">
        <Label>选择推广码（城市-景点）</Label>
        <Select 
          value={selectedCode?.id?.toString() || ''} 
          onValueChange={(v) => setSelectedCode(promotionCodes.find(c => c.id.toString() === v))}
        >
          <SelectTrigger>
            <SelectValue placeholder="请选择推广码" />
          </SelectTrigger>
          <SelectContent>
            {promotionCodes.map(code => (
              <SelectItem key={code.id} value={code.id.toString()}>
                {code.city} - {code.scenicSpot}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCode && (
        <>
          {/* 平台切换 */}
          <div className="flex gap-2">
            <Button 
              variant={selectedPlatform === 'wechat' ? 'default' : 'outline'}
              onClick={() => setSelectedPlatform('wechat')}
              className="flex-1"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              微信小程序
            </Button>
            <Button 
              variant={selectedPlatform === 'douyin' ? 'default' : 'outline'}
              onClick={() => setSelectedPlatform('douyin')}
              className="flex-1"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              抖音小程序
            </Button>
          </div>

          {/* 二维码展示 */}
          <div className="flex flex-col items-center gap-4 p-6 bg-muted/30 rounded-lg">
            {selectedPlatform === 'wechat' ? (
              <>
                {selectedCode.wechatQrCodeUrl ? (
                  <img 
                    src={selectedCode.wechatQrCodeUrl} 
                    alt="微信小程序二维码" 
                    className="w-48 h-48 rounded-lg shadow-md"
                  />
                ) : (
                  <div className="w-48 h-48 bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <QrCode className="w-12 h-12 opacity-30" />
                    <span>暂无二维码</span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">微信扫码进入小程序</p>
                
                {/* 链接和下载按钮 */}
                <div className="flex gap-2 w-full max-w-md">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => copyLink(selectedCode.wechatLink || selectedCode.promotionLink, '微信')}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制链接
                  </Button>
                  {selectedCode.wechatQrCodeUrl ? (
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => downloadQRCode(
                        selectedCode.wechatQrCodeUrl, 
                        `wechat-${channelCode}-${selectedCode.city}-${selectedCode.scenicSpot}.png`
                      )}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载二维码
                    </Button>
                  ) : (
                    <Button 
                      variant="default"
                      className="flex-1"
                      onClick={handleRegenerate}
                      disabled={regenerateMutation.isPending}
                    >
                      <RefreshCw className={cn("w-4 h-4 mr-2", regenerateMutation.isPending && "animate-spin")} />
                      {regenerateMutation.isPending ? '生成中...' : '生成二维码'}
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                {selectedCode.douyinQrCodeUrl ? (
                  <img 
                    src={selectedCode.douyinQrCodeUrl} 
                    alt="抖音小程序二维码" 
                    className="w-48 h-48 rounded-lg shadow-md"
                  />
                ) : (
                  <div className="w-48 h-48 bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <QrCode className="w-12 h-12 opacity-30" />
                    <span>暂无二维码</span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">抖音扫码进入小程序</p>
                
                {/* 链接和下载按钮 */}
                <div className="flex gap-2 w-full max-w-md">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => copyLink(selectedCode.douyinLink || selectedCode.promotionLink, '抖音')}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制链接
                  </Button>
                  {selectedCode.douyinQrCodeUrl ? (
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => downloadQRCode(
                        selectedCode.douyinQrCodeUrl, 
                        `douyin-${channelCode}-${selectedCode.city}-${selectedCode.scenicSpot}.png`
                      )}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载二维码
                    </Button>
                  ) : (
                    <Button 
                      variant="default"
                      className="flex-1"
                      onClick={handleRegenerate}
                      disabled={regenerateMutation.isPending}
                    >
                      <RefreshCw className={cn("w-4 h-4 mr-2", regenerateMutation.isPending && "animate-spin")} />
                      {regenerateMutation.isPending ? '生成中...' : '生成二维码'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 推广码信息 */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>推广码: <code className="bg-muted px-2 py-0.5 rounded">{selectedCode.promoCode}</code></p>
            <p>城市: {selectedCode.city} | 景点: {selectedCode.scenicSpot}</p>
          </div>
        </>
      )}
    </div>
  );
}
