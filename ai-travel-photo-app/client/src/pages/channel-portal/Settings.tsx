import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import ChannelPortalLayout from "@/components/ChannelPortalLayout";
import {
  User,
  Building,
  Calendar,
  Percent,
  Lock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ChannelPortalSettings() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwords, setPasswords] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });

  // 从 URL 参数或 localStorage 获取认证信息
  const urlParams = new URLSearchParams(window.location.search);
  const adminToken = urlParams.get('adminToken');
  const channelIdFromUrl = urlParams.get('channelId');
  const token = localStorage.getItem("channelToken") || "";
  
  // 管理员代登录模式
  const isAdminMode = adminToken === 'admin' && !!channelIdFromUrl;
  const effectiveChannelId = isAdminMode && channelIdFromUrl ? parseInt(channelIdFromUrl) : undefined;

  // 获取渠道信息
  const { data: channelInfo, isLoading, refetch } = trpc.channelPortal.channelInfo.useQuery(
    { channelId: effectiveChannelId || 0 },
    { enabled: !!effectiveChannelId }
  );

  

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleChangePassword = () => {
    if (!passwords.oldPassword || !passwords.newPassword || !passwords.confirmPassword) {
      toast.error("请填写完整信息");
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error("新密码长度不能少于6位");
      return;
    }
    // 暂时禁用修改密码功能（需要用户ID）
    toast.error("请联系管理员修改密码");
  };

  const getChannelTypeBadge = (type: string) => {
    return type === 'institution' 
      ? <Badge className="bg-blue-100 text-blue-700">机构渠道</Badge>
      : <Badge className="bg-green-100 text-green-700">个人渠道</Badge>;
  };

  return (
    <ChannelPortalLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">账户设置</h1>
            <p className="text-gray-500 mt-1">查看和管理您的账户信息</p>
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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#e89a8d]" />
          </div>
        ) : (
          <>
            {/* 账号基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">账号基本信息</CardTitle>
                <CardDescription>您的渠道账户基本信息</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* 渠道名称 */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#e89a8d]/10 rounded-full flex items-center justify-center">
                      <Building className="w-5 h-5 text-[#e89a8d]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">渠道名称</p>
                      <p className="font-medium">{channelInfo?.channelName || '-'}</p>
                    </div>
                  </div>
                  {/* 渠道编码 */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">渠道编码</p>
                      <p className="font-medium font-mono">{channelInfo?.channelCode || '-'}</p>
                    </div>
                  </div>
                  {/* 渠道类型 */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Building className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">渠道类型</p>
                      <div className="mt-1">
                        {channelInfo && getChannelTypeBadge(channelInfo.channelType)}
                      </div>
                    </div>
                  </div>
                  {/* 佣金比例 */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Percent className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">佣金比例</p>
                      <p className="font-medium text-[#e89a8d]">{channelInfo?.commissionRate || 0}%</p>
                    </div>
                  </div>
                  {/* 加入时间 */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">渠道加入时间</p>
                      <p className="font-medium">
                        {channelInfo?.createdAt ? format(new Date(channelInfo.createdAt), 'yyyy-MM-dd') : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 安全设置 - 机构渠道和个人渠道都显示 */}
            {!isAdminMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">安全设置</CardTitle>
                  <CardDescription>管理您的账户安全</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Lock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium">登录密码</p>
                        <p className="text-sm text-gray-500">定期修改密码可以提高账户安全性</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      修改密码
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* 修改密码弹窗 */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>修改密码</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>当前密码</Label>
                <Input
                  type="password"
                  placeholder="请输入当前密码"
                  value={passwords.oldPassword}
                  onChange={(e) => setPasswords({ ...passwords, oldPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>新密码</Label>
                <Input
                  type="password"
                  placeholder="请输入新密码（至少6位）"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>确认新密码</Label>
                <Input
                  type="password"
                  placeholder="请再次输入新密码"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                取消
              </Button>
              <Button
                className="bg-[#e89a8d] hover:bg-[#d4887b]"
                onClick={handleChangePassword}
              >
                确认修改
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ChannelPortalLayout>
  );
}
