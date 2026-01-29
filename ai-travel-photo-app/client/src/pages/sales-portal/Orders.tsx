import { useEffect, useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import SalesPortalLayout from '@/components/SalesPortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  Filter,
  X,
  ArrowUpDown,
  ExternalLink,
  Eye,
} from 'lucide-react';

interface SalesUser {
  id: number;
  username: string;
  role: string;
  channelId: number | null;
  salesId: number | null;
}

// 订单状态配置
const ORDER_STATUS = {
  pending: { label: '待支付', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '已支付', color: 'bg-green-100 text-green-700' },
  completed: { label: '已完成', color: 'bg-blue-100 text-blue-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
};

// 脸型映射
const FACE_TYPE_MAP: Record<string, string> = {
  wide: '宽脸',
  narrow: '窄脸',
  normal: '通用',
};

export default function SalesOrders() {
  const [user, setUser] = useState<SalesUser | null>(null);
  
  // 筛选状态
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterSpot, setFilterSpot] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // 排序状态
  const [sortBy, setSortBy] = useState<'createdAt' | 'orderAmount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  // 弹窗状态
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

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

  const { data, isLoading, refetch } = trpc.channelPortal.salesOrders.useQuery(
    { 
      salesId: salesId!,
      page,
      pageSize,
      status: status === 'all' ? undefined : status,
      search: search || undefined,
      city: filterCity !== 'all' ? filterCity : undefined,
      scenicSpot: filterSpot !== 'all' ? filterSpot : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      sortBy,
      sortOrder,
    },
    { enabled: !!salesId }
  );

  // 获取城市景点列表用于筛选
  const { data: citySpots } = trpc.admin.citySpots.useQuery();

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

  // 清除筛选
  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setFilterCity('all');
    setFilterSpot('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // 打开订单详情
  const openOrderDetail = (order: any) => {
    setSelectedOrder(order);
    setShowDetailDialog(true);
  };

  const orders = data?.orders || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // 格式化金额（分转元）
  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  const getStatusBadge = (orderStatus: string) => {
    const config = ORDER_STATUS[orderStatus as keyof typeof ORDER_STATUS] || { label: orderStatus, color: 'bg-gray-100 text-gray-700' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  // 检查是否有活跃的筛选条件
  const hasActiveFilters = status !== 'all' || filterCity !== 'all' || startDate || endDate;

  return (
    <SalesPortalLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">订单查询</h1>
            <p className="text-muted-foreground text-sm">查看您推广带来的订单</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* 搜索行 */}
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索订单编号、用户ID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-10"
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
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  清除筛选
                </Button>
              )}
            </div>

            {/* 筛选条件 */}
            {showFilters && (
              <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                {/* 订单状态 */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">订单状态</Label>
                  <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部状态</SelectItem>
                      <SelectItem value="pending">待支付</SelectItem>
                      <SelectItem value="paid">已支付</SelectItem>
                      <SelectItem value="completed">已完成</SelectItem>
                      <SelectItem value="failed">失败</SelectItem>
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
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              订单列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e89a8d]" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无订单数据</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>订单编号</TableHead>
                        <TableHead>发生位置</TableHead>
                        <TableHead>脸型</TableHead>
                        <TableHead>模板</TableHead>
                        <TableHead>结果图</TableHead>
                        <TableHead 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('orderAmount')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            订单金额
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right">佣金</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('createdAt')}
                        >
                          <div className="flex items-center gap-1">
                            下单时间
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => {
                        const templateIds = order.templateIds ? JSON.parse(order.templateIds) : [];
                        const resultImages = order.resultImages ? JSON.parse(order.resultImages) : [];
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">{order.orderNo}</TableCell>
                            <TableCell>
                              {order.city && order.scenicSpot 
                                ? `${order.city}-${order.scenicSpot}` 
                                : order.city || order.scenicSpot || '-'}
                            </TableCell>
                            <TableCell>{FACE_TYPE_MAP[order.faceType] || order.faceType || '-'}</TableCell>
                            <TableCell>
                              {templateIds.length > 0 ? (
                                <a 
                                  href={`/share/templates/${order.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#e89a8d] hover:underline flex items-center gap-1"
                                >
                                  查看({templateIds.length})
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {resultImages.length > 0 ? (
                                <a 
                                  href={`/share/results/${order.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:underline flex items-center gap-1"
                                >
                                  查看({resultImages.length})
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right">¥{formatAmount(order.orderAmount || 0)}</TableCell>
                            <TableCell className="text-right text-[#e89a8d]">¥{formatAmount(order.commissionAmount || 0)}</TableCell>
                            <TableCell>{getStatusBadge(order.orderStatus)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openOrderDetail(order)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      共 {total} 条记录，第 {page} / {totalPages} 页
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 订单详情弹窗 - 只显示图片 */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>订单详情</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                {/* 自拍照 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">自拍照</h3>
                  {selectedOrder.selfieUrl ? (
                    <a href={selectedOrder.selfieUrl} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={selectedOrder.selfieUrl} 
                        alt="自拍照" 
                        className="w-24 h-24 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">无自拍照</p>
                  )}
                </div>

                {/* 模板照 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">模板照</h3>
                  <SalesTemplateImagesDisplay 
                    templateIds={selectedOrder.templateIds ? JSON.parse(selectedOrder.templateIds) : []} 
                    orderId={selectedOrder.id} 
                  />
                </div>

                {/* 结果图 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">结果图</h3>
                  {selectedOrder.resultImages ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {JSON.parse(selectedOrder.resultImages).map((url: string, index: number) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={url} 
                            alt={`结果图 ${index + 1}`} 
                            className="w-full aspect-[3/4] object-cover rounded-lg border hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">无结果图</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SalesPortalLayout>
  );
}

// 模板图片展示组件
function SalesTemplateImagesDisplay({ templateIds, orderId }: { templateIds: string[]; orderId: number }) {
  const [templates, setTemplates] = useState<{ templateId: string; imageUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch(`/api/trpc/public.orderTemplates?input=${encodeURIComponent(JSON.stringify({ orderId }))}`);
        const data = await response.json();
        if (data.result?.data?.templates) {
          setTemplates(data.result.data.templates);
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (orderId > 0) {
      fetchTemplates();
    } else {
      setLoading(false);
    }
  }, [orderId]);

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
