import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import SalesPortalLayout from '@/components/SalesPortalLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Phone, 
  Building2,
  Calendar,
  Percent,
  Lock,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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

export default function SalesSettings() {
  const [user, setUser] = useState<SalesUser | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const { data: salesInfo, isLoading, refetch } = trpc.channelPortal.salesInfo.useQuery(
    { salesId: salesId! },
    { enabled: !!salesId }
  );

  const changePasswordMutation = trpc.channelAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success('密码修改成功');
      setPasswordDialogOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      toast.error(err.message || '密码修改失败');
    },
  });

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('请填写完整信息');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码至少6位');
      return;
    }
    if (!user) return;
    
    changePasswordMutation.mutate({
      userId: user.id,
      oldPassword,
      newPassword,
    });
  };

  return (
    <SalesPortalLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">账户设置</h1>
            <p className="text-muted-foreground">查看和管理您的账户信息</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>

        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>您的推广员账户基本信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#e89a8d]/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-[#e89a8d]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">姓名</p>
                  <p className="font-medium">{salesInfo?.salesName || user?.salesName || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">推广员编码</p>
                  <p className="font-medium font-mono">
                    {salesInfo?.channelCode && salesInfo?.salesCode 
                      ? `${salesInfo.channelCode}-${salesInfo.salesCode}` 
                      : salesInfo?.salesCode || user?.salesCode || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">所属渠道</p>
                  <p className="font-medium">{salesInfo?.channelName || user?.channelName || '-'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 账户状态 */}
        <Card>
          <CardHeader>
            <CardTitle>账户状态</CardTitle>
            <CardDescription>您的账户合作状态信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">账户状态</p>
                <Badge variant={salesInfo?.status === 'active' ? 'default' : 'secondary'}>
                  {salesInfo?.status === 'active' ? '正常' : '已停用'}
                </Badge>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Percent className="h-4 w-4" />
                  <span className="text-sm">佣金比例</span>
                </div>
                <p className="text-xl font-bold text-[#e89a8d]">{salesInfo?.commissionRate || 0}%</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">加入时间</span>
                </div>
                <p className="font-medium">
                  {salesInfo?.createdAt ? new Date(salesInfo.createdAt).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 安全设置 */}
        <Card>
          <CardHeader>
            <CardTitle>安全设置</CardTitle>
            <CardDescription>管理您的账户安全</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Lock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium">登录密码</p>
                  <p className="text-sm text-muted-foreground">定期修改密码可以提高账户安全性</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(true)}>
                修改密码
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 修改密码弹窗 */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>原密码</Label>
              <div className="relative">
                <Input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入原密码"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                >
                  {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码（至少6位）"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
              className="bg-[#e89a8d] hover:bg-[#d88a7d]"
            >
              {changePasswordMutation.isPending ? '提交中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SalesPortalLayout>
  );
}
