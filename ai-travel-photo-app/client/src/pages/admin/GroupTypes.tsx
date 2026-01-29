import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Users, User, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 固定的 19 种人群类型配置（用于显示说明）
const GROUP_TYPE_INFO: Record<string, { ageRange: string }> = {
  'girl_child': { ageRange: '0-12岁' },
  'girl_young': { ageRange: '13-25岁' },
  'woman_mature': { ageRange: '26-45岁' },
  'woman_elder': { ageRange: '46岁以上' },
  'boy_child': { ageRange: '0-12岁' },
  'man_young': { ageRange: '13-35岁' },
  'man_elder': { ageRange: '36岁以上' },
  'couple_love': { ageRange: '情侣合照' },
  'friends_girls': { ageRange: '女性朋友合照' },
  'friends_boys': { ageRange: '男性朋友合照' },
  'friends_mixed': { ageRange: '男女朋友合照' },
  'mom_son_child': { ageRange: '母亲与儿童儿子' },
  'mom_son_adult': { ageRange: '母亲与成年儿子' },
  'mom_daughter_child': { ageRange: '母亲与儿童女儿' },
  'mom_daughter_adult': { ageRange: '母亲与成年女儿' },
  'dad_son_child': { ageRange: '父亲与儿童儿子' },
  'dad_son_adult': { ageRange: '父亲与成年儿子' },
  'dad_daughter_child': { ageRange: '父亲与儿童女儿' },
  'dad_daughter_adult': { ageRange: '父亲与成年女儿' },
};

const MAX_DISPLAY_NAME_LENGTH = 6;

export default function GroupTypes() {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [sortOrder, setSortOrder] = useState<number>(1);

  const utils = trpc.useUtils();
  const { data: groupTypes, isLoading } = trpc.admin.groupTypes.useQuery();

  const updateMutation = trpc.admin.updateGroupType.useMutation({
    onSuccess: () => {
      toast.success('更新成功');
      utils.admin.groupTypes.invalidate();
      setIsEditOpen(false);
      setEditingType(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleEdit = (type: any) => {
    setEditingType(type);
    setDisplayName(type.displayName);
    setSortOrder(type.sortOrder || 1);
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingType) return;
    if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      toast.error(`显示名称不能超过 ${MAX_DISPLAY_NAME_LENGTH} 个字符`);
      return;
    }
    
    const updateData: { id: number; displayName?: string; sortOrder?: number } = {
      id: editingType.id,
    };
    
    if (displayName !== editingType.displayName) {
      updateData.displayName = displayName;
    }
    
    // 只有单人照类型才更新排序
    if (editingType.photoType === 'single' && sortOrder !== editingType.sortOrder) {
      updateData.sortOrder = sortOrder;
    }
    
    updateMutation.mutate(updateData);
  };

  const handleToggleActive = (type: any) => {
    updateMutation.mutate({
      id: type.id,
      isActive: !type.isActive,
    });
  };

  // 获取类型的年龄范围说明
  const getAgeRange = (code: string) => {
    return GROUP_TYPE_INFO[code]?.ageRange || '';
  };

  // 单人照类型按sortOrder排序
  const singleTypes = groupTypes?.filter(t => t.photoType === 'single').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) || [];
  // 合照类型
  const groupPhotoTypes = groupTypes?.filter(t => t.photoType === 'group') || [];

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">人群类型管理</h1>
            <p className="text-sm text-muted-foreground">配置模板人群类型的前端显示名称和排序</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            固定 19 种类型
          </Badge>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            人群类型为系统固定的 19 种分类（7种单人照 + 12种合照），代码与 AI 工作流对接，不可新增或删除。
            您可以自定义每种类型的前端显示名称（不超过 6 个字符）。单人照类型可配置排序顺序。
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 单人照类型 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                单人照类型
                <Badge variant="secondary">
                  {singleTypes.length} 种
                </Badge>
              </CardTitle>
              <CardDescription>
                适用于单人拍照的人群类型，可配置排序顺序
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">人群代码</TableHead>
                      <TableHead>显示名称</TableHead>
                      <TableHead className="w-[60px]">排序</TableHead>
                      <TableHead className="w-[80px]">状态</TableHead>
                      <TableHead className="w-[60px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {singleTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {type.code}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{type.displayName}</span>
                            <p className="text-xs text-muted-foreground">{getAgeRange(type.code)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {type.sortOrder}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={type.isActive}
                            onCheckedChange={() => handleToggleActive(type)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 合照类型 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                合照类型
                <Badge variant="secondary">
                  {groupPhotoTypes.length} 种
                </Badge>
              </CardTitle>
              <CardDescription>
                适用于双人合照的人群类型，排序固定
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">人群代码</TableHead>
                      <TableHead>显示名称</TableHead>
                      <TableHead className="w-[80px]">状态</TableHead>
                      <TableHead className="w-[60px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupPhotoTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {type.code}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{type.displayName}</span>
                            <p className="text-xs text-muted-foreground">{getAgeRange(type.code)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={type.isActive}
                            onCheckedChange={() => handleToggleActive(type)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 编辑对话框 */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑人群类型</DialogTitle>
              <DialogDescription>
                修改人群类型的显示名称{editingType?.photoType === 'single' ? '和排序' : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>人群代码</Label>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-muted rounded text-sm">
                    {editingType?.code}
                  </code>
                  <Badge variant="outline">
                    {editingType?.photoType === 'single' ? '单人照' : '合照'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  人群代码为系统固定值，与 AI 工作流对接，不可修改
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">显示名称</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="输入显示名称"
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                />
                <p className="text-xs text-muted-foreground">
                  显示名称不超过 {MAX_DISPLAY_NAME_LENGTH} 个字符（{displayName.length}/{MAX_DISPLAY_NAME_LENGTH}）
                </p>
              </div>
              {editingType?.photoType === 'single' && (
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">排序顺序</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    min={1}
                    max={7}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    输入 1-7 的数字，系统会自动调整其他项的排序以避免冲突
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>取消</Button>
              <Button 
                onClick={handleUpdate} 
                disabled={!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH || updateMutation.isPending}
              >
                {updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
