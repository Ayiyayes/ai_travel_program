import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import ChannelPortalLayout from "@/components/ChannelPortalLayout";
import {
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Download,
  ArrowUpDown,
  Image as ImageIcon,
  ExternalLink,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// 订单状态配置
const ORDER_STATUS = {
  pending: { label: '待支付', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: '已支付', color: 'bg-green-100 text-green-700' },
  completed: { label: '已完成', color: 'bg-blue-100 text-blue-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
};

// 模板图片展示组件（渠道门户版）
function ChannelTemplateImagesDisplay({ templateIds, orderId }: { templateIds: string[]; orderId: number }) {
  const [templates, setTemplates] = useState<{ templateId: string; imageUrl: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取模板图片（使用公开API）
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

// 脸型映射
const FACE_TYPE_MAP: Record<string, string> = {
  wide: '宽脸',
  narrow: '窄脸',
  normal: '通用',
};

export default function ChannelPortalOrders() {
  // 筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterSpot, setFilterSpot] = useState("all");
  const [filterSalesId, setFilterSalesId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // 排序状态
  const [sortBy, setSortBy] = useState<'createdAt' | 'orderAmount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pageSize = 20;
  
  // 弹窗状态
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // 从 URL 参数或 localStorage 获取认证信息
  const urlParams = new URLSearchParams(window.location.search);
  const adminToken = urlParams.get('adminToken');
  const channelIdFromUrl = urlParams.get('channelId');
  const token = localStorage.getItem("channelToken") || "";
  
  // 管理员代登录模式
  const isAdminMode = adminToken === 'admin' && !!channelIdFromUrl;
  const effectiveChannelId = isAdminMode && channelIdFromUrl ? parseInt(channelIdFromUrl) : undefined;

  // 获取渠道信息（用于判断是否为机构渠道）
  const { data: channelInfo } = trpc.channelPortal.channelInfo.useQuery(
    { channelId: effectiveChannelId || 0 },
    { enabled: !!effectiveChannelId }
  );
  
  // 检查是否为机构渠道
  const isInstitution = channelInfo?.channelType === 'institution';
  
  // 获取推广员列表（仅机构渠道）
  const { data: salesList } = trpc.channelPortal.salesList.useQuery(
    { channelId: effectiveChannelId || 0 },
    { enabled: isInstitution && !!effectiveChannelId }
  );

  // 获取订单列表
  const { data: ordersData, isLoading, refetch } = trpc.channelPortal.orders.useQuery(
    { 
      token: isAdminMode ? undefined : token,
      channelId: effectiveChannelId,
      page: currentPage,
      pageSize,
      status: statusFilter !== "all" ? statusFilter : undefined,
      search: searchQuery || undefined,
      city: filterCity !== "all" ? filterCity : undefined,
      scenicSpot: filterSpot !== "all" ? filterSpot : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      salesId: filterSalesId,
      sortBy,
      sortOrder,
    },
    { enabled: isAdminMode ? true : !!token }
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
    setCurrentPage(1);
  };

  // 处理排序
  const handleSort = (field: 'createdAt' | 'orderAmount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // 清除筛选
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setFilterCity('all');
    setFilterSpot('all');
    setFilterSalesId(undefined);
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // 打开订单详情
  const openOrderDetail = (order: any) => {
    setSelectedOrder(order);
    setShowDetailDialog(true);
  };

  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // 格式化金额（分转元）
  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  return (
    <ChannelPortalLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">订单查询</h1>
            <p className="text-gray-500 mt-1">查看您的渠道订单记录</p>
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

        {/* 搜索和筛选区域 */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* 搜索行 */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索订单ID、用户ID、第三方订单号..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
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
              {(statusFilter !== 'all' || filterCity !== 'all' || filterSalesId !== undefined || startDate || endDate) && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  清除筛选
                </Button>
              )}
            </div>

            {/* 筛选条件 */}
            {showFilters && (
              <div className={`grid gap-4 pt-4 border-t ${isInstitution ? 'grid-cols-5' : 'grid-cols-4'}`}>
                {/* 订单状态 */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">订单状态</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
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
                    onValueChange={(v) => { setFilterSpot(v); setCurrentPage(1); }}
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
                      onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                      className="text-xs"
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* 推广员筛选（仅机构渠道显示） */}
                {isInstitution && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">推广员</Label>
                    <Select 
                      value={filterSalesId?.toString() || 'all'} 
                      onValueChange={(v) => { 
                        setFilterSalesId(v === 'all' ? undefined : parseInt(v)); 
                        setCurrentPage(1); 
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="全部推广员" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部推广员</SelectItem>
                        {salesList?.map((s: any) => (
                          <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 订单列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">订单列表</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#e89a8d]" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                暂无订单数据
              </div>
            ) : (
              <>
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
                      <TableHead className="w-[60px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => {
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
                          <TableCell className="text-xs font-medium">¥{formatAmount(order.orderAmount || 0)}</TableCell>
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
                            <Button variant="ghost" size="sm" onClick={() => openOrderDetail(order)} title="查看详情">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-500">
                      共 {totalCount} 条记录，第 {currentPage} / {totalPages} 页
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        下一页
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
                    <ChannelTemplateImagesDisplay templateIds={JSON.parse(selectedOrder.templateIds)} orderId={selectedOrder.id} />
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ChannelPortalLayout>
  );
}
