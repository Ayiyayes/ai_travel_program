import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Building2, 
  LogOut, 
  TrendingUp, 
  Users, 
  ShoppingCart, 
  DollarSign,
  Copy,
  QrCode,
  Key,
  User
} from 'lucide-react';
import { toast } from 'sonner';

interface ChannelUser {
  id: number;
  username: string;
  role: string;
  channelId: number | null;
  channelName?: string;
  mustChangePassword: boolean;
}

export default function ChannelDashboard() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<ChannelUser | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // 检查登录状态
  useEffect(() => {
    const storedUser = localStorage.getItem('channelUser');
    if (!storedUser) {
      navigate('/channel/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    
    // 首次登录不再强制修改密码，用户可以自行选择修改
    // if (parsedUser.mustChangePassword) {
    //   setShowChangePassword(true);
    // }
  }, [navigate]);

  // 获取渠道统计数据
  const { data: stats } = trpc.channelPortal.stats.useQuery(
    { channelId: user?.channelId || 0 },
    { enabled: !!user?.channelId }
  );

  // 获取推广码列表
  const { data: promoCodes } = trpc.channelPortal.promoCodes.useQuery(
    { channelId: user?.channelId || 0 },
    { enabled: !!user?.channelId }
  );

  // 获取最近订单
  const { data: recentOrders } = trpc.channelPortal.recentOrders.useQuery(
    { channelId: user?.channelId || 0, limit: 10 },
    { enabled: !!user?.channelId }
  );

  // 修改密码
  const changePasswordMutation = trpc.channelAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success('密码修改成功');
      setShowChangePassword(false);
      // 更新本地存储
      if (user) {
        const updatedUser = { ...user, mustChangePassword: false };
        localStorage.setItem('channelUser', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
    },
    onError: (err) => {
      toast.error(err.message || '密码修改失败');
    },
  });

  const handleChangePassword = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('新密码至少6位');
      return;
    }
    if (!user) return;
    
    changePasswordMutation.mutate({
      userId: user.id,
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('channelToken');
    localStorage.removeItem('channelUser');
    navigate('/channel/login');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-[#e89a8d]" />
            <span className="font-semibold text-lg">渠道商后台</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{user.channelName || user.username}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowChangePassword(true)}>
              <Key className="w-4 h-4 mr-1" />
              修改密码
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              退出
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总推广用户</p>
                  <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总订单数</p>
                  <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总销售额</p>
                  <p className="text-2xl font-bold">¥{stats?.totalSales || 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">预计佣金</p>
                  <p className="text-2xl font-bold">¥{stats?.totalCommission || 0}</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 推广码列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">我的推广码</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>推广码</TableHead>
                  <TableHead>城市</TableHead>
                  <TableHead>景区</TableHead>
                  <TableHead>扫码次数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes && promoCodes.length > 0 ? (
                  promoCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono">{code.promoCode}</TableCell>
                      <TableCell>{code.city}</TableCell>
                      <TableCell>{code.scenicSpot}</TableCell>
                      <TableCell>{code.scanCount || 0}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          code.status === 'active' 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {code.status === 'active' ? '启用' : '禁用'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(`${window.location.origin}${code.promotionLink}`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(`/qrcode/${code.promoCode}`, '_blank')}
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无推广码
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 最近订单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最近订单</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>佣金</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders && recentOrders.length > 0 ? (
                  recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">{order.orderNo}</TableCell>
                      <TableCell>{order.userName || '-'}</TableCell>
                      <TableCell>¥{order.amount}</TableCell>
                      <TableCell className="text-green-600">¥{order.commission}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          order.status === 'paid' 
                            ? 'bg-green-100 text-green-600' 
                            : order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {order.status === 'paid' ? '已支付' : order.status === 'pending' ? '待支付' : order.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      暂无订单数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* 修改密码对话框 */}
      <Dialog open={showChangePassword} onOpenChange={(open) => {
        // 如果是首次登录必须修改密码，不允许关闭
        if (!open && user?.mustChangePassword) {
          toast.error('首次登录请先修改密码');
          return;
        }
        setShowChangePassword(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {user?.mustChangePassword ? '首次登录请修改密码' : '修改密码'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>原密码</Label>
              <Input
                type="password"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                placeholder="请输入原密码"
              />
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="请输入新密码（至少6位）"
              />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="请再次输入新密码"
              />
            </div>
            <Button 
              className="w-full bg-[#e89a8d] hover:bg-[#d88a7d]"
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? '提交中...' : '确认修改'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
