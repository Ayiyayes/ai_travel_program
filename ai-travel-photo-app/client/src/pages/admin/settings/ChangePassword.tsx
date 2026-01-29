import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Key, Shield, AlertCircle, MessageSquare, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 获取当前登录的渠道用户
  const channelUserStr = localStorage.getItem('channelUser');
  const channelUser = channelUserStr ? JSON.parse(channelUserStr) : null;

  // 检查短信服务是否已配置
  const { data: smsConfig } = trpc.channelAuth.checkSmsConfigured.useQuery();

  // 发送验证码
  const sendCodeMutation = trpc.channelAuth.sendPasswordVerifyCode.useMutation({
    onSuccess: () => {
      toast.success('验证码已发送到手机 186****5881');
      setCountdown(60);
    },
    onError: (err) => {
      toast.error(err.message || '发送验证码失败');
    },
  });

  // 修改密码
  const changePasswordMutation = trpc.channelAuth.changeSuperAdminPassword.useMutation({
    onSuccess: () => {
      toast.success('密码修改成功');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setVerifyCode('');
      setError('');
    },
    onError: (err) => {
      setError(err.message || '密码修改失败');
    },
  });

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = () => {
    if (countdown > 0) return;
    sendCodeMutation.mutate();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('请填写所有密码字段');
      return;
    }

    if (!verifyCode || verifyCode.length !== 6) {
      setError('请输入6位短信验证码');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (oldPassword === newPassword) {
      setError('新密码不能与当前密码相同');
      return;
    }

    changePasswordMutation.mutate({
      oldPassword,
      newPassword,
      verifyCode,
    });
  };

  // 检查是否是超级管理员
  if (!channelUser || channelUser.role !== 'superadmin') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <Shield className="w-12 h-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">无权限访问</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    此功能仅限超级管理员使用
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold">修改密码</h1>
          <p className="text-sm text-muted-foreground">修改超级管理员登录密码（需要短信验证）</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 密码修改表单 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                修改登录密码
              </CardTitle>
              <CardDescription>
                请输入当前密码、新密码和短信验证码
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* 短信服务未配置提示 */}
                {smsConfig && !smsConfig.configured && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      短信服务未配置，请联系管理员配置腾讯云短信服务后再使用此功能。
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="oldPassword">当前密码</Label>
                  <Input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="请输入当前密码"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">新密码</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="请输入新密码（至少6位）"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认新密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verifyCode">短信验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="verifyCode"
                      type="text"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="请输入6位验证码"
                      maxLength={6}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      disabled={countdown > 0 || sendCodeMutation.isPending || !smsConfig?.configured}
                      className="w-28 shrink-0"
                    >
                      {sendCodeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : countdown > 0 ? (
                        `${countdown}秒后重发`
                      ) : (
                        '获取验证码'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    验证码将发送到手机号 186****5881
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#e89a8d] hover:bg-[#d88a7d]"
                  disabled={changePasswordMutation.isPending || !smsConfig?.configured}
                >
                  {changePasswordMutation.isPending ? '修改中...' : '确认修改'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 安全提示 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                安全提示
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• 密码长度至少6位</p>
                <p>• 建议使用字母、数字和特殊字符的组合</p>
                <p>• 请勿使用与其他网站相同的密码</p>
                <p>• 定期更换密码可以提高账户安全性</p>
                <p>• 请妥善保管您的密码，不要告诉他人</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-[#e89a8d]" />
                  <p className="text-sm font-medium">短信验证</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  为保障账户安全，修改密码需要通过短信验证码确认身份。验证码将发送到绑定的手机号，有效期为5分钟。
                </p>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium">当前账号</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {channelUser.username}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
