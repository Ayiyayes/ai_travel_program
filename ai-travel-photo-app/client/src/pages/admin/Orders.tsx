import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Eye,
  Download,
  ShoppingCart,
  DollarSign,
  Users,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Image as ImageIcon,
  ExternalLink,
  Edit,
  Filter,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// 订单状态配置
const ORDER_STATUS = {
  pending: { label: '待支付', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: '已支付', color: 'bg-green-100 text-green-800' },
  completed: { label: '已完成', color: 'bg-blue-100 text-blue-800' },
  failed: { label: '失败', color: 'bg-red-100 text-red-800' },
};

// 模板图片展示组件
function TemplateImagesDisplay({ templateIds }: { templateIds: string[] }) {
  const [templates, setTemplates] = useState<{ templateId: string; imageUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取模板图片
    const fetchTemplates = async () => {
      try {
        const response = await fetch(`/api/trpc/admin.getTemplatesByIds?input=${encodeURIComponent(JSON.stringify({ templateIds }))}`);
        const data = await response.json();
        if (data.result?.data) {
          setTemplates(data.result.data);
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (templateIds.length > 0) {
      fetchTemplates();
    } else {
      setLoading(false);
    }
  }, [templateIds]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  if (templates.length === 0) {
    return <div className="text-sm text-muted-foreground">无模板</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {templates.map((template, index) => (
        <div key={index} className="relative">
          <a href={template.imageUrl} target="_blank" rel="noopener noreferrer">
            <img 
              src={template.imageUrl} 
              alt={`模板 ${template.templateId}`} 
              className="w-full aspect-[3/4] object-cover rounded-lg border hover:opacity-80 transition-opacity"
            />
          </a>
          <p className="text-xs text-muted-foreground mt-1 text-center">{template.templateId}</p>
        </div>
      ))}
    </div>
  );
}

// 脸型映射
const FACE_TYPE_MAP: Record<string, string> = {
  wide: '宽脸',
  narrow: '窄脸',
  normal: '通用',
};

// 导出字段配置
const EXPORT_FIELDS = [
  { key: 'orderNo', label: '订单ID' },
  { key: 'userOpenId', label: '用户ID' },
  { key: 'location', label: '发生位置' },
  { key: 'faceType', label: '脸型' },
  { key: 'photoCount', label: '数量' },
  { key: 'pointsUsed', label: '消费积分' },
  { key: 'orderAmount', label: '支付金额' },
  { key: 'channelName', label: '渠道名称' },
  { key: 'channelCode', label: '渠道编号' },
  { key: 'thirdPartyOrderNo', label: '第三方订单号' },
  { key: 'orderStatus', label: '订单状态' },
  { key: 'errorCode', label: '错误码' },
  { key: 'errorMessage', label: '错误信息' },
  { key: 'createdAt', label: '订单发生时间' },
];

export default function OrdersPage() {
  // 筛选状态
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterSpot, setFilterSpot] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // 排序状态
  const [sortBy, setSortBy] = useState<'createdAt' | 'orderAmount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  
  // 弹窗状态
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [exportFields, setExportFields] = useState<string[]>(EXPORT_FIELDS.map(f => f.key));
  const [showFilters, setShowFilters] = useState(false);

  // 获取订单列表
  const { data: ordersData, isLoading, refetch } = trpc.admin.orders.useQuery({
    status: filterStatus === 'all' ? undefined : filterStatus,
    channelId: filterChannel === 'all' ? undefined : parseInt(filterChannel),
    city: filterCity === 'all' ? undefined : filterCity,
    scenicSpot: filterSpot === 'all' ? undefined : filterSpot,
    searchTerm: searchTerm || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy,
    sortOrder,
    page,
    pageSize,
  });

  // 获取渠道列表用于筛选
  const { data: channels } = trpc.channel.list.useQuery();

  // 获取城市景点列表用于筛选
  const { data: citySpots } = trpc.admin.citySpots.useQuery();

  // 获取统计数据
  const { data: stats } = trpc.admin.orderStats.useQuery();

  // 更新订单状态
  const updateStatusMutation = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => {
      toast.success('订单状态已更新');
      setShowStatusDialog(false);
      refetch();
    },
    onError: (error) => {
      toast.error('更新失败: ' + error.message);
    },
  });

  // 导出订单
  const { data: exportData, refetch: fetchExportData } = trpc.admin.exportOrders.useQuery({
    status: filterStatus === 'all' ? undefined : filterStatus,
    channelId: filterChannel === 'all' ? undefined : parseInt(filterChannel),
    city: filterCity === 'all' ? undefined : filterCity,
    scenicSpot: filterSpot === 'all' ? undefined : filterSpot,
    searchTerm: searchTerm || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }, { enabled: false });

  // 根据选中城市过滤景点
  const filteredSpots = useMemo(() => {
    if (filterCity === 'all' || !citySpots) return [];
    const cityData = citySpots.find((c: any) => c.city === filterCity);
    return cityData?.spots || [];
  }, [filterCity, citySpots]);

  // 处理城市变化
  const handleCityChange = (city: string) => {
    setFilterCity(city);
    setFilterSpot('all');
    setPage(1);
  };

  // 处理排序
  const handleSort = (field: 'createdAt' | 'orderAmount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // 处理导出
  const handleExport = async () => {
    try {
      const result = await fetchExportData();
      if (!result.data || result.data.length === 0) {
        toast.error('没有可导出的数据');
        return;
      }

      // 生成CSV内容
      const headers = EXPORT_FIELDS.filter(f => exportFields.includes(f.key)).map(f => f.label);
      const rows = result.data.map((order: any) => {
        return exportFields.map(field => {
          switch (field) {
            case 'location':
              return order.city && order.scenicSpot ? `${order.city}-${order.scenicSpot}` : '-';
            case 'faceType':
              return FACE_TYPE_MAP[order.faceType] || order.faceType || '-';
            case 'orderAmount':
              return (order.orderAmount / 100).toFixed(2);
            case 'orderStatus':
              return ORDER_STATUS[order.orderStatus as keyof typeof ORDER_STATUS]?.label || order.orderStatus;
            case 'createdAt':
              return order.createdAt ? format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss') : '-';
            default:
              return order[field] || '-';
          }
        });
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // 下载文件
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `订单导出_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
      link.click();
      
      toast.success('导出成功');
      setShowExportDialog(false);
    } catch (error) {
      toast.error('导出失败');
    }
  };

  // 打开订单详情
  const openOrderDetail = (order: any) => {
    setSelectedOrder(order);
    setShowDetailDialog(true);
  };

  // 打开状态修改弹窗
  const openStatusDialog = (order: any) => {
    setSelectedOrder(order);
    setNewStatus(order.orderStatus);
    setShowStatusDialog(true);
  };

  // 确认修改状态
  const confirmStatusChange = () => {
    if (selectedOrder && newStatus) {
      updateStatusMutation.mutate({
        orderId: selectedOrder.id,
        status: newStatus as 'pending' | 'paid' | 'completed' | 'failed',
      });
    }
  };

  // 清除筛选
  const clearFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterChannel('all');
    setFilterCity('all');
    setFilterSpot('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const orders = ordersData?.orders || [];
  const total = ordersData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#6f5d55]">订单管理</h1>
            <p className="text-sm text-muted-foreground">查看和管理所有订单</p>
          </div>
          <Button variant="outline" onClick={() => setShowExportDialog(true)}>
            <Download className="w-4 h-4 mr-2" />
            导出订单
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总订单数</p>
                  <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总收入</p>
                  <p className="text-2xl font-bold">¥{typeof stats?.totalRevenue === 'number' ? (stats.totalRevenue / 100).toFixed(2) : '0.00'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">今日订单</p>
                  <p className="text-2xl font-bold">{stats?.todayOrders || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">今日收入</p>
                  <p className="text-2xl font-bold">¥{typeof stats?.todayRevenue === 'number' ? (stats.todayRevenue / 100).toFixed(2) : '0.00'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索和筛选栏 */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* 搜索行 */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索订单ID、用户ID、第三方订单号..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-accent' : ''}
              >
                <Filter className="w-4 h-4 mr-2" />
                筛选
              </Button>
              {(filterStatus !== 'all' || filterChannel !== 'all' || filterCity !== 'all' || startDate || endDate) && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  清除筛选
                </Button>
              )}
            </div>

            {/* 筛选条件 */}
            {showFilters && (
              <div className="grid grid-cols-5 gap-4 pt-4 border-t">
                {/* 订单状态 */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">订单状态</Label>
                  <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="paid">已支付</SelectItem>
                      <SelectItem value="completed">已完成</SelectItem>
                      <SelectItem value="failed">失败</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 渠道 */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">渠道来源</Label>
                  <Select value={filterChannel} onValueChange={(v) => { setFilterChannel(v); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部渠道</SelectItem>
                      {channels?.map((channel: any) => (
                        <SelectItem key={channel.id} value={channel.id.toString()}>
                          {channel.channelName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 城市 */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">城市</Label>
                  <Select value={filterCity} onValueChange={handleCityChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部城市" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部城市</SelectItem>
                      {citySpots?.map((c: any) => (
                        <SelectItem key={c.city} value={c.city}>{c.city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 景点 */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">景点</Label>
                  <Select 
                    value={filterSpot} 
                    onValueChange={(v) => { setFilterSpot(v); setPage(1); }}
                    disabled={filterCity === 'all'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={filterCity === 'all' ? '请先选择城市' : '全部景点'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部景点</SelectItem>
                      {filteredSpots.map((s: any) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 时间范围 */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">时间范围</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                      className="text-xs"
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 订单列表 */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">订单ID</TableHead>
                  <TableHead>用户ID</TableHead>
                  <TableHead>发生位置</TableHead>
                  <TableHead>脸型</TableHead>
                  <TableHead>模板</TableHead>
                  <TableHead>结果图</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>消费积分</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSort('orderAmount')}
                  >
                    <div className="flex items-center gap-1">
                      支付金额
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead>渠道名称</TableHead>
                  <TableHead>渠道编号</TableHead>
                  <TableHead>第三方订单号</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      订单时间
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                      暂无订单数据
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order: any) => {
                    const templateIds = order.templateIds ? JSON.parse(order.templateIds) : [];
                    const resultUrls = order.resultUrls ? JSON.parse(order.resultUrls) : [];
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.orderNo}</TableCell>
                        <TableCell className="text-xs">{order.userOpenId || order.userId}</TableCell>
                        <TableCell className="text-xs">
                          {order.city && order.scenicSpot ? `${order.city}-${order.scenicSpot}` : '-'}
                        </TableCell>
                        <TableCell className="text-xs">{FACE_TYPE_MAP[order.faceType] || order.faceType || '-'}</TableCell>
                        <TableCell>
                          {templateIds.length > 0 ? (
                            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => window.open(`/share/templates/${order.id}`, '_blank')}>
                              查看({templateIds.length})
                            </Button>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {resultUrls.length > 0 ? (
                            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => window.open(`/share/results/${order.id}`, '_blank')}>
                              <ImageIcon className="w-3 h-3 mr-1" />
                              查看({resultUrls.length})
                            </Button>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-xs">{order.photoCount || 0}</TableCell>
                        <TableCell className="text-xs">{order.pointsUsed || 0}</TableCell>
                        <TableCell className="text-xs font-medium">¥{((order.orderAmount || 0) / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{order.channelName || '平台直接'}</TableCell>
                        <TableCell className="text-xs">{order.channelCode || '-'}</TableCell>
                        <TableCell className="text-xs font-mono">{order.thirdPartyOrderNo || '-'}</TableCell>
                        <TableCell>
                          <Badge className={ORDER_STATUS[order.orderStatus as keyof typeof ORDER_STATUS]?.color || ''}>
                            {ORDER_STATUS[order.orderStatus as keyof typeof ORDER_STATUS]?.label || order.orderStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {order.createdAt ? format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openOrderDetail(order)} title="查看详情">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openStatusDialog(order)} title="修改状态">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">
                  共 {total} 条记录，第 {page}/{totalPages} 页
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 订单详情对话框 - 简化版，只显示图片 */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>订单详情</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                {/* 自拍照 */}
                {selectedOrder.selfieUrl && (
                  <div>
                    <p className="text-sm text-[#6f5d55] font-medium mb-3">自拍照</p>
                    <a href={selectedOrder.selfieUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                      <img 
                        src={selectedOrder.selfieUrl} 
                        alt="自拍照" 
                        className="w-20 h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  </div>
                )}

                {/* 模板照 */}
                {selectedOrder.templateIds && (
                  <div>
                    <p className="text-sm text-[#6f5d55] font-medium mb-3">模板照</p>
                    <TemplateImagesDisplay templateIds={JSON.parse(selectedOrder.templateIds)} />
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 修改状态对话框 */}
        <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>修改订单状态</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">订单号</p>
                <p className="font-mono">{selectedOrder?.orderNo}</p>
              </div>
              <div>
                <Label>新状态</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">已支付</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatusDialog(false)}>取消</Button>
              <Button onClick={confirmStatusChange} disabled={updateStatusMutation.isPending}>
                {updateStatusMutation.isPending ? '保存中...' : '确认修改'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 导出对话框 */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>导出订单</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">选择要导出的字段：</p>
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {EXPORT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={field.key}
                      checked={exportFields.includes(field.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setExportFields([...exportFields, field.key]);
                        } else {
                          setExportFields(exportFields.filter(f => f !== field.key));
                        }
                      }}
                    />
                    <label htmlFor={field.key} className="text-sm">{field.label}</label>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setExportFields(EXPORT_FIELDS.map(f => f.key))}>
                  全选
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExportFields([])}>
                  取消全选
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>取消</Button>
              <Button onClick={handleExport} disabled={exportFields.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                导出CSV
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
