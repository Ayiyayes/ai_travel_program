import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  TrendingUp, 
  ShoppingCart, 
  DollarSign,
  RefreshCw,
  Clock,
  Power,
  PowerOff,
  Building2,
  User,
  Trophy,
  Medal,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TimeRange = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'all';

// 根据时间范围计算日期
function getDateRange(timeRange: TimeRange): { startDate?: Date; endDate?: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (timeRange) {
    case 'today':
      return { startDate: today, endDate: now };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { startDate: yesterday, endDate: today };
    }
    case 'last7days': {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return { startDate: sevenDaysAgo, endDate: now };
    }
    case 'last30days': {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return { startDate: thirtyDaysAgo, endDate: now };
    }
    case 'thisMonth': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: monthStart, endDate: now };
    }
    case 'lastMonth': {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { startDate: lastMonthStart, endDate: lastMonthEnd };
    }
    case 'all':
    default:
      return {};
  }
}

export default function ChannelStatsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  
  const dateRange = useMemo(() => getDateRange(timeRange), [timeRange]);
  
  // 获取统计数据
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.channel.stats.useQuery(
    dateRange.startDate && dateRange.endDate 
      ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
      : undefined,
    {
      refetchInterval: autoRefresh ? 30000 : false,
    }
  );
  
  // 获取排行榜数据
  const { data: ranking, isLoading: rankingLoading, refetch: refetchRanking } = trpc.channel.ranking.useQuery(
    dateRange.startDate && dateRange.endDate 
      ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
      : undefined,
    {
      refetchInterval: autoRefresh ? 30000 : false,
    }
  );
  
  // 获取渠道列表（用于显示没有订单的渠道）
  const { data: channels } = trpc.channel.list.useQuery();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStats(), refetchRanking()]);
    setLastRefreshTime(new Date());
    setIsRefreshing(false);
  };
  
  const formatLastRefreshTime = () => {
    return lastRefreshTime.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  
  // 合并排行榜数据和渠道列表
  const fullRanking = useMemo(() => {
    if (!channels) return ranking || [];
    
    const rankingChannelIds = new Set((ranking || []).map(r => r.channelId));
    const channelsWithoutOrders = channels
      .filter(c => !rankingChannelIds.has(c.id))
      .map(c => ({
        channelId: c.id,
        orderCount: 0,
        totalRevenue: 0,
        totalCommission: 0,
        channel: {
          id: c.id,
          channelName: c.channelName,
          channelCode: c.channelCode,
          channelType: c.channelType,
        },
      }));
    
    return [...(ranking || []), ...channelsWithoutOrders];
  }, [ranking, channels]);
  
  // 获取排名图标
  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">{index + 1}</span>;
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* 页面标题和操作栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">渠道统计</h1>
            <p className="text-sm text-muted-foreground">查看所有渠道的核心数据概览</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="选择时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部时间</SelectItem>
                <SelectItem value="today">今日</SelectItem>
                <SelectItem value="yesterday">昨日</SelectItem>
                <SelectItem value="last7days">近7日</SelectItem>
                <SelectItem value="last30days">近30日</SelectItem>
                <SelectItem value="thisMonth">本月</SelectItem>
                <SelectItem value="lastMonth">上月</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {formatLastRefreshTime()}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
                {autoRefresh ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Power className="h-3 w-3" />
                    自动刷新
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <PowerOff className="h-3 w-3" />
                    自动刷新
                  </span>
                )}
              </Label>
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">渠道总数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "-" : stats?.totalChannels || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600 inline-flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  本月新增 {stats?.newChannelsThisMonth || 0}
                </span>
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃渠道</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "-" : stats?.activeChannels || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                状态为启用的渠道
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总订单数</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? "-" : stats?.totalOrders || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                已完成订单
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总佣金</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#e89a8d]">
                ¥{statsLoading ? "-" : Number(stats?.totalCommission || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                总销售额 ¥{Number(stats?.totalRevenue || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 渠道排行榜 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              渠道排行榜
            </CardTitle>
            <CardDescription>
              按销售额排序的渠道业绩排名
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rankingLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : fullRanking.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">排名</TableHead>
                      <TableHead>渠道名称</TableHead>
                      <TableHead>渠道编码</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead className="text-right">订单数</TableHead>
                      <TableHead className="text-right">销售额</TableHead>
                      <TableHead className="text-right">佣金</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullRanking.map((item, index) => (
                      <TableRow 
                        key={item.channelId}
                        className={cn(
                          index < 3 && "bg-muted/30"
                        )}
                      >
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {getRankIcon(index)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.channel?.channelName || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {item.channel?.channelCode || '-'}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs",
                            item.channel?.channelType === 'institution'
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          )}>
                            {item.channel?.channelType === 'institution' ? (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                机构
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3" />
                                个人
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.orderCount}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ¥{Number(item.totalRevenue || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-[#e89a8d] font-medium">
                          ¥{Number(item.totalCommission || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
