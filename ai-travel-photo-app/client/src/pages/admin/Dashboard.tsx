import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/_core/hooks/useAdminAuth';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Image, 
  DollarSign, 
  TrendingUp,
  Building2,
  UserCheck,
  ShoppingCart
} from 'lucide-react';

// 统计卡片组件
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  color = 'primary'
}: { 
  title: string; 
  value: string | number; 
  icon: any;
  trend?: string;
  color?: 'primary' | 'success' | 'warning' | 'info';
}) {
  const colorClasses = {
    primary: 'bg-[#e89a8d]/10 text-[#e89a8d]',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-yellow-100 text-yellow-600',
    info: 'bg-blue-100 text-blue-600',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user } = useAdminAuth();
  const [, navigate] = useLocation();

  // 获取统计数据
  const { data: stats, isLoading } = trpc.admin.dashboard.useQuery();

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">管理后台</h1>
            <p className="text-sm text-muted-foreground">欢迎回来，{user?.name || '管理员'}</p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="总渠道数"
            value={stats?.totalChannels || 0}
            icon={Building2}
            color="primary"
          />
          <StatCard
            title="活跃渠道"
            value={stats?.activeChannels || 0}
            icon={UserCheck}
            color="success"
          />
          <StatCard
            title="总订单数"
            value={stats?.totalOrders || 0}
            icon={ShoppingCart}
            color="info"
          />
          <StatCard
            title="总收入"
            value={`¥${((stats?.totalRevenue || 0) / 100).toFixed(2)}`}
            icon={DollarSign}
            color="warning"
          />
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/admin/templates')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5 text-[#e89a8d]" />
                模板管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                管理换脸模板，支持批量导入和编辑
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/admin/channels')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#e89a8d]" />
                渠道管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                管理机构渠道和个人渠道，配置佣金分成
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/admin/orders')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#e89a8d]" />
                订单管理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                查看所有订单，管理订单状态
              </p>
            </CardContent>
          </Card>


        </div>
      </div>
    </AdminLayout>
  );
}
