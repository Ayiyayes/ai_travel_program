import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import ChannelPortalLayout from "@/components/ChannelPortalLayout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  Users,
  ShoppingCart,
  Wallet,
  TrendingUp,
  RefreshCw,
  Loader2,
  Eye,
  UserPlus,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";

export default function ChannelPortalDashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trendDays, setTrendDays] = useState(7);
  
  // 从 URL 参数或 localStorage 获取认证信息
  const urlParams = new URLSearchParams(window.location.search);
  const adminToken = urlParams.get('adminToken');
  const channelIdFromUrl = urlParams.get('channelId');
  const token = localStorage.getItem("channelToken") || "";
  
  // 管理员代登录模式：使用 URL 中的 channelId
  const isAdminMode = adminToken === 'admin' && !!channelIdFromUrl;
  const effectiveChannelId = isAdminMode && channelIdFromUrl ? parseInt(channelIdFromUrl) : undefined;

  // 获取统计数据
  const { data: statsData, isLoading, refetch } = trpc.channelPortal.dashboardStats.useQuery(
    { 
      token: isAdminMode ? undefined : token,
      channelId: effectiveChannelId 
    },
    { enabled: isAdminMode ? true : !!token }
  );

  // 获取订单趋势数据
  const { data: trendData, isLoading: trendLoading, refetch: refetchTrend } = trpc.channelPortal.orderTrend.useQuery(
    { 
      channelId: effectiveChannelId || 0,
      days: trendDays,
    },
    { enabled: !!effectiveChannelId }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchTrend()]);
    setIsRefreshing(false);
  };

  // 格式化金额（分转元）
  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  const stats = statsData?.stats || {
    scanCount: 0,
    newUsers: 0,
    orderCount: 0,
    orderAmount: 0,
    commissionAmount: 0,
    conversionRate: 0,
    todayScanCount: 0,
    todayNewUsers: 0,
    todayOrderCount: 0,
    todayOrderAmount: 0,
  };

  // 处理趋势数据用于图表显示
  const chartData = trendData?.map(item => ({
    ...item,
    orderAmountYuan: item.orderAmount / 100,
    commissionAmountYuan: item.commissionAmount / 100,
  })) || [];

  return (
    <ChannelPortalLayout>
      <div className="space-y-6">
        {/* 页面标题和操作 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">数据总览</h1>
            <p className="text-gray-500 mt-1">查看您的推广数据和业绩统计</p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            刷新数据
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-[#e89a8d]" />
          </div>
        ) : (
          <>
            {/* 今日数据 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">今日扫码</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {stats.todayScanCount}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">累计 {stats.scanCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Eye className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">今日新增用户</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {stats.todayNewUsers}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">累计 {stats.newUsers}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <UserPlus className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">今日订单</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {stats.todayOrderCount}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">累计 {stats.orderCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">今日销售额</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        ¥{formatAmount(stats.todayOrderAmount)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">累计 ¥{formatAmount(stats.orderAmount)}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 订单趋势图表 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-[#e89a8d]" />
                    订单趋势
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={trendDays === 7 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTrendDays(7)}
                      className={trendDays === 7 ? "bg-[#e89a8d] hover:bg-[#d88a7d]" : ""}
                    >
                      近7天
                    </Button>
                    <Button
                      variant={trendDays === 30 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTrendDays(30)}
                      className={trendDays === 30 ? "bg-[#e89a8d] hover:bg-[#d88a7d]" : ""}
                    >
                      近30天
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {trendLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-6 w-6 animate-spin text-[#e89a8d]" />
                  </div>
                ) : chartData.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 订单数量趋势 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-4">订单数量</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="dateLabel" 
                            tick={{ fontSize: 12 }}
                            stroke="#9ca3af"
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            stroke="#9ca3af"
                            allowDecimals={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: number) => [`${value} 单`, '订单数']}
                          />
                          <Bar 
                            dataKey="orderCount" 
                            fill="#e89a8d" 
                            radius={[4, 4, 0, 0]}
                            name="订单数"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* 佣金收入趋势 */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-4">佣金收入</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="dateLabel" 
                            tick={{ fontSize: 12 }}
                            stroke="#9ca3af"
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            stroke="#9ca3af"
                            tickFormatter={(value) => `¥${value}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: number) => [`¥${value.toFixed(2)}`, '佣金']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="commissionAmountYuan" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6 }}
                            name="佣金"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <Calendar className="h-12 w-12 mb-4" />
                    <p>暂无订单数据</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 核心指标 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 佣金统计 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-[#e89a8d]" />
                    佣金统计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-500">累计佣金</span>
                      <span className="text-2xl font-bold text-[#e89a8d]">
                        ¥{formatAmount(stats.commissionAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-500 text-sm">待结算</span>
                      <span className="font-medium text-gray-800">
                        ¥{formatAmount(stats.commissionAmount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-500 text-sm">已结算</span>
                      <span className="font-medium text-gray-800">¥0.00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 转化率 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Percent className="h-5 w-5 text-green-600" />
                    转化数据
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-500">付费转化率</span>
                      <span className="text-2xl font-bold text-green-600">
                        {stats.conversionRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-500 text-sm">扫码用户</span>
                      <span className="font-medium text-gray-800">{stats.scanCount}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-gray-500 text-sm">付费用户</span>
                      <span className="font-medium text-gray-800">{stats.orderCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 快捷操作 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">快捷操作</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.location.href = "/channel-portal/promotion"}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      查看推广二维码
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.location.href = "/channel-portal/orders"}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      查看订单详情
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => window.location.href = "/channel-portal/settings"}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      账户设置
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 提示信息 */}
            <Card className="bg-gradient-to-r from-[#fdf2f0] to-[#fef5f3] border-0 shadow-sm">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <TrendingUp className="h-4 w-4 text-[#e89a8d]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-800">推广提示</h3>
                    <ul className="text-sm text-gray-600 mt-1 space-y-1">
                      <li>• 通过您的专属推广码带来的用户，其所有消费都将计入您的业绩</li>
                      <li>• 佣金将在每月15日进行结算，请确保账户信息正确</li>
                      <li>• 如有疑问，请联系管理员</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ChannelPortalLayout>
  );
}
