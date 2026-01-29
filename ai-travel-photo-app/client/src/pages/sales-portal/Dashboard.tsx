import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import SalesPortalLayout from '@/components/SalesPortalLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  Users, 
  ShoppingCart, 
  DollarSign,
  RefreshCw,
  QrCode,
  FileText,
  Settings,
  TrendingUp
} from 'lucide-react';
import { Link } from 'wouter';

interface SalesUser {
  id: number;
  username: string;
  role: string;
  channelId: number | null;
  salesId: number | null;
  channelName?: string;
  salesName?: string;
  salesCode?: string;
}

export default function SalesDashboard() {
  const [user, setUser] = useState<SalesUser | null>(null);

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

  const { data: stats, isLoading, refetch } = trpc.channelPortal.salesDashboardStats.useQuery(
    { salesId: salesId! },
    { enabled: !!salesId }
  );

  const handleRefresh = () => {
    refetch();
  };

  return (
    <SalesPortalLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">数据总览</h1>
            <p className="text-muted-foreground">查看您的推广数据和业绩统计</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日扫码</p>
                  <p className="text-2xl font-bold">{stats?.todayScan || 0}</p>
                  <p className="text-xs text-muted-foreground">累计 {stats?.totalScan || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日新增用户</p>
                  <p className="text-2xl font-bold">{stats?.todayUsers || 0}</p>
                  <p className="text-xs text-muted-foreground">累计 {stats?.totalUsers || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日订单</p>
                  <p className="text-2xl font-bold">{stats?.todayOrders || 0}</p>
                  <p className="text-xs text-muted-foreground">累计 {stats?.totalOrders || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日销售额</p>
                  <p className="text-2xl font-bold">¥{((stats?.todaySales || 0) / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">累计 ¥{((stats?.totalSales || 0) / 100).toFixed(2)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 佣金统计和转化数据 */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 佣金统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-[#e89a8d]" />
                佣金统计
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">累计佣金</span>
                <span className="text-xl font-bold text-[#e89a8d]">¥{((stats?.totalCommission || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">待结算</span>
                <span className="font-medium">¥{((stats?.pendingCommission || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">已结算</span>
                <span className="font-medium">¥{((stats?.settledCommission || 0) / 100).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* 转化数据 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                转化数据
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">付费转化率</span>
                <span className="text-xl font-bold text-green-500">{stats?.conversionRate || '0.0'}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">扫码用户</span>
                <span className="font-medium">{stats?.totalScan || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">付费用户</span>
                <span className="font-medium">{stats?.paidUsers || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* 快捷操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/sales-portal/promotion">
                <Button variant="outline" className="w-full justify-start">
                  <QrCode className="h-4 w-4 mr-2" />
                  查看推广二维码
                </Button>
              </Link>
              <Link href="/sales-portal/orders">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  查看订单详情
                </Button>
              </Link>
              <Link href="/sales-portal/settings">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  账户设置
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* 推广提示 */}
        <Card className="bg-gradient-to-r from-[#e89a8d]/5 to-[#e89a8d]/10 border-[#e89a8d]/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-[#e89a8d]/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-[#e89a8d]" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">推广提示</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 通过您的专属推广码带来的用户，其所有消费都将计入您的业绩</li>
                  <li>• 佣金将在每月15日进行结算，请确保账户信息正确</li>
                  <li>• 如有疑问，请联系所属渠道管理员</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SalesPortalLayout>
  );
}
