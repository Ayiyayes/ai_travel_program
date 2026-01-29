import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Search, 
  Eye,
  Download,
  Users,
  UserPlus,
  Activity,
  Coins,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// 用户角色配置
const USER_ROLES = {
  user: { label: '普通用户', color: 'bg-gray-100 text-gray-800' },
  admin: { label: '管理员', color: 'bg-purple-100 text-purple-800' },
};

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // 获取用户列表
  const { data: users, isLoading } = trpc.admin.users.useQuery({
    searchTerm: searchTerm || undefined,
  });

  // 获取统计数据
  const { data: stats } = trpc.admin.userStats.useQuery();

  // 导出用户
  const handleExport = () => {
    toast.info('用户导出功能开发中');
  };

  // 过滤用户
  const filteredUsers = users?.filter((user: any) => {
    if (filterRole !== 'all' && user.role !== filterRole) return false;
    return true;
  }) || [];

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#6f5d55]">用户管理</h1>
            <p className="text-sm text-muted-foreground">查看和管理所有用户</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出用户
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总用户数</p>
                  <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <UserPlus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">今日新增</p>
                  <p className="text-2xl font-bold">{stats?.todayUsers || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">活跃用户</p>
                  <p className="text-2xl font-bold">{stats?.activeUsers || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Coins className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">积分总量</p>
                  <p className="text-2xl font-bold">-</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 筛选栏 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户名、邮箱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="用户角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部角色</SelectItem>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>性别</TableHead>
                  <TableHead>人群类型</TableHead>
                  <TableHead>积分</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="w-[80px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : !filteredUsers?.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      暂无用户数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-[#e89a8d] text-white">
                              {user.name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{user.name || '未设置'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.email || '-'}</TableCell>
                      <TableCell>{user.gender || '-'}</TableCell>
                      <TableCell>{user.userType || '-'}</TableCell>
                      <TableCell>{user.points || 0}</TableCell>
                      <TableCell>
                        <Badge className={USER_ROLES[user.role as keyof typeof USER_ROLES]?.color || ''}>
                          {USER_ROLES[user.role as keyof typeof USER_ROLES]?.label || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.createdAt ? format(new Date(user.createdAt), 'yyyy-MM-dd') : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastSignedIn ? format(new Date(user.lastSignedIn), 'yyyy-MM-dd HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 用户详情对话框 */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>用户详情</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback className="bg-[#e89a8d] text-white text-xl">
                      {selectedUser.name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedUser.name || '未设置'}</h3>
                    <p className="text-muted-foreground">{selectedUser.email || '-'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">用户ID</p>
                    <p>{selectedUser.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">OpenID</p>
                    <p className="font-mono text-sm truncate">{selectedUser.openId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">性别</p>
                    <p>{selectedUser.gender || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">人群类型</p>
                    <p>{selectedUser.userType || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">脸型</p>
                    <p>{selectedUser.faceType || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">积分</p>
                    <p className="text-lg font-bold">{selectedUser.points || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">角色</p>
                    <Badge className={USER_ROLES[selectedUser.role as keyof typeof USER_ROLES]?.color || ''}>
                      {USER_ROLES[selectedUser.role as keyof typeof USER_ROLES]?.label || selectedUser.role}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">注册时间</p>
                    <p>{selectedUser.createdAt ? format(new Date(selectedUser.createdAt), 'yyyy-MM-dd HH:mm:ss') : '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
